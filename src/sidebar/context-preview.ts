export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeNotePreviewTexts(noteContents: string[]): string {
  return noteContents
    .map((content) => stripHtml(content))
    .filter(Boolean)
    .join("\n\n");
}
