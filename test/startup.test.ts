import { assert } from "chai";
import { config } from "../package.json";

describe("startup", function () {
  it("should register plugin instance on Zotero", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should set initialized flag after startup", function () {
    const plugin = Zotero[config.addonInstance] as {
      data?: { initialized?: boolean };
    };

    assert.equal(plugin.data?.initialized, true);
  });
});
