import { apiRequest } from './client';
import { User, Hostel, Policy, Rating, AuditEvent, Complaint } from '@hmcs/shared';

export interface AdminReports {
  totalComplaints: number;
  resolvedComplaints: number;
  slaCompliancePercentage: number;
  medianResolutionHours: number;
  reopenedRatePercentage: number;
  escalatedToEmergencyCount: number;
  averageStudentRating: number;
  totalPenaltiesApplied: number;
  byCategory: Array<{ category: string; count: number; resolved: number }>;
  byHostel: Array<{ hostelName: string; total: number; resolved: number; overdue: number }>;
}

export async function fetchUsers(params?: {
  role?: string;
  search?: string;
  hostelId?: string;
}): Promise<{ users: User[] }> {
  const query = new URLSearchParams();
  if (params?.role) query.set('role', params.role);
  if (params?.search) query.set('search', params.search);
  if (params?.hostelId) query.set('hostelId', params.hostelId);

  const qs = query.toString();
  return apiRequest<{ users: User[] }>(`/api/admin/users${qs ? `?${qs}` : ''}`);
}

export async function createUser(payload: {
  email: string;
  name: string;
  password?: string;
  role: string;
  hostelId: string;
  studentId?: string;
  roomNumber?: string;
}): Promise<{ user: User }> {
  return apiRequest<{ user: User }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUserStatus(
  id: string,
  isActive: boolean
): Promise<{ user: User }> {
  return apiRequest<{ user: User }>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export async function updateUserRole(id: string, role: string): Promise<{ user: User }> {
  return apiRequest<{ user: User }>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function updateUserHostel(id: string, hostelId: string): Promise<{ user: User }> {
  return apiRequest<{ user: User }>(`/api/admin/users/${id}/hostel`, {
    method: 'PATCH',
    body: JSON.stringify({ hostelId }),
  });
}

export async function fetchHostels(): Promise<{ hostels: Hostel[] }> {
  return apiRequest<{ hostels: Hostel[] }>('/api/admin/hostels');
}

export async function createHostel(payload: {
  name: string;
  code: string;
  timezone?: string;
}): Promise<{ hostel: Hostel }> {
  return apiRequest<{ hostel: Hostel }>('/api/admin/hostels', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHostel(
  id: string,
  payload: { name?: string; code?: string; timezone?: string }
): Promise<{ hostel: Hostel }> {
  return apiRequest<{ hostel: Hostel }>(`/api/admin/hostels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function assignWarden(payload: {
  wardenId: string;
  hostelId: string;
  buildingBlock?: string;
}): Promise<{ message: string }> {
  return apiRequest('/api/admin/wardens/assign', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeWardenAssignment(assignmentId: string): Promise<{ message: string }> {
  return apiRequest(`/api/admin/wardens/assign/${assignmentId}`, {
    method: 'DELETE',
  });
}

export async function fetchPolicy(hostelId?: string): Promise<{ policy: Policy }> {
  const qs = hostelId ? `?hostelId=${hostelId}` : '';
  return apiRequest<{ policy: Policy }>(`/api/admin/policy${qs}`);
}

export async function updatePolicy(payload: Partial<Policy>): Promise<{ policy: Policy }> {
  return apiRequest<{ policy: Policy }>('/api/admin/policy', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminComplaints(params?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}): Promise<{ complaints: Complaint[] }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString();
  return apiRequest<{ complaints: Complaint[] }>(`/api/admin/complaints${qs ? `?${qs}` : ''}`);
}

export async function reclassifyComplaint(
  id: string,
  payload: { category?: string; priority?: string; reason: string }
): Promise<{ message: string; complaint: Complaint }> {
  return apiRequest(`/api/admin/complaints/${id}/reclassify`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rejectComplaint(
  id: string,
  reason: string
): Promise<{ message: string; complaint: Complaint }> {
  return apiRequest(`/api/admin/complaints/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function reassignComplaint(
  id: string,
  wardenId: string
): Promise<{ message: string; complaint: Complaint }> {
  return apiRequest(`/api/admin/complaints/${id}/reassign`, {
    method: 'POST',
    body: JSON.stringify({ wardenId }),
  });
}

export async function fetchRatings(): Promise<{ ratings: Rating[] }> {
  return apiRequest<{ ratings: Rating[] }>('/api/admin/ratings');
}

export async function hideRating(id: string, reason: string): Promise<{ message: string }> {
  return apiRequest(`/api/admin/ratings/${id}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function unhideRating(id: string): Promise<{ message: string }> {
  return apiRequest(`/api/admin/ratings/${id}/unhide`, {
    method: 'POST',
  });
}

export async function fetchAuditLogs(params?: {
  entityType?: string;
  action?: string;
  limit?: number;
}): Promise<{ auditLogs: AuditEvent[] }> {
  const query = new URLSearchParams();
  if (params?.entityType) query.set('entityType', params.entityType);
  if (params?.action) query.set('action', params.action);
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await apiRequest<{ events?: AuditEvent[]; auditLogs?: AuditEvent[] }>(
    `/api/admin/audit${qs ? `?${qs}` : ''}`
  );
  return {
    auditLogs: res.auditLogs || res.events || [],
  };
}

export async function fetchReports(): Promise<AdminReports> {
  const res = await apiRequest<any>('/api/admin/reports');
  return {
    totalComplaints: res.totalComplaints ?? res.metrics?.totalComplaints ?? 0,
    resolvedComplaints: res.resolvedComplaints ?? 0,
    slaCompliancePercentage: res.slaCompliancePercentage ?? 100,
    medianResolutionHours: res.medianResolutionHours ?? res.metrics?.medianTimeToResolutionHours ?? 0,
    reopenedRatePercentage: res.reopenedRatePercentage ?? 0,
    escalatedToEmergencyCount: res.escalatedToEmergencyCount ?? 0,
    averageStudentRating: res.averageStudentRating ?? res.metrics?.averageSatisfactionRating ?? 3.0,
    totalPenaltiesApplied: res.totalPenaltiesApplied ?? 0,
    byCategory: res.byCategory || [],
    byHostel: res.byHostel || [],
  };
}
