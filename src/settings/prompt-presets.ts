import { config } from "../../package.json";
import { getDefaultSystemPrompt, getSavedSystemPrompt } from "./system-prompt";

const PROMPT_PRESETS_PREF = "promptPresets";
const SELECTED_PROMPT_PRESET_PREF = "selectedPromptPreset";

export type PromptPreset = {
  id: string;
  label: string;
  prompt: string;
};

const DEFAULT_PROMPT_PRESETS: PromptPreset[] = [
  {
    id: "summary",
    label: "Summary",
    prompt: getDefaultSystemPrompt()
  },
  {
    id: "methods",
    label: "Methods",
    prompt:
      "You are an academic reading assistant. Focus on the paper's methods, workflow, assumptions, and implementation details."
  },
  {
    id: "critique",
    label: "Critique",
    prompt:
      "You are an academic reading assistant. Critically evaluate the paper's strengths, weaknesses, risks, and open questions without inventing facts."
  }
];

function getPromptPresetsPrefKey(): string {
  return `${config.prefsPrefix}.${PROMPT_PRESETS_PREF}`;
}

function getSelectedPromptPresetPrefKey(): string {
  return `${config.prefsPrefix}.${SELECTED_PROMPT_PRESET_PREF}`;
}

export function getDefaultPromptPresets(): PromptPreset[] {
  return DEFAULT_PROMPT_PRESETS.map((preset) => ({ ...preset }));
}

export function getSavedPromptPresets(): PromptPreset[] {
  const value = Zotero.Prefs.get(getPromptPresetsPrefKey(), true) as
    | string
    | undefined
    | null;

  if (!value || !value.trim()) {
    const migratedDefault = getDefaultPromptPresets();
    migratedDefault[0].prompt = getSavedSystemPrompt();
    return migratedDefault;
  }

  try {
    const parsed = JSON.parse(value) as PromptPreset[];
    const normalized = Array.isArray(parsed)
      ? parsed.filter(
          (preset) =>
            preset &&
            typeof preset.id === "string" &&
            typeof preset.label === "string" &&
            typeof preset.prompt === "string"
        )
      : [];

    return normalized.length ? normalized : getDefaultPromptPresets();
  } catch {
    return getDefaultPromptPresets();
  }
}

export function savePromptPresets(presets: PromptPreset[]): void {
  const normalized = presets
    .map((preset) => ({
      id: preset.id.trim(),
      label: preset.label.trim(),
      prompt: preset.prompt.trim()
    }))
    .filter((preset) => preset.id && preset.label && preset.prompt);

  const nextPresets = normalized.length
    ? normalized
    : getDefaultPromptPresets();

  Zotero.Prefs.set(
    getPromptPresetsPrefKey(),
    JSON.stringify(nextPresets),
    true
  );
}

export function getSelectedPromptPresetId(): string {
  const savedId = Zotero.Prefs.get(getSelectedPromptPresetPrefKey(), true) as
    | string
    | undefined
    | null;
  const presets = getSavedPromptPresets();

  if (
    typeof savedId === "string" &&
    presets.some((preset) => preset.id === savedId.trim())
  ) {
    return savedId.trim();
  }

  return presets[0]?.id || "summary";
}

export function saveSelectedPromptPresetId(presetId: string): void {
  const presets = getSavedPromptPresets();
  const normalizedId = presetId.trim();
  const nextId = presets.some((preset) => preset.id === normalizedId)
    ? normalizedId
    : presets[0]?.id || "summary";

  Zotero.Prefs.set(getSelectedPromptPresetPrefKey(), nextId, true);
}

export function getSelectedPromptPreset(): PromptPreset {
  const presets = getSavedPromptPresets();
  const selectedId = getSelectedPromptPresetId();

  return (
    presets.find((preset) => preset.id === selectedId) ||
    presets[0] || {
      id: "summary",
      label: "Summary",
      prompt: getDefaultSystemPrompt()
    }
  );
}
