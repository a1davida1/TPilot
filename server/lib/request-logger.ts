
import { logger } from '../bootstrap/logger.js';

const REDACTED_VALUE = '[REDACTED]';
const TRUNCATION_SUFFIX = '… (truncated)';
const LOG_LINE_SUFFIX = '…';
const SENSITIVE_KEYWORDS = ['password', 'secret', 'apikey', 'authorization', 'token'];

export const MAX_LOG_PAYLOAD_LENGTH = 1000;
const MAX_LOG_LINE_LENGTH = 1200;

function shouldRedactKey(key: string): boolean {
  const lowercase = key.toLowerCase();
  const collapsed = lowercase.replace(/[^a-z0-9]/g, '');

  return SENSITIVE_KEYWORDS.some((keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    const normalized = normalizedKeyword.replace(/[^a-z0-9]/g, '');
    return lowercase.includes(normalizedKeyword) || collapsed.includes(normalized);
  });
}

function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const existingClone = seen.get(value as object);
  if (existingClone) {
    return existingClone as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return Buffer.from(value) as T;
  }

  if (Array.isArray(value)) {
    const clonedArray: unknown[] = [];
    seen.set(value, clonedArray);
    for (const item of value) {
      clonedArray.push(deepClone(item, seen));
    }
    return clonedArray as T;
  }

  if (value instanceof Map) {
    const clonedMap = new Map<unknown, unknown>();
    seen.set(value, clonedMap);
    for (const [mapKey, mapValue] of value.entries()) {
      clonedMap.set(mapKey, deepClone(mapValue, seen));
    }
    return clonedMap as T;
  }

  if (value instanceof Set) {
    const clonedSet = new Set<unknown>();
    seen.set(value, clonedSet);
    for (const setValue of value.values()) {
      clonedSet.add(deepClone(setValue, seen));
    }
    return clonedSet as T;
  }

  const clonedObject: Record<string, unknown> = {};
  seen.set(value as object, clonedObject);
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    clonedObject[entryKey] = deepClone(entryValue, seen);
  }

  return clonedObject as T;
}

function redactSensitiveValues(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if (seen.has(value as object)) {
    return value;
  }

  seen.add(value as object);

  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];
    for (let index = 0; index < arrayValue.length; index += 1) {
      arrayValue[index] = redactSensitiveValues(arrayValue[index], seen);
    }
    return arrayValue;
  }

  if (value instanceof Map) {
    for (const [mapKey, mapValue] of value.entries()) {
      if (typeof mapKey === 'string' && shouldRedactKey(mapKey)) {
        value.set(mapKey, REDACTED_VALUE);
      } else {
        value.set(mapKey, redactSensitiveValues(mapValue, seen));
      }
    }
    return value;
  }

  const objectValue = value as Record<string, unknown>;
  for (const [entryKey, entryValue] of Object.entries(objectValue)) {
    if (shouldRedactKey(entryKey)) {
      objectValue[entryKey] = REDACTED_VALUE;
    } else {
      objectValue[entryKey] = redactSensitiveValues(entryValue, seen);
    }
  }

  return objectValue;
}

function truncatePayload(serialized: string): string {
  if (serialized.length <= MAX_LOG_PAYLOAD_LENGTH) {
    return serialized;
  }

  const keepLength = Math.max(0, MAX_LOG_PAYLOAD_LENGTH - TRUNCATION_SUFFIX.length);
  return `${serialized.slice(0, keepLength)}${TRUNCATION_SUFFIX}`;
}

export function truncateLogLine(logLine: string): string {
  if (logLine.length <= MAX_LOG_LINE_LENGTH) {
    return logLine;
  }

  const keepLength = Math.max(0, MAX_LOG_LINE_LENGTH - LOG_LINE_SUFFIX.length);
  return `${logLine.slice(0, keepLength)}${LOG_LINE_SUFFIX}`;
}

function safeSerialize(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    logger.debug('Failed to serialize response payload for logging', { error });
    return undefined;
  }
}

export function prepareResponseLogPayload(response: unknown): string | undefined {
  if (typeof response === 'undefined') {
    return undefined;
  }

  const cloned = deepClone(response);
  const redacted = redactSensitiveValues(cloned);
  const serialized = safeSerialize(redacted);

  if (!serialized) {
    return undefined;
  }

  return truncatePayload(serialized);
}
