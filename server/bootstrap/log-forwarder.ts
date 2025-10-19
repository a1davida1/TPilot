import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { setTimeout as delay } from 'timers/promises';
import { createHash } from 'crypto';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { Logger } from 'winston';
import type TransportStream from 'winston-transport';
import { S3Client, HeadBucketCommand, PutObjectCommand, type StorageClass } from '@aws-sdk/client-s3';
import { Storage, type PredefinedAcl } from '@google-cloud/storage';
import { Counter, Gauge, register } from 'prom-client';
import { createReadStream } from 'fs';

type RemoteProvider = 's3' | 'gcs';

export interface RemoteLogForwarderConfig {
  provider: RemoteProvider;
  bucket: string;
  prefix?: string;
  kmsKeyId?: string;
  storageClass?: StorageClass | string;
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

interface UploadMetadata {
  category: string;
  level: string;
  rotatedAt?: Date;
  dryRun?: boolean;
}

interface RemoteLogForwarderDependencies {
  wait?: (ms: number) => Promise<void>;
  s3Client?: { send(command: unknown): Promise<unknown> };
  storage?: { bucket(name: string): GoogleBucketLike };
}

interface GoogleBucketLike {
  upload(path: string, options: {
    destination: string;
    kmsKeyName?: string;
    metadata: Record<string, string>;
    predefinedAcl?: PredefinedAcl;
    storageClass?: string;
  }): Promise<[unknown, unknown]>;
  exists(): Promise<[boolean]>;
}

interface BuildKeyParams {
  prefix?: string;
  category: string;
  level: string;
  rotatedAt: Date;
  fileName: string;
  dryRun?: boolean;
}

interface QueueUploadOptions {
  remoteKeyOverride?: string;
}

const ATTACHED_SYMBOL = Symbol('remoteLogForwarderAttached');

function getOrCreateCounter(name: string, help: string, labelNames: string[]): Counter<string> {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as Counter<string>;
  }

  const metric = new Counter({ name, help, labelNames });
  register.registerMetric(metric);
  return metric;
}

function getOrCreateGauge(name: string, help: string, labelNames: string[]): Gauge<string> {
  const existing = register.getSingleMetric(name);
  if (existing) {
    return existing as Gauge<string>;
  }

  const metric = new Gauge({ name, help, labelNames });
  register.registerMetric(metric);
  return metric;
}

const forwarderSuccessCounter = getOrCreateCounter(
  'log_forwarder_success_total',
  'Number of remote log uploads that completed successfully',
  ['provider', 'category']
);

const forwarderFailureCounter = getOrCreateCounter(
  'log_forwarder_failures_total',
  'Number of remote log uploads that failed after retries',
  ['provider', 'category']
);

const forwarderRetryCounter = getOrCreateCounter(
  'log_forwarder_retries_total',
  'Number of remote log upload retries attempted',
  ['provider', 'category']
);

const forwarderQueueGauge = getOrCreateGauge(
  'log_forwarder_queue_size',
  'Current number of remote log upload tasks pending',
  ['provider']
);

function sanitizeSegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/gi, '-')
    .replace(/-{2,}/g, '-');
}

export function buildRemoteObjectKey(params: BuildKeyParams): string {
  const segments: string[] = [];
  if (params.prefix) {
    const prefixSegments = params.prefix
      .split('/')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => sanitizeSegment(part));
    segments.push(...prefixSegments);
  }

  const categorySegment = sanitizeSegment(params.category || 'logs');
  const levelSegment = sanitizeSegment(params.level || 'info');
  const rotatedAt = params.rotatedAt;
  const year = rotatedAt.getUTCFullYear().toString();
  const month = String(rotatedAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(rotatedAt.getUTCDate()).padStart(2, '0');

  if (params.dryRun) {
    segments.push('_dry-run');
  } else {
    segments.push(categorySegment, levelSegment);
  }

  segments.push(year, month, day, params.fileName);

  return segments.join('/');
}

function resolveContentType(fileName: string): string {
  if (fileName.endsWith('.gz')) {
    return 'application/gzip';
  }
  if (fileName.endsWith('.json')) {
    return 'application/json';
  }
  return 'text/plain; charset=utf-8';
}

function calculateChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', chunk => {
      hash.update(chunk as Buffer);
    });

    stream.on('error', error => {
      reject(error);
    });

    stream.on('end', () => {
      resolve(hash.digest('base64'));
    });
  });
}

export class RemoteLogForwarder {
  private readonly hostname = os.hostname();
  private readonly wait: (ms: number) => Promise<void>;
  private readonly s3Client?: { send(command: unknown): Promise<unknown> };
  private readonly storage?: { bucket(name: string): GoogleBucketLike };
  private queue = Promise.resolve();
  private pendingUploads = 0;

  constructor(
    private readonly logger: Logger,
    private readonly config: RemoteLogForwarderConfig,
    dependencies: RemoteLogForwarderDependencies = {}
  ) {
    this.wait = dependencies.wait ?? delay;

    if (config.provider === 's3') {
      this.s3Client = dependencies.s3Client ?? new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
      });
    } else {
      this.storage = dependencies.storage ?? new Storage();
    }

    forwarderQueueGauge.labels(config.provider).set(0);
  }

  attachToTransport(transport: TransportStream, context: { category: string; level: string }): void {
    if (!(transport instanceof DailyRotateFile)) {
      return;
    }

    const attached = (transport as DailyRotateFile & { [ATTACHED_SYMBOL]?: boolean })[ATTACHED_SYMBOL];
    if (attached) {
      return;
    }

    const metadata = { category: context.category, level: context.level };
    const rotationListener = (oldFilename: string) => {
      this.queueUpload(oldFilename, metadata);
    };

    const archiveListener = (zippedFilename: string) => {
      this.queueUpload(zippedFilename, metadata);
    };

    const rotateFile = transport as DailyRotateFile & { options?: DailyRotateFile.DailyRotateFileTransportOptions };
    if (rotateFile.options?.zippedArchive) {
      transport.on('archive', archiveListener);
    } else {
      transport.on('rotate', rotationListener);
    }

    (transport as DailyRotateFile & { [ATTACHED_SYMBOL]?: boolean })[ATTACHED_SYMBOL] = true;
  }

  queueUpload(filePath: string, metadata: UploadMetadata, options?: QueueUploadOptions): void {
    const enrichedMetadata: UploadMetadata = {
      ...metadata,
      rotatedAt: metadata.rotatedAt ?? new Date(),
    };
    const task = async () => {
      await this.uploadWithRetry(filePath, enrichedMetadata, options);
    };

    this.pendingUploads += 1;
    forwarderQueueGauge.labels(this.config.provider).set(this.pendingUploads);
    this.queue = this.queue
      .then(task)
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error('Remote log forwarder queue failure', {
          error: message,
          filePath,
          provider: this.config.provider,
          alert: 'log_forwarder_queue_failure',
          metrics: true,
        });
      })
      .finally(() => {
        this.pendingUploads = Math.max(0, this.pendingUploads - 1);
        forwarderQueueGauge.labels(this.config.provider).set(this.pendingUploads);
      });
  }

  async verifyConnectivity(): Promise<void> {
    if (this.config.provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client unavailable for connectivity check');
      }
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return;
    }

    if (!this.storage) {
      throw new Error('GCS storage unavailable for connectivity check');
    }

    const [exists] = await this.storage.bucket(this.config.bucket).exists();
    if (!exists) {
      throw new Error(`GCS bucket ${this.config.bucket} is not accessible`);
    }
  }

  async performDryRunUpload(): Promise<string | null> {
    const tempFileName = `log-forwarder-dry-run-${Date.now()}-${randomUUID()}.json`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    await fs.writeFile(tempFilePath, JSON.stringify({ createdAt: new Date().toISOString() }));

    try {
      const remoteKey = buildRemoteObjectKey({
        prefix: this.config.prefix,
        category: 'diagnostic',
        level: 'info',
        rotatedAt: new Date(),
        fileName: tempFileName,
        dryRun: true,
      });
      await this.uploadWithRetry(
        tempFilePath,
        { category: 'diagnostic', level: 'info', dryRun: true, rotatedAt: new Date() },
        { remoteKeyOverride: remoteKey }
      );
      return remoteKey;
    } finally {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }

  private async uploadWithRetry(filePath: string, metadata: UploadMetadata, options?: QueueUploadOptions): Promise<void> {
    try {
      await fs.access(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn('Remote log file missing; skipping upload', {
        filePath,
        error: message,
        provider: this.config.provider,
      });
      return;
    }

    const stats = await fs.stat(filePath);
    const fileName = path.basename(filePath);
    const rotatedAt = metadata.rotatedAt ?? stats.mtime;
    const remoteKey = options?.remoteKeyOverride ?? buildRemoteObjectKey({
      prefix: this.config.prefix,
      category: metadata.category,
      level: metadata.level,
      rotatedAt,
      fileName,
      dryRun: metadata.dryRun,
    });

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        await this.uploadFile(filePath, remoteKey, stats.size, metadata, rotatedAt);
        forwarderSuccessCounter.labels(this.config.provider, metadata.category).inc();
        if (attempt > 1) {
          this.logger.info('Remote log upload completed after retries', {
            provider: this.config.provider,
            category: metadata.category,
            filePath,
            remoteKey,
            attempts: attempt,
          });
        }
        return;
      } catch (error) {
        forwarderRetryCounter.labels(this.config.provider, metadata.category).inc();
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (attempt >= this.config.maxRetries) {
          forwarderFailureCounter.labels(this.config.provider, metadata.category).inc();
          this.logger.error('Remote log upload failed after retries', {
            error: message,
            attempts: attempt,
            provider: this.config.provider,
            category: metadata.category,
            filePath,
            remoteKey,
            alert: 'log_forwarder_failure',
            metrics: true,
          });
          return;
        }

        const waitTime = Math.min(
          this.config.maxBackoffMs,
          this.config.baseBackoffMs * 2 ** (attempt - 1),
        );
        this.logger.warn('Retrying remote log upload', {
          provider: this.config.provider,
          category: metadata.category,
          attempt,
          waitTime,
          filePath,
        });
        await this.wait(waitTime);
      }
    }
  }

  private async uploadFile(
    filePath: string,
    remoteKey: string,
    size: number,
    metadata: UploadMetadata,
    rotatedAt: Date
  ): Promise<void> {
    const metaHeaders: Record<string, string> = {
      'log-level': metadata.level,
      'log-category': metadata.category,
      'rotated-at': rotatedAt.toISOString(),
      'dry-run': metadata.dryRun ? 'true' : 'false',
      'source-host': this.hostname,
    };

    if (this.config.provider === 's3') {
      if (!this.s3Client) {
        throw new Error('S3 client is not initialised');
      }

      const checksum = await calculateChecksum(filePath);
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: remoteKey,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: resolveContentType(remoteKey),
        ServerSideEncryption: this.config.kmsKeyId ? 'aws:kms' : 'AES256',
        SSEKMSKeyId: this.config.kmsKeyId,
        StorageClass: this.config.storageClass as StorageClass | undefined,
        Metadata: metaHeaders,
        ChecksumSHA256: checksum,
      });
      await this.s3Client.send(command);
      return;
    }

    if (!this.storage) {
      throw new Error('GCS client is not initialised');
    }

    const bucket = this.storage.bucket(this.config.bucket);
    await bucket.upload(filePath, {
      destination: remoteKey,
      kmsKeyName: this.config.kmsKeyId,
      metadata: metaHeaders,
      storageClass: this.config.storageClass,
      predefinedAcl: 'projectPrivate' as PredefinedAcl,
    });
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const optionalString = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function createRemoteLogForwarder(logger: Logger): RemoteLogForwarder | null {
  const provider = (process.env.LOG_ARCHIVE_PROVIDER || '').toLowerCase();
  if (!provider) {
    return null;
  }

  if (provider !== 's3' && provider !== 'gcs') {
    logger.warn('Remote log forwarding disabled: unsupported provider', { provider });
    return null;
  }

  const bucket = process.env.LOG_ARCHIVE_BUCKET;
  if (!bucket) {
    logger.warn('Remote log forwarding disabled: LOG_ARCHIVE_BUCKET is not set');
    return null;
  }

  const config: RemoteLogForwarderConfig = {
    provider,
    bucket,
    prefix: optionalString(process.env.LOG_ARCHIVE_PREFIX),
    kmsKeyId: optionalString(process.env.LOG_ARCHIVE_KMS_KEY),
    storageClass: optionalString(process.env.LOG_ARCHIVE_STORAGE_CLASS),
    maxRetries: parseInteger(process.env.LOG_ARCHIVE_MAX_RETRIES, 3),
    baseBackoffMs: parseInteger(process.env.LOG_ARCHIVE_BACKOFF_MS, 1000),
    maxBackoffMs: parseInteger(process.env.LOG_ARCHIVE_BACKOFF_MAX_MS, 15000),
    region: optionalString(process.env.AWS_REGION),
    endpoint: optionalString(process.env.LOG_ARCHIVE_S3_ENDPOINT),
    forcePathStyle: process.env.LOG_ARCHIVE_S3_FORCE_PATH_STYLE === 'true',
  };

  const forwarder = new RemoteLogForwarder(logger, config);
  logger.info('Remote log forwarder initialised', {
    provider,
    bucket,
    prefix: config.prefix,
    storageClass: config.storageClass,
    maxRetries: config.maxRetries,
  });

  return forwarder;
}

export type { UploadMetadata };
