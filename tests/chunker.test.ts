import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/services/chunker";

describe("chunkText", () => {
  it("returns no chunks for empty text", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns a single chunk when text is shorter than chunkSize", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  it("returns a single chunk when text is exactly chunkSize", () => {
    const text = "a".repeat(1200);
    expect(chunkText(text)).toEqual([text]);
  });

  it("splits long text into chunks no longer than chunkSize", () => {
    const chunks = chunkText("a".repeat(5000));
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1200);
  });

  it("overlaps consecutive chunks by the requested amount", () => {
    const text = Array.from({ length: 3000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");
    const [first, second] = chunkText(text, 1200, 200);
    expect(first.slice(-200)).toBe(second.slice(0, 200));
  });

  it("covers every character of the input (nothing is dropped)", () => {
    const text = Array.from({ length: 4321 }, (_, i) => String.fromCharCode(97 + (i % 26))).join("");
    const chunks = chunkText(text, 1000, 100);
    // rebuild: first chunk + each later chunk minus its overlap
    const rebuilt = chunks.reduce((acc, c, i) => (i === 0 ? c : acc + c.slice(100)), "");
    expect(rebuilt).toBe(text);
  });

  it("does not add a trailing chunk made only of already-covered text", () => {
    // 2200 chars, size 1200, overlap 200: windows are [0,1200) and [1000,2200).
    // The old loop added a third window [2000,2200) that is fully contained
    // in the second one.
    const chunks = chunkText("a".repeat(2200), 1200, 200);
    expect(chunks).toHaveLength(2);
  });

  it("works with zero overlap", () => {
    expect(chunkText("abcdef", 2, 0)).toEqual(["ab", "cd", "ef"]);
  });

  it("throws when overlap is not smaller than chunkSize (would loop forever)", () => {
    expect(() => chunkText("abc", 100, 100)).toThrow();
    expect(() => chunkText("abc", 100, 250)).toThrow();
  });

  it("throws on a non-positive chunkSize or negative overlap", () => {
    expect(() => chunkText("abc", 0, 0)).toThrow();
    expect(() => chunkText("abc", 10, -1)).toThrow();
  });
});
