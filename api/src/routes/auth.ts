import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import {
  generateAccessToken,
  generateOpaqueToken,
  hashToken,
} from '../lib/jwt.js';
import {
  requireAuth,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../middleware/auth.js';
import {
  setCsrfCookie,
  CSRF_COOKIE_NAME,
} from '../lib/csrf.js';
import {
  loginRateLimiter,
  checkAccountLockout,
  recordFailedAccountAttempt,
  clearFailedAccountAttempts,
} from '../middleware/rateLimit.js';
import {
  UnauthorizedError,
  BadRequestError,
} from '../middleware/errorHandler.js';

const router = Router();

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Email or Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

const ForgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or Student ID is required'),
  reason: z.string().optional(),
});

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Short-lived access token cookie (15 minutes)
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  // Long-lived rotating refresh token cookie (7 days)
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Issue CSRF cookie
  setCsrfCookie(res);
}

function clearAuthCookies(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(ACCESS_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth',
  });

  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

// -----------------------------------------------------------------------------
// POST /api/auth/student/login
// -----------------------------------------------------------------------------
router.post(
  '/student/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier, password } = LoginSchema.parse(req.body);

      if (checkAccountLockout(identifier)) {
        throw new BadRequestError(
          'Account temporarily locked due to repeated failed login attempts. Please try again after 15 minutes.'
        );
      }

      // Look up user by email OR studentId
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: 'insensitive' } },
            { studentId: { equals: identifier, mode: 'insensitive' } },
          ],
        },
        include: {
          hostel: { select: { id: true, name: true, code: true } },
        },
      });

      // Generic rejection if user does not exist, is inactive, or is not a STUDENT
      if (!user || !user.isActive || user.role !== Role.STUDENT) {
        recordFailedAccountAttempt(identifier);
        throw new UnauthorizedError('Invalid email, student ID, or password');
      }

      const isValidPassword = await argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        recordFailedAccountAttempt(identifier);
        throw new UnauthorizedError('Invalid email, student ID, or password');
      }

      clearFailedAccountAttempts(identifier);

      // Create refresh token record
      const rawRefreshToken = generateOpaqueToken();
      const tokenHash = hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        }),
        prisma.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'STUDENT_LOGIN_SUCCESS',
            entityType: 'User',
            entityId: user.id,
            ipAddress: req.ip,
          },
        }),
      ]);

      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hostelId: user.hostelId,
      });

      setAuthCookies(res, accessToken, rawRefreshToken);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          roomNumber: user.roomNumber,
          hostelId: user.hostelId,
          hostel: user.hostel,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/auth/warden/login
// -----------------------------------------------------------------------------
router.post(
  '/warden/login',
  loginRateLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier, password } = LoginSchema.parse(req.body);

      if (checkAccountLockout(identifier)) {
        throw new BadRequestError(
          'Account temporarily locked due to repeated failed login attempts. Please try again after 15 minutes.'
        );
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: 'insensitive' } },
            { studentId: { equals: identifier, mode: 'insensitive' } },
          ],
        },
        include: {
          hostel: { select: { id: true, name: true, code: true } },
          wardenAssignments: {
            select: {
              id: true,
              hostelId: true,
              buildingBlock: true,
              hostel: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });

      // Reject non-existent, inactive, or STUDENT roles with a generic message
      if (!user || !user.isActive || user.role === Role.STUDENT) {
        recordFailedAccountAttempt(identifier);
        throw new UnauthorizedError('Invalid credentials or unauthorized portal access');
      }

      const isValidPassword = await argon2.verify(user.passwordHash, password);
      if (!isValidPassword) {
        recordFailedAccountAttempt(identifier);
        throw new UnauthorizedError('Invalid credentials or unauthorized portal access');
      }

      clearFailedAccountAttempts(identifier);

      const rawRefreshToken = generateOpaqueToken();
      const tokenHash = hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        }),
        prisma.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'WARDEN_LOGIN_SUCCESS',
            entityType: 'User',
            entityId: user.id,
            ipAddress: req.ip,
          },
        }),
      ]);

      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hostelId: user.hostelId,
      });

      setAuthCookies(res, accessToken, rawRefreshToken);

      res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roomNumber: user.roomNumber,
          hostelId: user.hostelId,
          hostel: user.hostel,
          wardenAssignments: user.wardenAssignments,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/auth/logout
// -----------------------------------------------------------------------------
router.post('/logout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/auth/me
// -----------------------------------------------------------------------------
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
        wardenAssignments: {
          select: {
            id: true,
            hostelId: true,
            buildingBlock: true,
            hostel: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Refresh CSRF cookie
    setCsrfCookie(res);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        studentId: user.studentId,
        roomNumber: user.roomNumber,
        hostelId: user.hostelId,
        hostel: user.hostel,
        wardenAssignments: user.wardenAssignments,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/refresh
// -----------------------------------------------------------------------------
router.post('/refresh', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

    if (!rawRefreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedError('Missing refresh token', 'REFRESH_TOKEN_MISSING');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            hostel: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (
      !existing ||
      existing.revokedAt !== null ||
      existing.expiresAt.getTime() < Date.now() ||
      !existing.user.isActive
    ) {
      clearAuthCookies(res);
      throw new UnauthorizedError(
        'Invalid or expired refresh token. Please sign in again.',
        'REFRESH_TOKEN_INVALID'
      );
    }

    // Rotate refresh token
    const newRawRefreshToken = generateOpaqueToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }),
    ]);

    const newAccessToken = generateAccessToken({
      sub: existing.user.id,
      email: existing.user.email,
      name: existing.user.name,
      role: existing.user.role,
      hostelId: existing.user.hostelId,
    });

    setAuthCookies(res, newAccessToken, newRawRefreshToken);

    res.status(200).json({
      accessToken: newAccessToken,
      user: {
        id: existing.user.id,
        email: existing.user.email,
        name: existing.user.name,
        role: existing.user.role,
        studentId: existing.user.studentId,
        roomNumber: existing.user.roomNumber,
        hostelId: existing.user.hostelId,
        hostel: existing.user.hostel,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/auth/change-password
// -----------------------------------------------------------------------------
router.post(
  '/change-password',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = ChangePasswordSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const isValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isValid) {
        throw new BadRequestError('Current password is incorrect');
      }

      const newPasswordHash = await argon2.hash(newPassword);

      // Invalidate all existing refresh tokens for security
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        }),
        prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        prisma.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'PASSWORD_CHANGED',
            entityType: 'User',
            entityId: user.id,
            ipAddress: req.ip,
          },
        }),
      ]);

      // Issue new tokens for the current session
      const rawRefreshToken = generateOpaqueToken();
      const tokenHash = hashToken(rawRefreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hostelId: user.hostelId,
      });

      setAuthCookies(res, accessToken, rawRefreshToken);

      res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/auth/forgot-password
// -----------------------------------------------------------------------------
router.post(
  '/forgot-password',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { identifier, reason } = ForgotPasswordSchema.parse(req.body);

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: 'insensitive' } },
            { studentId: { equals: identifier, mode: 'insensitive' } },
          ],
        },
      });

      if (user) {
        // Record admin-reviewable reset request
        await prisma.passwordResetRequest.create({
          data: {
            userId: user.id,
            reason: reason || 'User requested password reset via portal',
          },
        });

        await prisma.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            after: { identifier, reason },
            ipAddress: req.ip,
          },
        });
      }

      // Always return a positive message regardless of whether user existed (prevents enumeration)
      res.status(200).json({
        message:
          'If an account matching the provided identifier exists, a password reset request has been submitted for administrator review.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/auth/csrf
// -----------------------------------------------------------------------------
router.get('/csrf', (req: Request, res: Response) => {
  const token = setCsrfCookie(res);
  res.status(200).json({ csrfToken: token });
});

export default router;
