/**
 * Marks, weighted scores and grades.
 *
 * The grading scale is data, not code — institutions disagree about what an A-
 * is, so `gradeFor` reads bands out of the student's settings.
 */

export type GradeBand = {
  grade: string;
  minPercent: number;
};

/** A common 10-band scale. Editable in Settings; nothing in the app assumes it. */
export const DEFAULT_GRADING_SCALE: GradeBand[] = [
  { grade: "A+", minPercent: 90 },
  { grade: "A", minPercent: 85 },
  { grade: "A-", minPercent: 80 },
  { grade: "B+", minPercent: 75 },
  { grade: "B", minPercent: 70 },
  { grade: "B-", minPercent: 65 },
  { grade: "C+", minPercent: 60 },
  { grade: "C", minPercent: 55 },
  { grade: "D", minPercent: 40 },
  { grade: "F", minPercent: 0 },
];

export type AssessmentLike = {
  marksObtained: number;
  maxMarks: number;
  /** Share of the final grade in percent. 0 means the assessment is unweighted. */
  weightage: number;
};

export type SubjectScore = {
  /** Straight aggregate: total marks obtained over total marks available. */
  simplePercent: number;
  /**
   * Score across the *weighted* assessments only, normalised to the weight that
   * has actually been assessed so far. `null` when nothing is weighted.
   */
  weightedPercent: number | null;
  /** Points of the final grade banked so far, out of 100. */
  earnedOfFinal: number;
  /** Total weightage assessed so far, in percent. */
  weightCovered: number;
  /** The figure to display: weighted when available, otherwise the aggregate. */
  score: number;
  isWeighted: boolean;
  count: number;
  hasAssessments: boolean;
  totalObtained: number;
  totalMax: number;
};

/** `obtained / maximum * 100`, or 0 when the maximum is missing or zero. */
export function percentage(obtained: number, maximum: number): number {
  if (!Number.isFinite(obtained) || !Number.isFinite(maximum)) return 0;
  if (maximum <= 0) return 0;
  return (obtained / maximum) * 100;
}

/** `(obtained / maximum) * weightage` — points contributed to the final grade. */
export function weightedContribution(assessment: AssessmentLike): number {
  if (assessment.maxMarks <= 0) return 0;
  return (assessment.marksObtained / assessment.maxMarks) * assessment.weightage;
}

export function subjectScore(
  assessments: readonly AssessmentLike[],
): SubjectScore {
  const usable = assessments.filter(
    (a) => Number.isFinite(a.marksObtained) && a.maxMarks > 0,
  );

  const totalObtained = sum(usable.map((a) => a.marksObtained));
  const totalMax = sum(usable.map((a) => a.maxMarks));
  const simplePercent = percentage(totalObtained, totalMax);

  const weighted = usable.filter((a) => a.weightage > 0);
  const weightCovered = sum(weighted.map((a) => a.weightage));
  const earnedOfFinal = sum(weighted.map(weightedContribution));

  const isWeighted = weightCovered > 0;
  const weightedPercent = isWeighted
    ? (earnedOfFinal / weightCovered) * 100
    : null;

  return {
    simplePercent,
    weightedPercent,
    earnedOfFinal,
    weightCovered,
    score: weightedPercent ?? simplePercent,
    isWeighted,
    count: usable.length,
    hasAssessments: usable.length > 0,
    totalObtained,
    totalMax,
  };
}

/** The highest band the percentage clears. `null` for an empty scale. */
export function gradeFor(
  percent: number,
  scale: readonly GradeBand[] = DEFAULT_GRADING_SCALE,
): string | null {
  const bands = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  const match = bands.find((band) => percent >= band.minPercent);
  return match?.grade ?? null;
}

/**
 * Credit-weighted average of subject scores — the closest thing to a GPA that
 * can be computed without assuming a grade-point mapping.
 */
export function overallAverage(
  subjects: readonly { score: number; credits: number; hasAssessments: boolean }[],
): number | null {
  const graded = subjects.filter((s) => s.hasAssessments);
  if (graded.length === 0) return null;

  const creditTotal = sum(graded.map((s) => Math.max(0, s.credits)));
  if (creditTotal <= 0) {
    return sum(graded.map((s) => s.score)) / graded.length;
  }
  return sum(graded.map((s) => s.score * Math.max(0, s.credits))) / creditTotal;
}

/** Runtime guard for the grading scale stored as JSON. */
export function parseGradingScale(value: unknown): GradeBand[] {
  if (!Array.isArray(value)) return DEFAULT_GRADING_SCALE;

  const bands = value.flatMap((entry): GradeBand[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { grade, minPercent } = entry as Record<string, unknown>;
    if (typeof grade !== "string" || grade.trim() === "") return [];
    if (typeof minPercent !== "number" || !Number.isFinite(minPercent)) return [];
    return [{ grade: grade.trim(), minPercent }];
  });

  if (bands.length === 0) return DEFAULT_GRADING_SCALE;
  return bands.sort((a, b) => b.minPercent - a.minPercent);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
