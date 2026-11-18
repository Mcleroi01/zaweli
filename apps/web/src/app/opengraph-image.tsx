import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Aperçu affiché quand un lien Zaweli est partagé (WhatsApp, réseaux, messageries). Généré au build. */
export const alt = "Zaweli — Offre un moment, pas seulement un message";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Le serveur peut être lancé depuis apps/web (next start) ou depuis la racine du dépôt (Hostinger, server.mjs).
const fonts = [join(process.cwd(), "assets/fonts"), join(process.cwd(), "apps/web/assets/fonts")].find((dir) =>
  existsSync(join(dir, "cormorant-garamond-latin-400-normal.woff")),
) ?? join(process.cwd(), "assets/fonts");

export default async function Image() {
  const [regular, italic] = await Promise.all([
    readFile(join(fonts, "cormorant-garamond-latin-400-normal.woff")),
    readFile(join(fonts, "cormorant-garamond-latin-400-italic.woff")),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f6f1e8",
          color: "#1a1311",
          fontFamily: "Cormorant",
        }}
      >
        <div style={{ display: "flex", fontSize: 44 }}>
          Zaweli<span style={{ color: "#a8823f" }}>.</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", fontSize: 92, lineHeight: 1.02, letterSpacing: -2, maxWidth: 980 }}>
          <span>Offre un&nbsp;</span>
          <span style={{ fontStyle: "italic", color: "#6d0f1d" }}>moment</span>
          <span>,&nbsp;</span>
          <span>pas seulement un message.</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#6b605b" }}>Expériences numériques à offrir · zaweli.store</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: regular, style: "normal", weight: 400 },
        { name: "Cormorant", data: italic, style: "italic", weight: 400 },
      ],
    },
  );
}
