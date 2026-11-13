import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ROLLING_AVERAGE_SAMPLE_MS } from "../config/constants";
import type { Renderer } from "../ui/renderer";
import type { TokenSpeedEngine } from "./engine";

/**
 * Samples the live TPS on a fixed interval while a prompt is active and
 * re-renders, so the rolling average updates in real time — including
 * during stalls, when no deltas arrive to trigger a render.
 */
export class LiveSampler {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly engine: TokenSpeedEngine,
    private readonly renderer: Renderer,
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
   * Takes one sample and re-renders when a sample was taken (nothing
   * changes while paused for a tool call or waiting for the first token).
   */
  private tick(ctx: ExtensionContext): void {
    if (this.engine.sample()) this.renderer.update(ctx);
  }
}
