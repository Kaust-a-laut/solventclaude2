import { Response } from 'express';
import { getSafeErrorMessage, logError } from './errors';

export interface RouteErrorContext {
  res: Response;
  error: unknown;
  context: string;
  statusCode?: number;
}

export function handleRouteError({ res, error, context, statusCode = 500 }: RouteErrorContext) {
  const errorId = logError(context, error);
  const message = getSafeErrorMessage(error, context);
  res.status(statusCode).json({ error: message, reference: errorId });
}

