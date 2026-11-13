import type {
  AgentEndEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { SettingsProvider } from "../config/types";
import { Renderer } from "../ui/renderer";
import { TokenSpeedEngine } from "./engine";
import { LiveSampler } from "./live-sampler";
import type { MessageUpdatePayload } from "./message-handler";
import { MessageHandlerRegistry } from "./message-handler";
import {
  DeltaHandler,
  StreamStartHandler,
  ToolcallDeltaHandler,
  ToolcallEndHandler,
} from "./message-handlers";
import { modelKey, TpsHistory } from "./tps-history";

/**
 * Manages all Pi event subscriptions for the token-speed extension.
 */
export class EventManager {
  private readonly registry: MessageHandlerRegistry;
  private readonly sampler: LiveSampler;

  constructor(
    private readonly engine: TokenSpeedEngine,
    private readonly renderer: Renderer,
    private readonly settings: SettingsProvider,
    private readonly history: TpsHistory,
  ) {
    this.registry = new MessageHandlerRegistry();
    this.registry.register(
      new StreamStartHandler(engine, (ctx) => ctx.model?.provider),
    );
    this.registry.register(new DeltaHandler(engine, renderer));
    this.registry.register(new ToolcallDeltaHandler(engine, renderer));
    this.registry.register(new ToolcallEndHandler(engine));
    this.sampler = new LiveSampler(engine, renderer);
  }

  /**
   * Initializes the engine and renderer for a new session.
   *
   * @param ctx The Pi extension context.
   */
  async handleSessionStart(ctx: ExtensionContext): Promise<void> {
    await this.settings.initialize();
    const errors = this.settings.getErrors();

    if (errors.length > 0) {
      const message = ["[pi-token-speed]", ...errors].join("\n");
      ctx.ui.notify(message, "warning");
    }

    this.sampler.stop();
    this.engine.initialize();
    this.engine.applyProvider(ctx.model?.provider);
    this.history.reset();
    this.renderer.initialize(ctx);
    this.renderer.resetThrottle();
  }

  /**
   * Stops the engine and the live sampler when the session shuts down.
   */
  handleSessionShutdown(): void {
    this.sampler.stop();
    this.engine.stop();
  }

  /**
   * Starts TTFT measurement for user messages and begins streaming for assistant messages.
   *
   * @param event The message_start event payload.
   */
  handleMessageStart(event: { message?: { role?: string } }): void {
    if (event.message?.role === "user") {
      this.engine.startTTFT();
    }
  }

  /**
   * Routes message update events through the handler registry, and starts
   * the live sampler once the prompt is streaming.
   *
   * @param event The message_update event payload.
   * @param ctx The Pi extension context.
   */
  handleMessageUpdate(
    event: MessageUpdatePayload,
    ctx: ExtensionContext,
  ): void {
    this.registry.handle(event, ctx);
    if (this.engine.isStreaming) this.sampler.start(ctx);
  }

  /**
   * Stops sampling, reconciles the total token count, stops streaming,
   * records the run's average TPS for the session max, and updates the
   * renderer.
   *
   * @param event The message_end event payload.
   * @param ctx The Pi extension context.
   */
  handleAgentEnd(event: AgentEndEvent, ctx: ExtensionContext): void {
    this.sampler.stop();

    // A run that never started streaming (e.g. a request error) carries
    // the previous run's counters, so it must not produce a sample.
    const streamed = this.engine.isStreaming;
    this.engine.stop();

    // Only assistant and toolResult messages carry usage data
    const outputTokens = event.messages.reduce((acc, curr) => {
      if (curr.role === "assistant") {
        return acc + curr.usage.output;
      }
      if (curr.role === "toolResult") {
        return acc + (curr.usage?.output ?? 0);
      }
      return acc;
    }, 0);

    this.engine.reconcileTotal(outputTokens);
    if (streamed) {
      this.history.record(modelKey(ctx.model), this.engine.tpsAvg);
    }
    // Bypass the throttle so the final values are always shown
    this.renderer.update(ctx, true);
  }
}
