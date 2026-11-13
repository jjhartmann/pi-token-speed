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
import { Renderer } from "../src/ui/renderer";
import { makeSettingsMock } from "./mocks/settings";

// End-to-end: real engine, sampler, history and renderer driven through
// Pi events, asserting on the status bar text a user would see.

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

const update = (type: string, delta?: string): MessageUpdatePayload => ({
  assistantMessageEvent: { type, delta },
});

const agentEnd = () =>
  ({ type: "agent_end", messages: [] }) as unknown as AgentEndEvent;

describe("status bar avg / max (integration)", () => {
  let manager: EventManager;
  let ctx: ExtensionContext;
  let setStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    const settings = makeSettingsMock(); // rollingAverage 10, showMax on
    const engine = new TokenSpeedEngine(settings);
    const history = new TpsHistory();
    const renderer = new Renderer(engine, settings, history);
    manager = new EventManager(engine, renderer, settings, history);

    setStatus = vi.fn();
    ctx = {
      model: { provider: "local", id: "qwen" },
      ui: {
        setStatus,
        notify: vi.fn(),
        theme: { fg: (_color: string, text: string) => text },
      },
    } as unknown as ExtensionContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Latest status bar text, without colors. */
  const status = () => stripAnsi(setStatus.mock.calls.at(-1)![1] as string);

  /** Parses "avg: x" / "max: y" from the latest status ("--" → null). */
  const readout = () => {
    const text = status();
    const value = (label: string) => {
      const match = text.match(new RegExp(`${label}: (--|[\\d.]+)`));
      if (!match) return undefined;
      return match[1] === "--" ? null : Number(match[1]);
    };
    return { avg: value("avg"), max: value("max") };
  };

  /** Streams tokens at a steady rate for `ms`, checking every render. */
  const stream = (tokensPerSec: number, ms: number, check: () => void) => {
    const step = 1000 / tokensPerSec;
    for (let t = 0; t < ms; t += step) {
      vi.advanceTimersByTime(step);
      manager.handleMessageUpdate(update("text_delta", "x"), ctx);
      check();
    }
  };

  it("shows avg and max placeholders from session start", async () => {
    await manager.handleSessionStart(ctx);
    expect(status()).toContain("avg: --");
    expect(status()).toContain("max: --");
  });

  it("updates max live and never shows it below the average", async () => {
    await manager.handleSessionStart(ctx);
    const maxSeen: number[] = [];
    const check = () => {
      const { avg, max } = readout();
      if (typeof avg === "number") {
        expect(max).not.toBeNull();
        expect(max!).toBeGreaterThanOrEqual(avg);
      }
      if (typeof max === "number") maxSeen.push(max);
    };

    // Prompt 1: steady 20 tok/s for 3s
    manager.handleMessageUpdate(update("text_start"), ctx);
    stream(20, 3_000, check);
    manager.handleAgentEnd(agentEnd(), ctx);

    // Prompt 2: slow start, then much faster
    manager.handleMessageUpdate(update("text_start"), ctx);
    stream(10, 2_000, check);
    const maxBeforeSpeedup = readout().max as number;
    stream(80, 3_000, check);

    // Max rose during the stream, before the prompt finished
    expect(readout().max as number).toBeGreaterThan(maxBeforeSpeedup);
    expect(maxSeen.length).toBeGreaterThan(0);
    expect(ROLLING_AVERAGE_SAMPLE_MS).toBe(300);
  });
});
