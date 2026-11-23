import { apiRequest } from './client';
import { QuotaStatus } from '@hmcs/shared';

export async function fetchQuota(): Promise<QuotaStatus> {
  const res = await apiRequest<{ quota: QuotaStatus }>('/api/quota');
  return res.quota;
}
