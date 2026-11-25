"use client";

import { useId, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Eye, EyeOff, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

const INPUT =
  "w-full rounded-[14px] border border-line-strong bg-white px-3.5 py-3 text-base text-ink placeholder:text-muted min-h-[48px] disabled:bg-surface disabled:text-text-2 aria-[invalid=true]:border-danger";

interface BaseProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}

function Wrap({ id, label, hint, error, className, children }: BaseProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold">
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

/** Puts `after` beside the control, as tall as the control. On phones it goes under it. */
function Row({ after, children }: { after?: React.ReactNode; children: React.ReactNode }) {
  if (!after) return <>{children}</>;
  return (
    <div className="flex items-stretch gap-3 max-sm:flex-col">
      <div className="min-w-0 flex-1 [&>input]:w-full">{children}</div>
      {after}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  type,
  showPasswordLabel,
  hidePasswordLabel,
  after,
  ...rest
}: BaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
    showPasswordLabel?: string;
    hidePasswordLabel?: string;
    /** A button on the same line as the input. The hint and the error stay below both, so they stay level. */
    after?: React.ReactNode;
  }) {
  const auto = useId();
  const id = rest.id ?? auto;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password" && Boolean(showPasswordLabel && hidePasswordLabel);

  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <Row after={after}>
        {isPassword ? (
          <div className="relative">
            <input
              id={id}
              type={visible ? "text" : "password"}
              className={cn(INPUT, "pr-12")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
              {...rest}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? hidePasswordLabel : showPasswordLabel}
              aria-pressed={visible}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-text-2 transition-colors hover:bg-surface hover:text-ink"
            >
              {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          <input
            id={id}
            type={type}
            className={INPUT}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...rest}
          />
        )}
      </Row>
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

export interface SearchableOption {
  value: string;
  label: string;
}

function splitFacultyBadge(label: string): { main: string; code: string | null } {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(label);
  if (!m) return { main: label, code: null };
  return { main: m[1].trim(), code: m[2].trim() };
}

/**
 * The app's dropdown, with a search box unless `searchable` is false. The list is a Radix popover (portal, collision
 * flipping, focus return). Focus stays in the search box, or on the list: arrow keys move through the options, Enter
 * picks one, Escape closes the list, and Tab closes it and moves on to the next field.
 */
export function SearchableSelect({
  label,
  hint,
  error,
  className,
  name,
  options,
  defaultValue = "",
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  clearLabel,
  emptyText,
  searchable = true,
}: BaseProps & {
  /** Set it when a plain form has to send the value. */
  name?: string;
  options: SearchableOption[];
  defaultValue?: string;
  /** Follow a value kept elsewhere, such as the URL. Leave it out in a plain form. */
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  clearLabel?: string;
  emptyText?: string;
  /** False for a short list of choices. */
  searchable?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const leavingByTab = useRef(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? defaultValue);
  // A choice shows at once. When the outside value changes later (filters cleared, back button), follow it.
  const [outsideValue, setOutsideValue] = useState(value);
  if (value !== outsideValue) {
    setOutsideValue(value);
    if (value !== undefined) setSelected(value);
  }
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);

  const currentOption = useMemo(() => options.find((o) => o.value === selected), [options, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const activeIndex = Math.min(highlighted, filtered.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;
  const showInList = (index: number) => document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });

  function onOpenChange(next: boolean) {
    if (next) {
      leavingByTab.current = false;
      setQuery("");
      const chosen = options.findIndex((o) => o.value === selected);
      setHighlighted(Math.max(0, chosen));
    }
    setOpen(next);
  }

  function choose(next: string) {
    setSelected(next);
    setOpen(false);
    if (next !== selected) onValueChange?.(next);
  }

  function search(value: string) {
    setQuery(value);
    setHighlighted(0);
  }

  function highlight(next: number) {
    setHighlighted(next);
    showInList(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
    if (!searchable && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      highlight(e.key === "Home" ? 0 : filtered.length - 1);
    } else if (!searchable && e.key.length === 1 && e.key !== " ") {
      // Without a search box, typing a letter jumps to the next option that starts with it.
      const letter = e.key.toLowerCase();
      const after = [...filtered.keys()].map((i) => (activeIndex + 1 + i) % filtered.length);
      const next = after.find((i) => filtered[i].label.toLowerCase().startsWith(letter));
      if (next !== undefined) highlight(next);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      highlight((activeIndex + step + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || (!searchable && e.key === " ")) {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) choose(option.value);
    } else if (e.key === "Tab") {
      // The list sits in a portal at the end of the page. Move back to the trigger first, so the
      // browser's own Tab continues to the field after (or before) this one.
      leavingByTab.current = true;
      triggerRef.current?.focus();
      setOpen(false);
    }
  }

  // Nothing chosen shows the placeholder, never the first option. A stored value outside the list shows as typed.
  const shown = currentOption?.label ?? (selected || placeholder || options[0]?.label || "");
  // Only the searchable pickers show a code in brackets, such as a faculty's, as its own badge.
  const parts = (text: string) => (searchable ? splitFacultyBadge(text) : { main: text, code: null });
  const currentParts = parts(shown);

  return (
    <Wrap id={id} label={label} hint={hint} error={error} className={className}>
      <div>
        {name ? <input type="hidden" name={name} value={selected} /> : null}
        <Popover.Root open={open} onOpenChange={onOpenChange}>
          <Popover.Trigger asChild>
            <button
              ref={triggerRef}
              id={id}
              type="button"
              aria-haspopup="listbox"
              aria-labelledby={`${id}-label ${id}-value`}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
              className={cn(
                INPUT,
                "flex cursor-pointer items-center justify-between gap-2 text-left transition-colors duration-150 hover:border-ink/45",
                open && "border-blue ring-2 ring-blue/15",
                error && "border-danger",
              )}
            >
              <span id={`${id}-value`} className="flex min-w-0 flex-1 items-center gap-2">
                <span className={cn("truncate", !selected && "text-text-2")}>{currentParts.main}</span>
                {currentParts.code ? (
                  <span className="shrink-0 rounded-full bg-blue-tint px-2.5 py-0.5 font-mono text-xs font-semibold text-blue-dark">
                    {currentParts.code}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={cn("shrink-0 text-text-2 transition-transform duration-200", open && "rotate-180 text-blue")}
              />
            </button>
          </Popover.Trigger>

          <Popover.Portal>
            <Popover.Content
              aria-label={label}
              align="start"
              sideOffset={8}
              collisionPadding={12}
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                (searchable ? searchRef.current : listRef.current)?.focus();
                showInList(activeIndex);
              }}
              onCloseAutoFocus={(e) => {
                if (leavingByTab.current) e.preventDefault();
              }}
              className="o-menu z-dropdown flex max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] min-w-[min(240px,calc(100vw-24px))] origin-[var(--radix-popover-content-transform-origin)] flex-col overflow-hidden rounded-[20px] border border-line-strong bg-white text-ink shadow-[0_20px_50px_rgba(14,26,38,0.16)]"
            >
              {searchable ? (
                <div className="border-b border-line-soft bg-surface/65 p-2.5">
                  <div className="relative flex items-center">
                    <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 text-text-2" />
                    <input
                      ref={searchRef}
                      type="text"
                      role="combobox"
                      aria-expanded="true"
                      aria-controls={listId}
                      aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                      aria-autocomplete="list"
                      autoComplete="off"
                      value={query}
                      onChange={(e) => {
                        // React events cross portals: without this, typing here would count as editing the form.
                        e.stopPropagation();
                        search(e.target.value);
                      }}
                      onKeyDown={onKeyDown}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      className="h-11 w-full rounded-[12px] border border-line-strong bg-white pl-9 pr-11 text-sm text-ink placeholder:text-muted"
                    />
                    {query ? (
                      // Not a Tab stop: keyboard users delete the text, and Tab leaves the field.
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={clearLabel}
                        onClick={() => {
                          search("");
                          searchRef.current?.focus();
                        }}
                        className="absolute right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-text-2 hover:bg-surface hover:text-ink"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {filtered.length === 0 ? (
                <p role="status" className="m-0 px-3.5 py-6 text-center text-sm text-text-2">
                  {emptyText}
                </p>
              ) : null}
              {/* data-lenis-prevent: the mouse wheel scrolls this list, not the page behind it. */}
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={label}
                tabIndex={searchable ? undefined : -1}
                aria-activedescendant={!searchable && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                onKeyDown={searchable ? undefined : onKeyDown}
                data-lenis-prevent
                className={cn(
                  "m-0 flex max-h-[264px] min-h-0 list-none flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5",
                  filtered.length === 0 && "hidden",
                )}
              >
                {filtered.map((opt, index) => {
                  const chosen = opt.value === selected;
                  const text = parts(opt.label);
                  return (
                    <li
                      key={opt.value || "__empty"}
                      id={optionId(index)}
                      role="option"
                      aria-selected={chosen}
                      data-highlighted={index === activeIndex || undefined}
                      onPointerMove={() => setHighlighted(index)}
                      // Keep focus in the search box while clicking.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(opt.value)}
                      className={cn(
                        "flex min-h-[44px] flex-none cursor-pointer items-center justify-between gap-2.5 rounded-[12px] px-3 py-2.5 text-sm data-[highlighted]:ring-2 data-[highlighted]:ring-inset data-[highlighted]:ring-blue",
                        chosen ? "bg-blue-tint font-semibold text-blue-dark" : "text-ink data-[highlighted]:bg-surface",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <span className="leading-snug">{text.main}</span>
                        {text.code ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                              chosen ? "bg-white text-blue-dark" : "bg-surface text-text-2",
                            )}
                          >
                            {text.code}
                          </span>
                        ) : null}
                      </span>
                      {chosen ? <Check size={16} aria-hidden="true" className="shrink-0 text-blue" /> : null}
                    </li>
                  );
                })}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </Wrap>
  );
}

/** A short list of choices. It looks and works like the other dropdowns, without the search box. */
export function SelectField(
  props: BaseProps & {
    options: SearchableOption[];
    name?: string;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    /** Shown while nothing is chosen. */
    placeholder?: string;
  },
) {
  return <SearchableSelect {...props} searchable={false} />;
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
