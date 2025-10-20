export async function authenticatedRequest<T>(
  url: string,
  method: string = 'GET',
  data?: unknown
): Promise<T> {
  let body: FormData | string | undefined;
  const headers: Record<string, string> = {};

  if (data instanceof FormData) {
    body = data;
    // Don't set Content-Type for FormData, browser sets it with boundary
  } else if (data) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'include' // Include session cookies for authentication
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText || response.statusText;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return {} as T;
}
