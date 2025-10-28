import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

import { applyImageShieldToFile, protectionPresets } from '../../server/images/imageShield';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSampleImage(filePath: string): Promise<void> {
  await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 120, g: 60, b: 180 },
    },
  })
    .png()
    .toFile(filePath);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('applyImageShieldToFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('imageshield-test-');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  test('streams protected output and removes source when cleanup is enabled', async () => {
    const sourcePath = path.join(tempDir, 'source.png');
    const destinationPath = path.join(tempDir, 'protected.jpg');
    await createSampleImage(sourcePath);

    await applyImageShieldToFile({
      sourcePath,
      destinationPath,
      preset: protectionPresets.standard,
      addWatermark: false,
      cleanupSource: true,
    });

    expect(await fileExists(destinationPath)).toBe(true);
    expect(await fileExists(sourcePath)).toBe(false);
  });

  test('applies watermark overlay when requested', async () => {
    const basePreset = { ...protectionPresets.light, noise: 0 };

    const noWatermarkSource = path.join(tempDir, 'plain.png');
    const withWatermarkSource = path.join(tempDir, 'watermark.png');
    const plainOutput = path.join(tempDir, 'plain-protected.jpg');
    const watermarkOutput = path.join(tempDir, 'watermark-protected.jpg');

    await createSampleImage(noWatermarkSource);
    await fs.copyFile(noWatermarkSource, withWatermarkSource);

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      await applyImageShieldToFile({
        sourcePath: noWatermarkSource,
        destinationPath: plainOutput,
        preset: basePreset,
        addWatermark: false,
        cleanupSource: true,
      });

      await applyImageShieldToFile({
        sourcePath: withWatermarkSource,
        destinationPath: watermarkOutput,
        preset: basePreset,
        addWatermark: true,
        cleanupSource: true,
        watermarkSeed: 'test-user',
      });
    } finally {
      randomSpy.mockRestore();
    }

    const plainBuffer = await fs.readFile(plainOutput);
    const watermarkedBuffer = await fs.readFile(watermarkOutput);

    expect(plainBuffer.equals(watermarkedBuffer)).toBe(false);
  });
});
