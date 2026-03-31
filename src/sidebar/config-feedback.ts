export type ConfigFeedbackTone = "neutral" | "success" | "error";

export function getConfigFailureMessage(
  action: "save" | "restore",
  error?: unknown
): string {
  const baseMessage =
    action === "save"
      ? "当前无法保存设置。"
      : "当前无法恢复默认设置。";

  if (error instanceof Error && error.message.trim()) {
    return `${baseMessage} ${error.message.trim()}`;
  }

  return baseMessage;
}

export function getConfigSuccessMessage(
  action: "save" | "restore"
): string {
  return action === "save"
    ? "API Key、Base URL、模型和固定提示词已保存到本地。"
    : "设置已恢复为默认值。";
}
