export type PaneContextSource = "item" | "pdf-reader";

export type PaneContextItemLike = {
  id?: number;
  parentItemID?: number | false;
  isPDFAttachment?: () => boolean;
};

export type PaneContextResolution = {
  source: PaneContextSource;
  sourceLabel: string;
  item?: PaneContextItemLike;
  parentItem?: PaneContextItemLike;
  pdfAttachmentItem?: PaneContextItemLike;
  warnings: string[];
};

export function resolvePaneContext(options: {
  item?: PaneContextItemLike;
  tabType?: string;
  readerItem?: PaneContextItemLike;
  resolveParentItem?: (itemID: number) => PaneContextItemLike | undefined;
}): PaneContextResolution {
  const currentItem = options.readerItem || options.item;

  if (!currentItem) {
    return {
      source: "item",
      sourceLabel: "Item Context",
      warnings: []
    };
  }

  const isPDFReader =
    options.tabType === "reader" &&
    typeof currentItem.isPDFAttachment === "function" &&
    currentItem.isPDFAttachment();

  if (!isPDFReader) {
    return {
      source: "item",
      sourceLabel: "Item Context",
      item: currentItem,
      warnings: []
    };
  }

  const parentItemID =
    typeof currentItem.parentItemID === "number" ? currentItem.parentItemID : undefined;
  const parentItem =
    typeof parentItemID === "number" && options.resolveParentItem
      ? options.resolveParentItem(parentItemID)
      : undefined;

  const warnings: string[] = [];
  if (!parentItem) {
    warnings.push("PDF reader item is not linked to a parent library item.");
  }

  return {
    source: "pdf-reader",
    sourceLabel: "PDF Context",
    item: parentItem || currentItem,
    parentItem,
    pdfAttachmentItem: currentItem,
    warnings
  };
}
