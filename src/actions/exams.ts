"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { examSchema } from "@/lib/validations";

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

export async function createExam(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = examSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const {
      startsAt,
      subjectId,
      examDate: _d,
      examTime: _t,
      ...rest
    } = parsed.data;

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.exam.create({
      data: { ...rest, userId, subjectId, examDate: startsAt },
    });

    revalidateApp();
    return success("Exam added.");
  });
}

export async function updateExam(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing exam id.");

    const parsed = examSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const {
      startsAt,
      subjectId,
      examDate: _d,
      examTime: _t,
      ...rest
    } = parsed.data;

    const existing = await prisma.exam.count({ where: { id, userId } });
    if (existing === 0) return failure("That exam no longer exists.");

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.exam.update({
      where: { id },
      data: { ...rest, subjectId, examDate: startsAt },
    });

    revalidateApp();
    return success("Exam updated.");
  });
}

export async function deleteExam(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.exam.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That exam no longer exists.");

    revalidateApp();
    return success("Exam deleted.");
  });
}
