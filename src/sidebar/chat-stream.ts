import type { OutputRenderMode } from "./session-history";

export type ChatMessageRole = "assistant" | "status" | "user";
export type ChatMessageTone = "default" | "error" | "loading";

export type ChatMessageEntry = {
  content: string;
  id: string;
  mode: OutputRenderMode;
  role: ChatMessageRole;
  tone: ChatMessageTone;
};

export function buildChatMessageEntry(input: {
  content: string;
  mode: OutputRenderMode;
  role: ChatMessageRole;
  tone?: ChatMessageTone;
}): ChatMessageEntry {
  return {
    content: input.content,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: input.mode,
    role: input.role,
    tone: input.tone || "default"
  };
}

export function appendChatMessage(
  messages: ChatMessageEntry[],
  entry: ChatMessageEntry
): ChatMessageEntry[] {
  return [...messages, entry];
}

export function removeLoadingChatMessages(
  messages: ChatMessageEntry[]
): ChatMessageEntry[] {
  return messages.filter((message) => message.tone !== "loading");
}
