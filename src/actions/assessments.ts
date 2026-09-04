"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { assessmentSchema } from "@/lib/validations";

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

export async function createAssessment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = assessmentSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.assessment.create({ data: { ...rest, userId, subjectId } });

    revalidateApp();
    return success("Marks recorded.");
  });
}

export async function updateAssessment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") {
      return failure("Missing assessment id.");
    }

    const parsed = assessmentSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, ...rest } = parsed.data;

    const existing = await prisma.assessment.count({ where: { id, userId } });
    if (existing === 0) return failure("That assessment no longer exists.");

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.assessment.update({ where: { id }, data: { ...rest, subjectId } });

    revalidateApp();
    return success("Assessment updated.");
  });
}

export async function deleteAssessment(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.assessment.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That assessment no longer exists.");

    revalidateApp();
    return success("Assessment deleted.");
  });
}
