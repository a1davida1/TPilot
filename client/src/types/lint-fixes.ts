// client/src/types/lint-fixes.ts
// This file provides proper types to replace 'any'

export type AnyObject = Record<string, unknown>;
export type AnyArray = unknown[];
export type AnyFunction = (...args: unknown[]) => unknown;
export type ErrorWithMessage = { message: string; stack?: string };

// Common API response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

// Event handler types
export type FormEvent = React.FormEvent<HTMLFormElement>;
export type ChangeEvent = React.ChangeEvent<HTMLInputElement>;
export type ClickEvent = React.MouseEvent<HTMLButtonElement>;

// Replace common any patterns
export type TodoAny = unknown; // Temporary type for gradual migration