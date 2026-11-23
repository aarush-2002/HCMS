import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ComplaintCategory, ComplaintPriority, ComplaintStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, assertHostelScope } from '../middleware/auth.js';
import { defaultPhotoService, MAX_PHOTO_SIZE_BYTES } from '../services/photoService.js';
import {
  getUserQuotaStatus,
  getCalendarDayKey,
  getCalendarWeekKey,
} from '../services/quotaService.js';
import { serializeComplaintForUser } from '../utils/complaintSerializer.js';
import {
  BadRequestError,
  NotFoundError,
} from '../middleware/errorHandler.js';

const router = Router();

// Configure multer for in-memory upload buffering before processing & EXIF stripping
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PHOTO_SIZE_BYTES, // 2 MB
    files: 3, // up to 3 photos
  },
});

// Zod schema for complaint creation
const CreateComplaintSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be between 3 and 80 characters')
    .max(80, 'Title must be between 3 and 80 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be between 10 and 600 characters')
    .max(600, 'Description must be between 10 and 600 characters'),
  category: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(ComplaintCategory, {
      errorMap: () => ({
        message:
          'Category must be one of: Plumbing, Electrical, Cleanliness, Furniture, Internet, Other',
      }),
    })
  ),
  priority: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.nativeEnum(ComplaintPriority, {
      errorMap: () => ({ message: 'Priority must be normal or emergency' }),
    })
  ),
});

// Middleware handling multer errors (like file too large or file count exceeded)
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.array('photos', 3)(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError('File size exceeds maximum limit of 2 MB', 'FILE_TOO_LARGE')
        );
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          new BadRequestError('You cannot upload more than 3 photos per complaint', 'TOO_MANY_PHOTOS')
        );
      }
      return next(new BadRequestError(`Upload error: ${err.message}`, 'UPLOAD_ERROR'));
    }
    if (err) {
      return next(err);
    }
    next();
  });
};

// -----------------------------------------------------------------------------
// POST /api/complaints — Submit a new complaint (Student only)
// -----------------------------------------------------------------------------
router.post(
  '/complaints',
  requireAuth,
  requireRole(Role.STUDENT),
  handleUpload,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uploadedFiles: string[] = [];

    try {
      const user = req.user!;
      const files = (req.files as Express.Multer.File[]) || [];

      // Parse and validate fields
      const input = CreateComplaintSchema.parse(req.body);

      // Validate photos by magic bytes and strip EXIF before touching the database
      const savedPhotos = await defaultPhotoService.storePhotos(files);
      for (const p of savedPhotos) {
        uploadedFiles.push(p.storageKey);
      }

      // Execute Quota Check, Complaint Insert, StatusHistory, AuditEvent, and Notifications
      // within ONE database transaction with row/advisory locks to prevent race conditions.
      const now = new Date();

      const result = await prisma.$transaction(async (tx) => {
        // Fetch hostel policy for timezone and deadline calculation
        const policy = await tx.policy.findFirst({
          where: {
            OR: [{ hostelId: user.hostelId }, { hostelId: null }],
          },
          orderBy: { hostelId: 'desc' },
        });

        const timezone = policy?.timezone || 'Asia/Kolkata';
        const normalDeadlineHours = policy?.normalDeadlineHours ?? 72;
        const emergencyDeadlineHours = policy?.emergencyDeadlineHours ?? 24;

        // Determine period key for calendar boundaries in the hostel's timezone
        const dayKey = getCalendarDayKey(now, timezone);
        const weekKey = getCalendarWeekKey(now, timezone);
        const periodKey = input.priority === ComplaintPriority.NORMAL ? dayKey : weekKey;

        // Use PostgreSQL advisory transaction lock on user ID + priority + periodKey
        // This guarantees that concurrent submissions for the same user wait and cannot both succeed
        const lockString = `quota_${user.id}_${input.priority}_${periodKey}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockString}))`;

        // Check if quota was already consumed for this period
        const existingQuota = await tx.submissionQuota.findUnique({
          where: {
            userId_quotaType_periodKey: {
              userId: user.id,
              quotaType: input.priority,
              periodKey,
            },
          },
        });

        if (existingQuota) {
          throw new BadRequestError(
            input.priority === ComplaintPriority.NORMAL
              ? 'Daily normal complaint allowance (1 per calendar day) already used for today. Quota resets at midnight.'
              : 'Weekly emergency complaint allowance (1 per calendar week) already used for this week. Quota resets on Monday.',
            'QUOTA_EXCEEDED'
          );
        }

        // Calculate SLA deadline
        const deadlineHours =
          input.priority === ComplaintPriority.NORMAL
            ? normalDeadlineHours
            : emergencyDeadlineHours;
        const deadlineAt = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

        // Find primary assigned warden for this hostel block (if any)
        const assignment = await tx.wardenAssignment.findFirst({
          where: { hostelId: user.hostelId },
          include: { warden: true },
        });
        const assignedWardenId = assignment?.wardenId || null;

        // Create the Complaint record
        const complaint = await tx.complaint.create({
          data: {
            title: input.title,
            description: input.description,
            category: input.category,
            priority: input.priority,
            status: ComplaintStatus.SUBMITTED,
            submitterId: user.id,
            hostelId: user.hostelId,
            assignedWardenId,
            deadlineAt,
            createdAt: now,
          },
        });

        // Generate readable ID: HM-0001 style
        const readableId = `HM-${String(complaint.displayNumber).padStart(4, '0')}`;
        await tx.complaint.update({
          where: { id: complaint.id },
          data: { readableId },
        });

        // Record Quota Consumption
        await tx.submissionQuota.create({
          data: {
            userId: user.id,
            quotaType: input.priority,
            periodKey,
            complaintId: complaint.id,
            createdAt: now,
          },
        });

        // Record initial StatusHistory
        await tx.statusHistory.create({
          data: {
            complaintId: complaint.id,
            fromStatus: null,
            toStatus: ComplaintStatus.SUBMITTED,
            actorId: user.id,
            reason: 'Initial complaint submission',
            createdAt: now,
          },
        });

        // Attach photos if any
        if (savedPhotos.length > 0) {
          await tx.complaintPhoto.createMany({
            data: savedPhotos.map((p) => ({
              complaintId: complaint.id,
              url: `/api/photos/${complaint.id}`, // Placeholder; resolved by ID
              storageKey: p.storageKey,
              filename: p.filename,
              mimeType: p.mimeType,
              sizeBytes: p.sizeBytes,
              uploadedAt: now,
            })),
          });
        }

        // Create AuditEvent
        await tx.auditEvent.create({
          data: {
            actorId: user.id,
            action: 'COMPLAINT_SUBMITTED',
            entityType: 'Complaint',
            entityId: complaint.id,
            after: {
              readableId,
              title: input.title,
              category: input.category,
              priority: input.priority,
              deadlineAt,
              photosCount: savedPhotos.length,
            },
            ipAddress: req.ip,
            timestamp: now,
          },
        });

        // Notify assigned wardens
        const allWardenAssignments = await tx.wardenAssignment.findMany({
          where: { hostelId: user.hostelId },
          select: { wardenId: true },
        });

        const uniqueWardenIds = Array.from(new Set(allWardenAssignments.map((a) => a.wardenId)));
        if (uniqueWardenIds.length > 0) {
          await tx.notification.createMany({
            data: uniqueWardenIds.map((wardenId) => ({
              userId: wardenId,
              complaintId: complaint.id,
              title: `New ${input.priority} Complaint: ${readableId}`,
              message: `${input.title} (${input.category}) filed. Deadline: ${deadlineHours}h`,
              type: 'COMPLAINT_SUBMITTED',
              createdAt: now,
            })),
          });
        }

        // Fetch freshly created complaint with relations
        return await tx.complaint.findUniqueOrThrow({
          where: { id: complaint.id },
          include: {
            hostel: { select: { id: true, name: true, code: true } },
            assignedWarden: { select: { id: true, name: true, email: true } },
            photos: true,
            statusHistory: true,
            _count: { select: { upvotes: true } },
          },
        });
      });

      res.status(201).json({
        id: result.id,
        readableId: result.readableId,
        priority: result.priority,
        deadline: result.deadlineAt.toISOString(),
        complaint: serializeComplaintForUser(result, user),
      });
    } catch (err) {
      // If transaction failed or error thrown, clean up any files saved to disk
      if (uploadedFiles.length > 0) {
        await defaultPhotoService.cleanupFiles(uploadedFiles);
      }
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/quota — Check student's current submission allowances and reset times
// -----------------------------------------------------------------------------
router.get(
  '/quota',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const quota = await getUserQuotaStatus(req.user!.id, req.user!.hostelId);
      res.status(200).json({ quota });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/complaints/mine — Student's own complaints (filtered and paginated)
// -----------------------------------------------------------------------------
router.get(
  '/complaints/mine',
  requireAuth,
  requireRole(Role.STUDENT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const status = req.query.status as ComplaintStatus | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const where = {
        submitterId: user.id,
        ...(status ? { status } : {}),
      };

      const [complaints, totalCount] = await Promise.all([
        prisma.complaint.findMany({
          where,
          include: {
            hostel: { select: { id: true, name: true, code: true } },
            assignedWarden: { select: { id: true, name: true, email: true } },
            photos: true,
            statusHistory: { orderBy: { createdAt: 'desc' } },
            priorityHistory: { orderBy: { createdAt: 'desc' } },
            rating: true,
            confirmationVotes: true,
            upvotes: { select: { userId: true } },
            _count: { select: { upvotes: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.complaint.count({ where }),
      ]);

      const serialized = complaints.map((c) => serializeComplaintForUser(c, user));

      res.status(200).json({
        complaints: serialized,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/complaints/:id — Single complaint details with scope check & anonymity
// -----------------------------------------------------------------------------
router.get(
  '/complaints/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // Lookup by CUID id or readableId (e.g. HM-1042)
      const complaint = await prisma.complaint.findFirst({
        where: {
          OR: [{ id }, { readableId: id }],
        },
        include: {
          hostel: { select: { id: true, name: true, code: true } },
          submitter: {
            select: {
              id: true,
              name: true,
              email: true,
              studentId: true,
              roomNumber: true,
            },
          },
          assignedWarden: { select: { id: true, name: true, email: true } },
          photos: true,
          statusHistory: { orderBy: { createdAt: 'desc' } },
          priorityHistory: { orderBy: { createdAt: 'desc' } },
          rating: true,
          confirmationVotes: true,
          upvotes: { select: { userId: true } },
          _count: { select: { upvotes: true } },
        },
      });

      if (!complaint) {
        throw new NotFoundError(`Complaint '${id}' not found`);
      }

      // Scope Check: ensures user has permission for this complaint's hostel
      assertHostelScope(user, complaint.hostelId);

      // Serialize response (enforces strict submitter anonymity for peers!)
      res.status(200).json({
        complaint: serializeComplaintForUser(complaint, user),
      });
    } catch (err) {
      next(err);
    }
  }
);

// -----------------------------------------------------------------------------
// GET /api/photos/:id — Serve complaint photos through scope check
// -----------------------------------------------------------------------------
router.get(
  '/photos/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const photo = await prisma.complaintPhoto.findUnique({
        where: { id },
        include: {
          complaint: { select: { hostelId: true } },
        },
      });

      if (!photo || !photo.storageKey) {
        throw new NotFoundError('Photo not found');
      }

      // Scope Check: user must belong to or manage the complaint's hostel
      assertHostelScope(user, photo.complaint.hostelId);

      const fileResult = await defaultPhotoService['storage'].getFileStream(photo.storageKey);
      if (!fileResult) {
        throw new NotFoundError('Photo file could not be located on storage server');
      }

      res.setHeader('Content-Type', photo.mimeType);
      res.setHeader('Content-Length', fileResult.sizeBytes);
      res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache for authorized user
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(photo.filename)}"`
      );

      fileResult.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
