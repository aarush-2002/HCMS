import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import requestLogger from './middleware/logger.js';
import errorHandler, { NotFoundError } from './middleware/errorHandler.js';
import { verifyCsrf } from './lib/csrf.js';

import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import complaintsRouter from './routes/complaints.js';
import feedAndVotesRouter from './routes/feedAndVotes.js';
import resolutionAndHistoryRouter from './routes/resolutionAndHistory.js';
import notificationsRouter from './routes/notifications.js';
import wardenRouter from './routes/warden.js';
import testScopeRouter from './routes/testScope.js';

dotenv.config();

export const app = express();

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Strict CORS configuration
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or test tools)
      if (!origin) return callback(null, true);
      if (origin === allowedOrigin || origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by HCMS CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Double-submit CSRF verification for state-changing browser requests
app.use(verifyCsrf);

// Static uploads serving
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/warden', wardenRouter);
app.use('/api/admin', adminRouter);
app.use('/api/test-scope', testScopeRouter);
app.use('/api', complaintsRouter);
app.use('/api', feedAndVotesRouter);
app.use('/api', resolutionAndHistoryRouter);

// In production, serve the compiled React SPA if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const possibleWebDistPaths = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(process.cwd(), 'web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
];
const resolvedDist = possibleWebDistPaths.find((p) => fs.existsSync(p));

if (resolvedDist && process.env.NODE_ENV === 'production') {
  app.use(express.static(resolvedDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(resolvedDist, 'index.html'));
  });
}

// Catch-all 404 handler for undefined routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Central standardized error handler { error: { code, message } }
app.use(errorHandler);

export default app;
