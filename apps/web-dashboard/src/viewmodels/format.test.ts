import { describe, expect, it } from "vitest";
import {
  businessDay,
  formatMoney,
  formatWeekRange,
  fromBusinessWallTime,
  minutesIntoDay,
  mondayOf,
  shiftDay,
  toBusinessWallTime,
  toMinor,
} from "./format";

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

describe("business time zone helpers", () => {
  it("round-trips wall time in America/Mexico_City", () => {
    const iso = fromBusinessWallTime("2026-11-05T09:30");
    expect(iso).toBe("2026-11-05T15:30:00.000Z");
    expect(toBusinessWallTime(new Date(iso))).toBe("2026-11-05T09:30");
  });
  it("places a booking on the business day, not the UTC day", () => {
    const late = new Date("2026-11-06T04:30:00Z");
    expect(businessDay(late)).toBe("2026-11-05");
    expect(minutesIntoDay(late)).toBe(22 * 60 + 30);
  });
  it("shifts calendar days across month ends", () => {
    expect(shiftDay("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDay("2026-11-02", -7)).toBe("2026-10-26");
  });
  it("formats a week range in Spanish", () => {
    expect(formatWeekRange("2026-11-02")).toBe("2–8 de noviembre");
  });
});
