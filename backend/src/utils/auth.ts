import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { config } from '../config';
import { logger } from './logger';

const API_SECRET = config.BACKEND_INTERNAL_SECRET;

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  isAuthenticated?: boolean;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clientSecret = req.headers['x-solvent-secret'];
  
  if (!clientSecret || typeof clientSecret !== 'string') {
    logger.warn('[Auth] Missing credentials', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized: Missing credentials' });
    return;
  }
  
  if (!safeCompare(clientSecret, API_SECRET)) {
    logger.warn('[Auth] Invalid credentials', { path: req.path, ip: req.ip });
    res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
    return;
  }
  
  req.isAuthenticated = true;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clientSecret = req.headers['x-solvent-secret'];
  
  if (clientSecret && typeof clientSecret === 'string' && safeCompare(clientSecret, API_SECRET)) {
    req.isAuthenticated = true;
  }
  
  next();
}
