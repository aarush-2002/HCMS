import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ComplaintCategory, ComplaintPriority, ComplaintStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import {
  requireAuth,
  requireRole,
  getScopedHostelIds,
  assertHostelScope,
} from '../middleware/auth.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../middleware/errorHandler.js';
import { defaultNotificationService } from '../services/notifications/NotificationService.js';

const router = Router();

// Protect all warden routes: Authenticated WARDEN or ADMIN
router.use(requireAuth);
router.use(requireRole(Role.WARDEN, Role.ADMIN));

// Allowed warden status transitions strictly defined by HCMS policy
const ALLOWED_WARDEN_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.SUBMITTED]: [ComplaintStatus.ACKNOWLEDGED],
  [ComplaintStatus.ACKNOWLEDGED]: [ComplaintStatus.IN_PROGRESS],
  [ComplaintStatus.IN_PROGRESS]: [ComplaintStatus.MARKED_RESOLVED],
  [ComplaintStatus.REOPENED]: [ComplaintStatus.IN_PROGRESS],
  [ComplaintStatus.MARKED_RESOLVED]: [ComplaintStatus.IN_PROGRESS],
  [ComplaintStatus.RESOLVED]: [],
  [ComplaintStatus.CLOSED]: [],
  [ComplaintStatus.REJECTED]: [],
};

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  note: z.string().trim().max(1000).optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
});

// -----------------------------------------------------------------------------
// GET /api/warden/queue — Warden's prioritized complaints queue
// -----------------------------------------------------------------------------
router.get('/queue', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const scopedHostelIds = getScopedHostelIds(user);

    const {
      priority,
      status,
      category,
      overdue,
      from,
      to,
      hostelId,
    } = req.query;

    const where: Record<string, unknown> = {};

    // 1. Enforce hostel scope
    if (scopedHostelIds !== null) {
      if (hostelId && typeof hostelId === 'string') {
        if (!scopedHostelIds.includes(hostelId)) {
          throw new ForbiddenError('Requested hostel is outside your assigned warden scope');
        }
        where.hostelId = hostelId;
      } else {
        where.hostelId = { in: scopedHostelIds };
      }
    } else if (hostelId && typeof hostelId === 'string') {
      where.hostelId = hostelId;
    }

    // 2. Filter by priority
    if (priority && typeof priority === 'string') {
      where.priority = priority.toUpperCase() as ComplaintPriority;
    }

    // 3. Filter by status (single or comma-separated)
    if (status && typeof status === 'string') {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase() as ComplaintStatus);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }

    // 4. Filter by category
    if (category && typeof category === 'string') {
      where.category = category.toUpperCase() as ComplaintCategory;
    }

    // 5. Date range on createdAt
    if (from || to) {
      where.createdAt = {};
      if (from && typeof from === 'string') {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to && typeof to === 'string') {
        (where.createdAt as Record<string, unknown>).lte = new Date(to);
      }
    }

    // Query matching complaints
    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        submitter: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
            roomNumber: true,
          },
        },
        assignedWarden: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        photos: {
          select: {
            id: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        penaltyEvents: {
          select: {
            id: true,
            points: true,
            isVoided: true,
            deadlineAt: true,
          },
        },
        _count: {
          select: {
            upvotes: true,
          },
        },
      },
    });

    const now = new Date();

    // Map fields, calculate remaining time and overdue flag
    let queueItems = complaints.map((c) => {
      const remainingMs = c.deadlineAt.getTime() - now.getTime();
      const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;
      const isResolvedOrInactive = (
        [
          ComplaintStatus.MARKED_RESOLVED,
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ] as ComplaintStatus[]
      ).includes(c.status);

      // Overdue if past deadline and not in marked resolved / resolved / closed / rejected,
      // OR has active deadline penalty
      const isOverdue =
        (!isResolvedOrInactive && remainingMs < 0) ||
        c.penaltyEvents.some((p) => !p.isVoided);

      return {
        id: c.id,
        readableId: c.readableId,
        displayNumber: c.displayNumber,
        title: c.title,
        description: c.description,
        category: c.category,
        priority: c.priority,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deadlineAt: c.deadlineAt,
        markedResolvedAt: c.markedResolvedAt,
        resolvedAt: c.resolvedAt,
        resolutionNote: c.resolutionNote,
        rejectionReason: c.rejectionReason,
        confirmationRound: c.confirmationRound,
        confirmationWindowEndsAt: c.confirmationWindowEndsAt,
        hostelId: c.hostelId,
        hostel: c.hostel,
        assignedWardenId: c.assignedWardenId,
        assignedWarden: c.assignedWarden,
        submitter: c.submitter, // Wardens may see submitter identity
        photos: c.photos,
        upvoteCount: c._count.upvotes,
        remainingMs,
        remainingHours,
        isOverdue,
      };
    });

    // Filter by overdue if specified
    if (overdue === 'true') {
      queueItems = queueItems.filter((i) => i.isOverdue);
    } else if (overdue === 'false') {
      queueItems = queueItems.filter((i) => !i.isOverdue);
    }

    // Default sorting:
    // 1. Overdue complaints first
    // 2. Then Emergency priority
    // 3. Then nearest deadline (deadlineAt ASC)
    queueItems.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) {
        return a.isOverdue ? -1 : 1;
      }
      if (a.priority !== b.priority) {
        return a.priority === ComplaintPriority.EMERGENCY ? -1 : 1;
      }
      return a.deadlineAt.getTime() - b.deadlineAt.getTime();
    });

    res.status(200).json({
      queue: queueItems,
      total: queueItems.length,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/warden/complaints/:id — Full complaint detail for warden
// -----------------------------------------------------------------------------
router.get('/complaints/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        submitter: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
            roomNumber: true,
          },
        },
        assignedWarden: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        hostel: {
          select: {
            id: true,
            name: true,
            code: true,
            timezone: true,
          },
        },
        photos: {
          select: {
            id: true,
            url: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        priorityHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        penaltyEvents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            wardenId: true,
            deadlineAt: true,
            points: true,
            reason: true,
            isVoided: true,
            voidedReason: true,
            voidedAt: true,
            createdAt: true,
          },
        },
        rating: {
          select: {
            stars: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundError(`Complaint '${id}' not found`);
    }

    // Verify warden scope
    assertHostelScope(req.user!, complaint.hostelId);

    // Votes summary
    const upvoteCount = await prisma.upvote.count({ where: { complaintId: id } });
    const confirmationVotes = await prisma.confirmationVote.findMany({
      where: { complaintId: id, round: complaint.confirmationRound },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const solvedVotesCount = confirmationVotes.filter((v) => v.vote === 'SOLVED').length;
    const notSolvedVotesCount = confirmationVotes.filter((v) => v.vote === 'NOT_SOLVED').length;

    // Audit trail
    const auditTrail = await prisma.auditEvent.findMany({
      where: {
        entityType: 'Complaint',
        entityId: id,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    const now = new Date();
    const remainingMs = complaint.deadlineAt.getTime() - now.getTime();
    const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;
    const isOverdue =
      !(
        [
          ComplaintStatus.MARKED_RESOLVED,
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ] as ComplaintStatus[]
      ).includes(complaint.status) && remainingMs < 0;

    res.status(200).json({
      complaint: {
        ...complaint,
        upvoteCount,
        remainingMs,
        remainingHours,
        isOverdue,
      },
      votesSummary: {
        upvotes: upvoteCount,
        confirmation: {
          round: complaint.confirmationRound,
          windowEndsAt: complaint.confirmationWindowEndsAt,
          solvedCount: solvedVotesCount,
          notSolvedCount: notSolvedVotesCount,
          thresholdNeeded: 3,
          votes: confirmationVotes,
        },
      },
      auditTrail,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/warden/complaints/:id/status — Transition complaint status
// -----------------------------------------------------------------------------
router.post('/complaints/:id/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = UpdateStatusSchema.parse(req.body);
    const user = req.user!;

    // Wardens cannot reject complaints; only admins can
    if (input.status === ComplaintStatus.REJECTED) {
      throw new ForbiddenError(
        'Only administrators can mark complaints as Rejected. Wardens are not permitted to reject complaints.',
        'ADMIN_ONLY_ACTION'
      );
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundError(`Complaint '${id}' not found`);
    }

    // Verify hostel scope
    assertHostelScope(user, complaint.hostelId);

    const currentStatus = complaint.status;
    const targetStatus = input.status;

    // Validate transition
    const allowedTargets = ALLOWED_WARDEN_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions from '${currentStatus}': ${
          allowedTargets.length > 0 ? allowedTargets.join(', ') : 'none'
        }`,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Resolution note is REQUIRED when marking resolved
    const finalNote = input.resolutionNote || input.note;
    if (targetStatus === ComplaintStatus.MARKED_RESOLVED) {
      if (!finalNote || finalNote.trim().length < 5) {
        throw new BadRequestError(
          'A resolution note of at least 5 characters is required when marking a complaint as resolved',
          'RESOLUTION_NOTE_REQUIRED'
        );
      }
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: now,
      };

      if (targetStatus === ComplaintStatus.MARKED_RESOLVED) {
        updateData.markedResolvedAt = now; // Ends service deadline
        updateData.resolutionNote = finalNote;
        // Open 24h confirmation window
        updateData.confirmationWindowEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (
        currentStatus === ComplaintStatus.MARKED_RESOLVED &&
        targetStatus === ComplaintStatus.IN_PROGRESS
      ) {
        // Returning from marked resolved to in progress cancels active confirmation window
        updateData.confirmationWindowEndsAt = null;
      }

      const updated = await tx.complaint.update({
        where: { id },
        data: updateData,
      });

      // Record immutable StatusHistory
      await tx.statusHistory.create({
        data: {
          complaintId: id,
          actorId: user.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          reason: finalNote || `Status moved to ${targetStatus}`,
          createdAt: now,
        },
      });

      // Record AuditEvent
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'STATUS_CHANGED',
          entityType: 'Complaint',
          entityId: id,
          before: { status: currentStatus },
          after: {
            status: targetStatus,
            resolutionNote: targetStatus === ComplaintStatus.MARKED_RESOLVED ? finalNote : undefined,
          },
          ipAddress: req.ip,
          timestamp: now,
        },
      });

      return updated;
    });

    // Send notifications based on transition
    if (targetStatus === ComplaintStatus.MARKED_RESOLVED) {
      // Notify complainant
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: id,
        title: 'Complaint Marked Resolved',
        message: `Your complaint ${complaint.readableId || complaint.title} has been marked resolved by the warden. 24h confirmation window is now open.`,
        type: 'CONFIRMATION_WINDOW_OPENED',
      });

      // Notify hostel students to cast confirmation votes
      const hostelStudents = await prisma.user.findMany({
        where: {
          hostelId: complaint.hostelId,
          role: Role.STUDENT,
          isActive: true,
          id: { not: complaint.submitterId },
        },
        select: { id: true },
      });

      for (const student of hostelStudents) {
        await defaultNotificationService.notify({
          userId: student.id,
          complaintId: id,
          title: 'Resolution Confirmation Open',
          message: `Complaint ${complaint.readableId || complaint.title} was marked resolved. Vote Solved or Not Solved within 24h.`,
          type: 'CONFIRMATION_WINDOW_OPENED',
        });
      }
    } else if (targetStatus === ComplaintStatus.ACKNOWLEDGED) {
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: id,
        title: 'Complaint Acknowledged',
        message: `Warden ${user.name} acknowledged your complaint ${complaint.readableId || complaint.title}.`,
        type: 'COMPLAINT_ACKNOWLEDGED',
      });
    } else {
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: id,
        title: `Complaint Status Updated: ${targetStatus}`,
        message: `Your complaint ${complaint.readableId || complaint.title} is now ${targetStatus}.`,
        type: 'COMPLAINT_STATUS_UPDATED',
      });
    }

    res.status(200).json({
      complaint: result,
      message: `Complaint status updated from ${currentStatus} to ${targetStatus}`,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/warden/score — Warden score, rating average, penalties & formula
// -----------------------------------------------------------------------------
router.get('/score', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    let targetWardenId = user.id;

    // Admins can query any warden's score
    if (user.role === Role.ADMIN && req.query.wardenId && typeof req.query.wardenId === 'string') {
      targetWardenId = req.query.wardenId;
    }

    // Verify target user is a warden
    const warden = await prisma.user.findUnique({
      where: { id: targetWardenId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hostelId: true,
        wardenAssignments: {
          select: {
            hostel: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            buildingBlock: true,
          },
        },
      },
    });

    if (!warden || warden.role !== Role.WARDEN) {
      throw new NotFoundError(`Warden with ID '${targetWardenId}' not found`);
    }

    // Fetch visible star ratings received (hidden/flagged ratings excluded from average)
    const ratings = await prisma.rating.findMany({
      where: { wardenId: targetWardenId, isHidden: false },
      include: {
        complaint: {
          select: {
            id: true,
            readableId: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalRatings = ratings.length;
    const averageRating =
      totalRatings > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r.stars, 0) / totalRatings) * 100) / 100
        : null;

    const ratingsBreakdown = {
      1: ratings.filter((r) => r.stars === 1).length,
      2: ratings.filter((r) => r.stars === 2).length,
      3: ratings.filter((r) => r.stars === 3).length,
    };

    // Fetch all penalties
    const allPenalties = await prisma.penaltyEvent.findMany({
      where: { wardenId: targetWardenId },
      include: {
        complaint: {
          select: {
            id: true,
            readableId: true,
            title: true,
            status: true,
            category: true,
            priority: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activePenalties = allPenalties.filter((p) => !p.isVoided);
    const voidedPenalties = allPenalties.filter((p) => p.isVoided);
    const penaltyCount = activePenalties.length;

    // Transparent formula: Score = Average Rating - (0.5 * PenaltyCount)
    // Note: If no ratings yet, base is 0
    const baseScore = averageRating !== null ? averageRating : 0;
    const netScore = Math.round((baseScore - 0.5 * penaltyCount) * 100) / 100;

    const formulaExplanation =
      'Score is calculated as: Average Star Rating (1–3) - (0.5 × Active Penalties). Penalties are stored independently and do not reduce the star rating average directly.';

    res.status(200).json({
      warden: {
        id: warden.id,
        name: warden.name,
        email: warden.email,
        assignments: warden.wardenAssignments,
      },
      averageRating,
      totalRatings,
      ratingsBreakdown,
      penaltyCount,
      netScore,
      penalties: activePenalties.map((p) => ({
        id: p.id,
        points: p.points,
        reason: p.reason,
        deadlineAt: p.deadlineAt,
        createdAt: p.createdAt,
        complaint: p.complaint,
      })),
      voidedPenalties: voidedPenalties.map((p) => ({
        id: p.id,
        points: p.points,
        reason: p.reason,
        voidedReason: p.voidedReason,
        voidedAt: p.voidedAt,
        deadlineAt: p.deadlineAt,
        createdAt: p.createdAt,
        complaint: p.complaint,
      })),
      formulaExplanation,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
