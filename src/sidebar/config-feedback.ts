export type ConfigFeedbackTone = "neutral" | "success" | "error";

export function getConfigFailureMessage(
  action: "save" | "restore",
  error?: unknown
): string {
  const baseMessage =
    action === "save"
      ? "Unable to save settings right now."
      : "Unable to restore defaults right now.";

  if (error instanceof Error && error.message.trim()) {
    return `${baseMessage} ${error.message.trim()}`;
  }

  return baseMessage;
}

export function getConfigSuccessMessage(
  action: "save" | "restore"
): string {
  return action === "save"
    ? "API Key, Base URL, model, and fixed prompt are saved locally."
    : "Settings restored to defaults.";
}
