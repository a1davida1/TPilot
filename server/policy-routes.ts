import type { Express, Request, Response } from "express";

type AuthenticatedRequest = Request & {
  session?: { userId?: number };
  user?: { id?: number };
};
import { lintCaption } from "./lib/policy-linter.js";
import { getPreviewStats, checkPreviewGate } from "./lib/preview-gate.js";
import { db } from "./db.js";
import { postPreviews, featureFlags } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Request validation schemas
const previewRequestSchema = z.object({
  subreddit: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  body: z.string().max(10000),
  hasLink: z.boolean().optional().default(false)
});

export function registerPolicyRoutes(app: Express) {
  // POST /api/preview - Lint content and store preview
  app.post("/api/preview", async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Authentication check - get userId from session or auth middleware
      const userId = req.session?.userId ?? req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Validate request
      const validation = previewRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request",
          errors: validation.error.issues
        });
      }

      const { subreddit, title, body, hasLink } = validation.data;

      // Run policy linter
      const lintResult = await lintCaption({
        subreddit,
        title,
        body,
        hasLink
      });

      // Store preview in database
      const [preview] = await db
        .insert(postPreviews)
        .values({
          userId,
          subreddit: subreddit.toLowerCase(),
          titlePreview: title,
          bodyPreview: body,
          policyState: lintResult.state,
          warnings: lintResult.warnings
        })
        .returning();

      // Return lint result
      res.json({
        id: preview.id,
        policyState: lintResult.state,
        warnings: lintResult.warnings,
        timestamp: preview.createdAt
      });

    } catch (error) {
      console.error("Preview endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/user/previewStats - Get user's preview gate status
  app.get("/api/user/previewStats", async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Authentication check - get userId from session or auth middleware
      const userId = req.session?.userId ?? req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Get preview statistics
      const stats = await getPreviewStats(userId);

      res.json(stats);

    } catch (error) {
      console.error("Preview stats endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/policy/gate/check - Check if user can queue posts
  app.get("/api/policy/gate/check", async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Authentication check - get userId from session or auth middleware
      const userId = req.session?.userId ?? req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Check preview gate
      const gateResult = await checkPreviewGate(userId);

      res.json(gateResult);

    } catch (error) {
      console.error("Gate check endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/policy/flags - Get policy feature flags
  app.get("/api/policy/flags", async (req, res) => {
    try {
      // Get policy-related feature flags
      const flags = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.key, "policy.blockOnWarn"));

      const blockOnWarn = flags.length > 0 ? flags[0].enabled : false;

      res.json({
        blockOnWarn
      });

    } catch (error) {
      console.error("Policy flags endpoint error:", error);
      res.status(500).json({ 
        blockOnWarn: false // Fail safe
      });
    }
  });
}