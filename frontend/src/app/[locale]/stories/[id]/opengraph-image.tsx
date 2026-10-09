import { ImageResponse } from "next/og";
import { getStory } from "@/lib/server-stories";
export const alt = "SignalStack story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const signal = await getStory(id, locale);
  return new ImageResponse(
    <div
      style={{
        background: "#222631",
        color: "#f2f1f6",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 72,
        justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 32, color: "#c4b5fd" }}>
        SignalStack
      </div>
      <div
        style={{
          fontSize: signal && signal.title.length > 100 ? 44 : 56,
          fontWeight: 600,
          lineHeight: 1.2,
          display: "flex",
        }}
      >
        {signal?.title.slice(0, 220) ||
          "World, technology, and AI news, summarized."}
      </div>
      <div style={{ fontSize: 24, color: "#b8becb", display: "flex" }}>
        {signal?.source || "News, a little clearer."}
      </div>
    </div>,
    size,
  );
}
