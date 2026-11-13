import { describe, expect, it } from "vitest";

import { MAX_ROLLING_AVERAGE } from "../../../src/config/constants";
import { SettingsValidator } from "../../../src/config/settings-validator";
import {
  ROLLING_AVERAGE_DEFAULT,
  RollingAverageSettingsItem,
} from "../../../src/settings/items/rolling-average";
import {
  SHOW_MAX_DEFAULT,
  ShowMaxSettingsItem,
} from "../../../src/settings/items/show-max";
import { makeDefaults } from "../../mocks/settings";

describe("RollingAverageSettingsItem", () => {
  const item = new RollingAverageSettingsItem();

  it.each([0, 1, 10, MAX_ROLLING_AVERAGE])("accepts %s", (value) => {
    expect(item.validate(value)).toEqual({ valid: true, corrected: value });
  });

  it.each([-1, 2.5, MAX_ROLLING_AVERAGE + 1, "abc", null])(
    "rejects %s and falls back to the default",
    (value) => {
      const result = item.validate(value);
      expect(result.valid).toBe(false);
      expect(result.corrected).toBe(ROLLING_AVERAGE_DEFAULT);
      expect(result.errors?.[0]).toContain("rollingAverage");
    },
  );

  it("formats presets by label and custom sizes as numbers", () => {
    const config = makeDefaults();
    expect(item.format({ ...config, rollingAverage: 0 })).toBe("Off");
    expect(item.format({ ...config, rollingAverage: 10 })).toBe(
      "10 samples / 3 s (default)",
    );
    expect(item.format({ ...config, rollingAverage: 100 })).toBe(
      "100 samples / 30 s",
    );
    expect(item.format({ ...config, rollingAverage: 7 })).toBe("7");
  });

  it("parses a menu label back to a number", () => {
    const config = makeDefaults();
    expect(item.setConfig(config, "5 samples / 1.5 s")).toEqual({
      valid: true,
      config: { rollingAverage: 5 },
    });
    expect(item.setConfig(config, "Off")).toEqual({
      valid: true,
      config: { rollingAverage: 0 },
    });
  });
});

describe("ShowMaxSettingsItem", () => {
  const item = new ShowMaxSettingsItem();

  it("toggles between On and Off", () => {
    const config = makeDefaults();
    expect(item.format({ ...config, showMax: true })).toBe("On");
    expect(item.setConfig(config, "Off")).toEqual({
      valid: true,
      config: { showMax: false },
    });
  });

  it("rejects a non-boolean and falls back to the default", () => {
    const result = item.validate("yes");
    expect(result.valid).toBe(false);
    expect(result.corrected).toBe(SHOW_MAX_DEFAULT);
  });
});

describe("SettingsValidator (history settings)", () => {
  it("corrects invalid rollingAverage and showMax values", () => {
    const { config, errors } = new SettingsValidator().validateConfig({
      ...makeDefaults(),
      rollingAverage: -3,
      showMax: "no" as unknown as boolean,
    });
    expect(config.rollingAverage).toBe(ROLLING_AVERAGE_DEFAULT);
    expect(config.showMax).toBe(SHOW_MAX_DEFAULT);
    expect(errors).toHaveLength(2);
  });
});
