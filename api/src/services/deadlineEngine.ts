import cron from 'node-cron';
import { ComplaintStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { defaultNotificationService } from './notifications/NotificationService.js';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const DEADLINE_ENGINE_ADVISORY_LOCK_KEY = 847291;

export interface DeadlineEngineResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  penaltiesApplied: number;
  closingSoonNoticesSent: number;
  expiredWindowsClosed: number;
}

/**
 * Core deadline engine processor:
 * - Detects overdue complaints past deadline not Marked Resolved, creates exactly 1 PenaltyEvent (-1)
 * - Sends "closing soon" notifications (2h left in 24h confirmation window)
 * - Returns complaints with expired confirmation windows to IN_PROGRESS
 * - Uses Postgres advisory locks for safe multi-instance execution
 * - Idempotent and testable with fake Clock injection
 */
export async function processDeadlines(
  clock: Clock = systemClock
): Promise<DeadlineEngineResult> {
  const currentTime = clock.now();

  // 1. Acquire PostgreSQL Advisory Lock (fails fast if another instance/worker is executing)
  const lockResult = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_lock(${DEADLINE_ENGINE_ADVISORY_LOCK_KEY}) AS acquired
  `;

  const acquired = lockResult[0]?.acquired ?? false;
  if (!acquired) {
    return {
      success: false,
      skipped: true,
      reason: 'LOCK_NOT_ACQUIRED_ANOTHER_INSTANCE_RUNNING',
      penaltiesApplied: 0,
      closingSoonNoticesSent: 0,
      expiredWindowsClosed: 0,
    };
  }

  let penaltiesApplied = 0;
  let closingSoonNoticesSent = 0;
  let expiredWindowsClosed = 0;

  try {
    // -------------------------------------------------------------------------
    // A. OVERDUE COMPLAINTS DETECTION & IDEMPOTENT PENALTY APPLICATION
    // -------------------------------------------------------------------------
    // Active complaints past deadline that are NOT marked resolved, resolved, closed, or rejected.
    const overdueCandidates = await prisma.complaint.findMany({
      where: {
        status: {
          in: [
            ComplaintStatus.SUBMITTED,
            ComplaintStatus.ACKNOWLEDGED,
            ComplaintStatus.IN_PROGRESS,
            ComplaintStatus.REOPENED,
          ],
        },
        deadlineAt: {
          lte: currentTime,
        },
      },
      include: {
        penaltyEvents: {
          select: {
            deadlineAt: true,
          },
        },
      },
    });

    for (const complaint of overdueCandidates) {
      // Idempotency check: exactly one PenaltyEvent per complaint and deadline
      const alreadyPenalized = complaint.penaltyEvents.some(
        (p) => p.deadlineAt.getTime() === complaint.deadlineAt.getTime()
      );

      if (alreadyPenalized) {
        continue;
      }

      // Determine responsible warden
      let responsibleWardenId = complaint.assignedWardenId;
      if (!responsibleWardenId) {
        const assignment = await prisma.wardenAssignment.findFirst({
          where: { hostelId: complaint.hostelId },
        });
        responsibleWardenId = assignment?.wardenId || null;
      }

      if (!responsibleWardenId) {
        continue; // No warden assigned to this hostel scope
      }

      // Apply penalty atomically
      try {
        await prisma.$transaction(async (tx) => {
          // Double-check uniqueness inside transaction
          const existing = await tx.penaltyEvent.findUnique({
            where: {
              complaintId_deadlineAt: {
                complaintId: complaint.id,
                deadlineAt: complaint.deadlineAt,
              },
            },
          });

          if (existing) return;

          const penalty = await tx.penaltyEvent.create({
            data: {
              complaintId: complaint.id,
              wardenId: responsibleWardenId,
              deadlineAt: complaint.deadlineAt,
              points: 1, // represents -1 penalty
              reason: `Service deadline missed (${complaint.deadlineAt.toISOString()}) without being marked resolved`,
              createdAt: currentTime,
            },
          });

          await tx.auditEvent.create({
            data: {
              actorId: null,
              action: 'DEADLINE_PENALTY_APPLIED',
              entityType: 'PenaltyEvent',
              entityId: penalty.id,
              after: {
                complaintId: complaint.id,
                wardenId: responsibleWardenId,
                deadlineAt: complaint.deadlineAt,
                points: 1,
              },
              timestamp: currentTime,
            },
          });
        });

        penaltiesApplied++;

        // Notify responsible warden
        await defaultNotificationService.notify({
          userId: responsibleWardenId,
          complaintId: complaint.id,
          title: 'Deadline Overdue (-1 Penalty)',
          message: `Complaint ${complaint.readableId || complaint.title} passed its deadline without being marked resolved. A -1 penalty was recorded.`,
          type: 'COMPLAINT_OVERDUE',
          createdAt: currentTime,
        });

        // Notify admins
        const admins = await prisma.user.findMany({
          where: { role: Role.ADMIN, isActive: true },
          select: { id: true },
        });

        for (const admin of admins) {
          await defaultNotificationService.notify({
            userId: admin.id,
            complaintId: complaint.id,
            title: 'Warden Penalty Incurred (-1)',
            message: `Warden missed resolution deadline for complaint ${complaint.readableId || complaint.title}.`,
            type: 'COMPLAINT_OVERDUE',
            createdAt: currentTime,
          });
        }
      } catch (err: unknown) {
        // If unique constraint caught race condition, silently continue
        const error = err as { code?: string };
        if (error.code !== 'P2002') {
          console.error(`[DeadlineEngine] Error applying penalty to complaint ${complaint.id}:`, err);
        }
      }
    }

    // -------------------------------------------------------------------------
    // B. SEND "CLOSING SOON" NOTICES (2 hours before window expires)
    // -------------------------------------------------------------------------
    const twoHoursFromNow = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000);

    const closingSoonCandidates = await prisma.complaint.findMany({
      where: {
        status: ComplaintStatus.MARKED_RESOLVED,
        confirmationWindowEndsAt: {
          gt: currentTime,
          lte: twoHoursFromNow,
        },
      },
    });

    for (const complaint of closingSoonCandidates) {
      // Check if a closing soon notice has already been sent for this round
      const existingNotice = await prisma.notification.findFirst({
        where: {
          complaintId: complaint.id,
          type: 'CONFIRMATION_WINDOW_CLOSING_SOON',
          createdAt: {
            gte: complaint.markedResolvedAt || complaint.createdAt,
          },
        },
      });

      if (existingNotice) {
        continue;
      }

      // Notify complainant
      await defaultNotificationService.notify({
        userId: complaint.submitterId,
        complaintId: complaint.id,
        title: 'Confirmation Window Closing Soon',
        message: `Less than 2 hours left to confirm resolution for complaint ${complaint.readableId || complaint.title}.`,
        type: 'CONFIRMATION_WINDOW_CLOSING_SOON',
        createdAt: currentTime,
      });

      // Notify all active students in the hostel
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
          complaintId: complaint.id,
          title: 'Confirmation Window Closing Soon',
          message: `Less than 2 hours left to verify whether issue ${complaint.readableId || complaint.title} is solved.`,
          type: 'CONFIRMATION_WINDOW_CLOSING_SOON',
          createdAt: currentTime,
        });
      }

      closingSoonNoticesSent++;
    }

    // -------------------------------------------------------------------------
    // C. CLOSE EXPIRED CONFIRMATION WINDOWS (Return to IN_PROGRESS)
    // -------------------------------------------------------------------------
    const expiredCandidates = await prisma.complaint.findMany({
      where: {
        status: ComplaintStatus.MARKED_RESOLVED,
        confirmationWindowEndsAt: {
          lte: currentTime,
        },
      },
      include: {
        confirmationVotes: true,
      },
    });

    for (const complaint of expiredCandidates) {
      const currentVotes = complaint.confirmationVotes.filter(
        (v) => v.round === complaint.confirmationRound
      );
      const solvedVotes = currentVotes.filter((v) => v.vote === 'SOLVED').length;
      const notSolvedVotes = currentVotes.filter((v) => v.vote === 'NOT_SOLVED').length;

      // Only return to In Progress if neither 3 solved nor 3 not solved threshold was reached
      if (solvedVotes < 3 && notSolvedVotes < 3) {
        await prisma.$transaction(async (tx) => {
          await tx.complaint.update({
            where: { id: complaint.id },
            data: {
              status: ComplaintStatus.IN_PROGRESS,
              confirmationWindowEndsAt: null,
            },
          });

          await tx.statusHistory.create({
            data: {
              complaintId: complaint.id,
              actorId: null,
              fromStatus: ComplaintStatus.MARKED_RESOLVED,
              toStatus: ComplaintStatus.IN_PROGRESS,
              reason: `24h confirmation window expired (${solvedVotes} Solved, ${notSolvedVotes} Not Solved). Returned to In Progress for warden review.`,
              createdAt: currentTime,
            },
          });

          await tx.auditEvent.create({
            data: {
              actorId: null,
              action: 'CONFIRMATION_WINDOW_EXPIRED',
              entityType: 'Complaint',
              entityId: complaint.id,
              before: { status: ComplaintStatus.MARKED_RESOLVED },
              after: {
                status: ComplaintStatus.IN_PROGRESS,
                solvedVotes,
                notSolvedVotes,
              },
              timestamp: currentTime,
            },
          });
        });

        expiredWindowsClosed++;

        // Notify complainant and assigned warden
        await defaultNotificationService.notify({
          userId: complaint.submitterId,
          complaintId: complaint.id,
          title: 'Resolution Confirmation Expired',
          message: `Confirmation window for complaint ${complaint.readableId || complaint.title} expired without consensus. Returned to In Progress.`,
          type: 'CONFIRMATION_WINDOW_ENDED',
          createdAt: currentTime,
        });

        if (complaint.assignedWardenId) {
          await defaultNotificationService.notify({
            userId: complaint.assignedWardenId,
            complaintId: complaint.id,
            title: 'Complaint Returned to In Progress',
            message: `Confirmation window for complaint ${complaint.readableId || complaint.title} expired. The complaint requires further review.`,
            type: 'CONFIRMATION_WINDOW_ENDED',
            createdAt: currentTime,
          });
        }
      }
    }

    return {
      success: true,
      penaltiesApplied,
      closingSoonNoticesSent,
      expiredWindowsClosed,
    };
  } finally {
    // 2. Release PostgreSQL Advisory Lock
    await prisma.$queryRaw`
      SELECT pg_advisory_unlock(${DEADLINE_ENGINE_ADVISORY_LOCK_KEY})
    `;
  }
}

// -----------------------------------------------------------------------------
// Scheduled Cron Runner
// -----------------------------------------------------------------------------
let cronTask: cron.ScheduledTask | null = null;

export function startDeadlineEngineCron(): void {
  if (cronTask) return;

  cronTask = cron.schedule('* * * * *', async () => {
    try {
      await processDeadlines(systemClock);
    } catch (err) {
      console.error('[DeadlineEngine] Cron execution failed:', err);
    }
  });

  console.log('[DeadlineEngine] Background scheduler started (every minute)');
}

export function stopDeadlineEngineCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[DeadlineEngine] Background scheduler stopped');
  }
}
