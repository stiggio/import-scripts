import { BASE_URL, X_API_KEY } from './arguments.js';

export async function sendGraphQLRequest<T>(body: string): Promise<T> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': X_API_KEY,
    },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
  }

  return response.json() as Promise<T>;
}
