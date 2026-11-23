import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { generateAccessToken } from '../src/lib/jwt.js';
import { Role, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@prisma/client';

describe('HCMS Community Feed, Upvotes, Emergency Promotion & Notifications', () => {
  let studentAaravToken: string;  // Hostel B
  let studentPriyaToken: string;  // Hostel B
  let studentVikramToken: string; // Hostel A
  let wardenSinghToken: string;   // Hostel B
  let hostelBId: string;
  let hostelAId: string;
  let complaint1042Id: string; // Aarav's complaint
  let complaint1043Id: string; // Rohan's complaint (9 upvotes seeded)
  let complaint1044Id: string;
  let resolvedComplaintId: string; // #1047
  let userAaravId: string;

  beforeAll(async () => {
    // Auth logins
    const aaravRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'aarav@hostel.edu', password: 'password123' });
    studentAaravToken = aaravRes.headers['set-cookie']
      .find((c: string) => c.startsWith('hmcs_access_token='))!
      .match(/hmcs_access_token=([^;]+)/)![1];
    userAaravId = aaravRes.body.user.id;

    const priyaRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'priya@hostel.edu', password: 'password123' });
    studentPriyaToken = priyaRes.headers['set-cookie']
      .find((c: string) => c.startsWith('hmcs_access_token='))!
      .match(/hmcs_access_token=([^;]+)/)![1];

    const vikramRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'vikram@hostel.edu', password: 'password123' });
    studentVikramToken = vikramRes.headers['set-cookie']
      .find((c: string) => c.startsWith('hmcs_access_token='))!
      .match(/hmcs_access_token=([^;]+)/)![1];

    const singhRes = await request(app)
      .post('/api/auth/warden/login')
      .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });
    wardenSinghToken = singhRes.headers['set-cookie']
      .find((c: string) => c.startsWith('hmcs_access_token='))!
      .match(/hmcs_access_token=([^;]+)/)![1];

    const hostelB = await prisma.hostel.findUnique({ where: { code: 'BLOCK-B' } });
    const hostelA = await prisma.hostel.findUnique({ where: { code: 'BLOCK-A' } });
    hostelBId = hostelB!.id;
    hostelAId = hostelA!.id;

    const c1042 = await prisma.complaint.findFirst({ where: { displayNumber: 1042 } });
    const c1043 = await prisma.complaint.findFirst({ where: { displayNumber: 1043 } });
    const c1044 = await prisma.complaint.findFirst({ where: { displayNumber: 1044 } });
    const c1047 = await prisma.complaint.findFirst({ where: { displayNumber: 1047 } });

    complaint1042Id = c1042!.id;
    complaint1043Id = c1043!.id;
    complaint1044Id = c1044!.id;
    resolvedComplaintId = c1047!.id;
  });

  // 1. Community Feed (GET /api/feed)
  describe('Community Feed (GET /api/feed)', () => {
    it('returns active complaints in student hostel, excluding Resolved/Closed/Rejected', async () => {
      const res = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.feed)).toBe(true);
      expect(res.body.feed.length).toBeGreaterThan(0);

      // Verify all items belong to Hostel B and are in active statuses
      for (const item of res.body.feed) {
        expect(['SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MARKED_RESOLVED', 'REOPENED']).toContain(item.status);
        expect(['RESOLVED', 'CLOSED', 'REJECTED']).not.toContain(item.status);
      }

      // Verify Resolved #1047, Closed #1050, and Rejected #1051 are excluded
      const numbers = res.body.feed.map((f: { readableId: string }) => f.readableId);
      expect(numbers).not.toContain('HM-1047');
      expect(numbers).not.toContain('HM-1050');
      expect(numbers).not.toContain('HM-1051');
    });

    it('filters feed by priority, category, and search text', async () => {
      const res = await request(app)
        .get('/api/feed?priority=emergency&category=plumbing')
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(res.status).toBe(200);
      for (const item of res.body.feed) {
        expect(item.priority).toBe('EMERGENCY');
        expect(item.category).toBe('PLUMBING');
      }
    });

    it('supports cursor pagination across feed items', async () => {
      const page1 = await request(app)
        .get('/api/feed?limit=2')
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(page1.status).toBe(200);
      expect(page1.body.feed.length).toBe(2);
      expect(page1.body.pagination.nextCursor).toBeDefined();

      const nextCursor = page1.body.pagination.nextCursor;
      const page2 = await request(app)
        .get(`/api/feed?limit=2&cursor=${nextCursor}`)
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(page2.status).toBe(200);
      // Items on page 2 should be distinct from page 1
      const page1Ids = page1.body.feed.map((f: { id: string }) => f.id);
      expect(page1Ids).not.toContain(page2.body.feed[0].id);
    });

    it('scans feed payload to verify submitter identity is never leaked to peers', async () => {
      const res = await request(app)
        .get('/api/feed')
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(res.status).toBe(200);
      const json = JSON.stringify(res.body);

      // Verify no student personal attributes exist in the feed items
      expect(json).not.toContain('submitterId');
      expect(json).not.toContain('Aarav Sharma');
      expect(json).not.toContain('aarav@hostel.edu');
      expect(json).not.toContain('STU-B-302');
    });
  });

  // 2. Upvote Rules & Boundary Enforcement
  describe('Upvote Rules & Boundaries', () => {
    it('rejects student attempting to upvote their own complaint (400 SELF_UPVOTE_DISALLOWED)', async () => {
      const res = await request(app)
        .post(`/api/complaints/${complaint1042Id}/upvote`)
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SELF_UPVOTE_DISALLOWED');
      expect(res.body.error.message).toContain('cannot upvote your own complaint');
    });

    it('rejects student attempting to upvote an inactive/resolved complaint (400 INACTIVE_COMPLAINT)', async () => {
      const res = await request(app)
        .post(`/api/complaints/${resolvedComplaintId}/upvote`)
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INACTIVE_COMPLAINT');
    });

    it('rejects cross-hostel upvote: student Vikram (Hostel A) cannot vote on Hostel B complaint (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/complaints/${complaint1043Id}/upvote`)
        .set('Authorization', `Bearer ${studentVikramToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows eligible student Aarav to upvote, then rejects duplicate upvote (409 Conflict)', async () => {
      // Ensure Aarav hasn't upvoted c1044 yet
      await prisma.upvote.deleteMany({
        where: { complaintId: complaint1044Id, userId: userAaravId },
      });

      // 1st Upvote
      const res1 = await request(app)
        .post(`/api/complaints/${complaint1044Id}/upvote`)
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(res1.status).toBe(200);
      expect(res1.body.hasUpvoted).toBe(true);
      const initialCount = res1.body.upvoteCount;

      // Duplicate Upvote attempt
      const res2 = await request(app)
        .post(`/api/complaints/${complaint1044Id}/upvote`)
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(res2.status).toBe(409);
      expect(res2.body.error.message).toContain('already upvoted');

      // DELETE Upvote
      const delRes = await request(app)
        .delete(`/api/complaints/${complaint1044Id}/upvote`)
        .set('Authorization', `Bearer ${studentAaravToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.hasUpvoted).toBe(false);
      expect(delRes.body.upvoteCount).toBe(initialCount - 1);
    });
  });

  // 3. 10th Vote Promotion with 20 Concurrent Requests
  describe('Emergency Promotion & Race-Condition Atomicity', () => {
    let testComplaintId: string;
    let testSubmitterId: string;
    const concurrentTokens: string[] = [];

    beforeAll(async () => {
      // 1. Create a fresh test student and normal complaint
      const passwordHash = await argon2.hash('password123');
      const submitter = await prisma.user.create({
        data: {
          name: 'Target Submitter',
          email: `submitter.${Date.now()}@hostel.edu`,
          passwordHash,
          role: Role.STUDENT,
          hostelId: hostelBId,
        },
      });
      testSubmitterId = submitter.id;

      const initialDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const testComplaint = await prisma.complaint.create({
        data: {
          title: 'Power fluctuation damaging room appliances',
          description: 'Spike protector tripped repeatedly across the corridor.',
          category: ComplaintCategory.ELECTRICAL,
          priority: ComplaintPriority.NORMAL,
          status: ComplaintStatus.SUBMITTED,
          submitterId: submitter.id,
          hostelId: hostelBId,
          deadlineAt: initialDeadline,
        },
      });
      testComplaintId = testComplaint.id;

      // 2. Pre-seed 9 upvotes from 9 unique students (so next vote is the 10th!)
      const preVoteStudents = await Promise.all(
        Array.from({ length: 9 }).map((_, i) =>
          prisma.user.create({
            data: {
              name: `PreVoter ${i}`,
              email: `prevoter.${i}.${Date.now()}@hostel.edu`,
              passwordHash,
              role: Role.STUDENT,
              hostelId: hostelBId,
            },
          })
        )
      );

      for (const s of preVoteStudents) {
        await prisma.upvote.create({
          data: { complaintId: testComplaintId, userId: s.id },
        });
      }

      // Verify exactly 9 votes pre-seeded
      const count9 = await prisma.upvote.count({ where: { complaintId: testComplaintId } });
      expect(count9).toBe(9);

      // 3. Create 20 concurrent students and generate their tokens
      const voters = await Promise.all(
        Array.from({ length: 20 }).map((_, i) =>
          prisma.user.create({
            data: {
              name: `ConcurrentVoter ${i}`,
              email: `cvoter.${i}.${Date.now()}@hostel.edu`,
              passwordHash,
              role: Role.STUDENT,
              hostelId: hostelBId,
            },
          })
        )
      );

      for (const v of voters) {
        const token = generateAccessToken({
          sub: v.id,
          email: v.email,
          name: v.name,
          role: v.role,
          hostelId: v.hostelId!,
        });
        concurrentTokens.push(token);
      }
    });

    it('promotes complaint to EMERGENCY exactly ONCE under 20 concurrent upvote requests', async () => {
      const promotionStart = Date.now();

      // Fire 20 concurrent upvote requests across 20 distinct students
      const results = await Promise.all(
        concurrentTokens.map((token) =>
          request(app)
            .post(`/api/complaints/${testComplaintId}/upvote`)
            .set('Authorization', `Bearer ${token}`)
        )
      );

      // All 20 distinct voters should succeed (200 OK)
      for (const res of results) {
        expect(res.status).toBe(200);
      }

      // Exactly ONE request must have promoted: true
      const promotedCount = results.filter((r) => r.body.promoted === true).length;
      expect(promotedCount).toBe(1);

      // Verify final complaint priority is EMERGENCY
      const finalComplaint = await prisma.complaint.findUniqueOrThrow({
        where: { id: testComplaintId },
      });
      expect(finalComplaint.priority).toBe('EMERGENCY');

      // Verify fresh 24-hour deadline restarted at promotion timestamp
      const deadlineDiffHours =
        (new Date(finalComplaint.deadlineAt).getTime() - promotionStart) / (1000 * 60 * 60);
      expect(Math.round(deadlineDiffHours)).toBe(24);

      // CRITICAL CHECK: PriorityHistory must contain EXACTLY 1 promotion record!
      const priorityHistories = await prisma.priorityHistory.findMany({
        where: { complaintId: testComplaintId },
      });
      expect(priorityHistories.length).toBe(1);
      expect(priorityHistories[0].toPriority).toBe('EMERGENCY');
      expect(priorityHistories[0].reason).toContain('Auto-promoted after reaching 10 community upvotes');

      // Verify AuditEvent for promotion was written
      const promotionAudit = await prisma.auditEvent.findMany({
        where: { entityId: testComplaintId, action: 'PRIORITY_PROMOTED' },
      });
      expect(promotionAudit.length).toBe(1);

      // Verify notification fan-out: Complainant received promotion notification
      const complainantNotif = await prisma.notification.findFirst({
        where: {
          userId: testSubmitterId,
          complaintId: testComplaintId,
          type: 'COMPLAINT_PROMOTED',
        },
      });
      expect(complainantNotif).toBeDefined();
      expect(complainantNotif!.title).toContain('Promoted to Emergency');

      // Verify assigned wardens also received promotion notification
      const wardenNotif = await prisma.notification.findFirst({
        where: {
          complaintId: testComplaintId,
          type: 'COMPLAINT_PROMOTED',
          user: { role: Role.WARDEN },
        },
      });
      expect(wardenNotif).toBeDefined();

      // Verify submitter's weekly emergency quota was NOT consumed
      const submitterQuota = await prisma.submissionQuota.findFirst({
        where: { userId: testSubmitterId, quotaType: ComplaintPriority.EMERGENCY },
      });
      expect(submitterQuota).toBeNull();
    });
  });

  // 4. Notifications Endpoints & SSE Stream
  describe('Notification Management & Delivery Endpoints', () => {
    let testNotifId: string;

    it('GET /api/notifications returns unread notifications for user', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.unreadCount).toBeGreaterThan(0);
      testNotifId = res.body.notifications[0].id;
    });

    it('POST /api/notifications/:id/read marks notification as read', async () => {
      const res = await request(app)
        .post(`/api/notifications/${testNotifId}/read`)
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notification.isRead).toBe(true);
    });

    it('POST /api/notifications/read-all marks all unread notifications as read', async () => {
      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(0);
    });
  });
});
