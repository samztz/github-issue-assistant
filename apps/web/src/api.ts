// 正确处理 API_BASE 配置
const API_BASE_RAW = import.meta.env.VITE_API_BASE || "";
const API_BASE = API_BASE_RAW.replace(/\/graphql$/, ""); // 移除末尾的 /graphql

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
  const fullUrl = `${API_BASE}${path}`;
  console.log(`MCP Request: ${fullUrl}`, payload);
  
  const r = await fetch(fullUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  
  console.log(`MCP Response Status: ${r.status} ${r.statusText}`);
  
  // 检查响应是否为空
  const text = await r.text();
  console.log(`MCP Response Text: ${text.slice(0, 300)}`);
  
  if (!text.trim()) {
    throw new Error(`Empty response from ${fullUrl}. Status: ${r.status}`);
  }
  
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from ${fullUrl}. Status: ${r.status}. Response: ${text.slice(0, 200)}`);
  }
  
  if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}: ${r.statusText}`);
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
