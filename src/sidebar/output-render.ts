export type OutputBlock =
  | {
      text: string;
      type: "paragraph";
    }
  | {
      language: string;
      text: string;
      type: "code";
    };

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseMarkdownBlocks(markdown: string): OutputBlock[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const blocks: OutputBlock[] = [];
  const codeFencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;

  function pushParagraphs(text: string): void {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    paragraphs.forEach((paragraph) => {
      blocks.push({
        text: paragraph,
        type: "paragraph"
      });
    });
  }

  for (const match of normalized.matchAll(codeFencePattern)) {
    const matchIndex = match.index || 0;
    pushParagraphs(normalized.slice(lastIndex, matchIndex));
    blocks.push({
      language: (match[1] || "").trim(),
      text: (match[2] || "").replace(/\n$/, ""),
      type: "code"
    });
    lastIndex = matchIndex + match[0].length;
  }

  pushParagraphs(normalized.slice(lastIndex));
  return blocks;
}

export function renderMarkdownPreviewHtml(markdown: string): string {
  return parseMarkdownBlocks(markdown)
    .map((block) => {
      if (block.type === "code") {
        const languageLabel = block.language
          ? ` data-language="${escapeHtml(block.language)}"`
          : "";

        return `<pre class="sideai-output-code"><code${languageLabel}>${escapeHtml(block.text)}</code></pre>`;
      }

      return `<p class="sideai-output-paragraph">${escapeHtml(block.text).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}
