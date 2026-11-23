import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  hostelId: string;
  isActive: boolean;
  studentId?: string | null;
  roomNumber?: string | null;
  wardenAssignments: { hostelId: string; buildingBlock: string | null }[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const ACCESS_COOKIE_NAME = 'hmcs_access_token';
export const REFRESH_COOKIE_NAME = 'hmcs_refresh_token';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Bearer Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Fall back to httpOnly access token cookie
    if (!token && req.cookies) {
      token = req.cookies[ACCESS_COOKIE_NAME];
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required: Missing access token');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token', 'TOKEN_EXPIRED');
    }

    // Fetch user and assignments from DB to ensure state is fresh and active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        wardenAssignments: {
          select: {
            hostelId: true,
            buildingBlock: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User account not found or has been deactivated', 'ACCOUNT_INACTIVE');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hostelId: user.hostelId,
      isActive: user.isActive,
      studentId: user.studentId,
      roomNumber: user.roomNumber,
      wardenAssignments: user.wardenAssignments,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied for role '${req.user.role}'. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
}

/**
 * Returns the list of hostel IDs this user is authorized to read/modify.
 * Returns null for ADMIN (unrestricted access to all hostels).
 */
export function getScopedHostelIds(user: AuthUser): string[] | null {
  if (user.role === Role.ADMIN) {
    return null; // All hostels
  }

  if (user.role === Role.WARDEN) {
    return user.wardenAssignments.map((a) => a.hostelId);
  }

  // STUDENT is strictly scoped to their own hostel
  return [user.hostelId];
}

/**
 * Validates that a user has permission to access a resource in targetHostelId.
 * Throws ForbiddenError if targetHostelId is outside the user's scope.
 */
export function assertHostelScope(user: AuthUser, targetHostelId: string): void {
  if (user.role === Role.ADMIN) {
    return;
  }

  if (user.role === Role.STUDENT) {
    if (user.hostelId !== targetHostelId) {
      throw new ForbiddenError(
        'Access denied: You are not authorized to view or access complaints outside your assigned hostel'
      );
    }
    return;
  }

  if (user.role === Role.WARDEN) {
    const isAssigned = user.wardenAssignments.some((a) => a.hostelId === targetHostelId);
    if (!isAssigned) {
      throw new ForbiddenError(
        'Access denied: You are not assigned to manage complaints in this hostel'
      );
    }
    return;
  }

  throw new ForbiddenError('Unauthorized hostel scope');
}

/**
 * Prevents wardens and admins from student-only actions (such as voting or rating).
 */
export function assertStudentOnly(user: AuthUser): void {
  if (user.role !== Role.STUDENT) {
    throw new ForbiddenError('Wardens and administrators are not permitted to submit student votes or ratings');
  }
}
