const API_BASE = import.meta.env.VITE_API_BASE || "/graphql";

export async function queryLLM(prompt: string) {
  const query = `
    query($p: String!) { llmEcho(prompt: $p) }
  `;
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { p: prompt } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data?.llmEcho ?? "(no data)";
}
