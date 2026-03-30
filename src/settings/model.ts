import { config } from "../../package.json";

const MODEL_PREF = "model";
const DEFAULT_MODEL = "gpt-4.1-mini";

function getModelPrefKey(): string {
  return `${config.prefsPrefix}.${MODEL_PREF}`;
}

export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function getSavedModel(): string {
  const value = Zotero.Prefs.get(getModelPrefKey(), true) as
    | string
    | undefined
    | null;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_MODEL;
}

export function saveModel(value: string): void {
  const normalizedValue = value.trim() || DEFAULT_MODEL;
  Zotero.Prefs.set(getModelPrefKey(), normalizedValue, true);
}
