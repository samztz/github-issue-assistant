// apps/api/src/index.ts
import { createYoga, createSchema } from "graphql-yoga";
import { setEnv, getEnv } from "./env";
import OpenAI from "openai";


export interface Env {
  OPENAI_API_KEY?: string;
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
