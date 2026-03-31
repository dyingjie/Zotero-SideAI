import MarkdownIt from "markdown-it";
import katex from "katex";

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

function renderMathFormula(latex: string, displayMode: boolean): string {
  try {
    const math = katex.renderToString(latex, {
      displayMode,
      output: "mathml",
      strict: "ignore",
      throwOnError: false
    });
    return displayMode
      ? `<div class="sideai-output-math-block">${math}</div>`
      : `<span class="sideai-output-math-inline">${math}</span>`;
  } catch {
    return displayMode
      ? `<div class="sideai-output-math-block">${escapeHtml(latex)}</div>`
      : `<span class="sideai-output-math-inline">${escapeHtml(latex)}</span>`;
  }
}

function createMathPlugin() {
  return (markdown: MarkdownIt): void => {
    markdown.inline.ruler.after("escape", "sideai_math_inline", (state, silent) => {
      if (state.src.charCodeAt(state.pos) !== 0x24) {
        return false;
      }

      if (state.src.charCodeAt(state.pos + 1) === 0x24) {
        return false;
      }

      let start = state.pos + 1;
      let end = start;

      while ((end = state.src.indexOf("$", end)) !== -1) {
        if (state.src.charCodeAt(end - 1) === 0x5c) {
          end += 1;
          continue;
        }

        if (end === start || state.src.charCodeAt(end + 1) === 0x24) {
          end += 1;
          continue;
        }

        if (!silent) {
          const token = state.push("math_inline", "math", 0);
          token.content = state.src.slice(start, end);
        }

        state.pos = end + 1;
        return true;
      }

      return false;
    });

    markdown.block.ruler.after(
      "blockquote",
      "sideai_math_block",
      (state, startLine, endLine, silent) => {
        const start = state.bMarks[startLine] + state.tShift[startLine];
        const max = state.eMarks[startLine];

        if (state.src.slice(start, max).trim() !== "$$") {
          return false;
        }

        let nextLine = startLine + 1;
        let found = false;

        while (nextLine < endLine) {
          const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
          const lineEnd = state.eMarks[nextLine];

          if (state.src.slice(lineStart, lineEnd).trim() === "$$") {
            found = true;
            break;
          }

          nextLine += 1;
        }

        if (!found) {
          return false;
        }

        if (silent) {
          return true;
        }

        const token = state.push("math_block", "math", 0);
        const contentStart = state.bMarks[startLine + 1] + state.tShift[startLine + 1];
        const contentEnd = state.eMarks[nextLine - 1];
        token.block = true;
        token.content =
          nextLine === startLine + 1
            ? ""
            : state.src.slice(contentStart, contentEnd).replace(/\n$/, "");
        token.map = [startLine, nextLine + 1];
        state.line = nextLine + 1;
        return true;
      },
      {
        alt: ["paragraph", "reference", "blockquote", "list"]
      }
    );
  };
}

const markdownRenderer = new MarkdownIt({
  breaks: true,
  highlight: (code: string, language: string) => {
    const normalizedLanguage = normalizeLanguage(language || "");
    const normalizedCode = code.replace(/\n$/, "");
    const languageAttr = normalizedLanguage
      ? ` data-language="${escapeHtml(normalizedLanguage)}"`
      : "";
    const languageBadge = normalizedLanguage
      ? `<div class="sideai-output-code-header">${escapeHtml(
          normalizedLanguage
        )}</div>`
      : "";

    return `<pre class="sideai-output-code">${languageBadge}<code${languageAttr}>${highlightCode(
      normalizedLanguage,
      normalizedCode
    )}</code></pre>`;
  },
  html: false,
  linkify: true,
  typographer: false,
  xhtmlOut: true
});

markdownRenderer.use(createMathPlugin());

markdownRenderer.renderer.rules.math_inline = (tokens, idx) => {
  return renderMathFormula(tokens[idx].content, false);
};

markdownRenderer.renderer.rules.math_block = (tokens, idx) => {
  return `${renderMathFormula(tokens[idx].content, true)}\n`;
};

markdownRenderer.renderer.rules.code_inline = (tokens, idx) => {
  return `<code class="sideai-output-inline-code">${escapeHtml(
    tokens[idx].content
  )}</code>`;
};

markdownRenderer.renderer.rules.paragraph_open = (tokens, idx) =>
  tokens[idx].hidden ? "" : '<p class="sideai-output-paragraph">';
markdownRenderer.renderer.rules.paragraph_close = (tokens, idx) =>
  tokens[idx].hidden ? "" : "</p>";
markdownRenderer.renderer.rules.heading_open = (tokens, idx) => {
  const tag = tokens[idx].tag;
  return `<${tag} class="sideai-output-heading sideai-output-heading-${tag.slice(
    1
  )}">`;
};
markdownRenderer.renderer.rules.bullet_list_open = () =>
  '<ul class="sideai-output-list">';
markdownRenderer.renderer.rules.ordered_list_open = () =>
  '<ol class="sideai-output-list">';
markdownRenderer.renderer.rules.blockquote_open = () =>
  '<blockquote class="sideai-output-blockquote">';
markdownRenderer.renderer.rules.table_open = () =>
  '<table class="sideai-output-table">';
markdownRenderer.renderer.rules.link_open = (
  tokens,
  idx: number,
  options,
  env,
  self
) => {
  const token = tokens[idx];
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noreferrer noopener");
  token.attrJoin("class", "sideai-output-link");
  void env;
  return self.renderToken(tokens, idx, options);
};

export function renderMarkdownPreviewHtml(markdown: string): string {
  return markdownRenderer.render(markdown);
}
