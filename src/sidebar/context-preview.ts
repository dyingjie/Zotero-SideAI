export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

  return sections.join("\n\n");
}
