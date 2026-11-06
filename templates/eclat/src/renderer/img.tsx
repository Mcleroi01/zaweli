/**
 * Remplace next/image (Éclat est un paquet indépendant de Next.js) :
 * chargement différé, décodage asynchrone, mode « fill » identique.
 */
type Props = {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
};

export function Img({ src, alt, fill, priority, width, height, className = "" }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={fill ? `absolute inset-0 h-full w-full ${className}` : className}
    />
  );
}
