/**
 * Fixed-capacity buffer of numeric samples with a rolling mean over the
 * newest N. Used to keep the live TPS samples of the active prompt.
 */
export class RollingSamples {
  private readonly samples: number[] = [];

  constructor(private readonly capacity: number) {}

  /**
   * Adds a sample, dropping the oldest once the capacity is reached.
   * Non-finite values are ignored.
   *
   * @param value The sample to add.
   */
  add(value: number): void {
    if (!Number.isFinite(value)) return;
    this.samples.push(value);
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  /**
   * Mean of the newest `size` samples.
   *
   * @param size How many recent samples to average (≤ 0 = disabled).
   * @returns The mean, or undefined when disabled or empty.
   */
  average(size: number): number | undefined {
    if (this.samples.length === 0 || size <= 0) return undefined;
    const window = this.samples.slice(-size);
    return window.reduce((acc, value) => acc + value, 0) / window.length;
  }

  /**
   * Discards all samples.
   */
  reset(): void {
    this.samples.length = 0;
  }
}
