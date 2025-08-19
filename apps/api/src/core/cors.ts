/**
 * @fileoverview CORS (Cross-Origin Resource Sharing) utilities
 * @description Functions for handling CORS headers and preflight requests
 */

import type { Env } from './types';

/**
 * Build CORS headers based on origin string
 * @param origin - Origin string to allow
 * @returns CORS headers object
 */
export function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Determine allowed origin based on environment and request
 * @param env - Environment variables
 * @param request - Incoming request
 * @returns Allowed origin string
 */
export function determineOrigin(env: Env, request: Request): string {
  // Priority: 1. Configured FRONTEND_ORIGIN, 2. Request Origin, 3. Wildcard
  return env.FRONTEND_ORIGIN || request.headers.get("Origin") || "*";
}

/**
 * Apply CORS headers to a response
 * @param response - Response to modify
 * @param corsHeaders - CORS headers to apply
 * @returns Modified response with CORS headers
 */
export function applyCors(response: Response, corsHeaders: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create OPTIONS preflight response
 * @param corsHeaders - CORS headers to include
 * @returns OPTIONS response
 */
export function createOptionsResponse(corsHeaders: Record<string, string>): Response {
  return new Response(null, { 
    status: 204, 
    headers: corsHeaders 
  });
}