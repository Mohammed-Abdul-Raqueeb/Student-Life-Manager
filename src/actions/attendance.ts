"use server";

import type { AttendanceStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/db/user";
import { parseCalendarDate, todayAsCalendarDate } from "@/lib/date";
import { attendanceSchema, attendanceStatusEnum } from "@/lib/validations";

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

/**
 * Attendance is keyed on (subject, date), so recording it is an upsert. Tapping
 * "Present" twice cannot inflate the number of classes conducted, and switching
 * a day from present to absent corrects the record instead of adding a second one.
 */
export async function recordAttendance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const parsed = attendanceSchema.safeParse(formValues(formData));
    if (!parsed.success) return validationFailure(parsed.error);

    const userId = await getCurrentUserId();
    const { subjectId, date, status, note } = parsed.data;

    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("Pick one of your own subjects.", {
        subjectId: ["Select a subject."],
      });
    }

    await prisma.attendanceRecord.upsert({
      where: { subjectId_date: { subjectId, date } },
      update: { status, note: note ?? null },
      create: { userId, subjectId, date, status, note: note ?? null },
    });

    revalidateApp();
    return success(
      status === "PRESENT" ? "Marked present." : "Marked absent.",
    );
  });
}

/** The one-tap Present / Absent buttons on the Attendance page. */
export async function quickRecordAttendance(
  subjectId: string,
  status: AttendanceStatus,
  dateValue?: string,
): Promise<ActionState> {
  return guard(async () => {
    const parsedStatus = attendanceStatusEnum.safeParse(status);
    if (!parsedStatus.success) return failure("Unknown attendance status.");

    const date = dateValue
      ? parseCalendarDate(dateValue)
      : todayAsCalendarDate();
    if (!date) return failure("Invalid date.");

    const userId = await getCurrentUserId();
    if (!(await assertOwnedSubject(userId, subjectId))) {
      return failure("That subject no longer exists.");
    }

    await prisma.attendanceRecord.upsert({
      where: { subjectId_date: { subjectId, date } },
      update: { status: parsedStatus.data },
      create: { userId, subjectId, date, status: parsedStatus.data },
    });

    revalidateApp();
    return success(
      parsedStatus.data === "PRESENT" ? "Marked present." : "Marked absent.",
    );
  });
}

export async function deleteAttendanceRecord(id: string): Promise<ActionState> {
  return guard(async () => {
    const userId = await getCurrentUserId();
    const { count } = await prisma.attendanceRecord.deleteMany({
      where: { id, userId },
    });
    if (count === 0) return failure("That record no longer exists.");

    revalidateApp();
    return success("Attendance record removed.");
  });
}

/** Clears a day's entry so the class stops counting as conducted at all. */
export async function clearAttendanceForDay(
  subjectId: string,
  dateValue?: string,
): Promise<ActionState> {
  return guard(async () => {
    const date = dateValue ? parseCalendarDate(dateValue) : todayAsCalendarDate();
    if (!date) return failure("Invalid date.");

    const userId = await getCurrentUserId();
    const { count } = await prisma.attendanceRecord.deleteMany({
      where: { userId, subjectId, date },
    });
    if (count === 0) return failure("Nothing was recorded for that day.");

    revalidateApp();
    return success("Entry cleared.");
  });
}
