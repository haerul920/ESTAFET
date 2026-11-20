import { useId } from "react";
import { cn } from "@/lib/cn";

const INPUT =
  "w-full rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base text-ink placeholder:text-muted min-h-[48px] disabled:bg-surface disabled:text-text-2 aria-[invalid=true]:border-danger";

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

function Wrap({
  id,
  label,
  hint,
  error,
  className,
  children,
}: BaseProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <span id={`${id}-hint`} className="text-[13px] text-text-2">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        className={INPUT}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Wrap>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  rows = 4,
  ...rest
}: BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={rows}
        className={cn(INPUT, "resize-y")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Wrap>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: BaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        className={cn(INPUT, "appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234A5A66' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

export function CheckboxField({
  label,
  error,
  className,
  ...rest
}: {
  label: React.ReactNode;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[#1760d6]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[14px] px-4 py-3 text-[15px]",
        tone === "error" ? "bg-[#fdecea] text-danger" : "bg-ok-bg text-ok",
      )}
    >
      {children}
    </div>
  );
}
