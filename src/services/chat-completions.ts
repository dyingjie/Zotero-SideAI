export type ChatCompletionMessageRole = "system" | "user" | "assistant";

export type ChatCompletionMessage = {
  content: string;
  role: ChatCompletionMessageRole;
};

export type ChatCompletionsRequestBody = {
  messages: ChatCompletionMessage[];
  model: string;
};

export function createSystemPromptMessage(
  systemPrompt: string
): ChatCompletionMessage {
  return {
    content: systemPrompt.trim(),
    role: "system"
  };
}

export function createChatCompletionsRequestBody(input: {
  messages: ChatCompletionMessage[];
  model: string;
}): ChatCompletionsRequestBody {
  return {
    messages: input.messages,
    model: input.model.trim()
  };
}
