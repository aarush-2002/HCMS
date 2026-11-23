import { apiRequest } from './client';
import { Complaint } from '@hmcs/shared';

export interface FeedResponse {
  items: Complaint[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MyComplaintsResponse {
  complaints: Complaint[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export async function fetchFeed(params?: {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
  sort?: string;
  cursor?: string;
  limit?: number;
}): Promise<FeedResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.sort) query.set('sort', params.sort);
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const res = await apiRequest<{
    feed: Complaint[];
    pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
  }>(`/api/feed${qs ? `?${qs}` : ''}`);

  return {
    items: res.feed || [],
    nextCursor: res.pagination?.nextCursor || null,
    hasMore: res.pagination?.hasMore || false,
  };
}

export async function fetchMyComplaints(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<MyComplaintsResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiRequest<MyComplaintsResponse>(`/api/complaints/mine${qs ? `?${qs}` : ''}`);
}

export async function fetchComplaintDetail(id: string): Promise<{ complaint: Complaint }> {
  return apiRequest<{ complaint: Complaint }>(`/api/complaints/${id}`);
}

export async function createComplaint(formData: FormData): Promise<{
  id: string;
  readableId: string;
  priority: string;
  deadline: string;
  message?: string;
}> {
  const res = await apiRequest<{
    id?: string;
    readableId?: string;
    priority?: string;
    deadline?: string;
    complaint?: Complaint;
  }>('/api/complaints', {
    method: 'POST',
    body: formData,
  });

  const id = res.id || res.complaint?.id || '';
  const readableId = res.readableId || res.complaint?.readableId || '';
  const priority = res.priority || res.complaint?.priority || '';
  const deadline = res.deadline || res.complaint?.deadline || '';

  return { id, readableId, priority, deadline };
}

export async function upvoteComplaint(id: string): Promise<{
  upvoteCount: number;
  promotedToEmergency: boolean;
}> {
  return apiRequest<{ upvoteCount: number; promotedToEmergency: boolean }>(
    `/api/complaints/${id}/upvote`,
    { method: 'POST' }
  );
}

export async function removeUpvote(id: string): Promise<{ upvoteCount: number }> {
  return apiRequest<{ upvoteCount: number }>(`/api/complaints/${id}/upvote`, {
    method: 'DELETE',
  });
}

export async function confirmResolution(
  id: string,
  vote: 'solved' | 'not_solved'
): Promise<{
  message: string;
  status: string;
  solvedCount: number;
  notSolvedCount: number;
  requiredVotes: number;
}> {
  return apiRequest(`/api/complaints/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

export async function rateComplaint(
  id: string,
  rating: { stars: number; comment?: string }
): Promise<{ message: string }> {
  return apiRequest(`/api/complaints/${id}/rating`, {
    method: 'POST',
    body: JSON.stringify(rating),
  });
}
