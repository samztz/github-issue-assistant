/**
 * @fileoverview Main entry point for GitHub Issue Assistant API
 * @description Cloudflare Workers entry point with routing and CORS handling
 */

import { createYoga, createSchema } from "graphql-yoga";
import { setEnv } from "./env";
import { typeDefs, resolvers } from "./graphql/schema";
import { buildCorsHeaders, applyCors, createOptionsResponse } from "./core/cors";
import { json, badRequest, internalError, notFound } from "./core/http";
import { runAgent } from "./agent/runAgent";
import {
  http_github_list_issues,
  http_github_create_issue,
  http_github_add_labels,
  http_github_triage,
  http_github_auto_triage_and_create,
} from "./mcp/handlers";
import { ApiError, type Env } from "./core/types";

// Initialize GraphQL server
const yoga = createYoga<{ env: Env }>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/graphql",
  landingPage: true,
});

/**
 * Route MCP HTTP requests to appropriate handlers
 * @param pathname - Request pathname
 * @param payload - Request payload
 * @param env - Environment variables
 * @returns Handler result
 * @throws ApiError if route not found
 */
async function routeMcpRequest(
  pathname: string, 
  payload: any, 
  env: Env
): Promise<unknown> {
  switch (pathname) {
    case "/mcp/github_list_issues":
      return await http_github_list_issues(env, payload);
    case "/mcp/github_create_issue":
      return await http_github_create_issue(env, payload);
    case "/mcp/github_add_labels":
      return await http_github_add_labels(env, payload);
    case "/mcp/github_triage":
      return await http_github_triage(env, payload);
    case "/mcp/github_auto_triage_and_create":
      return await http_github_auto_triage_and_create(env, payload);
    default:
      throw new ApiError("MCP endpoint not found", 404);
  }
}

/**
 * Handle agent requests
 * @param request - HTTP request
 * @param env - Environment variables
 * @returns Agent execution result
 * @throws ApiError if input invalid
 */
async function handleAgentRequest(request: Request, env: Env): Promise<unknown> {
  const { input } = await request.json();
  
  if (!input || typeof input !== "string") {
    throw new ApiError("input (string) required", 400);
  }
  
  return await runAgent(input, env, request);
}

/**
 * Main Cloudflare Workers fetch handler
 * @param request - HTTP request
 * @param env - Environment variables
 * @param ctx - Execution context
 * @returns HTTP response
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize environment for this request
    setEnv(env);

    // Build CORS headers
    const corsHeaders = buildCorsHeaders(env, request);

    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return createOptionsResponse(corsHeaders);
    }

    const url = new URL(request.url);

    try {
      // Route: /agent/run
      if (request.method === "POST" && url.pathname === "/agent/run") {
        const result = await handleAgentRequest(request, env);
        return applyCors(json(result), corsHeaders);
      }

      // Route: /mcp/*
      if (request.method === "POST" && url.pathname.startsWith("/mcp/")) {
        const payload = await request.json().catch(() => ({}));
        const result = await routeMcpRequest(url.pathname, payload, env);
        return applyCors(json(result), corsHeaders);
      }

      // Route: GraphQL (all other requests)
      const graphqlResponse = await yoga.fetch(request, { env }, ctx);
      return applyCors(graphqlResponse, corsHeaders);

    } catch (error) {
      console.error("Request handling error:", error);
      
      // Handle known API errors
      if (error instanceof ApiError) {
        const response = error.status >= 400 && error.status < 500 
          ? badRequest(error.message)
          : internalError(error.message);
        return applyCors(response, corsHeaders);
      }

      // Handle unknown errors
      const response = internalError("Internal server error");
      return applyCors(response, corsHeaders);
    }
  },
};