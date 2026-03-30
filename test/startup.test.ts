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
