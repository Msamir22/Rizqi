/**
 * Authentication Middleware
 * Validates Supabase JWT tokens from Authorization header
 */

import { User } from "@supabase/supabase-js";
import { NextFunction, Request, Response, RequestHandler } from "express";
import { asyncHandler, Errors } from "../lib/errors";
import { getSupabaseClient } from "../lib/supabase";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

/**
 * Request type with guaranteed userId (after requireAuth middleware)
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
  user: User;
}

/**
 * Middleware to require authenticated user
 * Extracts and validates JWT from Authorization header
 */
export async function Auth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error("Auth validation failed:", error?.message);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Attach user to request
    req.user = data.user;
    req.userId = data.user.id;

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for public endpoints
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without user
      next();
      return;
    }

    const token = authHeader.substring(7);

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (!error && data.user) {
      req.user = data.user;
      req.userId = data.user.id;
    }

    next();
  } catch (err) {
    // Don't fail on auth errors for optional auth
    console.error("Optional auth error:", err);
    next();
  }
}
