"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { subjectSchema } from "@/lib/validations";

import {
  failure,
  formValues,
  guard,
  revalidateApp,
  success,
  validationFailure,
  type ActionState,
} from "./shared";

export async function createSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = subjectSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();

    const duplicate = await prisma.subject.findFirst({
      where: { userId, code: parsed.data.code },
      select: { id: true },
    });
    if (duplicate) {
      return failure("A subject with that code already exists.", {
        code: ["This code is already used by another subject."],
      });
    }

    await prisma.subject.create({ data: { ...parsed.data, userId } });
    revalidateApp();
    return success(`${parsed.data.name} added.`);
  });
}

export async function updateSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") {
      return failure("Missing subject id.");
    }

    const parsed = subjectSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();

    const existing = await prisma.subject.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return failure("That subject no longer exists.");

    const duplicate = await prisma.subject.findFirst({
      where: { userId, code: parsed.data.code, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) {
      return failure("A subject with that code already exists.", {
        code: ["This code is already used by another subject."],
      });
    }

    await prisma.subject.update({ where: { id }, data: parsed.data });
    revalidateApp();
    return success("Subject updated.");
  });
}

/**
 * Deleting a subject cascades to its assignments, exams, attendance, notes,
 * assessments, study sessions and timetable slots — the confirmation dialog in
 * the UI spells that out before this runs.
 */
export async function deleteSubject(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();

    const { count } = await prisma.subject.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That subject no longer exists.");

    revalidateApp();
    return success("Subject deleted.");
  });
}
