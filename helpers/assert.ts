/**
 * Assertion utilities for safer refactors and eliminating non-null assertions
 */

export function assertExists<T>(v: T | null | undefined, msg = 'Expected value'): asserts v is T {
  if (v == null) throw new Error(msg);
}

export function assertIsString(v: unknown, msg = 'Expected string'): asserts v is string {
  if (typeof v !== 'string') throw new Error(msg);
}

export function assertIsNumber(v: unknown, msg = 'Expected number'): asserts v is number {
  if (typeof v !== 'number') throw new Error(msg);
}

export function assertIsObject(v: unknown, msg = 'Expected object'): asserts v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(msg);
}

export function assertIsArray(v: unknown, msg = 'Expected array'): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new Error(msg);
}