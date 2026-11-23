import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';

describe('HCMS Authentication & Authorization Engine', () => {
  let hostelBId: string;
  let hostelAId: string;
  let studentToken: string;
  let wardenBToken: string;
  let wardenAToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const hostelB = await prisma.hostel.findUnique({ where: { code: 'BLOCK-B' } });
    const hostelA = await prisma.hostel.findUnique({ where: { code: 'BLOCK-A' } });

    if (!hostelB || !hostelA) {
      throw new Error('Hostels not found. Ensure seed script has run.');
    }

    hostelBId = hostelB.id;
    hostelAId = hostelA.id;
  });

  // 1. Unauthenticated checks
  describe('Unauthenticated Access Control', () => {
    it('rejects unauthenticated requests to /api/auth/me with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('rejects unauthenticated requests to warden endpoints with 401', async () => {
      const res = await request(app).post('/api/test-scope/warden-action');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  // 2. Authentication flows & cross-role rejection
  describe('Role-Separated Login Endpoints', () => {
    it('allows student to login via /api/auth/student/login with email and password', async () => {
      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ identifier: 'aarav@hostel.edu', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', 'aarav@hostel.edu');
      expect(res.body.user.role).toBe('STUDENT');

      // Verify cookies set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasAccessToken = cookies.some((c: string) => c.includes('hmcs_access_token'));
      const hasRefreshToken = cookies.some((c: string) => c.includes('hmcs_refresh_token'));
      const hasCsrfToken = cookies.some((c: string) => c.includes('hmcs_csrf_token'));
      expect(hasAccessToken).toBe(true);
      expect(hasRefreshToken).toBe(true);
      expect(hasCsrfToken).toBe(true);

      // Extract access token for subsequent bearer test calls
      const match = cookies.find((c: string) => c.startsWith('hmcs_access_token='))?.match(/hmcs_access_token=([^;]+)/);
      if (match) studentToken = match[1];
    });

    it('allows student to login using studentId', async () => {
      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ identifier: 'STU-B-302', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.studentId).toBe('STU-B-302');
    });

    it('rejects student attempting to login via /api/auth/warden/login with generic error', async () => {
      const res = await request(app)
        .post('/api/auth/warden/login')
        .send({ identifier: 'aarav@hostel.edu', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid credentials');
    });

    it('rejects warden attempting to login via /api/auth/student/login with generic error', async () => {
      const res = await request(app)
        .post('/api/auth/student/login')
        .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
      expect(res.body.error.message).toContain('Invalid email, student ID, or password');
    });

    it('allows warden to login via /api/auth/warden/login', async () => {
      const res = await request(app)
        .post('/api/auth/warden/login')
        .send({ identifier: 'warden.singh@hostel.edu', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('WARDEN');
      expect(res.body.user.wardenAssignments.length).toBeGreaterThan(0);

      const cookies = res.headers['set-cookie'];
      const match = cookies.find((c: string) => c.startsWith('hmcs_access_token='))?.match(/hmcs_access_token=([^;]+)/);
      if (match) wardenBToken = match[1];
    });

    it('allows warden Verma (Hostel A) to login', async () => {
      const res = await request(app)
        .post('/api/auth/warden/login')
        .send({ identifier: 'warden.verma@hostel.edu', password: 'password123' });

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      const match = cookies.find((c: string) => c.startsWith('hmcs_access_token='))?.match(/hmcs_access_token=([^;]+)/);
      if (match) wardenAToken = match[1];
    });

    it('allows admin to login via warden/staff portal', async () => {
      const res = await request(app)
        .post('/api/auth/warden/login')
        .send({ identifier: 'admin@hostel.edu', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('ADMIN');
      const cookies = res.headers['set-cookie'];
      const match = cookies.find((c: string) => c.startsWith('hmcs_access_token='))?.match(/hmcs_access_token=([^;]+)/);
      if (match) adminToken = match[1];
    });
  });

  // 3. Authorization & Role Isolation
  describe('Strict Role Authorization Boundaries', () => {
    it('prevents a student from executing warden-only actions (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/test-scope/warden-action')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied for role');
    });

    it('prevents a student from accessing administrative endpoints (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('prevents a warden from submitting student-only votes/ratings (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/test-scope/student-vote')
        .set('Authorization', `Bearer ${wardenBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.error.message).toContain('Wardens and administrators are not permitted');
    });

    it('prevents an administrator from submitting student votes (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/test-scope/student-vote')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Wardens and administrators are not permitted');
    });
  });

  // 4. Hostel Scope Isolation
  describe('Hostel Scope Boundary Enforcement', () => {
    it('prevents Warden Verma (Hostel A) from reading Hostel B complaints (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/test-scope/hostels/${hostelBId}/complaints`)
        .set('Authorization', `Bearer ${wardenAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(res.body.error.message).toContain('not assigned to manage complaints in this hostel');
    });

    it('allows Warden Singh (Hostel B) to access Hostel B complaints (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/test-scope/hostels/${hostelBId}/complaints`)
        .set('Authorization', `Bearer ${wardenBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Access granted');
    });

    it('allows Admin to access complaints across all hostels without restriction', async () => {
      const resA = await request(app)
        .get(`/api/test-scope/hostels/${hostelAId}/complaints`)
        .set('Authorization', `Bearer ${adminToken}`);
      const resB = await request(app)
        .get(`/api/test-scope/hostels/${hostelBId}/complaints`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
    });

    it('prevents a student from accessing another hostel scope (403 Forbidden)', async () => {
      // Student Aarav belongs to Hostel B, attempting to access Hostel A
      const res = await request(app)
        .get(`/api/test-scope/hostels/${hostelAId}/complaints`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not authorized to view or access complaints outside your assigned hostel');
    });
  });

  // 5. Admin Functionality & Password Resets
  describe('Administrative Management & Password Reset Flow', () => {
    it('allows an unauthenticated user to submit a forgot password request', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ identifier: 'rohan@hostel.edu', reason: 'Forgot password after break' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('password reset request has been submitted');
    });

    it('allows Admin to list password reset requests', async () => {
      const res = await request(app)
        .get('/api/admin/password-resets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.requests)).toBe(true);
      const rohanRequest = res.body.requests.find((r: { user: { email: string } }) => r.user.email === 'rohan@hostel.edu');
      expect(rohanRequest).toBeDefined();
      expect(rohanRequest.status).toBe('PENDING');
    });

    it('allows Admin to create a new user and assign them to a hostel', async () => {
      const newUserEmail = `test.student.${Date.now()}@hostel.edu`;
      const res = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: newUserEmail,
          password: 'password123',
          name: 'Freshly Enrolled Student',
          role: 'STUDENT',
          hostelId: hostelBId,
          studentId: `STU-TEST-${Date.now()}`,
          roomNumber: 'B-109',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('email', newUserEmail);
      expect(res.body.user.role).toBe('STUDENT');
      expect(res.body.user.hostelId).toBe(hostelBId);
    });
  });
});
