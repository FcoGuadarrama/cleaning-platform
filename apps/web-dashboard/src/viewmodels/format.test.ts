import { describe, expect, it } from "vitest";
import { formatMoney, mondayOf, toMinor } from "./format";

describe("format view models", () => {
  it("parses money input to minor units without floats", () => {
    expect(toMinor("123.45")).toBe(12345);
    expect(toMinor("10")).toBe(1000);
    expect(toMinor("0.1")).toBe(10);
    expect(toMinor("1.234")).toBeNull();
    expect(toMinor("-5")).toBeNull();
  });
  it("formats MXN", () => {
    expect(formatMoney(12345, "MXN")).toContain("123.45");
  });
  it("finds the business-week Monday", () => {
    expect(mondayOf(new Date("2026-11-05T18:00:00Z"))).toBe("2026-11-02");
  });
});
