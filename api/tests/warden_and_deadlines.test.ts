import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { generateAccessToken } from '../src/lib/jwt.js';
import { processDeadlines, Clock } from '../src/services/deadlineEngine.js';
import { Role, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@prisma/client';

class FakeClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = new Date(initialTime.getTime());
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  advanceBy(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  advanceHours(hours: number): void {
    this.advanceBy(hours * 60 * 60 * 1000);
  }

  setTime(time: Date): void {
    this.currentTime = new Date(time.getTime());
  }
}

describe('HCMS Warden Workflow, SLAs, Penalties & Deadline Engine', () => {
  let adminToken: string;
  let adminUser: { id: string; name: string };
  let wardenSinghToken: string; // Hostel B
  let wardenSinghUser: { id: string; name: string };
  let wardenVermaToken: string; // Hostel A
  let wardenVermaUser: { id: string; name: string };
  let studentAaravToken: string; // Hostel B
  let hostelBId: string;
  let hostelAId: string;

  beforeAll(async () => {
    // 1. Fetch seeded users
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@hostel.edu' } });
    const wardenB = await prisma.user.findUniqueOrThrow({ where: { email: 'warden.singh@hostel.edu' } });
    const wardenA = await prisma.user.findUniqueOrThrow({ where: { email: 'warden.verma@hostel.edu' } });
    const studentB = await prisma.user.findUniqueOrThrow({ where: { email: 'aarav@hostel.edu' } });

    adminUser = { id: admin.id, name: admin.name };
    wardenSinghUser = { id: wardenB.id, name: wardenB.name };
    wardenVermaUser = { id: wardenA.id, name: wardenA.name };

    adminToken = generateAccessToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      hostelId: admin.hostelId,
    });

    wardenSinghToken = generateAccessToken({
      sub: wardenB.id,
      email: wardenB.email,
      name: wardenB.name,
      role: wardenB.role,
      hostelId: wardenB.hostelId,
    });

    wardenVermaToken = generateAccessToken({
      sub: wardenA.id,
      email: wardenA.email,
      name: wardenA.name,
      role: wardenA.role,
      hostelId: wardenA.hostelId,
    });

    studentAaravToken = generateAccessToken({
      sub: studentB.id,
      email: studentB.email,
      name: studentB.name,
      role: studentB.role,
      hostelId: studentB.hostelId,
    });

    const hostelB = await prisma.hostel.findUniqueOrThrow({ where: { code: 'BLOCK-B' } });
    const hostelA = await prisma.hostel.findUniqueOrThrow({ where: { code: 'BLOCK-A' } });
    hostelBId = hostelB.id;
    hostelAId = hostelA.id;
  });

  // ---------------------------------------------------------------------------
  // 1. Warden Queue & Access Scoping (GET /api/warden/queue)
  // ---------------------------------------------------------------------------
  describe('Warden Queue & Access Scoping (GET /api/warden/queue)', () => {
    it('returns complaints in warden scope with submitter identity, SLA info and sorting', async () => {
      const res = await request(app)
        .get('/api/warden/queue')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.queue)).toBe(true);
      expect(res.body.queue.length).toBeGreaterThan(0);

      // Verify all items belong to Hostel B (Warden Singh's assigned hostel)
      for (const item of res.body.queue) {
        expect(item.hostelId).toBe(hostelBId);
        // Wardens MAY see submitter identity
        expect(item.submitter).toBeDefined();
        expect(item.submitter.name).toBeDefined();
        expect(item.submitter.email).toBeDefined();
        // Time & SLA metrics
        expect(typeof item.remainingMs).toBe('number');
        expect(typeof item.remainingHours).toBe('number');
        expect(typeof item.isOverdue).toBe('boolean');
        expect(typeof item.upvoteCount).toBe('number');
        expect(Array.isArray(item.photos)).toBe(true);
      }

      // Default sorting: overdue first, then emergency, then nearest deadline
      for (let i = 0; i < res.body.queue.length - 1; i++) {
        const curr = res.body.queue[i];
        const next = res.body.queue[i + 1];
        if (curr.isOverdue !== next.isOverdue) {
          expect(curr.isOverdue).toBe(true);
          expect(next.isOverdue).toBe(false);
        }
      }
    });

    it('enforces scope: rejects warden attempting to request queue for an unassigned hostel (403)', async () => {
      const res = await request(app)
        .get(`/api/warden/queue?hostelId=${hostelAId}`)
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('outside your assigned warden scope');
    });

    it('filters queue by priority, status, category, and overdue flag', async () => {
      const res = await request(app)
        .get('/api/warden/queue?priority=emergency')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.queue) {
        expect(item.priority).toBe('EMERGENCY');
      }

      const overdueRes = await request(app)
        .get('/api/warden/queue?overdue=true')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(overdueRes.status).toBe(200);
      for (const item of overdueRes.body.queue) {
        expect(item.isOverdue).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Full Complaint Detail for Warden (GET /api/warden/complaints/:id)
  // ---------------------------------------------------------------------------
  describe('Full Complaint Detail (GET /api/warden/complaints/:id)', () => {
    let complaint1042Id: string;
    let complaintHostelAId: string;

    beforeAll(async () => {
      const c1042 = await prisma.complaint.findFirstOrThrow({ where: { displayNumber: 1042 } });
      complaint1042Id = c1042.id;

      // Find a complaint in Hostel A
      const cA = await prisma.complaint.findFirstOrThrow({ where: { hostelId: hostelAId } });
      complaintHostelAId = cA.id;
    });

    it('returns complete complaint detail, photo viewer data, history, votes and audit trail', async () => {
      const res = await request(app)
        .get(`/api/warden/complaints/${complaint1042Id}`)
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(res.body.complaint).toBeDefined();
      expect(res.body.complaint.id).toBe(complaint1042Id);
      expect(res.body.complaint.submitter.name).toBe('Aarav Sharma');
      expect(Array.isArray(res.body.complaint.photos)).toBe(true);
      expect(Array.isArray(res.body.complaint.statusHistory)).toBe(true);
      expect(Array.isArray(res.body.complaint.priorityHistory)).toBe(true);
      expect(res.body.votesSummary).toBeDefined();
      expect(typeof res.body.votesSummary.upvotes).toBe('number');
      expect(res.body.votesSummary.confirmation).toBeDefined();
      expect(Array.isArray(res.body.auditTrail)).toBe(true);
    });

    it('rejects cross-hostel detail inspection (Warden Singh cannot view Hostel A complaint) (403)', async () => {
      const res = await request(app)
        .get(`/api/warden/complaints/${complaintHostelAId}`)
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not assigned to manage complaints in this hostel');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Status Transitions, Notes & Rejection Policy
  // ---------------------------------------------------------------------------
  describe('Warden Status Transitions & Allowed Progression', () => {
    let transitionTestComplaintId: string;

    beforeAll(async () => {
      // Create a fresh test complaint in SUBMITTED state for transition tests
      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });
      const c = await prisma.complaint.create({
        data: {
          title: 'Ceiling fan making vibrating sound',
          description: 'Regulator is stuck on speed 5 and fan vibrates loudly.',
          category: ComplaintCategory.ELECTRICAL,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
      transitionTestComplaintId = c.id;
    });

    it('rejects invalid jump from SUBMITTED directly to RESOLVED or MARKED_RESOLVED (400)', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.RESOLVED });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
      expect(res.body.error.message).toContain('Allowed transitions from \'SUBMITTED\': ACKNOWLEDGED');
    });

    it('rejects warden attempting to reject complaint (403 ADMIN_ONLY_ACTION)', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.REJECTED });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ADMIN_ONLY_ACTION');
      expect(res.body.error.message).toContain('Only administrators can mark complaints as Rejected');
    });

    it('allows valid progression: SUBMITTED -> ACKNOWLEDGED', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.ACKNOWLEDGED, note: 'Reviewed and queued for electrician' });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('ACKNOWLEDGED');

      // Verify StatusHistory recorded note
      const history = await prisma.statusHistory.findFirst({
        where: { complaintId: transitionTestComplaintId, toStatus: ComplaintStatus.ACKNOWLEDGED },
      });
      expect(history).toBeDefined();
      expect(history!.reason).toContain('Reviewed and queued for electrician');
    });

    it('allows valid progression: ACKNOWLEDGED -> IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.IN_PROGRESS, note: 'Electrician dispatched to room' });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('IN_PROGRESS');
    });

    it('rejects IN_PROGRESS -> MARKED_RESOLVED when resolution note is missing or too short (400)', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.MARKED_RESOLVED, resolutionNote: 'OK' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('RESOLUTION_NOTE_REQUIRED');
      expect(res.body.error.message).toContain('at least 5 characters');
    });

    it('allows IN_PROGRESS -> MARKED_RESOLVED with valid note: opens 24h window and records markedResolvedAt', async () => {
      const markTimeStart = Date.now();
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({
          status: ComplaintStatus.MARKED_RESOLVED,
          resolutionNote: 'Capacitor replaced and speed regulator repaired. Tested functioning.',
        });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('MARKED_RESOLVED');
      expect(res.body.complaint.markedResolvedAt).toBeDefined();
      expect(res.body.complaint.confirmationWindowEndsAt).toBeDefined();

      // Verify 24h confirmation window math
      const windowDiffHours =
        (new Date(res.body.complaint.confirmationWindowEndsAt).getTime() - markTimeStart) /
        (1000 * 60 * 60);
      expect(Math.round(windowDiffHours)).toBe(24);
    });

    it('allows MARKED_RESOLVED -> IN_PROGRESS (cancels confirmation window)', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${transitionTestComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({
          status: ComplaintStatus.IN_PROGRESS,
          note: 'Reopened by warden for double check on fan speed',
        });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('IN_PROGRESS');
      expect(res.body.complaint.confirmationWindowEndsAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Admin Management: Reject & Reassign Endpoints
  // ---------------------------------------------------------------------------
  describe('Admin Actions: Reassign Warden & Reject Complaint', () => {
    let adminActionComplaintId: string;

    beforeAll(async () => {
      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });
      const c = await prisma.complaint.create({
        data: {
          title: 'Spam complaint test',
          description: 'Testing administrative rejection and reassignment policies.',
          category: ComplaintCategory.OTHER,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
      adminActionComplaintId = c.id;
    });

    it('allows admin to reassign complaint to another warden with audit trail', async () => {
      const res = await request(app)
        .post(`/api/admin/complaints/${adminActionComplaintId}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          wardenId: wardenVermaUser.id,
          reason: 'Senior warden taking over oversight',
        });

      expect(res.status).toBe(200);
      expect(res.body.complaint.assignedWardenId).toBe(wardenVermaUser.id);

      // Verify AuditEvent for reassignment
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: adminActionComplaintId, action: 'WARDEN_REASSIGNED' },
      });
      expect(audit).toBeDefined();
      expect(audit!.actorId).toBe(adminUser.id);
    });

    it('allows admin to reject complaint with reason, updating status to REJECTED', async () => {
      const res = await request(app)
        .post(`/api/admin/complaints/${adminActionComplaintId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Duplicate invalid request verified by admin inspection' });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('REJECTED');
      expect(res.body.complaint.rejectionReason).toBe(
        'Duplicate invalid request verified by admin inspection'
      );

      // Verify StatusHistory
      const statusHistory = await prisma.statusHistory.findFirst({
        where: { complaintId: adminActionComplaintId, toStatus: ComplaintStatus.REJECTED },
      });
      expect(statusHistory).toBeDefined();
      expect(statusHistory!.reason).toContain('Duplicate invalid request');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Deadline Engine & Fake Clock Execution
  // ---------------------------------------------------------------------------
  describe('Deadline Engine & SLA Enforcement with Fake Clock', () => {
    it('detects overdue complaint past deadline, creates exactly ONE penalty, and never duplicates on rerun', async () => {
      const fakeClock = new FakeClock(new Date('2026-11-01T10:00:00.000Z'));
      const initialTime = fakeClock.now();

      // 1. Create a test complaint with a 24-hour deadline from initialTime
      const deadlineAt = new Date(initialTime.getTime() + 24 * 60 * 60 * 1000); // 2026-11-02T10:00:00Z
      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });

      const complaint = await prisma.complaint.create({
        data: {
          title: 'Urgent main electrical breaker spark',
          description: 'Sparks observed from floor main distribution board.',
          category: ComplaintCategory.ELECTRICAL,
          priority: ComplaintPriority.EMERGENCY,
          status: ComplaintStatus.SUBMITTED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt,
          createdAt: initialTime,
        },
      });

      // 2. Run engine before deadline (at +12 hours) -> No penalty should be applied
      fakeClock.advanceHours(12);
      const res1 = await processDeadlines(fakeClock);
      expect(res1.penaltiesApplied).toBe(0);

      const penaltyCountBefore = await prisma.penaltyEvent.count({
        where: { complaintId: complaint.id },
      });
      expect(penaltyCountBefore).toBe(0);

      // 3. Advance fake clock past deadline (at +25 hours) -> Overdue detected!
      fakeClock.advanceHours(13); // Now at 25h
      const res2 = await processDeadlines(fakeClock);
      expect(res2.penaltiesApplied).toBeGreaterThanOrEqual(1);

      // Verify exactly ONE PenaltyEvent was created
      const penaltiesAfter = await prisma.penaltyEvent.findMany({
        where: { complaintId: complaint.id },
      });
      expect(penaltiesAfter.length).toBe(1);
      expect(penaltiesAfter[0].wardenId).toBe(wardenSinghUser.id);
      expect(penaltiesAfter[0].points).toBe(1); // represents -1 penalty
      expect(penaltiesAfter[0].deadlineAt.getTime()).toBe(deadlineAt.getTime());

      // Verify AuditEvent for penalty was created
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: penaltiesAfter[0].id, action: 'DEADLINE_PENALTY_APPLIED' },
      });
      expect(audit).toBeDefined();

      // 4. IDEMPOTENCY CHECK: Run engine multiple times after deadline
      fakeClock.advanceHours(5); // At 30h
      await processDeadlines(fakeClock);

      fakeClock.advanceHours(24); // At 54h
      await processDeadlines(fakeClock);

      // Verify penalties remain strictly 1 (NEVER duplicates!)
      const penaltiesFinal = await prisma.penaltyEvent.findMany({
        where: { complaintId: complaint.id },
      });
      expect(penaltiesFinal.length).toBe(1);
    });

    it('never penalises a complaint that was MARKED_RESOLVED before the deadline passed', async () => {
      const fakeClock = new FakeClock(new Date('2026-11-05T08:00:00.000Z'));
      const initialTime = fakeClock.now();
      const deadlineAt = new Date(initialTime.getTime() + 72 * 60 * 60 * 1000); // 72 hours later

      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });

      // Complaint marked resolved at +48 hours (well before 72h deadline)
      const resolvedTime = new Date(initialTime.getTime() + 48 * 60 * 60 * 1000);
      const windowEnd = new Date(resolvedTime.getTime() + 24 * 60 * 60 * 1000);

      const resolvedComplaint = await prisma.complaint.create({
        data: {
          title: 'Water filter cartridge replacement',
          description: 'Filter cartridge requires scheduled replacement.',
          category: ComplaintCategory.PLUMBING,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.MARKED_RESOLVED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt,
          createdAt: initialTime,
          markedResolvedAt: resolvedTime,
          resolutionNote: 'Replaced with brand new 5-micron spun filter.',
          confirmationWindowEndsAt: windowEnd,
        },
      });

      // Advance fake clock past the 72h deadline (e.g. at +80 hours)
      fakeClock.advanceHours(80);
      await processDeadlines(fakeClock);

      // Verify NO penalty was applied to this marked resolved complaint
      const penalties = await prisma.penaltyEvent.findMany({
        where: { complaintId: resolvedComplaint.id },
      });
      expect(penalties.length).toBe(0);
    });

    it('promotion restarts the deadline correctly and evaluates overdue against restarted SLA', async () => {
      const fakeClock = new FakeClock(new Date('2026-11-08T09:00:00.000Z'));
      const initialTime = fakeClock.now();
      const normalDeadline = new Date(initialTime.getTime() + 72 * 60 * 60 * 1000); // 72 hours later

      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });

      const normalComplaint = await prisma.complaint.create({
        data: {
          title: 'Corridor window hinge detached',
          description: 'Hinge broke and glass panes swing violently in heavy wind.',
          category: ComplaintCategory.FURNITURE,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: normalDeadline,
          createdAt: initialTime,
        },
      });

      // At +10h, complaint is promoted to EMERGENCY with restarted 24h deadline
      fakeClock.advanceHours(10);
      const promotionTime = fakeClock.now();
      const restartedEmergencyDeadline = new Date(promotionTime.getTime() + 24 * 60 * 60 * 1000); // 10h + 24h = 34h from start

      await prisma.$transaction(async (tx) => {
        await tx.complaint.update({
          where: { id: normalComplaint.id },
          data: {
            priority: ComplaintPriority.EMERGENCY,
            deadlineAt: restartedEmergencyDeadline,
          },
        });
        await tx.priorityHistory.create({
          data: {
            complaintId: normalComplaint.id,
            fromPriority: ComplaintPriority.NORMAL,
            toPriority: ComplaintPriority.EMERGENCY,
            reason: 'Auto-promoted after reaching 10 community upvotes',
            previousDeadlineAt: normalDeadline,
            newDeadlineAt: restartedEmergencyDeadline,
            createdAt: promotionTime,
          },
        });
      });

      // Advance clock to +20h from start (+10h after promotion) -> should NOT be overdue yet (needs 24h from promotion)
      fakeClock.advanceHours(10);
      await processDeadlines(fakeClock);

      const penaltyAt20h = await prisma.penaltyEvent.findMany({
        where: { complaintId: normalComplaint.id },
      });
      expect(penaltyAt20h.length).toBe(0);

      // Advance clock past the restarted emergency deadline (+26h after promotion = +36h from start)
      fakeClock.advanceHours(16);
      const res = await processDeadlines(fakeClock);
      expect(res.penaltiesApplied).toBeGreaterThanOrEqual(1);

      // Verify penalty is created against the restarted deadline!
      const penaltyAt36h = await prisma.penaltyEvent.findMany({
        where: { complaintId: normalComplaint.id },
      });
      expect(penaltyAt36h.length).toBe(1);
      expect(penaltyAt36h[0].deadlineAt.getTime()).toBe(restartedEmergencyDeadline.getTime());
    });

    it('closes expired confirmation window and returns complaint to IN_PROGRESS when thresholds unmet', async () => {
      const fakeClock = new FakeClock(new Date('2026-11-10T12:00:00.000Z'));
      const markTime = fakeClock.now();
      const windowEndsAt = new Date(markTime.getTime() + 24 * 60 * 60 * 1000);

      const submitter = await prisma.user.findFirstOrThrow({
        where: { hostelId: hostelBId, role: Role.STUDENT },
      });

      const complaint = await prisma.complaint.create({
        data: {
          title: 'Room heater thermostat tripping',
          description: 'Thermostat keeps tripping within 5 minutes.',
          category: ComplaintCategory.ELECTRICAL,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.MARKED_RESOLVED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(markTime.getTime() + 72 * 60 * 60 * 1000),
          createdAt: markTime,
          markedResolvedAt: markTime,
          resolutionNote: 'Adjusted thermal cutoff sensitivity.',
          confirmationWindowEndsAt: windowEndsAt,
          confirmationRound: 1,
        },
      });

      // Only 1 student cast a vote (1 Solved, 0 Not Solved — threshold of 3 not reached)
      await prisma.confirmationVote.create({
        data: {
          complaintId: complaint.id,
          userId: submitter.id,
          round: 1,
          vote: 'SOLVED',
        },
      });

      // Advance clock past the 24h window (e.g. +25 hours)
      fakeClock.advanceHours(25);
      const res = await processDeadlines(fakeClock);
      expect(res.expiredWindowsClosed).toBeGreaterThanOrEqual(1);

      // Verify complaint returned to IN_PROGRESS and confirmation window cleared
      const updated = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.confirmationWindowEndsAt).toBeNull();

      // Verify StatusHistory recorded expiration
      const history = await prisma.statusHistory.findFirst({
        where: { complaintId: complaint.id, toStatus: ComplaintStatus.IN_PROGRESS },
        orderBy: { createdAt: 'desc' },
      });
      expect(history).toBeDefined();
      expect(history!.reason).toContain('confirmation window expired');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Warden Score Calculation & Admin Penalty Waiving
  // ---------------------------------------------------------------------------
  describe('Warden Score Calculation & Admin Penalty Waiving', () => {
    let testPenaltyId: string;

    it('calculates warden score transparently with average rating and penalty deduction', async () => {
      // Ensure Warden Singh has a penalty to measure
      const penalty = await prisma.penaltyEvent.findFirst({
        where: { wardenId: wardenSinghUser.id, isVoided: false },
      });
      expect(penalty).toBeDefined();
      testPenaltyId = penalty!.id;

      const res = await request(app)
        .get('/api/warden/score')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(res.body.warden.id).toBe(wardenSinghUser.id);
      expect(typeof res.body.penaltyCount).toBe('number');
      expect(res.body.penaltyCount).toBeGreaterThanOrEqual(1);
      expect(res.body.formulaExplanation).toContain('Score is calculated as: Average Star Rating (1–3) - (0.5 × Active Penalties)');

      // Verify composite score math
      const baseRating = res.body.averageRating !== null ? res.body.averageRating : 0;
      const expectedScore = Math.round((baseRating - 0.5 * res.body.penaltyCount) * 100) / 100;
      expect(res.body.netScore).toBe(expectedScore);
      expect(Array.isArray(res.body.penalties)).toBe(true);
    });

    it('allows admin to waive a penalty with a reason, updating net score and audit trail', async () => {
      const waiveRes = await request(app)
        .post(`/api/admin/penalties/${testPenaltyId}/waive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'External vendor spare part supply chain disruption verified by admin' });

      expect(waiveRes.status).toBe(200);
      expect(waiveRes.body.penalty.isVoided).toBe(true);
      expect(waiveRes.body.penalty.voidedReason).toContain('supply chain disruption');

      // Verify AuditEvent for penalty waiver
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: testPenaltyId, action: 'PENALTY_VOIDED' },
      });
      expect(audit).toBeDefined();

      // Check warden score again to confirm active penalty count decreased
      const scoreRes = await request(app)
        .get('/api/warden/score')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(scoreRes.status).toBe(200);
      const voidedItem = scoreRes.body.voidedPenalties.find((p: { id: string }) => p.id === testPenaltyId);
      expect(voidedItem).toBeDefined();
      expect(voidedItem.voidedReason).toContain('supply chain disruption');
    });
  });
});
