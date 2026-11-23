import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'hmcs-ultra-secure-jwt-secret-key-2026-production-ready';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  name: string;
  role: Role;
  hostelId: string;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
