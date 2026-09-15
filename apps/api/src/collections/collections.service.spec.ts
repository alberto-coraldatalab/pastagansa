import { classifyBucket, daysBetween } from "./collections.service";

describe("collections aging", () => {
  const asOf = "2026-09-15";
  it.each([
    ["2026-09-22", "DUE_THIS_WEEK"],
    ["2026-09-23", null],
    ["2026-09-15", "DUE_THIS_WEEK"],
    ["2026-09-14", "OVERDUE_1_7"],
    ["2026-09-08", "OVERDUE_1_7"],
    ["2026-09-07", "OVERDUE_8_30"],
    ["2026-08-16", "OVERDUE_8_30"],
    ["2026-08-15", "OVERDUE_31_60"],
    ["2026-07-17", "OVERDUE_31_60"],
    ["2026-07-16", "OVERDUE_61_90"],
    ["2026-06-17", "OVERDUE_61_90"],
    ["2026-06-16", "OVERDUE_90_PLUS"],
  ])("classifies %s", (dueDate, expected) => {
    expect(classifyBucket(dueDate, asOf)).toBe(expected);
  });

  it("calculates calendar days across a daylight-saving boundary", () => {
    expect(daysBetween("2026-03-29", "2026-03-30")).toBe(1);
  });
});
