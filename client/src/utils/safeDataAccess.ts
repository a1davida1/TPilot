// Comprehensive safe data access utilities for robustness across the app

// Safe number formatting with fallbacks
export const safeNumber = (value: unknown, fallback: number = 0): number => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Safe division to prevent division by zero
export const safeDivide = (numerator: number, denominator: number, fallback: number = 0): number => {
  return denominator === 0 ? fallback : numerator / denominator;
};

// Safe array access
export const safeArrayAccess = <T>(array: T[] | undefined | null, index: number, fallback: T): T => {
  return Array.isArray(array) && array.length > index && index >= 0 ? array[index] : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Safe object property access
export const safeGet = <T>(obj: unknown, path: string, fallback: T): T => {
  if (!obj) return fallback;
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (!isRecord(current) || !(key in current)) {
      return fallback;
    }
    const record = current as Record<string, unknown>;
    current = record[key];
  }
  
  return current === null || current === undefined ? fallback : current as T;
};

// Safe string conversion with fallback
export const safeString = (value: unknown, fallback: string = ''): string => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

// Safe array validation
export const safeArray = <T>(value: unknown, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? value : fallback;
};

// Safe object validation
export const safeObject = <T>(value: unknown, fallback: T): T => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback;
};

// Safe percentage formatting
export const safePercentage = (value: unknown, fallback: number = 0): string => {
  const num = safeNumber(value, fallback);
  return `${num.toFixed(1)}%`;
};

// Safe locale string formatting for numbers
export const safeLocaleString = (value: unknown, fallback: number = 0): string => {
  const num = safeNumber(value, fallback);
  return num.toLocaleString();
};