import type { SessionHistoryEntry } from "./session-history";

export type ItemSessionMap = Record<string, SessionHistoryEntry[]>;

export function getItemSessionKey(item?: Zotero.Item): string | null {
  if (!item || typeof item.id !== "number" || !Number.isFinite(item.id)) {
    return null;
  }

  return `item:${item.id}`;
}

export function getItemSessionHistory(
  sessions: ItemSessionMap,
  sessionKey: string | null
): SessionHistoryEntry[] {
  if (!sessionKey) {
    return [];
  }

  return sessions[sessionKey] || [];
}

export function setItemSessionHistory(
  sessions: ItemSessionMap,
  sessionKey: string | null,
  history: SessionHistoryEntry[]
): ItemSessionMap {
  if (!sessionKey) {
    return sessions;
  }

  return {
    ...sessions,
    [sessionKey]: history
  };
}
