"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/account/session";
import { Button } from "./ui";

/** Noir sur blanc, marge de 4 modules : le contraste que tous les lecteurs de QR code acceptent, même en thème sombre. */
const OPTIONS = { errorCorrectionLevel: "M", margin: 4, color: { dark: "#000000", light: "#ffffff" } } as const;

/** La bibliothèque n'est chargée qu'au moment d'afficher un QR code. */
const qrcode = () => import("qrcode").then((m) => m.default);

function download(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

/**
 * QR code du lien public, téléchargeable en PNG (impression, messagerie) ou en
 * SVG (graphisme, grande taille). Il encode exactement le lien partagé.
 */
export function QrCode({ url, slug }: { url: string; slug: string }) {
  const { t } = useAccount();
  const [svg, setSvg] = useState<{ url: string; markup: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void qrcode()
      .then((QR) => QR.toString(url, { ...OPTIONS, type: "svg" }))
      .then((markup) => {
        if (alive) setSvg({ url, markup });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);

  const current = svg?.url === url ? svg.markup : null;
  const filename = `zaweli-${slug}`;

  const png = async () => {
    const QR = await qrcode();
    download(await QR.toDataURL(url, { ...OPTIONS, width: 1024 }), `${filename}.png`);
  };
  const vector = () => {
    if (!current) return;
    const href = URL.createObjectURL(new Blob([current], { type: "image/svg+xml" }));
    download(href, `${filename}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:text-left">
      <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
        {current && (
          // eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur, pas d'optimisation possible
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(current)}`} alt={t.publish.qrAlt} width={160} height={160} className="h-full w-full" />
        )}
      </div>
      <div className="text-center sm:text-left">
        <p className="font-display text-[1.15rem]">{t.publish.qrTitle}</p>
        <p className="mt-1 text-[0.9rem] text-muted">{t.publish.qrLead}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button variant="secondary" onClick={() => void png()} disabled={!current}>
            {t.publish.qrPng}
          </Button>
          <Button variant="quiet" onClick={vector} disabled={!current}>
            {t.publish.qrSvg}
          </Button>
        </div>
      </div>
    </div>
  );
}
