"use server";

import type { TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { taskSchema, taskStatusEnum } from "@/lib/validations";

import {
  failure,
  formValues,
  guard,
  revalidateApp,
  success,
  validationFailure,
  type ActionState,
} from "./shared";

export async function createTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = taskSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { dueAt, dueDate: _d, dueTime: _t, ...rest } = parsed.data;

    await prisma.task.create({
      data: {
        ...rest,
        userId,
        dueDate: dueAt,
        completedAt: rest.status === "COMPLETED" ? new Date() : null,
      },
    });

    revalidateApp();
    return success("Task added.");
  });
}

export async function updateTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const id = formData.get("id");
    if (typeof id !== "string" || id === "") return failure("Missing task id.");

    const parsed = taskSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { dueAt, dueDate: _d, dueTime: _t, ...rest } = parsed.data;

    const existing = await prisma.task.findFirst({
      where: { id, userId },
      select: { completedAt: true },
    });
    if (!existing) return failure("That task no longer exists.");

    await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        dueDate: dueAt,
        completedAt:
          rest.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
      },
    });

    revalidateApp();
    return success("Task updated.");
  });
}

/** Tick a task off straight from a checkbox, anywhere in the app. */
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<ActionState> {
  return guard(async () => {
    const parsedStatus = taskStatusEnum.safeParse(status);
    if (!parsedStatus.success) return failure("Unknown status.");

    const userId = await getCurrentUserId();
    const existing = await prisma.task.findFirst({
      where: { id, userId },
      select: { completedAt: true },
    });
    if (!existing) return failure("That task no longer exists.");

    await prisma.task.update({
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
      parsedStatus.data === "COMPLETED" ? "Task completed." : "Task reopened.",
    );
  });
}

export async function deleteTask(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.task.deleteMany({ where: { id, userId } });
    if (count === 0) return failure("That task no longer exists.");

    revalidateApp();
    return success("Task deleted.");
  });
}
