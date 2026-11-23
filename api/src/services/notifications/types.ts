export type NotificationEventType =
  | 'COMPLAINT_SUBMITTED'
  | 'COMPLAINT_ACKNOWLEDGED'
  | 'COMPLAINT_STATUS_UPDATED'
  | 'COMPLAINT_PROMOTED'
  | 'CONFIRMATION_WINDOW_OPENED'
  | 'CONFIRMATION_WINDOW_CLOSING_SOON'
  | 'CONFIRMATION_WINDOW_ENDED'
  | 'COMPLAINT_RESOLVED'
  | 'COMPLAINT_REOPENED'
  | 'COMPLAINT_REJECTED'
  | 'COMPLAINT_OVERDUE'
  | 'PENALTY_APPLIED'
  | 'PENALTY_WAIVED'
  | 'RATING_AVAILABLE';

export interface NotificationPayload {
  userId: string;
  complaintId?: string;
  title: string;
  message: string;
  type: NotificationEventType;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

export interface INotificationChannel {
  name: string;
  send(payload: NotificationPayload): Promise<void>;
  sendBatch?(payloads: NotificationPayload[]): Promise<void>;
}
