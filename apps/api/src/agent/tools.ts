/**
 * @fileoverview OpenAI function calling tool definitions
 * @description Schema definitions for GitHub operations available to the AI agent
 */

import type OpenAI from "openai";

/**
 * Tool definition for listing GitHub repository issues
 * 
 * **Use Cases:**
 * - Browse all open issues in a repository
 * - Find specific issues by label (bug, enhancement, etc.)
 * - Review closed issues for historical analysis
 * - Monitor issue activity across repositories
 * 
 * **Input Parameters:**
 * - owner: Repository owner (username or organization)
 * - repo: Repository name
 * - state: Issue state filter (open/closed/all)
 * - labels: Comma-separated label filter
 * 
 * **Output:** Array of issue summaries with number, title, state, labels, URL
 */
const githubListIssues: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "github_list_issues",
    description: "List and filter GitHub repository issues. Perfect for browsing issues, finding bugs by label, or monitoring repository activity. Returns up to 20 recent issues with metadata including issue numbers, titles, current state, applied labels, and direct GitHub URLs.",
    parameters: {
      type: "object",
      properties: {
        owner: { 
          type: "string", 
          description: "GitHub username or organization name (e.g., 'microsoft')" 
        },
        repo: { 
          type: "string", 
          description: "Repository name (e.g., 'vscode')" 
        },
        state: { 
          type: "string", 
          enum: ["open", "closed", "all"],
          description: "Filter issues by state. Defaults to 'open' if not specified"
        },
        labels: { 
          type: "string", 
          description: "Comma-separated list of labels to filter by (e.g., 'bug,urgent')" 
        }
      },
      required: ["owner", "repo"]
    }
  }
};

/**
 * Tool definition for creating new GitHub issues
 * 
 * **Use Cases:**
 * - Report bugs with reproduction steps
 * - Request new features or enhancements  
 * - Document technical debt or improvements
 * - Create project tasks and milestones
 * - Log support requests or questions
 * 
 * **Input Parameters:**
 * - owner: Repository owner (username or organization)
 * - repo: Repository name
 * - title: Clear, descriptive issue title
 * - body: Detailed description with context, steps, expected behavior
 * - labels: Array of categorization labels
 * 
 * **Output:** Created issue details with number and GitHub URL
 */
const githubCreateIssue: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "github_create_issue",
    description: "Create a new GitHub issue with detailed information. Ideal for bug reports, feature requests, documentation tasks, or any trackable work item. Supports rich markdown content, label categorization, and returns the created issue number and direct GitHub URL for immediate access.",
    parameters: {
      type: "object",
      properties: {
        owner: { 
          type: "string", 
          description: "GitHub username or organization name" 
        },
        repo: { 
          type: "string", 
          description: "Repository name" 
        },
        title: { 
          type: "string", 
          description: "Issue title - should be descriptive and concise" 
        },
        body: { 
          type: "string", 
          description: "Issue body content with detailed description, reproduction steps, etc." 
        },
        labels: {
          type: "array", 
          items: { type: "string" },
          description: "Array of label names to apply to the issue (e.g., ['bug', 'urgent'])"
        }
      },
      required: ["owner", "repo", "title"]
    }
  }
};

/**
 * Tool definition for adding labels to existing issues
 * 
 * **Use Cases:**
 * - Categorize issues by type (bug, enhancement, documentation)
 * - Set priority levels (urgent, high, low)
 * - Mark workflow states (needs-review, in-progress, blocked)
 * - Add team assignments (frontend, backend, design)
 * - Flag special conditions (breaking-change, security)
 * 
 * **Input Parameters:**
 * - owner: Repository owner (username or organization)
 * - repo: Repository name
 * - number: Issue number (the #123 number from GitHub)
 * - labels: Array of label names to add
 * 
 * **Output:** Array of all labels now applied to the issue
 */
const githubAddLabels: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "github_add_labels",
    description: "Add categorization labels to an existing GitHub issue for better organization and workflow management. Essential for issue triage, priority setting, team assignment, and tracking. Labels are additive - existing labels remain while new ones are applied. Returns the complete updated label list.",
    parameters: {
      type: "object",
      properties: {
        owner: { 
          type: "string", 
          description: "GitHub username or organization name" 
        },
        repo: { 
          type: "string", 
          description: "Repository name" 
        },
        number: { 
          type: "number", 
          description: "Issue number (the # number visible in GitHub UI)" 
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Array of label names to add (e.g., ['needs-review', 'priority-high'])"
        }
      },
      required: ["owner", "repo", "number", "labels"]
    }
  }
};

/**
 * Tool definition for AI-powered issue triage and creation
 * 
 * **Use Cases:**
 * - Intelligent bug report processing with priority assessment
 * - Automated feature request categorization and labeling
 * - Smart issue creation from user feedback or support tickets
 * - Consistent triage workflow for large repositories
 * - Quality assurance through AI-enhanced issue formatting
 * 
 * **Input Parameters:**
 * - owner: Repository owner (username or organization) 
 * - repo: Repository name
 * - title: Original issue title for AI analysis
 * - body: Issue description for AI processing and enhancement
 * 
 * **Output:** Created issue with AI insights, priority, and enhanced formatting
 * 
 * **AI Enhancement Features:**
 * - Priority classification (P0: Critical → P3: Low)
 * - Smart label suggestions based on content analysis
 * - Executive summary generation
 * - Structured issue body with AI insights section
 */
const githubAutoTriageAndCreate: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "github_auto_triage_and_create",
    description: "Leverage AI to intelligently analyze, prioritize, and create GitHub issues with enhanced formatting and smart categorization. Perfect for processing user feedback, bug reports, or feature requests. The AI evaluates content severity, suggests appropriate labels, assigns priority levels (P0-P3), and creates a professionally formatted issue with executive summary and structured information for improved team workflow.",
    parameters: {
      type: "object",
      properties: {
        owner: { 
          type: "string", 
          description: "GitHub username or organization name" 
        },
        repo: { 
          type: "string", 
          description: "Repository name" 
        },
        title: { 
          type: "string", 
          description: "Original issue title for AI analysis" 
        },
        body: { 
          type: "string", 
          description: "Issue description for AI to analyze and enhance" 
        }
      },
      required: ["owner", "repo", "title"]
    }
  }
};

/**
 * Complete array of available tools for the GitHub agent
 * These tools enable comprehensive GitHub issue management through natural language
 */
export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  githubListIssues,
  githubCreateIssue, 
  githubAddLabels,
  githubAutoTriageAndCreate
];

/**
 * Tool name enumeration for type-safe tool selection
 */
export enum ToolName {
  LIST_ISSUES = "github_list_issues",
  CREATE_ISSUE = "github_create_issue", 
  ADD_LABELS = "github_add_labels",
  AUTO_TRIAGE_CREATE = "github_auto_triage_and_create"
}