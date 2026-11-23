import { Router, Request, Response, NextFunction } from 'express';
import { ComplaintStatus } from '@prisma/client';
import prisma from '../lib/prisma.js';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    version: '1.0.0',
    service: 'hmcs-api',
  });
});

// -----------------------------------------------------------------------------
// GET /api/public/stats — Aggregate stats for landing page & Three.js ambient scene
// (No private user data leaked)
// -----------------------------------------------------------------------------
router.get('/public/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [totalCount, resolvedCount, emergencyCount, hostelCount] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({
        where: {
          status: {
            in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
          },
        },
      }),
      prisma.complaint.count({
        where: {
          priority: 'EMERGENCY',
        },
      }),
      prisma.hostel.count(),
    ]);

    const resolvedPercentage =
      totalCount > 0 ? Math.round((resolvedCount / totalCount) * 1000) / 10 : 0;

    res.status(200).json({
      totalCount,
      resolvedCount,
      emergencyCount,
      hostelCount,
      resolvedPercentage,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
