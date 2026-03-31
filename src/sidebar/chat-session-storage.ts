import { config } from "../../package.json";
import type { ChatMessageEntry } from "./chat-stream";
import type { ItemSessionMap } from "./item-session";
import type { SessionHistoryEntry } from "./session-history";

const CHAT_SESSION_PREF = "chatSessionStore";

export type PersistedChatSessions = {
  chats: ItemSessionMap<ChatMessageEntry>;
  history: ItemSessionMap<SessionHistoryEntry>;
};

function getChatSessionPrefKey(): string {
  return `${config.prefsPrefix}.${CHAT_SESSION_PREF}`;
}

export function serializeChatSessions(input: PersistedChatSessions): string {
  return JSON.stringify(input);
}

export function deserializeChatSessions(
  raw: string | null | undefined
): PersistedChatSessions {
  if (!raw || !raw.trim()) {
    return { chats: {}, history: {} };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedChatSessions>;
    return {
      chats:
        parsed && typeof parsed === "object" && parsed.chats
          ? parsed.chats
          : {},
      history:
        parsed && typeof parsed === "object" && parsed.history
          ? parsed.history
          : {}
    };
  } catch {
    return { chats: {}, history: {} };
  }
}

export function loadPersistedChatSessions(): PersistedChatSessions {
  const raw = Zotero.Prefs.get(getChatSessionPrefKey(), true) as
    | string
    | undefined
    | null;

  return deserializeChatSessions(raw);
}

export function savePersistedChatSessions(
  input: PersistedChatSessions
): void {
  Zotero.Prefs.set(getChatSessionPrefKey(), serializeChatSessions(input), true);
}
