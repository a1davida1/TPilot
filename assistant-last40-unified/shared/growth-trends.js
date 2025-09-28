/**
 * Growth trends schemas and types
 */

import { z } from 'zod';

// Growth trend schema
export const growthTrendSchema = z.object({
  id: z.number(),
  metric: z.string(),
  value: z.number(),
  timestamp: z.date()
});

// Note: TypeScript type export not supported in .js files
// Use: const GrowthTrend = z.infer<typeof growthTrendSchema> for typing