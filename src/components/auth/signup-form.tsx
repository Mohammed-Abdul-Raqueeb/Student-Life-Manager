"use client";

import { signUpAction } from "@/actions/auth";
import { AuthCard, AuthFooterLink } from "@/components/auth/auth-form";
import { PasswordInput } from "@/components/auth/password-input";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/lib/validations/auth";

export function SignUpForm() {
  return (
    <AuthCard
      title="Create your Campivo account"
      description="One place for your subjects, deadlines, attendance and marks."
      action={signUpAction}
      submitLabel="Create account"
      pendingLabel="Creating account…"
      footer={
        <AuthFooterLink
          prompt="Already have an account?"
          href="/login"
          label="Log in"
        />
      }
    >
      {(fieldErrors) => (
        <>
          <FormField
            id="signup-name"
            label="Full name"
            required
            error={fieldErrors?.name}
          >
            {(props) => (
              <Input
                {...props}
                name="name"
                autoComplete="name"
                autoFocus
                placeholder="Aarav Shah"
              />
            )}
          </FormField>

          <FormField
            id="signup-email"
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
                placeholder="you@college.edu"
              />
            )}
          </FormField>

          <FormField
            id="signup-password"
            label="Password"
            required
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
            error={fieldErrors?.password}
          >
            {(props) => (
              <PasswordInput
                {...props}
                name="password"
                autoComplete="new-password"
              />
            )}
          </FormField>

          <FormField
            id="signup-confirm"
            label="Confirm password"
            required
            error={fieldErrors?.confirmPassword}
          >
            {(props) => (
              <PasswordInput
                {...props}
                name="confirmPassword"
                autoComplete="new-password"
              />
            )}
          </FormField>
        </>
      )}
    </AuthCard>
  );
}
