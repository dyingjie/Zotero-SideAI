declare const __env__: "development" | "production";
declare const addon: import("../src/addon").default;
declare const _globalThis: Record<string, unknown>;

interface Window {
  sideAI?: unknown;
}
