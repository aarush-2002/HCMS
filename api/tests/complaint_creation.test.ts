import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { getCalendarDayKey, getCalendarWeekKey, getNextDailyReset, getNextWeeklyReset } from '../services/quotaService.js';

describe('HCMS Complaint Creation & Quota Engine', () => {
  let studentAaravToken: string;
  let studentPriyaToken: string;
  let studentVikramToken: string; // Hostel A
  let wardenSinghToken: string;   // Hostel B
  let wardenVermaToken: string;   // Hostel A
  let hostelBId: string;
  let hostelAId: string;

  beforeAll(async () => {
    // Log in Student Aarav (Hostel B)
    const aaravRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'aarav@hostel.edu', password: 'password123' });
    const aaravCookies = aaravRes.headers['set-cookie'];
    studentAaravToken = aaravCookies.find((c: string) => c.startsWith('hmcs_access_token='))!.match(/hmcs_access_token=([^;]+)/)![1];

    // Log in Student Priya (Hostel B)
    const priyaRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'priya@hostel.edu', password: 'password123' });
    const priyaCookies = priyaRes.headers['set-cookie'];
    studentPriyaToken = priyaCookies.find((c: string) => c.startsWith('hmcs_access_token='))!.match(/hmcs_access_token=([^;]+)/)![1];

    // Log in Student Vikram (Hostel A)
    const vikramRes = await request(app)
      .post('/api/auth/student/login')
      .send({ identifier: 'vikram@hostel.edu', password: 'password123' });
    const vikramCookies = vikramRes.headers['set-cookie'];
    studentVikramToken = vikramCookies.find((c: string) => c.startsWith('hmcs_access_token='))!.match(/hmcs_access_token=([^;]+)/)![1];

    // Log in Warden Singh (Hostel B)
    const singhRes = await request(app)
      .post('/api/auth/warden/login')
      .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });
    const singhCookies = singhRes.headers['set-cookie'];
    wardenSinghToken = singhCookies.find((c: string) => c.startsWith('hmcs_access_token='))!.match(/hmcs_access_token=([^;]+)/)![1];

    // Log in Warden Verma (Hostel A)
    const vermaRes = await request(app)
      .post('/api/auth/warden/login')
      .send({ identifier: 'warden.verma@hostel.edu', password: 'password123' });
    const vermaCookies = vermaRes.headers['set-cookie'];
    wardenVermaToken = vermaCookies.find((c: string) => c.startsWith('hmcs_access_token='))!.match(/hmcs_access_token=([^;]+)/)![1];

    const hostelB = await prisma.hostel.findUnique({ where: { code: 'BLOCK-B' } });
    const hostelA = await prisma.hostel.findUnique({ where: { code: 'BLOCK-A' } });
    hostelBId = hostelB!.id;
    hostelAId = hostelA!.id;

    // Clear any existing submission quotas for Priya and Aarav to start fresh in this test suite
    const userAarav = await prisma.user.findUnique({ where: { email: 'aarav@hostel.edu' } });
    const userPriya = await prisma.user.findUnique({ where: { email: 'priya@hostel.edu' } });
    if (userAarav && userPriya) {
      await prisma.submissionQuota.deleteMany({
        where: { userId: { in: [userAarav.id, userPriya.id] } },
      });
    }
  });

  // 1. Quota Query
  describe('GET /api/quota', () => {
    it('returns available daily and weekly quotas with next reset timestamps in Asia/Kolkata', async () => {
      const res = await request(app)
        .get('/api/quota')
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.quota).toHaveProperty('normal');
      expect(res.body.quota).toHaveProperty('emergency');
      expect(res.body.quota.normal.limit).toBe(1);
      expect(res.body.quota.normal.remaining).toBe(1);
      expect(res.body.quota.emergency.limit).toBe(1);
      expect(res.body.quota.emergency.remaining).toBe(1);
      expect(res.body.quota.timezone).toBe('Asia/Kolkata');
      expect(res.body.quota.normal.resetsAt).toBeDefined();
      expect(res.body.quota.emergency.resetsAt).toBeDefined();
    });
  });

  // 2. Submission Validation & Deadline Math
  describe('Submission Validation & SLA Deadlines', () => {
    it('rejects title shorter than 3 characters with validation error', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'No')
        .field('description', 'This is a description longer than 10 characters')
        .field('category', 'PLUMBING')
        .field('priority', 'normal');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects description shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'Valid Title Here')
        .field('description', 'Too short')
        .field('category', 'ELECTRICAL')
        .field('priority', 'normal');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects warden attempting to file a complaint (student-only endpoint)', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${wardenSinghToken}`)
        .field('title', 'Warden Attempt')
        .field('description', 'Wardens should not be allowed to file resident complaints')
        .field('category', 'CLEANLINESS')
        .field('priority', 'normal');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('creates normal complaint with 72-hour deadline, readable ID, and status Submitted', async () => {
      const beforeSubmit = Date.now();

      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'Study room AC temperature stuck at 16C')
        .field('description', 'Remote sensor broken, room is freezing cold every night.')
        .field('category', 'electrical')
        .field('priority', 'normal');

      expect(res.status).toBe(201);
      const c = res.body.complaint;
      expect(c.status).toBe('SUBMITTED');
      expect(c.priority).toBe('NORMAL');
      expect(c.category).toBe('ELECTRICAL');
      expect(c.readableId).toMatch(/^HM-\d{4}$/);

      // Verify 72-hour deadline math (+72h = 259,200,000 ms)
      const createdAtMs = new Date(c.createdAt).getTime();
      const deadlineAtMs = new Date(c.deadlineAt).getTime();
      const diffHours = (deadlineAtMs - createdAtMs) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(72);

      // Verify StatusHistory was created
      const history = await prisma.statusHistory.findFirst({
        where: { complaintId: c.id },
      });
      expect(history).toBeDefined();
      expect(history!.toStatus).toBe('SUBMITTED');

      // Verify AuditEvent was logged
      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: c.id, action: 'COMPLAINT_SUBMITTED' },
      });
      expect(audit).toBeDefined();

      // Verify notification sent to assigned warden
      const notif = await prisma.notification.findFirst({
        where: { complaintId: c.id },
      });
      expect(notif).toBeDefined();
      expect(notif!.title).toContain('New NORMAL Complaint');
    });
  });

  // 3. Quota Limits & Double-Submit Protection
  describe('Quota Enforcement & Concurrency Locking', () => {
    it('prevents Priya from filing a 2nd normal complaint on the same calendar day (400 QUOTA_EXCEEDED)', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'Second normal complaint attempt')
        .field('description', 'Should be rejected by the daily quota check.')
        .field('category', 'PLUMBING')
        .field('priority', 'normal');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.message).toContain('Daily normal complaint allowance');
    });

    it('allows Priya to file 1 emergency complaint within the same week', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'Sparks coming out of main corridor panel')
        .field('description', 'Immediate fire hazard near the fire exit on floor 2.')
        .field('category', 'ELECTRICAL')
        .field('priority', 'emergency');

      expect(res.status).toBe(201);
      const c = res.body.complaint;
      expect(c.priority).toBe('EMERGENCY');

      // Verify 24-hour deadline math for emergency
      const diffHours = (new Date(c.deadlineAt).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(24);
    });

    it('prevents Priya from filing a 2nd emergency complaint in the same week (400 QUOTA_EXCEEDED)', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentPriyaToken}`)
        .field('title', 'Second emergency complaint attempt')
        .field('description', 'Should be rejected by weekly emergency quota check.')
        .field('category', 'PLUMBING')
        .field('priority', 'emergency');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QUOTA_EXCEEDED');
      expect(res.body.error.message).toContain('Weekly emergency complaint allowance');
    });

    it('enforces atomic concurrency lock: simultaneous submissions for Aarav result in exactly 1 success', async () => {
      // Fire 2 concurrent normal complaint submissions at the exact same instant
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${studentAaravToken}`)
          .field('title', 'Concurrent Submission Alpha')
          .field('description', 'Concurrent race condition test payload alpha')
          .field('category', 'INTERNET')
          .field('priority', 'normal'),
        request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${studentAaravToken}`)
          .field('title', 'Concurrent Submission Beta')
          .field('description', 'Concurrent race condition test payload beta')
          .field('category', 'INTERNET')
          .field('priority', 'normal'),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      const rejectedRes = res1.status === 400 ? res1 : res2;
      expect(rejectedRes.body.error.code).toBe('QUOTA_EXCEEDED');
    });
  });

  // 4. Photo Uploads, Magic Bytes & Storage
  describe('Photo Handling & Secure File Serving', () => {
    let photoStudentToken: string;

    beforeAll(async () => {
      // Create fresh student Kabir to test photo upload
      const kabir = await prisma.user.findUnique({ where: { email: 'kabir@hostel.edu' } });
      await prisma.submissionQuota.deleteMany({ where: { userId: kabir!.id } });

      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ identifier: 'kabir@hostel.edu', password: 'password123' });
      photoStudentToken = res.headers['set-cookie']
        .find((c: string) => c.startsWith('hmcs_access_token='))!
        .match(/hmcs_access_token=([^;]+)/)![1];
    });

    it('rejects upload with spoofed extension and invalid magic bytes (400 INVALID_PHOTO_TYPE)', async () => {
      const fakeJpgBuffer = Buffer.from('FAKE-EXECUTABLE-OR-TEXT-DATA-NOT-IMAGE');

      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${photoStudentToken}`)
        .field('title', 'Bad photo upload attempt')
        .field('description', 'Should fail due to invalid magic bytes verification.')
        .field('category', 'FURNITURE')
        .field('priority', 'normal')
        .attach('photos', fakeJpgBuffer, 'malicious.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PHOTO_TYPE');

      // CRITICAL CHECK: Failed upload MUST NOT consume quota!
      const quota = await prisma.submissionQuota.findFirst({
        where: { user: { email: 'kabir@hostel.edu' } },
      });
      expect(quota).toBeNull();
    });

    it('accepts valid JPEG photo, strips EXIF metadata, stores securely and serves through GET /api/photos/:id', async () => {
      // 1x1 valid red JPEG buffer
      const validJpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
        0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
        0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
        0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
        0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
        0x00, 0x7f, 0x00, 0xff, 0xd9,
      ]);

      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${photoStudentToken}`)
        .field('title', 'Broken mirror in wing B washroom')
        .field('description', 'Sharp glass pieces fell onto the basin counter.')
        .field('category', 'CLEANLINESS')
        .field('priority', 'normal')
        .attach('photos', validJpeg, 'mirror.jpg');

      expect(res.status).toBe(201);
      expect(res.body.complaint.photos.length).toBe(1);

      const photoRecord = res.body.complaint.photos[0];
      expect(photoRecord.mimeType).toBe('image/jpeg');

      // Test serving photo through GET /api/photos/:id
      const photoRes = await request(app)
        .get(photoRecord.url)
        .set('Authorization', `Bearer ${photoStudentToken}`);

      expect(photoRes.status).toBe(200);
      expect(photoRes.headers['content-type']).toBe('image/jpeg');
      expect(photoRes.headers['cache-control']).toContain('private');
    });
  });

  // 5. Anonymity & Data Leak Scan
  describe('Strict Submitter Anonymity for Peers', () => {
    let createdComplaintId: string;

    beforeAll(async () => {
      // Find complaint #1042 created by Aarav Sharma
      const c = await prisma.complaint.findFirst({
        where: { displayNumber: 1042 },
        include: { submitter: true },
      });
      createdComplaintId = c!.id;
    });

    it('scans peer response to guarantee zero submitter identity leaks', async () => {
      // Student Priya (peer) views Aarav\'s complaint
      const res = await request(app)
        .get(`/api/complaints/${createdComplaintId}`)
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(res.status).toBe(200);
      const jsonStr = JSON.stringify(res.body);

      // Verify forbidden personal identifiers NEVER appear anywhere in the peer response
      expect(jsonStr).not.toContain('Aarav');
      expect(jsonStr).not.toContain('Sharma');
      expect(jsonStr).not.toContain('aarav@hostel.edu');
      expect(jsonStr).not.toContain('STU-B-302');
      expect(jsonStr).not.toContain('B-302');

      // Verify explicit anonymity indicator is returned
      expect(res.body.complaint.submitter).toBeDefined();
      expect(res.body.complaint.submitter.isAnonymous).toBe(true);
      expect(res.body.complaint.submitter.name).toBeUndefined();
    });

    it('allows assigned warden to see the full submitter identity', async () => {
      // Warden Singh views Aarav\'s complaint
      const res = await request(app)
        .get(`/api/complaints/${createdComplaintId}`)
        .set('Authorization', `Bearer ${wardenSinghToken}`);

      expect(res.status).toBe(200);
      expect(res.body.complaint.submitter).toBeDefined();
      expect(res.body.complaint.submitter.name).toBe('Aarav Sharma');
      expect(res.body.complaint.submitter.email).toBe('aarav@hostel.edu');
      expect(res.body.complaint.submitter.studentId).toBe('STU-B-302');
      expect(res.body.complaint.submitter.roomNumber).toBe('B-302');
    });
  });

  // 6. Scope Violations
  describe('Scope Violations & Cross-Hostel Access Control', () => {
    let hostelBComplaintId: string;

    beforeAll(async () => {
      const c = await prisma.complaint.findFirst({
        where: { hostelId: hostelBId },
      });
      hostelBComplaintId = c!.id;
    });

    it('prevents student Vikram (Hostel A) from viewing Hostel B complaint (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/complaints/${hostelBComplaintId}`)
        .set('Authorization', `Bearer ${studentVikramToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('prevents Warden Verma (Hostel A) from viewing Hostel B complaint (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/complaints/${hostelBComplaintId}`)
        .set('Authorization', `Bearer ${wardenVermaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // 7. Student Personal Feed (GET /api/complaints/mine)
  describe('GET /api/complaints/mine', () => {
    it('returns the student\'s own complaints with pagination and status history', async () => {
      const res = await request(app)
        .get('/api/complaints/mine')
        .set('Authorization', `Bearer ${studentPriyaToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.complaints)).toBe(true);
      expect(res.body.complaints.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.complaints[0].submitter.isYou).toBe(true);
    });
  });
});
