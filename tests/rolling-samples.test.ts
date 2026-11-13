import { beforeEach, describe, expect, it } from "vitest";

import { RollingSamples } from "../src/core/rolling-samples";

describe("RollingSamples", () => {
  let samples: RollingSamples;

  beforeEach(() => {
    samples = new RollingSamples(100);
  });

  it("returns nothing when empty", () => {
    expect(samples.average(10)).toBeUndefined();
  });

  it("averages every sample when fewer than the requested size exist", () => {
    samples.add(10);
    samples.add(20);
    expect(samples.average(10)).toBe(15);
  });

  it("averages only the newest N samples", () => {
    for (const value of [10, 20, 30, 40]) samples.add(value);
    expect(samples.average(2)).toBe(35);
  });

  it("includes zero samples (stalls)", () => {
    samples.add(30);
    samples.add(0);
    expect(samples.average(10)).toBe(15);
  });

  it.each([0, -1])("returns no average when the size is %s", (size) => {
    samples.add(10);
    expect(samples.average(size)).toBeUndefined();
  });

  it.each([NaN, Infinity])("ignores a non-finite sample (%s)", (value) => {
    samples.add(value);
    expect(samples.average(10)).toBeUndefined();
  });

  it("drops the oldest samples beyond capacity", () => {
    const small = new RollingSamples(3);
    for (const value of [100, 1, 2, 3]) small.add(value);
    expect(small.average(10)).toBe(2);
  });

  it("reset discards all samples", () => {
    samples.add(10);
    samples.reset();
    expect(samples.average(10)).toBeUndefined();
  });
});
