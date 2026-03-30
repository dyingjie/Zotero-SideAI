import { getSavedApiKey, saveApiKey } from "../settings/api-key";

const SIDEBAR_PANE_ID = "sideai-panel";

let registeredPaneKey: false | string = false;
type PaneState = "empty" | "ready" | "loading" | "error";

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

  if (contextPreview) {
    contextPreview.style.maxHeight = "120px";
    contextPreview.style.overflowY = "auto";
  }

  if (outputPreview) {
    outputPreview.style.minHeight = "84px";
    outputPreview.style.maxHeight = "180px";
    outputPreview.style.overflowY = "auto";
    outputPreview.style.whiteSpace = "pre-wrap";
    outputPreview.style.overflowWrap = "anywhere";
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCurrentTextPreview(item?: Zotero.Item): string {
  if (!item) {
    return "No current text available.";
  }

  const sections: string[] = [];
  const title = getItemTitle(item);
  if (title && title !== "Untitled item") {
    sections.push(`Title:\n${title}`);
  }

  const abstractText = item.getField("abstractNote");
  if (typeof abstractText === "string" && abstractText.trim()) {
    sections.push(`Abstract:\n${abstractText.trim()}`);
  }

  const noteIDs =
    typeof item.getNotes === "function" ? (item.getNotes() as number[]) : [];
  if (noteIDs.length) {
    const noteItems = Zotero.Items.get(noteIDs) as Zotero.Item[];
    const notePreview = noteItems
      .map((noteItem) => stripHtml(noteItem.getNote?.() || ""))
      .filter(Boolean)
      .slice(0, 2)
      .join("\n\n");

    if (notePreview) {
      sections.push(`Notes:\n${notePreview}`);
    }
  }

  if (!sections.length) {
    return "Selected item has no previewable text yet.";
  }

  return sections.join("\n\n");
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
    sendButton.disabled = state !== "ready";
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

function setConfigSummary(body: HTMLDivElement, message: string): void {
  const configSummaryElement = body.querySelector(
    "[data-sideai-role='config-summary']"
  ) as HTMLDivElement | null;

  if (configSummaryElement) {
    configSummaryElement.textContent = message;
  }
}

function syncSavedApiKey(body: HTMLDivElement): void {
  const apiKeyInput = getApiKeyInput(body);

  if (!apiKeyInput) {
    return;
  }

  apiKeyInput.value = getSavedApiKey();
}

function persistApiKey(body: HTMLDivElement): void {
  const apiKeyInput = getApiKeyInput(body);
  if (!apiKeyInput) {
    return;
  }

  try {
    saveApiKey(apiKeyInput.value);
    setConfigSummary(
      body,
      "API Key saved locally. Persistence for other settings will be added next."
    );
  } catch (error) {
    Zotero.logError(
      error instanceof Error ? error : new Error("Unable to save API Key.")
    );
    setConfigSummary(body, "Unable to save API Key right now.");
  }
}

function renderPane(body: HTMLDivElement, item?: Zotero.Item): void {
  applyPaneLayout(body);

  const titleElement = body.querySelector(
    "[data-sideai-role='title']"
  ) as HTMLDivElement | null;
  const configSummaryElement = body.querySelector(
    "[data-sideai-role='config-summary']"
  ) as HTMLDivElement | null;
  const contextPreviewElement = body.querySelector(
    "[data-sideai-role='context-preview']"
  ) as HTMLDivElement | null;
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;
  const hasItem = !!item;

  if (titleElement) {
    titleElement.textContent = getItemTitle(item);
  }

  if (configSummaryElement) {
    configSummaryElement.textContent =
      getSavedApiKey()
        ? "API Key is loaded from local settings. Persistence for other settings is still pending."
        : "API Key is not saved yet. Other settings persistence will be added later.";
  }

  if (contextPreviewElement) {
    contextPreviewElement.textContent = buildCurrentTextPreview(item);
  }

  if (outputPreviewElement) {
    outputPreviewElement.textContent =
      hasItem
        ? "AI response output will appear in this area after sending a request."
        : "No output yet.";
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

async function sendCurrentPreview(body: HTMLDivElement): Promise<void> {
  const contextPreviewElement = body.querySelector(
    "[data-sideai-role='context-preview']"
  ) as HTMLDivElement | null;
  const outputPreviewElement = body.querySelector(
    "[data-sideai-role='output-preview']"
  ) as HTMLDivElement | null;

  const currentText = contextPreviewElement?.textContent?.trim() || "";
  if (!currentText || currentText === "No current text available.") {
    setPaneState(body, "error", "No current text available to send.");
    return;
  }

  setPaneState(body, "loading");
  if (outputPreviewElement) {
    outputPreviewElement.textContent = "Generating preview response...";
  }

  await Zotero.Promise.delay(400);

  if (outputPreviewElement) {
    outputPreviewElement.textContent = [
      "Mock response",
      "",
      "This is a placeholder send action.",
      "Current text has been collected successfully.",
      "The real API request will be connected in the next phase."
    ].join("\n");
  }

  setPaneState(body, "ready");
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
                  value="https://api.openai.com/v1"
                />
              </html:div>
              <html:div class="sideai-config-row">
                <html:label class="sideai-config-label" for="sideai-model">Model</html:label>
                <html:input
                  id="sideai-model"
                  class="sideai-config-input"
                  type="text"
                  value="gpt-4.1-mini"
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
                >You are an academic reading assistant. Summarize the selected paper content clearly and faithfully.</html:textarea>
              </html:div>
              <html:div class="sideai-pane-actions">
                <html:button data-sideai-role="save-settings-button">Save API Key</html:button>
              </html:div>
              <html:div class="sideai-pane-muted" data-sideai-role="config-summary"></html:div>
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
            <html:button disabled="true">Clear</html:button>
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

      syncSavedApiKey(body);

      sendButton?.addEventListener("click", () => {
        void sendCurrentPreview(body);
      });

      copyButton?.addEventListener("click", () => {
        copyOutput(body);
      });

      saveButton?.addEventListener("click", () => {
        persistApiKey(body);
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
