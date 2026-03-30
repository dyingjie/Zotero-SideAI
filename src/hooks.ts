import {
  registerSideAIPane,
  unregisterSideAIPane
} from "./sidebar/item-pane";

function log(message: string): void {
  Zotero.debug(`[Zotero SideAI] ${message}`);
}

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise
  ]);

  addon.data.sidebarPaneKey = registerSideAIPane();
  log("Plugin startup completed.");
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  log(`Main window loaded: ${win.location.href}`);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  log(`Main window unloaded: ${win.location.href}`);
}

async function onShutdown(): Promise<void> {
  log("Plugin shutdown completed.");
  const addonInstance = addon.data.config.addonInstance;
  unregisterSideAIPane();
  addon.data.sidebarPaneKey = false;
  addon.data.initialized = false;
  addon.data.alive = false;
  delete (_globalThis as Record<string, unknown>).addon;
  // @ts-expect-error Zotero plugin instance is attached dynamically.
  delete Zotero[addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>
): Promise<void> {
  log(`Notify event received: ${event}/${type} (${ids.length})`);
}

async function onPrefsEvent(
  type: string,
  data: Record<string, unknown>
): Promise<void> {
  log(`Prefs event received: ${type}`);
  void data;
}

function onShortcuts(type: string): void {
  log(`Shortcut event received: ${type}`);
}

function onDialogEvents(type: string): void {
  log(`Dialog event received: ${type}`);
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents
};
