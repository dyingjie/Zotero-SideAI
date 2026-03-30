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

type HighlightRule = {
  pattern: RegExp;
  type: "comment" | "keyword" | "number" | "property" | "string";
};

const HIGHLIGHT_RULES: Record<string, HighlightRule[]> = {
  bash: [
    {
      pattern: /(^|\s)(#.*$)/gm,
      type: "comment"
    },
    {
      pattern:
        /\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|in|export|local|return)\b/g,
      type: "keyword"
    },
    {
      pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g,
      type: "string"
    },
    {
      pattern: /\b\d+(\.\d+)?\b/g,
      type: "number"
    }
  ],
  javascript: [
    {
      pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      type: "comment"
    },
    {
      pattern:
        /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|throw|new|await|async|class|extends|import|export|from|default|true|false|null|undefined)\b/g,
      type: "keyword"
    },
    {
      pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g,
      type: "string"
    },
    {
      pattern: /\b\d+(\.\d+)?\b/g,
      type: "number"
    }
  ],
  json: [
    {
      pattern: /"([^"\\]|\\.)*"(?=\s*:)/g,
      type: "property"
    },
    {
      pattern: /"([^"\\]|\\.)*"/g,
      type: "string"
    },
    {
      pattern: /\b(true|false|null)\b/g,
      type: "keyword"
    },
    {
      pattern: /\b-?\d+(\.\d+)?\b/g,
      type: "number"
    }
  ],
  python: [
    {
      pattern: /(#.*$)/gm,
      type: "comment"
    },
    {
      pattern:
        /\b(def|class|return|if|elif|else|for|while|try|except|finally|import|from|as|with|yield|await|async|lambda|pass|break|continue|True|False|None|and|or|not|in|is)\b/g,
      type: "keyword"
    },
    {
      pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g,
      type: "string"
    },
    {
      pattern: /\b\d+(\.\d+)?\b/g,
      type: "number"
    }
  ],
  typescript: [
    {
      pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      type: "comment"
    },
    {
      pattern:
        /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|try|catch|throw|new|await|async|class|extends|implements|interface|type|public|private|protected|readonly|import|export|from|default|true|false|null|undefined)\b/g,
      type: "keyword"
    },
    {
      pattern: /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g,
      type: "string"
    },
    {
      pattern: /\b\d+(\.\d+)?\b/g,
      type: "number"
    }
  ]
};

const LANGUAGE_ALIASES: Record<string, string> = {
  cjs: "javascript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml"
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

type TokenRange = {
  end: number;
  start: number;
  type: HighlightRule["type"];
};

function collectTokenRanges(text: string, rules: HighlightRule[]): TokenRange[] {
  const ranges: TokenRange[] = [];

  for (const rule of rules) {
    for (const match of text.matchAll(rule.pattern)) {
      const fullMatch = match[0];
      const matchIndex = match.index ?? -1;
      if (matchIndex < 0 || !fullMatch) {
        continue;
      }

      let start = matchIndex;
      let matchedText = fullMatch;

      if (rule.type === "comment" && match.length > 2 && match[2]) {
        start = matchIndex + fullMatch.indexOf(match[2]);
        matchedText = match[2];
      }

      ranges.push({
        end: start + matchedText.length,
        start,
        type: rule.type
      });
    }
  }

  return ranges.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.end - left.end;
  });
}

export function highlightCode(language: string, text: string): string {
  const rules = HIGHLIGHT_RULES[normalizeLanguage(language)];
  const escapedText = escapeHtml(text);

  if (!rules?.length || !text) {
    return escapedText;
  }

  const ranges = collectTokenRanges(text, rules);
  const acceptedRanges: TokenRange[] = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start < cursor) {
      return;
    }

    acceptedRanges.push(range);
    cursor = range.end;
  });

  let html = "";
  let lastIndex = 0;

  acceptedRanges.forEach((range) => {
    if (range.start > lastIndex) {
      html += escapeHtml(text.slice(lastIndex, range.start));
    }

    html += `<span class="sideai-token-${range.type}">${escapeHtml(
      text.slice(range.start, range.end)
    )}</span>`;
    lastIndex = range.end;
  });

  if (lastIndex < text.length) {
    html += escapeHtml(text.slice(lastIndex));
  }

  return html;
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
        const normalizedLanguage = normalizeLanguage(block.language);
        const languageLabel = block.language
          ? ` data-language="${escapeHtml(normalizedLanguage)}"`
          : "";
        const languageBadge = normalizedLanguage
          ? `<div class="sideai-output-code-header">${escapeHtml(
              normalizedLanguage
            )}</div>`
          : "";

        return `<pre class="sideai-output-code">${languageBadge}<code${languageLabel}>${highlightCode(normalizedLanguage, block.text)}</code></pre>`;
      }

      return `<p class="sideai-output-paragraph">${escapeHtml(block.text).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}
