import prisma from '../../lib/prisma.js';
import { INotificationChannel, NotificationEventType, NotificationPayload } from './types.js';
import { InAppNotificationChannel, notificationEmitter } from './InAppChannel.js';

export class NotificationService {
  private channels: INotificationChannel[] = [];

  constructor() {
    // In-app channel registered by default
    this.registerChannel(new InAppNotificationChannel());
  }

  registerChannel(channel: INotificationChannel): void {
    this.channels.push(channel);
  }

  async send(payload: NotificationPayload): Promise<void> {
    await Promise.all(this.channels.map((c) => c.send(payload).catch((err) => {
      console.warn(`[NotificationService] Error in channel ${c.name}:`, err);
    })));
  }

  async notify(payload: NotificationPayload): Promise<void> {
    return this.send(payload);
  }

  async sendBatch(payloads: NotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return;

    await Promise.all(
      this.channels.map(async (channel) => {
        try {
          if (channel.sendBatch) {
            await channel.sendBatch(payloads);
          } else {
            for (const p of payloads) {
              await channel.send(p);
            }
          }
        } catch (err) {
          console.warn(`[NotificationService] Batch error in channel ${channel.name}:`, err);
        }
      })
    );
  }

  /**
   * Helper to notify both the original complainant and all wardens assigned to the hostel.
   */
  async notifyComplainantAndWardens(params: {
    complaintId: string;
    hostelId: string;
    complainantId: string;
    title: string;
    message: string;
    type: NotificationEventType;
  }): Promise<void> {
    const { complaintId, hostelId, complainantId, title, message, type } = params;

    // Fetch assigned wardens for this hostel
    const assignments = await prisma.wardenAssignment.findMany({
      where: { hostelId },
      select: { wardenId: true },
    });

    const targetUserIds = new Set<string>();
    targetUserIds.add(complainantId);
    for (const a of assignments) {
      targetUserIds.add(a.wardenId);
    }

    const payloads: NotificationPayload[] = Array.from(targetUserIds).map((userId) => ({
      userId,
      complaintId,
      title,
      message,
      type,
      createdAt: new Date(),
    }));

    await this.sendBatch(payloads);
  }

  /**
   * Subscribe an active SSE connection to real-time events for this user.
   */
  subscribe(userId: string, listener: (data: unknown) => void): () => void {
    const eventName = `user:${userId}`;
    notificationEmitter.on(eventName, listener);
    return () => {
      notificationEmitter.off(eventName, listener);
    };
  }
}

export const notificationService = new NotificationService();
export const defaultNotificationService = notificationService;
