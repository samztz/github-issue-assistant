// src/env.ts
export interface Env {
  OPENAI_API_KEY: string;
}

let currentEnv: Env;

export function setEnv(env: Env) {
  currentEnv = env;
}

export function getEnv(): Env {
  if (!currentEnv) {
    throw new Error("Env has not been initialized yet.");
  }
  return currentEnv;
}