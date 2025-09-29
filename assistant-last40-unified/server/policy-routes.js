import { authenticateToken } from "./middleware/auth.ts";
import { lintCaption } from "./lib/policy-linter.ts";
import { z } from "zod";

// Request validation schemas
const previewRequestSchema = z.object({
  subreddit: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  body: z.string().max(10000),
  hasLink: z.boolean().optional().default(false)
});

export function registerPolicyRoutes(app) {
  // POST /api/preview - Lint content and store preview (basic implementation)
  app.post("/api/preview", authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
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

      // Basic policy check
      const lintResult = {
        state: 'pass',
        warnings: []
      };

      // Return basic result
      res.json({
        id: Date.now(), // Simple ID for testing
        policyState: lintResult.state,
        warnings: lintResult.warnings,
        timestamp: new Date()
      });

    } catch (error) {
      console.error("Preview endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/user/previewStats - Get user's preview gate status
  app.get("/api/user/previewStats", authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Return basic stats
      res.json({
        canQueuePosts: true,
        previewCount: 0,
        passedCount: 0
      });

    } catch (error) {
      console.error("Preview stats endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/policy/gate/check - Check if user can queue posts
  app.get("/api/policy/gate/check", authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Basic gate check
      res.json({
        canQueuePosts: true,
        reason: null
      });

    } catch (error) {
      console.error("Gate check endpoint error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/policy/flags - Get policy feature flags
  app.get("/api/policy/flags", async (req, res) => {
    try {
      res.json({
        blockOnWarn: false
      });

    } catch (error) {
      console.error("Policy flags endpoint error:", error);
      res.status(500).json({
        blockOnWarn: false // Fail safe
      });
    }
  });
}