/**
 * @fileoverview Core type definitions for the GitHub Issue Assistant API
 * @description Shared types and interfaces used across all modules
 */

/**
 * Environment variables interface for Cloudflare Workers
 */
export interface Env {
  /** OpenAI API key for AI-powered features */
  OPENAI_API_KEY?: string;
  /** Frontend origin for CORS configuration */
  FRONTEND_ORIGIN?: string;
  /** GitHub Personal Access Token */
  GITHUB_TOKEN?: string;
}

/**
 * Generic API result wrapper
 * @template T The data type of successful response
 */
export interface Result<T = unknown> {
  /** Success indicator */
  success: boolean;
  /** Response data when successful */
  data?: T;
  /** Error message when failed */
  error?: string;
}

/**
 * Standard API error class with enhanced error context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status code (default: 500) */
    public status: number = 500,
    /** Original cause/raw error for debugging */
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
    
    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Create ApiError from unknown error with proper type checking
   * @param error - Unknown error to convert
   * @param status - HTTP status code
   * @param context - Additional context
   * @returns Properly typed ApiError
   */
  static from(error: unknown, status = 500, context?: string): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    
    const message = error instanceof Error 
      ? error.message 
      : String(error);
      
    const fullMessage = context ? `${context}: ${message}` : message;
    
    return new ApiError(fullMessage, status, error);
  }
}

/**
 * Agent execution trace for debugging
 */
export interface AgentTrace {
  /** The tool that was chosen by AI */
  chosenTool: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Whether the execution was successful */
  success: boolean;
}