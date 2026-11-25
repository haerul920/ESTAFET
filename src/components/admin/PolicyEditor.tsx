"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { LegalArticle } from "@/components/features/LegalArticle";
import { Button } from "@/components/ui/Button";
import { ReasonAction } from "./ReasonDialog";
import { publishLegalDocument } from "@/app/[locale]/admin/actions";
import {
  FIXED_ANCHORS,
  hasFixedAnchors,
  legalContentSchema,
  MAX_SECTIONS,
  type LegalContent,
  type LegalDocName,
  type LegalText,
} from "@/lib/legal/content";
import { cn } from "@/lib/cn";

type Lang = "id" | "en";

/** A text box that looks like the text on the page and grows with it. */
function PageText({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={box}
      rows={1}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "m-0 block w-full resize-none overflow-hidden rounded-[10px] border border-dashed border-line-strong bg-transparent px-2 py-1 focus:border-solid focus:border-blue focus:bg-blue-tint/30",
        className,
      )}
    />
  );
}

function Switch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-[36px] cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors",
            value === o.value ? "bg-ink text-white" : "text-ink hover:bg-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Writes a legal document on its own page layout. It opens with the text readers see now, in both languages.
 * "Preview" shows exactly the component the public page uses.
 */
export function PolicyEditor({ doc, initial }: { doc: LegalDocName; initial: LegalContent }) {
  const t = useTranslations("admin.policies");
  const router = useRouter();
  const [content, setContent] = useState<LegalContent>(initial);
  const [lang, setLang] = useState<Lang>("id");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const text = content[lang];
  const changed = useMemo(() => JSON.stringify(content) !== JSON.stringify(initial), [content, initial]);
  const valid = legalContentSchema.safeParse(content).success && hasFixedAnchors(doc, content);

  // Closing or reloading the tab would lose the writing, so the browser asks first.
  useEffect(() => {
    if (!changed) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  const patch = (next: Partial<LegalText>) => setContent((c) => ({ ...c, [lang]: { ...c[lang], ...next } }));
  const patchSection = (id: string, next: { h?: string; body?: string }) =>
    patch({ sections: text.sections.map((s) => (s.id === id ? { ...s, ...next } : s)) });

  /** A section is added to and removed from both languages, so the two pages keep the same parts. */
  const both = (change: (list: LegalText["sections"], l: Lang) => LegalText["sections"]) =>
    setContent((c) => ({
      id: { ...c.id, sections: change(c.id.sections, "id") },
      en: { ...c.en, sections: change(c.en.sections, "en") },
    }));
  const addSection = () => {
    const id = `n${Date.now().toString(36)}`;
    both((list) => [...list, { id, h: "", body: "" }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/policies" className="text-sm font-semibold">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            label={t("language")}
            value={lang}
            onChange={setLang}
            options={[
              { value: "id", label: t("langId") },
              { value: "en", label: t("langEn") },
            ]}
          />
          <Switch
            label={t("viewLabel")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "write", label: t("write") },
              { value: "preview", label: t("preview") },
            ]}
          />
          <ReasonAction
            label={t("publishDoc")}
            tone="primary"
            disabled={!changed || !valid}
            consequence={doc === "terms" || doc === "privacy" ? t("effectPolicy") : t("effectPage")}
            reasonLabel={t("reasonLabel")}
            action={(reason) => publishLegalDocument(doc, content, reason)}
            successMessage={t("documentPublished")}
            onDone={() => router.push("/admin/policies")}
          />
        </div>
      </div>

      <p role="status" className="m-0 text-sm text-text-2">
        {!valid ? t("incomplete") : changed ? t("unsaved") : t("noChanges")}
      </p>
      {doc === "attribution" ? (
        <p className="m-0 rounded-2xl bg-blue-tint px-4 py-2.5 text-sm">{t("attributionNote")}</p>
      ) : null}

      {/* The same width and type as the public page. */}
      <article lang={lang} className="mx-auto w-full max-w-[760px] rounded-[28px] bg-white px-6 py-8">
        {mode === "preview" ? (
          <LegalArticle doc={doc} text={text} />
        ) : (
          <>
            <p className="mb-4 mt-0 text-[13px] text-text-2">{t("formatHint")}</p>
            <PageText
              label={t("titleLabel")}
              value={text.title}
              onChange={(title) => patch({ title })}
              className="mb-3 text-[36px] font-medium leading-tight max-sm:text-[28px]"
            />
            <PageText
              label={t("leadLabel")}
              value={text.lead}
              onChange={(lead) => patch({ lead })}
              className="mb-8 text-lg text-text-2"
            />
            <div className="flex flex-col gap-6">
              {text.sections.map((section, index) => {
                const fixed = FIXED_ANCHORS[doc].includes(section.id);
                return (
                  <section key={section.id} className="flex flex-col gap-1">
                    <PageText
                      label={t("headingLabel", { n: index + 1 })}
                      value={section.h}
                      onChange={(h) => patchSection(section.id, { h })}
                      className="text-xl font-semibold"
                    />
                    <PageText
                      label={t("bodyLabel", { n: index + 1 })}
                      value={section.body}
                      onChange={(body) => patchSection(section.id, { body })}
                      className="text-[16px] leading-relaxed"
                    />
                    {fixed ? (
                      <span className="text-[13px] text-text-2">{t("lockedSection")}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => both((list) => list.filter((s) => s.id !== section.id))}
                        disabled={text.sections.length <= 1}
                        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 self-end rounded-full px-3 text-[13px] font-semibold text-danger hover:bg-[#fdecea] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} aria-hidden="true" /> {t("removeSection", { n: index + 1 })}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
            <Button
              variant="outline"
              className="mt-6"
              onClick={addSection}
              disabled={text.sections.length >= MAX_SECTIONS}
            >
              <Plus size={16} aria-hidden="true" /> {t("addSection")}
            </Button>
          </>
        )}
      </article>
    </div>
  );
}
