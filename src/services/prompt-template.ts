import type { CurrentTextContext } from "../sidebar/context-preview";

export function renderPromptTemplate(
  template: string,
  context: CurrentTextContext
): string {
  const variables: Record<string, string> = {
    abstractText: context.abstractText,
    contextSource: context.contextSource || "item",
    contextSourceLabel: context.contextSourceLabel || "Item Context",
    currentText: context.previewText,
    notesText: context.notesText,
    pdfSelectionText: context.pdfSelectionText || "",
    previewText: context.previewText,
    title: context.title
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match;
  });
}
