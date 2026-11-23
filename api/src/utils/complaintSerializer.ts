import { Role } from '@prisma/client';
import { AuthUser } from '../middleware/auth.js';

export interface SerializedComplaint {
  id: string;
  displayNumber: number;
  readableId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  deadline: string;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  markedResolvedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  rejectionReason: string | null;
  confirmationRound: number;
  confirmationWindowEndsAt: string | null;
  hostelId: string;
  hostel?: {
    id: string;
    name: string;
    code: string;
  };
  assignedWarden?: {
    id: string;
    name: string;
    email: string;
  } | null;
  photos: Array<{
    id: string;
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
  }>;
  upvotesCount: number;
  upvoteCount: number;
  hasUpvoted: boolean;
  isOwner: boolean;
  submitter?: {
    id?: string;
    name?: string;
    email?: string;
    studentId?: string | null;
    roomNumber?: string | null;
    isYou?: boolean;
    isAnonymous?: boolean;
  };
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    note?: string | null;
    createdAt: string;
  }>;
  priorityHistory?: Array<{
    id: string;
    fromPriority: string;
    toPriority: string;
    reason: string;
    createdAt: string;
  }>;
  rating?: {
    id: string;
    stars: number;
    comment: string | null;
    createdAt: string;
  } | null;
  confirmationSummary?: {
    solvedCount: number;
    notSolvedCount: number;
    requiredVotes: number;
    round: number;
    windowEndsAt: string | null;
    isWindowOpen: boolean;
    userVote?: string | null;
  } | null;
}

export function serializeComplaintForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  complaint: any,
  user: AuthUser
): SerializedComplaint {
  const isSubmitter = user.id === complaint.submitterId;
  const isStaff = user.role === Role.WARDEN || user.role === Role.ADMIN;

  const readableId = complaint.readableId || `HM-${String(complaint.displayNumber).padStart(4, '0')}`;
  const deadlineStr = complaint.deadlineAt.toISOString
    ? complaint.deadlineAt.toISOString()
    : String(complaint.deadlineAt);
  const upvoteCount = complaint._count?.upvotes ?? complaint.upvotes?.length ?? 0;

  const base: SerializedComplaint = {
    id: complaint.id,
    displayNumber: complaint.displayNumber,
    readableId,
    title: complaint.title,
    description: complaint.description,
    category: complaint.category,
    priority: complaint.priority,
    status: complaint.status,
    deadline: deadlineStr,
    deadlineAt: deadlineStr,
    createdAt: complaint.createdAt.toISOString ? complaint.createdAt.toISOString() : String(complaint.createdAt),
    updatedAt: complaint.updatedAt.toISOString ? complaint.updatedAt.toISOString() : String(complaint.updatedAt),
    markedResolvedAt: complaint.markedResolvedAt?.toISOString ? complaint.markedResolvedAt.toISOString() : complaint.markedResolvedAt || null,
    resolvedAt: complaint.resolvedAt?.toISOString ? complaint.resolvedAt.toISOString() : complaint.resolvedAt || null,
    resolutionNote: complaint.resolutionNote || null,
    rejectionReason: complaint.rejectionReason || null,
    confirmationRound: complaint.confirmationRound,
    confirmationWindowEndsAt: complaint.confirmationWindowEndsAt?.toISOString
      ? complaint.confirmationWindowEndsAt.toISOString()
      : complaint.confirmationWindowEndsAt || null,
    hostelId: complaint.hostelId,
    hostel: complaint.hostel
      ? {
          id: complaint.hostel.id,
          name: complaint.hostel.name,
          code: complaint.hostel.code,
        }
      : undefined,
    assignedWarden: complaint.assignedWarden
      ? {
          id: complaint.assignedWarden.id,
          name: complaint.assignedWarden.name,
          email: complaint.assignedWarden.email,
        }
      : null,
    photos: (complaint.photos || []).map((p: { id: string; filename: string; mimeType: string; sizeBytes: number; uploadedAt: Date }) => ({
      id: p.id,
      url: `/api/photos/${p.id}`,
      filename: p.filename,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      uploadedAt: p.uploadedAt.toISOString ? p.uploadedAt.toISOString() : String(p.uploadedAt),
    })),
    upvotesCount: upvoteCount,
    upvoteCount,
    hasUpvoted: Array.isArray(complaint.upvotes)
      ? complaint.upvotes.some((u: { userId: string }) => u.userId === user.id)
      : false,
    isOwner: isSubmitter,
  };

  // ANONYMITY RULES:
  // 1. Staff (Wardens and Admins) see the full submitter identity: name, email, studentId, roomNumber.
  // 2. Submitter viewing their own complaint sees their identity with isYou: true.
  // 3. PEER students viewing complaints NEVER see submitter name, email, studentId, or room number!
  if (isStaff) {
    base.submitter = {
      id: complaint.submitter?.id || complaint.submitterId,
      name: complaint.submitter?.name,
      email: complaint.submitter?.email,
      studentId: complaint.submitter?.studentId || null,
      roomNumber: complaint.submitter?.roomNumber || null,
    };
  } else if (isSubmitter) {
    base.submitter = {
      id: user.id,
      name: user.name,
      roomNumber: user.roomNumber || null,
      isYou: true,
    };
  } else {
    // Peer student — strictly anonymous
    base.submitter = {
      isAnonymous: true,
    };
  }

  // Include status history if present
  if (complaint.statusHistory && Array.isArray(complaint.statusHistory)) {
    base.statusHistory = complaint.statusHistory.map(
      (sh: { id: string; fromStatus: string | null; toStatus: string; reason: string | null; note?: string | null; createdAt: Date }) => ({
        id: sh.id,
        fromStatus: sh.fromStatus,
        toStatus: sh.toStatus,
        reason: sh.reason || sh.note || null,
        note: sh.reason || sh.note || null,
        createdAt: sh.createdAt.toISOString ? sh.createdAt.toISOString() : String(sh.createdAt),
      })
    );
  }

  // Include priority history if present
  if (complaint.priorityHistory && Array.isArray(complaint.priorityHistory)) {
    base.priorityHistory = complaint.priorityHistory.map(
      (ph: { id: string; fromPriority: string; toPriority: string; reason: string; createdAt: Date }) => ({
        id: ph.id,
        fromPriority: ph.fromPriority,
        toPriority: ph.toPriority,
        reason: ph.reason,
        createdAt: ph.createdAt.toISOString ? ph.createdAt.toISOString() : String(ph.createdAt),
      })
    );
  }

  // Include rating if present (hide flagged ratings from students)
  if (complaint.rating) {
    if (complaint.rating.isFlagged && !isStaff) {
      base.rating = null;
    } else {
      base.rating = {
        id: complaint.rating.id,
        stars: complaint.rating.stars,
        comment: complaint.rating.comment || null,
        createdAt: complaint.rating.createdAt.toISOString ? complaint.rating.createdAt.toISOString() : String(complaint.rating.createdAt),
      };
    }
  } else {
    base.rating = null;
  }

  // Include confirmation summary if present
  if (complaint.confirmationSummary) {
    base.confirmationSummary = complaint.confirmationSummary;
  } else if (complaint.confirmationVotes && Array.isArray(complaint.confirmationVotes)) {
    const round = complaint.confirmationRound || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentVotes = complaint.confirmationVotes.filter((v: any) => v.round === round);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solvedCount = currentVotes.filter((v: any) => v.vote === 'SOLVED').length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notSolvedCount = currentVotes.filter((v: any) => v.vote === 'NOT_SOLVED').length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userVoteObj = currentVotes.find((v: any) => v.userId === user.id || v.studentId === user.id);
    const windowEndsMs = complaint.confirmationWindowEndsAt
      ? new Date(complaint.confirmationWindowEndsAt).getTime()
      : null;
    const isWindowOpen =
      complaint.status === 'MARKED_RESOLVED' &&
      windowEndsMs !== null &&
      windowEndsMs > Date.now();

    base.confirmationSummary = {
      solvedCount,
      notSolvedCount,
      requiredVotes: 3,
      round,
      windowEndsAt: complaint.confirmationWindowEndsAt?.toISOString
        ? complaint.confirmationWindowEndsAt.toISOString()
        : complaint.confirmationWindowEndsAt || null,
      isWindowOpen: Boolean(isWindowOpen),
      userVote: userVoteObj ? userVoteObj.vote : null,
    };
  }

  return base;
}
