import { saveApiKey } from "./api-key";
import { getDefaultBaseUrl, saveBaseUrl } from "./base-url";
import { getDefaultModel, saveModel } from "./model";
import {
  getDefaultPromptPresets,
  savePromptPresets,
  saveSelectedPromptPresetId
} from "./prompt-presets";
import { getDefaultSystemPrompt, saveSystemPrompt } from "./system-prompt";

export function resetPromptPresetsToDefaults(): void {
  const defaultPresets = getDefaultPromptPresets();
  savePromptPresets(defaultPresets);
  saveSelectedPromptPresetId(defaultPresets[0]?.id || "summary");
  saveSystemPrompt(defaultPresets[0]?.prompt || getDefaultSystemPrompt());
}

export function resetSettingsToDefaults(): void {
  saveApiKey("");
  saveBaseUrl(getDefaultBaseUrl());
  saveModel(getDefaultModel());
  saveSystemPrompt(getDefaultSystemPrompt());
  resetPromptPresetsToDefaults();
}
