import { config } from "../../package.json";

const BASE_URL_PREF = "baseURL";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function getBaseUrlPrefKey(): string {
  return `${config.prefsPrefix}.${BASE_URL_PREF}`;
}

export function getDefaultBaseUrl(): string {
  return DEFAULT_BASE_URL;
}

export function getSavedBaseUrl(): string {
  const value = Zotero.Prefs.get(getBaseUrlPrefKey(), true) as
    | string
    | undefined
    | null;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_BASE_URL;
}

export function saveBaseUrl(value: string): void {
  const normalizedValue = value.trim() || DEFAULT_BASE_URL;
  Zotero.Prefs.set(getBaseUrlPrefKey(), normalizedValue, true);
}
