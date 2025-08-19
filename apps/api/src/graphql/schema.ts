/**
 * @fileoverview GraphQL schema definition
 * @description Type definitions and resolvers for the GraphQL API
 */

import OpenAI from "openai";
import { getEnv } from "../env";
import type { Env } from "../core/types";

/**
 * GraphQL type definitions
 */
export const typeDefs = /* GraphQL */ `
  type Query {
    hello(name: String): String!
    llmEcho(prompt: String!): String!
  }
`;

/**
 * GraphQL resolvers
 */
export const resolvers = {
  Query: {
    /**
     * Simple hello resolver
     * @param _ - Parent (unused)
     * @param args - Arguments containing optional name
     * @returns Greeting string
     */
    hello: (_: unknown, { name }: { name?: string }): string => {
      return `Hello ${name || "World"} from Cloudflare Workers + GraphQL!`;
    },

    /**
     * LLM echo resolver using OpenAI
     * @param _ - Parent (unused)  
     * @param args - Arguments containing prompt
     * @param ctx - Context containing environment
     * @returns LLM response string
     * @throws Error if OpenAI API key is not configured
     */
    llmEcho: async (
      _: unknown, 
      { prompt }: { prompt: string }, 
      ctx: { env: Env }
    ): Promise<string> => {
      // Use getEnv() to get environment variables
      const apiKey = getEnv().OPENAI_API_KEY;
      if (!apiKey) return "(no API key configured)";
      
      const client = new OpenAI({ apiKey });
      console.log(`query openAI: ${prompt}`);
      
      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",  // Use reliable model
          messages: [{ role: "user", content: `Summarize in 1 sentence: ${prompt}` }],
        });

        return response.choices?.[0]?.message?.content ?? "(no response)";
      } catch (error) {
        console.error("OpenAI API error:", error);
        return "(OpenAI API error)";
      }
    },
  },
};