import { describe, expect, it } from "vitest";

import {
  buildDeadlineStream,
  isDueWithinDays,
  isOverdue,
  sortForAttention,
  taskToDeadline,
} from "./deadlines";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-09-03T18:00:00");

const subject = {
  id: "s1",
  name: "Database Systems",
  code: "CS301",
  color: "indigo",
};

const assignment = (over: Partial<Parameters<typeof buildDeadlineStream>[0]["assignments"][number]> = {}) => ({
  id: "a1",
  title: "Database normalization",
  dueDate: at("2026-09-04T23:59:00"),
  priority: "HIGH" as const,
  status: "PENDING" as const,
  subject,
  ...over,
});

describe("buildDeadlineStream", () => {
  it("merges assignments, exams and tasks into one chronological stream", () => {
    const stream = buildDeadlineStream({
      assignments: [assignment()],
      exams: [
        {
          id: "e1",
          name: "Final Exam",
          type: "FINAL",
          examDate: at("2026-09-08T09:00:00"),
          location: "Hall A",
          subject,
        },
      ],
      tasks: [
        {
          id: "t1",
          title: "Submit scholarship form",
          dueDate: at("2026-09-01T12:00:00"),
          priority: "MEDIUM",
          status: "PENDING",
          description: null,
        },
      ],
    }, NOW);

    expect(stream.map((item) => item.kind)).toEqual([
      "task",
      "assignment",
      "exam",
    ]);
    expect(stream.map((item) => item.id)).toEqual([
      "task:t1",
      "assignment:a1",
      "exam:e1",
    ]);
  });

  it("drops tasks with no due date — they are not deadlines", () => {
    const stream = buildDeadlineStream({
      assignments: [],
      exams: [],
      tasks: [
        {
          id: "t2",
          title: "Read Chapter 5",
          dueDate: null,
          priority: "LOW",
          status: "PENDING",
          description: null,
        },
      ],
    }, NOW);
    expect(stream).toEqual([]);
    expect(
      taskToDeadline({
        id: "t2",
        title: "Read Chapter 5",
        dueDate: null,
        priority: "LOW",
        status: "PENDING",
        description: null,
      }),
    ).toBeNull();
  });

  it("treats an exam that has already been sat as done, not overdue", () => {
    const stream = buildDeadlineStream(
      {
        assignments: [],
        exams: [
          {
            id: "past",
            name: "Midterm 1",
            type: "MIDTERM",
            examDate: at("2026-08-18T10:00:00"),
            location: "Hall B",
            subject,
          },
        ],
        tasks: [],
      },
      NOW,
    );

    expect(stream[0].isDone).toBe(true);
    // An exam you already sat is not something you can act on.
    expect(isOverdue(stream[0], NOW)).toBe(false);
    expect(sortForAttention(stream, NOW)).toEqual([]);
  });

  it("keeps an exam that has not happened yet in the queue", () => {
    const stream = buildDeadlineStream(
      {
        assignments: [],
        exams: [
          {
            id: "future",
            name: "Final",
            type: "FINAL",
            examDate: at("2026-09-08T09:00:00"),
            location: "Hall A",
            subject,
          },
        ],
        tasks: [],
      },
      NOW,
    );

    expect(stream[0].isDone).toBe(false);
    expect(sortForAttention(stream, NOW).map((i) => i.id)).toEqual(["exam:future"]);
  });

  it("marks completed work as done so it stops counting as pressure", () => {
    const stream = buildDeadlineStream({
      assignments: [assignment({ status: "COMPLETED" })],
      exams: [],
      tasks: [],
    }, NOW);
    expect(stream[0].isDone).toBe(true);
    expect(isOverdue(stream[0], at("2027-01-01T00:00:00"))).toBe(false);
  });
});

describe("isOverdue", () => {
  const stream = buildDeadlineStream({
    assignments: [assignment({ dueDate: at("2026-09-02T23:59:00") })],
    exams: [],
    tasks: [],
  }, NOW);

  it("flags unfinished work past its due date", () => {
    expect(isOverdue(stream[0], NOW)).toBe(true);
  });

  it("does not flag work that is still due", () => {
    const upcoming = buildDeadlineStream({
      assignments: [assignment()],
      exams: [],
      tasks: [],
    }, NOW);
    expect(isOverdue(upcoming[0], NOW)).toBe(false);
  });

  it("treats a due date exactly now as not yet overdue", () => {
    const exact = buildDeadlineStream({
      assignments: [assignment({ dueDate: NOW })],
      exams: [],
      tasks: [],
    }, NOW);
    expect(isOverdue(exact[0], NOW)).toBe(false);
  });
});

describe("isDueWithinDays", () => {
  const item = buildDeadlineStream({
    assignments: [assignment({ dueDate: at("2026-09-04T23:59:00") })],
    exams: [],
    tasks: [],
  }, NOW)[0];

  it("includes work inside the window", () => {
    expect(isDueWithinDays(item, NOW, 2)).toBe(true);
  });

  it("excludes work beyond the window", () => {
    expect(isDueWithinDays(item, NOW, 1)).toBe(false);
  });

  it("excludes overdue work — that is a different signal", () => {
    const past = buildDeadlineStream({
      assignments: [assignment({ dueDate: at("2026-09-01T09:00:00") })],
      exams: [],
      tasks: [],
    }, NOW)[0];
    expect(isDueWithinDays(past, NOW, 7)).toBe(false);
  });

  it("excludes completed work", () => {
    const done = buildDeadlineStream({
      assignments: [assignment({ status: "COMPLETED" })],
      exams: [],
      tasks: [],
    }, NOW)[0];
    expect(isDueWithinDays(done, NOW, 7)).toBe(false);
  });
});

describe("sortForAttention", () => {
  it("puts overdue items first and hides completed ones", () => {
    const stream = buildDeadlineStream({
      assignments: [
        assignment({ id: "soon", dueDate: at("2026-09-04T10:00:00") }),
        assignment({ id: "late", dueDate: at("2026-09-01T10:00:00") }),
        assignment({ id: "done", dueDate: at("2026-08-20T10:00:00"), status: "COMPLETED" }),
      ],
      exams: [],
      tasks: [],
    }, NOW);

    expect(sortForAttention(stream, NOW).map((i) => i.id)).toEqual([
      "assignment:late",
      "assignment:soon",
    ]);
  });
});
