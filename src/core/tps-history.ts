/**
 * Builds the history key for a model: `"<provider>/<id>"`.
 *
 * @param model The active model, or undefined when none is selected.
 * @returns The key used to bucket results per model.
 */
export const modelKey = (
  model: { provider: string; id: string } | undefined,
): string => `${model?.provider ?? ""}/${model?.id ?? ""}`;

/**
 * Session-scoped record of the highest live tokens-per-second per model.
 *
 * Fed with every live TPS sample (the same readings the rolling average
 * uses), so the max updates while a prompt streams and is never below
 * the average. Bucketed per model so switching models never mixes their
 * speeds.
 */
export class TpsHistory {
  private readonly best = new Map<string, number>();

  /**
   * Records one live TPS sample. Non-finite or non-positive values
   * (e.g. a stall) are ignored.
   *
   * @param key The model key (see `modelKey`).
   * @param tps The sampled TPS.
   */
  record(key: string, tps: number): void {
    if (!Number.isFinite(tps) || tps <= 0) return;
    this.best.set(key, Math.max(this.best.get(key) ?? 0, tps));
  }

  /**
   * Highest TPS sampled for a model this session.
   *
   * @param key The model key (see `modelKey`).
   * @returns The max, or undefined when nothing has been sampled yet.
   */
  max(key: string): number | undefined {
    return this.best.get(key);
  }

  /**
   * Discards all recorded results (called on session start).
   */
  reset(): void {
    this.best.clear();
  }
}
