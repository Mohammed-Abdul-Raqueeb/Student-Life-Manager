"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { noteSchema } from "@/lib/validations";

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

export async function createNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = noteSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    if (subjectId && !(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.note.create({
      data: { ...rest, userId, subjectId: subjectId ?? null },
    });

    revalidateApp();
    return success("Note saved.");
  });
}

export async function updateNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing note id.");

    const parsed = noteSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    const existing = await prisma.note.count({ where: { id, userId } });
    if (existing === 0) return failure("That note no longer exists.");

    if (subjectId && !(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.note.update({
      where: { id },
      data: { ...rest, subjectId: subjectId ?? null },
    });

    revalidateApp();
    return success("Note updated.");
  });
}

export async function deleteNote(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.note.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That note no longer exists.");

    revalidateApp();
    return success("Note deleted.");
  });
}
