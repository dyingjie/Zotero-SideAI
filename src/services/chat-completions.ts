import { truncatePreviewText } from "../sidebar/context-preview";

export type ChatCompletionMessageRole = "system" | "user" | "assistant";

export const MAX_TASK_INSTRUCTION_LENGTH = 2000;

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
  const taskInstruction = truncatePreviewText(
    input.taskInstruction?.trim() || "",
    MAX_TASK_INSTRUCTION_LENGTH
  );
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
