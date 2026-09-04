"use server";

import { DEFAULT_GRADING_SCALE } from "@/lib/calculations/marks";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/db/user";
import {
  academicSettingsSchema,
  gradeBandSchema,
  gradingScaleSchema,
  profileSettingsSchema,
  themeSettingsSchema,
} from "@/lib/validations";

import {
  failure,
  formValues,
  guard,
  revalidateApp,
  success,
  validationFailure,
  type ActionState,
} from "./shared";

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = profileSettingsSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const user = await getCurrentUser();
    const { name, collegeName, program, semester } = parsed.data;

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { name } }),
      prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          collegeName: collegeName ?? null,
          program: program ?? null,
          semester: semester ?? null,
        },
      }),
    ]);

    revalidateApp();
    return success("Profile saved.");
  });
}

export async function updateAcademicSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = academicSettingsSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const user = await getCurrentUser();

    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        attendanceTargetPercent: parsed.data.attendanceTargetPercent,
        weeklyStudyGoalMinutes: Math.round(
          parsed.data.weeklyStudyGoalHours * 60,
        ),
      },
    });

    revalidateApp();
    return success("Academic settings saved.");
  });
}

/**
 * The grading scale arrives as parallel `grade[]` / `minPercent[]` fields so the
 * form can add and remove rows without any client state library.
 */
export async function updateGradingScale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const grades = formData.getAll("grade").map(String);
    const minPercents = formData.getAll("minPercent").map(String);

    const rows = grades.map((grade, index) => ({
      grade,
      minPercent: minPercents[index] ?? "",
    }));

    const bands: { grade: string; minPercent: number }[] = [];
    for (const row of rows) {
      // Skip rows the student left entirely blank.
      if (row.grade.trim() === "" && row.minPercent.trim() === "") continue;

      const band = gradeBandSchema.safeParse(row);
      if (!band.success) return validationFailure(band.error);
      bands.push(band.data);
    }

    const parsed = gradingScaleSchema.safeParse({ bands });
    if (!parsed.success) return validationFailure(parsed.error);

    const user = await getCurrentUser();
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: {
        gradingScale: [...parsed.data.bands].sort(
          (a, b) => b.minPercent - a.minPercent,
        ),
      },
    });

    revalidateApp();
    return success("Grading scale saved.");
  });
}

export async function resetGradingScale(): Promise<ActionState> {
  return guard(async () => {
    const user = await getCurrentUser();
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { gradingScale: DEFAULT_GRADING_SCALE },
    });

    revalidateApp();
    return success("Grading scale reset to the default.");
  });
}

/**
 * Persists the theme choice. `next-themes` owns what the browser actually
 * renders; this row is what a fresh device starts from.
 */
export async function updateThemePreference(
  theme: "LIGHT" | "DARK" | "SYSTEM",
): Promise<ActionState> {
  return guard(async () => {
    const parsed = themeSettingsSchema.safeParse({ theme });
    if (!parsed.success) return failure("Unknown theme.");

    const user = await getCurrentUser();
    await prisma.userSettings.update({
      where: { userId: user.id },
      data: { theme: parsed.data.theme },
    });

    return success("Appearance saved.");
  });
}
