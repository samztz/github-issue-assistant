import OpenAI from "openai";
const client = new OpenAI({ apiKeys: process.env.OPENAI_API_KEY });

const response = await client.responses.create({
  model: "gpt-5",
  input: "Write a short bedtime story about a unicorn.",
});

console.log(response.output_text);