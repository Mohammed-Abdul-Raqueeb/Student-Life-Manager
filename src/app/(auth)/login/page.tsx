import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUserOrNull } from "@/lib/db/user";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Someone already signed in has no business on the login screen.
  if (await getCurrentUserOrNull()) redirect("/");

  const { next } = await searchParams;

  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
