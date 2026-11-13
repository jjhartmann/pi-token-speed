import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ROLLING_AVERAGE_SAMPLE_MS } from "../src/config/constants";
import type { TokenSpeedEngine } from "../src/core/engine";
import { LiveSampler } from "../src/core/live-sampler";
import { TpsHistory } from "../src/core/tps-history";
import type { Renderer } from "../src/ui/renderer";

const ctx = {
  model: { provider: "local", id: "qwen" },
} as unknown as ExtensionContext;

const makeSampler = (samples: (number | undefined)[] = [10]) => {
  let i = 0;
  const engine = {
    sample: vi.fn(() => samples[Math.min(i++, samples.length - 1)]),
  };
  const renderer = { update: vi.fn() };
  const history = new TpsHistory();
  const sampler = new LiveSampler(
    engine as unknown as TokenSpeedEngine,
    renderer as unknown as Renderer,
    history,
  );
  return { engine, renderer, history, sampler };
};

describe("LiveSampler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`samples and re-renders every ${ROLLING_AVERAGE_SAMPLE_MS} ms while running`, () => {
    const { engine, renderer, sampler } = makeSampler();
    sampler.start(ctx);
    expect(sampler.isRunning).toBe(true);

    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS - 1);
    expect(engine.sample).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(engine.sample).toHaveBeenCalledTimes(1);
    expect(renderer.update).toHaveBeenCalledWith(ctx);

    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 2);
    expect(engine.sample).toHaveBeenCalledTimes(3);
    expect(renderer.update).toHaveBeenCalledTimes(3);
  });

  it("feeds every sample to the current model's session max", () => {
    const { history, sampler } = makeSampler([10, 40, 25]);
    sampler.start(ctx);

    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS);
    expect(history.max("local/qwen")).toBe(10);

    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 2);
    expect(history.max("local/qwen")).toBe(40);
  });

  it("does not record or re-render when no sample was taken", () => {
    const { engine, renderer, history, sampler } = makeSampler([undefined]);
    sampler.start(ctx);
    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 3);
    expect(engine.sample).toHaveBeenCalledTimes(3);
    expect(renderer.update).not.toHaveBeenCalled();
    expect(history.max("local/qwen")).toBeUndefined();
  });

  it("ignores start while already running", () => {
    const { engine, sampler } = makeSampler();
    sampler.start(ctx);
    sampler.start(ctx);
    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS);
    expect(engine.sample).toHaveBeenCalledTimes(1);
  });

  it("stops sampling", () => {
    const { engine, sampler } = makeSampler();
    sampler.start(ctx);
    sampler.stop();
    sampler.stop(); // safe when already stopped
    vi.advanceTimersByTime(ROLLING_AVERAGE_SAMPLE_MS * 5);
    expect(engine.sample).not.toHaveBeenCalled();
    expect(sampler.isRunning).toBe(false);
  });
});
