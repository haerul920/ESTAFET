import { Compass } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <PageShell width={720}>
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Compass size={44} className="text-blue" aria-hidden="true" />
        <p className="mono-label m-0 text-text-2">Error 404</p>
        <h1 className="m-0 text-[40px] font-medium">We could not find that page</h1>
        <p className="m-0 max-w-md text-text-2">
          The link may be old, or the project has not been published yet. Unpublished projects are only visible to their
          creators.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/explore" arrow>
            Explore projects
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
