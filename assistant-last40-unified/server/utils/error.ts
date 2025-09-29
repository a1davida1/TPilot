import { ZodError } from "zod";

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function formatZodError(error: ZodError, context?: string): string {
  const details = error.errors
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "request";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return context ? `${context}: ${details}` : details;
}