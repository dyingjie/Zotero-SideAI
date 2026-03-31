import { assert } from "chai";
import { config } from "../package.json";
import { getSavedApiKey, saveApiKey } from "../src/settings/api-key";
import {
  getDefaultBaseUrl,
  getSavedBaseUrl,
  saveBaseUrl
} from "../src/settings/base-url";
import {
  getDefaultModel,
  getSavedModel,
  saveModel
} from "../src/settings/model";
import {
  addPromptPreset,
  deletePromptPreset,
  getDefaultPromptPresets,
  getSavedPromptPresets,
  getSelectedPromptPreset,
  getSelectedPromptPresetId,
  savePromptPresets,
  saveSelectedPromptPresetId,
  updatePromptPreset
} from "../src/settings/prompt-presets";
import {
  getDefaultSystemPrompt,
  getSavedSystemPrompt,
  saveSystemPrompt
} from "../src/settings/system-prompt";
import {
  resetPromptPresetsToDefaults,
  resetSettingsToDefaults
} from "../src/settings/reset";
import {
  getConfigFailureMessage,
  getConfigSuccessMessage
} from "../src/sidebar/config-feedback";
import {
  getMissingConfigFields,
  getMissingConfigMessage
} from "../src/sidebar/send-validation";
import {
  COMPACT_PANE_WIDTH,
  getPaneLayoutProfile
} from "../src/sidebar/layout-profile";
import {
  shouldEnableSendButton,
  shouldStartSendRequest
} from "../src/sidebar/pane-state";
import {
  MAX_CONTEXT_PREVIEW_LENGTH,
  TRUNCATED_PREVIEW_SUFFIX,
  buildPreviewTextFromContext,
  mergeNotePreviewTexts,
  stripHtml,
  truncatePreviewText
} from "../src/sidebar/context-preview";
import { resolvePaneContext } from "../src/sidebar/pane-context";
import {
  getReaderSelectionText,
  normalizePDFSelectionText
} from "../src/sidebar/pdf-selection";
import {
  appendHistoryEntry,
  buildHistoryEntry,
  buildHistorySummary,
  MAX_HISTORY_ITEMS
} from "../src/sidebar/session-history";
import {
  appendChatMessage,
  buildChatMessageEntry,
  removeLoadingChatMessages
} from "../src/sidebar/chat-stream";
import {
  deserializeChatSessions,
  serializeChatSessions
} from "../src/sidebar/chat-session-storage";
import {
  getItemSessionHistory,
  getItemSessionKey,
  setItemSessionHistory
} from "../src/sidebar/item-session";
import {
  escapeHtml,
  highlightCode,
  parseMarkdownBlocks,
  renderMarkdownPreviewHtml
} from "../src/sidebar/output-render";
import {
  MAX_TASK_INSTRUCTION_LENGTH,
  createUserContextMessage,
  createSystemPromptMessage,
  createChatCompletionsRequestBody
} from "../src/services/chat-completions";
import { renderPromptTemplate } from "../src/services/prompt-template";
import {
  buildPreviewMessages,
  formatPreviewMessages
} from "../src/services/request-preview";
import {
  AIRequestError,
  buildChatCompletionsEndpoint,
  createTimeoutSignal,
  ensureSuccessfulResponse,
  normalizeAIRequestError,
  parseChatCompletionsResponse,
  postChatCompletionsMessages,
  postChatCompletionsRequest,
  requestChatCompletionsText
} from "../src/services/ai-request";

describe("startup", function () {
  it("should register plugin instance on Zotero", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should set initialized flag after startup", function () {
    const plugin = Zotero[config.addonInstance] as {
      data?: { initialized?: boolean; sidebarPaneKey?: false | string };
    };

    assert.equal(plugin.data?.initialized, true);
    assert.isString(plugin.data?.sidebarPaneKey);
  });

  it("should persist API key in Zotero prefs", function () {
    const prefKey = `${config.prefsPrefix}.apiKey`;

    Zotero.Prefs.clear(prefKey, true);
    saveApiKey("sk-sideai-test");

    assert.strictEqual(getSavedApiKey(), "sk-sideai-test");

    Zotero.Prefs.clear(prefKey, true);
  });

  it("should persist baseURL in Zotero prefs", function () {
    const prefKey = `${config.prefsPrefix}.baseURL`;

    Zotero.Prefs.clear(prefKey, true);
    assert.strictEqual(getSavedBaseUrl(), getDefaultBaseUrl());

    saveBaseUrl("https://example.com/v1");
    assert.strictEqual(getSavedBaseUrl(), "https://example.com/v1");

    Zotero.Prefs.clear(prefKey, true);
  });

  it("should persist model in Zotero prefs", function () {
    const prefKey = `${config.prefsPrefix}.model`;

    Zotero.Prefs.clear(prefKey, true);
    assert.strictEqual(getSavedModel(), getDefaultModel());

    saveModel("gpt-4.1");
    assert.strictEqual(getSavedModel(), "gpt-4.1");

    Zotero.Prefs.clear(prefKey, true);
  });

  it("should persist system prompt in Zotero prefs", function () {
    const prefKey = `${config.prefsPrefix}.systemPrompt`;

    Zotero.Prefs.clear(prefKey, true);
    assert.strictEqual(getSavedSystemPrompt(), getDefaultSystemPrompt());

    saveSystemPrompt("Summarize this paper in Chinese.");
    assert.strictEqual(getSavedSystemPrompt(), "Summarize this paper in Chinese.");

    Zotero.Prefs.clear(prefKey, true);
  });

  it("should persist prompt preset list and selected preset in Zotero prefs", function () {
    const presetsPrefKey = `${config.prefsPrefix}.promptPresets`;
    const selectedPrefKey = `${config.prefsPrefix}.selectedPromptPreset`;

    Zotero.Prefs.clear(presetsPrefKey, true);
    Zotero.Prefs.clear(selectedPrefKey, true);

    const presets = getDefaultPromptPresets();
    presets[0].prompt = "Prompt A";
    presets[1].prompt = "Prompt B";
    savePromptPresets(presets);
    saveSelectedPromptPresetId(presets[1].id);

    assert.strictEqual(getSavedPromptPresets()[1].prompt, "Prompt B");
    assert.strictEqual(getSelectedPromptPresetId(), presets[1].id);
    assert.strictEqual(getSelectedPromptPreset().prompt, "Prompt B");

    Zotero.Prefs.clear(presetsPrefKey, true);
    Zotero.Prefs.clear(selectedPrefKey, true);
  });

  it("should add, update, and delete prompt presets safely", function () {
    const presets = getDefaultPromptPresets();
    const appendedPresets = addPromptPreset(
      presets,
      "Deep Dive",
      "Explain the paper in detail."
    );

    assert.lengthOf(appendedPresets, presets.length + 1);
    assert.strictEqual(
      appendedPresets[appendedPresets.length - 1].id,
      "deep-dive"
    );

    const updatedPresets = updatePromptPreset(
      appendedPresets,
      "deep-dive",
      {
        label: "Methods Focus",
        prompt: "Focus on methods only."
      }
    );
    const updatedPreset = updatedPresets.find(
      (preset) => preset.id === "methods-focus"
    );
    assert.isDefined(updatedPreset);
    assert.strictEqual(updatedPreset?.label, "Methods Focus");
    assert.strictEqual(updatedPreset?.prompt, "Focus on methods only.");

    const deletedPresets = deletePromptPreset(updatedPresets, "methods-focus");
    assert.lengthOf(deletedPresets, presets.length);
    assert.isUndefined(
      deletedPresets.find((preset) => preset.id === "methods-focus")
    );
  });

  it("should restore settings to defaults", function () {
    saveApiKey("sk-custom");
    saveBaseUrl("https://example.com/custom");
    saveModel("gpt-custom");
    saveSystemPrompt("Custom prompt");

    resetSettingsToDefaults();

    assert.strictEqual(getSavedApiKey(), "");
    assert.strictEqual(getSavedBaseUrl(), getDefaultBaseUrl());
    assert.strictEqual(getSavedModel(), getDefaultModel());
    assert.strictEqual(getSavedSystemPrompt(), getDefaultSystemPrompt());
  });

  it("should restore prompt presets to defaults independently", function () {
    const presetsPrefKey = `${config.prefsPrefix}.promptPresets`;
    const selectedPrefKey = `${config.prefsPrefix}.selectedPromptPreset`;

    const customPresets = [
      {
        id: "custom",
        label: "Custom",
        prompt: "Custom prompt"
      }
    ];

    savePromptPresets(customPresets);
    saveSelectedPromptPresetId("custom");
    saveSystemPrompt("Custom prompt");

    resetPromptPresetsToDefaults();

    assert.deepEqual(getSavedPromptPresets(), getDefaultPromptPresets());
    assert.strictEqual(
      getSelectedPromptPresetId(),
      getDefaultPromptPresets()[0].id
    );
    assert.strictEqual(
      getSavedSystemPrompt(),
      getDefaultPromptPresets()[0].prompt
    );

    Zotero.Prefs.clear(presetsPrefKey, true);
    Zotero.Prefs.clear(selectedPrefKey, true);
  });

  it("should build config feedback messages for save failures", function () {
    assert.strictEqual(
      getConfigFailureMessage("save"),
      "当前无法保存设置。"
    );
    assert.strictEqual(
      getConfigFailureMessage("save", new Error("Disk write failed.")),
      "当前无法保存设置。 Disk write failed."
    );
    assert.strictEqual(
      getConfigSuccessMessage("save"),
      "API Key、Base URL、模型和固定提示词已保存到本地。"
    );
  });

  it("should block send when required config is empty", function () {
    assert.deepEqual(
      getMissingConfigFields({
        apiKey: "",
        baseUrl: " ",
        model: "",
        systemPrompt: "prompt"
      }),
      ["Base URL", "模型", "API Key"]
    );
    assert.strictEqual(
      getMissingConfigMessage(["Base URL", "模型", "API Key"]),
      "发送前请先补全这些必填设置：Base URL、模型、API Key。"
    );
  });

  it("should merge all note contents into preview text", function () {
    assert.strictEqual(stripHtml("<p>Hello <b>world</b></p>"), "Hello world");
    assert.strictEqual(
      mergeNotePreviewTexts([
        "<p>First note</p>",
        "",
        "<div>Second <i>note</i></div>",
        "<p>Third note</p>"
      ]),
      "First note\n\nSecond note\n\nThird note"
    );
  });

  it("should tolerate empty text fields when building preview content", function () {
    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "",
        notesText: "",
        title: "未命名条目"
      }),
      ""
    );

    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "",
        notesText: "Only note text",
        title: "Paper title"
      }),
      ["标题：", "Paper title", "", "笔记：", "Only note text"].join("\n")
    );

    assert.strictEqual(mergeNotePreviewTexts(["", "   ", "<p></p>"]), "");
  });

  it("should include pdf selection text in unified preview context", function () {
    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "Abstract body",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        title: "Paper title"
      }),
      [
        "PDF 选中文本：",
        "Selected sentence",
        "",
        "标题：",
        "Paper title",
        "",
        "摘要：",
        "Abstract body",
        "",
        "笔记：",
        "Note body"
      ].join("\n")
    );
  });

  it("should fall back to item metadata context when pdf selection is empty", function () {
    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "Abstract body",
        notesText: "Note body",
        pdfSelectionText: "",
        title: "Paper title"
      }),
      [
        "标题：",
        "Paper title",
        "",
        "摘要：",
        "Abstract body",
        "",
        "笔记：",
        "Note body"
      ].join("\n")
    );
  });

  it("should recognize pdf reader context and resolve parent item as active context", function () {
    const parentItem = { id: 1 };
    const pdfAttachment = {
      id: 2,
      parentItemID: 1,
      isPDFAttachment: () => true
    };

    const result = resolvePaneContext({
      item: parentItem,
      readerItem: pdfAttachment,
      resolveParentItem: (itemID) => (itemID === 1 ? parentItem : undefined),
      tabType: "reader"
    });

    assert.strictEqual(result.source, "pdf-reader");
    assert.strictEqual(result.sourceLabel, "PDF 上下文");
    assert.strictEqual(result.item, parentItem);
    assert.strictEqual(result.parentItem, parentItem);
    assert.strictEqual(result.pdfAttachmentItem, pdfAttachment);
    assert.deepEqual(result.warnings, []);
  });

  it("should keep library item context separate from pdf reader context", function () {
    const regularItem = { id: 3 };

    const result = resolvePaneContext({
      item: regularItem,
      tabType: "library"
    });

    assert.strictEqual(result.source, "item");
    assert.strictEqual(result.sourceLabel, "条目上下文");
    assert.strictEqual(result.item, regularItem);
    assert.isUndefined(result.parentItem);
    assert.isUndefined(result.pdfAttachmentItem);
    assert.deepEqual(result.warnings, []);
  });

  it("should switch context correctly between library item view and pdf reader view", function () {
    const parentItem = { id: 11 };
    const pdfAttachment = {
      id: 12,
      parentItemID: 11,
      isPDFAttachment: () => true
    };

    const libraryContext = resolvePaneContext({
      item: parentItem,
      tabType: "library"
    });
    const pdfContext = resolvePaneContext({
      item: parentItem,
      readerItem: pdfAttachment,
      resolveParentItem: (itemID) => (itemID === 11 ? parentItem : undefined),
      tabType: "reader"
    });
    const backToLibraryContext = resolvePaneContext({
      item: parentItem,
      tabType: "library"
    });

    assert.strictEqual(libraryContext.source, "item");
    assert.strictEqual(libraryContext.sourceLabel, "条目上下文");
    assert.strictEqual(libraryContext.item, parentItem);

    assert.strictEqual(pdfContext.source, "pdf-reader");
    assert.strictEqual(pdfContext.sourceLabel, "PDF 上下文");
    assert.strictEqual(pdfContext.item, parentItem);
    assert.strictEqual(pdfContext.pdfAttachmentItem, pdfAttachment);

    assert.strictEqual(backToLibraryContext.source, "item");
    assert.strictEqual(backToLibraryContext.sourceLabel, "条目上下文");
    assert.strictEqual(backToLibraryContext.item, parentItem);
  });

  it("should warn when pdf reader item has no parent library item", function () {
    const pdfAttachment = {
      id: 4,
      parentItemID: false,
      isPDFAttachment: () => true
    };

    const result = resolvePaneContext({
      readerItem: pdfAttachment,
      tabType: "reader"
    });

    assert.strictEqual(result.source, "pdf-reader");
    assert.strictEqual(result.item, pdfAttachment);
    assert.deepEqual(result.warnings, [
      "当前 PDF 附件没有关联到上级文献条目。"
    ]);
  });

  it("should read and normalize current pdf selection text safely", function () {
    assert.strictEqual(
      normalizePDFSelectionText("\u00a0 Selected PDF text \n"),
      "Selected PDF text"
    );
    assert.strictEqual(
      getReaderSelectionText({
        _iframeWindow: {
          getSelection: () => ({
            toString: () => "\u00a0 Selected PDF text \n"
          })
        }
      }),
      "Selected PDF text"
    );
    assert.strictEqual(getReaderSelectionText(), "");
  });

  it("should adapt pane layout for narrow Zotero sidebar widths", function () {
    const compactLayout = getPaneLayoutProfile(COMPACT_PANE_WIDTH - 1);
    const regularLayout = getPaneLayoutProfile(COMPACT_PANE_WIDTH);

    assert.strictEqual(compactLayout.isCompact, true);
    assert.strictEqual(compactLayout.buttonFlex, "1 1 100%");
    assert.strictEqual(compactLayout.buttonWhiteSpace, "normal");
    assert.strictEqual(compactLayout.cardPadding, "6px");
    assert.strictEqual(compactLayout.outputMaxHeight, "144px");

    assert.strictEqual(regularLayout.isCompact, false);
    assert.strictEqual(regularLayout.buttonFlex, "1 1 80px");
    assert.strictEqual(regularLayout.buttonWhiteSpace, "nowrap");
    assert.strictEqual(regularLayout.cardPadding, "8px");
    assert.strictEqual(regularLayout.outputMaxHeight, "180px");
  });

  it("should keep chat layout usable across Zotero 8 pane width changes", function () {
    const compactLayout = getPaneLayoutProfile(280);
    const regularLayout = getPaneLayoutProfile(420);

    assert.strictEqual(compactLayout.isCompact, true);
    assert.strictEqual(compactLayout.buttonFlex, "1 1 100%");
    assert.strictEqual(compactLayout.buttonMinHeight, "32px");
    assert.strictEqual(compactLayout.outputMaxHeight, "144px");
    assert.strictEqual(compactLayout.historyMaxHeight, "128px");
    assert.strictEqual(compactLayout.textareaMinHeight, "80px");

    assert.strictEqual(regularLayout.isCompact, false);
    assert.strictEqual(regularLayout.buttonFlex, "1 1 80px");
    assert.strictEqual(regularLayout.buttonMinHeight, "28px");
    assert.strictEqual(regularLayout.outputMaxHeight, "180px");
    assert.strictEqual(regularLayout.historyMaxHeight, "160px");
    assert.strictEqual(regularLayout.textareaMinHeight, "96px");
  });

  it("should sanitize abnormal html-like note text into safe preview text", function () {
    assert.strictEqual(
      stripHtml(
        '<div>Alpha<script>alert("x")</script><style>.x{}</style><b>Beta</b></div>'
      ),
      'Alpha alert("x") .x{} Beta'
    );

    assert.strictEqual(
      mergeNotePreviewTexts([
        '<div>Line&nbsp;One</div>',
        '<p>Line <img src="x" />Two</p>',
        "<script>console.log('bad')</script>"
      ]),
      "Line&nbsp;One\n\nLine Two\n\nconsole.log('bad')"
    );
  });

  it("should build unified preview text from context object", function () {
    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "Abstract text",
        notesText: "Note one\n\nNote two",
        title: "Paper title"
      }),
      [
        "标题：",
        "Paper title",
        "",
        "摘要：",
        "Abstract text",
        "",
        "笔记：",
        "Note one",
        "",
        "Note two"
      ].join("\n")
    );
  });

  it("should truncate overly long preview text before sending", function () {
    const longText = "A".repeat(MAX_CONTEXT_PREVIEW_LENGTH + 120);
    const truncatedText = truncatePreviewText(longText);

    assert.strictEqual(truncatedText.length, MAX_CONTEXT_PREVIEW_LENGTH);
    assert.strictEqual(truncatedText.endsWith(TRUNCATED_PREVIEW_SUFFIX), true);

    const previewText = buildPreviewTextFromContext({
      abstractText: "B".repeat(MAX_CONTEXT_PREVIEW_LENGTH + 120),
      notesText: "",
      title: "Paper title"
    });

    assert.strictEqual(previewText.length, MAX_CONTEXT_PREVIEW_LENGTH);
    assert.strictEqual(previewText.includes("标题：\nPaper title"), true);
    assert.strictEqual(previewText.endsWith(TRUNCATED_PREVIEW_SUFFIX), true);
  });

  it("should truncate overly long pdf selection text inside preview context", function () {
    const previewText = buildPreviewTextFromContext({
      abstractText: "",
      notesText: "",
      pdfSelectionText: "P".repeat(MAX_CONTEXT_PREVIEW_LENGTH + 120),
      title: "Paper title"
    });

    assert.strictEqual(previewText.length, MAX_CONTEXT_PREVIEW_LENGTH);
    assert.strictEqual(previewText.includes("PDF 选中文本：\n"), true);
    assert.strictEqual(previewText.endsWith(TRUNCATED_PREVIEW_SUFFIX), true);
  });

  it("should define chat completions request body structure", function () {
    assert.deepEqual(
      createChatCompletionsRequestBody({
        messages: [
          { role: "system", content: "System prompt" },
          { role: "user", content: "User text" }
        ],
        model: " gpt-4.1-mini "
      }),
      {
        messages: [
          { role: "system", content: "System prompt" },
          { role: "user", content: "User text" }
        ],
        model: "gpt-4.1-mini"
      }
    );
  });

  it("should place fixed prompt into system message", function () {
    assert.deepEqual(createSystemPromptMessage("  You are a helper.  "), {
      content: "You are a helper.",
      role: "system"
    });
  });

  it("should place current text into user message", function () {
    assert.deepEqual(
      createUserContextMessage({
        currentText: "标题：\nPaper\n\n摘要：\nSummary",
        taskInstruction: "请分析以下文献内容。"
      }),
      {
        content:
          "请分析以下文献内容。\n\n标题：\nPaper\n\n摘要：\nSummary",
        role: "user"
      }
    );
  });

  it("should truncate overly long active composer messages before building user message", function () {
    const message = createUserContextMessage({
      currentText: "标题：\nPaper",
      taskInstruction: "Q".repeat(MAX_TASK_INSTRUCTION_LENGTH + 120)
    });

    assert.strictEqual(message.content.includes("标题：\nPaper"), true);
    assert.strictEqual(message.content.includes(TRUNCATED_PREVIEW_SUFFIX), true);
    assert.strictEqual(
      message.content.startsWith("Q".repeat(MAX_TASK_INSTRUCTION_LENGTH - TRUNCATED_PREVIEW_SUFFIX.length - 1)),
      true
    );
  });

  it("should support basic prompt template variables", function () {
    assert.strictEqual(
      renderPromptTemplate(
        [
          "标题：{{title}}",
          "摘要：{{ abstractText }}",
          "笔记：{{notesText}}",
          "当前内容：{{currentText}}",
          "未知变量：{{missing}}"
        ].join("\n"),
        {
          abstractText: "Abstract body",
          contextSource: "pdf-reader",
          contextSourceLabel: "PDF 上下文",
          notesText: "Note body",
          pdfSelectionText: "Selected sentence",
          previewText: "Unified preview",
          title: "Paper title"
        }
      ),
      [
        "标题：Paper title",
        "摘要：Abstract body",
        "笔记：Note body",
        "当前内容：Unified preview",
        "未知变量：{{missing}}"
      ].join("\n")
    );

    assert.strictEqual(
      renderPromptTemplate("选区：{{pdfSelectionText}}", {
        abstractText: "Abstract body",
        contextSource: "pdf-reader",
        contextSourceLabel: "PDF 上下文",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        previewText: "Unified preview",
        title: "Paper title"
      }),
      "选区：Selected sentence"
    );

    assert.strictEqual(
      renderPromptTemplate("来源：{{contextSourceLabel}}", {
        abstractText: "Abstract body",
        contextSource: "pdf-reader",
        contextSourceLabel: "PDF 上下文",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        previewText: "Unified preview",
        title: "Paper title"
      }),
      "来源：PDF 上下文"
    );
  });

  it("should build and format final request preview messages", function () {
    const messages = buildPreviewMessages({
      context: {
        abstractText: "Abstract body",
        contextSource: "pdf-reader",
        contextSourceLabel: "PDF 上下文",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        previewText:
          "PDF 选中文本：\nSelected sentence\n\n标题：\nPaper title\n\n摘要：\nAbstract body",
        title: "Paper title"
      },
      systemPromptTemplate: "Summarize {{title}} with {{abstractText}}."
    });

    assert.deepEqual(messages, [
      {
        content: "Summarize Paper title with Abstract body.",
        role: "system"
      },
      {
        content:
          "请分析以下文献内容。\n\nPDF 选中文本：\nSelected sentence\n\n标题：\nPaper title\n\n摘要：\nAbstract body",
        role: "user"
      }
    ]);

    assert.strictEqual(
      formatPreviewMessages(messages),
      [
        "SYSTEM:",
        "Summarize Paper title with Abstract body.",
        "",
        "USER:",
        "请分析以下文献内容。",
        "",
        "PDF 选中文本：",
        "Selected sentence",
        "",
        "标题：",
        "Paper title",
        "",
        "摘要：",
        "Abstract body"
      ].join("\n")
    );

    assert.strictEqual(
      formatPreviewMessages(messages, {
        abstractText: "Abstract body",
        contextSource: "pdf-reader",
        contextSourceLabel: "PDF 上下文",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        previewText:
          "PDF 选中文本：\nSelected sentence\n\n标题：\nPaper title\n\n摘要：\nAbstract body",
        title: "Paper title"
      }),
      [
        "上下文来源：",
        "PDF 上下文",
        "",
        "SYSTEM:",
        "Summarize Paper title with Abstract body.",
        "",
        "USER:",
        "请分析以下文献内容。",
        "",
        "PDF 选中文本：",
        "Selected sentence",
        "",
        "标题：",
        "Paper title",
        "",
        "摘要：",
        "Abstract body"
      ].join("\n")
    );
  });

  it("should use active composer text as task instruction when provided", function () {
    const messages = buildPreviewMessages({
      context: {
        abstractText: "Abstract body",
        contextSource: "pdf-reader",
        contextSourceLabel: "PDF 上下文",
        notesText: "Note body",
        pdfSelectionText: "Selected sentence",
        previewText: "PDF 选中文本：\nSelected sentence\n\n标题：\nPaper title",
        title: "Paper title"
      },
      systemPromptTemplate: "Summarize {{title}}.",
      taskInstruction: "Answer in Chinese and focus on methods."
    });

    assert.strictEqual(
      messages[1].content,
      "Answer in Chinese and focus on methods.\n\nPDF 选中文本：\nSelected sentence\n\n标题：\nPaper title"
    );
  });

  it("should rebuild final messages when switching prompt preset templates", function () {
    const context = {
      abstractText: "Abstract body",
      contextSource: "item" as const,
      contextSourceLabel: "条目上下文",
      notesText: "Note body",
      previewText: "标题：\nPaper title\n\n摘要：\nAbstract body",
      title: "Paper title"
    };

    const summaryMessages = buildPreviewMessages({
      context,
      systemPromptTemplate: "Summarize {{title}} in Chinese."
    });
    const critiqueMessages = buildPreviewMessages({
      context,
      systemPromptTemplate: "Critique {{title}} with focus on {{abstractText}}."
    });

    assert.strictEqual(
      summaryMessages[0].content,
      "Summarize Paper title in Chinese."
    );
    assert.strictEqual(
      critiqueMessages[0].content,
      "Critique Paper title with focus on Abstract body."
    );
    assert.strictEqual(summaryMessages[1].content, critiqueMessages[1].content);
  });

  it("should encapsulate chat completion request sending", async function () {
    let capturedUrl = "";
    let capturedOptions: RequestInit | undefined;

    const mockResponse = {
      ok: true
    } as Response;

    const response = await postChatCompletionsRequest({
      apiKey: " sk-test ",
      baseUrl: "https://example.com/v1/",
      body: {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1-mini"
      },
      fetchFn: async (url, options) => {
        capturedUrl = String(url);
        capturedOptions = options;
        return mockResponse;
      }
    });

    assert.strictEqual(response, mockResponse);
    assert.strictEqual(capturedUrl, "https://example.com/v1/chat/completions");
    assert.deepEqual(capturedOptions, {
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1-mini"
      }),
      headers: {
        Authorization: "Bearer sk-test",
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: undefined
    });
  });

  it("should build chat completions endpoint from custom baseURL", function () {
    assert.strictEqual(
      buildChatCompletionsEndpoint("https://example.com/v1/"),
      "https://example.com/v1/chat/completions"
    );
    assert.strictEqual(
      buildChatCompletionsEndpoint("https://example.com/proxy/openai"),
      "https://example.com/proxy/openai/chat/completions"
    );
  });

  it("should surface understandable errors for invalid baseURL values", async function () {
    let thrownError: unknown;

    try {
      await postChatCompletionsRequest({
        apiKey: "sk-test",
        baseUrl: "http://[invalid-url",
        body: {
          messages: [{ role: "user", content: "Hello" }],
          model: "gpt-4.1-mini"
        },
        fetchFn: async () => {
          throw new Error("Failed to parse URL from http://[invalid-url/chat/completions");
        }
      });
    } catch (error) {
      thrownError = error;
    }

    assert.instanceOf(thrownError, AIRequestError);
    assert.strictEqual(
      (thrownError as AIRequestError).message,
      "Failed to parse URL from http://[invalid-url/chat/completions"
    );
  });

  it("should surface authentication failures for invalid API keys", async function () {
    let thrownError: unknown;

    try {
      const response = await postChatCompletionsMessages({
        apiKey: "sk-invalid",
        baseUrl: "https://example.com/v1",
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1-mini",
        fetchFn: async () =>
          ({
            ok: false,
            status: 401
          }) as Response
      });

      ensureSuccessfulResponse(response);
    } catch (error) {
      thrownError = error;
    }

    assert.instanceOf(thrownError, AIRequestError);
    assert.strictEqual(
      (thrownError as AIRequestError).message,
      "请求失败，状态码 401。"
    );
    assert.strictEqual((thrownError as AIRequestError).status, 401);
  });

  it("should send custom model name through request service", async function () {
    let capturedBody = "";

    await postChatCompletionsMessages({
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
      messages: [{ role: "user", content: "Hello" }],
      model: "custom-model-name",
      fetchFn: async (_url, options) => {
        capturedBody = String(options?.body || "");
        return { ok: true } as Response;
      }
    });

    assert.strictEqual(
      capturedBody,
      JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
        model: "custom-model-name"
      })
    );
  });

  it("should support timeout control for request service", async function () {
    let clearedTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let receivedSignal: AbortSignal | undefined;

    const timeout = createTimeoutSignal({
      setTimeoutFn: (callback, _delay) => {
        callback();
        return 123 as ReturnType<typeof setTimeout>;
      },
      clearTimeoutFn: (timeoutId) => {
        clearedTimeoutId = timeoutId;
      },
      timeoutMs: 5000
    });

    assert.strictEqual(timeout.signal?.aborted, true);
    timeout.cleanup();
    assert.strictEqual(clearedTimeoutId, 123 as ReturnType<typeof setTimeout>);

    await postChatCompletionsRequest({
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
      body: {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1-mini"
      },
      timeoutMs: 5000,
      setTimeoutFn: (_callback, _delay) => 456 as ReturnType<typeof setTimeout>,
      clearTimeoutFn: (timeoutId) => {
        clearedTimeoutId = timeoutId;
      },
      fetchFn: async (_url, options) => {
        receivedSignal = options?.signal as AbortSignal | undefined;
        return { ok: true } as Response;
      }
    });

    assert.strictEqual(receivedSignal instanceof AbortSignal, true);
    assert.strictEqual(clearedTimeoutId, 456 as ReturnType<typeof setTimeout>);
  });

  it("should gracefully skip timeout wiring when AbortController is unavailable", function () {
    const originalAbortController = globalThis.AbortController;

    try {
      Reflect.deleteProperty(globalThis, "AbortController");
      const timeout = createTimeoutSignal({
        timeoutMs: 5000
      });

      assert.strictEqual(timeout.signal, undefined);
      timeout.cleanup();
    } finally {
      if (originalAbortController) {
        globalThis.AbortController = originalAbortController;
      }
    }
  });

  it("should surface timeout failures during request execution", async function () {
    let thrownError: unknown;

    try {
      await postChatCompletionsRequest({
        apiKey: "sk-test",
        baseUrl: "https://example.com/v1",
        body: {
          messages: [{ role: "user", content: "Hello" }],
          model: "gpt-4.1-mini"
        },
        timeoutMs: 10,
        fetchFn: async () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          throw abortError;
        }
      });
    } catch (error) {
      thrownError = error;
    }

    assert.instanceOf(thrownError, AIRequestError);
    assert.strictEqual(
      (thrownError as AIRequestError).message,
      "请求超时。"
    );
  });

  it("should normalize request failures and http errors", function () {
    const timeoutError = normalizeAIRequestError(
      Object.assign(new Error("The operation was aborted."), {
        name: "AbortError"
      })
    );
    assert.instanceOf(timeoutError, AIRequestError);
    assert.strictEqual(timeoutError.message, "请求超时。");

    const networkError = normalizeAIRequestError(new Error("Network down."));
    assert.strictEqual(networkError.message, "Network down.");

    const response = {
      ok: false,
      status: 503
    } as Response;

    let thrownError: unknown;
    try {
      ensureSuccessfulResponse(response);
    } catch (error) {
      thrownError = error;
    }

    assert.instanceOf(thrownError, AIRequestError);
    assert.strictEqual(
      (thrownError as AIRequestError).message,
      "请求失败，状态码 503。"
    );
    assert.strictEqual((thrownError as AIRequestError).status, 503);
  });

  it("should parse openai-compatible chat completions response", function () {
    assert.strictEqual(
      parseChatCompletionsResponse({
        choices: [
          {
            message: {
              content: "Parsed response text"
            }
          }
        ]
      }),
      "Parsed response text"
    );

    let thrownError: unknown;
    try {
      parseChatCompletionsResponse({ choices: [] });
    } catch (error) {
      thrownError = error;
    }

    assert.instanceOf(thrownError, AIRequestError);
    assert.strictEqual(
      (thrownError as AIRequestError).message,
      "响应格式不兼容。"
    );
  });

  it("should request and return parsed response text", async function () {
    const result = await requestChatCompletionsText({
      apiKey: "sk-test",
      baseUrl: "https://example.com/v1",
      messages: [{ role: "user", content: "Hello" }],
      model: "gpt-4.1-mini",
      fetchFn: async () =>
        ({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: "Final answer"
                }
              }
            ]
          })
        }) as Response
    });

    assert.strictEqual(result, "Final answer");
  });

  it("should keep send action enabled for retry after errors", function () {
    assert.strictEqual(shouldEnableSendButton("ready"), true);
    assert.strictEqual(shouldEnableSendButton("error"), true);
    assert.strictEqual(shouldEnableSendButton("loading"), false);
    assert.strictEqual(shouldEnableSendButton("empty"), false);
  });

  it("should block rapid repeated sends while request is loading", function () {
    assert.strictEqual(shouldStartSendRequest("ready"), true);
    assert.strictEqual(shouldStartSendRequest("error"), true);
    assert.strictEqual(shouldStartSendRequest("loading"), false);
    assert.strictEqual(shouldStartSendRequest("empty"), false);
  });

  it("should support clearing current session output", function () {
    const getClearedOutputPlaceholder = () =>
      "发送请求后，AI 回复会显示在这里。";

    assert.strictEqual(
      getClearedOutputPlaceholder(),
      "发送请求后，AI 回复会显示在这里。"
    );
  });

  it("should parse markdown output into paragraphs and code blocks", function () {
    assert.deepEqual(
      parseMarkdownBlocks(
        [
          "# Summary",
          "",
          "First paragraph",
          "second line",
          "",
          "```ts",
          "const answer = 42;",
          "```",
          "",
          "Final paragraph"
        ].join("\n")
      ),
      [
        {
          text: "# Summary",
          type: "paragraph"
        },
        {
          text: "First paragraph\nsecond line",
          type: "paragraph"
        },
        {
          language: "ts",
          text: "const answer = 42;",
          type: "code"
        },
        {
          text: "Final paragraph",
          type: "paragraph"
        }
      ]
    );
  });

  it("should render markdown preview html safely", function () {
    assert.strictEqual(escapeHtml("<tag>&value"), "&lt;tag&gt;&amp;value");
    const html = renderMarkdownPreviewHtml(
      ["Line <one>", "", "```html", "<b>safe</b>", "```"].join("\n")
    );

    assert.include(
      html,
      '<p class="sideai-output-paragraph">Line &lt;one&gt;</p>'
    );
    assert.include(
      html,
      '<pre class="sideai-output-code"><div class="sideai-output-code-header">html</div><code data-language="html">&lt;b&gt;safe&lt;/b&gt;</code></pre>'
    );
  });

  it("should render common markdown syntax in assistant replies", function () {
    const html = renderMarkdownPreviewHtml(
      [
        "## 标题",
        "",
        "**重点** 与 *说明* 还有 `code`",
        "",
        "- 第一项",
        "- 第二项",
        "",
        "1. 步骤一",
        "2. 步骤二"
      ].join("\n")
    );

    assert.include(
      html,
      '<h2 class="sideai-output-heading sideai-output-heading-2">标题</h2>'
    );
    assert.include(
      html,
      '<p class="sideai-output-paragraph"><strong>重点</strong> 与 <em>说明</em> 还有 <code class="sideai-output-inline-code">code</code></p>'
    );
    assert.include(html, '<ul class="sideai-output-list"><li>第一项</li>');
    assert.include(html, "<li>第二项</li>");
    assert.include(html, '<ol class="sideai-output-list"><li>步骤一</li>');
    assert.include(html, "<li>步骤二</li>");
  });

  it("should render inline and block math in assistant replies", function () {
    const html = renderMarkdownPreviewHtml(
      [
        "行内公式 $E=mc^2$。",
        "",
        "$$",
        "\\int_0^1 x^2 dx",
        "$$"
      ].join("\n")
    );

    assert.include(html, 'class="sideai-output-math-inline"');
    assert.include(html, "<math");
    assert.include(html, 'class="sideai-output-math-block"');
    assert.include(html, "<msup>");
  });

  it("should highlight common code tokens in fenced blocks", function () {
    assert.strictEqual(
      highlightCode(
        "ts",
        ['const value = "ok";', "// comment", "return 42;"].join("\n")
      ),
      [
        '<span class="sideai-token-keyword">const</span> value = <span class="sideai-token-string">"ok"</span>;',
        '<span class="sideai-token-comment">// comment</span>',
        '<span class="sideai-token-keyword">return</span> <span class="sideai-token-number">42</span>;'
      ].join("\n")
    );
    const html = renderMarkdownPreviewHtml(
      ["```json", '{ "name": "sideai", "enabled": true }', "```"].join("\n")
    );
    assert.include(
      html,
      '<pre class="sideai-output-code"><div class="sideai-output-code-header">json</div><code data-language="json">'
    );
    assert.include(
      html,
      '<span class="sideai-token-property">"name"</span>'
    );
    assert.include(
      html,
      '<span class="sideai-token-keyword">true</span>'
    );
  });

  it("should build capped session history entries", function () {
    assert.strictEqual(buildHistorySummary(" \n  first line   second line "), "first line second line");
    assert.strictEqual(buildHistorySummary(""), "空响应");

    const entry = buildHistoryEntry({
      content: "Result body",
      mode: "markdown",
      status: "success"
    });

    assert.strictEqual(entry.content, "Result body");
    assert.strictEqual(entry.mode, "markdown");
    assert.strictEqual(entry.status, "success");
    assert.strictEqual(entry.summary, "Result body");
    assert.isString(entry.id);

    let history = Array.from({ length: MAX_HISTORY_ITEMS }, (_value, index) =>
      buildHistoryEntry({
        content: `Item ${index}`,
        mode: "text",
        status: "success"
      })
    );

    const newestEntry = buildHistoryEntry({
      content: "Newest item",
      mode: "text",
      status: "error"
    });
    history = appendHistoryEntry(history, newestEntry);

    assert.strictEqual(history.length, MAX_HISTORY_ITEMS);
    assert.strictEqual(history[0].content, "Newest item");
    assert.strictEqual(history[0].status, "error");
  });

  it("should keep large history lists bounded and pane areas scroll-friendly", function () {
    const largeHistoryEntries = Array.from(
      { length: MAX_HISTORY_ITEMS * 3 },
      (_value, index) =>
        buildHistoryEntry({
          content: `History item ${index} `.repeat(8),
          mode: "markdown",
          status: index % 2 === 0 ? "success" : "error"
        })
    );
    const history = largeHistoryEntries.reduce(
      (entries, entry) => appendHistoryEntry(entries, entry),
      [] as SessionHistoryEntry[]
    );

    assert.strictEqual(history.length, MAX_HISTORY_ITEMS);
    assert.strictEqual(history[0].content.includes("History item"), true);

    const compactLayout = getPaneLayoutProfile(COMPACT_PANE_WIDTH - 1);
    const regularLayout = getPaneLayoutProfile(COMPACT_PANE_WIDTH + 80);

    assert.strictEqual(compactLayout.historyMaxHeight, "128px");
    assert.strictEqual(compactLayout.outputMaxHeight, "144px");
    assert.strictEqual(regularLayout.historyMaxHeight, "160px");
    assert.strictEqual(regularLayout.outputMaxHeight, "180px");
  });

  it("should isolate session history by Zotero item id", function () {
    const itemA = { id: 101 } as Zotero.Item;
    const itemB = { id: 202 } as Zotero.Item;
    const sessionA = buildHistoryEntry({
      content: "Item A answer",
      mode: "text",
      status: "success"
    });
    const sessionB = buildHistoryEntry({
      content: "Item B answer",
      mode: "markdown",
      status: "error"
    });

    let sessions = setItemSessionHistory({}, getItemSessionKey(itemA), [sessionA]);
    sessions = setItemSessionHistory(sessions, getItemSessionKey(itemB), [sessionB]);

    assert.deepEqual(getItemSessionHistory(sessions, getItemSessionKey(itemA)), [
      sessionA
    ]);
    assert.deepEqual(getItemSessionHistory(sessions, getItemSessionKey(itemB)), [
      sessionB
    ]);
    assert.deepEqual(getItemSessionHistory(sessions, null), []);
  });

  it("should isolate chat sessions when switching between Zotero items", function () {
    const itemA = { id: 101 } as Zotero.Item;
    const itemB = { id: 202 } as Zotero.Item;
    const itemAChat = [
      buildChatMessageEntry({
        content: "Item A question",
        mode: "text",
        role: "user"
      }),
      buildChatMessageEntry({
        content: "Item A answer",
        mode: "markdown",
        role: "assistant"
      })
    ];
    const itemBChat = [
      buildChatMessageEntry({
        content: "Item B question",
        mode: "text",
        role: "user"
      }),
      buildChatMessageEntry({
        content: "Item B answer",
        mode: "markdown",
        role: "assistant"
      })
    ];
    const itemAHistory = [
      buildHistoryEntry({
        content: "Item A answer",
        mode: "markdown",
        status: "success"
      })
    ];
    const itemBHistory = [
      buildHistoryEntry({
        content: "Item B answer",
        mode: "markdown",
        status: "success"
      })
    ];

    let chatSessions = setItemSessionHistory({}, getItemSessionKey(itemA), itemAChat);
    chatSessions = setItemSessionHistory(
      chatSessions,
      getItemSessionKey(itemB),
      itemBChat
    );
    let historySessions = setItemSessionHistory(
      {},
      getItemSessionKey(itemA),
      itemAHistory
    );
    historySessions = setItemSessionHistory(
      historySessions,
      getItemSessionKey(itemB),
      itemBHistory
    );

    assert.deepEqual(getItemSessionHistory(chatSessions, getItemSessionKey(itemA)), itemAChat);
    assert.deepEqual(getItemSessionHistory(chatSessions, getItemSessionKey(itemB)), itemBChat);
    assert.deepEqual(
      getItemSessionHistory(historySessions, getItemSessionKey(itemA)),
      itemAHistory
    );
    assert.deepEqual(
      getItemSessionHistory(historySessions, getItemSessionKey(itemB)),
      itemBHistory
    );
  });

  it("should build chat stream entries and remove loading placeholders", function () {
    const userMessage = buildChatMessageEntry({
      content: "Question body",
      mode: "text",
      role: "user"
    });
    const loadingMessage = buildChatMessageEntry({
      content: "正在请求模型回复...",
      mode: "text",
      role: "status",
      tone: "loading"
    });
    const assistantMessage = buildChatMessageEntry({
      content: "Answer body",
      mode: "markdown",
      role: "assistant"
    });

    const messages = appendChatMessage(
      appendChatMessage([userMessage], loadingMessage),
      assistantMessage
    );

    assert.strictEqual(messages.length, 3);
    assert.strictEqual(messages[0].role, "user");
    assert.strictEqual(messages[1].tone, "loading");
    assert.strictEqual(messages[2].role, "assistant");

    const settledMessages = removeLoadingChatMessages(messages);
    assert.strictEqual(settledMessages.length, 2);
    assert.strictEqual(
      settledMessages.some((message) => message.tone === "loading"),
      false
    );
  });

  it("should keep multi-turn chat messages and history across consecutive sends", function () {
    const firstUserMessage = buildChatMessageEntry({
      content: "First question",
      mode: "text",
      role: "user"
    });
    const firstAssistantMessage = buildChatMessageEntry({
      content: "First answer",
      mode: "markdown",
      role: "assistant"
    });
    const secondUserMessage = buildChatMessageEntry({
      content: "Second follow-up",
      mode: "text",
      role: "user"
    });
    const secondAssistantMessage = buildChatMessageEntry({
      content: "Second answer",
      mode: "markdown",
      role: "assistant"
    });

    let chatMessages = appendChatMessage([], firstUserMessage);
    chatMessages = appendChatMessage(chatMessages, firstAssistantMessage);
    chatMessages = appendChatMessage(chatMessages, secondUserMessage);
    chatMessages = appendChatMessage(chatMessages, secondAssistantMessage);

    assert.deepEqual(
      chatMessages.map((message) => [message.role, message.content]),
      [
        ["user", "First question"],
        ["assistant", "First answer"],
        ["user", "Second follow-up"],
        ["assistant", "Second answer"]
      ]
    );

    let history = appendHistoryEntry(
      [],
      buildHistoryEntry({
        content: "First answer",
        mode: "markdown",
        status: "success"
      })
    );
    history = appendHistoryEntry(
      history,
      buildHistoryEntry({
        content: "Second answer",
        mode: "markdown",
        status: "success"
      })
    );

    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].content, "Second answer");
    assert.strictEqual(history[1].content, "First answer");
  });

  it("should preserve retry metadata on error chat entries", function () {
    const retryMessages = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Question body" }
    ] as const;
    const errorMessage = buildChatMessageEntry({
      content: "请求失败。\n\nNetwork down.",
      mode: "text",
      role: "status",
      retryMessages: [...retryMessages],
      retryModel: "gpt-5.4",
      tone: "error"
    });

    assert.strictEqual(errorMessage.tone, "error");
    assert.strictEqual(errorMessage.retryModel, "gpt-5.4");
    assert.deepEqual(errorMessage.retryMessages, retryMessages);
  });

  it("should support interrupted failure flow followed by retry-ready error state", function () {
    const retryMessages = [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Question body" }
    ];
    const loadingMessage = buildChatMessageEntry({
      content: "正在请求模型回复...",
      mode: "text",
      role: "status",
      tone: "loading"
    });
    const failedMessage = buildChatMessageEntry({
      content: "请求失败。\n\n请求超时。",
      mode: "text",
      role: "status",
      retryMessages,
      retryModel: "gpt-5.4",
      tone: "error"
    });

    const duringRequest = appendChatMessage([], loadingMessage);
    assert.strictEqual(shouldStartSendRequest("loading"), false);
    assert.strictEqual(duringRequest[0].tone, "loading");

    const afterFailure = appendChatMessage(
      removeLoadingChatMessages(duringRequest),
      failedMessage
    );

    assert.strictEqual(afterFailure.length, 1);
    assert.strictEqual(afterFailure[0].tone, "error");
    assert.strictEqual(afterFailure[0].retryModel, "gpt-5.4");
    assert.deepEqual(afterFailure[0].retryMessages, retryMessages);
    assert.strictEqual(shouldEnableSendButton("error"), true);
    assert.strictEqual(shouldStartSendRequest("error"), true);
  });

  it("should serialize and restore persisted item chat sessions safely", function () {
    const persisted = {
      chats: {
        "item:1": [
          buildChatMessageEntry({
            content: "Hello",
            mode: "text",
            role: "user"
          })
        ]
      },
      history: {
        "item:1": [
          buildHistoryEntry({
            content: "Answer",
            mode: "markdown",
            status: "success"
          })
        ]
      }
    };

    const serialized = serializeChatSessions(persisted);
    const restored = deserializeChatSessions(serialized);

    assert.strictEqual(restored.chats["item:1"][0].content, "Hello");
    assert.strictEqual(restored.history["item:1"][0].content, "Answer");
    assert.deepEqual(deserializeChatSessions("{invalid"), {
      chats: {},
      history: {}
    });
  });

  it("should restore a saved item chat session after reload-like deserialization", function () {
    const itemKey = "item:101";
    const persisted = {
      chats: {
        [itemKey]: [
          buildChatMessageEntry({
            content: "Question before restart",
            mode: "text",
            role: "user"
          }),
          buildChatMessageEntry({
            content: "Answer before restart",
            mode: "markdown",
            role: "assistant"
          })
        ]
      },
      history: {
        [itemKey]: [
          buildHistoryEntry({
            content: "Answer before restart",
            mode: "markdown",
            status: "success"
          })
        ]
      }
    };

    const restored = deserializeChatSessions(serializeChatSessions(persisted));

    assert.strictEqual(restored.chats[itemKey].length, 2);
    assert.strictEqual(restored.chats[itemKey][0].content, "Question before restart");
    assert.strictEqual(restored.chats[itemKey][1].content, "Answer before restart");
    assert.strictEqual(restored.history[itemKey].length, 1);
    assert.strictEqual(restored.history[itemKey][0].content, "Answer before restart");
  });

  it("should clean plugin instance on shutdown", async function () {
    const plugin = Zotero[config.addonInstance] as {
      data: { alive?: boolean; initialized?: boolean };
      hooks: { onShutdown: () => Promise<void> };
    };

    await plugin.hooks.onShutdown();

    assert.strictEqual(plugin.data.alive, false);
    assert.strictEqual(plugin.data.initialized, false);
  });
});
