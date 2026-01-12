import { ApiEndpoint } from "@astik/logic";
import { supabase } from "./supabase";

// API base URLs
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

/**
 * Get the current user's JWT token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: ApiEndpoint,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();

    const headers: HeadersInit_ = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error:
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Network error";
    return { data: null, error: errorMessage };
  }
}

/**
 * GET request with authentication
 */
export async function apiGet<T>(
  endpoint: ApiEndpoint
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

/**
 * POST request with authentication
 */
export async function apiPost<T>(
  endpoint: ApiEndpoint,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * API configuration
 */
export const apiConfig = {
  baseUrl: API_BASE_URL,
};
