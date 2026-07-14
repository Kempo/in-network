import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  const model = process.env.LLM_MODEL ?? "claude-sonnet-4-6";
  if (provider === "anthropic") return anthropic(model);
  // openai/google: add @ai-sdk/openai|google and branch here when toggled
  throw new Error(`Unsupported LLM_PROVIDER for resolver: ${provider}`);
}
