import type { CurrentTextContext } from "../sidebar/context-preview";
import { renderPromptTemplate } from "./prompt-template";
import {
  createSystemPromptMessage,
  createUserContextMessage,
  type ChatCompletionMessage
} from "./chat-completions";

const DEFAULT_TASK_INSTRUCTION = "Please analyze the following paper.";

export function buildPreviewMessages(input: {
  context: CurrentTextContext;
  systemPromptTemplate: string;
  taskInstruction?: string;
}): ChatCompletionMessage[] {
  const renderedSystemPrompt = renderPromptTemplate(
    input.systemPromptTemplate,
    input.context
  );

  return [
    createSystemPromptMessage(renderedSystemPrompt),
    createUserContextMessage({
      currentText: input.context.previewText,
      taskInstruction: input.taskInstruction || DEFAULT_TASK_INSTRUCTION
    })
  ];
}

export function formatPreviewMessages(
  messages: ChatCompletionMessage[]
): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}
