"use server";

import type { AssignmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { assignmentSchema, assignmentStatusEnum } from "@/lib/validations";

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

export async function createAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = assignmentSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { dueAt, subjectId, dueDate: _d, dueTime: _t, ...rest } = parsed.data;

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.assignment.create({
      data: {
        ...rest,
        userId,
        subjectId,
        dueDate: dueAt,
        completedAt: rest.status === "COMPLETED" ? new Date() : null,
      },
    });

    revalidateApp();
    return success("Assignment added.");
  });
}

export async function updateAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing assignment id.");

    const parsed = assignmentSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { dueAt, subjectId, dueDate: _d, dueTime: _t, ...rest } = parsed.data;

    const existing = await prisma.assignment.findFirst({
      where: { id, userId },
      select: { status: true, completedAt: true },
    });
    if (!existing) return failure("That assignment no longer exists.");

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.assignment.update({
      where: { id },
      data: {
        ...rest,
        subjectId,
        dueDate: dueAt,
        // Keep the original completion timestamp if it was already complete.
        completedAt:
          rest.status === "COMPLETED"
            ? (existing.completedAt ?? new Date())
            : null,
      },
    });

    revalidateApp();
    return success("Assignment updated.");
  });
}

/** Quick status change from a list row, without opening the edit dialog. */
export async function setAssignmentStatus(
  id: string,
  status: AssignmentStatus,
): Promise<ActionState> {
  return guard(async () => {
    const parsedStatus = assignmentStatusEnum.safeParse(status);
    if (!parsedStatus.success) return failure("Unknown status.");

    const userId = await getCurrentUserId();
    const existing = await prisma.assignment.findFirst({
      where: { id, userId },
      select: { completedAt: true },
    });
    if (!existing) return failure("That assignment no longer exists.");

    await prisma.assignment.update({
      where: { id },
      data: {
        status: parsedStatus.data,
        completedAt:
          parsedStatus.data === "COMPLETED"
            ? (existing.completedAt ?? new Date())
            : null,
      },
    });

    revalidateApp();
    return success(
      parsedStatus.data === "COMPLETED"
        ? "Marked complete."
        : "Status updated.",
    );
  });
}

export async function deleteAssignment(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.assignment.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That assignment no longer exists.");

    revalidateApp();
    return success("Assignment deleted.");
  });
}
