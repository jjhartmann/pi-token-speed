import { ScalarSettingsItem } from "./scalar";

export const SHOW_MAX_DEFAULT = true;

/**
 * Boolean setting: show the highest live TPS of the session.
 */
export class ShowMaxSettingsItem extends ScalarSettingsItem<boolean> {
  constructor() {
    super({
      id: "showMax",
      label: "Show max TPS",
      description:
        "Show the highest live TPS this session for the current model",
      default: SHOW_MAX_DEFAULT,
      toggle: ["On", "Off"],
    });
  }
}
