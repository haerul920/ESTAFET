import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

/** The picture shown when a page of the site is shared. Same brand colours as the site, no photos. */
export const alt = "ESTAFET";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
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
      <div style={{ display: "flex", fontSize: 34, letterSpacing: 6, fontWeight: 600 }}>ESTAFET</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, fontWeight: 600, maxWidth: 980 }}>
          {t("title")}
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#0E1A26", maxWidth: 980 }}>{t("description")}</div>
      </div>
    </div>,
    size,
  );
}
