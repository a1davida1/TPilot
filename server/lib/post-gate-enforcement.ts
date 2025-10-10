import { checkPreviewGate } from "./preview-gate.js";
import type { Request, Response, NextFunction } from 'express';

export interface PostGateResult {
  canPost: boolean;
  reason?: string;
  required?: number;
  current?: number;
}

/**
 * Enforce preview gate before allowing post creation
 * This must be called server-side before creating any post jobs
 */
export async function enforcePreviewGate(userId: number): Promise<PostGateResult> {
  try {
    const gateResult = await checkPreviewGate(userId);
    
    if (!gateResult.canQueue) {
      return {
        canPost: false,
        reason: gateResult.reason,
        required: gateResult.required,
        current: gateResult.current
      };
    }
    
    return { canPost: true };
    
  } catch (error) {
    console.error("Post gate enforcement error:", error);
    
    // Fail safe: if gate check fails, block posting to prevent policy violations
    return {
      canPost: false,
      reason: "POLICY_CHECK_UNAVAILABLE"
    };
  }
}

/**
 * Middleware-style gate enforcement for Express routes
 */
export function requirePreviewGate() {
  return async (
    req: Request & { session?: { userId?: number }; user?: { userId?: number } },
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.session?.userId || req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const gateResult = await enforcePreviewGate(userId);
      
      if (!gateResult.canPost) {
        return res.status(403).json({
          message: "Preview gate requirement not met",
          reason: gateResult.reason,
          required: gateResult.required,
          current: gateResult.current
        });
      }
      
      // Gate passed, continue to next middleware/route handler
      next();
      
    } catch (error) {
      console.error("Preview gate middleware error:", error);
      res.status(500).json({ message: "Policy check failed" });
    }
  };
}