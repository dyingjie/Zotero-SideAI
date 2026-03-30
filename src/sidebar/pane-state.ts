export type PaneState = "empty" | "ready" | "loading" | "error";

export function shouldEnableSendButton(state: PaneState): boolean {
  return state !== "empty" && state !== "loading";
}

export function shouldStartSendRequest(state: PaneState): boolean {
  return state === "ready" || state === "error";
}
