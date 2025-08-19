/**
 * @fileoverview HTTP response utilities
 * @description Helper functions for creating standardized HTTP responses
 */

/**
 * Create a JSON response with proper headers
 * @param data - Data to serialize as JSON
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON content
 */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 400 Bad Request response
 * @param message - Error message
 * @returns Response object with error
 */
export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

/**
 * Create a 500 Internal Server Error response
 * @param message - Error message
 * @returns Response object with error
 */
export function internalError(message: string): Response {
  return json({ error: message }, 500);
}

/**
 * Create a 404 Not Found response
 * @param message - Error message (optional)
 * @returns Response object with error
 */
export function notFound(message = "Not Found"): Response {
  return json({ error: message }, 404);
}