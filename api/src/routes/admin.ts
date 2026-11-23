import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { Role, ResetRequestStatus, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { defaultNotificationService } from '../services/notifications/NotificationService.js';

const router = Router();

// Protect all admin routes with authentication and strict ADMIN role enforcement
router.use(requireAuth);
router.use(requireRole(Role.ADMIN));

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.nativeEnum(Role),
  hostelId: z.string().min(1),
  studentId: z.string().optional(),
  roomNumber: z.string().optional(),
});

const UpdateStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

const UpdateRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

const UpdateHostelSchema = z.object({
  hostelId: z.string().min(1),
});

const WardenAssignmentSchema = z.object({
  hostelId: z.string().min(1),
  buildingBlock: z.string().optional(),
});

const ReviewPasswordResetSchema = z.object({
  status: z.nativeEnum(ResetRequestStatus),
  adminNotes: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

// -----------------------------------------------------------------------------
// POST /api/admin/users — Create a new user
// -----------------------------------------------------------------------------
router.post('/users', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = CreateUserSchema.parse(req.body);

    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingEmail) {
      throw new ConflictError(`User with email '${data.email}' already exists`);
    }

    if (data.studentId) {
      const existingStudentId = await prisma.user.findUnique({
        where: { studentId: data.studentId },
      });
      if (existingStudentId) {
        throw new ConflictError(`User with student ID '${data.studentId}' already exists`);
      }
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: data.hostelId },
    });
    if (!hostel) {
      throw new NotFoundError(`Hostel with ID '${data.hostelId}' not found`);
    }

    const passwordHash = await argon2.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        hostelId: data.hostelId,
        studentId: data.studentId,
        roomNumber: data.roomNumber,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        studentId: true,
        roomNumber: true,
        hostelId: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        after: user,
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/admin/users — List users
// -----------------------------------------------------------------------------
router.get('/users', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role, hostelId, isActive } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as Role } : {}),
        ...(hostelId ? { hostelId: String(hostelId) } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        studentId: true,
        roomNumber: true,
        isActive: true,
        lastLoginAt: true,
        hostelId: true,
        hostel: { select: { id: true, name: true, code: true } },
        wardenAssignments: {
          select: {
            id: true,
            hostelId: true,
            buildingBlock: true,
            hostel: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// PATCH /api/admin/users/:id/status — Activate or Deactivate user
// -----------------------------------------------------------------------------
router.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive, reason } = UpdateStatusSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If deactivating user, revoke all active refresh tokens immediately
      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const u = await tx.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: id,
          before: { isActive: user.isActive },
          after: { isActive, reason },
          ipAddress: req.ip,
        },
      });

      return u;
    });

    res.status(200).json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role — Set user role
// -----------------------------------------------------------------------------
router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = UpdateRoleSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'USER_ROLE_UPDATED',
        entityType: 'User',
        entityId: id,
        before: { role: user.role },
        after: { role },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// PATCH /api/admin/users/:id/hostel — Assign student/user to hostel
// -----------------------------------------------------------------------------
router.patch('/users/:id/hostel', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { hostelId } = UpdateHostelSchema.parse(req.body);

    const [user, hostel] = await Promise.all([
      prisma.user.findUnique({ where: { id } }),
      prisma.hostel.findUnique({ where: { id: hostelId } }),
    ]);

    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }
    if (!hostel) {
      throw new NotFoundError(`Hostel with ID '${hostelId}' not found`);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { hostelId },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'USER_HOSTEL_REASSIGNED',
        entityType: 'User',
        entityId: id,
        before: { hostelId: user.hostelId },
        after: { hostelId },
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        hostelId: updated.hostelId,
        hostel: updated.hostel,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/admin/wardens/:id/assignments — Assign warden to hostel/building
// -----------------------------------------------------------------------------
router.post(
  '/wardens/:id/assignments',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { hostelId, buildingBlock } = WardenAssignmentSchema.parse(req.body);

      const warden = await prisma.user.findUnique({ where: { id } });
      if (!warden) {
        throw new NotFoundError(`Warden with ID '${id}' not found`);
      }
      if (warden.role !== Role.WARDEN && warden.role !== Role.ADMIN) {
        throw new BadRequestError(`User '${warden.name}' is not registered with role WARDEN`);
      }

      const hostel = await prisma.hostel.findUnique({ where: { id: hostelId } });
      if (!hostel) {
        throw new NotFoundError(`Hostel with ID '${hostelId}' not found`);
      }

      const assignment = await prisma.wardenAssignment.create({
        data: {
          wardenId: id,
          hostelId,
          buildingBlock: buildingBlock || null,
        },
        include: {
          hostel: { select: { id: true, name: true, code: true } },
        },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'WARDEN_ASSIGNMENT_CREATED',
          entityType: 'WardenAssignment',
          entityId: assignment.id,
          after: assignment,
          ipAddress: req.ip,
        },
      });

      res.status(201).json({ assignment });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// DELETE /api/admin/wardens/:id/assignments/:assignmentId — Remove warden assignment
// -----------------------------------------------------------------------------
router.delete(
  '/wardens/:id/assignments/:assignmentId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, assignmentId } = req.params;

      const assignment = await prisma.wardenAssignment.findFirst({
        where: { id: assignmentId, wardenId: id },
      });
      if (!assignment) {
        throw new NotFoundError(`Assignment '${assignmentId}' for warden '${id}' not found`);
      }

      await prisma.wardenAssignment.delete({
        where: { id: assignmentId },
      });

      await prisma.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'WARDEN_ASSIGNMENT_REMOVED',
          entityType: 'WardenAssignment',
          entityId: assignmentId,
          before: assignment,
          ipAddress: req.ip,
        },
      });

      res.status(200).json({ message: 'Warden assignment removed successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/admin/password-resets — List password reset requests
// -----------------------------------------------------------------------------
router.get(
  '/password-resets',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requests = await prisma.passwordResetRequest.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              studentId: true,
              name: true,
              role: true,
              hostel: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ requests });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// PATCH /api/admin/password-resets/:id — Review password reset request
// -----------------------------------------------------------------------------
router.patch(
  '/password-resets/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, adminNotes, newPassword } = ReviewPasswordResetSchema.parse(req.body);

      const request = await prisma.passwordResetRequest.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!request) {
        throw new NotFoundError(`Password reset request '${id}' not found`);
      }

      await prisma.$transaction(async (tx) => {
        // If a new temporary password is provided by the admin, hash and update
        if (newPassword) {
          const passwordHash = await argon2.hash(newPassword);
          await tx.user.update({
            where: { id: request.userId },
            data: { passwordHash },
          });

          // Invalidate existing sessions for security
          await tx.refreshToken.updateMany({
            where: { userId: request.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await tx.passwordResetRequest.update({
          where: { id },
          data: {
            status,
            adminNotes: adminNotes || null,
            reviewedByAdminId: req.user!.id,
            reviewedAt: new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: req.user!.id,
            action: 'PASSWORD_RESET_REVIEWED',
            entityType: 'PasswordResetRequest',
            entityId: id,
            before: { status: request.status },
            after: { status, adminNotes, passwordResetApplied: !!newPassword },
            ipAddress: req.ip,
          },
        });
      });

      res.status(200).json({
        message: `Password reset request updated to ${status}${newPassword ? ' and new password applied' : ''}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/admin/complaints/:id/reject — Reject complaint (Admin only)
// -----------------------------------------------------------------------------
const RejectComplaintSchema = z.object({
  reason: z.string().trim().min(5, 'Rejection reason must be at least 5 characters long'),
});

router.post(
  '/complaints/:id/reject',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = RejectComplaintSchema.parse(req.body);

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      if (complaint.status === ComplaintStatus.REJECTED) {
        throw new BadRequestError('Complaint is already rejected', 'ALREADY_REJECTED');
      }

      if (complaint.status === ComplaintStatus.CLOSED) {
        throw new BadRequestError('Cannot reject an already closed complaint', 'COMPLAINT_CLOSED');
      }

      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.complaint.update({
          where: { id },
          data: {
            status: ComplaintStatus.REJECTED,
            rejectionReason: reason,
            updatedAt: now,
          },
        });

        await tx.statusHistory.create({
          data: {
            complaintId: id,
            actorId: req.user!.id,
            fromStatus: complaint.status,
            toStatus: ComplaintStatus.REJECTED,
            reason,
            createdAt: now,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: req.user!.id,
            action: 'COMPLAINT_REJECTED',
            entityType: 'Complaint',
            entityId: id,
            before: { status: complaint.status },
            after: { status: ComplaintStatus.REJECTED, reason },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        return result;
      });

      // Notify complainant
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: id,
        title: 'Complaint Rejected by Admin',
        message: `Your complaint ${complaint.readableId || complaint.title} was rejected. Reason: ${reason}`,
        type: 'COMPLAINT_REJECTED',
      });

      // Notify assigned warden if any
      if (complaint.assignedWardenId) {
        await defaultNotificationService.notify({
          userId: complaint.assignedWardenId,
          complaintId: id,
          title: 'Complaint Rejected by Admin',
          message: `Complaint ${complaint.readableId || complaint.title} was rejected by Admin ${req.user!.name}.`,
          type: 'COMPLAINT_REJECTED',
        });
      }

      res.status(200).json({
        complaint: updated,
        message: 'Complaint successfully rejected by admin',
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/admin/complaints/:id/reassign — Reassign complaint to another warden
// -----------------------------------------------------------------------------
const ReassignComplaintSchema = z.object({
  wardenId: z.string().min(1, 'Target warden ID is required'),
  reason: z.string().trim().optional(),
});

router.post(
  '/complaints/:id/reassign',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { wardenId, reason } = ReassignComplaintSchema.parse(req.body);

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      const targetWarden = await prisma.user.findUnique({
        where: { id: wardenId },
      });

      if (!targetWarden || targetWarden.role !== Role.WARDEN) {
        throw new BadRequestError(`Target user '${wardenId}' is not an active warden`, 'INVALID_WARDEN');
      }

      const previousWardenId = complaint.assignedWardenId;
      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.complaint.update({
          where: { id },
          data: {
            assignedWardenId: wardenId,
            updatedAt: now,
          },
        });

        // "The deadline and any penalty stay with the warden responsible at the moment the deadline passes;
        // record the reassignment in the audit trail."
        await tx.auditEvent.create({
          data: {
            actorId: req.user!.id,
            action: 'WARDEN_REASSIGNED',
            entityType: 'Complaint',
            entityId: id,
            before: { assignedWardenId: previousWardenId },
            after: { assignedWardenId: wardenId, reason: reason || 'Administrative reassignment' },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        return result;
      });

      // Notify new warden
      await defaultNotificationService.notify({
        userId: wardenId,
        complaintId: id,
        title: 'New Complaint Reassigned to You',
        message: `Admin ${req.user!.name} assigned complaint ${complaint.readableId || complaint.title} to you.`,
        type: 'COMPLAINT_STATUS_UPDATED',
      });

      // Notify previous warden if existed
      if (previousWardenId && previousWardenId !== wardenId) {
        await defaultNotificationService.notify({
          userId: previousWardenId,
          complaintId: id,
          title: 'Complaint Reassigned Away',
          message: `Complaint ${complaint.readableId || complaint.title} was reassigned to ${targetWarden.name}.`,
          type: 'COMPLAINT_STATUS_UPDATED',
        });
      }

      res.status(200).json({
        complaint: updated,
        message: `Complaint successfully reassigned to warden ${targetWarden.name}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/admin/penalties/:id/waive — Waive a penalty with justification
// -----------------------------------------------------------------------------
const WaivePenaltySchema = z.object({
  reason: z.string().trim().min(5, 'Waive justification must be at least 5 characters long'),
});

router.post(
  '/penalties/:id/waive',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = WaivePenaltySchema.parse(req.body);

      const penalty = await prisma.penaltyEvent.findUnique({
        where: { id },
        include: {
          complaint: true,
          warden: true,
        },
      });

      if (!penalty) {
        throw new NotFoundError(`Penalty event '${id}' not found`);
      }

      if (penalty.isVoided) {
        throw new BadRequestError('This penalty has already been waived', 'ALREADY_WAIVED');
      }

      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.penaltyEvent.update({
          where: { id },
          data: {
            isVoided: true,
            voidedReason: reason,
            voidedByAdminId: req.user!.id,
            voidedAt: now,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: req.user!.id,
            action: 'PENALTY_VOIDED',
            entityType: 'PenaltyEvent',
            entityId: id,
            before: { isVoided: false, points: penalty.points },
            after: { isVoided: true, voidedReason: reason, voidedByAdminId: req.user!.id },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        return result;
      });

      // Notify the affected warden
      await defaultNotificationService.notify({
        userId: penalty.wardenId,
        complaintId: penalty.complaintId,
        title: 'Deadline Penalty Waived',
        message: `Admin ${req.user!.name} waived your -1 penalty for complaint ${penalty.complaint.readableId || penalty.complaint.title}. Reason: ${reason}`,
        type: 'PENALTY_WAIVED',
      });

      res.status(200).json({
        penalty: updated,
        message: 'Penalty successfully waived',
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/admin/users/:id — Get user details
// -----------------------------------------------------------------------------
router.get('/users/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        hostel: { select: { id: true, name: true, code: true, timezone: true } },
        wardenAssignments: {
          include: { hostel: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// PATCH /api/admin/users/:id — Update user profile
// -----------------------------------------------------------------------------
const AdminUpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  studentId: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  role: z.nativeEnum(Role).optional(),
  hostelId: z.string().optional(),
});

router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = AdminUpdateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`User with ID '${id}' not found`);
    }

    if (data.email && data.email !== existing.email) {
      const emailConflict = await prisma.user.findUnique({ where: { email: data.email } });
      if (emailConflict) {
        throw new ConflictError(`Email '${data.email}' is already in use`);
      }
    }

    if (data.studentId && data.studentId !== existing.studentId) {
      const studentIdConflict = await prisma.user.findUnique({ where: { studentId: data.studentId } });
      if (studentIdConflict) {
        throw new ConflictError(`Student ID '${data.studentId}' is already in use`);
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        hostel: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: id,
        before: { name: existing.name, email: existing.email, role: existing.role },
        after: data,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ user: updated, message: 'User updated successfully' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Hostels CRUD
// -----------------------------------------------------------------------------
const CreateHostelSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).toUpperCase(),
  timezone: z.string().default('Asia/Kolkata'),
});

router.get('/hostels', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const hostels = await prisma.hostel.findMany({
      include: {
        policy: true,
        wardenAssignments: {
          include: {
            warden: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            users: true,
            complaints: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ hostels });
  } catch (err) {
    next(err);
  }
});

router.post('/hostels', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = CreateHostelSchema.parse(req.body);

    const existing = await prisma.hostel.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new ConflictError(`Hostel with code '${data.code}' already exists`);
    }

    const hostel = await prisma.$transaction(async (tx) => {
      const created = await tx.hostel.create({
        data: {
          name: data.name,
          code: data.code,
          timezone: data.timezone,
        },
      });

      // Create default policy for new hostel
      await tx.policy.create({
        data: {
          hostelId: created.id,
          normalDeadlineHours: 72,
          emergencyDeadlineHours: 24,
          upvotesToEscalate: 10,
          confirmationsNeeded: 3,
          confirmationWindowHours: 24,
          normalDailyLimit: 1,
          emergencyWeeklyLimit: 1,
          timezone: data.timezone,
          updatedByAdminId: req.user!.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'HOSTEL_CREATED',
          entityType: 'Hostel',
          entityId: created.id,
          after: created,
          ipAddress: req.ip,
        },
      });

      return created;
    });

    res.status(201).json({ hostel, message: 'Hostel created successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/hostels/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const hostel = await prisma.hostel.findUnique({
      where: { id },
      include: {
        policy: true,
        wardenAssignments: {
          include: { warden: { select: { id: true, name: true, email: true } } },
        },
        _count: {
          select: { users: true, complaints: true },
        },
      },
    });

    if (!hostel) {
      throw new NotFoundError(`Hostel with ID '${id}' not found`);
    }

    res.status(200).json({ hostel });
  } catch (err) {
    next(err);
  }
});

router.patch('/hostels/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const data = CreateHostelSchema.partial().parse(req.body);

    const existing = await prisma.hostel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Hostel with ID '${id}' not found`);
    }

    const updated = await prisma.hostel.update({
      where: { id },
      data,
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'HOSTEL_UPDATED',
        entityType: 'Hostel',
        entityId: id,
        before: existing,
        after: updated,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ hostel: updated, message: 'Hostel updated successfully' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Direct Warden Assignment Endpoints
// -----------------------------------------------------------------------------
const DirectWardenAssignmentSchema = z.object({
  wardenId: z.string().min(1),
  hostelId: z.string().min(1),
  buildingBlock: z.string().optional(),
});

router.post('/wardens/assign', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { wardenId, hostelId, buildingBlock } = DirectWardenAssignmentSchema.parse(req.body);

    const warden = await prisma.user.findUnique({ where: { id: wardenId } });
    if (!warden || warden.role !== Role.WARDEN) {
      throw new BadRequestError('User is not a registered warden');
    }

    const hostel = await prisma.hostel.findUnique({ where: { id: hostelId } });
    if (!hostel) {
      throw new NotFoundError(`Hostel with ID '${hostelId}' not found`);
    }

    const assignment = await prisma.wardenAssignment.create({
      data: {
        wardenId,
        hostelId,
        buildingBlock: buildingBlock || null,
      },
      include: {
        hostel: { select: { id: true, name: true, code: true } },
        warden: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'WARDEN_ASSIGNMENT_CREATED',
        entityType: 'WardenAssignment',
        entityId: assignment.id,
        after: assignment,
        ipAddress: req.ip,
      },
    });

    res.status(201).json({ assignment, message: 'Warden assigned successfully' });
  } catch (err) {
    next(err);
  }
});

router.delete('/wardens/assign/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const assignment = await prisma.wardenAssignment.findUnique({ where: { id } });
    if (!assignment) {
      throw new NotFoundError(`Assignment with ID '${id}' not found`);
    }

    await prisma.wardenAssignment.delete({ where: { id } });

    await prisma.auditEvent.create({
      data: {
        actorId: req.user!.id,
        action: 'WARDEN_ASSIGNMENT_REMOVED',
        entityType: 'WardenAssignment',
        entityId: id,
        before: assignment,
        ipAddress: req.ip,
      },
    });

    res.status(200).json({ message: 'Warden assignment removed successfully' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// Policy Read & Update (Applies to new events only)
// -----------------------------------------------------------------------------
const UpdatePolicySchema = z.object({
  hostelId: z.string().optional().nullable(),
  normalDeadlineHours: z.number().int().min(1).max(168).optional(),
  emergencyDeadlineHours: z.number().int().min(1).max(72).optional(),
  upvotesToEscalate: z.number().int().min(1).max(50).optional(),
  confirmationsNeeded: z.number().int().min(1).max(10).optional(),
  confirmationWindowHours: z.number().int().min(1).max(72).optional(),
  normalDailyLimit: z.number().int().min(1).max(10).optional(),
  emergencyWeeklyLimit: z.number().int().min(1).max(10).optional(),
  timezone: z.string().optional(),
});

router.get('/policy', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hostelId } = req.query;

    let policy = null;
    if (hostelId && typeof hostelId === 'string') {
      policy = await prisma.policy.findUnique({ where: { hostelId } });
    }

    if (!policy) {
      policy = await prisma.policy.findFirst({
        where: { hostelId: null },
      });
    }

    if (!policy) {
      // Return canonical defaults if table has no record
      policy = {
        id: 'default',
        hostelId: null,
        normalDeadlineHours: 72,
        emergencyDeadlineHours: 24,
        upvotesToEscalate: 10,
        confirmationsNeeded: 3,
        confirmationWindowHours: 24,
        normalDailyLimit: 1,
        emergencyWeeklyLimit: 1,
        timezone: 'Asia/Kolkata',
      };
    }

    res.status(200).json({ policy });
  } catch (err) {
    next(err);
  }
});

router.patch('/policy', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = UpdatePolicySchema.parse(req.body);
    const targetHostelId = input.hostelId || null;

    const existing = await prisma.policy.findFirst({
      where: { hostelId: targetHostelId },
    });

    const now = new Date();

    const policy = await prisma.$transaction(async (tx) => {
      let updated;
      if (existing) {
        updated = await tx.policy.update({
          where: { id: existing.id },
          data: {
            ...input,
            updatedByAdminId: req.user!.id,
            updatedAt: now,
          },
        });
      } else {
        updated = await tx.policy.create({
          data: {
            hostelId: targetHostelId,
            normalDeadlineHours: input.normalDeadlineHours ?? 72,
            emergencyDeadlineHours: input.emergencyDeadlineHours ?? 24,
            upvotesToEscalate: input.upvotesToEscalate ?? 10,
            confirmationsNeeded: input.confirmationsNeeded ?? 3,
            confirmationWindowHours: input.confirmationWindowHours ?? 24,
            normalDailyLimit: input.normalDailyLimit ?? 1,
            emergencyWeeklyLimit: input.emergencyWeeklyLimit ?? 1,
            timezone: input.timezone ?? 'Asia/Kolkata',
            updatedByAdminId: req.user!.id,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'POLICY_UPDATED',
          entityType: 'Policy',
          entityId: updated.id,
          before: existing ? JSON.parse(JSON.stringify(existing)) : undefined,
          after: JSON.parse(JSON.stringify(updated)),
          ipAddress: req.ip,
          timestamp: now,
        },
      });

      return updated;
    });

    res.status(200).json({ policy, message: 'Policy updated successfully (applies to new submissions)' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/admin/complaints — Full complaints search and filter
// -----------------------------------------------------------------------------
router.get('/complaints', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      hostelId,
      status,
      priority,
      category,
      search,
      overdue,
      from,
      to,
      assignedWardenId,
      submitterId,
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (hostelId && typeof hostelId === 'string') where.hostelId = hostelId;
    if (assignedWardenId && typeof assignedWardenId === 'string') where.assignedWardenId = assignedWardenId;
    if (submitterId && typeof submitterId === 'string') where.submitterId = submitterId;

    if (status && typeof status === 'string') {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase() as ComplaintStatus);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    if (priority && typeof priority === 'string') {
      where.priority = priority.toUpperCase() as ComplaintPriority;
    }

    if (category && typeof category === 'string') {
      where.category = category.toUpperCase() as ComplaintCategory;
    }

    if (from || to) {
      where.createdAt = {};
      if (from && typeof from === 'string') (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to && typeof to === 'string') (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { readableId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rawComplaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          submitter: {
            select: { id: true, name: true, email: true, studentId: true, roomNumber: true },
          },
          assignedWarden: {
            select: { id: true, name: true, email: true },
          },
          hostel: {
            select: { id: true, name: true, code: true },
          },
          photos: {
            select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true },
          },
          penaltyEvents: {
            select: { id: true, points: true, isVoided: true },
          },
          _count: {
            select: { upvotes: true, confirmationVotes: true },
          },
        },
      }),
    ]);

    const now = new Date();
    let complaints = rawComplaints.map((c) => {
      const remainingMs = c.deadlineAt.getTime() - now.getTime();
      const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;
      const isResolved = (
        [ComplaintStatus.MARKED_RESOLVED, ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] as ComplaintStatus[]
      ).includes(c.status);
      const isOverdue = (!isResolved && remainingMs < 0) || c.penaltyEvents.some((p) => !p.isVoided);

      return {
        ...c,
        upvoteCount: c._count.upvotes,
        confirmationVoteCount: c._count.confirmationVotes,
        remainingMs,
        remainingHours,
        isOverdue,
      };
    });

    if (overdue === 'true') {
      complaints = complaints.filter((c) => c.isOverdue);
    } else if (overdue === 'false') {
      complaints = complaints.filter((c) => !c.isOverdue);
    }

    res.status(200).json({
      complaints,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/admin/complaints/:id/reclassify — Reclassify Category or Priority
// -----------------------------------------------------------------------------
const ReclassifySchema = z.object({
  category: z.nativeEnum(ComplaintCategory).optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  reason: z.string().trim().min(5, 'Reclassification reason must be at least 5 characters long'),
});

router.post(
  '/complaints/:id/reclassify',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const input = ReclassifySchema.parse(req.body);

      const complaint = await prisma.complaint.findUnique({ where: { id } });
      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      const now = new Date();
      const prevPriority = complaint.priority;
      const prevCategory = complaint.category;

      const updated = await prisma.$transaction(async (tx) => {
        const updateData: Record<string, unknown> = { updatedAt: now };

        if (input.category) {
          updateData.category = input.category;
        }

        if (input.priority && input.priority !== prevPriority) {
          updateData.priority = input.priority;

          // If upgraded to emergency, restart deadline to now + 24h
          let newDeadline = complaint.deadlineAt;
          if (input.priority === ComplaintPriority.EMERGENCY) {
            newDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            updateData.deadlineAt = newDeadline;
          }

          await tx.priorityHistory.create({
            data: {
              complaintId: id,
              actorId: req.user!.id,
              fromPriority: prevPriority,
              toPriority: input.priority,
              reason: `Admin reclassification: ${input.reason}`,
              previousDeadlineAt: complaint.deadlineAt,
              newDeadlineAt: newDeadline,
              createdAt: now,
            },
          });
        }

        const result = await tx.complaint.update({
          where: { id },
          data: updateData,
        });

        await tx.auditEvent.create({
          data: {
            actorId: req.user!.id,
            action: 'COMPLAINT_RECLASSIFIED',
            entityType: 'Complaint',
            entityId: id,
            before: { category: prevCategory, priority: prevPriority },
            after: { category: input.category || prevCategory, priority: input.priority || prevPriority, reason: input.reason },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        return result;
      });

      // Notify complainant
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: id,
        title: 'Complaint Reclassified by Admin',
        message: `Your complaint ${complaint.readableId || complaint.title} was reclassified. Reason: ${input.reason}`,
        type: 'COMPLAINT_STATUS_UPDATED',
      });

      // Notify assigned warden
      if (complaint.assignedWardenId) {
        await defaultNotificationService.notify({
          userId: complaint.assignedWardenId,
          complaintId: id,
          title: 'Complaint Reclassified',
          message: `Complaint ${complaint.readableId || complaint.title} was reclassified by Admin ${req.user!.name}.`,
          type: 'COMPLAINT_STATUS_UPDATED',
        });
      }

      res.status(200).json({
        complaint: updated,
        message: 'Complaint successfully reclassified',
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// Flagged Ratings Review & Abuse Control
// -----------------------------------------------------------------------------
router.get('/ratings', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isHidden, wardenId } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (isHidden === 'true') where.isHidden = true;
    if (isHidden === 'false') where.isHidden = false;
    if (wardenId && typeof wardenId === 'string') where.wardenId = wardenId;

    const [total, ratings] = await Promise.all([
      prisma.rating.count({ where }),
      prisma.rating.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          complainant: { select: { id: true, name: true, email: true, roomNumber: true } },
          warden: { select: { id: true, name: true, email: true } },
          complaint: { select: { id: true, readableId: true, title: true, status: true } },
        },
      }),
    ]);

    res.status(200).json({
      ratings,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

const HideRatingSchema = z.object({
  reason: z.string().trim().min(5, 'Reason for hiding rating must be at least 5 characters long'),
});

router.post('/ratings/:id/hide', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = HideRatingSchema.parse(req.body);

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      throw new NotFoundError(`Rating with ID '${id}' not found`);
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.rating.update({
        where: { id },
        data: {
          isHidden: true,
          hiddenReason: reason,
          hiddenByAdminId: req.user!.id,
          hiddenAt: now,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'RATING_HIDDEN',
          entityType: 'Rating',
          entityId: id,
          before: { isHidden: rating.isHidden },
          after: { isHidden: true, hiddenReason: reason },
          ipAddress: req.ip,
          timestamp: now,
        },
      });

      return r;
    });

    res.status(200).json({ rating: updated, message: 'Rating successfully hidden from warden scoring' });
  } catch (err) {
    next(err);
  }
});

router.post('/ratings/:id/unhide', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const rating = await prisma.rating.findUnique({ where: { id } });
    if (!rating) {
      throw new NotFoundError(`Rating with ID '${id}' not found`);
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.rating.update({
        where: { id },
        data: {
          isHidden: false,
          hiddenReason: null,
          hiddenByAdminId: null,
          hiddenAt: null,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: req.user!.id,
          action: 'RATING_UNHIDDEN',
          entityType: 'Rating',
          entityId: id,
          before: { isHidden: rating.isHidden, hiddenReason: rating.hiddenReason },
          after: { isHidden: false },
          ipAddress: req.ip,
          timestamp: now,
        },
      });

      return r;
    });

    res.status(200).json({ rating: updated, message: 'Rating restored' });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/admin/audit — Comprehensive Audit Trail Inspection
// -----------------------------------------------------------------------------
router.get('/audit', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { actorId, action, entityType, entityId, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (actorId && typeof actorId === 'string') where.actorId = actorId;
    if (action && typeof action === 'string') where.action = action;
    if (entityType && typeof entityType === 'string') where.entityType = entityType;
    if (entityId && typeof entityId === 'string') where.entityId = entityId;

    if (from || to) {
      where.timestamp = {};
      if (from && typeof from === 'string') (where.timestamp as Record<string, unknown>).gte = new Date(from);
      if (to && typeof to === 'string') (where.timestamp as Record<string, unknown>).lte = new Date(to);
    }

    const [total, events] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    res.status(200).json({
      events,
      auditLogs: events,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/admin/reports — PRD Success Measures & Executive Analytics
// -----------------------------------------------------------------------------
router.get('/reports', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hostelId, from, to } = req.query;

    const where: Record<string, unknown> = {};
    if (hostelId && typeof hostelId === 'string') where.hostelId = hostelId;
    if (from || to) {
      where.createdAt = {};
      if (from && typeof from === 'string') (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to && typeof to === 'string') (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        confirmationVotes: true,
      },
    });

    const totalComplaints = complaints.length;

    // 1. % acknowledged (complaints that moved to Acknowledged, In Progress, Marked Resolved, Resolved, or Closed)
    const acknowledgedCount = complaints.filter((c) =>
      (
        [
          ComplaintStatus.ACKNOWLEDGED,
          ComplaintStatus.IN_PROGRESS,
          ComplaintStatus.MARKED_RESOLVED,
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
        ] as ComplaintStatus[]
      ).includes(c.status)
    ).length;
    const acknowledgedPct =
      totalComplaints > 0 ? Math.round((acknowledgedCount / totalComplaints) * 10000) / 100 : 0;

    // 2. Resolved complaints subset
    const resolvedComplaints = complaints.filter((c) =>
      ([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] as ComplaintStatus[]).includes(c.status)
    );

    // 3. Normal resolved within 72h SLA
    const normalResolved = resolvedComplaints.filter((c) => c.priority === ComplaintPriority.NORMAL);
    const normalResolvedWithinSla = normalResolved.filter((c) => {
      const end = c.resolvedAt || c.markedResolvedAt || c.updatedAt;
      const durationHours = (end.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
      return durationHours <= 72;
    }).length;
    const normalWithin72hPct =
      normalResolved.length > 0
        ? Math.round((normalResolvedWithinSla / normalResolved.length) * 10000) / 100
        : 0;

    // 4. Emergency resolved within 24h SLA
    const emergencyResolved = resolvedComplaints.filter((c) => c.priority === ComplaintPriority.EMERGENCY);
    const emergencyResolvedWithinSla = emergencyResolved.filter((c) => {
      const end = c.resolvedAt || c.markedResolvedAt || c.updatedAt;
      const durationHours = (end.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
      return durationHours <= 24;
    }).length;
    const emergencyWithin24hPct =
      emergencyResolved.length > 0
        ? Math.round((emergencyResolvedWithinSla / emergencyResolved.length) * 10000) / 100
        : 0;

    // 5. Median time to resolution (hours)
    const durations = resolvedComplaints.map((c) => {
      const end = c.resolvedAt || c.markedResolvedAt || c.updatedAt;
      return (end.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
    });
    durations.sort((a, b) => a - b);
    let medianTimeToResolutionHours = 0;
    if (durations.length > 0) {
      const mid = Math.floor(durations.length / 2);
      medianTimeToResolutionHours =
        durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
      medianTimeToResolutionHours = Math.round(medianTimeToResolutionHours * 10) / 10;
    }

    // 6. % with student confirmation (3+ confirmation votes cast)
    const confirmedByStudents = resolvedComplaints.filter(
      (c) => c.confirmationVotes.length >= 3
    ).length;
    const studentConfirmationPct =
      resolvedComplaints.length > 0
        ? Math.round((confirmedByStudents / resolvedComplaints.length) * 10000) / 100
        : 0;

    // 7. Average satisfaction from non-hidden ratings
    const ratings = await prisma.rating.findMany({
      where: { isHidden: false },
      select: { stars: true },
    });
    const avgSatisfaction =
      ratings.length > 0
        ? Math.round((ratings.reduce((acc, r) => acc + r.stars, 0) / ratings.length) * 100) / 100
        : null;

    // 8. Count of duplicates or miscategorised complaints
    const rejectedDuplicatesCount = complaints.filter(
      (c) =>
        c.status === ComplaintStatus.REJECTED &&
        c.rejectionReason &&
        (c.rejectionReason.toLowerCase().includes('duplicate') ||
          c.rejectionReason.toLowerCase().includes('invalid') ||
          c.rejectionReason.toLowerCase().includes('spam'))
    ).length;

    const reclassifiedAuditCount = await prisma.auditEvent.count({
      where: { action: 'COMPLAINT_RECLASSIFIED' },
    });

    const duplicatesAndMiscategorisedCount = rejectedDuplicatesCount + reclassifiedAuditCount;

    // By category
    const categories = ['PLUMBING', 'ELECTRICAL', 'CLEANLINESS', 'FURNITURE', 'INTERNET', 'OTHER'];
    const byCategory = categories.map((cat) => {
      const catComplaints = complaints.filter((c) => c.category === cat);
      const catResolved = catComplaints.filter((c) =>
        ([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] as ComplaintStatus[]).includes(c.status)
      ).length;
      return {
        category: cat,
        count: catComplaints.length,
        resolved: catResolved,
      };
    });

    // By hostel
    const hostels = await prisma.hostel.findMany({ select: { id: true, name: true } });
    const nowMs = Date.now();
    const byHostel = hostels.map((h) => {
      const hComplaints = complaints.filter((c) => c.hostelId === h.id);
      const hResolved = hComplaints.filter((c) =>
        ([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] as ComplaintStatus[]).includes(c.status)
      ).length;
      const hOverdue = hComplaints.filter((c) => {
        const isClosed = (
          [
            ComplaintStatus.RESOLVED,
            ComplaintStatus.CLOSED,
            ComplaintStatus.MARKED_RESOLVED,
            ComplaintStatus.REJECTED,
          ] as ComplaintStatus[]
        ).includes(c.status);
        return !isClosed && c.deadlineAt.getTime() < nowMs;
      }).length;
      return {
        hostelName: h.name,
        total: hComplaints.length,
        resolved: hResolved,
        overdue: hOverdue,
      };
    });

    const slaCompliancePercentage =
      totalComplaints > 0
        ? Math.round(
            ((normalResolvedWithinSla + emergencyResolvedWithinSla) /
              Math.max(1, resolvedComplaints.length)) *
              100
          )
        : 100;

    const reopenedCount = complaints.filter((c) => c.status === ComplaintStatus.REOPENED).length;
    const reopenedRatePercentage =
      totalComplaints > 0 ? Math.round((reopenedCount / totalComplaints) * 100) : 0;

    const escalatedCount = await prisma.priorityHistory.count();
    const totalPenalties = await prisma.penaltyEvent.count({ where: { isVoided: false } });

    res.status(200).json({
      totalComplaints,
      resolvedComplaints: resolvedComplaints.length,
      slaCompliancePercentage,
      medianResolutionHours: medianTimeToResolutionHours,
      reopenedRatePercentage,
      escalatedToEmergencyCount: escalatedCount,
      averageStudentRating: avgSatisfaction ?? 3.0,
      totalPenaltiesApplied: totalPenalties,
      byCategory,
      byHostel,
      metrics: {
        totalComplaints,
        acknowledgedPercentage: acknowledgedPct,
        normalResolvedWithin72hPercentage: normalWithin72hPct,
        emergencyResolvedWithin24hPercentage: emergencyWithin24hPct,
        medianTimeToResolutionHours,
        studentConfirmationPercentage: studentConfirmationPct,
        averageSatisfactionRating: avgSatisfaction,
        totalRatingsCount: ratings.length,
        countOfDuplicatesOrMiscategorised: duplicatesAndMiscategorisedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
