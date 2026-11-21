"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { addNote } from "@/app/[locale]/admin/actions";
import { useToast } from "@/components/ui/Toast";

/** Admin-only note. It is stored as an audit entry, so it cannot be edited or deleted. */
export function NoteForm({ targetType, targetId }: { targetType: "request" | "project" | "user"; targetId: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNote(targetType, targetId, note);
          if (r.error) setError(r.error);
          else {
            setError("");
            setNote("");
            toast.push({ message: "Note saved to the audit log." });
            router.refresh();
          }
        });
      }}
    >
      <label htmlFor="admin-note" className="text-sm font-semibold">
        Admin note (only admins can see it)
      </label>
      <textarea
        id="admin-note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full resize-y rounded-[14px] border border-line-strong bg-white px-3.5 py-2.5 text-[15px]"
      />
      {error ? (
        <span role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </span>
      ) : null}
      <Button
        type="submit"
        size="md"
        variant="outline"
        disabled={pending || note.trim().length < 3}
        className="self-start"
      >
        {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}
