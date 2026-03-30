export type OutputRenderMode = "markdown" | "text";

export type SessionHistoryEntry = {
  content: string;
  id: string;
  mode: OutputRenderMode;
  status: "error" | "success";
  summary: string;
};

export const MAX_HISTORY_ITEMS = 6;

export function buildHistorySummary(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Empty response";
  }

  return normalized.length > 72
    ? `${normalized.slice(0, 72).trimEnd()}...`
    : normalized;
}

export function buildHistoryEntry(options: {
  content: string;
  mode: OutputRenderMode;
  status: SessionHistoryEntry["status"];
}): SessionHistoryEntry {
  return {
    content: options.content,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode: options.mode,
    status: options.status,
    summary: buildHistorySummary(options.content)
  };
}

export function appendHistoryEntry(
  history: SessionHistoryEntry[],
  entry: SessionHistoryEntry
): SessionHistoryEntry[] {
  return [entry, ...history].slice(0, MAX_HISTORY_ITEMS);
}
