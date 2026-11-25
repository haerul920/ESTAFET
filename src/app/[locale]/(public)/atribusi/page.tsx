import type { Metadata } from "next";
import { LegalDocument, legalMetadata } from "@/components/features/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return legalMetadata((await params).locale, "attribution");
}

export default function AttributionPage() {
  return <LegalDocument doc="attribution" />;
}
