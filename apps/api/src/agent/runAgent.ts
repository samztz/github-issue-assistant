/**
 * @fileoverview GitHub Agent execution engine
 * @description Natural language processing agent that interprets user commands and executes GitHub operations
 */

import OpenAI from "openai";
import { TOOLS, ToolName } from "./tools";
import { 
  http_github_list_issues,
  http_github_create_issue,
  http_github_add_labels,
  http_github_auto_triage_and_create,
} from "../mcp/handlers";
import { ApiError, type Env, type AgentTrace } from "../core/types";

/**
 * Execute a natural language GitHub operation using AI agent
 * @param naturalLanguageInput - User's natural language description of desired operation
 * @param env - Environment variables containing API keys
 * @param request - Original HTTP request (for context)
 * @returns Operation result or natural language response
 * @throws ApiError if OpenAI API key missing or execution fails
 */
export async function runAgent(
  naturalLanguageInput: string, 
  env: Env, 
  request: Request
): Promise<unknown> {
  if (!env.OPENAI_API_KEY) {
    throw new ApiError("OPENAI_API_KEY missing", 500);
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const startTime = Date.now();

  try {
    // Step 1: Let AI analyze user input and choose appropriate tool
    console.log(`🤖 Agent processing: "${naturalLanguageInput}"`);
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: 
            "You are a GitHub operations agent. Analyze the user's request and choose the most appropriate tool to fulfill it. " +
            "If the request lacks specific details (like owner/repo/issue number), make reasonable inferences from context or " +
            "use common examples. If no tool is suitable, provide helpful guidance in natural language."
        },
        { role: "user", content: naturalLanguageInput }
      ],
      tools: TOOLS,
      tool_choice: "auto"
    });

    const message = completion.choices?.[0]?.message;
    if (!message || !message.tool_calls?.length) {
      // No tool selected - return natural language response
      const response = message?.content || "(no response)";
      console.log(`💬 Agent response: ${response}`);
      return { reply: response };
    }

    // Step 2: Execute the selected tool
    const toolCall = message.tool_calls[0];
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

    console.log(`🔧 Agent executing tool: ${toolName}`, toolArgs);

    // Execute tool with type-safe dispatch
    const result = await executeToolCall(toolName as ToolName, toolArgs, env);
    
    // Step 3: Log execution trace for debugging and monitoring
    const executionTime = Date.now() - startTime;
    const trace: AgentTrace = {
      chosenTool: toolName,
      args: toolArgs,
      durationMs: executionTime,
      success: true
    };
    
    // Comprehensive execution trace for wrangler tail visibility
    console.log(`📊 Agent Execution Trace:`, {
      timestamp: new Date().toISOString(),
      userInput: naturalLanguageInput.slice(0, 100) + (naturalLanguageInput.length > 100 ? '...' : ''),
      ...trace,
      resultSummary: typeof result === 'object' && result !== null 
        ? `Object with ${Object.keys(result as Record<string, unknown>).length} keys`
        : typeof result
    });

    return result;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const trace: AgentTrace = {
      chosenTool: "unknown",
      args: {},
      durationMs: executionTime,
      success: false
    };
    
    // Enhanced error trace for debugging
    console.error(`❌ Agent Execution Failed:`, {
      timestamp: new Date().toISOString(),
      userInput: naturalLanguageInput.slice(0, 100) + (naturalLanguageInput.length > 100 ? '...' : ''),
      ...trace,
      errorType: error instanceof ApiError ? 'ApiError' : error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
    });
    
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Agent execution failed: ${error}`, 500, error);
  }
}

/**
 * Execute a specific tool call with type-safe dispatch
 * @param toolName - Name of the tool to execute
 * @param args - Arguments for the tool
 * @param env - Environment variables
 * @returns Tool execution result
 * @throws ApiError if tool unknown or execution fails
 */
async function executeToolCall(
  toolName: ToolName, 
  args: Record<string, unknown>, 
  env: Env
): Promise<unknown> {
  // Type-safe tool dispatch with explicit switch statements
  switch (toolName) {
    case ToolName.LIST_ISSUES:
      console.log(`🔧 Executing: List issues for ${args.owner}/${args.repo}`);
      return await http_github_list_issues(env, args);
    
    case ToolName.CREATE_ISSUE:
      console.log(`🔧 Executing: Create issue "${args.title}" in ${args.owner}/${args.repo}`);
      return await http_github_create_issue(env, args);
    
    case ToolName.ADD_LABELS:
      console.log(`🔧 Executing: Add labels to issue #${args.number} in ${args.owner}/${args.repo}`);
      return await http_github_add_labels(env, args);
    
    case ToolName.AUTO_TRIAGE_CREATE:
      console.log(`🔧 Executing: AI triage and create for "${args.title}" in ${args.owner}/${args.repo}`);
      return await http_github_auto_triage_and_create(env, args);
    
    default:
      // This should never happen with TypeScript, but provides runtime safety
      throw new ApiError(`Unknown tool: ${toolName}`, 400);
  }
}

/*
 * ===============================================================================
 * MULTI-TURN EXECUTION CAPABILITY - EXPANSION HOOK
 * ===============================================================================
 * 
 * Future enhancement: Support for complex multi-step GitHub workflows where the 
 * agent can chain multiple operations based on previous results.
 *
 * EXAMPLE USE CASES:
 * 1. "Create issue and add urgent label" → create_issue → add_labels
 * 2. "List bugs and create summary issue" → list_issues → create_issue
 * 3. "Find related issues and cross-reference" → list_issues → add_labels
 *
 * IMPLEMENTATION TEMPLATE:
 * 
 * async function runMultiTurnAgent(input: string, env: Env): Promise<unknown> {
 *   let conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
 *     {
 *       role: "system",
 *       content: "You are a GitHub agent. Execute operations step by step, " +
 *                "using results from previous tools to inform next actions."
 *     },
 *     { role: "user", content: input }
 *   ];
 *   
 *   const MAX_TURNS = 5;
 *   const executionLog: AgentTrace[] = [];
 *   let currentTurn = 0;
 *   
 *   while (currentTurn < MAX_TURNS) {
 *     console.log(`🔄 Multi-turn execution - Turn ${currentTurn + 1}/${MAX_TURNS}`);
 *     
 *     const completion = await client.chat.completions.create({
 *       model: "gpt-4o-mini",
 *       temperature: 0.2,
 *       messages: conversationMessages,
 *       tools: TOOLS,
 *       tool_choice: "auto"
 *     });
 *     
 *     const message = completion.choices?.[0]?.message;
 *     if (!message?.tool_calls?.length) {
 *       // No more tools needed - return final response
 *       const finalResult = {
 *         reply: message?.content || "Task completed",
 *         executionLog,
 *         totalTurns: currentTurn
 *       };
 *       console.log(`✅ Multi-turn execution completed in ${currentTurn} turns`);
 *       return finalResult;
 *     }
 *     
 *     // Execute each tool call in sequence
 *     const toolResults = [];
 *     for (const toolCall of message.tool_calls) {
 *       const startTime = Date.now();
 *       try {
 *         const result = await executeToolCall(
 *           toolCall.function.name as ToolName,
 *           JSON.parse(toolCall.function.arguments || "{}"),
 *           env
 *         );
 *         
 *         toolResults.push({
 *           tool_call_id: toolCall.id,
 *           role: "tool" as const,
 *           content: JSON.stringify(result)
 *         });
 *         
 *         // Log successful execution
 *         executionLog.push({
 *           chosenTool: toolCall.function.name,
 *           args: JSON.parse(toolCall.function.arguments || "{}"),
 *           durationMs: Date.now() - startTime,
 *           success: true
 *         });
 *         
 *       } catch (error) {
 *         // Log failed execution
 *         executionLog.push({
 *           chosenTool: toolCall.function.name,
 *           args: JSON.parse(toolCall.function.arguments || "{}"),
 *           durationMs: Date.now() - startTime,
 *           success: false
 *         });
 *         
 *         toolResults.push({
 *           tool_call_id: toolCall.id,
 *           role: "tool" as const,
 *           content: `Error: ${error instanceof Error ? error.message : error}`
 *         });
 *       }
 *     }
 *     
 *     // Add assistant message with tool calls
 *     conversationMessages.push({
 *       role: "assistant",
 *       tool_calls: message.tool_calls
 *     });
 *     
 *     // Add tool results
 *     conversationMessages.push(...toolResults);
 *     
 *     currentTurn++;
 *   }
 *   
 *   console.log(`⚠️ Multi-turn execution reached maximum turns (${MAX_TURNS})`);
 *   return {
 *     reply: "Task partially completed - reached maximum execution turns",
 *     executionLog,
 *     totalTurns: currentTurn
 *   };
 * }
 * 
 * INTEGRATION POINTS:
 * - Replace single-turn logic in runAgent() with call to runMultiTurnAgent()
 * - Add configuration flag to enable/disable multi-turn mode
 * - Enhance AgentTrace to track turn numbers and tool sequences
 * - Add conversation state management for complex workflows
 * 
 * ===============================================================================
 */