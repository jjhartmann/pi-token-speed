import {
  MAX_ROLLING_AVERAGE,
  ROLLING_AVERAGE_SAMPLE_MS,
} from "../../config/constants";
import type { ValidationCheckResult } from "../base";
import { ScalarSettingsItem } from "./scalar";

export const ROLLING_AVERAGE_DEFAULT = 10;

/** Menu label for a preset size, e.g. "10 samples / 3 s". */
const presetLabel = (size: number): string =>
  `${size} samples / ${(size * ROLLING_AVERAGE_SAMPLE_MS) / 1000} s`;

const ROLLING_AVERAGE_LABELS: Record<number, string> = {
  0: "Off",
  5: presetLabel(5),
  10: `${presetLabel(10)} (default)`,
  20: presetLabel(20),
  50: presetLabel(50),
  100: presetLabel(100),
};

/**
 * Numeric setting: how many live TPS samples (one every
 * `ROLLING_AVERAGE_SAMPLE_MS`) the rolling average covers (0 = hidden).
 */
export class RollingAverageSettingsItem extends ScalarSettingsItem<number> {
  constructor() {
    super({
      id: "rollingAverage",
      label: "Rolling average",
      description: `Average of the last N live TPS samples of the active prompt, one every ${ROLLING_AVERAGE_SAMPLE_MS} ms (0 = off)`,
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
