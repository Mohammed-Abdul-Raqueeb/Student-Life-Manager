import type { Route } from "next";
import {
  BookMarked,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sun,
  Timer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar, where only five items fit. */
  primary?: boolean;
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: LayoutDashboard,
    primary: true,
    description: "Everything that needs attention today",
  },
  {
    href: "/today",
    label: "Today",
    icon: Sun,
    primary: true,
    description: "Your day, hour by hour",
  },
  {
    href: "/subjects",
    label: "Subjects",
    icon: BookOpen,
    primary: true,
    description: "Courses, credits and instructors",
  },
  {
    href: "/assignments",
    label: "Assignments",
    icon: ClipboardList,
    primary: true,
    description: "Coursework and general tasks",
  },
  {
    href: "/exams",
    label: "Exams",
    icon: CalendarClock,
    description: "Quizzes, midterms and finals",
  },
  {
    href: "/timetable",
    label: "Timetable",
    icon: CalendarDays,
    description: "Your weekly class schedule",
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: UserCheck,
    description: "Record classes and track your target",
  },
  {
    href: "/notes",
    label: "Notes",
    icon: NotebookPen,
    description: "Notes by subject",
  },
  {
    href: "/marks",
    label: "Marks & Grades",
    icon: GraduationCap,
    description: "Assessments and performance",
  },
  {
    href: "/study",
    label: "Study Progress",
    icon: Timer,
    description: "Study sessions and your weekly goal",
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
  description: "Profile, academic targets and appearance",
};

export const MOBILE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.primary,
);

export const BRAND_ICON = BookMarked;

/** Longest match wins, so /subjects/abc highlights Subjects rather than Overview. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavItem(pathname: string): NavItem | null {
  const candidates = [...NAV_ITEMS, SETTINGS_ITEM].filter((item) =>
    isActivePath(pathname, item.href),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) =>
    item.href.length > best.href.length ? item : best,
  );
}
