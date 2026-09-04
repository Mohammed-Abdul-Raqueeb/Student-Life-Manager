import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUserOrNull } from "@/lib/db/user";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Campivo",
    template: "%s · Campivo",
  },
  description:
    "One place for your subjects, assignments, exams, timetable, attendance, marks and study progress.",
  applicationName: "Campivo",
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

/**
 * The document and the providers, and nothing else.
 *
 * The application frame lives in `(app)/layout.tsx`, which is also where the
 * session is required. Keeping that out of here is what lets `/login` and
 * `/signup` render at all: a redirect-on-missing-session in the root layout
 * would fire on the login page too and loop forever.
 *
 * The session is still *read* here, without requiring one, so a signed-in
 * student's saved theme applies to the very first paint rather than flashing
 * the default and correcting itself.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUserOrNull();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme={(user?.settings.theme ?? "SYSTEM").toLowerCase()}
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
