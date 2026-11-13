import { MAX_ROLLING_AVERAGE } from "../config/constants";

/**
 * Per-model record of completed-response TPS values.
 */
interface ModelHistory {
  /** Most recent per-response TPS values, oldest first (capped). */
  recent: number[];
  /** Highest per-response TPS recorded since the last reset. */
  max: number;
}

/**
 * Rolling average over the newest samples.
 */
export interface RollingAverage {
  /** Mean TPS of the samples used. */
  value: number;
  /** Number of samples used (≤ the requested size). */
  count: number;
}

/**
 * Builds the history key for a model: `"<provider>/<id>"`.
 *
 * @param model The active model, or undefined when none is selected.
 * @returns The key used to bucket samples per model.
 */
export const modelKey = (
  model: { provider: string; id: string } | undefined,
): string => `${model?.provider ?? ""}/${model?.id ?? ""}`;

/**
 * Session-scoped history of per-response tokens-per-second.
 *
 * Each completed agent run contributes one sample: its overall average
 * TPS. Samples are bucketed per model so switching models never mixes
 * their speeds. Only the newest `capacity` samples are kept for the
 * rolling average; the max covers every sample since the last reset.
 */
export class TpsHistory {
  private readonly models = new Map<string, ModelHistory>();

  constructor(private readonly capacity = MAX_ROLLING_AVERAGE) {}

  /**
   * Records one completed response. Non-finite or non-positive values
   * (e.g. a run that produced no tokens) are ignored.
   *
   * @param key The model key (see `modelKey`).
   * @param tps The response's overall average TPS.
   */
  record(key: string, tps: number): void {
    if (!Number.isFinite(tps) || tps <= 0) return;

    let entry = this.models.get(key);
    if (!entry) {
      entry = { recent: [], max: 0 };
      this.models.set(key, entry);
    }

    entry.recent.push(tps);
    if (entry.recent.length > this.capacity) entry.recent.shift();
    entry.max = Math.max(entry.max, tps);
  }

  /**
   * Mean TPS of the newest `size` responses for a model.
   *
   * @param key The model key (see `modelKey`).
   * @param size How many recent responses to average (≤ 0 = disabled).
   * @returns The average and sample count, or undefined when disabled or
   *   no responses have been recorded.
   */
  average(key: string, size: number): RollingAverage | undefined {
    const recent = this.models.get(key)?.recent;
    if (!recent?.length || size <= 0) return undefined;

    const window = recent.slice(-size);
    const sum = window.reduce((acc, tps) => acc + tps, 0);
    return { value: sum / window.length, count: window.length };
  }

  /**
   * Highest per-response TPS recorded for a model.
   *
   * @param key The model key (see `modelKey`).
   * @returns The max, or undefined when no responses have been recorded.
   */
  max(key: string): number | undefined {
    return this.models.get(key)?.max;
  }

  /**
   * Discards all recorded samples (called on session start).
   */
  reset(): void {
    this.models.clear();
  }
}
