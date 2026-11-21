import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Privacy Policy", robots: { index: false } };

/**
 * Short interim version of the Privacy Policy (version 1). It lists what the software does today.
 * The full text is written in phase R5 and reviewed by the university before any public launch.
 */
export default function PrivacyPage() {
  return (
    <PageShell width={760}>
      <Card tone="warn" className="mb-6">
        <strong>Draft, not yet reviewed by the university.</strong> This is version 1 of the Privacy Policy. A full text will replace it before launch.
      </Card>
      <h1 className="mb-4 mt-0 text-[36px] font-medium">Privacy Policy</h1>
      <div className="flex flex-col gap-4 text-[16px] leading-relaxed">
        <p className="m-0">What ESTAFET stores and does today:</p>
        <ul className="m-0 flex flex-col gap-2 pl-5">
          <li>Your account: name, email address, and the faculty you choose to give. We record which version of these documents you accepted.</li>
          <li>Your projects: the details you enter, and the files you upload. Files are stored privately and are not shown on public pages.</li>
          <li>AI drafting: when you ask for a draft, the text of your files is sent to the AI provider that ESTAFET is configured to use. In demo mode a built-in simulator is used and nothing leaves the server. Every team member must agree before this happens.</li>
          <li>Reports and moderation: a report is stored with its reason. The owner of a project never sees who reported it.</li>
          <li>Security: we keep a hashed form of an address to limit abuse. We do not store file contents in logs.</li>
        </ul>
        <p className="m-0 text-text-2">Rights to access, correct, export and delete your data are described in the full text. Data export and account deletion are not built yet.</p>
      </div>
    </PageShell>
  );
}
