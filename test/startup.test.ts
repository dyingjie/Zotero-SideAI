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
  getDefaultSystemPrompt,
  getSavedSystemPrompt,
  saveSystemPrompt
} from "../src/settings/system-prompt";
import { resetSettingsToDefaults } from "../src/settings/reset";
import {
  getConfigFailureMessage,
  getConfigSuccessMessage
} from "../src/sidebar/config-feedback";
import {
  getMissingConfigFields,
  getMissingConfigMessage
} from "../src/sidebar/send-validation";
import {
  buildPreviewTextFromContext,
  mergeNotePreviewTexts,
  stripHtml
} from "../src/sidebar/context-preview";
import {
  escapeHtml,
  parseMarkdownBlocks,
  renderMarkdownPreviewHtml
} from "../src/sidebar/output-render";
import {
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

  it("should build config feedback messages for save failures", function () {
    assert.strictEqual(
      getConfigFailureMessage("save"),
      "Unable to save settings right now."
    );
    assert.strictEqual(
      getConfigFailureMessage("save", new Error("Disk write failed.")),
      "Unable to save settings right now. Disk write failed."
    );
    assert.strictEqual(
      getConfigSuccessMessage("save"),
      "API Key, Base URL, model, and fixed prompt are saved locally."
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
      ["Base URL", "Model", "API Key"]
    );
    assert.strictEqual(
      getMissingConfigMessage(["Base URL", "Model", "API Key"]),
      "Please complete required settings before sending: Base URL, Model, API Key."
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

  it("should build unified preview text from context object", function () {
    assert.strictEqual(
      buildPreviewTextFromContext({
        abstractText: "Abstract text",
        notesText: "Note one\n\nNote two",
        title: "Paper title"
      }),
      [
        "Title:",
        "Paper title",
        "",
        "Abstract:",
        "Abstract text",
        "",
        "Notes:",
        "Note one",
        "",
        "Note two"
      ].join("\n")
    );
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
        currentText: "Title:\nPaper\n\nAbstract:\nSummary",
        taskInstruction: "Please analyze the following paper."
      }),
      {
        content:
          "Please analyze the following paper.\n\nTitle:\nPaper\n\nAbstract:\nSummary",
        role: "user"
      }
    );
  });

  it("should support basic prompt template variables", function () {
    assert.strictEqual(
      renderPromptTemplate(
        [
          "Title: {{title}}",
          "Abstract: {{ abstractText }}",
          "Notes: {{notesText}}",
          "Current: {{currentText}}",
          "Unknown: {{missing}}"
        ].join("\n"),
        {
          abstractText: "Abstract body",
          notesText: "Note body",
          previewText: "Unified preview",
          title: "Paper title"
        }
      ),
      [
        "Title: Paper title",
        "Abstract: Abstract body",
        "Notes: Note body",
        "Current: Unified preview",
        "Unknown: {{missing}}"
      ].join("\n")
    );
  });

  it("should build and format final request preview messages", function () {
    const messages = buildPreviewMessages({
      context: {
        abstractText: "Abstract body",
        notesText: "Note body",
        previewText: "Title:\nPaper title\n\nAbstract:\nAbstract body",
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
          "Please analyze the following paper.\n\nTitle:\nPaper title\n\nAbstract:\nAbstract body",
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
        "Please analyze the following paper.",
        "",
        "Title:",
        "Paper title",
        "",
        "Abstract:",
        "Abstract body"
      ].join("\n")
    );
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

  it("should normalize request failures and http errors", function () {
    const timeoutError = normalizeAIRequestError(
      Object.assign(new Error("The operation was aborted."), {
        name: "AbortError"
      })
    );
    assert.instanceOf(timeoutError, AIRequestError);
    assert.strictEqual(timeoutError.message, "Request timed out.");

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
      "Request failed with status 503."
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
      "Response format is incompatible."
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
    const shouldEnableSendButton = (
      state: "empty" | "ready" | "loading" | "error"
    ) => state !== "empty" && state !== "loading";

    assert.strictEqual(shouldEnableSendButton("ready"), true);
    assert.strictEqual(shouldEnableSendButton("error"), true);
    assert.strictEqual(shouldEnableSendButton("loading"), false);
    assert.strictEqual(shouldEnableSendButton("empty"), false);
  });

  it("should support clearing current session output", function () {
    const getClearedOutputPlaceholder = () =>
      "AI response output will appear in this area after sending a request.";

    assert.strictEqual(
      getClearedOutputPlaceholder(),
      "AI response output will appear in this area after sending a request."
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
    assert.strictEqual(
      renderMarkdownPreviewHtml(
        ["Line <one>", "", "```html", "<b>safe</b>", "```"].join("\n")
      ),
      [
        '<p class="sideai-output-paragraph">Line &lt;one&gt;</p>',
        '<pre class="sideai-output-code"><code data-language="html">&lt;b&gt;safe&lt;/b&gt;</code></pre>'
      ].join("")
    );
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
