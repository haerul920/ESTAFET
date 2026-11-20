import type { Metadata } from "next";
import { FileText, ArrowRight } from "lucide-react";
import { HomeHero } from "@/components/features/HomeHero";
import { SiteNav } from "@/components/ui/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Cloud, CountUp, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { Footer } from "@/components/ui/Footer";
import { MeadowCta } from "@/components/features/MeadowCta";
import { SurveyDots } from "@/components/features/SurveyDots";

export const metadata: Metadata = {
  title: "Pick up where the last team stopped",
  description:
    "ESTAFET turns discontinued student projects into verified starting points, so the next team builds in week one instead of digging through old drives.",
};

const STEPS = [
  { n: 1, title: "Upload", text: "Add a PDF report, Markdown notes or a code folder tree, after your team and advisor agree.", lime: false },
  { n: 2, title: "Verify", text: "AI drafts the unfinished tasks. You keep, edit or remove each one before anything is public.", lime: false },
  { n: 3, title: "Request", text: "An adopter team reads the teaser and sends a short continuation plan.", lime: true },
  { n: 4, title: "Continue with credit", text: "Both sides accept the attribution agreement. Private files unlock and the lineage is logged.", lime: true },
];

const GUARDS = [
  { title: "Every task cites its source", text: "Each drafted task links to a page or file, and ESTAFET checks that the quoted text really exists there." },
  { title: "Nothing public until verified", text: "Publishing stays blocked until the creator has reviewed every drafted item." },
  { title: "Advisor consent first", text: "Advisors approve through a private link before a project can be published." },
];

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`mono-label mb-4 ${center ? "mb-7" : ""}`}>
      <span className="mr-2.5 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />
      {children}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="text-[17px]">
      <HomeHero nav={<SiteNav variant="hero" />} />

      <section className="mx-auto max-w-[1120px] px-8 pb-12 pt-24 text-center max-sm:px-4 max-sm:pt-16">
        <Reveal>
          <Eyebrow center>Why ESTAFET</Eyebrow>
          <h2 className="mx-auto max-w-[900px] text-[56px] font-medium leading-[1.08] tracking-[-0.045em] max-md:text-[36px]">
            A handover system for{" "}
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#4AA0F2] align-middle">
              <FileText size={22} color="#fff" strokeWidth={2.2} aria-hidden="true" />
            </span>{" "}
            unfinished student work{" "}
            <span className="text-[#6F7881]">
              and the teams who{" "}
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-lime align-middle">
                <ArrowRight size={22} color="#10151A" strokeWidth={2.2} aria-hidden="true" />
              </span>{" "}
              continue it.
            </span>
          </h2>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1120px] px-8 pb-6 pt-4 max-sm:px-4">
        <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
          <StaggerItem>
            <div
              className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[32px] p-5"
              style={{ background: "linear-gradient(180deg,#2C86EE 0%,#7BBAF7 70%,#CDE4FB 100%)" }}
            >
              <Cloud className="-right-[60px] bottom-[100px] h-20 w-[260px] opacity-60 blur-[22px]" drift={14} />
              <span className="mono-label relative text-xs text-white">Preliminary survey, n=10</span>
              <div className="relative rounded-3xl bg-white p-5">
                <div className="text-[60px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={60} suffix="%" />
                </div>
                <p className="mt-2 text-[15px] text-text-2">had a recent project discontinued but still stored.</p>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="flex min-h-[360px] flex-col justify-between rounded-[32px] bg-surface-grey p-6">
              <span className="mono-label text-xs text-text-2">Where the files live</span>
              <div>
                <div className="mb-4 text-[60px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={90} suffix="%" />
                </div>
                <SurveyDots filled={9} total={10} />
                <p className="mt-3 text-[15px] text-text-2">
                  kept files in personal drives or group chats. Indicative only, not a statistical sample.
                </p>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem className="flex flex-col gap-4">
            <div className="flex min-h-[170px] flex-1 flex-col justify-between rounded-[32px] bg-lime p-6">
              <span className="mono-label text-xs">Handover documents</span>
              <div>
                <div className="text-[52px] font-medium leading-none tracking-[-0.05em]">
                  <CountUp to={70} suffix="%" />
                </div>
                <p className="mt-1.5 text-[15px]">lacked complete handover documentation.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[32px] bg-black p-6 text-white">
              <div>
                <span className="mono-label text-xs text-[#B8C0C8]">Our target, not yet measured</span>
                <div className="mt-1 text-[15px] text-[#DDE2E6]">Understand a project</div>
              </div>
              <div className="whitespace-nowrap text-[40px] font-medium tracking-[-0.04em]">30 min</div>
            </div>
          </StaggerItem>
        </Stagger>
        <p className="mx-1 mt-4 text-[13px] text-muted">
          Source: Beban Server Team, preliminary survey of 10 Universitas Hasanuddin students across four faculties,
          Nov 2026.
        </p>
      </section>

      <section id="how" className="mx-auto max-w-[1120px] scroll-mt-8 px-8 pb-6 pt-[72px] max-sm:px-4">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mb-8 max-w-[680px] text-5xl font-medium leading-[1.08] tracking-[-0.04em] max-md:text-[34px]">
            Four steps from forgotten archive to a new beginning.
          </h2>
        </Reveal>
        <Stagger gap={0.1} className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          {STEPS.map((s) => (
            <StaggerItem key={s.n} className="flex min-h-[230px] flex-col justify-between rounded-[28px] bg-surface-soft p-6">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${s.lime ? "bg-lime text-black" : "bg-black text-white"}`}
              >
                {s.n}
              </div>
              <div>
                <div className="mono-label mb-1.5 text-xs">{s.title}</div>
                <p className="m-0 text-base text-text-3">{s.text}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4 px-8 pb-6 pt-10 max-sm:px-4">
        <Reveal>
          <div
            className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[36px] p-9 text-white max-sm:p-6"
            style={{ background: "linear-gradient(180deg,#1E7BE8 0%,#6BB1F6 100%)" }}
          >
            <Cloud className="-bottom-10 -right-20 h-[140px] w-[380px] opacity-55 blur-[28px]" drift={20} />
            <span className="mono-label relative text-xs">For creators</span>
            <div className="relative">
              <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-sm:text-[28px]">
                Finished or paused a project? Give it a second life.
              </h3>
              <p className="mb-6 max-w-[420px] text-white/95">
                Publish a teaser, keep private files locked, record what you learned, and keep your name on the work.
              </p>
              <ButtonLink href="/share" size="lg" arrow>
                Share a project
              </ButtonLink>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="flex min-h-[380px] flex-col justify-between rounded-[36px] bg-lime p-9 text-black max-sm:p-6">
            <span className="mono-label text-xs">For adopters</span>
            <div>
              <h3 className="mb-3 text-4xl font-medium leading-[1.1] tracking-[-0.035em] max-sm:text-[28px]">
                Need a place to start? Begin with a verified next step.
              </h3>
              <p className="mb-6 max-w-[420px]">
                See the state of a project in one sitting, what failed before and why, then continue with the original
                team&apos;s blessing.
              </p>
              <ButtonLink href="/explore" variant="darkSolid" size="lg" arrow>
                Explore projects
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="px-3 pb-3 pt-12">
        <div
          className="relative overflow-hidden rounded-[36px] px-8 py-14 max-sm:px-5"
          style={{ background: "linear-gradient(180deg,#2D86EE 0%,#8CC4F8 100%)" }}
        >
          <Cloud className="-left-20 top-10 h-[100px] w-[340px] opacity-50 blur-[26px]" drift={24} />
          <Cloud className="-right-[60px] bottom-[30px] h-[110px] w-[380px] opacity-55 blur-[26px]" drift={-24} />
          <div className="relative mx-auto max-w-[1060px]">
            <Reveal>
              <div className="mono-label mb-3 text-white">Built around one risk</div>
              <h2 className="mb-8 text-5xl font-medium leading-[1.08] tracking-[-0.04em] text-white max-md:text-[34px]">
                AI drafts. People decide.
              </h2>
            </Reveal>
            <Stagger gap={0.12} className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
              {GUARDS.map((g) => (
                <StaggerItem
                  key={g.title}
                  className="glass rounded-[28px] p-6 text-[#08234D]"
                >
                  <h3 className="mb-2 text-xl font-semibold tracking-normal">{g.title}</h3>
                  <p className="m-0 text-base">{g.text}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <MeadowCta />

      <div className="px-3 pb-3">
        <Footer />
      </div>
    </div>
  );
}
