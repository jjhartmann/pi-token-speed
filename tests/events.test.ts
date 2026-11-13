import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentEndEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { ROLLING_AVERAGE_SAMPLE_MS } from "../src/config/constants";
import { TokenSpeedEngine } from "../src/core/engine";
import { EventManager } from "../src/core/events";
import type { MessageUpdatePayload } from "../src/core/message-handler";
import { TpsHistory } from "../src/core/tps-history";
import type { Renderer } from "../src/ui/renderer";
import { makeSettingsMock } from "./mocks/settings";

class TimeMockedEngine extends TokenSpeedEngine {
  mockTime = 1_000;
  protected override now(): number {
    return this.mockTime;
  }
}

const KEY = "local/qwen";

const agentEnd = (output: number) =>
  ({
    type: "agent_end",
    messages: [{ role: "assistant", usage: { output } }],
  }) as unknown as AgentEndEvent;

const update = (type: string, delta?: string): MessageUpdatePayload => ({
  assistantMessageEvent: { type, delta },
});

describe("EventManager", () => {
  let engine: TimeMockedEngine;
  let history: TpsHistory;
  let renderer: Renderer;
  let manager: EventManager;
  let ctx: ExtensionContext;

  beforeEach(() => {
    const settings = makeSettingsMock();
    engine = new TimeMockedEngine(settings);
    engine.initialize();
    history = new TpsHistory();
    renderer = {
      update: vi.fn(),
      initialize: vi.fn(),
      resetThrottle: vi.fn(),
    } as unknown as Renderer;
    manager = new EventManager(engine, renderer, settings, history);
    ctx = {
      model: { provider: "local", id: "qwen" },
      ui: { notify: vi.fn() },
    } as unknown as ExtensionContext;
  });

  // ── session max ────────────────────────────────────────────────────

  describe("session max", () => {
    it("records the run's overall average TPS for the current model", () => {
      engine.start();
      engine.mockTime += 2_000;
      manager.handleAgentEnd(agentEnd(100), ctx);

      // 100 reconciled tokens over 2s
      expect(history.max(KEY)).toBe(50);
    });

    it("does not record a run that never started streaming", () => {
      engine.start();
      engine.mockTime += 2_000;
      manager.handleAgentEnd(agentEnd(100), ctx);

      // Second agent_end without a new stream (e.g. a request error):
      // recording it would give 1000 tok / 7s ≈ 143 tok/s
      engine.mockTime += 5_000;
      manager.handleAgentEnd(agentEnd(1000), ctx);

      expect(history.max(KEY)).toBe(50);
    });

    it("forces the final render past the update throttle", () => {
      engine.start();
      manager.handleAgentEnd(agentEnd(0), ctx);
      expect(renderer.update).toHaveBeenCalledWith(ctx, true);
    });

    it("clears the history on session start", async () => {
      history.record(KEY, 42);
      await manager.handleSessionStart(ctx);
      expect(history.max(KEY)).toBeUndefined();
    });
  });

  // ── live sampling ──────────────────────────────────────────────────

  describe("live sampling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const streamOneToken = () => {
      manager.handleMessageUpdate(update("text_start"), ctx);
      manager.handleMessageUpdate(update("text_delta", "x"), ctx);
    };

    it("samples the live TPS while the prompt streams", () => {
      streamOneToken();
      engine.mockTime += 500;
      vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS);

      // 1 token, 500 ms after it arrived
      expect(engine.rollingAverage(10)).toBe(2);
    });

    it("stops sampling at agent end and keeps the final average", () => {
      streamOneToken();
      engine.mockTime += 500;
      vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS);
      manager.handleAgentEnd(agentEnd(1), ctx);

      const renders = vi.mocked(renderer.update).mock.calls.length;
      vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 5);
      expect(renderer.update).toHaveBeenCalledTimes(renders);
      expect(engine.rollingAverage(10)).toBe(2);
    });

    it("stops sampling on session shutdown", () => {
      streamOneToken();
      manager.handleSessionShutdown();

      const renders = vi.mocked(renderer.update).mock.calls.length;
      vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 5);
      expect(renderer.update).toHaveBeenCalledTimes(renders);
    });

    it("does not start sampling before the prompt streams", () => {
      manager.handleMessageUpdate(update("text_delta", "x"), ctx);
      vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 5);
      expect(engine.rollingAverage(10)).toBeUndefined();
    });
  });
});
