export function getMissingConfigFields(config: {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
}): string[] {
  const missingFields: string[] = [];

  if (!config.baseUrl.trim()) {
    missingFields.push("Base URL");
  }

  if (!config.model.trim()) {
    missingFields.push("Model");
  }

  if (!config.apiKey.trim()) {
    missingFields.push("API Key");
  }

  if (!config.systemPrompt.trim()) {
    missingFields.push("Fixed Prompt");
  }

  return missingFields;
}

export function getMissingConfigMessage(missingFields: string[]): string {
  return `Please complete required settings before sending: ${missingFields.join(", ")}.`;
}
