"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { timetableEntrySchema } from "@/lib/validations";

import {
  assertOwnedSubject,
  failure,
  formValues,
  guard,
  revalidateApp,
  success,
  validationFailure,
  type ActionState,
} from "./shared";

export async function createTimetableEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = timetableEntrySchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    if (subjectId && !(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.timetableEntry.create({
      data: { ...rest, userId, subjectId: subjectId ?? null },
    });

    revalidateApp();
    return success("Timetable entry added.");
  });
}

export async function updateTimetableEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing entry id.");

    const parsed = timetableEntrySchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    const existing = await prisma.timetableEntry.count({ where: { id, userId } });
    if (existing === 0) return failure("That timetable entry no longer exists.");

    if (subjectId && !(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.timetableEntry.update({
      where: { id },
      data: { ...rest, subjectId: subjectId ?? null },
    });

    revalidateApp();
    return success("Timetable entry updated.");
  });
}

export async function deleteTimetableEntry(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.timetableEntry.deleteMany({
      where: { id, userId },
    });
    if (count === 0) return failure("That timetable entry no longer exists.");

    revalidateApp();
    return success("Timetable entry deleted.");
  });
}
