// apps/api/src/agent.ts
import OpenAI from "openai";
import {
  http_github_list_issues,
  http_github_create_issue,
  http_github_add_labels,
  http_github_auto_triage_and_create,
} from "./mcp";

// 你已在 wrangler secret 设置 OPENAI_API_KEY
export interface Env {
  OPENAI_API_KEY?: string;
  GITHUB_TOKEN?: string; // 可选：你若想在 Agent 里直接调 GitHub
  API_BASE?: string;     // 可选：如要从 Worker 内部转调自己的 /mcp，用同域相对路径即可
}

// === 定义"工具"规范（与 /mcp/* 一一对应） ===
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "github_list_issues",
      description: "List repo issues",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string" },
          repo:  { type: "string" },
          state: { type: "string", enum: ["open","closed","all"] },
          labels:{ type: "string" }
        },
        required: ["owner","repo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_create_issue",
      description: "Create a GitHub issue",
      parameters: {
        type: "object",
        properties: {
          owner:{type:"string"}, repo:{type:"string"},
          title:{type:"string"}, body:{type:"string"},
          labels:{type:"array", items:{type:"string"}}
        },
        required:["owner","repo","title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_add_labels",
      description: "Add labels to an existing issue",
      parameters: {
        type: "object",
        properties: {
          owner:{type:"string"}, repo:{type:"string"},
          number:{type:"number"}, labels:{type:"array",items:{type:"string"}}
        },
        required:["owner","repo","number","labels"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_auto_triage_and_create",
      description: "AI triage then create issue with suggested labels",
      parameters: {
        type: "object",
        properties: {
          owner:{type:"string"}, repo:{type:"string"},
          title:{type:"string"}, body:{type:"string"}
        },
        required:["owner","repo","title"]
      }
    }
  }
];

// === 直接调用内部 MCP 函数（更高效，避免 HTTP 循环） ===

export async function runAgent(nl: string, env: Env, req: Request) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  // 1) 让模型理解用户自然语言并"选择工具"
  const first = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a GitHub operator agent. Decide which tool to call. " +
          "If information (owner/repo/number) is missing, infer from context or ask the user next time."
      },
      { role: "user", content: nl }
    ],
    tools,
    tool_choice: "auto"
  });

  const msg = first.choices?.[0]?.message;
  if (!msg || !msg.tool_calls?.length) {
    // 模型认为无需工具（给出自然语言建议）
    return { reply: msg?.content || "(no response)" };
  }

  // 2) 执行第一条工具调用（可继续扩展多轮工具链）
  const call = msg.tool_calls[0];
  const name = call.function.name;
  const args = JSON.parse(call.function.arguments || "{}");

  // 3) 直接调用内部函数（避免 HTTP 循环调用）
  switch (name) {
    case "github_list_issues":
      return await http_github_list_issues(env, args);
    case "github_create_issue":
      return await http_github_create_issue(env, args);
    case "github_add_labels":
      return await http_github_add_labels(env, args);
    case "github_auto_triage_and_create":
      return await http_github_auto_triage_and_create(env, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}