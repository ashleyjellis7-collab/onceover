import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Claude is used only to read and write text: transcribing uploads and drafting
// suggestions the user edits. Verdicts come from Jev and code.
export const CLAUDE_MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claude() {
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}
