import {
  ApiBodyType,
  ApiResponseType,
  ApiSuccessResponse,
  DeleteEndpoint,
  DeleteOptions,
  GetEndpoint,
  GetOptions,
  PatchEndpoint,
  PatchOptions,
  PostEndpoint,
  PostOptions,
  PutEndpoint,
  PutOptions,
} from "@astik/logic";
import { supabase } from "./supabase";

import Constants from "expo-constants";

/**
 * Get the API base URL based on environment
 * - Production: Uses EXPO_PUBLIC_API_URL_PROD
 * - Development with env var: Uses EXPO_PUBLIC_API_URL_DEV
 * - Local development: Auto-detects local IP from Expo debugger host
 */
function getApiBaseUrl(): string {
  if (!__DEV__) {
    // Production build - use production URL
    return process.env.EXPO_PUBLIC_API_URL_PROD ?? "";
  }

  // Development - check if env var is set
  if (process.env.EXPO_PUBLIC_API_URL_DEV) {
    return process.env.EXPO_PUBLIC_API_URL_DEV;
  }

  // Auto-detect local IP from Expo's debugger host
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const localIp = debuggerHost.split(":")[0];
    return `http://${localIp}:3001`;
  }

  // Fallback
  return "http://localhost:3001";
}

const API_BASE_URL = getApiBaseUrl();

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
 * Replace path parameters in endpoint URL
 * Example: "/api/users/:id" with { id: "123" } => "/api/users/123"
 */
function replacePathParams(
  endpoint: string,
  pathParams?: Record<string, string | number>
): string {
  if (!pathParams) return endpoint;

  let result = endpoint;
  Object.entries(pathParams).forEach(([key, value]) => {
    result = result.replace(`:${key}`, String(value));
  });
  return result;
}

/**
 * Build URL with path params and query parameters
 */
function buildUrl(
  baseUrl: string,
  endpoint: string,
  options?: {
    pathParams?: Record<string, string | number> | never;
    queryParams?: Record<string, string | number | boolean> | never;
  }
): string {
  const pathWithParams = replacePathParams(endpoint, options?.pathParams);
  const url = new URL(`${baseUrl}${pathWithParams}`);

  if (options?.queryParams) {
    Object.entries(options.queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

/**
 * Make an authenticated API request (internal)
 */
async function request<T>(
  url: string,
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

    const response = await fetch(url, {
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

    const result = (await response.json()) as ApiSuccessResponse<T>;
    return { data: result.data, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Network error";
    return { data: null, error: errorMessage };
  }
}

/**
 * Type-safe GET request with authentication
 *
 * @example
 * // Simple GET - response type is automatically inferred
 * const { data } = await apiGet(ApiEndpoints.marketRates);
 *
 * @example
 * // GET with query params
 * const { data } = await apiGet(ApiEndpoints.netWorthComparison, {
 *   queryParams: { date: "2025-12-13" }
 * });
 *
 * @example
 * // GET with path params (when endpoint has :param)
 * const { data } = await apiGet(ApiEndpoints.userById, {
 *   pathParams: { id: "123" }
 * });
 */
export async function get<E extends GetEndpoint>(
  endpoint: E,
  options?: GetOptions<E>
): Promise<ApiResponse<ApiResponseType<E>>> {
  const url = buildUrl(API_BASE_URL, endpoint, {
    pathParams: options?.pathParams ?? undefined,
    queryParams: options?.queryParams ?? undefined,
  });
  return request<ApiResponseType<E>>(url, { method: "GET" });
}

/**
 * Type-safe POST request with authentication
 */
export async function post<E extends PostEndpoint>(
  endpoint: E,
  body: ApiBodyType<E>,
  options?: PostOptions<E>
): Promise<ApiResponse<ApiResponseType<E>>> {
  const url = buildUrl(API_BASE_URL, endpoint, {
    pathParams: options?.pathParams ?? undefined,
  });
  return request<ApiResponseType<E>>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Type-safe PUT request with authentication
 */
export async function put<E extends PutEndpoint>(
  endpoint: E,
  body: ApiBodyType<E>,
  options?: PutOptions<E>
): Promise<ApiResponse<ApiResponseType<E>>> {
  const url = buildUrl(API_BASE_URL, endpoint, {
    pathParams: options?.pathParams ?? undefined,
  });
  return request<ApiResponseType<E>>(url, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Type-safe PATCH request with authentication
 */
export async function patch<E extends PatchEndpoint>(
  endpoint: E,
  body: ApiBodyType<E>,
  options?: PatchOptions<E>
): Promise<ApiResponse<ApiResponseType<E>>> {
  const url = buildUrl(API_BASE_URL, endpoint, {
    pathParams: options?.pathParams ?? undefined,
  });
  return request<ApiResponseType<E>>(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Type-safe DELETE request with authentication
 */
export async function Delete<E extends DeleteEndpoint>(
  endpoint: E,
  options?: DeleteOptions<E>
): Promise<ApiResponse<ApiResponseType<E>>> {
  const url = buildUrl(API_BASE_URL, endpoint, {
    pathParams: options?.pathParams ?? undefined,
  });
  return request<ApiResponseType<E>>(url, { method: "DELETE" });
}
