// apps/api/src/mcp.ts
export interface Env {
  GITHUB_TOKEN?: string;
  OPENAI_API_KEY?: string;
}

const GITHUB_API = "https://api.github.com";

function ghHeaders(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN ?? ""}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "mcp-github-issue-assistant",
  };
}

async function gh<T>(url: string, env: Env, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { ...ghHeaders(env), ...(init?.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${text}`);
  return text ? (JSON.parse(text) as T) : (undefined as any);
}

// ---- Tools ----

export async function http_github_list_issues(env: Env, body: any) {
  const { owner, repo, state = "open", labels } = body ?? {};
  if (!owner || !repo) throw new Error("owner/repo required");

  const u = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
  u.searchParams.set("state", state);
  if (labels) u.searchParams.set("labels", labels);
  u.searchParams.set("per_page", "20");

  const items = await gh<any[]>(u.toString(), env);
  const out = items
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: (i.labels || []).map((l: any) => l.name),
      url: i.html_url,
    }));
  return out;
}

export async function http_github_create_issue(env: Env, body: any) {
  const { owner, repo, title, labels, ...rest } = body ?? {};
  if (!owner || !repo || !title) throw new Error("owner/repo/title required");

  const created = await gh<{ number: number; html_url: string }>(
    `${GITHUB_API}/repos/${owner}/${repo}/issues`,
    env,
    { method: "POST", body: JSON.stringify({ title, labels, ...rest }) }
  );
  return { number: created.number, url: created.html_url };
}

export async function http_github_add_labels(env: Env, body: any) {
  const { owner, repo, number, labels } = body ?? {};
  if (!owner || !repo || !number || !Array.isArray(labels) || !labels.length)
    throw new Error("owner/repo/number/labels[] required");

  const res = await gh<any[]>(
    `${GITHUB_API}/repos/${owner}/${repo}/issues/${number}/labels`,
    env,
    { method: "POST", body: JSON.stringify({ labels }) }
  );
  return res.map((l: any) => l.name);
}

// —— OpenAI triage（在 Workers 里直接调 OpenAI）——
async function triageWithOpenAI(env: Env, title: string, body?: string) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const sys =
    "You are a GitHub issue triage assistant. Return strict JSON with keys: summary, priority(P0|P1|P2|P3), suggestedLabels (array).";
  const user =
    `Title: ${title}\n\nBody:\n${body || ""}\n\n` +
    `Return JSON exactly: {"summary": string, "priority": "P0"|"P1"|"P2"|"P3", "suggestedLabels": string[]}`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text}`);

  try {
    const data = JSON.parse(text);
    const content = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch {
    // 兜底
    return { summary: text.slice(0, 200), priority: "P2", suggestedLabels: ["needs-triage"] };
  }
}

export async function http_github_triage(env: Env, body: any) {
  const { title, ...rest } = body ?? {};
  if (!title) throw new Error("title required");
  return triageWithOpenAI(env, title, rest.body);
}

export async function http_github_auto_triage_and_create(env: Env, body: any) {
  const { owner, repo, title, ...rest } = body ?? {};
  if (!owner || !repo || !title) throw new Error("owner/repo/title required");

  const tri = await triageWithOpenAI(env, title, rest.body);
  const labels = Array.from(
    new Set([...(tri.suggestedLabels || []), "ai-triaged", String(tri.priority || "P2").toLowerCase()])
  );

  const finalTitle = `[${tri.priority || "P2"}] ${title}`;
  const finalBody =
    `**AI Summary**: ${tri.summary}\n\n**Priority**: ${tri.priority}\n` +
    `**Suggested Labels**: ${labels.join(", ")}\n\n---\n${rest.body || "_(no body)_"}`;

  const created = await http_github_create_issue(env, { owner, repo, title: finalTitle, body: finalBody, labels });
  return { ...created, triage: tri };
}