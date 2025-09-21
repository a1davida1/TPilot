export function serializePromptField(value: string, options?: { block?: boolean }): string {
  let sanitized = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    sanitized += code < 32 || code === 127 ? " " : value[index];
  }
  const quoted = JSON.stringify(sanitized);
  if (options?.block && quoted.length >= 2) {
    return quoted.slice(1, -1);
  }
  return quoted;
}