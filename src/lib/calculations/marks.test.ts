import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRADING_SCALE,
  gradeFor,
  overallAverage,
  parseGradingScale,
  percentage,
  subjectScore,
  weightedContribution,
} from "./marks";

describe("percentage", () => {
  it("computes obtained / maximum * 100", () => {
    expect(percentage(33, 40)).toBe(82.5);
    expect(percentage(50, 50)).toBe(100);
    expect(percentage(0, 20)).toBe(0);
  });

  it("returns 0 instead of Infinity or NaN for a zero or missing maximum", () => {
    expect(percentage(10, 0)).toBe(0);
    expect(percentage(10, -5)).toBe(0);
    expect(percentage(Number.NaN, 10)).toBe(0);
  });
});

describe("weightedContribution", () => {
  it("scales the ratio by the weightage", () => {
    // 80% of a 25%-weighted assessment banks 20 points of the final grade.
    expect(
      weightedContribution({ marksObtained: 40, maxMarks: 50, weightage: 25 }),
    ).toBe(20);
  });

  it("contributes nothing when the maximum is zero", () => {
    expect(
      weightedContribution({ marksObtained: 5, maxMarks: 0, weightage: 25 }),
    ).toBe(0);
  });
});

describe("subjectScore", () => {
  it("aggregates unweighted assessments as total marks over total maximum", () => {
    const score = subjectScore([
      { marksObtained: 18, maxMarks: 20, weightage: 0 },
      { marksObtained: 30, maxMarks: 40, weightage: 0 },
    ]);
    expect(score.isWeighted).toBe(false);
    expect(score.totalObtained).toBe(48);
    expect(score.totalMax).toBe(60);
    expect(score.simplePercent).toBe(80);
    expect(score.weightedPercent).toBeNull();
    expect(score.score).toBe(80);
  });

  it("normalises a weighted score over the weight assessed so far", () => {
    // 20 of 25 points earned on a 25%-weighted midterm = 80% of what is graded.
    const score = subjectScore([
      { marksObtained: 40, maxMarks: 50, weightage: 25 },
    ]);
    expect(score.isWeighted).toBe(true);
    expect(score.weightCovered).toBe(25);
    expect(score.earnedOfFinal).toBe(20);
    expect(score.weightedPercent).toBe(80);
    expect(score.score).toBe(80);
  });

  it("weights assessments against each other, not by raw marks", () => {
    // A 10-mark quiz aced and a 100-mark final scraped: the weightage decides.
    const score = subjectScore([
      { marksObtained: 10, maxMarks: 10, weightage: 20 },
      { marksObtained: 50, maxMarks: 100, weightage: 60 },
    ]);
    // (1.0 * 20) + (0.5 * 60) = 50 points out of 80 assessed = 62.5%.
    expect(score.earnedOfFinal).toBe(50);
    expect(score.weightCovered).toBe(80);
    expect(score.weightedPercent).toBe(62.5);
    // The unweighted aggregate would flatter the student at 54.5%.
    expect(score.simplePercent).toBeCloseTo(54.545, 3);
  });

  it("ignores unweighted rows when computing the weighted score", () => {
    const score = subjectScore([
      { marksObtained: 40, maxMarks: 50, weightage: 25 },
      { marksObtained: 1, maxMarks: 100, weightage: 0 },
    ]);
    expect(score.weightCovered).toBe(25);
    expect(score.weightedPercent).toBe(80);
    // …but still counts them in the raw aggregate.
    expect(score.totalMax).toBe(150);
  });

  it("skips rows with a non-positive maximum rather than dividing by zero", () => {
    const score = subjectScore([
      { marksObtained: 5, maxMarks: 0, weightage: 10 },
      { marksObtained: 9, maxMarks: 10, weightage: 0 },
    ]);
    expect(score.count).toBe(1);
    expect(score.simplePercent).toBe(90);
    expect(score.isWeighted).toBe(false);
  });

  it("reports no assessments for an empty subject", () => {
    const score = subjectScore([]);
    expect(score.hasAssessments).toBe(false);
    expect(score.score).toBe(0);
    expect(score.weightedPercent).toBeNull();
  });
});

describe("gradeFor", () => {
  it("picks the highest band the score clears", () => {
    expect(gradeFor(95)).toBe("A+");
    expect(gradeFor(82.5)).toBe("A-");
    expect(gradeFor(70)).toBe("B");
    expect(gradeFor(0)).toBe("F");
  });

  it("treats a band minimum as inclusive", () => {
    expect(gradeFor(90)).toBe("A+");
    expect(gradeFor(89.99)).toBe("A");
  });

  it("honours a custom scale instead of assuming the default", () => {
    const scale = [
      { grade: "Distinction", minPercent: 75 },
      { grade: "First", minPercent: 60 },
      { grade: "Pass", minPercent: 35 },
      { grade: "Fail", minPercent: 0 },
    ];
    expect(gradeFor(82.5, scale)).toBe("Distinction");
    expect(gradeFor(61, scale)).toBe("First");
    expect(gradeFor(20, scale)).toBe("Fail");
  });

  it("sorts an out-of-order scale before matching", () => {
    const scale = [
      { grade: "Pass", minPercent: 35 },
      { grade: "Distinction", minPercent: 75 },
    ];
    expect(gradeFor(90, scale)).toBe("Distinction");
  });

  it("returns null when no band matches", () => {
    expect(gradeFor(10, [{ grade: "Pass", minPercent: 35 }])).toBeNull();
    expect(gradeFor(50, [])).toBeNull();
  });
});

describe("overallAverage", () => {
  it("weights subject scores by credits", () => {
    const average = overallAverage([
      { score: 90, credits: 4, hasAssessments: true },
      { score: 60, credits: 2, hasAssessments: true },
    ]);
    expect(average).toBe(80); // (360 + 120) / 6
  });

  it("skips subjects with no assessments", () => {
    const average = overallAverage([
      { score: 90, credits: 4, hasAssessments: true },
      { score: 0, credits: 4, hasAssessments: false },
    ]);
    expect(average).toBe(90);
  });

  it("falls back to a plain mean when every subject is zero-credit", () => {
    const average = overallAverage([
      { score: 80, credits: 0, hasAssessments: true },
      { score: 60, credits: 0, hasAssessments: true },
    ]);
    expect(average).toBe(70);
  });

  it("returns null when nothing has been graded", () => {
    expect(overallAverage([])).toBeNull();
    expect(
      overallAverage([{ score: 0, credits: 3, hasAssessments: false }]),
    ).toBeNull();
  });
});

describe("parseGradingScale", () => {
  it("accepts a well-formed scale and sorts it descending", () => {
    const parsed = parseGradingScale([
      { grade: "Pass", minPercent: 40 },
      { grade: "Merit", minPercent: 70 },
    ]);
    expect(parsed.map((b) => b.grade)).toEqual(["Merit", "Pass"]);
  });

  it("falls back to the default for junk stored in the JSON column", () => {
    expect(parseGradingScale(null)).toEqual(DEFAULT_GRADING_SCALE);
    expect(parseGradingScale("A+")).toEqual(DEFAULT_GRADING_SCALE);
    expect(parseGradingScale([{ grade: 1, minPercent: "x" }])).toEqual(
      DEFAULT_GRADING_SCALE,
    );
  });

  it("drops malformed bands but keeps the valid ones", () => {
    const parsed = parseGradingScale([
      { grade: "A", minPercent: 80 },
      { grade: "", minPercent: 50 },
      { minPercent: 20 },
    ]);
    expect(parsed).toEqual([{ grade: "A", minPercent: 80 }]);
  });
});
