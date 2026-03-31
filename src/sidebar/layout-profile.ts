export const COMPACT_PANE_WIDTH = 360;
const DEFAULT_PANE_WIDTH = 400;

export type PaneLayoutProfile = {
  actionsGap: string;
  buttonFlex: string;
  buttonMinHeight: string;
  buttonWhiteSpace: "normal" | "nowrap";
  cardPadding: string;
  configGap: string;
  contextMaxHeight: string;
  historyMaxHeight: string;
  isCompact: boolean;
  outputMaxHeight: string;
  requestMaxHeight: string;
  rootGap: string;
  textareaMinHeight: string;
};

export function getPaneLayoutProfile(width?: number): PaneLayoutProfile {
  const normalizedWidth =
    typeof width === "number" && Number.isFinite(width) && width > 0
      ? width
      : DEFAULT_PANE_WIDTH;
  const isCompact = normalizedWidth < COMPACT_PANE_WIDTH;

  if (isCompact) {
    return {
      actionsGap: "4px",
      buttonFlex: "1 1 100%",
      buttonMinHeight: "32px",
      buttonWhiteSpace: "normal",
      cardPadding: "6px",
      configGap: "6px",
      contextMaxHeight: "96px",
      historyMaxHeight: "128px",
      isCompact,
      outputMaxHeight: "144px",
      requestMaxHeight: "144px",
      rootGap: "8px",
      textareaMinHeight: "80px"
    };
  }

  return {
    actionsGap: "6px",
    buttonFlex: "1 1 80px",
    buttonMinHeight: "28px",
    buttonWhiteSpace: "nowrap",
    cardPadding: "8px",
    configGap: "8px",
    contextMaxHeight: "120px",
    historyMaxHeight: "160px",
    isCompact,
    outputMaxHeight: "180px",
    requestMaxHeight: "180px",
    rootGap: "10px",
    textareaMinHeight: "96px"
  };
}
