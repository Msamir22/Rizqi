import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Custom application error with status code
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  public constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes from programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error factory methods
 */
export const Errors = {
  notFound: (resource: string): AppError =>
    new AppError(`${resource} not found`, 404),

  unauthorized: (message = "Unauthorized"): AppError =>
    new AppError(message, 401),

  forbidden: (message = "Forbidden"): AppError => new AppError(message, 403),

  badRequest: (message: string): AppError => new AppError(message, 400),

  internal: (message = "Internal server error"): AppError =>
    new AppError(message, 500),

  supabaseError: (error: { message?: string; code?: string }): AppError => {
    console.error("Supabase error:", error);
    return new AppError(error.message ?? "Database error", 500);
  },
};

/**
 * Wraps async route handlers to automatically catch errors
 * and pass them to the global error handler.
 * Generic to support AuthenticatedRequest and other custom request types.
 */
export function asyncHandler<TReq extends Request = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
}

/**
 * Global error handler middleware
 * Must be registered LAST after all routes
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  console.error("Error:", err);

  // Handle known operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Handle unknown errors (programming bugs)
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? Errors.internal().message
        : err.message,
  });
}
