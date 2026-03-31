export type ItemSessionMap<T> = Record<string, T[]>;

export function getItemSessionKey(item?: Zotero.Item): string | null {
  if (!item || typeof item.id !== "number" || !Number.isFinite(item.id)) {
    return null;
  }

  return `item:${item.id}`;
}

export function getItemSessionHistory<T>(
  sessions: ItemSessionMap<T>,
  sessionKey: string | null
): T[] {
  if (!sessionKey) {
    return [];
  }

  return sessions[sessionKey] || [];
}

export function setItemSessionHistory<T>(
  sessions: ItemSessionMap<T>,
  sessionKey: string | null,
  history: T[]
): ItemSessionMap<T> {
  if (!sessionKey) {
    return sessions;
  }

  return {
    ...sessions,
    [sessionKey]: history
  };
}
