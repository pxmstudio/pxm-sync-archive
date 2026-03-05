const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787/api";
const STUDIO_API_URL = process.env.NEXT_PUBLIC_STUDIO_API_URL || "http://localhost:8787/api";

// This app operates in retailer role
const ACTIVE_ROLE = "retailer" as const;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Active-Role": ACTIVE_ROLE,
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "An error occurred",
      response.status
    );
  }

  return data.data as T;
}

export async function studioApiClient<T>(
  endpoint: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const response = await fetch(`${STUDIO_API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.code || "UNKNOWN_ERROR",
      data.error?.message || "An error occurred",
      response.status
    );
  }

  return data.data as T;
}
