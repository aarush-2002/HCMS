import { apiRequest } from './client';
import { Complaint, WardenScore } from '@hmcs/shared';

export interface WardenQueueResponse {
  complaints: Complaint[];
  total: number;
  overdueCount: number;
  emergencyCount: number;
}

export async function fetchWardenQueue(params?: {
  priority?: string;
  status?: string;
  category?: string;
  overdue?: boolean;
  from?: string;
  to?: string;
  hostelId?: string;
  sort?: string;
}): Promise<WardenQueueResponse> {
  const query = new URLSearchParams();
  if (params?.priority) query.set('priority', params.priority);
  if (params?.status) query.set('status', params.status);
  if (params?.category) query.set('category', params.category);
  if (params?.overdue) query.set('overdue', 'true');
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.hostelId) query.set('hostelId', params.hostelId);
  if (params?.sort) query.set('sort', params.sort);

  const qs = query.toString();
  const res = await apiRequest<{ queue: Complaint[]; total: number }>(`/api/warden/queue${qs ? `?${qs}` : ''}`);
  const complaints = res.queue || [];
  const overdueCount = complaints.filter((c: any) => c.isOverdue).length;
  const emergencyCount = complaints.filter((c: any) => c.priority === 'EMERGENCY').length;

  return {
    complaints,
    total: res.total ?? complaints.length,
    overdueCount,
    emergencyCount,
  };
}

export async function fetchWardenComplaint(id: string): Promise<{ complaint: Complaint }> {
  return apiRequest<{ complaint: Complaint }>(`/api/warden/complaints/${id}`);
}

export async function updateWardenStatus(
  id: string,
  payload: {
    status: string;
    note?: string;
    resolutionNote?: string;
  }
): Promise<{
  message: string;
  complaint: Complaint;
}> {
  return apiRequest(`/api/warden/complaints/${id}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchWardenScore(): Promise<WardenScore> {
  const res = await apiRequest<any>('/api/warden/score');
  return {
    wardenId: res.warden?.id || '',
    wardenName: res.warden?.name || '',
    averageRating: res.averageRating ?? 0,
    ratingCount: res.totalRatings ?? res.ratingCount ?? 0,
    totalPenalties: res.penaltyCount ?? res.totalPenalties ?? 0,
    compositeScore: res.netScore ?? res.compositeScore ?? 0,
    penalties: (res.penalties || []).map((p: any) => ({
      id: p.id,
      complaintId: p.complaint?.id || p.complaintId || '',
      complaintReadableId: p.complaint?.readableId || p.complaintReadableId || '',
      reason: p.reason,
      createdAt: p.createdAt,
      points: p.points,
    })),
  };
}
