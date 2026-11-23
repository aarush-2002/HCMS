import { EventEmitter } from 'events';
import prisma from '../../lib/prisma.js';
import { INotificationChannel, NotificationPayload } from './types.js';

export const notificationEmitter = new EventEmitter();
// Increase max listeners for concurrent SSE clients
notificationEmitter.setMaxListeners(200);

export class InAppNotificationChannel implements INotificationChannel {
  name = 'IN_APP';

  async send(payload: NotificationPayload): Promise<void> {
    const record = await prisma.notification.create({
      data: {
        userId: payload.userId,
        complaintId: payload.complaintId || null,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        createdAt: payload.createdAt || new Date(),
      },
    });

    // Broadcast in real-time to active SSE connection for this user
    notificationEmitter.emit(`user:${payload.userId}`, record);
  }

  async sendBatch(payloads: NotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return;

    await prisma.notification.createMany({
      data: payloads.map((p) => ({
        userId: p.userId,
        complaintId: p.complaintId || null,
        title: p.title,
        message: p.message,
        type: p.type,
        createdAt: p.createdAt || new Date(),
      })),
    });

    for (const p of payloads) {
      notificationEmitter.emit(`user:${p.userId}`, {
        ...p,
        createdAt: p.createdAt || new Date(),
        isRead: false,
      });
    }
  }
}
