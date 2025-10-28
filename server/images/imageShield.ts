/**
 * ImageShield - Streaming Image Protection Module
 * 
 * Centralized module for applying protection layers to images:
 * - Blur effects
 * - Noise injection
 * - Resize/quality reduction
 * - Watermarking
 * 
 * Uses streaming pipeline for memory efficiency.
 * Extracted from PR #39 (codex/build-gallery-pages-with-pagination)
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { pipeline as streamPipeline } from 'node:stream';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { dirname } from 'node:path';
import sharp from 'sharp';

const pipeline = promisify(streamPipeline);

export interface ProtectionPreset {
  level: 'light' | 'standard' | 'heavy';
  blur: number;
  noise: number;
  resize: number;
  quality: number;
}

export const protectionPresets: Record<ProtectionPreset['level'], ProtectionPreset> = {
  light: { level: 'light', blur: 0.5, noise: 5, resize: 95, quality: 92 },
  standard: { level: 'standard', blur: 1.0, noise: 10, resize: 90, quality: 88 },
  heavy: { level: 'heavy', blur: 1.5, noise: 15, resize: 85, quality: 85 },
};

export interface ApplyImageShieldOptions {
  sourcePath: string;
  destinationPath: string;
  preset: ProtectionPreset;
  addWatermark?: boolean;
  watermarkSeed?: string;
  cleanupSource?: boolean;
}

/**
 * Creates an SVG watermark with a unique identifier
 */
function createWatermarkSvg(seed: string): Buffer {
  const identifier = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 10);
  const svg = `
    <svg width="240" height="60">
      <rect width="240" height="60" fill="rgba(0, 0, 0, 0.0)" />
      <text x="12" y="36" font-family="Arial" font-size="18" font-weight="bold"
            fill="white" stroke="black" stroke-width="1" opacity="0.7">
        ${identifier}
      </text>
    </svg>
  `;
  return Buffer.from(svg);
}

/**
 * Ensures output directory exists
 */
async function ensureOutputDirectory(pathname: string): Promise<void> {
  await fs.mkdir(dirname(pathname), { recursive: true });
}

/**
 * Apply ImageShield protection to a file using streaming pipeline
 * 
 * @param options - Configuration for image protection
 * @returns Promise that resolves when protection is complete
 * @throws Error if transformation fails
 */
export async function applyImageShieldToFile(options: ApplyImageShieldOptions): Promise<void> {
  const {
    sourcePath,
    destinationPath,
    preset,
    addWatermark = false,
    watermarkSeed = crypto.randomUUID(),
    cleanupSource = true,
  } = options;

  // Get original image metadata
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width ?? 1920;
  const height = metadata.height ?? 1080;
  const resizeWidth = Math.round(width * (preset.resize / 100));
  const resizeHeight = Math.round(height * (preset.resize / 100));

  // Create transformation pipeline
  const transformer = sharp()
    .blur(preset.blur)
    .resize(resizeWidth, resizeHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: preset.quality,
      progressive: true,
    });

  // Apply noise if configured
  if (preset.noise > 0) {
    const noiseFactor = preset.noise / 100;
    transformer.modulate({
      brightness: 1 + (Math.random() - 0.5) * noiseFactor,
      saturation: 1 + (Math.random() - 0.5) * (noiseFactor / 2),
    });
  }

  // Add watermark if requested
  if (addWatermark) {
    const watermark = createWatermarkSvg(`${watermarkSeed}-${Date.now()}`);
    transformer.composite([
      {
        input: watermark,
        gravity: 'southeast',
      },
    ]);
  }

  // Ensure output directory exists
  await ensureOutputDirectory(destinationPath);

  // Create streaming pipeline
  const sourceStream = createReadStream(sourcePath);
  const outputStream = createWriteStream(destinationPath);

  try {
    await pipeline(sourceStream, transformer, outputStream);
  } catch (error) {
    // Clean up failed output
    await fs.unlink(destinationPath).catch(() => {
      // Ignore cleanup failures; downstream error handling will report the failure.
    });
    throw error;
  } finally {
    // Clean up source if requested
    if (cleanupSource) {
      await fs.unlink(sourcePath).catch(() => {
        // Source file may have already been removed; ignore cleanup errors.
      });
    }
  }
}
