import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Terms", robots: { index: false } };

/**
 * Short interim version of the Terms (version 1). The full text is written in phase R5 and reviewed by the university
 * before any public launch. This page says so instead of pretending to be final.
 */
export default function TermsPage() {
  return (
    <PageShell width={760}>
      <Card tone="warn" className="mb-6">
        <strong>Draft, not yet reviewed by the university.</strong> This is version 1 of the Terms. A full text will replace it before launch.
      </Card>
      <h1 className="mb-4 mt-0 text-[36px] font-medium">Terms</h1>
      <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
        <p className="m-0">ESTAFET helps student teams hand over discontinued competition and research projects to the next team.</p>
        <ul className="m-0 flex flex-col gap-2 pl-5">
          <li>You may share a project only if you worked on it and you have the right to share it. Everyone on the team must agree.</li>
          <li>The public teaser shows only what you approve. Your files stay private and open only to people who hold access.</li>
          <li>Anyone who takes access accepts the attribution agreement and credits the original team.</li>
          <li>Anyone can report a project. The ESTAFET team may hold, hide or remove a project, with a written reason you can appeal.</li>
          <li>Do not upload secrets, personal data of other people, or files you may not share.</li>
        </ul>
        <p className="m-0 text-text-2">The attribution agreement is a simple template for student projects. It is not legal advice.</p>
      </div>
    </PageShell>
  );
}
