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

export function createUserContextMessage(input: {
  currentText: string;
  taskInstruction?: string;
}): ChatCompletionMessage {
  const taskInstruction = input.taskInstruction?.trim() || "";
  const currentText = input.currentText.trim();

  return {
    content: taskInstruction
      ? `${taskInstruction}\n\n${currentText}`
      : currentText,
    role: "user"
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
