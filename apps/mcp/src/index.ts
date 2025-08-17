import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { fetch } from "undici";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_API = "https://api.github.com";
import { triageIssue, TriageInput } from "./mastra/triage.js";

async function gh<T>(url: string, init?: RequestInit): Promise<T> {
  const defaultHeaders = {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "mcp-github-issue-assistant",
  };
  
  const r = await fetch(url, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...(init?.headers as Record<string, string> || {}),
    },
  } as any);
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${text}`);
  return text ? JSON.parse(text) as T : (undefined as any);
}

// --- 工具定义 ---

// 1) 列 issues
const listIssues: Tool = {
  name: "github_list_issues",
  description:
    "List issues from a GitHub repository. Supports state=open|closed|all and simple label filter.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "repo owner/org", },
      repo:  { type: "string", description: "repo name" },
      state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
      labels:{ type: "string", description: "comma-separated labels", nullable: true }
    },
    required: ["owner", "repo"]
  },
  async handler({ params }: { params: any }): Promise<CallToolResult> {
    try {
      const p = z.object({
        owner: z.string(),
        repo: z.string(),
        state: z.enum(["open","closed","all"]).default("open"),
        labels: z.string().optional()
      }).parse(params);

      const url = new URL(`${GITHUB_API}/repos/${p.owner}/${p.repo}/issues`);
      url.searchParams.set("state", p.state);
      if (p.labels) url.searchParams.set("labels", p.labels);
      url.searchParams.set("per_page","20");

      const data = await gh<any[]>(url.toString());
      const items = data.filter(i => !i.pull_request).map(i => ({
        number: i.number, title: i.title, state: i.state,
        labels: i.labels?.map((l:any)=>l.name), url: i.html_url
      }));
      return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
    } catch (e:any) {
      return { content: [{ type: "text", text: `Error: ${e?.message || e}` }] };
    }
  }
};

// 2) 创建 issue
const createIssue: Tool = {
  name: "github_create_issue",
  description: "Create a GitHub issue in the given repository.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo:  { type: "string" },
      title: { type: "string" },
      body:  { type: "string", nullable: true },
      labels:{ type: "array", items: { type: "string" }, nullable: true }
    },
    required: ["owner","repo","title"]
  },
  async handler({ params }: { params: any }): Promise<CallToolResult> {
    try {
      const p = z.object({
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional()
      }).parse(params);

      const data = await gh<any>(`${GITHUB_API}/repos/${p.owner}/${p.repo}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: p.title, body: p.body, labels: p.labels })
      });
      return { content: [{ type: "text", text: JSON.stringify({ number: data.number, url: data.html_url }, null, 2) }] };
    } catch (e:any) {
      return { content: [{ type: "text", text: `Error: ${e?.message || e}` }] };
    }
  }
};

// 3) 给 issue 加 label
const addLabels: Tool = {
  name: "github_add_labels",
  description: "Add one or more labels to an existing issue.",
  inputSchema: {
    type: "object",
    properties: {
      owner:  { type: "string" },
      repo:   { type: "string" },
      number: { type: "number", description: "issue number" },
      labels: { type: "array", items: { type: "string" } }
    },
    required: ["owner","repo","number","labels"]
  },
  async handler({ params }: { params: any }): Promise<CallToolResult> {
    try {
      const p = z.object({
        owner: z.string(),
        repo: z.string(),
        number: z.number(),
        labels: z.array(z.string()).nonempty()
      }).parse(params);

      const data = await gh<any[]>(
        `${GITHUB_API}/repos/${p.owner}/${p.repo}/issues/${p.number}/labels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels: p.labels })
        }
      );
      return { content: [{ type: "text", text: JSON.stringify(data.map((l:any)=>l.name), null, 2) }] };
    } catch (e:any) {
      return { content: [{ type: "text", text: `Error: ${e?.message || e}` }] };
    }
  }
};

const triageTool: Tool = {
  name: "github_triage",
  description:
    "Use Mastra (OpenAI via AI SDK) to summarize, prioritize (P0..P3), and suggest labels for an issue.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      body:  { type: "string", nullable: true },
    },
    required: ["title"],
  },
  async handler({ params }: { params: any }) {
    try {
      const input = TriageInput.parse({ title: params?.title, body: params?.body ?? "" });
      const out = await triageIssue(input);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e:any) {
      return { content: [{ type: "text", text: `Error: ${e?.message || e}` }] };
    }
  },
};

const autoTriageAndCreate: Tool = {
  name: "github_auto_triage_and_create",
  description:
    "Use Mastra to triage (summary, priority, labels), then create an issue with the result appended.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo:  { type: "string" },
      title: { type: "string" },
      body:  { type: "string", nullable: true }
    },
    required: ["owner","repo","title"]
  },
  async handler({ params }: { params: any }): Promise<CallToolResult> {
    try {
      const owner = String(params?.owner);
      const repo  = String(params?.repo);
      const title = String(params?.title);
      const body  = String(params?.body || "");

      // 1) triage
      const triaged = await triageIssue({ title, body });
      const finalBody =
        `${body ? body + "\n\n" : ""}` +
        `---\n` +
        `**Triage Summary**: ${triaged.summary}\n` +
        `**Priority**: ${triaged.priority}\n` +
        `**Suggested Labels**: ${triaged.suggestedLabels.join(", ") || "none"}\n`;

      // 2) create issue with labels
      const created = await gh<any>(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body: finalBody,
          labels: triaged.suggestedLabels?.slice(0, 5) || []
        })
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            triaged,
            created: { number: created.number, url: created.html_url }
          }, null, 2)
        }]
      };
    } catch (e:any) {
      return { content: [{ type: "text", text: `Error: ${e?.message || e}` }] };
    }
  }
};


// --- 启动 MCP Server ---
const server = new Server({
  name: "github-issue-assistant",
  version: "0.1.0",
  tools: [listIssues, createIssue, addLabels, triageTool, autoTriageAndCreate],
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[MCP] GitHub Issue Assistant ready on stdio.");