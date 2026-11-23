import { Router, Request, Response, NextFunction } from 'express';
import { ComplaintCategory, ComplaintPriority, ComplaintStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, assertHostelScope } from '../middleware/auth.js';
import { notificationService } from '../services/notifications/NotificationService.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../middleware/errorHandler.js';

const router = Router();

// Active statuses for the community feed (excluding RESOLVED, CLOSED, REJECTED)
export const ACTIVE_COMPLAINT_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.ACKNOWLEDGED,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.MARKED_RESOLVED,
  ComplaintStatus.REOPENED,
];

// -----------------------------------------------------------------------------
// GET /api/feed — Community complaint feed for the student's hostel
// -----------------------------------------------------------------------------
router.get(
  '/feed',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { status, priority, category, search, sort = 'newest', cursor, limit = '10' } = req.query;

      const takeLimit = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));

      // Construct filter query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        hostelId: user.hostelId,
        status: { in: ACTIVE_COMPLAINT_STATUSES },
      };

      // Optional status filter (must be within active statuses)
      if (status) {
        const normalizedStatus = (status as string).toUpperCase() as ComplaintStatus;
        if (ACTIVE_COMPLAINT_STATUSES.includes(normalizedStatus)) {
          where.status = normalizedStatus;
        } else {
          // If filtering for an inactive status in the active feed, return empty
          where.status = normalizedStatus;
        }
      }

      // Optional priority filter
      if (priority) {
        where.priority = (priority as string).toUpperCase() as ComplaintPriority;
      }

      // Optional category filter
      if (category) {
        where.category = (category as string).toUpperCase() as ComplaintCategory;
      }

      // Optional search text (case-insensitive in title or description)
      if (search && typeof search === 'string' && search.trim().length > 0) {
        where.OR = [
          { title: { contains: search.trim(), mode: 'insensitive' } },
          { description: { contains: search.trim(), mode: 'insensitive' } },
        ];
      }

      // Sorting
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderBy: any;
      switch (sort) {
        case 'most_upvoted':
          orderBy = [{ upvotes: { _count: 'desc' } }, { createdAt: 'desc' }];
          break;
        case 'nearest_deadline':
          orderBy = [{ deadlineAt: 'asc' }, { createdAt: 'desc' }];
          break;
        case 'newest':
        default:
          orderBy = { createdAt: 'desc' };
          break;
      }

      // Cursor-based pagination
      const queryOptions: {
        where: typeof where;
        orderBy: typeof orderBy;
        take: number;
        skip?: number;
        cursor?: { id: string };
      } = {
        where,
        orderBy,
        take: takeLimit + 1, // fetch 1 extra item to check if next page exists
      };

      if (cursor && typeof cursor === 'string') {
        queryOptions.cursor = { id: cursor };
        queryOptions.skip = 1; // skip cursor item itself
      }

      const complaints = await prisma.complaint.findMany({
        ...queryOptions,
        include: {
          hostel: { select: { id: true, name: true, code: true } },
          photos: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
            },
          },
          upvotes: {
            select: { userId: true },
          },
          _count: {
            select: { upvotes: true },
          },
        },
      });

      let nextCursor: string | null = null;
      if (complaints.length > takeLimit) {
        const nextItem = complaints.pop();
        nextCursor = nextItem ? nextItem.id : null;
      }

      const now = Date.now();

      // Format response strictly stripping all submitter identification
      const feedItems = complaints.map((c) => {
        const isOwn = c.submitterId === user.id;
        const hasUpvoted = c.upvotes.some((u) => u.userId === user.id);
        const upvoteCount = c._count.upvotes;

        // Confirmation window metrics if complaint is marked resolved
        let confirmationWindow = null;
        if (c.status === ComplaintStatus.MARKED_RESOLVED && c.confirmationWindowEndsAt) {
          const windowEndsMs = c.confirmationWindowEndsAt.getTime();
          const remainingMs = Math.max(0, windowEndsMs - now);
          confirmationWindow = {
            round: c.confirmationRound,
            endsAt: c.confirmationWindowEndsAt.toISOString(),
            isExpired: remainingMs <= 0,
            remainingHours: Number((remainingMs / (1000 * 60 * 60)).toFixed(1)),
          };
        }

        return {
          id: c.id,
          readableId: c.readableId || `HM-${String(c.displayNumber).padStart(4, '0')}`,
          title: c.title,
          description: c.description,
          category: c.category,
          priority: c.priority,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          deadline: c.deadlineAt.toISOString(),
          upvoteCount,
          hasUpvoted,
          isOwnComplaint: isOwn,
          isOwner: isOwn,
          confirmationWindow,
          photos: c.photos.map((p) => ({
            id: p.id,
            url: `/api/photos/${p.id}`,
            filename: p.filename,
            mimeType: p.mimeType,
            sizeBytes: p.sizeBytes,
          })),
        };
      });

      res.status(200).json({
        feed: feedItems,
        pagination: {
          limit: takeLimit,
          nextCursor,
          hasMore: nextCursor !== null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// POST /api/complaints/:id/upvote — Upvote a complaint + auto-promote at 10 votes
// -----------------------------------------------------------------------------
router.post(
  '/complaints/:id/upvote',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Find complaint
      const complaint = await prisma.complaint.findFirst({
        where: {
          OR: [{ id }, { readableId: id }],
        },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      // Rule: Same hostel only
      assertHostelScope(user, complaint.hostelId);

      // Rule: Not on your own complaint
      if (complaint.submitterId === user.id) {
        throw new BadRequestError(
          'You cannot upvote your own complaint',
          'SELF_UPVOTE_DISALLOWED'
        );
      }

      // Rule: Not on inactive complaints
      if (!ACTIVE_COMPLAINT_STATUSES.includes(complaint.status)) {
        throw new BadRequestError(
          `Cannot upvote complaint in status '${complaint.status}'. Voting is only open on active complaints.`,
          'INACTIVE_COMPLAINT'
        );
      }

      // Perform voting and atomic promotion inside ONE transaction with row locking
      const result = await prisma.$transaction(async (tx) => {
        // Lock complaint row to prevent concurrent race condition on promotion
        await tx.$executeRaw`SELECT id FROM "Complaint" WHERE id = ${complaint.id} FOR UPDATE`;

        // Check if user already upvoted
        const existingVote = await tx.upvote.findUnique({
          where: {
            complaintId_userId: {
              complaintId: complaint.id,
              userId: user.id,
            },
          },
        });

        if (existingVote) {
          throw new ConflictError('You have already upvoted this complaint');
        }

        // Insert new Upvote record
        const now = new Date();
        await tx.upvote.create({
          data: {
            complaintId: complaint.id,
            userId: user.id,
            createdAt: now,
          },
        });

        // Count eligible community upvotes
        const freshVotesCount = await tx.upvote.count({
          where: { complaintId: complaint.id },
        });

        // Re-read fresh complaint priority under lock
        const freshComplaint = await tx.complaint.findUniqueOrThrow({
          where: { id: complaint.id },
        });

        let promoted = false;

        // Emergency Promotion Rule:
        // When eligible upvotes reaches 10 on a NORMAL complaint, promote it to EMERGENCY.
        // The 24-hour deadline restarts at the promotion timestamp.
        // Runs exactly once even under concurrent votes because of FOR UPDATE lock!
        if (freshComplaint.priority === ComplaintPriority.NORMAL && freshVotesCount >= 10) {
          promoted = true;
          const newDeadlineAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          await tx.complaint.update({
            where: { id: complaint.id },
            data: {
              priority: ComplaintPriority.EMERGENCY,
              deadlineAt: newDeadlineAt,
            },
          });

          // Record PriorityHistory
          await tx.priorityHistory.create({
            data: {
              complaintId: complaint.id,
              fromPriority: ComplaintPriority.NORMAL,
              toPriority: ComplaintPriority.EMERGENCY,
              reason: `Auto-promoted after reaching 10 community upvotes (${freshVotesCount} total upvotes)`,
              previousDeadlineAt: freshComplaint.deadlineAt,
              newDeadlineAt,
              actorId: user.id,
              createdAt: now,
            },
          });

          // Record AuditEvent
          await tx.auditEvent.create({
            data: {
              actorId: user.id,
              action: 'PRIORITY_PROMOTED',
              entityType: 'Complaint',
              entityId: complaint.id,
              before: {
                priority: ComplaintPriority.NORMAL,
                deadlineAt: freshComplaint.deadlineAt,
              },
              after: {
                priority: ComplaintPriority.EMERGENCY,
                deadlineAt: newDeadlineAt,
                upvotesCount: freshVotesCount,
              },
              ipAddress: req.ip,
              timestamp: now,
            },
          });
        }

        return {
          upvoteCount: freshVotesCount,
          hasUpvoted: true,
          promoted,
          readableId: complaint.readableId || `HM-${String(complaint.displayNumber).padStart(4, '0')}`,
          submitterId: complaint.submitterId,
          hostelId: complaint.hostelId,
          title: complaint.title,
        };
      });

      // Dispatch notifications outside transaction if promoted
      if (result.promoted) {
        await notificationService.notifyComplainantAndWardens({
          complaintId: complaint.id,
          hostelId: result.hostelId,
          complainantId: result.submitterId,
          title: `Complaint ${result.readableId} Promoted to Emergency!`,
          message: `Your issue '${result.title}' reached 10 community votes and was promoted to Emergency priority. Fresh 24h deadline started.`,
          type: 'COMPLAINT_PROMOTED',
        });
      }

      res.status(200).json({
        upvoteCount: result.upvoteCount,
        hasUpvoted: true,
        promoted: result.promoted,
        priority: result.promoted ? ComplaintPriority.EMERGENCY : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// DELETE /api/complaints/:id/upvote — Remove an upvote
// -----------------------------------------------------------------------------
router.delete(
  '/complaints/:id/upvote',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const complaint = await prisma.complaint.findFirst({
        where: {
          OR: [{ id }, { readableId: id }],
        },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      assertHostelScope(user, complaint.hostelId);

      const existingVote = await prisma.upvote.findUnique({
        where: {
          complaintId_userId: {
            complaintId: complaint.id,
            userId: user.id,
          },
        },
      });

      if (existingVote) {
        await prisma.upvote.delete({
          where: { id: existingVote.id },
        });
      }

      // Count new total upvotes
      // Note per BRIEF.md: If someone removes an upvote afterwards, the complaint stays emergency!
      const upvoteCount = await prisma.upvote.count({
        where: { complaintId: complaint.id },
      });

      res.status(200).json({
        upvoteCount,
        hasUpvoted: false,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
