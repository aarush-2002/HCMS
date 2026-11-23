import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // generous allowance in testing
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many login attempts from this IP address. Please try again after 15 minutes.',
      },
    });
  },
});

// In-memory account-level rate limiter to prevent targeted account brute-forcing
interface FailedAttempt {
  count: number;
  resetAt: number;
}

const failedAccountAttempts = new Map<string, FailedAttempt>();

export function checkAccountLockout(identifier: string): boolean {
  const record = failedAccountAttempts.get(identifier.toLowerCase());
  if (!record) return false;
  if (Date.now() > record.resetAt) {
    failedAccountAttempts.delete(identifier.toLowerCase());
    return false;
  }
  return record.count >= 8;
}

export function recordFailedAccountAttempt(identifier: string): void {
  const key = identifier.toLowerCase();
  const existing = failedAccountAttempts.get(key);
  const now = Date.now();

  if (!existing || now > existing.resetAt) {
    failedAccountAttempts.set(key, {
      count: 1,
      resetAt: now + 15 * 60 * 1000,
    });
  } else {
    existing.count += 1;
  }
}

export function clearFailedAccountAttempts(identifier: string): void {
  failedAccountAttempts.delete(identifier.toLowerCase());
}
