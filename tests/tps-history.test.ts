import { beforeEach, describe, expect, it } from "vitest";

import { modelKey, TpsHistory } from "../src/core/tps-history";

const KEY = "local/qwen";

describe("TpsHistory", () => {
  let history: TpsHistory;

  beforeEach(() => {
    history = new TpsHistory();
  });

  it("returns nothing before any response is recorded", () => {
    expect(history.max(KEY)).toBeUndefined();
  });

  it("keeps the best response", () => {
    for (const tps of [20, 50, 10]) history.record(KEY, tps);
    expect(history.max(KEY)).toBe(50);
  });

  it.each([0, -5, NaN, Infinity])("ignores an invalid result (%s)", (tps) => {
    history.record(KEY, tps);
    expect(history.max(KEY)).toBeUndefined();
  });

  it("keeps each model's results separate", () => {
    history.record(KEY, 10);
    history.record("anthropic/claude", 90);
    expect(history.max(KEY)).toBe(10);
    expect(history.max("anthropic/claude")).toBe(90);
  });

  it("reset discards every model's results", () => {
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
