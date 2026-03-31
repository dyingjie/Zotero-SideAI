export type ReaderSelectionLike = {
  _iframeWindow?: {
    getSelection?: () => Selection | { toString(): string } | null;
  };
};

export function normalizePDFSelectionText(text: string): string {
  return text.replace(/\u00a0/g, " ").trim();
}

export function getReaderSelectionText(
  reader?: ReaderSelectionLike | null
): string {
  if (!reader?._iframeWindow?.getSelection) {
    return "";
  }

  try {
    const selection = reader._iframeWindow.getSelection();
    const text =
      selection && typeof selection.toString === "function"
        ? selection.toString()
        : "";

    return normalizePDFSelectionText(text);
  } catch {
    return "";
  }
}
