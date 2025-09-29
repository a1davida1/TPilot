const DEFAULT_LENGTH_GAP_THRESHOLD = 16;

type CaptionCarrier = { caption?: unknown };

type CaptionWithString<T extends CaptionCarrier> = T & { caption: string };

function hasStringCaption<T extends CaptionCarrier>(
  variant: T
): variant is CaptionWithString<T> {
  return typeof variant.caption === "string";
}

export function dedupeCaptionVariants<T extends CaptionCarrier>(
  variants: readonly T[],
  lengthGapThreshold: number = DEFAULT_LENGTH_GAP_THRESHOLD
): Array<CaptionWithString<T>> {
  const unique: Array<CaptionWithString<T>> = [];

  variants.forEach(variant => {
    if (!hasStringCaption(variant)) {
      return;
    }

    const caption = variant.caption.trim();
    if (!caption) {
      return;
    }

    const lower = caption.toLowerCase();
    let handled = false;

    for (let i = 0; i < unique.length; i += 1) {
      const existing = unique[i];
      const existingCaption = existing.caption.trim();
      const existingLower = existingCaption.toLowerCase();

      if (existingLower === lower) {
        if (caption.length > existingCaption.length) {
          unique[i] = variant;
        }
        handled = true;
        break;
      }

      const lengthGap = Math.abs(existingCaption.length - caption.length);
      if (lengthGap <= lengthGapThreshold) {
        const includesExisting = lower.includes(existingLower);
        const existingIncludes = existingLower.includes(lower);
        if (includesExisting || existingIncludes) {
          if (caption.length > existingCaption.length) {
            unique[i] = variant;
          }
          handled = true;
          break;
        }
      }
    }

    if (!handled) {
      unique.push(variant);
    }
  });

  return unique;
}