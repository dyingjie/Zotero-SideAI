const PREFERENCE_PANE_ID = "sideai-preferences";

export async function registerSideAIPreferencePane(): Promise<string> {
  return Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: PREFERENCE_PANE_ID,
    label: "SideAI",
    src: "preferences.xhtml",
    scripts: ["preferences.js"]
  });
}
