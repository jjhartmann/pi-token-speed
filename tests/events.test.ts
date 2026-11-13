import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentEndEvent,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { TokenSpeedEngine } from "../src/core/engine";
import { EventManager } from "../src/core/events";
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

describe("EventManager history recording", () => {
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

  it("records the run's overall average TPS for the current model", () => {
    engine.start();
    engine.mockTime += 2_000;
    manager.handleAgentEnd(agentEnd(100), ctx);

    // 100 reconciled tokens over 2s
    expect(history.average(KEY, 10)).toEqual({ value: 50, count: 1 });
    expect(history.max(KEY)).toBe(50);
  });

  it("does not record a run that never started streaming", () => {
    engine.start();
    engine.mockTime += 2_000;
    manager.handleAgentEnd(agentEnd(100), ctx);

    // Second agent_end without a new stream (e.g. a request error)
    engine.mockTime += 5_000;
    manager.handleAgentEnd(agentEnd(0), ctx);

    expect(history.average(KEY, 10)?.count).toBe(1);
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
