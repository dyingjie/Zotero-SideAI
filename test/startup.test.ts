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
  createUserContextMessage,
  createSystemPromptMessage,
  createChatCompletionsRequestBody
} from "../src/services/chat-completions";
import { renderPromptTemplate } from "../src/services/prompt-template";
import {
  buildPreviewMessages,
  formatPreviewMessages
} from "../src/services/request-preview";
import { postChatCompletionsRequest } from "../src/services/ai-request";

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
      body: {
        messages: [{ role: "user", content: "Hello" }],
        model: "gpt-4.1-mini"
      },
      endpoint: "https://example.com/v1/chat/completions",
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
      method: "POST"
    });
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
