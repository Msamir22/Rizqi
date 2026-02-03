/**
 * API Contracts
 * Type-safe mapping between endpoints and their request/response types
 *
 * This file defines the contract for each API endpoint including:
 * - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * - Response type (what the API returns)
 * - Request body type (for POST/PUT/PATCH endpoints)
 * - Query parameters type (for GET endpoints)
 * - Path parameters type (for endpoints with :param placeholders)
 */

import { NetWorthComparison } from "../types";

// =============================================================================
// Endpoints
// =============================================================================

export const ApiEndpoints = {
  // Net worth
  netWorthComparison: "/api/net-worth/comparison",

  // Mock endpoints (development)
  mockRates: "/api/mock/rates",
} as const;

export type ApiEndpoint = (typeof ApiEndpoints)[keyof typeof ApiEndpoints];

// =============================================================================
// HTTP Method Types
// =============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// =============================================================================
// Response Types
// =============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiSuccessResponse<T> {
  status: "success";
  data: T;
}

// =============================================================================
// Method-Specific Contract Types (Discriminated Unions)
// =============================================================================

/**
 * Path params constraint type
 */
type PathParamsConstraint = Record<string, string | number> | never;

/**
 * Base properties shared by all endpoint contracts
 */
interface BaseContract<
  TResponse,
  TPathParams extends PathParamsConstraint = never,
> {
  response: TResponse;
  pathParams?: TPathParams;
}

/**
 * Query params constraint type
 */
type QueryParamsConstraint = Record<string, string | number | boolean> | never;

/**
 * GET endpoint contract
 */
interface GetContract<
  TResponse,
  TQueryParams extends QueryParamsConstraint = never,
  TPathParams extends PathParamsConstraint = never,
> extends BaseContract<TResponse, TPathParams> {
  method: "GET";
  queryParams: TQueryParams;
}

/**
 * POST endpoint contract
 */
interface PostContract<
  TResponse,
  TBody,
  TPathParams extends PathParamsConstraint = never,
> extends BaseContract<TResponse, TPathParams> {
  method: "POST";
  body: TBody;
}

/**
 * PUT endpoint contract
 */
interface PutContract<
  TResponse,
  TBody,
  TPathParams extends PathParamsConstraint = never,
> extends BaseContract<TResponse, TPathParams> {
  method: "PUT";
  body: TBody;
}

/**
 * PATCH endpoint contract
 */
interface PatchContract<
  TResponse,
  TBody,
  TPathParams extends PathParamsConstraint = never,
> extends BaseContract<TResponse, TPathParams> {
  method: "PATCH";
  body: TBody;
}

/**
 * DELETE endpoint contract
 */
interface DeleteContract<
  TResponse,
  TPathParams extends PathParamsConstraint = never,
> extends BaseContract<TResponse, TPathParams> {
  method: "DELETE";
}

// =============================================================================
// API Contract Definition
// =============================================================================

/**
 * Defines the contract for each endpoint using strict method-specific types
 */
export interface ApiContract {
  // Net worth - GET endpoints
  [ApiEndpoints.netWorthComparison]: GetContract<
    NetWorthComparison | null,
    { date: string }
  >;
}

// =============================================================================
// Helper Types - Extract contract properties
// =============================================================================

/**
 * All endpoint paths
 */
export type ApiEndpointPath = keyof ApiContract;

/**
 * Extract the HTTP method for a given endpoint
 */
export type ApiMethodType<E extends ApiEndpointPath> = ApiContract[E]["method"];

/**
 * Extract the response type for a given endpoint
 */
export type ApiResponseType<E extends ApiEndpointPath> =
  ApiContract[E]["response"];

/**
 * Extract the query params type for a given endpoint (GET only)
 */
export type ApiQueryParamsType<E extends ApiEndpointPath> =
  ApiContract[E] extends { queryParams: infer Q } ? Q : never;

/**
 * Extract the path params type for a given endpoint
 */
export type ApiPathParamsType<E extends ApiEndpointPath> =
  ApiContract[E] extends { pathParams: infer P } ? P : never;

/**
 * Extract the request body type for a given endpoint (POST/PUT/PATCH only)
 */
export type ApiBodyType<E extends ApiEndpointPath> = ApiContract[E] extends {
  body: infer B;
}
  ? B
  : never;

// =============================================================================
// Filter endpoints by HTTP method
// =============================================================================

/**
 * All GET endpoints
 */
export type GetEndpoint = {
  [K in ApiEndpointPath]: ApiContract[K]["method"] extends "GET" ? K : never;
}[ApiEndpointPath];

export type GetOptions<E extends GetEndpoint> = {
  pathParams?: ApiPathParamsType<E> extends never
    ? undefined
    : ApiPathParamsType<E>;
  queryParams?: ApiQueryParamsType<E> extends never
    ? undefined
    : ApiQueryParamsType<E>;
};

/**
 * All POST endpoints
 */
export type PostEndpoint = {
  [K in ApiEndpointPath]: ApiContract[K]["method"] extends "POST" ? K : never;
}[ApiEndpointPath];

export type PostOptions<E extends PostEndpoint> = {
  pathParams?: ApiPathParamsType<E> extends never
    ? undefined
    : ApiPathParamsType<E>;
};

/**
 * All PUT endpoints
 */
export type PutEndpoint = {
  [K in ApiEndpointPath]: ApiContract[K]["method"] extends "PUT" ? K : never;
}[ApiEndpointPath];

export type PutOptions<E extends PutEndpoint> = {
  pathParams?: ApiPathParamsType<E> extends never
    ? undefined
    : ApiPathParamsType<E>;
};

/**
 * All PATCH endpoints
 */
export type PatchEndpoint = {
  [K in ApiEndpointPath]: ApiContract[K]["method"] extends "PATCH" ? K : never;
}[ApiEndpointPath];

export type PatchOptions<E extends PatchEndpoint> = {
  pathParams?: ApiPathParamsType<E> extends never
    ? undefined
    : ApiPathParamsType<E>;
};

/**
 * All DELETE endpoints
 */
export type DeleteEndpoint = {
  [K in ApiEndpointPath]: ApiContract[K]["method"] extends "DELETE" ? K : never;
}[ApiEndpointPath];

export type DeleteOptions<E extends DeleteEndpoint> = {
  pathParams?: ApiPathParamsType<E> extends never
    ? undefined
    : ApiPathParamsType<E>;
};

// =============================================================================
// Conditional type helpers
// =============================================================================

/**
 * Check if endpoint has query params
 */
export type HasQueryParams<E extends ApiEndpointPath> =
  ApiQueryParamsType<E> extends never ? false : true;

/**
 * Check if endpoint has path params
 */
export type HasPathParams<E extends ApiEndpointPath> =
  ApiPathParamsType<E> extends never ? false : true;

/**
 * Check if endpoint has request body
 */
export type HasBody<E extends ApiEndpointPath> =
  ApiBodyType<E> extends never ? false : true;
