const SIDEBAR_PANE_ID = "sideai-panel";

let registeredPaneKey: false | string = false;

function getItemTitle(item?: Zotero.Item): string {
  if (!item) {
    return "No item selected";
  }

  const title = item.getField("title");
  return typeof title === "string" && title.trim()
    ? title.trim()
    : "Untitled item";
}

function renderPane(body: HTMLDivElement, item?: Zotero.Item): void {
  const titleElement = body.querySelector(
    "[data-sideai-role='title']"
  ) as HTMLDivElement | null;
  const descriptionElement = body.querySelector(
    "[data-sideai-role='description']"
  ) as HTMLDivElement | null;

  if (titleElement) {
    titleElement.textContent = getItemTitle(item);
  }

  if (descriptionElement) {
    descriptionElement.textContent =
      "SideAI panel is ready. Settings, prompt, and AI actions will be added here next.";
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
        <html:div class="sideai-pane-label">Current Item</html:div>
        <html:div data-sideai-role="title">Loading...</html:div>
        <html:div data-sideai-role="description"></html:div>
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
