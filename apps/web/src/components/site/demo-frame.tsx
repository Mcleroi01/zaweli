"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La démonstration RÉELLE du modèle, jouable dans un cadre de téléphone.
 * Iframe à la taille d'un téléphone (390 × 844), mise à l'échelle du cadre.
 * Isolée : ses styles et ses animations ne touchent pas la page.
 */
export function DemoFrame({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setScale(entry.contentRect.width / 390));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative aspect-[390/844] rounded-[2.4rem] bg-[#0e0a09] p-[0.55rem] shadow-[0_60px_120px_-50px_rgb(26_19_17/0.6)] ring-1 ring-black/10">
      <div ref={box} className="relative h-full w-full overflow-hidden rounded-[1.9rem] bg-[#1a0d0f]">
        {scale > 0 && (
          <iframe
            src={src}
            title={title}
            loading="lazy"
            className="absolute top-0 left-0 origin-top-left border-0"
            style={{ width: 390, height: 844, transform: `scale(${scale})` }}
          />
        )}
      </div>
    </div>
  );
}
