"use client";

import type { ComponentProps, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Form controls at a comfortable size.
 *
 * shadcn's defaults are compact (32px) which is fine in a dense toolbar but too
 * small to tap reliably. Form controls step up to 40px on phones and settle at
 * 36px from `sm` up, and every control in the app goes through these wrappers so
 * the sizing cannot drift between forms.
 */
export const FIELD_CLASS = "h-10 w-full sm:h-9";

export function TextInput({
  className,
  ...props
}: ComponentProps<typeof Input>) {
  return <Input className={cn(FIELD_CLASS, className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: ComponentProps<typeof Textarea>) {
  return <Textarea className={cn("w-full", className)} {...props} />;
}

export type SelectOption = {
  value: string;
  label: string;
  /** Rendered before the label — a subject dot, a type icon. */
  adornment?: ReactNode;
};

export function FormSelect({
  id,
  name,
  options,
  defaultValue,
  placeholder = "Select…",
  required,
  className,
  disabled,
  ...aria
}: {
  id?: string;
  name: string;
  options: readonly SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}) {
  return (
    <Select name={name} defaultValue={defaultValue} required={required}>
      <SelectTrigger
        id={id}
        disabled={disabled}
        className={cn(FIELD_CLASS, className)}
        {...aria}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              {option.adornment}
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Options built from a label map, e.g. `PRIORITY_LABELS`. */
export function optionsFromLabels<T extends string>(
  labels: Record<T, string>,
): SelectOption[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}
