/**
 * @fileoverview GitHub API integration utilities
 * @description Low-level GitHub API functions and type definitions
 */

import { ApiError, type Env } from '../core/types';

/** GitHub API base URL */
const GITHUB_API = "https://api.github.com";

// ===== Type Definitions =====

/** Parameters for listing issues */
export interface IssueListParams {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  labels?: string;
}

/** Parameters for creating an issue */
export interface IssueCreateParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

/** Parameters for adding labels to an issue */
export interface IssueAddLabelsParams {
  owner: string;
  repo: string;
  number: number;
  labels: string[];
}

/** Issue summary returned by list operations */
export interface IssueSummary {
  number: number;
  title: string;
  state: string;
  labels: string[];
  url: string;
}

/** Response when creating an issue */
export interface IssueCreated {
  number: number;
  url: string;
}

/** Triage result from AI analysis */
export interface TriageResult {
  summary: string;
  priority: "P0" | "P1" | "P2" | "P3";
  suggestedLabels: string[];
}

// ===== GitHub API Utilities =====

/**
 * Generate GitHub API headers
 * @param env - Environment containing GitHub token
 * @returns Headers object for GitHub API requests
 */
export function ghHeaders(env: Env): Record<string, string> {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN ?? ""}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "mcp-github-issue-assistant",
  };
}

/**
 * Generic GitHub API request wrapper
 * @template T Expected response type
 * @param url - API endpoint URL
 * @param env - Environment variables
 * @param init - Fetch options
 * @returns Parsed response data
 * @throws ApiError if request fails
 */
export async function gh<T>(url: string, env: Env, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...ghHeaders(env), ...(init?.headers || {}) },
    });
    
    const text = await response.text();
    
    if (!response.ok) {
      throw new ApiError(
        `GitHub ${response.status}: ${text}`, 
        response.status, 
        text
      );
    }
    
    return text ? (JSON.parse(text) as T) : (undefined as any);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`GitHub request failed: ${error}`, 500, error);
  }
}

// ===== OpenAI Triage Integration =====

/**
 * Perform AI triage using OpenAI
 * @param env - Environment containing OpenAI API key
 * @param title - Issue title
 * @param body - Issue body (optional)
 * @returns Triage analysis result
 * @throws ApiError if OpenAI API key is missing or request fails
 */
export async function triageWithOpenAI(
  env: Env, 
  title: string, 
  body?: string
): Promise<TriageResult> {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError("OPENAI_API_KEY missing", 500);
  }

  const systemPrompt = 
    "You are a GitHub issue triage assistant. Return strict JSON with keys: " +
    "summary, priority(P0|P1|P2|P3), suggestedLabels (array).";
    
  const userPrompt = 
    `Title: ${title}\n\nBody:\n${body || ""}\n\n` +
    `Return JSON exactly: {"summary": string, "priority": "P0"|"P1"|"P2"|"P3", "suggestedLabels": string[]}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${apiKey}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(`OpenAI ${response.status}: ${text}`, response.status, text);
    }

    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    
    // Fallback for parsing errors
    console.warn("OpenAI triage parsing failed, using fallback:", error);
    return { 
      summary: `Analysis of: ${title}`.slice(0, 200), 
      priority: "P2", 
      suggestedLabels: ["needs-triage"] 
    };
  }
}