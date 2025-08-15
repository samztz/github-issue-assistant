// src/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || "/graphql"; // 若用 Pages Routes 代理，可走相对路径

export async function queryLLM(prompt: string) {
  const query = `
    query($p: String!) { llmEcho(prompt: $p) }
  `;
  const res = await fetch(`${API_BASE}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { p: prompt } })
  });
  const json = await res.json();
  return json.data?.llmEcho ?? "(no data)";
}