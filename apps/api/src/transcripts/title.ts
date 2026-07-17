import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const SYSTEM =
  "You write a concise title (fewer than 10 words) summarizing a customer-support call transcript. " +
  "Respond with only the title text — no quotes, no punctuation at the end, no preamble.";

export async function generateTitle(segments: { role: string; text: string }[]): Promise<string> {
  const transcript = segments.map((s) => `${s.role}: ${s.text}`).join("\n");
  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 32,
    system: SYSTEM,
    messages: [{ role: "user", content: transcript || "(empty transcript)" }],
  });
  const text = msg.content.find((b) => b.type === "text");
  return (text && "text" in text ? text.text : "Untitled call").trim() || "Untitled call";
}
