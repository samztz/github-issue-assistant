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

    llmEcho: async (_: unknown, { prompt }: { prompt: string }, ctx: { env: Env, client: any }) => {
      // 关键：ctx.env 由我们在 createYoga.context 中注入`
      
      const client = new OpenAI({ apiKey: ctx.env.OPENAI_API_KEY });
      //访问 OPENAI
      console.log(`query openAI: ${prompt}`);
      const response = await client.responses.create({
        model: "gpt-5",
        input: prompt,
      });

      const data = (await response.json()) as any;
      return data.choices?.[0]?.message?.content ?? "(no response)";
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
      const resp = await yoga.fetch(req, env, ctx);  // 这里可能抛错
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
