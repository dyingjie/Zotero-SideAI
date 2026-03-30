import { assert } from "chai";
import { config } from "../package.json";
import { getSavedApiKey, saveApiKey } from "../src/settings/api-key";

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
