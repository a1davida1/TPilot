
import { z } from "zod";
import { CaptionArray } from "./schema";
import { dedupeCaptionVariants } from "./dedupeCaptionVariants";
import { dedupeVariantsForRanking } from "./dedupeVariants";

export type RankingContext = Parameters<typeof dedupeVariantsForRanking>[2];

export function prepareVariantsForRanking(
  variants: z.infer<typeof CaptionArray>,
  context?: RankingContext,
  options?: { targetLength?: number; lengthGapThreshold?: number }
): z.infer<typeof CaptionArray> {
  const targetLength = options?.targetLength ?? 5;
  const lengthGapThreshold = options?.lengthGapThreshold;
  const deduped = lengthGapThreshold !== undefined
    ? dedupeCaptionVariants(variants, lengthGapThreshold)
    : dedupeCaptionVariants(variants);

  return dedupeVariantsForRanking(
    deduped as unknown as z.infer<typeof CaptionArray>,
    targetLength,
    context
  );
}
