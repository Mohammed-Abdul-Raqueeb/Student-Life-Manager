"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { studySessionSchema } from "@/lib/validations";

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

export async function createStudySession(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = studySessionSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const {
      subjectId,
      startedAt,
      endedAt,
      topic,
      notes,
      minutes,
    } = parsed.data;

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.studySession.create({
      data: {
        userId,
        subjectId,
        startedAt,
        endedAt,
        topic: topic ?? null,
        notes: notes ?? null,
      },
    });

    revalidateApp();
    return success(`Logged ${formatMinutes(minutes)}.`);
  });
}

export async function updateStudySession(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing session id.");

    const parsed = studySessionSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, startedAt, endedAt, topic, notes } = parsed.data;

    const existing = await prisma.studySession.count({ where: { id, userId } });
    if (existing === 0) return failure("That study session no longer exists.");

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.studySession.update({
      where: { id },
      data: {
        subjectId,
        startedAt,
        endedAt,
        topic: topic ?? null,
        notes: notes ?? null,
      },
    });

    revalidateApp();
    return success("Study session updated.");
  });
}

export async function deleteStudySession(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.studySession.deleteMany({
      where: { id, userId },
    });
    if (count === 0) return failure("That study session no longer exists.");

    revalidateApp();
    return success("Study session deleted.");
  });
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
