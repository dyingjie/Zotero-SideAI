import Addon from "./addon";
import { config } from "../package.json";

declare const Zotero: typeof globalThis.Zotero & Record<string, unknown>;

if (!Zotero[config.addonInstance]) {
  _globalThis.addon = new Addon();
  Zotero[config.addonInstance] = addon;
}
