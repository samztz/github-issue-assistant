// apps/api/src/index.ts
import { createYoga, createSchema } from "graphql-yoga";
import { setEnv, getEnv } from "./env";
import OpenAI from "openai";
import {
  http_github_list_issues,
  http_github_create_issue,
  http_github_add_labels,
  http_github_triage,
  http_github_auto_triage_and_create,
  type Env as McpEnv,
} from "./mcp";
import { runAgent } from "./agent";


export interface Env extends McpEnv {
  OPENAI_API_KEY?: string;
  FRONTEND_ORIGIN?: string;
  GITHUB_TOKEN?: string;
}

const typeDefs = /* GraphQL */ `
  type Query {
    hello(name: String): String!
    llmEcho(prompt: String!): String!
  }
`;

const resolvers = {
  Query: {
    hello: (_: unknown, { name }: { name?: string }) =>
      `Hello ${name || "World"} from Cloudflare Workers + GraphQL!`,

    llmEcho: async (_: unknown, { prompt }: { prompt: string }, ctx: { env: Env }) => {
      // 使用 getEnv() 获取环境变量
      const apiKey = getEnv().OPENAI_API_KEY;
      if (!apiKey) return "(no API key configured)";
      
      const client = new OpenAI({ apiKey });
      console.log(`query openAI: ${prompt}`);
      
      const response = await client.chat.completions.create({
        model: "gpt-5",  // 使用最新的 GPT-5 模型
        messages: [{ role: "user", content: `Summarize in 1 sentence: ${prompt}` }],
      });

      return response.choices?.[0]?.message?.content ?? "(no response)";
    },
  },
};

const yoga = createYoga<{ env: Env }>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/graphql",
  landingPage: true,
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    setEnv(env);

    const ORIGIN = env.FRONTEND_ORIGIN || req.headers.get("Origin") || "*"; // 生产建议白名单校验后回显
    const baseCors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Headers": "content-type,authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseCors });
    }

    // ---- 路由：/agent/run ----
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/agent/run") {
      try {
        const { input } = await req.json();
        if (!input || typeof input !== "string") {
          const res = json({ error: "input (string) required" }, 400);
          for (const [k, v] of Object.entries(baseCors)) res.headers.set(k, v as string);
          return res;
        }
        const result = await runAgent(input, env, req);
        const res = json(result, 200);
        for (const [k, v] of Object.entries(baseCors)) res.headers.set(k, v as string);
        return res;
      } catch (e: any) {
        const res = json({ error: e?.message || "Agent failed" }, 500);
        for (const [k, v] of Object.entries(baseCors)) res.headers.set(k, v as string);
        return res;
      }
    }

    // ---- 路由：/mcp/* ----
    if (req.method === "POST" && url.pathname.startsWith("/mcp/")) {
      try {
        const payload = await req.json().catch(() => ({}));
        let result: unknown;
        switch (url.pathname) {
          case "/mcp/github_list_issues":
            result = await http_github_list_issues(env, payload);
            break;
          case "/mcp/github_create_issue":
            result = await http_github_create_issue(env, payload);
            break;
          case "/mcp/github_add_labels":
            result = await http_github_add_labels(env, payload);
            break;
          case "/mcp/github_triage":
            result = await http_github_triage(env, payload);
            break;
          case "/mcp/github_auto_triage_and_create":
            result = await http_github_auto_triage_and_create(env, payload);
            break;
          default:
            return new Response("Not Found", { status: 404, headers: baseCors });
        }
        const res = json(result, 200);
        for (const [k, v] of Object.entries(baseCors)) res.headers.set(k, v as string);
        return res;
      } catch (e: any) {
        const res = json({ error: e?.message || "Internal error" }, 500);
        for (const [k, v] of Object.entries(baseCors)) res.headers.set(k, v as string);
        return res;
      }
    }

    // ---- 其他路由走 GraphQL ----
    try {
      const resp = await yoga.fetch(req, { env }, ctx);  // 正确传递 env
      const headers = new Headers(resp.headers);
      for (const [k, v] of Object.entries(baseCors)) headers.set(k, v as string);
      return new Response(resp.body, { status: resp.status, headers });
    } catch (err: any) {
      // 即使出错也带上 CORS 头，避免浏览器吞错误
      return new Response(
        JSON.stringify({ error: err?.message || "Internal Error" }),
        { status: 500, headers: { ...baseCors, "Content-Type": "application/json" } }
      );
    }
  },
};
