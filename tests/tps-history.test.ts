import { beforeEach, describe, expect, it } from "vitest";

import { modelKey, TpsHistory } from "../src/core/tps-history";

const KEY = "local/qwen";

describe("TpsHistory", () => {
  let history: TpsHistory;

  beforeEach(() => {
    history = new TpsHistory();
  });

  it("returns nothing before any response is recorded", () => {
    expect(history.average(KEY, 10)).toBeUndefined();
    expect(history.max(KEY)).toBeUndefined();
  });

  it("averages every sample when fewer than the requested size exist", () => {
    history.record(KEY, 10);
    history.record(KEY, 20);
    expect(history.average(KEY, 10)).toEqual({ value: 15, count: 2 });
  });

  it("averages only the newest N samples", () => {
    for (const tps of [10, 20, 30, 40]) history.record(KEY, tps);
    expect(history.average(KEY, 2)).toEqual({ value: 35, count: 2 });
  });

  it.each([0, -1])("returns no average when the size is %s", (size) => {
    history.record(KEY, 10);
    expect(history.average(KEY, size)).toBeUndefined();
  });

  it("tracks the max across every sample, not just the averaging window", () => {
    for (const tps of [50, 10, 20]) history.record(KEY, tps);
    expect(history.average(KEY, 2)).toEqual({ value: 15, count: 2 });
    expect(history.max(KEY)).toBe(50);
  });

  it.each([0, -5, NaN, Infinity])("ignores an invalid sample (%s)", (tps) => {
    history.record(KEY, tps);
    expect(history.average(KEY, 10)).toBeUndefined();
    expect(history.max(KEY)).toBeUndefined();
  });

  it("drops the oldest samples beyond capacity but keeps the max", () => {
    const small = new TpsHistory(3);
    for (const tps of [100, 1, 2, 3]) small.record(KEY, tps);
    expect(small.average(KEY, 10)).toEqual({ value: 2, count: 3 });
    expect(small.max(KEY)).toBe(100);
  });

  it("keeps each model's samples separate", () => {
    history.record(KEY, 10);
    history.record("anthropic/claude", 90);
    expect(history.average(KEY, 10)).toEqual({ value: 10, count: 1 });
    expect(history.max(KEY)).toBe(10);
    expect(history.max("anthropic/claude")).toBe(90);
  });

  it("reset discards every model's samples", () => {
    history.record(KEY, 10);
    history.record("anthropic/claude", 90);
    history.reset();
    expect(history.max(KEY)).toBeUndefined();
    expect(history.max("anthropic/claude")).toBeUndefined();
  });
});

describe("modelKey", () => {
  it("joins provider and model id", () => {
    expect(modelKey({ provider: "anthropic", id: "claude" })).toBe(
      "anthropic/claude",
    );
  });

  it("uses a stable key when no model is active", () => {
    expect(modelKey(undefined)).toBe("/");
  });
});
