import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
  ConfirmationVoteType,
  Role,
} from '@prisma/client';
import prisma from '../lib/prisma.js';
import {
  requireAuth,
  requireRole,
  assertHostelScope,
  assertStudentOnly,
  getScopedHostelIds,
} from '../middleware/auth.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../middleware/errorHandler.js';
import { defaultNotificationService } from '../services/notifications/NotificationService.js';

const router = Router();

// -----------------------------------------------------------------------------
// POST /api/complaints/:id/confirm — Student Resolution Confirmation Voting
// -----------------------------------------------------------------------------
const ConfirmVoteSchema = z.object({
  vote: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.nativeEnum(ConfirmationVoteType, {
      errorMap: () => ({ message: 'Vote must be solved or not_solved' }),
    })
  ),
  comment: z.string().trim().max(300).optional(),
});

router.post(
  '/complaints/:id/confirm',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      assertStudentOnly(user);

      const { id } = req.params;
      const input = ConfirmVoteSchema.parse(req.body);

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      // 1. Same hostel only
      assertHostelScope(user, complaint.hostelId);

      // 2. Only while status is Marked resolved
      if (complaint.status !== ComplaintStatus.MARKED_RESOLVED) {
        throw new BadRequestError(
          'Confirmation voting is only open while complaint is in Marked Resolved status',
          'CONFIRMATION_CLOSED'
        );
      }

      // 3. Only while the 24h window is open
      const now = new Date();
      if (!complaint.confirmationWindowEndsAt || complaint.confirmationWindowEndsAt <= now) {
        throw new BadRequestError(
          'The 24-hour resolution confirmation window has expired',
          'CONFIRMATION_WINDOW_EXPIRED'
        );
      }

      // 4. Record vote & evaluate thresholds in ONE database transaction
      const evaluation = await prisma.$transaction(async (tx) => {
        // Row lock the complaint
        await tx.$queryRaw`SELECT id FROM "Complaint" WHERE id = ${id} FOR UPDATE`;

        // Re-read complaint under lock
        const freshComplaint = await tx.complaint.findUniqueOrThrow({
          where: { id },
        });

        if (freshComplaint.status !== ComplaintStatus.MARKED_RESOLVED) {
          throw new BadRequestError('Complaint status changed during vote', 'STATUS_MUTATED');
        }

        const currentRound = freshComplaint.confirmationRound;

        // Upsert vote for this user and round (changeable until window closes)
        await tx.confirmationVote.upsert({
          where: {
            complaintId_userId_round: {
              complaintId: id,
              userId: user.id,
              round: currentRound,
            },
          },
          update: {
            vote: input.vote,
            comment: input.comment || null,
            createdAt: now,
          },
          create: {
            complaintId: id,
            userId: user.id,
            round: currentRound,
            vote: input.vote,
            comment: input.comment || null,
            createdAt: now,
          },
        });

        // Count all votes in this round
        const roundVotes = await tx.confirmationVote.findMany({
          where: {
            complaintId: id,
            round: currentRound,
          },
        });

        const solvedCount = roundVotes.filter((v) => v.vote === ConfirmationVoteType.SOLVED).length;
        const notSolvedCount = roundVotes.filter(
          (v) => v.vote === ConfirmationVoteType.NOT_SOLVED
        ).length;

        let newStatus: ComplaintStatus = ComplaintStatus.MARKED_RESOLVED;
        let actionTaken: 'RESOLVED' | 'REOPENED' | 'WAITING' = 'WAITING';

        if (solvedCount >= 3) {
          // 3 Solved -> Transition to RESOLVED
          newStatus = ComplaintStatus.RESOLVED;
          actionTaken = 'RESOLVED';

          await tx.complaint.update({
            where: { id },
            data: {
              status: ComplaintStatus.RESOLVED,
              resolvedAt: now,
              confirmationWindowEndsAt: null,
              updatedAt: now,
            },
          });

          await tx.statusHistory.create({
            data: {
              complaintId: id,
              actorId: user.id,
              fromStatus: ComplaintStatus.MARKED_RESOLVED,
              toStatus: ComplaintStatus.RESOLVED,
              reason: `Resolution confirmed by hostel community (${solvedCount} Solved votes)`,
              createdAt: now,
            },
          });

          await tx.auditEvent.create({
            data: {
              actorId: user.id,
              action: 'COMPLAINT_RESOLVED',
              entityType: 'Complaint',
              entityId: id,
              before: { status: ComplaintStatus.MARKED_RESOLVED },
              after: {
                status: ComplaintStatus.RESOLVED,
                solvedVotes: solvedCount,
                resolvedAt: now,
              },
              ipAddress: req.ip,
              timestamp: now,
            },
          });
        } else if (notSolvedCount >= 3) {
          // 3 Not Solved -> Transition to REOPENED with new round number
          newStatus = ComplaintStatus.REOPENED;
          actionTaken = 'REOPENED';
          const nextRound = currentRound + 1;

          await tx.complaint.update({
            where: { id },
            data: {
              status: ComplaintStatus.REOPENED,
              confirmationRound: nextRound,
              confirmationWindowEndsAt: null,
              updatedAt: now,
            },
          });

          await tx.statusHistory.create({
            data: {
              complaintId: id,
              actorId: user.id,
              fromStatus: ComplaintStatus.MARKED_RESOLVED,
              toStatus: ComplaintStatus.REOPENED,
              reason: `Complaint reopened by hostel community (${notSolvedCount} Not Solved votes)`,
              createdAt: now,
            },
          });

          await tx.auditEvent.create({
            data: {
              actorId: user.id,
              action: 'COMPLAINT_REOPENED',
              entityType: 'Complaint',
              entityId: id,
              before: { status: ComplaintStatus.MARKED_RESOLVED, round: currentRound },
              after: {
                status: ComplaintStatus.REOPENED,
                notSolvedVotes: notSolvedCount,
                nextRound,
              },
              ipAddress: req.ip,
              timestamp: now,
            },
          });
        }

        return {
          complaint: freshComplaint,
          newStatus,
          actionTaken,
          solvedCount,
          notSolvedCount,
          round: currentRound,
        };
      });

      // 5. Notifications fan-out
      if (evaluation.actionTaken === 'RESOLVED') {
        // Notify complainant that rating is available
        await defaultNotificationService.notify({
          userId: evaluation.complaint.submitterId,
          complaintId: id,
          title: 'Issue Resolved — Rating Available',
          message: `Your complaint ${evaluation.complaint.readableId || evaluation.complaint.title} has been confirmed resolved by students. Please rate your warden's service.`,
          type: 'RATING_AVAILABLE',
        });

        // Notify assigned warden
        if (evaluation.complaint.assignedWardenId) {
          await defaultNotificationService.notify({
            userId: evaluation.complaint.assignedWardenId,
            complaintId: id,
            title: 'Complaint Confirmed Resolved',
            message: `Complaint ${evaluation.complaint.readableId || evaluation.complaint.title} was verified resolved by 3 students.`,
            type: 'COMPLAINT_RESOLVED',
          });
        }
      } else if (evaluation.actionTaken === 'REOPENED') {
        // Notify assigned warden that complaint is reopened
        if (evaluation.complaint.assignedWardenId) {
          await defaultNotificationService.notify({
            userId: evaluation.complaint.assignedWardenId,
            complaintId: id,
            title: 'Complaint Reopened by Students',
            message: `Complaint ${evaluation.complaint.readableId || evaluation.complaint.title} received 3 Not Solved votes and was reopened.`,
            type: 'COMPLAINT_REOPENED',
          });
        }

        // Notify complainant
        await defaultNotificationService.notify({
          userId: evaluation.complaint.submitterId,
          complaintId: id,
          title: 'Complaint Reopened',
          message: `Students confirmed ${evaluation.complaint.readableId || evaluation.complaint.title} is not solved. Reopened for warden action.`,
          type: 'COMPLAINT_REOPENED',
        });
      }

      const remainingMs = Math.max(
        0,
        (complaint.confirmationWindowEndsAt?.getTime() || now.getTime()) - now.getTime()
      );
      const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;

      res.status(200).json({
        message: 'Confirmation vote recorded',
        status: evaluation.newStatus,
        actionTaken: evaluation.actionTaken,
        solvedCount: evaluation.solvedCount,
        notSolvedCount: evaluation.notSolvedCount,
        thresholdNeeded: 3,
        round: evaluation.round,
        timeRemainingMs: remainingMs,
        timeRemainingHours: remainingHours,
        myVote: input.vote,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/complaints/:id/rating — Original Complainant Rates Warden
// -----------------------------------------------------------------------------
const CreateRatingSchema = z.object({
  stars: z
    .number()
    .int()
    .min(1, 'Stars rating must be between 1 and 3')
    .max(3, 'Stars rating must be between 1 and 3'),
  comment: z.string().trim().max(200, 'Comment must not exceed 200 characters').optional(),
});

router.post(
  '/complaints/:id/rating',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      assertStudentOnly(user);

      const { id } = req.params;
      const input = CreateRatingSchema.parse(req.body);

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      // Rule: Only the original complainant
      if (complaint.submitterId !== user.id) {
        throw new ForbiddenError(
          'Only the original complainant who submitted this issue is permitted to rate the warden',
          'RATING_NOT_AUTHORIZED'
        );
      }

      // Rule: Only when the complaint is Resolved
      if (complaint.status !== ComplaintStatus.RESOLVED) {
        throw new BadRequestError(
          `Ratings can only be submitted for Resolved complaints (current status: ${complaint.status})`,
          'COMPLAINT_NOT_RESOLVED'
        );
      }

      // Rule: Only once per complaint
      const existingRating = await prisma.rating.findUnique({
        where: { complaintId: id },
      });
      if (existingRating) {
        throw new ConflictError('A rating has already been submitted for this complaint');
      }

      // Link to the responsible warden
      let wardenId = complaint.assignedWardenId;
      if (!wardenId) {
        const assignment = await prisma.wardenAssignment.findFirst({
          where: { hostelId: complaint.hostelId },
        });
        wardenId = assignment?.wardenId || null;
      }

      if (!wardenId) {
        throw new BadRequestError(
          'Unable to identify the responsible warden for this hostel block',
          'WARDEN_NOT_FOUND'
        );
      }

      const now = new Date();

      const rating = await prisma.$transaction(async (tx) => {
        const created = await tx.rating.create({
          data: {
            complaintId: id,
            complainantId: user.id,
            wardenId,
            stars: input.stars,
            comment: input.comment || null,
            createdAt: now,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'WARDEN_RATED',
            entityType: 'Rating',
            entityId: created.id,
            after: {
              complaintId: id,
              wardenId,
              stars: input.stars,
              comment: input.comment,
            },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        return created;
      });

      // Notify responsible warden
      await defaultNotificationService.notify({
        userId: wardenId,
        complaintId: id,
        title: 'New Student Rating Received',
        message: `Complainant rated your service ${input.stars} star(s) for complaint ${complaint.readableId || complaint.title}.`,
        type: 'RATING_AVAILABLE',
      });

      res.status(201).json({
        rating,
        message: 'Rating successfully submitted',
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/history — Historical complaints for Students and Wardens
// -----------------------------------------------------------------------------
router.get('/history', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const { status, priority, category, search, from, to } = req.query;

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // 1. Role-based scoping:
    if (user.role === Role.STUDENT) {
      // Students see their own complaints (active and historical)
      where.submitterId = user.id;
    } else if (user.role === Role.WARDEN) {
      // Wardens see resolved and closed complaints in their assigned scope
      const scopedHostels = getScopedHostelIds(user);
      if (scopedHostels !== null) {
        where.hostelId = { in: scopedHostels };
      }
      // Default to resolved and closed for history view if no specific status given
      if (!status) {
        where.status = {
          in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
        };
      }
    } else if (user.role === Role.ADMIN) {
      // Admins can see all hostels or filter by hostelId
      if (req.query.hostelId && typeof req.query.hostelId === 'string') {
        where.hostelId = req.query.hostelId;
      }
    }

    // 2. Query filters
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
      if (from && typeof from === 'string') {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to && typeof to === 'string') {
        (where.createdAt as Record<string, unknown>).lte = new Date(to);
      }
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { readableId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          hostel: {
            select: { id: true, name: true, code: true },
          },
          assignedWarden: {
            select: { id: true, name: true, email: true },
          },
          photos: {
            select: {
              id: true,
              url: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
          rating: {
            select: {
              stars: true,
              comment: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              upvotes: true,
              confirmationVotes: true,
            },
          },
        },
      }),
    ]);

    const formatted = complaints.map((c) => ({
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
      hostel: c.hostel,
      assignedWarden: c.assignedWarden,
      photos: c.photos,
      rating: c.rating,
      upvoteCount: c._count.upvotes,
      confirmationVoteCount: c._count.confirmationVotes,
    }));

    res.status(200).json({
      history: formatted,
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

export default router;
