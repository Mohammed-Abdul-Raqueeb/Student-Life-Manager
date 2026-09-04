"use client";

import { loginAction } from "@/actions/auth";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth-form";
import { PasswordInput } from "@/components/auth/password-input";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  return (
    <AuthCard
      title="Welcome back 👋"
      description="Log in to pick up where you left off."
      action={loginAction}
      submitLabel="Log in"
      pendingLabel="Logging in…"
      footer={
        <AuthFooterLink
          prompt="Don't have an account?"
          href="/signup"
          label="Create account"
        />
      }
    >
      {(fieldErrors) => (
        <>
          {/* Where the middleware was sending them before it asked them to log
              in. Sanitised server-side; never trusted as given. */}
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <FormField
            id="login-email"
            label="Email"
            required
            error={fieldErrors?.email}
          >
            {(props) => (
              <Input
                {...props}
                name="email"
                type="email"
                autoComplete="email"
                // The one field a returning student should be typing into.
                autoFocus
                placeholder="you@college.edu"
              />
            )}
          </FormField>

          <FormField
            id="login-password"
            label="Password"
            required
            error={fieldErrors?.password}
          >
            {(props) => (
              <PasswordInput
                {...props}
                name="password"
                autoComplete="current-password"
              />
            )}
          </FormField>
        </>
      )}
    </AuthCard>
  );
}
