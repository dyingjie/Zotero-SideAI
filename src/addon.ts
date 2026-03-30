import { config } from "../package.json";
import hooks from "./hooks";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    initialized: boolean;
    sidebarPaneKey: false | string;
  };

  public hooks: typeof hooks;
  public api: Record<string, never>;

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      sidebarPaneKey: false
    };
    this.hooks = hooks;
    this.api = {};
  }
}

export default Addon;
