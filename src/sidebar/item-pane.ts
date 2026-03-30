const SIDEBAR_PANE_ID = "sideai-panel";

let registeredPaneKey: false | string = false;
type PaneState = "empty" | "ready" | "loading" | "error";

function getItemTitle(item?: Zotero.Item): string {
  if (!item) {
    return "No item selected";
  }

  const title = item.getField("title");
  return typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled item";
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
}

function renderPane(body: HTMLDivElement, item?: Zotero.Item): void {
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
      "API Key, baseURL, model, and fixed prompt will live here.";
  }

  if (contextPreviewElement) {
    contextPreviewElement.textContent =
      "Current context preview will show title, abstract, and notes from the selected item.";
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
          <html:div class="sideai-pane-card" data-sideai-role="config-summary"></html:div>
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
          <html:div class="sideai-pane-card sideai-pane-output" data-sideai-role="output-preview"></html:div>
        </html:div>
        <html:div class="sideai-pane-section">
          <html:div class="sideai-pane-label">Actions</html:div>
          <html:div class="sideai-pane-actions">
            <html:button data-sideai-role="send-button" disabled="true">Send</html:button>
            <html:button disabled="true">Copy</html:button>
            <html:button disabled="true">Clear</html:button>
          </html:div>
          <html:div class="sideai-pane-muted" data-sideai-role="action-status"></html:div>
        </html:div>
      </html:div>
    `,
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
