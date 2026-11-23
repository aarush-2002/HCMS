import { z } from 'zod';
export declare const RoleEnum: z.ZodEnum<["STUDENT", "WARDEN", "ADMIN"]>;
export declare const ComplaintCategoryEnum: z.ZodEnum<["PLUMBING", "ELECTRICAL", "CLEANLINESS", "FURNITURE", "INTERNET", "OTHER"]>;
export declare const ComplaintPriorityEnum: z.ZodEnum<["NORMAL", "EMERGENCY"]>;
export declare const ComplaintStatusEnum: z.ZodEnum<["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "MARKED_RESOLVED", "RESOLVED", "REOPENED", "CLOSED", "REJECTED"]>;
export declare const ConfirmationVoteEnum: z.ZodEnum<["SOLVED", "NOT_SOLVED"]>;
export declare const CreateComplaintSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    category: z.ZodEffects<z.ZodEnum<["PLUMBING", "ELECTRICAL", "CLEANLINESS", "FURNITURE", "INTERNET", "OTHER"]>, "PLUMBING" | "ELECTRICAL" | "CLEANLINESS" | "FURNITURE" | "INTERNET" | "OTHER", unknown>;
    priority: z.ZodEffects<z.ZodEnum<["NORMAL", "EMERGENCY"]>, "NORMAL" | "EMERGENCY", unknown>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    category: "PLUMBING" | "ELECTRICAL" | "CLEANLINESS" | "FURNITURE" | "INTERNET" | "OTHER";
    priority: "NORMAL" | "EMERGENCY";
}, {
    title: string;
    description: string;
    category?: unknown;
    priority?: unknown;
}>;
export declare const LoginSchema: z.ZodObject<{
    identifier: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    password: string;
}, {
    identifier: string;
    password: string;
}>;
export declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    identifier: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    identifier: string;
    reason?: string | undefined;
}, {
    identifier: string;
    reason?: string | undefined;
}>;
export declare const UpdateStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "MARKED_RESOLVED", "RESOLVED", "REOPENED", "CLOSED", "REJECTED"]>;
    note: z.ZodOptional<z.ZodString>;
    resolutionNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "SUBMITTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "MARKED_RESOLVED" | "RESOLVED" | "REOPENED" | "CLOSED" | "REJECTED";
    note?: string | undefined;
    resolutionNote?: string | undefined;
}, {
    status: "SUBMITTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "MARKED_RESOLVED" | "RESOLVED" | "REOPENED" | "CLOSED" | "REJECTED";
    note?: string | undefined;
    resolutionNote?: string | undefined;
}>;
export declare const ConfirmationVoteSchema: z.ZodObject<{
    vote: z.ZodEnum<["SOLVED", "NOT_SOLVED"]>;
}, "strip", z.ZodTypeAny, {
    vote: "SOLVED" | "NOT_SOLVED";
}, {
    vote: "SOLVED" | "NOT_SOLVED";
}>;
export declare const RatingSchema: z.ZodObject<{
    stars: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stars: number;
    comment?: string | undefined;
}, {
    stars: number;
    comment?: string | undefined;
}>;
export declare const PolicyUpdateSchema: z.ZodObject<{
    hostelId: z.ZodOptional<z.ZodString>;
    normalDeadlineHours: z.ZodOptional<z.ZodNumber>;
    emergencyDeadlineHours: z.ZodOptional<z.ZodNumber>;
    upvotesToEscalate: z.ZodOptional<z.ZodNumber>;
    confirmationsNeeded: z.ZodOptional<z.ZodNumber>;
    confirmationWindowHours: z.ZodOptional<z.ZodNumber>;
    normalDailyLimit: z.ZodOptional<z.ZodNumber>;
    emergencyWeeklyLimit: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hostelId?: string | undefined;
    normalDeadlineHours?: number | undefined;
    emergencyDeadlineHours?: number | undefined;
    upvotesToEscalate?: number | undefined;
    confirmationsNeeded?: number | undefined;
    confirmationWindowHours?: number | undefined;
    normalDailyLimit?: number | undefined;
    emergencyWeeklyLimit?: number | undefined;
    timezone?: string | undefined;
}, {
    hostelId?: string | undefined;
    normalDeadlineHours?: number | undefined;
    emergencyDeadlineHours?: number | undefined;
    upvotesToEscalate?: number | undefined;
    confirmationsNeeded?: number | undefined;
    confirmationWindowHours?: number | undefined;
    normalDailyLimit?: number | undefined;
    emergencyWeeklyLimit?: number | undefined;
    timezone?: string | undefined;
}>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<["STUDENT", "WARDEN", "ADMIN"]>;
    hostelId: z.ZodString;
    studentId: z.ZodOptional<z.ZodString>;
    roomNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    hostelId: string;
    email: string;
    name: string;
    role: "STUDENT" | "WARDEN" | "ADMIN";
    studentId?: string | undefined;
    roomNumber?: string | undefined;
}, {
    password: string;
    hostelId: string;
    email: string;
    name: string;
    role: "STUDENT" | "WARDEN" | "ADMIN";
    studentId?: string | undefined;
    roomNumber?: string | undefined;
}>;
export declare const ReclassifyComplaintSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<["PLUMBING", "ELECTRICAL", "CLEANLINESS", "FURNITURE", "INTERNET", "OTHER"]>>;
    priority: z.ZodOptional<z.ZodEnum<["NORMAL", "EMERGENCY"]>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    category?: "PLUMBING" | "ELECTRICAL" | "CLEANLINESS" | "FURNITURE" | "INTERNET" | "OTHER" | undefined;
    priority?: "NORMAL" | "EMERGENCY" | undefined;
}, {
    reason: string;
    category?: "PLUMBING" | "ELECTRICAL" | "CLEANLINESS" | "FURNITURE" | "INTERNET" | "OTHER" | undefined;
    priority?: "NORMAL" | "EMERGENCY" | undefined;
}>;
export declare const RejectComplaintSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
