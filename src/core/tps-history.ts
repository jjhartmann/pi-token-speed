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
 * Session-scoped record of the best per-response tokens-per-second.
 *
 * Each completed agent run reports its overall average TPS. Results are
 * bucketed per model so switching models never mixes their speeds.
 */
export class TpsHistory {
  private readonly best = new Map<string, number>();

  /**
   * Records one completed response. Non-finite or non-positive values
   * (e.g. a run that produced no tokens) are ignored.
   *
   * @param key The model key (see `modelKey`).
   * @param tps The response's overall average TPS.
   */
  record(key: string, tps: number): void {
    if (!Number.isFinite(tps) || tps <= 0) return;
    this.best.set(key, Math.max(this.best.get(key) ?? 0, tps));
  }

  /**
   * Highest per-response TPS recorded for a model.
   *
   * @param key The model key (see `modelKey`).
   * @returns The max, or undefined when no responses have been recorded.
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
