import { saveApiKey } from "./api-key";
import { getDefaultBaseUrl, saveBaseUrl } from "./base-url";
import { getDefaultModel, saveModel } from "./model";
import { getDefaultSystemPrompt, saveSystemPrompt } from "./system-prompt";

export function resetSettingsToDefaults(): void {
  saveApiKey("");
  saveBaseUrl(getDefaultBaseUrl());
  saveModel(getDefaultModel());
  saveSystemPrompt(getDefaultSystemPrompt());
}
