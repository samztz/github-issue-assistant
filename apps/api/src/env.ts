/**
 * @fileoverview Environment variable management
 * @description Centralized environment variable access for the application
 */

import type { Env } from './core/types';

/** Current environment state */
let currentEnv: Env;

/**
 * Initialize environment variables for the current request
 * @param env - Environment variables from Cloudflare Workers runtime
 */
export function setEnv(env: Env): void {
  currentEnv = env;
}

/**
 * Get current environment variables
 * @returns Current environment configuration
 * @throws Error if environment not initialized
 */
export function getEnv(): Env {
  if (!currentEnv) {
    throw new Error("Environment has not been initialized yet.");
  }
  return currentEnv;
}