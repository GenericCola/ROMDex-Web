import { site } from "@/site";
import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse can't read CSS variables, so these mirror the light theme in
// src/styles/colors.css (grey-50, grey-950, grey-700, accent-600).
const COLORS = {
  bg: "hsl(210 12% 97%)",
  fg: "hsl(210 17.5% 5%)",
  muted: "hsl(209 12% 38%)",
  accent: "hsl(15 100% 40.75%)",
};

/** Default social preview image, generated at build time. */
const OpengraphImage = () => {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
        width: "100%",
        height: "100%",
        padding: 96,
        background: COLORS.bg,
        borderTop: `16px solid ${COLORS.accent}`,
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, color: COLORS.fg }}>
        {site.name}
      </div>
      <div style={{ fontSize: 36, color: COLORS.muted }}>
        {site.description}
      </div>
    </div>,
    size,
  );
};

export default OpengraphImage;
