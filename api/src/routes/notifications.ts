import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notificationService } from '../services/notifications/NotificationService.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// -----------------------------------------------------------------------------
// GET /api/notifications — Paginated list of notifications + unread count
// -----------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/notifications/:id/read — Mark a notification as read
// -----------------------------------------------------------------------------
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundError(`Notification '${id}' not found`);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.status(200).json({
      notification: updated,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// POST /api/notifications/read-all — Mark all notifications as read
// -----------------------------------------------------------------------------
router.post('/read-all', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({
      message: 'All notifications marked as read',
      unreadCount: 0,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// GET /api/notifications/stream — Real-time Server-Sent Events (SSE)
// -----------------------------------------------------------------------------
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;

  // Set SSE streaming headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx, etc.)
  res.flushHeaders?.();

  // Send initial handshake with current unread count
  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  res.write(
    `data: ${JSON.stringify({
      type: 'INIT',
      connectedAt: new Date().toISOString(),
      unreadCount,
    })}\n\n`
  );

  // Subscribe to real-time events for this user
  const unsubscribe = notificationService.subscribe(userId, (notification) => {
    res.write(`data: ${JSON.stringify({ type: 'NOTIFICATION', notification })}\n\n`);
  });

  // Heartbeat keep-alive ping every 25 seconds
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

export default router;
