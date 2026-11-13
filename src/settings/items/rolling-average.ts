import { MAX_ROLLING_AVERAGE } from "../../config/constants";
import type { ValidationCheckResult } from "../base";
import { ScalarSettingsItem } from "./scalar";

export const ROLLING_AVERAGE_DEFAULT = 10;

const ROLLING_AVERAGE_LABELS: Record<number, string> = {
  0: "Off",
  5: "Last 5 responses",
  10: "Last 10 responses (default)",
  20: "Last 20 responses",
  50: "Last 50 responses",
};

/**
 * Numeric setting: how many recent responses the rolling-average TPS
 * covers (0 = hidden).
 */
export class RollingAverageSettingsItem extends ScalarSettingsItem<number> {
  constructor() {
    super({
      id: "rollingAverage",
      label: "Rolling average",
      description:
        "Show the average TPS of the last N responses for the current model (0 = off)",
      default: ROLLING_AVERAGE_DEFAULT,
      labels: ROLLING_AVERAGE_LABELS,
      max: MAX_ROLLING_AVERAGE,
    });
  }

  /**
   * Requires a whole number between 0 and `MAX_ROLLING_AVERAGE`.
   *
   * @param value The value to validate.
   * @returns A ValidationCheckResult with validity, corrections, and errors.
   */
  validate(value: unknown): ValidationCheckResult {
    const result = super.validate(value);
    const num = result.corrected as number;
    if (result.valid && Number.isInteger(num) && num >= 0) return result;
    return {
      valid: false,
      corrected: this.options.default,
      errors: [
        `Invalid ${this.id} "${value}" (expected a whole number from 0 to ${MAX_ROLLING_AVERAGE}) — defaulting to ${this.options.default}.`,
      ],
    };
  }
}
