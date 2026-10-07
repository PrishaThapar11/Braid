import { describe, it, expect } from "vitest";
import { selectTopRelated } from "@/lib/services/relatedSelection";

const m = (document_id: string, similarity: number) => ({ document_id, similarity });

describe("selectTopRelated", () => {
  it("keeps only the best chunk score per document", () => {
    const out = selectTopRelated([m("a", 0.5), m("a", 0.9), m("a", 0.7)], "self");
    expect(out).toEqual([["a", 0.9]]);
  });

  it("excludes the document itself", () => {
    const out = selectTopRelated([m("self", 0.99), m("a", 0.4)], "self");
    expect(out).toEqual([["a", 0.4]]);
  });

  it("sorts best first", () => {
    const out = selectTopRelated([m("a", 0.2), m("b", 0.8), m("c", 0.5)], "self");
    expect(out.map(([id]) => id)).toEqual(["b", "c", "a"]);
  });

  it("returns at most max documents (default 3)", () => {
    const matches = ["a", "b", "c", "d", "e"].map((id, i) => m(id, 0.1 * (i + 1)));
    expect(selectTopRelated(matches, "self")).toHaveLength(3);
    expect(selectTopRelated(matches, "self", 2)).toHaveLength(2);
  });

  it("returns an empty list when there are no matches", () => {
    expect(selectTopRelated([], "self")).toEqual([]);
  });

  it("returns an empty list when the only match is the document itself", () => {
    expect(selectTopRelated([m("self", 0.9)], "self")).toEqual([]);
  });
});
