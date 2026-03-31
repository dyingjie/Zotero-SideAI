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
      sourceLabel: "条目上下文",
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
      sourceLabel: "条目上下文",
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
    warnings.push("当前 PDF 附件没有关联到上级文献条目。");
  }

  return {
    source: "pdf-reader",
    sourceLabel: "PDF 上下文",
    item: parentItem || currentItem,
    parentItem,
    pdfAttachmentItem: currentItem,
    warnings
  };
}
