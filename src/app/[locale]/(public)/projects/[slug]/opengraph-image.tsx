import { ImageResponse } from "next/og";
import { getTeaserBySlug } from "@/lib/db/public";

/** The picture shown when a public project is shared. A project that is not public gets the plain brand picture. */
export const alt = "ESTAFET";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default async function ProjectOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getTeaserBySlug(slug).catch(() => null);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(180deg,#1673E6 0%,#4AA0F2 55%,#CDE4FB 100%)",
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="56" height="44" viewBox="0 0 44 34">
          <path
            d="M16 10.5 H14.05 A9.25 9.25 0 0 0 14.05 29 H29.95 A9.25 9.25 0 0 0 38.2 15.8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="5.4"
            strokeLinecap="round"
          />
          <rect x="16" y="5.2" width="19.5" height="7.6" rx="3.8" transform="rotate(-8 25.75 9)" fill="#B4F53A" />
        </svg>
        <div style={{ display: "flex", fontSize: 42, fontWeight: 700, letterSpacing: -1, textTransform: "lowercase" }}>
          ESTAFET<span style={{ color: "#B4F53A" }}>.</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 68, lineHeight: 1.08, fontWeight: 600, maxWidth: 1020 }}>
          {project ? cut(project.title, 90) : "ESTAFET"}
        </div>
        {project ? (
          <div style={{ display: "flex", fontSize: 30, color: "#0E1A26", maxWidth: 1020 }}>
            {cut(project.summary, 160)}
          </div>
        ) : null}
      </div>
    </div>,
    size,
  );
}
