import { config } from "../../package.json";

const API_KEY_PREF = "apiKey";

function getApiKeyPrefKey(): string {
  return `${config.prefsPrefix}.${API_KEY_PREF}`;
}

export function getSavedApiKey(): string {
  const value = Zotero.Prefs.get(getApiKeyPrefKey(), true) as
    | string
    | undefined
    | null;

  return typeof value === "string" ? value : "";
}

export function saveApiKey(value: string): void {
  Zotero.Prefs.set(getApiKeyPrefKey(), value.trim(), true);
}
