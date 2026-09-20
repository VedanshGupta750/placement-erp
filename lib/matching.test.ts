import { describe, it, expect } from "vitest";
import { computeMatchScore } from "./matching";

describe("computeMatchScore", () => {
  it("returns null score when a drive has no required skills", () => {
    const result = computeMatchScore(["Python", "React"], []);
    expect(result.matchScore).toBeNull();
    expect(result.matchedSkills).toEqual([]);
    expect(result.missingSkills).toEqual([]);
  });

  it("scores 100% when the student has every required skill", () => {
    const result = computeMatchScore(["Python", "React", "SQL"], ["Python", "React"]);
    expect(result.matchScore).toBe(100);
    expect(result.matchedSkills).toEqual(["Python", "React"]);
    expect(result.missingSkills).toEqual([]);
  });

  it("scores 0% when the student has none of the required skills", () => {
    const result = computeMatchScore(["Photoshop"], ["Python", "React"]);
    expect(result.matchScore).toBe(0);
    expect(result.matchedSkills).toEqual([]);
    expect(result.missingSkills).toEqual(["Python", "React"]);
  });

  it("scores partial overlap and rounds to the nearest integer", () => {
    // 1 of 3 matched -> 33.33...% rounds to 33
    const result = computeMatchScore(["Python"], ["Python", "React", "SQL"]);
    expect(result.matchScore).toBe(33);
    expect(result.matchedSkills).toEqual(["Python"]);
    expect(result.missingSkills).toEqual(["React", "SQL"]);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const result = computeMatchScore(["  python  ", "REACT"], ["Python", "react"]);
    expect(result.matchScore).toBe(100);
  });

  it("preserves the required skill's original casing in the output, not the student's", () => {
    const result = computeMatchScore(["python"], ["Python"]);
    expect(result.matchedSkills).toEqual(["Python"]);
  });
});
