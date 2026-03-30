export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_CONTEXT_PREVIEW_LENGTH = 6000;
export const TRUNCATED_PREVIEW_SUFFIX = "\n\n[Truncated for sending]";

export type CurrentTextContext = {
  abstractText: string;
  notesText: string;
  previewText: string;
  title: string;
};

export function mergeNotePreviewTexts(noteContents: string[]): string {
  return noteContents
    .map((content) => stripHtml(content))
    .filter(Boolean)
    .join("\n\n");
}

export function truncatePreviewText(
  text: string,
  maxLength: number = MAX_CONTEXT_PREVIEW_LENGTH
): string {
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const targetLength = Math.max(0, maxLength - TRUNCATED_PREVIEW_SUFFIX.length);
  return `${normalized.slice(0, targetLength).trimEnd()}${TRUNCATED_PREVIEW_SUFFIX}`;
}

export function buildPreviewTextFromContext(context: {
  abstractText: string;
  notesText: string;
  title: string;
}): string {
  const sections: string[] = [];

  if (context.title && context.title !== "Untitled item") {
    sections.push(`Title:\n${context.title}`);
  }

  if (context.abstractText) {
    sections.push(`Abstract:\n${context.abstractText}`);
  }

  if (context.notesText) {
    sections.push(`Notes:\n${context.notesText}`);
  }

  return truncatePreviewText(sections.join("\n\n"));
}
