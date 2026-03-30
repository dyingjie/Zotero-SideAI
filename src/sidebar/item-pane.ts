import { getSavedApiKey, saveApiKey } from "../settings/api-key";
import {
  getDefaultBaseUrl,
  getSavedBaseUrl,
  saveBaseUrl
} from "../settings/base-url";
import { getDefaultModel, getSavedModel, saveModel } from "../settings/model";
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
import {
  buildPreviewMessages,
  formatPreviewMessages
} from "../services/request-preview";
import {
  buildPreviewTextFromContext,
  type CurrentTextContext,
  mergeNotePreviewTexts
} from "./context-preview";
import { renderMarkdownPreviewHtml } from "./output-render";

const SIDEBAR_PANE_ID = "sideai-panel";

let registeredPaneKey: false | string = false;
const paneContextStore = new WeakMap<HTMLDivElement, CurrentTextContext>();
type PaneState = "empty" | "ready" | "loading" | "error";

function shouldEnableSendButton(state: PaneState): boolean {
  return state !== "empty" && state !== "loading";
}

function applyPaneLayout(body: HTMLDivElement): void {
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
    root.style.gap = "10px";
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
    element.style.padding = "8px";
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
  const outputCodeElements = body.querySelectorAll(".sideai-output-code code");

  if (contextPreview) {
    contextPreview.style.maxHeight = "120px";
    contextPreview.style.overflowY = "auto";
  }

  if (outputPreview) {
    outputPreview.style.minHeight = "84px";
    outputPreview.style.maxHeight = "180px";
    outputPreview.style.overflowY = "auto";
    outputPreview.style.overflowWrap = "anywhere";
    outputPreview.style.lineHeight = "1.5";
  }

  outputParagraphs.forEach((paragraph: Element) => {
    const element = paragraph as HTMLParagraphElement;
    element.style.margin = "0 0 10px";
    element.style.whiteSpace = "normal";
  });

  outputCodeBlocks.forEach((codeBlock: Element) => {
    const element = codeBlock as HTMLPreElement;
    element.style.margin = "0";
    element.style.padding = "8px";
    element.style.borderRadius = "6px";
    element.style.overflowX = "auto";
    element.style.background = "var(--fill-tertiary, rgba(0,0,0,0.08))";
  });

  outputCodeElements.forEach((codeElement: Element) => {
    const element = codeElement as HTMLElement;
    element.style.whiteSpace = "pre";
    element.style.fontFamily = "monospace";
    element.style.fontSize = "12px";
  });

  if (requestPreview) {
    requestPreview.style.minHeight = "84px";
    requestPreview.style.maxHeight = "180px";
    requestPreview.style.overflowY = "auto";
    requestPreview.style.whiteSpace = "pre-wrap";
    requestPreview.style.overflowWrap = "anywhere";
  }

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
    actions.style.gap = "6px";
    actions.style.width = "100%";
  }

  buttons.forEach((button: Element) => {
    const element = button as HTMLButtonElement;
    element.style.flex = "1 1 80px";
    element.style.minWidth = "0";
    element.style.maxWidth = "100%";
    element.style.whiteSpace = "nowrap";
    element.style.overflow = "hidden";
    element.style.textOverflow = "ellipsis";
  });

  if (configGrid) {
    configGrid.style.display = "flex";
    configGrid.style.flexDirection = "column";
    configGrid.style.gap = "8px";
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
    element.style.minHeight = "96px";
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

function setActionStatus(body: HTMLDivElement, message: string): void {
  const actionStatusElement = body.querySelector(
    "[data-sideai-role='action-status']"
  ) as HTMLDivElement | null;

  if (actionStatusElement) {
    actionStatusElement.textContent = message;
  }
}

function setOutputPreviewContent(
  body: HTMLDivElement,
  content: string,
  mode: "markdown" | "text" = "text"
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
  const systemPromptInput = getSystemPromptInput(body);
  const apiKeyInput = getApiKeyInput(body);

  if (baseUrlInput) {
    baseUrlInput.value = getSavedBaseUrl();
  }

  if (modelInput) {
    modelInput.value = getSavedModel();
  }

  if (systemPromptInput) {
    systemPromptInput.value = getSavedSystemPrompt();
  }

  if (!apiKeyInput) {
    return;
  }

  apiKeyInput.value = getSavedApiKey();
}

function persistSettings(body: HTMLDivElement): void {
  const baseUrlInput = getBaseUrlInput(body);
  const modelInput = getModelInput(body);
  const systemPromptInput = getSystemPromptInput(body);
  const apiKeyInput = getApiKeyInput(body);

  if (!baseUrlInput || !modelInput || !systemPromptInput || !apiKeyInput) {
    return;
  }

  try {
    saveBaseUrl(baseUrlInput.value);
    saveModel(modelInput.value);
    saveSystemPrompt(systemPromptInput.value);
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
      ? formatPreviewMessages(
          buildPreviewMessages({
            context: currentTextContext,
            systemPromptTemplate: getSavedSystemPrompt()
          })
        )
      : "Select an item to inspect the final request preview.";
  }

  if (outputPreviewElement) {
    setOutputPreviewContent(
      body,
      hasItem
        ? "AI response output will appear in this area after sending a request."
        : "No output yet."
    );
  }

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
  setOutputPreviewContent(
    body,
    "AI response output will appear in this area after sending a request."
  );
  setActionStatus(body, "Current session output cleared.");
  setPaneState(body, "ready");
}

async function sendCurrentPreview(body: HTMLDivElement): Promise<void> {
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

  setPaneState(body, "loading");
  setOutputPreviewContent(body, "Requesting model response...");

  try {
    const responseText = await requestChatCompletionsText({
      apiKey: apiKeyInput?.value || "",
      baseUrl: baseUrlInput?.value || "",
      messages: buildPreviewMessages({
        context: currentTextContext,
        systemPromptTemplate: systemPromptInput?.value || ""
      }),
      model: modelInput?.value || "",
      timeoutMs: 30000
    });

    setOutputPreviewContent(body, responseText, "markdown");

    setActionStatus(body, "Response received successfully.");
    setPaneState(body, "ready");
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Request failed.";

    setOutputPreviewContent(body, `Request failed.\n\n${message}`);

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
                <html:label class="sideai-config-label" for="sideai-system-prompt">Fixed Prompt</html:label>
                <html:textarea
                  id="sideai-system-prompt"
                  class="sideai-config-textarea"
                >${getDefaultSystemPrompt()}</html:textarea>
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
          </html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Actions</html:div>
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
      const resetButton = body.querySelector(
        "[data-sideai-role='reset-settings-button']"
      ) as HTMLButtonElement | null;
      const clearButton = body.querySelector(
        "[data-sideai-role='clear-button']"
      ) as HTMLButtonElement | null;

      syncSavedSettings(body);

      sendButton?.addEventListener("click", () => {
        void sendCurrentPreview(body);
      });

      copyButton?.addEventListener("click", () => {
        copyOutput(body);
      });

      saveButton?.addEventListener("click", () => {
        persistSettings(body);
      });

      resetButton?.addEventListener("click", () => {
        restoreDefaultSettings(body);
      });

      clearButton?.addEventListener("click", () => {
        clearOutput(body);
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
