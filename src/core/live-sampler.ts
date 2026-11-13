import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ROLLING_AVERAGE_SAMPLE_MS } from "../config/constants";
import type { Renderer } from "../ui/renderer";
import type { TokenSpeedEngine } from "./engine";
import { modelKey, type TpsHistory } from "./tps-history";

/**
 * Samples the live TPS on a fixed interval while a prompt is active,
 * feeds each sample to the session max, and re-renders, so the rolling
 * average and max update in real time — including during stalls, when
 * no deltas arrive to trigger a render.
 */
export class LiveSampler {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly engine: TokenSpeedEngine,
    private readonly renderer: Renderer,
    private readonly history: TpsHistory,
    private readonly intervalMs = ROLLING_AVERAGE_SAMPLE_MS,
  ) {}

  /**
   * Whether the sampling timer is running.
   */
  get isRunning(): boolean {
    return this.timer !== undefined;
  }

  /**
   * Starts sampling. A no-op while already running.
   *
   * @param ctx The Pi context used for re-rendering until `stop()`.
   */
  start(ctx: ExtensionContext): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(ctx), this.intervalMs);
    // Never keep the process alive just for sampling
    this.timer.unref?.();
  }

  /**
   * Stops sampling. Safe to call when not running.
   */
  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * Takes one sample, records it for the current model's session max, and
   * re-renders. Does nothing while paused for a tool call or waiting for
   * the first token.
   */
  private tick(ctx: ExtensionContext): void {
    const tps = this.engine.sample();
    if (tps === undefined) return;
    this.history.record(modelKey(ctx.model), tps);
    this.renderer.update(ctx);
  }
}
