const API_BASE = import.meta.env.VITE_API_BASE || "";

export async function queryLLM(prompt: string) {
  const query = `
    query($p: String!) { llmEcho(prompt: $p) }
  `;
  const res = await fetch(`${API_BASE}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { p: prompt } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data?.llmEcho ?? "(no data)";
}

// MCP HTTP API functions
export async function mcp(path: string, payload: any) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json?.error || r.statusText);
  return json;
}

// 调用样例
export const githubAutoTriageAndCreate = (p: {
  owner: string; repo: string; title: string; body?: string;
}) => mcp("/mcp/github_auto_triage_and_create", p);

export const githubListIssues = (p: {
  owner: string; repo: string; state?: "open" | "closed" | "all"; labels?: string;
}) => mcp("/mcp/github_list_issues", p);

export const githubCreateIssue = (p: {
  owner: string; repo: string; title: string; body?: string; labels?: string[];
}) => mcp("/mcp/github_create_issue", p);

export const githubAddLabels = (p: {
  owner: string; repo: string; number: number; labels: string[];
}) => mcp("/mcp/github_add_labels", p);

export const githubTriage = (p: {
  title: string; body?: string;
}) => mcp("/mcp/github_triage", p);
