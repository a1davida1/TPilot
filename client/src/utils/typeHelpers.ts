export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  return isError(error) ? error.message : String(error);
}

export function assertDefined<T>(
  value: T | undefined | null,
  message = 'Value is undefined or null'
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
}