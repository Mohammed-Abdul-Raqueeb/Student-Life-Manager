/**
 * Subject accents.
 *
 * Subjects are the app's primary colour dimension — a student recognises
 * "the teal one" faster than they read "CS301". The palette is a fixed, named
 * set (stored on the row as a key, never as a raw hex value) so that:
 *   - a subject looks identical on every page,
 *   - the light and dark variants are tuned once, here,
 *   - and re-theming the app never leaves stale colours in the database.
 *
 * Colour is always paired with a text label; it is never the only carrier of
 * meaning. Status (overdue, at risk, complete) uses the semantic tokens in
 * `globals.css` instead, so the two systems cannot be confused.
 */

export type SubjectColorKey =
  | "indigo"
  | "teal"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "lime"
  | "orange";

export type SubjectColor = {
  key: SubjectColorKey;
  label: string;
  /** Tailwind classes for a filled dot or bar. */
  dot: string;
  /** Soft tinted background + readable foreground, for badges and cards. */
  soft: string;
  /** Left border accent, for list rows and timetable blocks. */
  border: string;
  /** Solid CSS colour for Recharts, which needs a value rather than a class. */
  chart: string;
};

export const SUBJECT_COLORS: Record<SubjectColorKey, SubjectColor> = {
  indigo: {
    key: "indigo",
    label: "Indigo",
    dot: "bg-indigo-500",
    soft: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    border: "border-l-indigo-500",
    chart: "var(--color-indigo-500)",
  },
  teal: {
    key: "teal",
    label: "Teal",
    dot: "bg-teal-500",
    soft: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    border: "border-l-teal-500",
    chart: "var(--color-teal-500)",
  },
  amber: {
    key: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    border: "border-l-amber-500",
    chart: "var(--color-amber-500)",
  },
  rose: {
    key: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    soft: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    border: "border-l-rose-500",
    chart: "var(--color-rose-500)",
  },
  violet: {
    key: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    border: "border-l-violet-500",
    chart: "var(--color-violet-500)",
  },
  sky: {
    key: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    soft: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    border: "border-l-sky-500",
    chart: "var(--color-sky-500)",
  },
  lime: {
    key: "lime",
    label: "Lime",
    dot: "bg-lime-500",
    soft: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
    border: "border-l-lime-500",
    chart: "var(--color-lime-500)",
  },
  orange: {
    key: "orange",
    label: "Orange",
    dot: "bg-orange-500",
    soft: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    border: "border-l-orange-500",
    chart: "var(--color-orange-500)",
  },
};

export const SUBJECT_COLOR_KEYS = Object.keys(
  SUBJECT_COLORS,
) as SubjectColorKey[];

/** Never throws: an unrecognised key falls back to the default accent. */
export function subjectColor(key: string | null | undefined): SubjectColor {
  if (key && key in SUBJECT_COLORS) {
    return SUBJECT_COLORS[key as SubjectColorKey];
  }
  return SUBJECT_COLORS.indigo;
}

/** Suggests the next unused accent when creating a subject. */
export function nextSubjectColor(used: readonly string[]): SubjectColorKey {
  const free = SUBJECT_COLOR_KEYS.find((key) => !used.includes(key));
  return free ?? SUBJECT_COLOR_KEYS[used.length % SUBJECT_COLOR_KEYS.length];
}
