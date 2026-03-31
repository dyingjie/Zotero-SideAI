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
    missingFields.push("模型");
  }

  if (!config.apiKey.trim()) {
    missingFields.push("API Key");
  }

  if (!config.systemPrompt.trim()) {
    missingFields.push("固定提示词");
  }

  return missingFields;
}

export function getMissingConfigMessage(missingFields: string[]): string {
  return `发送前请先补全这些必填设置：${missingFields.join("、")}。`;
}
