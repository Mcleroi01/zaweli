import Image from "next/image";

/**
 * Cadre de téléphone sobre (pas de faux téléphone détaillé) pour présenter
 * de vraies captures des templates.
 */
export function Phone({
  src,
  alt,
  className = "",
  priority = false,
  sizes = "(max-width: 768px) 60vw, 320px",
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={`relative aspect-[390/844] rounded-[2.4rem] bg-[#0e0a09] p-[0.55rem] shadow-[0_50px_100px_-40px_rgb(26_19_17/0.55),0_30px_60px_-30px_rgb(26_19_17/0.35)] ring-1 ring-black/10 ${className}`}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.9rem]">
        <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover object-top" />
      </div>
      <span aria-hidden="true" className="absolute top-[1.1rem] left-1/2 h-[0.9rem] w-[26%] -translate-x-1/2 rounded-full bg-[#0e0a09]" />
    </div>
  );
}
