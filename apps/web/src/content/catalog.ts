import { coffretV1 } from "@zaweli/template-coffret";
import { eclatV1 } from "@zaweli/template-eclat";
import type { TemplateManifest } from "@zaweli/template-engine/schema";

/**
 * Catalogue public. Le texte éditorial est écrit ici ; les caractéristiques
 * (photos, étapes, sections facultatives, cadeaux) sont CALCULÉES à partir
 * du manifeste : le site ne peut pas promettre ce que le modèle ne permet pas.
 */
export type Screen = { src: string; alt: string };

export type CatalogEntry = {
  slug: string;
  manifest: TemplateManifest;
  name: string;
  tagline: string;
  occasion: string;
  pitch: string;
  /** Teinte d'accent de la fiche (couleur du template, pas du SaaS). */
  tone: { bg: string; ink: string; accent: string };
  cover: Screen;
  screens: Screen[];
  highlights: Array<{ title: string; text: string }>;
};

const GIFT_LABELS: Record<string, string> = {
  MONEY: "argent (promesse)",
  PHYSICAL: "objet",
  INVITATION: "invitation",
  VOUCHER: "bon cadeau",
  EXPERIENCE: "expérience",
};

export const catalog: CatalogEntry[] = [
  {
    slug: "coffret",
    manifest: coffretV1,
    name: "Coffret",
    tagline: "Un écrin de joaillerie à ouvrir, étape par étape.",
    occasion: "Anniversaire",
    pitch:
      "Une enveloppe scellée à la cire, un écrin laqué, des énigmes qui retournent leur carte sur une photo, des paquets à déballer, une bougie à souffler et huit ballons qui cachent chacun un vœu. Chaque étape reste secrète tant que la précédente n'est pas ouverte.",
    tone: { bg: "#3a0710", ink: "#f6efe3", accent: "#d9ac55" },
    cover: { src: "/showcase/coffret-seal.webp", alt: "Coffret : l'enveloppe scellée d'un sceau de cire doré" },
    screens: [
      { src: "/showcase/coffret-seal.webp", alt: "L'enveloppe scellée" },
      { src: "/showcase/coffret-jewel.webp", alt: "L'écrin ouvert sur une photo en arche dorée" },
      { src: "/showcase/coffret-riddle.webp", alt: "Une énigme retournée sur sa photo" },
      { src: "/showcase/coffret-gifts.webp", alt: "Trois paquets déballés et leurs cadeaux" },
      { src: "/showcase/coffret-party.webp", alt: "Le titre « Joyeux anniversaire » et les ballons" },
      { src: "/showcase/coffret-letter.webp", alt: "La lettre de fin, signée" },
    ],
    highlights: [
      { title: "Un sceau à briser", text: "Le premier geste du destinataire ouvre l'enveloppe et lance le son." },
      { title: "Des énigmes", text: "Une bonne réponse retourne la carte sur une photo et un mot." },
      { title: "Des paquets", text: "Chaque paquet contient un vrai cadeau typé, présenté honnêtement." },
      { title: "Une bougie, huit vœux", text: "On souffle, puis chaque ballon éclaté libère un souhait." },
    ],
  },
  {
    slug: "eclat",
    manifest: eclatV1,
    name: "Éclat",
    tagline: "Un récit éditorial, comme un film qu'on fait défiler.",
    occasion: "Anniversaire & réussite",
    pitch:
      "Une ouverture en rideau, un portrait sous arche, une réussite racontée avec sa date et sa frise, une galerie qui s'ouvre en grand, une lettre qui se dévoile ligne par ligne, puis un moment magique. Pensé pour célébrer une personne et tout le chemin parcouru.",
    tone: { bg: "#140709", ink: "#f4ece1", accent: "#dcc08c" },
    cover: { src: "/showcase/eclat-hero.webp", alt: "Éclat : « Joyeux anniversaire, Nadia » et un portrait sous arche" },
    screens: [
      { src: "/showcase/eclat-intro.webp", alt: "L'ouverture : une phrase, puis le prénom" },
      { src: "/showcase/eclat-hero.webp", alt: "Le portrait sous arche" },
      { src: "/showcase/eclat-achievement.webp", alt: "La réussite et sa date monumentale" },
      { src: "/showcase/eclat-timeline.webp", alt: "La frise du chemin parcouru" },
      { src: "/showcase/eclat-letter.webp", alt: "La lettre sur papier ivoire" },
      { src: "/showcase/eclat-final.webp", alt: "Le final, signé" },
    ],
    highlights: [
      { title: "Une ouverture en rideau", text: "Deux phrases, puis un trait doré qui ouvre la scène." },
      { title: "Une réussite datée", text: "Un diplôme, une étape, avec sa frise et ses photos." },
      { title: "Une galerie", text: "Jusqu'à dix photos légendées, à ouvrir en plein écran." },
      { title: "Une lettre", text: "Elle s'écrit sous les yeux du destinataire, à son rythme." },
    ],
  },
];

export const findTemplate = (slug: string) => catalog.find((t) => t.slug === slug);

/** Caractéristiques lues dans le manifeste. */
export function specs(manifest: TemplateManifest) {
  const fields = Object.values(manifest.fields);
  const gift = fields.find((f) => f.kind === "giftList");
  const riddles = fields.find((f) => f.kind === "riddleList");
  return {
    steps: manifest.steps.map((s) => s.title),
    maxPhotos: manifest.media.maxPhotos,
    optionalSections: manifest.sections.filter((s) => s.optional).length,
    riddles: riddles && riddles.kind === "riddleList" ? `${riddles.min} à ${riddles.max}` : null,
    gifts:
      gift && gift.kind === "giftList"
        ? { range: `${gift.min} à ${gift.max}`, types: gift.types.map((t) => GIFT_LABELS[t] ?? t) }
        : null,
    aiFields: fields.filter((f) => "aiAssist" in f && f.aiAssist).length,
    version: manifest.version,
  };
}
