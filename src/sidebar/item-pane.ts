import { getSavedApiKey, saveApiKey } from "../settings/api-key";
import {
  getDefaultBaseUrl,
  getSavedBaseUrl,
  saveBaseUrl
} from "../settings/base-url";
import { getDefaultModel, getSavedModel, saveModel } from "../settings/model";
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
  getSavedSystemPrompt,
  saveSystemPrompt
} from "../settings/system-prompt";
import { resetSettingsToDefaults } from "../settings/reset";
import {
  type ConfigFeedbackTone,
  getConfigFailureMessage,
  getConfigSuccessMessage
} from "./config-feedback";
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

const SIDEBAR_PANE_ID = "sideai-panel";
const OUTPUT_PLACEHOLDER =
  "AI response output will appear in this area after sending a request.";

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
    outputPreview.style.minHeight = "84px";
    outputPreview.style.maxHeight = layoutProfile.outputMaxHeight;
    outputPreview.style.overflowY = "auto";
    outputPreview.style.overflowWrap = "anywhere";
    outputPreview.style.lineHeight = "1.5";
  }

  if (chatStream) {
    chatStream.style.display = "flex";
    chatStream.style.flexDirection = "column";
    chatStream.style.gap = "8px";
  }

  chatMessages.forEach((message: Element) => {
    const element = message as HTMLDivElement;
    const role = element.dataset.sideaiRole || "assistant";
    const tone = element.dataset.sideaiTone || "default";
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.gap = "4px";
    element.style.padding = "8px";
    element.style.borderRadius = "8px";
    element.style.border = "1px solid var(--fill-tertiary, rgba(0,0,0,0.08))";
    element.style.background =
      role === "user"
        ? "rgba(32, 98, 180, 0.08)"
        : tone === "error"
          ? "rgba(208, 64, 64, 0.08)"
          : tone === "loading"
            ? "rgba(180, 120, 32, 0.08)"
            : "var(--fill-quinary, rgba(0,0,0,0.05))";
  });

  chatRoles.forEach((roleLabel: Element) => {
    const element = roleLabel as HTMLDivElement;
    element.style.fontSize = "11px";
    element.style.fontWeight = "600";
    element.style.textTransform = "uppercase";
    element.style.letterSpacing = "0.04em";
    element.style.color = "var(--text-color-deemphasized, #666)";
  });

  retryButtons.forEach((button: Element) => {
    const element = button as HTMLButtonElement;
    element.style.alignSelf = "flex-start";
    element.style.minHeight = "28px";
  });

  outputParagraphs.forEach((paragraph: Element) => {
    const element = paragraph as HTMLParagraphElement;
    element.style.margin = "0 0 10px";
    element.style.whiteSpace = "normal";
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
    requestPreview.style.minHeight = "84px";
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
    outputBadge.style.marginBottom = "6px";
    outputBadge.style.borderRadius = "999px";
    outputBadge.style.fontSize = "11px";
    outputBadge.style.fontWeight = "600";
    outputBadge.style.background = "var(--fill-tertiary, rgba(0,0,0,0.08))";
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
    return "No item selected";
  }

  const title = item.getField("title");
  return typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled item";
}

function buildCurrentTextContext(item?: Zotero.Item): CurrentTextContext {
  if (!item) {
    return {
      abstractText: "",
      notesText: "",
      previewText: "No current text available.",
      title: "No item selected"
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
    title
  });

  return {
    abstractText: normalizedAbstractText,
    notesText,
    previewText: previewText || "Selected item has no previewable text yet.",
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
        ? "No item selected."
        : state === "loading"
          ? "Loading..."
          : state === "error"
            ? `Error: ${message || "Unknown error"}`
            : "Ready";
  }

  if (actionStatusElement) {
    actionStatusElement.textContent =
      state === "empty"
        ? "Select an item to begin."
        : state === "loading"
          ? "Request is loading."
          : state === "error"
            ? message || "Something went wrong."
            : "Panel ready. Send action is not wired yet.";
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
        ? "Loading"
        : state === "error"
          ? "Error"
          : state === "empty"
            ? "Idle"
            : "Ready";
  }
}

function getApiKeyInput(body: HTMLDivElement): HTMLInputElement | null {
  return body.querySelector("#sideai-apikey") as HTMLInputElement | null;
}

function getBaseUrlInput(body: HTMLDivElement): HTMLInputElement | null {
  return body.querySelector("#sideai-baseurl") as HTMLInputElement | null;
}

function getModelInput(body: HTMLDivElement): HTMLInputElement | null {
  return body.querySelector("#sideai-model") as HTMLInputElement | null;
}

function getSystemPromptInput(body: HTMLDivElement): HTMLTextAreaElement | null {
  return body.querySelector("#sideai-system-prompt") as HTMLTextAreaElement | null;
}

function getPromptPresetSelect(body: HTMLDivElement): HTMLSelectElement | null {
  return body.querySelector("#sideai-prompt-preset") as HTMLSelectElement | null;
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

  outputPreviewElement.innerHTML = `
    <div class="sideai-chat-stream" data-sideai-role="chat-stream">
      ${messages
        .map((message) => {
          const renderedContent =
            message.mode === "markdown" && message.role === "assistant"
              ? renderMarkdownPreviewHtml(message.content)
              : `<div class="sideai-pane-muted">${message.content}</div>`;

          return `
            <div class="sideai-chat-message" data-sideai-role="${message.role}" data-sideai-tone="${message.tone}">
              <div class="sideai-chat-role">${
                message.role === "user"
                  ? "User"
                  : message.role === "assistant"
                    ? "Assistant"
                    : "Status"
              }</div>
              <div>${renderedContent}</div>
              ${
                message.tone === "error" && message.retryMessages?.length
                  ? `<button class="sideai-chat-retry" data-sideai-retry-id="${message.id}">Retry</button>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  outputPreviewElement
    .querySelectorAll("[data-sideai-retry-id]")
    .forEach((button: Element) => {
      button.addEventListener("click", () => {
        const retryId = (button as HTMLButtonElement).dataset.sideaiRetryId;
        const retryMessage = getChatMessages(body).find(
          (message) => message.id === retryId
        );

        if (!retryMessage?.retryMessages?.length || !retryMessage.retryModel) {
          return;
        }

        void sendCurrentPreview(body, {
          model: retryMessage.retryModel,
          retryMessages: retryMessage.retryMessages
        });
      });
    });

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

  outputPreviewElement.innerHTML =
    mode === "markdown"
      ? renderMarkdownPreviewHtml(content)
      : "";

  if (mode === "text") {
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
    historyListElement.textContent = "No session history yet.";
    applyPaneLayout(body);
    return;
  }

  historyListElement.innerHTML = history
    .map(
      (entry) => `
        <div class="sideai-history-item">
          <div class="sideai-history-badge" data-sideai-status="${entry.status}">
            ${entry.status === "error" ? "Error" : "Success"}
          </div>
          <div>${entry.summary}</div>
          <button class="sideai-history-open" data-sideai-history-id="${entry.id}">Open</button>
        </div>
      `
    )
    .join("");

  historyListElement
    .querySelectorAll("[data-sideai-history-id]")
    .forEach((button: Element) => {
      button.addEventListener("click", () => {
        const historyId = (button as HTMLButtonElement).dataset.sideaiHistoryId;
        const targetEntry = getSessionHistory(body).find(
          (entry) => entry.id === historyId
        );

        if (!targetEntry) {
          return;
        }

        setOutputPreviewContent(body, targetEntry.content, targetEntry.mode);
        setActionStatus(body, "Loaded a previous session result.");
        setPaneState(
          body,
          targetEntry.status === "error" ? "error" : "ready",
          targetEntry.status === "error" ? targetEntry.summary : undefined
        );
      });
    });

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

  if (!currentTextContext || currentTextContext.title === "No item selected") {
    requestPreviewElement.textContent =
      "Select an item to inspect the final request preview.";
    return;
  }

  requestPreviewElement.textContent = formatPreviewMessages(
    buildPreviewMessages({
      context: currentTextContext,
      systemPromptTemplate:
        systemPromptInput?.value || getSelectedPromptPreset().prompt,
      taskInstruction
    })
  );
}

function renderPromptPresetOptions(body: HTMLDivElement): void {
  const presetSelect = getPromptPresetSelect(body);
  if (!presetSelect) {
    return;
  }

  const presets = getSavedPromptPresets();
  const selectedId = getSelectedPromptPresetId();
  presetSelect.innerHTML = presets
    .map(
      (preset) =>
        `<option value="${preset.id}"${
          preset.id === selectedId ? " selected" : ""
        }>${preset.label}</option>`
    )
    .join("");
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
  renderPromptPresetOptions(body);

  const promptPresetSelect = getPromptPresetSelect(body);
  const selectedPreset =
    getSavedPromptPresets().find((preset) => preset.id === selectedId) ||
    getSelectedPromptPreset();

  if (promptPresetSelect) {
    promptPresetSelect.value = selectedPreset.id;
  }

  syncPromptPresetEditor(body);
  refreshRequestPreview(body);
  return selectedPreset || null;
}

function saveSelectedPromptPreset(body: HTMLDivElement): PromptPreset | null {
  const promptPresetSelect = getPromptPresetSelect(body);
  const promptPresetLabelInput = getPromptPresetLabelInput(body);
  const systemPromptInput = getSystemPromptInput(body);

  if (!promptPresetSelect || !promptPresetLabelInput || !systemPromptInput) {
    return null;
  }

  const selectedId = promptPresetSelect.value;
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
      "Keep at least one prompt preset available before deleting.",
      "error"
    );
    setActionStatus(body, "At least one prompt preset must remain.");
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
  const baseUrlInput = getBaseUrlInput(body);
  const modelInput = getModelInput(body);
  const apiKeyInput = getApiKeyInput(body);
  const promptPresetSelect = getPromptPresetSelect(body);

  if (baseUrlInput) {
    baseUrlInput.value = getSavedBaseUrl();
  }

  if (modelInput) {
    modelInput.value = getSavedModel();
  }

  if (!apiKeyInput) {
    renderPromptPresetOptions(body);
    if (promptPresetSelect) {
      promptPresetSelect.value = getSelectedPromptPreset().id;
    }
    syncPromptPresetEditor(body);
    return;
  }

  apiKeyInput.value = getSavedApiKey();
  renderPromptPresetOptions(body);
  if (promptPresetSelect) {
    promptPresetSelect.value = getSelectedPromptPreset().id;
  }
  syncPromptPresetEditor(body);
}

function persistSettings(body: HTMLDivElement): void {
  const baseUrlInput = getBaseUrlInput(body);
  const modelInput = getModelInput(body);
  const systemPromptInput = getSystemPromptInput(body);
  const apiKeyInput = getApiKeyInput(body);
  const promptPresetSelect = getPromptPresetSelect(body);

  if (
    !baseUrlInput ||
    !modelInput ||
    !systemPromptInput ||
    !apiKeyInput ||
    !promptPresetSelect
  ) {
    return;
  }

  try {
    const savedPreset = saveSelectedPromptPreset(body);

    saveBaseUrl(baseUrlInput.value);
    saveModel(modelInput.value);
    saveSystemPrompt(savedPreset?.prompt || systemPromptInput.value);
    saveApiKey(apiKeyInput.value);
    const message = getConfigSuccessMessage("save");
    setConfigFeedback(body, message, "success");
    setActionStatus(body, message);
  } catch (error) {
    Zotero.logError(
      error instanceof Error
        ? error
        : new Error("Unable to save plugin settings.")
    );
    const message = getConfigFailureMessage("save", error);
    setConfigFeedback(body, message, "error");
    setActionStatus(body, message);
  }
}

function restoreDefaultSettings(body: HTMLDivElement): void {
  try {
    resetSettingsToDefaults();
    syncSavedSettings(body);
    const message = getConfigSuccessMessage("restore");
    setConfigFeedback(body, message, "success");
    setActionStatus(body, message);
  } catch (error) {
    Zotero.logError(
      error instanceof Error
        ? error
        : new Error("Unable to restore default settings.")
    );
    const message = getConfigFailureMessage("restore", error);
    setConfigFeedback(body, message, "error");
    setActionStatus(body, message);
  }
}

function renderPane(body: HTMLDivElement, item?: Zotero.Item): void {
  applyPaneLayout(body);

  const currentTextContext = buildCurrentTextContext(item);
  const sessionKey = getItemSessionKey(item);
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
  const hasItem = !!item;

  if (titleElement) {
    titleElement.textContent = getItemTitle(item);
  }

  setConfigFeedback(
    body,
    getSavedApiKey() ||
      getSavedBaseUrl() !== getDefaultBaseUrl() ||
      getSavedModel() !== getDefaultModel() ||
      getSavedSystemPrompt() !== getDefaultSystemPrompt()
      ? "Saved API Key, Base URL, model, and fixed prompt are loaded from local settings."
      : "API Key, Base URL, model, and fixed prompt are not saved yet.",
    "neutral"
  );

  if (contextPreviewElement) {
    contextPreviewElement.textContent = currentTextContext.previewText;
  }

  if (requestPreviewElement) {
    requestPreviewElement.textContent = hasItem
      ? ""
      : "Select an item to inspect the final request preview.";
  }
  refreshRequestPreview(body);

  if (outputPreviewElement) {
    outputPreviewElement.textContent = hasItem ? OUTPUT_PLACEHOLDER : "No output yet.";
    renderChatStream(body);
  }
  renderHistoryList(body);

  if (!hasItem) {
    setPaneState(body, "empty");
    return;
  }

  setPaneState(body, "ready");
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
      actionStatusElement.textContent = "No output available to copy.";
    }
    return;
  }

  Zotero.Utilities.Internal.copyTextToClipboard(outputText);

  if (actionStatusElement) {
    actionStatusElement.textContent = "Output copied to clipboard.";
  }
}

function clearOutput(body: HTMLDivElement): void {
  setChatMessages(body, []);
  renderChatStream(body);
  setActionStatus(body, "Current item session output cleared.");
  setPaneState(body, "ready");
}

async function sendCurrentPreview(
  body: HTMLDivElement,
  retryOptions?: {
    model: string;
    retryMessages: ChatCompletionMessage[];
  }
): Promise<void> {
  const currentState = (body.getAttribute("data-sideai-state") ||
    "empty") as PaneState;

  if (!shouldStartSendRequest(currentState)) {
    setActionStatus(body, "Request is already in progress.");
    return;
  }

  const baseUrlInput = getBaseUrlInput(body);
  const modelInput = getModelInput(body);
  const systemPromptInput = getSystemPromptInput(body);
  const apiKeyInput = getApiKeyInput(body);
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const currentTextContext = paneContextStore.get(body) || {
    abstractText: "",
    notesText: "",
    previewText: "No current text available.",
    title: "No item selected"
  };

  const missingFields = getMissingConfigFields({
    apiKey: apiKeyInput?.value || "",
    baseUrl: baseUrlInput?.value || "",
    model: modelInput?.value || "",
    systemPrompt: systemPromptInput?.value || ""
  });

  if (missingFields.length) {
    const message = getMissingConfigMessage(missingFields);
    setConfigFeedback(body, message, "error");
    setPaneState(body, "error", message);
    return;
  }

  const currentText = currentTextContext?.previewText?.trim() || "";
  if (!currentText || currentText === "No current text available.") {
    setPaneState(body, "error", "No current text available to send.");
    return;
  }

  const previewMessages =
    retryOptions?.retryMessages ||
    buildPreviewMessages({
      context: currentTextContext,
      systemPromptTemplate: systemPromptInput?.value || "",
      taskInstruction: getTaskInstruction(body)
    });
  const latestUserMessage = previewMessages.find((message) => message.role === "user");

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
        ? "Retrying failed request..."
        : "Requesting model response...",
      mode: "text",
      role: "status",
      tone: "loading"
    })
  );

  setPaneState(body, "loading");
  renderChatStream(body);

  try {
    const responseText = await requestChatCompletionsText({
      apiKey: apiKeyInput?.value || "",
      baseUrl: baseUrlInput?.value || "",
      messages: previewMessages,
      model: retryOptions?.model || modelInput?.value || "",
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

    setActionStatus(body, "Response received successfully.");
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
        : "Request failed.";

    setChatMessages(body, removeLoadingChatMessages(getChatMessages(body)));
    pushChatMessage(
      body,
      buildChatMessageEntry({
        content: `Request failed.\n\n${message}`,
        mode: "text",
        role: "status",
        retryMessages: previewMessages,
        retryModel: retryOptions?.model || modelInput?.value || "",
        tone: "error"
      })
    );
    renderChatStream(body);
    pushSessionHistory(
      body,
      buildHistoryEntry({
        content: `Request failed.\n\n${message}`,
        mode: "text",
        status: "error"
      })
    );
    renderHistoryList(body);

    setPaneState(body, "error", message);
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
        <html:div class="sideai-pane-state" data-sideai-role="panel-state">Loading...</html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Configuration</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-config-grid">
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-baseurl">Base URL</html:label>
                <html:input
                  id="sideai-baseurl"
                  class="sideai-config-input"
                  type="text"
                  value="${getDefaultBaseUrl()}"
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-model">Model</html:label>
                <html:input
                  id="sideai-model"
                  class="sideai-config-input"
                  type="text"
                  value="${getDefaultModel()}"
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-apikey">API Key</html:label>
                <html:input
                  id="sideai-apikey"
                  class="sideai-config-input"
                  type="password"
                  value=""
                  placeholder="sk-..."
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-prompt-preset">Prompt Preset</html:label>
                <html:select
                  id="sideai-prompt-preset"
                  class="sideai-config-input"
                ></html:select>
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-prompt-preset-label">Preset Name</html:label>
                <html:input
                  id="sideai-prompt-preset-label"
                  class="sideai-config-input"
                  type="text"
                  value=""
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-system-prompt">Fixed Prompt</html:label>
                <html:textarea
                  id="sideai-system-prompt"
                  class="sideai-config-textarea"
                >${getDefaultSystemPrompt()}</html:textarea>
              </html:div>
              <html:div class="sideai-pane-actions">
                <html:button data-sideai-role="new-preset-button">New Preset</html:button>
                <html:button data-sideai-role="save-preset-button">Save Preset</html:button>
                <html:button data-sideai-role="delete-preset-button">Delete Preset</html:button>
              </html:div>
              <html:div class="sideai-pane-actions">
                <html:button data-sideai-role="save-settings-button">Save Settings</html:button>
                <html:button data-sideai-role="reset-settings-button">Restore Defaults</html:button>
              </html:div>
              <html:div data-sideai-role="config-feedback" data-sideai-tone="neutral"></html:div>
            </html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Context</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-title" data-sideai-role="title">Loading...</html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="context-preview"></html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Request Preview</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-label">Final Messages</html:div>
            <html:div class="sideai-pane-muted" data-sideai-role="request-preview"></html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Output</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-label">Latest Result</html:div>
            <html:div data-sideai-role="output-badge">Idle</html:div>
            <html:div class="sideai-pane-output" data-sideai-role="output-preview"></html:div>
            <html:button data-sideai-role="jump-latest-button">Jump to Latest</html:button>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">History</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-muted" data-sideai-role="history-list">No session history yet.</html:div>
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Actions</html:div>
          <html:div class="sideai-pane-card">
            <html:div class="sideai-pane-label">Message</html:div>
            <html:textarea
              id="sideai-composer"
              class="sideai-config-textarea"
              placeholder="Ask a follow-up question or add extra instructions..."
            ></html:textarea>
          </html:div>
          <html:div class="sideai-pane-actions">
            <html:button data-sideai-role="send-button" disabled="true">Send</html:button>
            <html:button data-sideai-role="copy-button" disabled="true">Copy</html:button>
            <html:button data-sideai-role="clear-button">Clear</html:button>
          </html:div>
          <html:div class="sideai-pane-muted" data-sideai-role="action-status"></html:div>
        </html:div>
      </html:div>
    `,
    onInit: ({ body }) => {
      applyPaneLayout(body);

      const sendButton = body.querySelector(
        "[data-sideai-role='send-button']"
      ) as HTMLButtonElement | null;
      const copyButton = body.querySelector(
        "[data-sideai-role='copy-button']"
      ) as HTMLButtonElement | null;
      const saveButton = body.querySelector(
        "[data-sideai-role='save-settings-button']"
      ) as HTMLButtonElement | null;
      const savePresetButton = body.querySelector(
        "[data-sideai-role='save-preset-button']"
      ) as HTMLButtonElement | null;
      const newPresetButton = body.querySelector(
        "[data-sideai-role='new-preset-button']"
      ) as HTMLButtonElement | null;
      const deletePresetButton = body.querySelector(
        "[data-sideai-role='delete-preset-button']"
      ) as HTMLButtonElement | null;
      const resetButton = body.querySelector(
        "[data-sideai-role='reset-settings-button']"
      ) as HTMLButtonElement | null;
      const clearButton = body.querySelector(
        "[data-sideai-role='clear-button']"
      ) as HTMLButtonElement | null;
      const jumpLatestButton = body.querySelector(
        "[data-sideai-role='jump-latest-button']"
      ) as HTMLButtonElement | null;
      const promptPresetSelect = getPromptPresetSelect(body);
      const composerInput = getComposerInput(body);
      const systemPromptInput = getSystemPromptInput(body);

      syncSavedSettings(body);
      refreshRequestPreview(body);

      sendButton?.addEventListener("click", () => {
        void sendCurrentPreview(body);
      });

      copyButton?.addEventListener("click", () => {
        copyOutput(body);
      });

      saveButton?.addEventListener("click", () => {
        persistSettings(body);
      });

      savePresetButton?.addEventListener("click", () => {
        const preset = saveSelectedPromptPreset(body);

        if (!preset) {
          return;
        }

        const message = `Prompt preset "${preset.label}" saved.`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      });

      newPresetButton?.addEventListener("click", () => {
        const preset = createPromptPresetFromEditor(body);

        if (!preset) {
          return;
        }

        const message = `Prompt preset "${preset.label}" created.`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      });

      deletePresetButton?.addEventListener("click", () => {
        const preset = removeSelectedPromptPreset(body);

        if (!preset) {
          return;
        }

        const message = `Prompt preset deleted. Switched to "${preset.label}".`;
        setConfigFeedback(body, message, "success");
        setActionStatus(body, message);
      });

      resetButton?.addEventListener("click", () => {
        restoreDefaultSettings(body);
      });

      clearButton?.addEventListener("click", () => {
        clearOutput(body);
      });

      jumpLatestButton?.addEventListener("click", () => {
        scrollChatToLatest(body);
        setActionStatus(body, "Jumped to the latest message.");
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

      composerInput?.addEventListener("input", () => {
        refreshRequestPreview(body);
      });

      composerInput?.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          void sendCurrentPreview(body);
        }
      });

      systemPromptInput?.addEventListener("input", () => {
        refreshRequestPreview(body);
      });
    },
    onItemChange: ({ item, setEnabled, tabType }) => {
      setEnabled(tabType === "library" && !!item);
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      renderPane(body, item);
      setSectionSummary(getItemTitle(item));
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
