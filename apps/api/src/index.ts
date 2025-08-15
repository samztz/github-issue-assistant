import { createYoga, createSchema } from "graphql-yoga";

export interface Env {
  DEEPSEEK_API_KEY?: string;
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
      const useDeepSeek = Boolean(ctx.env.DEEPSEEK_API_KEY);
      const apiKey = ctx.env.DEEPSEEK_API_KEY || ctx.env.OPENAI_API_KEY;
      if (!apiKey) return "(no API key configured)";

      const base = useDeepSeek ? "https://api.deepseek.com" : "https://api.openai.com";
      const model = useDeepSeek ? "deepseek-chat" : "gpt-5";

      const r = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: `Summarize in 1 sentence: ${prompt}` }]
        })
      });
      const data = await r.json() as any;
      return data.choices?.[0]?.message?.content ?? "(no response)";
    }
  }
};

const yoga = createYoga<{ env: Env }>({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/graphql",
  landingPage: true,
});

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // ── CORS 预检（不要走 yoga）
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*", // 生产建议改为前端真实域名
          "Access-Control-Allow-Headers": "content-type,authorization",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
      });
    }

    // ── 交给 Yoga 处理 GraphQL
    const resp = await yoga.fetch(req, env, ctx); // 不要再 .then

    // ── 追加 CORS 头
    const headers = new Headers(resp.headers);
    headers.set("Access-Control-Allow-Origin", "*"); // 生产改为你的前端域
    headers.set("Access-Control-Allow-Headers", "content-type,authorization");
    headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    return new Response(resp.body, { status: resp.status, headers });
  },
};
