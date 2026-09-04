import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/signup-form";
import { getCurrentUserOrNull } from "@/lib/db/user";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getCurrentUserOrNull()) redirect("/");

  return <SignUpForm />;
}
