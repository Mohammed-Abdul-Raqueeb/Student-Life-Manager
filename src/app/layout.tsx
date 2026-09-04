import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUser } from "@/lib/db/user";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Student Life Manager",
    template: "%s · Student Life",
  },
  description:
    "One place for your subjects, assignments, exams, timetable, attendance, marks and study progress.",
  applicationName: "Student Life Manager",
};

/**
 * Every page in this app reads the database and evaluates "now" — today's
 * classes, days remaining, this week's study total. Prerendering any of them at
 * build time would freeze both, so the whole tree renders per request. Segment
 * config on a layout applies to every segment beneath it, so this one line
 * covers all routes.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14161f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolving the student here means the shell can show their name and program
  // without every page having to pass it down.
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme={user.settings.theme.toLowerCase()}
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>
            <AppShell user={user}>{children}</AppShell>
          </TooltipProvider>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
