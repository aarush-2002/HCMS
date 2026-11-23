export type Role = 'STUDENT' | 'WARDEN' | 'ADMIN';

export type ComplaintCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'CLEANLINESS'
  | 'FURNITURE'
  | 'INTERNET'
  | 'OTHER';

export type ComplaintPriority = 'NORMAL' | 'EMERGENCY';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'MARKED_RESOLVED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED'
  | 'REJECTED';

export type ConfirmationVoteType = 'SOLVED' | 'NOT_SOLVED';

export interface Hostel {
  id: string;
  name: string;
  code: string;
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WardenAssignment {
  id: string;
  wardenId: string;
  hostelId: string;
  buildingBlock: string | null;
  hostel?: Hostel;
  warden?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  studentId?: string | null;
  roomNumber?: string | null;
  hostelId: string;
  isActive?: boolean;
  hostel?: Hostel;
  wardenAssignments?: WardenAssignment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplaintPhoto {
  id: string;
  complaintId: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  createdAt: string;
}

export interface StatusHistory {
  id: string;
  complaintId: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus;
  changedById: string;
  changedBy?: {
    id: string;
    name: string;
    role: Role;
  };
  note?: string | null;
  createdAt: string;
}

export interface PriorityHistory {
  id: string;
  complaintId: string;
  fromPriority: ComplaintPriority;
  toPriority: ComplaintPriority;
  reason: string;
  triggeredById?: string | null;
  triggeredBy?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
}

export interface ConfirmationVote {
  id: string;
  complaintId: string;
  studentId: string;
  vote: ConfirmationVoteType;
  round: number;
  createdAt: string;
}

export interface Rating {
  id: string;
  complaintId: string;
  complainantId: string;
  wardenId: string;
  stars: number;
  comment?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  createdAt: string;
}

export interface Complaint {
  id: string;
  readableId: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  hostelId: string;
  hostel?: Hostel;
  studentId: string;
  submitter?: {
    id: string;
    name: string;
    roomNumber?: string | null;
    studentId?: string | null;
  };
  assignedWardenId?: string | null;
  assignedWarden?: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
  deadline: string;
  markedResolvedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  confirmationRound: number;
  confirmationWindowEndsAt?: string | null;
  upvoteCount: number;
  hasUpvoted?: boolean;
  isOwner?: boolean;
  photos: ComplaintPhoto[];
  statusHistory?: StatusHistory[];
  priorityHistory?: PriorityHistory[];
  confirmationVotes?: ConfirmationVote[];
  rating?: Rating | null;
  confirmationSummary?: {
    solvedCount: number;
    notSolvedCount: number;
    requiredVotes: number;
    round: number;
    windowEndsAt: string | null;
    isWindowOpen: boolean;
    userVote?: ConfirmationVoteType | null;
  };
}

export interface QuotaStatus {
  normalLeftToday: number;
  emergencyLeftThisWeek: number;
  normalDailyLimit: number;
  emergencyWeeklyLimit: number;
  nextDailyResetTime: string;
  nextWeeklyResetTime: string;
  timezone: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Policy {
  id: string;
  hostelId: string;
  hostel?: Hostel;
  normalDeadlineHours: number;
  emergencyDeadlineHours: number;
  upvotesToEscalate: number;
  confirmationsNeeded: number;
  confirmationWindowHours: number;
  normalDailyLimit: number;
  emergencyWeeklyLimit: number;
  timezone: string;
  updatedAt: string;
}

export interface WardenScore {
  wardenId: string;
  wardenName: string;
  averageRating: number;
  ratingCount: number;
  totalPenalties: number;
  compositeScore: number;
  penalties: Array<{
    id: string;
    complaintId: string;
    complaintReadableId: string;
    complaintTitle: string;
    deadlinePassedAt: string;
    penaltyAppliedAt: string;
  }>;
}

export interface AuditEvent {
  id: string;
  actorId?: string | null;
  actor?: {
    id: string;
    name: string;
    role: Role;
  } | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
  timestamp: string;
}
