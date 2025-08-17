import { z } from "zod";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai"; // ✅ 正确的 provider

// 确保环境变量设置
if (!process.env.OPENAI_API_KEY) {
  console.warn("Warning: OPENAI_API_KEY not set, triage functionality may not work");
}

// 给 Agent 指定模型（文档推荐的方式）
const model = openai("gpt-4o-mini") as any; // 类型兼容性临时修复

// 定义 Agent
export const triageAgent = new Agent({
  name: "github-triage",
  instructions:
    "You are a GitHub issue triage assistant. Summarize, assign priority (P0..P3), and propose 1-3 concise labels. Return strict JSON.",
  model,
});

// I/O schema
export const TriageInput = z.object({
  title: z.string(),
  body: z.string().optional().default(""),
});
export type TriageInput = z.infer<typeof TriageInput>;

export const TriageOutput = z.object({
  summary: z.string(),
  priority: z.enum(["P0", "P1", "P2", "P3"]),
  suggestedLabels: z.array(z.string()).default([]),
});
export type TriageOutput = z.infer<typeof TriageOutput>;

// 入口函数（MCP 工具会调用它）
export async function triageIssue(input: TriageInput): Promise<TriageOutput> {
  const res = await triageAgent.generate([
    {
      role: "user",
      content:
        `Title: ${input.title}\n\nBody:\n${input.body}\n\n` +
        `Return JSON exactly: {"summary": string, "priority": "P0"|"P1"|"P2"|"P3", "suggestedLabels": string[]}`,
    },
  ]);

  const text = res.text ?? "";
  try {
    const parsed = JSON.parse(text);
    return TriageOutput.parse({
      summary: parsed.summary,
      priority: parsed.priority,
      suggestedLabels: parsed.suggestedLabels ?? [],
    });
  } catch {
    // 兜底：即便模型没返回严格 JSON，也不至于报错
    return TriageOutput.parse({
      summary: text.slice(0, 200) || "No summary",
      priority: "P2",
      suggestedLabels: ["needs-triage"],
    });
  }
}
