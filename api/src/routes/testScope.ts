import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole, assertHostelScope, assertStudentOnly } from '../middleware/auth.js';

const router = Router();

// Test route requiring warden/admin privileges
router.post(
  '/warden-action',
  requireAuth,
  requireRole(Role.WARDEN, Role.ADMIN),
  (req: Request, res: Response) => {
    res.status(200).json({ message: 'Warden action executed successfully' });
  }
);

// Test route for student-only actions (voting, rating)
router.post(
  '/student-vote',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      assertStudentOnly(req.user!);
      res.status(200).json({ message: 'Student vote recorded successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// Test route verifying hostel-scoped access
router.get(
  '/hostels/:hostelId/complaints',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      assertHostelScope(req.user!, req.params.hostelId);
      res.status(200).json({ message: `Access granted for hostel ${req.params.hostelId}` });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
