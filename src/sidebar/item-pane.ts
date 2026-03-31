import { getSavedApiKey } from "../settings/api-key";
import {
  getDefaultBaseUrl,
  getSavedBaseUrl
} from "../settings/base-url";
import { getDefaultModel, getSavedModel } from "../settings/model";
import {
  addPromptPreset,
  deletePromptPreset,
  getSavedPromptPresets,
  getSelectedPromptPreset,
  getSelectedPromptPresetId,
  savePromptPresets,
  saveSelectedPromptPresetId,
  updatePromptPreset,
  type PromptPreset
} from "../settings/prompt-presets";
import {
  getDefaultSystemPrompt,
  getSavedSystemPrompt
} from "../settings/system-prompt";
import { resetPromptPresetsToDefaults } from "../settings/reset";
import { type ConfigFeedbackTone } from "./config-feedback";
import {
  getMissingConfigFields,
  getMissingConfigMessage
} from "./send-validation";
import {
  requestChatCompletionsText
} from "../services/ai-request";
import type { ChatCompletionMessage } from "../services/chat-completions";
import {
  buildPreviewMessages,
  formatPreviewMessages
} from "../services/request-preview";
import {
  buildPreviewTextFromContext,
  type CurrentTextContext,
  mergeNotePreviewTexts
} from "./context-preview";
import {
  appendChatMessage,
  buildChatMessageEntry,
  removeLoadingChatMessages,
  type ChatMessageEntry
} from "./chat-stream";
import { renderMarkdownPreviewHtml } from "./output-render";
import {
  getItemSessionHistory,
  getItemSessionKey,
  setItemSessionHistory,
  type ItemSessionMap
} from "./item-session";
import {
  loadPersistedChatSessions,
  savePersistedChatSessions
} from "./chat-session-storage";
import {
  appendHistoryEntry,
  buildHistoryEntry,
  type OutputRenderMode,
  type SessionHistoryEntry
} from "./session-history";
import { getPaneLayoutProfile } from "./layout-profile";
import {
  type PaneState,
  shouldEnableSendButton,
  shouldStartSendRequest
} from "./pane-state";
import { resolvePaneContext } from "./pane-context";
import { getReaderSelectionText } from "./pdf-selection";

const SIDEBAR_PANE_ID = "sideai-panel";
const OUTPUT_PLACEHOLDER =
  "发送请求后，AI 回复会显示在这里。";
const DEBUG_BUILD_MARK = "2026-03-31-r3";

let registeredPaneKey: false | string = false;
const paneContextStore = new WeakMap<HTMLDivElement, CurrentTextContext>();
const paneSessionStore = new WeakMap<HTMLDivElement, ItemSessionMap<SessionHistoryEntry>>();
const paneChatStore = new WeakMap<HTMLDivElement, ItemSessionMap<ChatMessageEntry>>();
const paneActiveSessionKeyStore = new WeakMap<HTMLDivElement, string | null>();

function getSessionMap(
  body: HTMLDivElement
): ItemSessionMap<SessionHistoryEntry> {
  return paneSessionStore.get(body) || {};
}

function getSessionHistory(body: HTMLDivElement): SessionHistoryEntry[] {
  return getItemSessionHistory(
    getSessionMap(body),
    paneActiveSessionKeyStore.get(body) || null
  );
}

function getChatSessionMap(
  body: HTMLDivElement
): ItemSessionMap<ChatMessageEntry> {
  return paneChatStore.get(body) || {};
}

function getChatMessages(body: HTMLDivElement): ChatMessageEntry[] {
  return getItemSessionHistory(
    getChatSessionMap(body),
    paneActiveSessionKeyStore.get(body) || null
  );
}

function pushSessionHistory(
  body: HTMLDivElement,
  entry: SessionHistoryEntry
): SessionHistoryEntry[] {
  const nextHistory = appendHistoryEntry(getSessionHistory(body), entry);
  const nextSessionMap = setItemSessionHistory(
    getSessionMap(body),
    paneActiveSessionKeyStore.get(body) || null,
    nextHistory
  );
  paneSessionStore.set(
    body,
    nextSessionMap
  );
  savePersistedChatSessions({
    chats: getChatSessionMap(body),
    history: nextSessionMap
  });
  return nextHistory;
}

function setChatMessages(
  body: HTMLDivElement,
  messages: ChatMessageEntry[]
): ChatMessageEntry[] {
  const nextChatMap = setItemSessionHistory(
    getChatSessionMap(body),
    paneActiveSessionKeyStore.get(body) || null,
    messages
  );
  paneChatStore.set(
    body,
    nextChatMap
  );
  savePersistedChatSessions({
    chats: nextChatMap,
    history: getSessionMap(body)
  });

  return messages;
}

function pushChatMessage(
  body: HTMLDivElement,
  entry: ChatMessageEntry
): ChatMessageEntry[] {
  return setChatMessages(body, appendChatMessage(getChatMessages(body), entry));
}

function applyPaneLayout(body: HTMLDivElement): void {
  const paneWidth = body.clientWidth || body.getBoundingClientRect().width;
  const layoutProfile = getPaneLayoutProfile(paneWidth);
  const root = body.querySelector(".sideai-pane-root") as HTMLDivElement | null;
  const cards = body.querySelectorAll(".sideai-pane-card");
  const mutedBlocks = body.querySelectorAll(".sideai-pane-muted");
  const sections = body.querySelectorAll(".sideai-pane-section");
  const chatSection = body.querySelector(
    "[data-sideai-section='chat']"
  ) as HTMLDivElement | null;
  const chatCard = body.querySelector(
    "[data-sideai-section='chat'] .sideai-pane-card"
  ) as HTMLDivElement | null;
  const composerSection = body.querySelector(
    "[data-sideai-section='composer']"
  ) as HTMLDivElement | null;
  const actions = body.querySelector(".sideai-pane-actions") as HTMLDivElement | null;
  const buttons = body.querySelectorAll("button");
  const state = body.querySelector(".sideai-pane-state") as HTMLDivElement | null;
  const title = body.querySelector(".sideai-pane-title") as HTMLDivElement | null;
  const configGrid = body.querySelector(".sideai-config-grid") as HTMLDivElement | null;
  const configRows = body.querySelectorAll(".sideai-config-row");
  const labels = body.querySelectorAll(".sideai-config-label");
  const inputs = body.querySelectorAll(".sideai-config-input");
  const textareas = body.querySelectorAll(".sideai-config-textarea");
  const outputBadge = body.querySelector(
    "[data-sideai-role='output-badge']"
  ) as HTMLDivElement | null;
  const configFeedback = body.querySelector(
    "[data-sideai-role='config-feedback']"
  ) as HTMLDivElement | null;

  if (root) {
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = layoutProfile.rootGap;
    root.style.width = "100%";
    root.style.height = "100%";
    root.style.minHeight = "100%";
    root.style.boxSizing = "border-box";
    root.style.overflowX = "hidden";
    root.style.padding = "2px 0";
  }

  if (state) {
    state.style.fontSize = "12px";
    state.style.fontWeight = "600";
    state.style.padding = "6px 8px";
    state.style.borderRadius = "6px";
    state.style.background = "var(--fill-quinary, rgba(0,0,0,0.05))";
    state.style.overflowWrap = "anywhere";
  }

  if (title) {
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";
    title.style.overflowWrap = "anywhere";
  }

  sections.forEach((section: Element) => {
    const element = section as HTMLDivElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.gap = "4px";
    element.style.minWidth = "0";
  });

  if (chatSection) {
    chatSection.style.flex = "1 1 auto";
    chatSection.style.minHeight = "260px";
  }

  if (chatCard) {
    chatCard.style.display = "flex";
    chatCard.style.flexDirection = "column";
    chatCard.style.flex = "1 1 auto";
    chatCard.style.minHeight = "220px";
  }

  if (composerSection) {
    composerSection.style.flex = "0 0 auto";
  }

  cards.forEach((card: Element) => {
    const element = card as HTMLDivElement;
    element.style.padding = layoutProfile.cardPadding;
    element.style.borderRadius = "8px";
    element.style.boxSizing = "border-box";
    element.style.background = "var(--fill-quinary, rgba(0,0,0,0.05))";
    element.style.border = "1px solid var(--fill-tertiary, rgba(0,0,0,0.08))";
    element.style.minWidth = "0";
    element.style.overflowWrap = "anywhere";
  });

  mutedBlocks.forEach((block: Element) => {
    const element = block as HTMLDivElement;
    element.style.fontSize = "12px";
    element.style.lineHeight = "1.45";
    element.style.color = "var(--text-color-deemphasized, #666)";
    element.style.whiteSpace = "pre-wrap";
    element.style.overflowWrap = "anywhere";
  });

  const contextPreview = body.querySelector(
    "[data-sideai-role='context-preview']"
  ) as HTMLDivElement | null;
  const outputPreview = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const requestPreview = body.querySelector(
    "[data-sideai-role='request-preview']"
  ) as HTMLDivElement | null;
  const outputParagraphs = body.querySelectorAll(".sideai-output-paragraph");
  const outputHeadings = body.querySelectorAll(".sideai-output-heading");
  const outputLists = body.querySelectorAll(".sideai-output-list");
  const outputInlineCodes = body.querySelectorAll(".sideai-output-inline-code");
  const outputBlockquotes = body.querySelectorAll(".sideai-output-blockquote");
  const outputTables = body.querySelectorAll(".sideai-output-table");
  const outputLinks = body.querySelectorAll(".sideai-output-link");
  const outputMathInline = body.querySelectorAll(".sideai-output-math-inline");
  const outputMathBlocks = body.querySelectorAll(".sideai-output-math-block");
  const outputCodeBlocks = body.querySelectorAll(".sideai-output-code");
  const outputCodeHeaders = body.querySelectorAll(".sideai-output-code-header");
  const outputCodeElements = body.querySelectorAll(".sideai-output-code code");
  const historyList = body.querySelector(
    "[data-sideai-role='history-list']"
  ) as HTMLDivElement | null;
  const historyItems = body.querySelectorAll(".sideai-history-item");
  const historyBadges = body.querySelectorAll(".sideai-history-badge");
  const historyButtons = body.querySelectorAll(".sideai-history-open");
  const commentTokens = body.querySelectorAll(".sideai-token-comment");
  const keywordTokens = body.querySelectorAll(".sideai-token-keyword");
  const numberTokens = body.querySelectorAll(".sideai-token-number");
  const propertyTokens = body.querySelectorAll(".sideai-token-property");
  const stringTokens = body.querySelectorAll(".sideai-token-string");
  const chatStream = body.querySelector(
    "[data-sideai-role='chat-stream']"
  ) as HTMLDivElement | null;
  const chatMessages = body.querySelectorAll(".sideai-chat-message");
  const chatRoles = body.querySelectorAll(".sideai-chat-role");
  const retryButtons = body.querySelectorAll(".sideai-chat-retry");

  if (contextPreview) {
    contextPreview.style.maxHeight = layoutProfile.contextMaxHeight;
    contextPreview.style.overflowY = "auto";
  }

  if (outputPreview) {
    outputPreview.style.flex = "1 1 auto";
    outputPreview.style.minHeight = "220px";
    outputPreview.style.maxHeight = "none";
    outputPreview.style.overflowY = "auto";
    outputPreview.style.overflowWrap = "anywhere";
    outputPreview.style.lineHeight = "1.5";
    outputPreview.style.padding = "2px";
    outputPreview.style.marginTop = "4px";
  }

  if (chatStream) {
    chatStream.style.display = "flex";
    chatStream.style.flexDirection = "column";
    chatStream.style.gap = "18px";
    chatStream.style.paddingBottom = "10px";
  }

  chatMessages.forEach((message: Element) => {
    const element = message as HTMLDivElement;
    const role = element.dataset.sideaiRole || "assistant";
    const tone = element.dataset.sideaiTone || "default";
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.gap = "6px";
    element.style.padding = "10px 12px";
    element.style.borderRadius = "14px";
    element.style.border = "1px solid var(--fill-tertiary, rgba(0,0,0,0.08))";
    element.style.maxWidth = role === "status" ? "100%" : "92%";
    element.style.alignSelf =
      role === "user"
        ? "flex-end"
        : role === "status"
          ? "center"
          : "flex-start";
    element.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
    element.style.marginTop = "2px";
    element.style.marginBottom = "2px";
    element.style.background =
      role === "user"
        ? "rgba(32, 98, 180, 0.12)"
        : tone === "error"
          ? "rgba(208, 64, 64, 0.08)"
          : tone === "loading"
            ? "rgba(180, 120, 32, 0.08)"
            : "rgba(255,255,255,0.72)";
  });

  chatRoles.forEach((roleLabel: Element) => {
    const element = roleLabel as HTMLDivElement;
    element.style.fontSize = "11px";
    element.style.fontWeight = "600";
    element.style.textTransform = "none";
    element.style.letterSpacing = "0.02em";
    element.style.color = "var(--text-color-deemphasized, #666)";
  });

  retryButtons.forEach((button: Element) => {
    const element = button as HTMLButtonElement;
    element.style.alignSelf = "flex-start";
    element.style.minHeight = "28px";
  });

  outputParagraphs.forEach((paragraph: Element) => {
    const element = paragraph as HTMLParagraphElement;
    element.style.margin = "0 0 14px";
    element.style.whiteSpace = "normal";
  });

  outputHeadings.forEach((heading: Element) => {
    const element = heading as HTMLElement;
    element.style.margin = "0 0 12px";
    element.style.fontWeight = "700";
    element.style.lineHeight = "1.35";
  });

  outputLists.forEach((list: Element) => {
    const element = list as HTMLOListElement | HTMLUListElement;
    element.style.margin = "0 0 14px 20px";
    element.style.padding = "0";
    element.style.lineHeight = "1.5";
  });

  outputInlineCodes.forEach((inlineCode: Element) => {
    const element = inlineCode as HTMLElement;
    element.style.padding = "1px 4px";
    element.style.borderRadius = "4px";
    element.style.background = "var(--fill-tertiary, rgba(0,0,0,0.08))";
    element.style.fontFamily = "monospace";
    element.style.fontSize = "11px";
  });

  outputBlockquotes.forEach((blockquote: Element) => {
    const element = blockquote as HTMLElement;
    element.style.margin = "0 0 14px";
    element.style.padding = "8px 10px";
    element.style.borderLeft = "3px solid rgba(32, 98, 180, 0.25)";
    element.style.background = "rgba(32, 98, 180, 0.04)";
  });

  outputTables.forEach((table: Element) => {
    const element = table as HTMLTableElement;
    element.style.width = "100%";
    element.style.margin = "0 0 14px";
    element.style.borderCollapse = "collapse";
    element.style.fontSize = "12px";
    element.style.display = "block";
    element.style.overflowX = "auto";
  });

  outputLinks.forEach((link: Element) => {
    const element = link as HTMLAnchorElement;
    element.style.color = "#2062b4";
    element.style.textDecoration = "underline";
  });

  outputMathInline.forEach((inlineMath: Element) => {
    const element = inlineMath as HTMLElement;
    element.style.display = "inline-block";
    element.style.padding = "0 2px";
    element.style.verticalAlign = "middle";
  });

  outputMathBlocks.forEach((blockMath: Element) => {
    const element = blockMath as HTMLElement;
    element.style.display = "block";
    element.style.margin = "0 0 14px";
    element.style.padding = "8px 0";
    element.style.overflowX = "auto";
    element.style.textAlign = "center";
  });

  outputCodeBlocks.forEach((codeBlock: Element) => {
    const element = codeBlock as HTMLPreElement;
    element.style.margin = "0";
    element.style.padding = "0";
    element.style.borderRadius = "6px";
    element.style.overflowX = "auto";
    element.style.background = "var(--fill-tertiary, rgba(0,0,0,0.08))";
    element.style.border = "1px solid var(--fill-secondary, rgba(0,0,0,0.12))";
  });

  outputCodeHeaders.forEach((header: Element) => {
    const element = header as HTMLDivElement;
    element.style.padding = "6px 8px";
    element.style.fontSize = "11px";
    element.style.fontWeight = "600";
    element.style.textTransform = "uppercase";
    element.style.letterSpacing = "0.04em";
    element.style.borderBottom = "1px solid var(--fill-secondary, rgba(0,0,0,0.12))";
    element.style.color = "var(--text-color-deemphasized, #666)";
  });

  outputCodeElements.forEach((codeElement: Element) => {
    const element = codeElement as HTMLElement;
    element.style.display = "block";
    element.style.padding = "8px";
    element.style.whiteSpace = "pre";
    element.style.fontFamily = "monospace";
    element.style.fontSize = "12px";
    element.style.lineHeight = "1.5";
  });

  commentTokens.forEach((token: Element) => {
    const element = token as HTMLElement;
    element.style.color = "#6a737d";
    element.style.fontStyle = "italic";
  });

  keywordTokens.forEach((token: Element) => {
    const element = token as HTMLElement;
    element.style.color = "#b31d28";
    element.style.fontWeight = "600";
  });

  numberTokens.forEach((token: Element) => {
    const element = token as HTMLElement;
    element.style.color = "#005cc5";
  });

  propertyTokens.forEach((token: Element) => {
    const element = token as HTMLElement;
    element.style.color = "#6f42c1";
  });

  stringTokens.forEach((token: Element) => {
    const element = token as HTMLElement;
    element.style.color = "#22863a";
  });

  if (requestPreview) {
    requestPreview.style.minHeight = "64px";
    requestPreview.style.maxHeight = layoutProfile.requestMaxHeight;
    requestPreview.style.overflowY = "auto";
    requestPreview.style.whiteSpace = "pre-wrap";
    requestPreview.style.overflowWrap = "anywhere";
  }

  if (historyList) {
    historyList.style.display = "flex";
    historyList.style.flexDirection = "column";
    historyList.style.gap = "6px";
    historyList.style.maxHeight = layoutProfile.historyMaxHeight;
    historyList.style.overflowY = "auto";
  }

  historyItems.forEach((item: Element) => {
    const element = item as HTMLDivElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.gap = "4px";
    element.style.padding = "8px";
    element.style.borderRadius = "6px";
    element.style.background = "var(--fill-tertiary, rgba(0,0,0,0.06))";
    element.style.border = "1px solid var(--fill-secondary, rgba(0,0,0,0.12))";
  });

  historyBadges.forEach((badge: Element) => {
    const element = badge as HTMLDivElement;
    element.style.display = "inline-flex";
    element.style.width = "fit-content";
    element.style.padding = "2px 6px";
    element.style.borderRadius = "999px";
    element.style.fontSize = "10px";
    element.style.fontWeight = "600";
    element.style.background =
      element.dataset.sideaiStatus === "error"
        ? "rgba(208, 64, 64, 0.12)"
        : "rgba(46, 125, 50, 0.12)";
    element.style.color =
      element.dataset.sideaiStatus === "error"
        ? "var(--accent-red, #a12622)"
        : "var(--accent-green, #2e7d32)";
  });

  historyButtons.forEach((button: Element) => {
    const element = button as HTMLButtonElement;
    element.style.alignSelf = "flex-start";
    element.style.flex = "0 0 auto";
  });

  if (outputBadge) {
    outputBadge.style.display = "inline-flex";
    outputBadge.style.alignItems = "center";
    outputBadge.style.width = "fit-content";
    outputBadge.style.maxWidth = "100%";
    outputBadge.style.padding = "2px 8px";
    outputBadge.style.marginBottom = "8px";
    outputBadge.style.borderRadius = "999px";
    outputBadge.style.fontSize = "11px";
    outputBadge.style.fontWeight = "600";
    outputBadge.style.background = "rgba(32, 98, 180, 0.08)";
  }

  if (configFeedback) {
    const tone = configFeedback.dataset.sideaiTone || "neutral";
    configFeedback.style.padding = "6px 8px";
    configFeedback.style.borderRadius = "6px";
    configFeedback.style.fontSize = "12px";
    configFeedback.style.lineHeight = "1.4";
    configFeedback.style.whiteSpace = "pre-wrap";
    configFeedback.style.overflowWrap = "anywhere";
    configFeedback.style.border = "1px solid var(--fill-tertiary, rgba(0,0,0,0.08))";
    configFeedback.style.background =
      tone === "error"
        ? "rgba(208, 64, 64, 0.12)"
        : tone === "success"
          ? "rgba(46, 125, 50, 0.12)"
          : "var(--fill-quinary, rgba(0,0,0,0.05))";
    configFeedback.style.color =
      tone === "error"
        ? "var(--accent-red, #a12622)"
        : tone === "success"
          ? "var(--accent-green, #2e7d32)"
          : "var(--text-color-deemphasized, #666)";
  }

  if (actions) {
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = layoutProfile.actionsGap;
    actions.style.width = "100%";
  }

  buttons.forEach((button: Element) => {
    const element = button as HTMLButtonElement;
    element.style.flex = layoutProfile.buttonFlex;
    element.style.minWidth = "0";
    element.style.maxWidth = "100%";
    element.style.minHeight = layoutProfile.buttonMinHeight;
    element.style.whiteSpace = layoutProfile.buttonWhiteSpace;
    element.style.overflow = "hidden";
    element.style.textOverflow = "ellipsis";
  });

  if (configGrid) {
    configGrid.style.display = "flex";
    configGrid.style.flexDirection = "column";
    configGrid.style.gap = layoutProfile.configGap;
    configGrid.style.width = "100%";
  }

  configRows.forEach((row: Element) => {
    const element = row as HTMLDivElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.gap = "4px";
    element.style.minWidth = "0";
  });

  labels.forEach((label: Element) => {
    const element = label as HTMLLabelElement;
    element.style.fontSize = "12px";
    element.style.fontWeight = "600";
    element.style.overflowWrap = "anywhere";
  });

  inputs.forEach((input: Element) => {
    const element = input as HTMLInputElement;
    element.style.width = "100%";
    element.style.minWidth = "0";
    element.style.boxSizing = "border-box";
    element.style.padding = "6px 8px";
    element.style.borderRadius = "6px";
  });

  textareas.forEach((textarea: Element) => {
    const element = textarea as HTMLTextAreaElement;
    element.style.width = "100%";
    element.style.minWidth = "0";
    element.style.minHeight = layoutProfile.textareaMinHeight;
    element.style.boxSizing = "border-box";
    element.style.padding = "8px";
    element.style.borderRadius = "6px";
    element.style.resize = "vertical";
    element.style.lineHeight = "1.4";
  });
}

function getItemTitle(item?: Zotero.Item): string {
  if (!item) {
    return "未选择条目";
  }

  const title = item.getField("title");
  return typeof title === "string" && title.trim()
    ? title.trim()
    : "未命名条目";
}

function buildCurrentTextContext(item?: Zotero.Item): CurrentTextContext {
  if (!item) {
    return {
      abstractText: "",
      contextSource: "item",
      contextSourceLabel: "条目上下文",
      contextWarnings: [],
      notesText: "",
      pdfSelectionText: "",
      previewText: "当前没有可用文本。",
      title: "未选择条目"
    };
  }

  const title = getItemTitle(item);
  const abstractText = item.getField("abstractNote");
  const noteIDs =
    typeof item.getNotes === "function" ? (item.getNotes() as number[]) : [];
  const normalizedAbstractText =
    typeof abstractText === "string" ? abstractText.trim() : "";
  let notesText = "";

  if (noteIDs.length) {
    const noteItems = Zotero.Items.get(noteIDs) as Zotero.Item[];
    notesText = mergeNotePreviewTexts(
      noteItems.map((noteItem) => noteItem.getNote?.() || "")
    );
  }

  const previewText = buildPreviewTextFromContext({
    abstractText: normalizedAbstractText,
    notesText,
    pdfSelectionText: "",
    title
  });

  return {
    abstractText: normalizedAbstractText,
    contextSource: "item",
    contextSourceLabel: "条目上下文",
    contextWarnings: [],
    notesText,
    pdfSelectionText: "",
    previewText: previewText || "当前条目暂无可发送的预览文本。",
    title
  };
}

function buildCurrentTextPreview(item?: Zotero.Item): string {
  return buildCurrentTextContext(item).previewText;
}

function setPaneState(
  body: HTMLDivElement,
  state: PaneState,
  message?: string
): void {
  const stateElement = body.querySelector(
    "[data-sideai-role='panel-state']"
  ) as HTMLDivElement | null;
  const actionStatusElement = body.querySelector(
    "[data-sideai-role='action-status']"
  ) as HTMLDivElement | null;
  const sendButton = body.querySelector(
    "[data-sideai-role='send-button']"
  ) as HTMLButtonElement | null;
  const copyButton = body.querySelector(
    "[data-sideai-role='copy-button']"
  ) as HTMLButtonElement | null;
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const outputBadgeElement = body.querySelector(
    "[data-sideai-role='output-badge']"
  ) as HTMLDivElement | null;

  body.setAttribute("data-sideai-state", state);

  if (stateElement) {
    stateElement.textContent =
      state === "empty"
        ? "未选择条目。"
        : state === "loading"
          ? "加载中..."
          : state === "error"
            ? `错误：${message || "未知错误"}`
            : "就绪";
  }

  if (actionStatusElement) {
    actionStatusElement.textContent =
      state === "empty"
        ? "请选择一个条目开始使用。"
        : state === "loading"
          ? "请求处理中。"
          : state === "error"
            ? message || "发生错误。"
            : "面板已就绪，可以发送消息。";
  }

  if (sendButton) {
    sendButton.disabled = !shouldEnableSendButton(state);
  }

  if (copyButton) {
    const hasOutput = !!outputPreviewElement?.textContent?.trim();
    copyButton.disabled = state === "loading" || !hasOutput;
  }

  if (outputBadgeElement) {
    outputBadgeElement.textContent =
      state === "loading"
        ? `加载中 · ${DEBUG_BUILD_MARK}`
        : state === "error"
          ? `错误 · ${DEBUG_BUILD_MARK}`
          : state === "empty"
            ? `空闲 · ${DEBUG_BUILD_MARK}`
            : `就绪 · ${DEBUG_BUILD_MARK}`;
  }
}

function describeUnknownError(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof Error) {
    const name = error.name?.trim() || "Error";
    const detail = error.message?.trim() || fallbackMessage;
    return `${name}: ${detail}`;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error) {
    try {
      return JSON.stringify(error);
    } catch {
      return fallbackMessage;
    }
  }

  return fallbackMessage;
}

function getSystemPromptInput(body: HTMLDivElement): HTMLTextAreaElement | null {
  return body.querySelector("#sideai-system-prompt") as HTMLTextAreaElement | null;
}

function getPromptPresetSelect(body: HTMLDivElement): HTMLSelectElement | null {
  return body.querySelector("#sideai-prompt-preset") as HTMLSelectElement | null;
}

function getCurrentPromptPresetId(body: HTMLDivElement): string {
  const promptPresetSelect = getPromptPresetSelect(body);
  const selectedValue = promptPresetSelect?.value;

  if (typeof selectedValue === "string" && selectedValue.trim()) {
    return selectedValue.trim();
  }

  const selectedOption =
    (promptPresetSelect?.selectedOptions?.[0] as HTMLOptionElement | undefined) ||
    (typeof promptPresetSelect?.selectedIndex === "number" &&
    promptPresetSelect.selectedIndex >= 0
      ? (promptPresetSelect.options[
          promptPresetSelect.selectedIndex
        ] as HTMLOptionElement | undefined)
      : undefined);
  const optionValue = selectedOption?.value;

  if (typeof optionValue === "string" && optionValue.trim()) {
    return optionValue.trim();
  }

  return getSelectedPromptPresetId();
}

function getPromptPresetLabelInput(
  body: HTMLDivElement
): HTMLInputElement | null {
  return body.querySelector("#sideai-prompt-preset-label") as HTMLInputElement | null;
}

function getComposerInput(body: HTMLDivElement): HTMLTextAreaElement | null {
  return body.querySelector("#sideai-composer") as HTMLTextAreaElement | null;
}

function getTaskInstruction(body: HTMLDivElement): string | undefined {
  const composerInput = getComposerInput(body);
  const value = composerInput?.value?.trim() || "";
  return value || undefined;
}

function setActionStatus(body: HTMLDivElement, message: string): void {
  const actionStatusElement = body.querySelector(
    "[data-sideai-role='action-status']"
  ) as HTMLDivElement | null;

  if (actionStatusElement) {
    actionStatusElement.textContent = message;
  }
}

function scrollChatToLatest(body: HTMLDivElement): void {
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;

  if (!outputPreviewElement) {
    return;
  }

  outputPreviewElement.scrollTop = outputPreviewElement.scrollHeight;
}

function renderAssistantMessageContent(content: string): string {
  try {
    return renderMarkdownPreviewHtml(content);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "AI 回复渲染失败，已回退为纯文本显示。";

    Zotero.logError(error instanceof Error ? error : new Error(message));
    return `<span class="sideai-pane-muted">${content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    }</span>`;
  }
}

function renderTextMessageContent(
  document: Document,
  content: string
): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "sideai-pane-muted";
  element.textContent = content;
  return element;
}

function renderMarkdownMessageContent(
  document: Document,
  content: string
): HTMLDivElement {
  const element = document.createElement("div");

  try {
    element.innerHTML = renderAssistantMessageContent(content);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "AI 回复渲染失败，已回退为纯文本显示。";

    Zotero.logError(error instanceof Error ? error : new Error(message));
    element.replaceChildren(renderTextMessageContent(document, content));
  }

  return element;
}

function renderChatStream(body: HTMLDivElement): void {
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;

  if (!outputPreviewElement) {
    return;
  }

  const messages = getChatMessages(body);
  if (!messages.length) {
    outputPreviewElement.textContent = OUTPUT_PLACEHOLDER;
    applyPaneLayout(body);
    return;
  }

  const documentRef = outputPreviewElement.ownerDocument || body.ownerDocument;
  if (!documentRef) {
    outputPreviewElement.textContent = OUTPUT_PLACEHOLDER;
    return;
  }

  const chatStream = documentRef.createElement("div");
  chatStream.className = "sideai-chat-stream";
  chatStream.dataset.sideaiRole = "chat-stream";

  messages.forEach((message) => {
    const messageElement = documentRef.createElement("div");
    messageElement.className = "sideai-chat-message";
    messageElement.dataset.sideaiRole = message.role;
    messageElement.dataset.sideaiTone = message.tone;

    const roleElement = documentRef.createElement("div");
    roleElement.className = "sideai-chat-role";
    roleElement.textContent =
      message.role === "user"
        ? "用户"
        : message.role === "assistant"
          ? "AI"
          : "状态";

    const contentElement =
      message.mode === "markdown" && message.role === "assistant"
        ? renderMarkdownMessageContent(documentRef, message.content)
        : renderTextMessageContent(documentRef, message.content);

    messageElement.append(roleElement, contentElement);

    if (message.tone === "error" && message.retryMessages?.length) {
      const retryButton = documentRef.createElement("button");
      retryButton.className = "sideai-chat-retry";
      retryButton.dataset.sideaiRetryId = message.id;
      retryButton.textContent = "重试";
      retryButton.addEventListener("click", () => {
        if (!message.retryMessages?.length || !message.retryModel) {
          return;
        }

        void sendCurrentPreview(body, {
          model: message.retryModel,
          retryMessages: message.retryMessages
        });
      });
      messageElement.appendChild(retryButton);
    }

    chatStream.appendChild(messageElement);
  });

  outputPreviewElement.replaceChildren(chatStream);

  scrollChatToLatest(body);
  applyPaneLayout(body);
}

function setOutputPreviewContent(
  body: HTMLDivElement,
  content: string,
  mode: OutputRenderMode = "text"
): void {
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;

  if (!outputPreviewElement) {
    return;
  }

  if (mode === "markdown") {
    const documentRef = outputPreviewElement.ownerDocument || body.ownerDocument;
    if (!documentRef) {
      outputPreviewElement.textContent = content;
      applyPaneLayout(body);
      return;
    }

    const container = renderMarkdownMessageContent(
      documentRef,
      content
    );
    outputPreviewElement.replaceChildren();
    while (container.firstChild) {
      outputPreviewElement.appendChild(container.firstChild);
    }
  } else {
    outputPreviewElement.textContent = content;
  }

  applyPaneLayout(body);
}

function renderHistoryList(body: HTMLDivElement): void {
  const historyListElement = body.querySelector(
    "[data-sideai-role='history-list']"
  ) as HTMLDivElement | null;

  if (!historyListElement) {
    return;
  }

  const history = getSessionHistory(body);
  if (!history.length) {
    historyListElement.textContent = "暂无会话历史。";
    applyPaneLayout(body);
    return;
  }

  const documentRef = historyListElement.ownerDocument || body.ownerDocument;
  if (!documentRef) {
    historyListElement.textContent = "暂无会话历史。";
    return;
  }

  const fragment = documentRef.createDocumentFragment();

  history.forEach((entry) => {
    const item = documentRef.createElement("div");
    item.className = "sideai-history-item";

    const badge = documentRef.createElement("div");
    badge.className = "sideai-history-badge";
    badge.dataset.sideaiStatus = entry.status;
    badge.textContent = entry.status === "error" ? "失败" : "成功";

    const summary = documentRef.createElement("div");
    summary.textContent = entry.summary;

    const openButton = documentRef.createElement("button");
    openButton.className = "sideai-history-open";
    openButton.dataset.sideaiHistoryId = entry.id;
    openButton.textContent = "打开";
    openButton.addEventListener("click", () => {
      setOutputPreviewContent(body, entry.content, entry.mode);
      setActionStatus(body, "已加载一条历史会话结果。");
      setPaneState(
        body,
        entry.status === "error" ? "error" : "ready",
        entry.status === "error" ? entry.summary : undefined
      );
    });

    item.append(badge, summary, openButton);
    fragment.appendChild(item);
  });

  historyListElement.replaceChildren(fragment);

  applyPaneLayout(body);
}

function refreshRequestPreview(body: HTMLDivElement): void {
  const requestPreviewElement = body.querySelector(
    "[data-sideai-role='request-preview']"
  ) as HTMLDivElement | null;
  const currentTextContext = paneContextStore.get(body);
  const systemPromptInput = getSystemPromptInput(body);
  const taskInstruction = getTaskInstruction(body);

  if (!requestPreviewElement) {
    return;
  }

  if (!currentTextContext || currentTextContext.title === "未选择条目") {
    requestPreviewElement.textContent =
      "请选择一个条目以查看最终请求预览。";
    return;
  }

  requestPreviewElement.textContent = formatPreviewMessages(
    buildPreviewMessages({
      context: currentTextContext,
      systemPromptTemplate:
        systemPromptInput?.value || getSelectedPromptPreset().prompt,
      taskInstruction
    }),
    currentTextContext
  );
}

function renderPromptPresetOptions(body: HTMLDivElement): void {
  const presetSelect = getPromptPresetSelect(body);
  if (!presetSelect) {
    return;
  }

  const presets = getSavedPromptPresets();
  const selectedId = getSelectedPromptPresetId();
  const optionDocument = presetSelect.ownerDocument;
  if (!optionDocument) {
    return;
  }

  while (presetSelect.options.length) {
    presetSelect.remove(0);
  }

  presets.forEach((preset) => {
    const option = optionDocument.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label;
    option.selected = preset.id === selectedId;
    presetSelect.appendChild(option);
  });

  presetSelect.value = selectedId;
}

function syncPromptPresetEditor(body: HTMLDivElement): void {
  const promptPresetLabelInput = getPromptPresetLabelInput(body);
  const systemPromptInput = getSystemPromptInput(body);
  const selectedPreset = getSelectedPromptPreset();

  if (promptPresetLabelInput) {
    promptPresetLabelInput.value = selectedPreset.label;
  }

  if (systemPromptInput) {
    systemPromptInput.value = selectedPreset.prompt;
  }
}

function savePromptPresetSelection(
  body: HTMLDivElement,
  presets: PromptPreset[],
  selectedId: string
): PromptPreset | null {
  savePromptPresets(presets);
  saveSelectedPromptPresetId(selectedId);
  const selectedPreset =
    getSavedPromptPresets().find((preset) => preset.id === selectedId) ||
    getSelectedPromptPreset();

  try {
    renderPromptPresetOptions(body);

    const promptPresetSelect = getPromptPresetSelect(body);
    if (promptPresetSelect) {
      promptPresetSelect.value = selectedPreset.id;
    }

    syncPromptPresetEditor(body);
    refreshRequestPreview(body);
  } catch (error) {
    Zotero.logError(
      error instanceof Error
        ? error
        : new Error("提示词预设已保存，但刷新界面时发生错误。")
    );
  }

  return selectedPreset || null;
}

function saveSelectedPromptPreset(body: HTMLDivElement): PromptPreset | null {
  const promptPresetSelect = getPromptPresetSelect(body);
  const promptPresetLabelInput = getPromptPresetLabelInput(body);
  const systemPromptInput = getSystemPromptInput(body);

  if (!promptPresetSelect || !promptPresetLabelInput || !systemPromptInput) {
    return null;
  }

  const selectedId = getCurrentPromptPresetId(body);
  const nextPresets = updatePromptPreset(getSavedPromptPresets(), selectedId, {
    label: promptPresetLabelInput.value,
    prompt: systemPromptInput.value
  });
  const savedPreset =
    nextPresets.find((preset) => preset.id === selectedId) ||
    nextPresets[nextPresets.length - 1];

  if (!savedPreset) {
    return null;
  }

  return savePromptPresetSelection(body, nextPresets, savedPreset.id);
}

function createPromptPresetFromEditor(body: HTMLDivElement): PromptPreset | null {
  const promptPresetLabelInput = getPromptPresetLabelInput(body);
  const systemPromptInput = getSystemPromptInput(body);

  if (!promptPresetLabelInput || !systemPromptInput) {
    return null;
  }

  const nextPresets = addPromptPreset(
    getSavedPromptPresets(),
    promptPresetLabelInput.value,
    systemPromptInput.value
  );
  const createdPreset = nextPresets[nextPresets.length - 1];

  if (!createdPreset) {
    return null;
  }

  return savePromptPresetSelection(body, nextPresets, createdPreset.id);
}

function removeSelectedPromptPreset(body: HTMLDivElement): PromptPreset | null {
  const promptPresetSelect = getPromptPresetSelect(body);
  const presets = getSavedPromptPresets();

  if (!promptPresetSelect) {
    return null;
  }

  if (presets.length <= 1) {
    setConfigFeedback(
      body,
      "删除前至少保留一个提示词预设。",
      "error"
    );
    setActionStatus(body, "至少需要保留一个提示词预设。");
    return null;
  }

  const selectedId = promptPresetSelect.value;
  const selectedIndex = presets.findIndex((preset) => preset.id === selectedId);
  const nextPresets = deletePromptPreset(presets, selectedId);
  const fallbackPreset =
    nextPresets[Math.max(0, selectedIndex - 1)] || nextPresets[0] || null;

  if (!fallbackPreset) {
    return null;
  }

  return savePromptPresetSelection(body, nextPresets, fallbackPreset.id);
}

function setConfigFeedback(
  body: HTMLDivElement,
  message: string,
  tone: ConfigFeedbackTone
): void {
  const configFeedbackElement = body.querySelector(
    "[data-sideai-role='config-feedback']"
  ) as HTMLDivElement | null;

  if (configFeedbackElement) {
    configFeedbackElement.dataset.sideaiTone = tone;
    configFeedbackElement.textContent = message;
    applyPaneLayout(body);
  }
}

function syncSavedSettings(body: HTMLDivElement): void {
  const promptPresetSelect = getPromptPresetSelect(body);
  renderPromptPresetOptions(body);
  if (promptPresetSelect) {
    promptPresetSelect.value = getSelectedPromptPreset().id;
  }
  syncPromptPresetEditor(body);
}

function restoreDefaultPromptPresets(body: HTMLDivElement): void {
  try {
    resetPromptPresetsToDefaults();
    renderPromptPresetOptions(body);
    syncPromptPresetEditor(body);
    refreshRequestPreview(body);
    const message = "已恢复默认提示词预设。";
    setConfigFeedback(body, message, "success");
    setActionStatus(body, message);
  } catch (error) {
    Zotero.logError(
      error instanceof Error
        ? error
        : new Error("无法恢复默认提示词预设。")
    );
    const message = "暂时无法恢复默认提示词预设。";
    setConfigFeedback(body, message, "error");
    setActionStatus(body, message);
  }
}

function handlePaneActionError(
  body: HTMLDivElement,
  error: unknown,
  fallbackMessage: string,
  feedbackTone: ConfigFeedbackTone = "error"
): void {
  const detail = describeUnknownError(error, fallbackMessage);
  const message =
    detail && detail !== fallbackMessage
      ? `${fallbackMessage} ${detail}`
      : detail || fallbackMessage;

  Zotero.logError(
    error instanceof Error ? error : new Error(message)
  );
  setConfigFeedback(body, message, feedbackTone);
  setActionStatus(body, message);
  setPaneState(body, "error", message);
}

function handlePaneButtonAction(
  body: HTMLDivElement,
  role: string
): void {
  switch (role) {
    case "send-button":
      setActionStatus(body, `开始发送请求 · ${DEBUG_BUILD_MARK}`);
      void sendCurrentPreview(body).catch((error) => {
        handlePaneActionError(body, error, "发送消息失败。");
      });
      return;
    case "copy-button":
      copyOutput(body);
      return;
    case "save-preset-button":
      try {
        const preset = saveSelectedPromptPreset(body);

        if (!preset) {
          setConfigFeedback(body, "当前无法保存提示词预设。", "error");
          setActionStatus(body, "当前无法保存提示词预设。");
          return;
        }

        const message = `提示词预设“${preset.label}”已保存。`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      } catch (error) {
        handlePaneActionError(body, error, "保存提示词预设失败。");
      }
      return;
    case "new-preset-button":
      try {
        const preset = createPromptPresetFromEditor(body);

        if (!preset) {
          setConfigFeedback(body, "当前无法创建提示词预设。", "error");
          setActionStatus(body, "当前无法创建提示词预设。");
          return;
        }

        const message = `已创建提示词预设“${preset.label}”。`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      } catch (error) {
        handlePaneActionError(body, error, "创建提示词预设失败。");
      }
      return;
    case "delete-preset-button":
      try {
        const preset = removeSelectedPromptPreset(body);

        if (!preset) {
          return;
        }

        const message = `已删除提示词预设，当前切换到“${preset.label}”。`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      } catch (error) {
        handlePaneActionError(body, error, "删除提示词预设失败。");
      }
      return;
    case "reset-presets-button":
      try {
        restoreDefaultPromptPresets(body);
      } catch (error) {
        handlePaneActionError(body, error, "恢复默认提示词预设失败。");
      }
      return;
    case "clear-button":
      clearOutput(body);
      return;
    case "jump-latest-button":
      scrollChatToLatest(body);
      setActionStatus(body, "已跳转到最新消息。");
      return;
    default:
      return;
  }
}

function bindPaneInteractions(body: HTMLDivElement): void {
  if (body.dataset.sideaiBound === "true") {
    return;
  }

  const handleButtonLikeEvent = (event: Event) => {
    const target = event.target as Element | null;
    const button = target?.closest("[data-sideai-role]") as HTMLElement | null;
    const role = button?.dataset.sideaiRole;

    if (!role) {
      return;
    }

    if (
      role !== "send-button" &&
      role !== "copy-button" &&
      role !== "save-preset-button" &&
      role !== "new-preset-button" &&
      role !== "delete-preset-button" &&
      role !== "reset-presets-button" &&
      role !== "clear-button" &&
      role !== "jump-latest-button"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    handlePaneButtonAction(body, role);
  };

  body.addEventListener("click", handleButtonLikeEvent, true);
  body.addEventListener("command", handleButtonLikeEvent, true);

  const composerInput = getComposerInput(body);
  const promptPresetSelect = getPromptPresetSelect(body);
  const systemPromptInput = getSystemPromptInput(body);

  composerInput?.addEventListener("input", () => {
    refreshRequestPreview(body);
  });
  composerInput?.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendCurrentPreview(body).catch((error) => {
        handlePaneActionError(body, error, "发送消息失败。");
      });
    }
  });

  promptPresetSelect?.addEventListener("change", () => {
    const selectedPreset = getSavedPromptPresets().find(
      (preset) => preset.id === promptPresetSelect.value
    );

    if (selectedPreset && systemPromptInput) {
      systemPromptInput.value = selectedPreset.prompt;
    }
    saveSelectedPromptPresetId(promptPresetSelect.value);
    syncPromptPresetEditor(body);
    refreshRequestPreview(body);
  });

  systemPromptInput?.addEventListener("input", () => {
    refreshRequestPreview(body);
  });

  body.dataset.sideaiBound = "true";
}

function getReaderAttachmentItem(): Zotero.Item | undefined {
  try {
    const selectedTabID = Zotero.getMainWindow()?.Zotero_Tabs?.selectedID;
    if (!selectedTabID) {
      return undefined;
    }

    const reader = Zotero.Reader.getByTabID(selectedTabID);
    return reader?._item;
  } catch {
    return undefined;
  }
}

function resolveActivePaneItem(
  item: Zotero.Item | undefined,
  tabType: string
): {
  activeItem?: Zotero.Item;
  contextSource: "item" | "pdf-reader";
  contextWarnings: string[];
  pdfSelectionText: string;
  sourceLabel: string;
} {
  const readerAttachmentItem = getReaderAttachmentItem();
  const paneContext = resolvePaneContext({
    item,
    readerItem: readerAttachmentItem,
    resolveParentItem: (itemID: number) => Zotero.Items.get(itemID) as Zotero.Item,
    tabType
  });
  const selectedTabID = Zotero.getMainWindow()?.Zotero_Tabs?.selectedID;
  const reader =
    tabType === "reader" && selectedTabID
      ? Zotero.Reader.getByTabID(selectedTabID)
      : undefined;

  return {
    activeItem: paneContext.item as Zotero.Item | undefined,
    contextSource: paneContext.source,
    contextWarnings: paneContext.warnings,
    pdfSelectionText: paneContext.source === "pdf-reader"
      ? getReaderSelectionText(reader)
      : "",
    sourceLabel: paneContext.sourceLabel
  };
}

function renderPane(
  body: HTMLDivElement,
  item: Zotero.Item | undefined,
  tabType: string
): void {
  bindPaneInteractions(body);
  applyPaneLayout(body);

  const paneItem = resolveActivePaneItem(item, tabType);
  const currentTextContext = buildCurrentTextContext(paneItem.activeItem);
  currentTextContext.contextSource = paneItem.contextSource;
  currentTextContext.contextSourceLabel = paneItem.sourceLabel;
  currentTextContext.contextWarnings = [...paneItem.contextWarnings];
  currentTextContext.pdfSelectionText = paneItem.pdfSelectionText;
  currentTextContext.previewText = buildPreviewTextFromContext({
    abstractText: currentTextContext.abstractText,
    notesText: currentTextContext.notesText,
    pdfSelectionText: currentTextContext.pdfSelectionText,
    title: currentTextContext.title
  }) || "当前条目暂无可发送的预览文本。";
  if (
    currentTextContext.contextSource === "pdf-reader" &&
    !currentTextContext.pdfSelectionText
  ) {
    currentTextContext.contextWarnings?.push(
      "当前未选中 PDF 文本，已回退到条目元数据上下文。"
    );
  }
  if (
    currentTextContext.contextSource === "pdf-reader" &&
    (!currentTextContext.previewText ||
      currentTextContext.previewText === "当前条目暂无可发送的预览文本。")
  ) {
    currentTextContext.contextWarnings?.push(
      "当前既没有 PDF 选区，也没有可用的条目元数据文本。"
    );
  }
  const sessionKey = getItemSessionKey(paneItem.activeItem);
  paneActiveSessionKeyStore.set(body, sessionKey);
  if (!paneSessionStore.has(body)) {
    paneSessionStore.set(body, loadPersistedChatSessions().history);
  }
  if (!paneChatStore.has(body)) {
    paneChatStore.set(body, loadPersistedChatSessions().chats);
  }
  paneContextStore.set(body, currentTextContext);
  const titleElement = body.querySelector(
    "[data-sideai-role='title']"
  ) as HTMLDivElement | null;
  const contextPreviewElement = body.querySelector(
    "[data-sideai-role='context-preview']"
  ) as HTMLDivElement | null;
  const requestPreviewElement = body.querySelector(
    "[data-sideai-role='request-preview']"
  ) as HTMLDivElement | null;
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const hasItem = !!paneItem.activeItem;

  if (titleElement) {
    titleElement.textContent = hasItem
      ? `${getItemTitle(paneItem.activeItem)} (${paneItem.sourceLabel})`
      : getItemTitle(paneItem.activeItem);
  }

  setConfigFeedback(
    body,
    getSavedApiKey() ||
      getSavedBaseUrl() !== getDefaultBaseUrl() ||
      getSavedModel() !== getDefaultModel()
      ? "连接设置已从插件设置页加载。"
      : "请在 编辑 -> 插件 -> SideAI 中填写连接设置。",
    "neutral"
  );

  if (contextPreviewElement) {
    contextPreviewElement.textContent = [
      ...(currentTextContext.contextWarnings || []).map(
        (warning) => `[警告] ${warning}`
      ),
      currentTextContext.previewText
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (requestPreviewElement) {
    requestPreviewElement.textContent = hasItem
      ? ""
      : "请选择一个条目以查看最终请求预览。";
  }
  refreshRequestPreview(body);

  if (outputPreviewElement) {
    outputPreviewElement.textContent = hasItem ? OUTPUT_PLACEHOLDER : "暂无输出。";
    renderChatStream(body);
  }
  renderHistoryList(body);

  if (!hasItem) {
    setPaneState(body, "empty");
    return;
  }

  setPaneState(body, "ready");
  if (currentTextContext.contextWarnings?.length) {
    setActionStatus(body, currentTextContext.contextWarnings[0]);
  }
}

function copyOutput(body: HTMLDivElement): void {
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const actionStatusElement = body.querySelector(
    "[data-sideai-role='action-status']"
  ) as HTMLDivElement | null;

  const outputText = outputPreviewElement?.textContent?.trim() || "";

  if (!outputText) {
    if (actionStatusElement) {
      actionStatusElement.textContent = "当前没有可复制的输出内容。";
    }
    return;
  }

  Zotero.Utilities.Internal.copyTextToClipboard(outputText);

  if (actionStatusElement) {
    actionStatusElement.textContent = "已复制输出内容到剪贴板。";
  }
}

function clearOutput(body: HTMLDivElement): void {
  setChatMessages(body, []);
  renderChatStream(body);
  setActionStatus(body, "已清空当前条目的会话输出。");
  setPaneState(body, "ready");
}

async function sendCurrentPreview(
  body: HTMLDivElement,
  retryOptions?: {
    model: string;
    retryMessages: ChatCompletionMessage[];
  }
): Promise<void> {
  let previewMessages: ChatCompletionMessage[] = retryOptions?.retryMessages || [];
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;

  try {
    const currentState = (body.getAttribute("data-sideai-state") ||
      "empty") as PaneState;

    if (!shouldStartSendRequest(currentState)) {
      setActionStatus(body, "请求正在进行中。");
      return;
    }

    const systemPromptInput = getSystemPromptInput(body);
    const currentTextContext = paneContextStore.get(body) || {
      abstractText: "",
      contextSource: "item",
      contextSourceLabel: "条目上下文",
      notesText: "",
      pdfSelectionText: "",
      previewText: "当前没有可用文本。",
      title: "未选择条目"
    };

    const missingFields = getMissingConfigFields({
      apiKey: getSavedApiKey(),
      baseUrl: getSavedBaseUrl(),
      model: getSavedModel(),
      systemPrompt: systemPromptInput?.value || ""
    });

    if (missingFields.length) {
      const message = getMissingConfigMessage(missingFields);
      setConfigFeedback(body, message, "error");
      setPaneState(body, "error", message);
      return;
    }

    const currentText = currentTextContext?.previewText?.trim() || "";
    if (!currentText || currentText === "当前没有可用文本。") {
      setPaneState(body, "error", "当前没有可发送的文本。");
      return;
    }

    previewMessages =
      retryOptions?.retryMessages ||
      buildPreviewMessages({
        context: currentTextContext,
        systemPromptTemplate: systemPromptInput?.value || "",
        taskInstruction: getTaskInstruction(body)
      });
    const latestUserMessage = previewMessages.find(
      (message) => message.role === "user"
    );

    if (latestUserMessage && !retryOptions) {
      pushChatMessage(
        body,
        buildChatMessageEntry({
          content: latestUserMessage.content,
          mode: "text",
          role: "user"
        })
      );
    }
    pushChatMessage(
      body,
      buildChatMessageEntry({
        content: retryOptions
          ? "正在重试失败请求..."
          : "正在请求模型回复...",
        mode: "text",
        role: "status",
        tone: "loading"
      })
    );

    setPaneState(body, "loading");
    renderChatStream(body);

    const responseText = await requestChatCompletionsText({
      apiKey: getSavedApiKey(),
      baseUrl: getSavedBaseUrl(),
      messages: previewMessages,
      model: retryOptions?.model || getSavedModel(),
      timeoutMs: 30000
    });

    setChatMessages(body, removeLoadingChatMessages(getChatMessages(body)));
    pushChatMessage(
      body,
      buildChatMessageEntry({
        content: responseText,
        mode: "markdown",
        role: "assistant"
      })
    );
    renderChatStream(body);
    pushSessionHistory(
      body,
      buildHistoryEntry({
        content: responseText,
        mode: "markdown",
        status: "success"
      })
    );
    renderHistoryList(body);

    setActionStatus(body, "已成功收到回复。");
    const composerInput = getComposerInput(body);
    if (composerInput) {
      composerInput.value = "";
    }
    refreshRequestPreview(body);
    setPaneState(body, "ready");
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "请求失败。";

    setChatMessages(body, removeLoadingChatMessages(getChatMessages(body)));
    pushChatMessage(
      body,
      buildChatMessageEntry({
        content: `请求失败。\n\n${message}`,
        mode: "text",
        role: "status",
        retryMessages: previewMessages,
        retryModel: retryOptions?.model || getSavedModel(),
        tone: "error"
      })
    );
    renderChatStream(body);
    pushSessionHistory(
      body,
      buildHistoryEntry({
        content: `请求失败。\n\n${message}`,
        mode: "text",
        status: "error"
      })
    );
    renderHistoryList(body);

    setPaneState(body, "error", message);

    if (outputPreviewElement) {
      applyPaneLayout(body);
    }
  }
}

export function registerSideAIPane(): false | string {
  if (registeredPaneKey) {
    return registeredPaneKey;
  }

  registeredPaneKey = Zotero.ItemPaneManager.registerSection({
    paneID: SIDEBAR_PANE_ID,
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: "sideai-pane-header",
      icon: "chrome://zotero/skin/16/universal/book.svg"
    },
    sidenav: {
      l10nID: "sideai-pane-sidenav",
      icon: "chrome://zotero/skin/20/universal/save.svg"
    },
    bodyXHTML: `
      <html:div class="sideai-pane-root">
        <html:div class="sideai-pane-state" data-sideai-role="panel-state">加载中...</html:div>
        <html:div class="sideai-pane-section" data-sideai-section="chat">
          <html:div class="sideai-pane-label">对话</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-title" data-sideai-role="title">加载中...</html:div>
            <html:div class="sideai-pane-label">历史会话消息</html:div>
            <html:div data-sideai-role="output-badge">空闲</html:div>
            <html:div class="sideai-pane-output" data-sideai-role="output-preview"></html:div>
            <html:button type="button" data-sideai-role="jump-latest-button">跳到最新</html:button>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section" data-sideai-section="composer">
          <html:div class="sideai-pane-label">输入</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-label">向当前会话继续发送消息</html:div>
            <html:textarea
              id="sideai-composer"
              class="sideai-config-textarea"
              placeholder="输入追问内容，或补充额外说明..."
            ></html:textarea>
            <html:div class="sideai-pane-actions">
              <html:button type="button" data-sideai-role="send-button" disabled="true">发送</html:button>
              <html:button type="button" data-sideai-role="copy-button" disabled="true">复制</html:button>
              <html:button type="button" data-sideai-role="clear-button">清空</html:button>
            </html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="action-status"></html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">提示词</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-config-grid">
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-prompt-preset">提示词预设</html:label>
                <html:select
                  id="sideai-prompt-preset"
                  class="sideai-config-input"
                ></html:select>
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-prompt-preset-label">预设名称</html:label>
                <html:input
                  id="sideai-prompt-preset-label"
                  class="sideai-config-input"
                  type="text"
                  value=""
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-system-prompt">固定提示词</html:label>
                <html:textarea
                  id="sideai-system-prompt"
                  class="sideai-config-textarea"
                >${getDefaultSystemPrompt()}</html:textarea>
              </html:div>
              <html:div class="sideai-pane-actions">
                <html:button type="button" data-sideai-role="new-preset-button">新建预设</html:button>
                <html:button type="button" data-sideai-role="save-preset-button">保存预设</html:button>
                <html:button type="button" data-sideai-role="delete-preset-button">删除预设</html:button>
                <html:button type="button" data-sideai-role="reset-presets-button">恢复预设</html:button>
              </html:div>
              <html:div data-sideai-role="config-feedback" data-sideai-tone="neutral"></html:div>
            </html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">参考信息</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-label">当前上下文</html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="context-preview"></html:div>
            <html:div class="sideai-pane-label">请求预览</html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="request-preview"></html:div>
            <html:div class="sideai-pane-label">历史摘要</html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="history-list">暂无会话历史。</html:div>
          </html:div>
        </html:div>
      </html:div>
    `,
    onInit: ({ body }) => {
      applyPaneLayout(body);

      syncSavedSettings(body);
      refreshRequestPreview(body);
      bindPaneInteractions(body);
    },
    onItemChange: ({ item, setEnabled, tabType }) => {
      setEnabled((tabType === "library" || tabType === "reader") && !!item);
      return true;
    },
    onRender: ({ body, item, setSectionSummary, tabType }) => {
      const paneItem = resolveActivePaneItem(item, tabType);
      bindPaneInteractions(body);
      renderPane(body, item, tabType);
      setSectionSummary(getItemTitle(paneItem.activeItem));
    }
  });

  return registeredPaneKey;
}

export function unregisterSideAIPane(): boolean {
  if (!registeredPaneKey) {
    return false;
  }

  const paneKey = registeredPaneKey;
  registeredPaneKey = false;
  return Zotero.ItemPaneManager.unregisterSection(paneKey);
}

export function getRegisteredSideAIPaneKey(): false | string {
  return registeredPaneKey;
}
