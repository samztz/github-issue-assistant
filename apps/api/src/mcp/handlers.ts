/**
 * @fileoverview MCP HTTP endpoint handlers
 * @description Implementation of GitHub-related MCP tools accessible via HTTP
 */

import { 
  gh, 
  triageWithOpenAI,
  type IssueListParams,
  type IssueCreateParams, 
  type IssueAddLabelsParams,
  type IssueSummary,
  type IssueCreated,
  type TriageResult,
} from './github';
import { ApiError, type Env } from '../core/types';

// ===== GitHub Issue Operations =====

/**
 * List issues from a GitHub repository
 * @param env - Environment variables
 * @param body - Request parameters
 * @returns Array of issue summaries
 * @throws ApiError if owner/repo missing or GitHub request fails
 */
export async function http_github_list_issues(env: Env, body: any): Promise<IssueSummary[]> {
  // Parse and validate parameters
  const { owner, repo, state = "open", labels } = (body ?? {}) as Partial<IssueListParams>;
  
  if (!owner || !repo) {
    throw new ApiError("owner/repo required", 400);
  }

  // Build GitHub API URL
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set("state", state);
  if (labels) url.searchParams.set("labels", labels);
  url.searchParams.set("per_page", "20");

  // Fetch and filter issues (exclude pull requests)
  const items = await gh<any[]>(url.toString(), env);
  const issues = items
    .filter((item) => !item.pull_request)
    .map((item): IssueSummary => ({
      number: item.number,
      title: item.title,
      state: item.state,
      labels: (item.labels || []).map((label: any) => label.name),
      url: item.html_url,
    }));

  return issues;
}

/**
 * Create a new GitHub issue
 * @param env - Environment variables
 * @param body - Issue creation parameters
 * @returns Created issue details
 * @throws ApiError if required parameters missing or GitHub request fails
 */
export async function http_github_create_issue(env: Env, body: any): Promise<IssueCreated> {
  // Parse and validate parameters
  const { owner, repo, title, labels, ...rest } = (body ?? {}) as Partial<IssueCreateParams> & Record<string, any>;
  
  if (!owner || !repo || !title) {
    throw new ApiError("owner/repo/title required", 400);
  }

  // Create issue via GitHub API
  const created = await gh<{ number: number; html_url: string }>(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    env,
    { 
      method: "POST", 
      body: JSON.stringify({ title, labels, ...rest }) 
    }
  );

  return { 
    number: created.number, 
    url: created.html_url 
  };
}

/**
 * Add labels to an existing GitHub issue
 * @param env - Environment variables
 * @param body - Label addition parameters
 * @returns Array of applied label names
 * @throws ApiError if required parameters missing or GitHub request fails
 */
export async function http_github_add_labels(env: Env, body: any): Promise<string[]> {
  // Parse and validate parameters
  const { owner, repo, number, labels } = (body ?? {}) as Partial<IssueAddLabelsParams>;
  
  if (!owner || !repo || !number || !Array.isArray(labels) || !labels.length) {
    throw new ApiError("owner/repo/number/labels[] required", 400);
  }

  // Add labels via GitHub API
  const response = await gh<any[]>(
    `https://api.github.com/repos/${owner}/${repo}/issues/${number}/labels`,
    env,
    { 
      method: "POST", 
      body: JSON.stringify({ labels }) 
    }
  );

  return response.map((label: any) => label.name);
}

// ===== AI-Powered Operations =====

/**
 * Perform AI triage analysis on issue content
 * @param env - Environment variables  
 * @param body - Triage parameters containing title and optional body
 * @returns AI triage analysis result
 * @throws ApiError if title missing or OpenAI request fails
 */
export async function http_github_triage(env: Env, body: any): Promise<TriageResult> {
  const { title, body: issueBody } = body ?? {};
  
  if (!title) {
    throw new ApiError("title required", 400);
  }

  return triageWithOpenAI(env, title, issueBody);
}

/**
 * Perform AI triage and automatically create issue with suggested labels
 * @param env - Environment variables
 * @param body - Auto-triage parameters
 * @returns Created issue details with triage information
 * @throws ApiError if required parameters missing or requests fail
 */
export async function http_github_auto_triage_and_create(env: Env, body: any): Promise<IssueCreated & { triage: TriageResult }> {
  // Parse and validate parameters
  const { owner, repo, title, body: issueBody, ...rest } = body ?? {};
  
  if (!owner || !repo || !title) {
    throw new ApiError("owner/repo/title required", 400);
  }

  // Perform AI triage analysis
  const triage = await triageWithOpenAI(env, title, issueBody);
  
  // Generate enhanced labels (remove duplicates)
  const labels = Array.from(
    new Set([
      ...(triage.suggestedLabels || []), 
      "ai-triaged", 
      String(triage.priority || "P2").toLowerCase()
    ])
  );

  // Create enhanced issue with AI insights
  const finalTitle = `[${triage.priority || "P2"}] ${title}`;
  const finalBody =
    `**AI Summary**: ${triage.summary}\n\n` +
    `**Priority**: ${triage.priority}\n` +
    `**Suggested Labels**: ${labels.join(", ")}\n\n---\n` +
    `${issueBody || "_(no body)_"}`;

  const created = await http_github_create_issue(env, { 
    owner, 
    repo, 
    title: finalTitle, 
    body: finalBody, 
    labels,
    ...rest
  });

  return { 
    ...created, 
    triage 
  };
}