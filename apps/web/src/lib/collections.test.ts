import { describe, expect, it } from "vitest";
import {
  collectionFilters,
  collectionSearch,
  overdueTotal,
  type CollectionsSummary,
} from "./collections";

describe("collections filters", () => {
  it("keeps only supported filters in a shared URL", () => {
    const filters = collectionFilters(
      new URLSearchParams(
        "asOf=2026-09-15&bucket=OVERDUE_8_30&status=PROMISED&text=Cliente",
      ),
    );
    expect(filters).toEqual({
      asOf: "2026-09-15",
      bucket: "OVERDUE_8_30",
      status: "PROMISED",
      text: "Cliente",
    });
    expect(collectionSearch(filters).toString()).toContain(
      "bucket=OVERDUE_8_30",
    );
  });

  it("adds all overdue aging buckets without client-side row calculations", () => {
    const summary = {
      buckets: {
        DUE_THIS_WEEK: "40.00",
        OVERDUE_1_7: "10.00",
        OVERDUE_8_30: "20.00",
        OVERDUE_31_60: "30.00",
        OVERDUE_61_90: "40.00",
        OVERDUE_90_PLUS: "50.00",
      },
    } as CollectionsSummary;
    expect(overdueTotal(summary)).toBe("150.00");
  });
});
