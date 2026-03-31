import type { CurrentTextContext } from "../sidebar/context-preview";
import { renderPromptTemplate } from "./prompt-template";
import {
  createSystemPromptMessage,
  createUserContextMessage,
  type ChatCompletionMessage
} from "./chat-completions";

const DEFAULT_TASK_INSTRUCTION = "请分析以下文献内容。";

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
  messages: ChatCompletionMessage[],
  context?: CurrentTextContext
): string {
  const sections = messages.map(
    (message) => `${message.role.toUpperCase()}:\n${message.content}`
  );

  if (context?.contextSourceLabel) {
    sections.unshift(`上下文来源：\n${context.contextSourceLabel}`);
  }

  return sections.join("\n\n");
}
