#!/usr/bin/env tsx
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';

interface ValidationResult {
  readonly issues: string[];
}

interface AssetReference {
  readonly filePath: string;
  readonly sourcePath: string;
  readonly type: 'script' | 'style';
}

const DEFAULT_TARGET = path.resolve(process.cwd(), 'dist', 'client');

const targetDir = path.resolve(process.cwd(), process.argv[2] ?? DEFAULT_TARGET);

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readIndexHtml(directory: string): Promise<string> {
  const indexPath = path.join(directory, 'index.html');
  if (!(await pathExists(indexPath))) {
    throw new Error(`Missing client bundle entry: ${indexPath}`);
  }
  const contents = await fs.readFile(indexPath, 'utf8');
  if (contents.trim().length === 0) {
    throw new Error('Client index.html is empty');
  }
  if (contents.includes('/src/main.tsx')) {
    throw new Error('Client index.html references development entry /src/main.tsx');
  }
  return contents;
}

function collectAssets(html: string): AssetReference[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const assets: AssetReference[] = [];
  const scriptElements = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'));
  for (const element of scriptElements) {
    const src = element.getAttribute('src');
    if (!src) {
      continue;
    }
    if (src.startsWith('/src/')) {
      throw new Error(`Client bundle script references source asset: ${src}`);
    }
    if (!src.includes('/assets/')) {
      continue;
    }
    const normalized = normalizeAssetPath(src);
    assets.push({
      filePath: normalized,
      sourcePath: src,
      type: 'script',
    });
  }

  const styleElements = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  for (const element of styleElements) {
    const href = element.getAttribute('href');
    if (!href) {
      continue;
    }
    if (!href.includes('/assets/')) {
      continue;
    }
    const normalized = normalizeAssetPath(href);
    assets.push({
      filePath: normalized,
      sourcePath: href,
      type: 'style',
    });
  }

  if (assets.length === 0) {
    throw new Error('No compiled assets referenced from index.html');
  }

  return assets;
}

function normalizeAssetPath(assetRef: string): string {
  const trimmed = assetRef.startsWith('/') ? assetRef.slice(1) : assetRef;
  return trimmed.replace(/\?.*$/, '');
}

async function validateAsset(directory: string, asset: AssetReference): Promise<string | null> {
  const resolvedPath = path.join(directory, asset.filePath);
  if (!(await pathExists(resolvedPath))) {
    return `Referenced ${asset.type} asset missing on disk: ${asset.sourcePath}`;
  }
  const stats = await fs.stat(resolvedPath);
  if (!stats.isFile()) {
    return `Referenced ${asset.type} asset is not a file: ${asset.sourcePath}`;
  }
  if (stats.size === 0) {
    return `Referenced ${asset.type} asset is empty: ${asset.sourcePath}`;
  }
  if (!/assets\/.+\.[cm]?js$|assets\/.+\.css$/u.test(asset.filePath)) {
    return `Unexpected asset path format: ${asset.sourcePath}`;
  }
  return null;
}

async function ensureGzipArtifacts(directory: string, assets: AssetReference[]): Promise<string[]> {
  const issues: string[] = [];
  for (const asset of assets) {
    const gzipPath = `${path.join(directory, asset.filePath)}.gz`;
    if (!(await pathExists(gzipPath))) {
      issues.push(`Missing precompressed .gz asset for ${asset.sourcePath}`);
      continue;
    }
    const stats = await fs.stat(gzipPath);
    if (!stats.isFile() || stats.size === 0) {
      issues.push(`Invalid precompressed .gz asset for ${asset.sourcePath}`);
    }
  }
  return issues;
}

async function validateBundle(): Promise<ValidationResult> {
  const issues: string[] = [];
  if (!(await pathExists(targetDir))) {
    issues.push(`Client bundle directory not found: ${targetDir}`);
    return { issues };
  }

  try {
    const html = await readIndexHtml(targetDir);
    if (!html.includes('id="root"')) {
      issues.push('Client index.html missing root mount point');
    }
    const assets = collectAssets(html);
    const assetIssues = await Promise.all(
      assets.map(async (asset) => validateAsset(targetDir, asset))
    );
    for (const issue of assetIssues) {
      if (issue) {
        issues.push(issue);
      }
    }

    const gzipIssues = await ensureGzipArtifacts(targetDir, assets);
    issues.push(...gzipIssues);
  } catch (error: unknown) {
    issues.push(error instanceof Error ? error.message : 'Unknown validation error');
  }

  return { issues };
}

void validateBundle()
  .then((result) => {
    if (result.issues.length > 0) {
      console.error('❌ Client bundle validation failed:');
      for (const issue of result.issues) {
        console.error(`  - ${issue}`);
      }
      process.exit(1);
    }
    console.log('✅ Client bundle validated successfully.');
  })
  .catch((error: unknown) => {
    console.error('❌ Unexpected validation failure:', error);
    process.exit(1);
  });
