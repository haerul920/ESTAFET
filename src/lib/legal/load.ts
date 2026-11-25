import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { errorFields, log } from "@/lib/log";
import { legalContentSchema, type LegalContent, type LegalDocName } from "./content";
import { defaultContent } from "./defaults";

export interface PublishedDocument {
  content: LegalContent;
  /** 0 while the built-in text is showing. */
  revision: number;
  publishedAt: string | null;
}

/**
 * The newest published revision, or the built-in text. A legal page must always show something, so a failed read (or a
 * database that does not have the table yet) also falls back to the built-in text and is logged.
 */
export const getLegalDocument = cache(async (doc: LegalDocName): Promise<PublishedDocument> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select("content, revision, published_at")
    .eq("doc", doc)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) log.warn("legal_document_unavailable", { doc, ...errorFields(error) });
  const parsed = legalContentSchema.safeParse(data?.content);
  if (!data || !parsed.success) return { content: defaultContent(doc), revision: 0, publishedAt: null };
  return { content: parsed.data, revision: data.revision as number, publishedAt: data.published_at as string };
});
