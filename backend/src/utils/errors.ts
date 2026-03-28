import { randomUUID } from 'node:crypto';
import { logger } from './logger';

export enum SolventErrorCode {
  // Original error codes
  AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR",
  INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION",
  OPERATION_CANCELLED = "OPERATION_CANCELLED",
  FILE_SYSTEM_ERROR = "FILE_SYSTEM_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTH_ERROR = "AUTH_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  
  // Merged from AppError for compatibility
  PROVIDER_FAILURE = "PROVIDER_FAILURE",
  TIMEOUT_ERROR = "TIMEOUT_ERROR"
}

export class SolventError extends Error {
  public readonly code: SolventErrorCode;
  public readonly status: number;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(message: string, code: SolventErrorCode, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = options.status || 500;
    this.retryable = options.retryable || false;
    this.cause = options.cause;
    Object.setPrototypeOf(this, SolventError.prototype);
  }
  
  // Static factory methods for common error types (merged from AppError)
  static network(message: string = 'Network connectivity issue'): SolventError {
    return new SolventError(message, SolventErrorCode.NETWORK_ERROR, { status: 503, retryable: true });
  }
  
  static provider(message: string, retryable: boolean = true): SolventError {
    return new SolventError(message, SolventErrorCode.PROVIDER_FAILURE, { status: 502, retryable });
  }
  
  static validation(message: string): SolventError {
    return new SolventError(message, SolventErrorCode.VALIDATION_ERROR, { status: 400, retryable: false });
  }
  
  static timeout(message: string = 'Request timed out'): SolventError {
    return new SolventError(message, SolventErrorCode.TIMEOUT_ERROR, { status: 408, retryable: true });
  }
  
  static auth(message: string = 'Authentication failed'): SolventError {
    return new SolventError(message, SolventErrorCode.AUTH_ERROR, { status: 401, retryable: false });
  }
}

export class AIServiceError extends SolventError {
  constructor(message: string, cause?: unknown, retryable: boolean = true) {
    super(message, SolventErrorCode.AI_PROVIDER_ERROR, { status: 502, retryable, cause });
  }
}

export class ValidationError extends SolventError {
  constructor(message: string) {
    super(message, SolventErrorCode.VALIDATION_ERROR, { status: 400 });
  }
}

export class CancelledError extends SolventError {
  constructor(message: string = 'Operation cancelled by user') {
    super(message, SolventErrorCode.OPERATION_CANCELLED, { status: 499 });
  }
}

// Re-export for backward compatibility with AppError imports
export const AppError = SolventError;
export const ErrorType = SolventErrorCode;

export function getSafeErrorMessage(error: unknown, context?: string): string {
  if (error instanceof SolventError) {
    return error.message;
  }
  if (error instanceof Error) {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      logger.error(`[Error]${context ? ` [${context}]` : ''}: ${error.message}`, {
        stack: error.stack,
        name: error.name
      });
      return 'An unexpected error occurred';
    }
    return error.message;
  }
  return String(error);
}

export function logError(context: string, error: unknown, metadata?: Record<string, unknown>) {
  const id = randomUUID();
  if (error instanceof Error) {
    logger.error(`[${context}] Error ${id}`, {
      message: error.message,
      stack: error.stack,
      ...metadata
    });
  } else {
    logger.error(`[${context}] Error ${id}`, { error: String(error), ...metadata });
  }
  return id;
}
