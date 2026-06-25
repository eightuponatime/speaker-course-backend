const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const apiBaseUrl = configuredApiBaseUrl === undefined ? "http://localhost:8080" : configuredApiBaseUrl.trim();

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    credentials: "include",
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
