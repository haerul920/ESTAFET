import type { Metadata } from "next";
import { LegalDocument, legalMetadata } from "@/components/features/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return legalMetadata((await params).locale, "privacy");
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" sections={8} />;
}
