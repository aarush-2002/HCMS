import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ForbiddenError } from '../middleware/errorHandler.js';

export const CSRF_COOKIE_NAME = 'hmcs_csrf_token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function setCsrfCookie(res: Response, token?: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = isProduction && process.env.CROSS_SITE_COOKIES === 'true' ? 'none' : 'lax';
  const csrfToken = token || generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by client JS to send in X-CSRF-Token header
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return csrfToken;
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not require CSRF verification
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Login endpoints establish a new session and do not require prior CSRF verification
  if (req.path.includes('/login')) {
    return next();
  }

  // If client uses Authorization: Bearer <token> directly (API clients, scripts, tests), CSRF is not required
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  // Double submit cookie check for browser cookie-authenticated requests
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  // If there are no auth cookies present at all (e.g. login or public endpoints), CSRF is not required
  const hasAuthCookie = req.cookies?.['hmcs_access_token'] || req.cookies?.['hmcs_refresh_token'];
  if (!hasAuthCookie) {
    return next();
  }

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new ForbiddenError(
      'Invalid or missing CSRF token. State-changing requests must include a valid X-CSRF-Token header matching the CSRF cookie.',
      'CSRF_TOKEN_INVALID'
    );
  }

  next();
}
