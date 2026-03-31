import { config } from "../../package.json";

const SYSTEM_PROMPT_PREF = "systemPrompt";
const DEFAULT_SYSTEM_PROMPT =
  "你是一名学术阅读助手。请清晰、忠实地总结当前选中的文献内容。";

function getSystemPromptPrefKey(): string {
  return `${config.prefsPrefix}.${SYSTEM_PROMPT_PREF}`;
}

export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}

export function getSavedSystemPrompt(): string {
  const value = Zotero.Prefs.get(getSystemPromptPrefKey(), true) as
    | string
    | undefined
    | null;

  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_SYSTEM_PROMPT;
}

export function saveSystemPrompt(value: string): void {
  const normalizedValue = value.trim() || DEFAULT_SYSTEM_PROMPT;
  Zotero.Prefs.set(getSystemPromptPrefKey(), normalizedValue, true);
}
