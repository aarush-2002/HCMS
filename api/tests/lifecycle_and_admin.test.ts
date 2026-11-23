import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { generateAccessToken } from '../src/lib/jwt.js';
import { processDeadlines, Clock } from '../src/services/deadlineEngine.js';
import {
  Role,
  ComplaintStatus,
  ComplaintPriority,
  ComplaintCategory,
} from '@prisma/client';

class FakeClock implements Clock {
  private currentTime: Date;
  constructor(initialTime: Date = new Date()) {
    this.currentTime = new Date(initialTime.getTime());
  }
  now(): Date {
    return new Date(this.currentTime.getTime());
  }
  advanceHours(hours: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + hours * 60 * 60 * 1000);
  }
}

describe('HCMS Full Lifecycle, Resolution Confirmation, Ratings & Admin Back Office', () => {
  let adminToken: string;
  let adminUser: { id: string; name: string };
  let wardenSinghToken: string;
  let wardenSinghUser: { id: string; name: string };
  let studentAaravToken: string; // Complainant (Hostel B)
  let studentAaravUser: { id: string; name: string };
  let studentPriyaToken: string; // Voter 1 (Hostel B)
  let studentRohanToken: string; // Voter 2 (Hostel B)
  let studentVikramToken: string; // Hostel A (different hostel)
  let hostelBId: string;
  let hostelAId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@hostel.edu' } });
    const wardenB = await prisma.user.findUniqueOrThrow({ where: { email: 'warden.singh@hostel.edu' } });
    const aarav = await prisma.user.findUniqueOrThrow({ where: { email: 'aarav@hostel.edu' } });
    const priya = await prisma.user.findUniqueOrThrow({ where: { email: 'priya@hostel.edu' } });
    const rohan = await prisma.user.findUniqueOrThrow({ where: { email: 'rohan@hostel.edu' } });
    const vikram = await prisma.user.findUniqueOrThrow({ where: { email: 'vikram@hostel.edu' } });

    adminUser = { id: admin.id, name: admin.name };
    wardenSinghUser = { id: wardenB.id, name: wardenB.name };
    studentAaravUser = { id: aarav.id, name: aarav.name };

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

    studentAaravToken = generateAccessToken({
      sub: aarav.id,
      email: aarav.email,
      name: aarav.name,
      role: aarav.role,
      hostelId: aarav.hostelId,
    });

    studentPriyaToken = generateAccessToken({
      sub: priya.id,
      email: priya.email,
      name: priya.name,
      role: priya.role,
      hostelId: priya.hostelId,
    });

    studentRohanToken = generateAccessToken({
      sub: rohan.id,
      email: rohan.email,
      name: rohan.name,
      role: rohan.role,
      hostelId: rohan.hostelId,
    });

    studentVikramToken = generateAccessToken({
      sub: vikram.id,
      email: vikram.email,
      name: vikram.name,
      role: vikram.role,
      hostelId: vikram.hostelId,
    });

    const hostelB = await prisma.hostel.findUniqueOrThrow({ where: { code: 'BLOCK-B' } });
    const hostelA = await prisma.hostel.findUniqueOrThrow({ where: { code: 'BLOCK-A' } });
    hostelBId = hostelB.id;
    hostelAId = hostelA.id;
  });

  // ===========================================================================
  // LIFECYCLE 1: Submit -> Upvote Promotion -> Acknowledge -> In Progress ->
  //              Marked Resolved -> 3 Solved Votes -> Resolved -> Rating -> History, Audit & Score
  // ===========================================================================
  describe('Lifecycle 1: Full Path to Resolution & Rating', () => {
    let lifecycleComplaintId: string;
    let initialDeadline: Date;
    let restartedDeadline: Date;
    let createdRatingId: string;

    it('Step 1: Student Aarav submits a NORMAL complaint', async () => {
      const now = new Date();
      initialDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);

      const complaint = await prisma.complaint.create({
        data: {
          title: 'Bathroom water geyser leakage and shock risk',
          description: 'Geyser is dripping heavily near the power socket on 3rd floor.',
          category: ComplaintCategory.PLUMBING,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: studentAaravUser.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: initialDeadline,
        },
      });

      lifecycleComplaintId = complaint.id;

      await prisma.statusHistory.create({
        data: {
          complaintId: complaint.id,
          actorId: studentAaravUser.id,
          toStatus: ComplaintStatus.SUBMITTED,
          reason: 'Initial submission',
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: studentAaravUser.id,
          action: 'COMPLAINT_SUBMITTED',
          entityType: 'Complaint',
          entityId: complaint.id,
          after: { title: complaint.title, priority: 'NORMAL' },
        },
      });

      expect(complaint.priority).toBe('NORMAL');
      expect(complaint.status).toBe('SUBMITTED');
    });

    it('Step 2: 10 eligible students upvote -> Auto-promoted to EMERGENCY with restarted 24h deadline', async () => {
      const passwordHash = await argon2.hash('password123');
      const voters = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          prisma.user.create({
            data: {
              name: `LifecycleVoter ${i}`,
              email: `lvoter.${i}.${Date.now()}@hostel.edu`,
              passwordHash,
              role: Role.STUDENT,
              hostelId: hostelBId,
            },
          })
        )
      );

      for (let i = 0; i < 9; i++) {
        await prisma.upvote.create({
          data: { complaintId: lifecycleComplaintId, userId: voters[i].id },
        });
      }

      // 10th upvote via API to trigger atomic promotion
      const voter10Token = generateAccessToken({
        sub: voters[9].id,
        email: voters[9].email,
        name: voters[9].name,
        role: voters[9].role,
        hostelId: voters[9].hostelId,
      });

      const promoStart = Date.now();
      const voteRes = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/upvote`)
        .set('Authorization', `Bearer ${voter10Token}`);

      expect(voteRes.status).toBe(200);
      expect(voteRes.body.promoted).toBe(true);
      expect(voteRes.body.priority).toBe('EMERGENCY');

      const promotedComplaint = await prisma.complaint.findUniqueOrThrow({
        where: { id: lifecycleComplaintId },
      });
      restartedDeadline = promotedComplaint.deadlineAt;
      expect(promotedComplaint.priority).toBe('EMERGENCY');

      const deadlineHours =
        (new Date(restartedDeadline).getTime() - promoStart) / (1000 * 60 * 60);
      expect(Math.round(deadlineHours)).toBe(24);
    });

    it('Step 3: Warden Acknowledges complaint', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${lifecycleComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.ACKNOWLEDGED, note: 'Plumber and electrician notified' });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('ACKNOWLEDGED');
    });

    it('Step 4: Warden moves status to IN_PROGRESS', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${lifecycleComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.IN_PROGRESS, note: 'Maintenance crew on site' });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('IN_PROGRESS');
    });

    it('Step 5: Warden marks resolved -> Service clock stops, 24h confirmation window opens', async () => {
      const res = await request(app)
        .post(`/api/warden/complaints/${lifecycleComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({
          status: ComplaintStatus.MARKED_RESOLVED,
          resolutionNote: 'Replaced faulty heating coil and gasket seal. Power socket moved to safe distance.',
        });

      expect(res.status).toBe(200);
      expect(res.body.complaint.status).toBe('MARKED_RESOLVED');
      expect(res.body.complaint.markedResolvedAt).toBeDefined();
      expect(res.body.complaint.confirmationWindowEndsAt).toBeDefined();
    });

    it('Step 6: Confirmation voting rules and evaluation', async () => {
      // Rule 1: Cross-hostel student (Vikram from Hostel A) cannot vote on Hostel B complaint (403)
      const crossRes = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentVikramToken}`)
        .send({ vote: 'solved' });
      expect(crossRes.status).toBe(403);

      // Rule 2: Warden cannot vote as student (403)
      const wardenVoteRes = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/confirm`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ vote: 'solved' });
      expect(wardenVoteRes.status).toBe(403);

      // 1st Solved vote (Aarav)
      const vote1 = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentAaravToken}`)
        .send({ vote: 'solved', comment: 'Looks dry now' });
      expect(vote1.status).toBe(200);
      expect(vote1.body.solvedCount).toBe(1);
      expect(vote1.body.status).toBe('MARKED_RESOLVED');

      // 2nd Solved vote (Priya)
      const vote2 = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .send({ vote: 'solved' });
      expect(vote2.status).toBe(200);
      expect(vote2.body.solvedCount).toBe(2);
      expect(vote2.body.status).toBe('MARKED_RESOLVED');

      // 3rd Solved vote (Rohan) -> Threshold of 3 reached: Transitions to RESOLVED!
      const vote3 = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentRohanToken}`)
        .send({ vote: 'solved', comment: 'Tested water pressure, works great' });

      expect(vote3.status).toBe(200);
      expect(vote3.body.solvedCount).toBe(3);
      expect(vote3.body.status).toBe('RESOLVED');
      expect(vote3.body.actionTaken).toBe('RESOLVED');

      // Verify in DB that status is RESOLVED and resolvedAt is recorded
      const resolved = await prisma.complaint.findUniqueOrThrow({
        where: { id: lifecycleComplaintId },
      });
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.confirmationWindowEndsAt).toBeNull();
    });

    it('Step 7: Original Complainant rates warden (1-3 stars)', async () => {
      // Non-complainant student (Priya) cannot rate (403)
      const unauthRate = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/rating`)
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .send({ stars: 3 });
      expect(unauthRate.status).toBe(403);

      // Original complainant (Aarav) rates 3 stars
      const rateRes = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/rating`)
        .set('Authorization', `Bearer ${studentAaravToken}`)
        .send({ stars: 3, comment: 'Fast response and good repairs!' });

      expect(rateRes.status).toBe(201);
      expect(rateRes.body.rating.stars).toBe(3);
      expect(rateRes.body.rating.wardenId).toBe(wardenSinghUser.id);
      createdRatingId = rateRes.body.rating.id;

      // Duplicate rating attempt rejected (409 Conflict)
      const dupRate = await request(app)
        .post(`/api/complaints/${lifecycleComplaintId}/rating`)
        .set('Authorization', `Bearer ${studentAaravToken}`)
        .send({ stars: 2 });
      expect(dupRate.status).toBe(409);
    });

    it('Step 8: History endpoint returns resolved complaint for student and warden', async () => {
      // Student history
      const studentHistoryRes = await request(app)
        .get('/api/history')
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(studentHistoryRes.status).toBe(200);
      const studentItem = studentHistoryRes.body.history.find(
        (h: { id: string }) => h.id === lifecycleComplaintId
      );
      expect(studentItem).toBeDefined();
      expect(studentItem.status).toBe('RESOLVED');
      expect(studentItem.rating.stars).toBe(3);

      // Warden history
      const wardenHistoryRes = await request(app)
        .get('/api/history?status=RESOLVED')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(wardenHistoryRes.status).toBe(200);
      const wardenItem = wardenHistoryRes.body.history.find(
        (h: { id: string }) => h.id === lifecycleComplaintId
      );
      expect(wardenItem).toBeDefined();
      expect(wardenItem.status).toBe('RESOLVED');
    });

    it('Step 9: Complete audit trail is inspectable with all lifecycle events', async () => {
      const audits = await prisma.auditEvent.findMany({
        where: { entityId: lifecycleComplaintId },
        orderBy: { timestamp: 'asc' },
      });

      const actions = audits.map((a) => a.action);
      expect(actions).toContain('COMPLAINT_SUBMITTED');
      expect(actions).toContain('PRIORITY_PROMOTED');
      expect(actions).toContain('STATUS_CHANGED');
      expect(actions).toContain('COMPLAINT_RESOLVED');

      const ratingAudit = await prisma.auditEvent.findFirst({
        where: { entityType: 'Rating', entityId: createdRatingId },
      });
      expect(ratingAudit).toBeDefined();
      expect(ratingAudit!.action).toBe('WARDEN_RATED');
    });

    it('Step 10: Warden score reflects the rating', async () => {
      const scoreRes = await request(app)
        .get('/api/warden/score')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(scoreRes.status).toBe(200);
      expect(scoreRes.body.totalRatings).toBeGreaterThanOrEqual(1);
      expect(scoreRes.body.averageRating).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // LIFECYCLE 2: Reopen Path via 3 Not Solved Votes
  // ===========================================================================
  describe('Lifecycle 2: Reopened by Community Confirmation Votes', () => {
    let reopenComplaintId: string;

    beforeAll(async () => {
      const complaint = await prisma.complaint.create({
        data: {
          title: 'Washroom flush valve constantly leaking',
          description: 'Water running continuously across the tiles.',
          category: ComplaintCategory.PLUMBING,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.MARKED_RESOLVED,
          submitterId: studentAaravUser.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          markedResolvedAt: new Date(),
          resolutionNote: 'Valve replaced.',
          confirmationRound: 1,
          confirmationWindowEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      reopenComplaintId = complaint.id;
    });

    it('3 Not Solved votes inside window transitions status to REOPENED with round 2', async () => {
      // 1st Not Solved vote
      await request(app)
        .post(`/api/complaints/${reopenComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentAaravToken}`)
        .send({ vote: 'not_solved', comment: 'Still running water' });

      // 2nd Not Solved vote
      await request(app)
        .post(`/api/complaints/${reopenComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .send({ vote: 'not_solved' });

      // 3rd Not Solved vote -> Triggers REOPENED!
      const res3 = await request(app)
        .post(`/api/complaints/${reopenComplaintId}/confirm`)
        .set('Authorization', `Bearer ${studentRohanToken}`)
        .send({ vote: 'not_solved', comment: 'Not fixed at all' });

      expect(res3.status).toBe(200);
      expect(res3.body.status).toBe('REOPENED');
      expect(res3.body.actionTaken).toBe('REOPENED');

      const reopenedComplaint = await prisma.complaint.findUniqueOrThrow({
        where: { id: reopenComplaintId },
      });
      expect(reopenedComplaint.status).toBe('REOPENED');
      expect(reopenedComplaint.confirmationRound).toBe(2);
      expect(reopenedComplaint.confirmationWindowEndsAt).toBeNull();

      // Warden can move REOPENED back to IN_PROGRESS
      const wardenRes = await request(app)
        .post(`/api/warden/complaints/${reopenComplaintId}/status`)
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .send({ status: ComplaintStatus.IN_PROGRESS, note: 'Recalling plumbing contractor' });

      expect(wardenRes.status).toBe(200);
      expect(wardenRes.body.complaint.status).toBe('IN_PROGRESS');
    });
  });

  // ===========================================================================
  // LIFECYCLE 3: Expired Confirmation Window Path
  // ===========================================================================
  describe('Lifecycle 3: Expired Confirmation Window Reverts to IN_PROGRESS', () => {
    it('returns to IN_PROGRESS for warden review when window ends without consensus', async () => {
      const fakeClock = new FakeClock(new Date('2026-11-15T10:00:00.000Z'));
      const initial = fakeClock.now();
      const windowEnd = new Date(initial.getTime() + 24 * 60 * 60 * 1000);

      const complaint = await prisma.complaint.create({
        data: {
          title: 'Study room air conditioner remote missing',
          description: 'Cannot turn on AC in central study room.',
          category: ComplaintCategory.FURNITURE,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.MARKED_RESOLVED,
          submitterId: studentAaravUser.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(initial.getTime() + 72 * 60 * 60 * 1000),
          createdAt: initial,
          markedResolvedAt: initial,
          resolutionNote: 'Universal remote paired and mounted on wall.',
          confirmationWindowEndsAt: windowEnd,
          confirmationRound: 1,
        },
      });

      // Advance clock past the 24h window (to +25 hours)
      fakeClock.advanceHours(25);
      const engineRes = await processDeadlines(fakeClock);
      expect(engineRes.expiredWindowsClosed).toBeGreaterThanOrEqual(1);

      const updated = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.confirmationWindowEndsAt).toBeNull();
    });
  });

  // ===========================================================================
  // 4. Admin Back Office & Abuse Control
  // ===========================================================================
  describe('Admin Back Office, Policies, Reclassification & Analytics', () => {
    let testRatingId: string;
    let testComplaintForReclassifyId: string;

    beforeAll(async () => {
      // Find or create a rating for abuse control test
      const rating = await prisma.rating.findFirst();
      testRatingId = rating!.id;

      // Create complaint for reclassification test
      const c = await prisma.complaint.create({
        data: {
          title: 'Mild corridor odor',
          description: 'Occasional musty smell near laundry room.',
          category: ComplaintCategory.OTHER,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: studentAaravUser.id,
          hostelId: hostelBId,
          assignedWardenId: wardenSinghUser.id,
          deadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      });
      testComplaintForReclassifyId = c.id;
    });

    it('Abuse Control: Admin flags and hides rating with reason, excluding from average', async () => {
      const hideRes = await request(app)
        .post(`/api/admin/ratings/${testRatingId}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Inappropriate language and abusive personal remarks' });

      expect(hideRes.status).toBe(200);
      expect(hideRes.body.rating.isHidden).toBe(true);

      // Verify audit event for rating hidden
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: testRatingId, action: 'RATING_HIDDEN' },
      });
      expect(audit).toBeDefined();

      // Admin can restore rating
      const unhideRes = await request(app)
        .post(`/api/admin/ratings/${testRatingId}/unhide`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(unhideRes.status).toBe(200);
      expect(unhideRes.body.rating.isHidden).toBe(false);
    });

    it('Admin Hostels CRUD and Policy Management', async () => {
      // Create hostel
      const newCode = `TEST-${Date.now().toString().slice(-4)}`;
      const hostelRes = await request(app)
        .post('/api/admin/hostels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Sarojini Naidu Bhawan',
          code: newCode,
          timezone: 'Asia/Kolkata',
        });

      expect(hostelRes.status).toBe(201);
      expect(hostelRes.body.hostel.code).toBe(newCode);

      // Update Policy for the newly created test hostel
      const policyRes = await request(app)
        .patch('/api/admin/policy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          hostelId: hostelRes.body.hostel.id,
          normalDeadlineHours: 48,
          upvotesToEscalate: 8,
          confirmationWindowHours: 12,
        });

      expect(policyRes.status).toBe(200);
      expect(policyRes.body.policy.normalDeadlineHours).toBe(48);
      expect(policyRes.body.policy.upvotesToEscalate).toBe(8);

      // Verify AuditEvent for policy change
      const policyAudit = await prisma.auditEvent.findFirst({
        where: { action: 'POLICY_UPDATED' },
      });
      expect(policyAudit).toBeDefined();
    });

    it('Admin Reclassify: Reclassifies complaint category & priority with restarted SLA', async () => {
      const now = Date.now();
      const reclassifyRes = await request(app)
        .post(`/api/admin/complaints/${testComplaintForReclassifyId}/reclassify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: ComplaintCategory.CLEANLINESS,
          priority: ComplaintPriority.EMERGENCY,
          reason: 'Identified as toxic chemical leak requiring immediate hazmat isolation',
        });

      expect(reclassifyRes.status).toBe(200);
      expect(reclassifyRes.body.complaint.category).toBe('CLEANLINESS');
      expect(reclassifyRes.body.complaint.priority).toBe('EMERGENCY');

      // Verify restarted 24h deadline
      const deadlineDiff =
        (new Date(reclassifyRes.body.complaint.deadlineAt).getTime() - now) / (1000 * 60 * 60);
      expect(Math.round(deadlineDiff)).toBe(24);
    });

    it('Admin Audit Trail inspection (GET /api/admin/audit)', async () => {
      const res = await request(app)
        .get('/api/admin/audit?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    });

    it('Admin Reports (GET /api/admin/reports) returns PRD success metrics', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.metrics).toBeDefined();
      const m = res.body.metrics;

      expect(typeof m.totalComplaints).toBe('number');
      expect(typeof m.acknowledgedPercentage).toBe('number');
      expect(typeof m.normalResolvedWithin72hPercentage).toBe('number');
      expect(typeof m.emergencyResolvedWithin24hPercentage).toBe('number');
      expect(typeof m.medianTimeToResolutionHours).toBe('number');
      expect(typeof m.studentConfirmationPercentage).toBe('number');
      expect(typeof m.countOfDuplicatesOrMiscategorised).toBe('number');
    });
  });
});
