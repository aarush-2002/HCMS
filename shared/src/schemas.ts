import { z } from 'zod';

export const RoleEnum = z.enum(['STUDENT', 'WARDEN', 'ADMIN']);

export const ComplaintCategoryEnum = z.enum([
  'PLUMBING',
  'ELECTRICAL',
  'CLEANLINESS',
  'FURNITURE',
  'INTERNET',
  'OTHER',
]);

export const ComplaintPriorityEnum = z.enum(['NORMAL', 'EMERGENCY']);

export const ComplaintStatusEnum = z.enum([
  'SUBMITTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'MARKED_RESOLVED',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'REJECTED',
]);

export const ConfirmationVoteEnum = z.enum(['SOLVED', 'NOT_SOLVED']);

// Complaint Creation Schema
export const CreateComplaintSchema = z.object({
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
    ComplaintCategoryEnum
  ),
  priority: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    ComplaintPriorityEnum
  ),
});

// Authentication Schemas
export const LoginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export const ForgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or Student ID is required'),
  reason: z.string().trim().optional(),
});

// Warden Status Progression Schema
export const UpdateStatusSchema = z.object({
  status: ComplaintStatusEnum,
  note: z.string().trim().max(1000).optional(),
  resolutionNote: z.string().trim().max(1000).optional(),
});

// Resolution Confirmation Vote Schema
export const ConfirmationVoteSchema = z.object({
  vote: ConfirmationVoteEnum,
});

// Rating Schema
export const RatingSchema = z.object({
  stars: z.number().int().min(1, 'Minimum rating is 1 star').max(3, 'Maximum rating is 3 stars'),
  comment: z.string().trim().max(200, 'Comment must not exceed 200 characters').optional(),
});

// Policy Update Schema
export const PolicyUpdateSchema = z.object({
  hostelId: z.string().optional(),
  normalDeadlineHours: z.number().int().min(1).max(720).optional(),
  emergencyDeadlineHours: z.number().int().min(1).max(720).optional(),
  upvotesToEscalate: z.number().int().min(1).max(100).optional(),
  confirmationsNeeded: z.number().int().min(1).max(20).optional(),
  confirmationWindowHours: z.number().int().min(1).max(168).optional(),
  normalDailyLimit: z.number().int().min(1).max(50).optional(),
  emergencyWeeklyLimit: z.number().int().min(1).max(50).optional(),
  timezone: z.string().min(1).optional(),
});

// User Management Schemas
export const CreateUserSchema = z.object({
  email: z.string().email('Valid email address required'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: RoleEnum,
  hostelId: z.string().min(1, 'Hostel assignment is required'),
  studentId: z.string().trim().optional(),
  roomNumber: z.string().trim().optional(),
});

export const ReclassifyComplaintSchema = z.object({
  category: ComplaintCategoryEnum.optional(),
  priority: ComplaintPriorityEnum.optional(),
  reason: z.string().trim().min(3, 'A reason for reclassification is required'),
});

export const RejectComplaintSchema = z.object({
  reason: z.string().trim().min(5, 'A specific reason is required to reject a complaint'),
});
