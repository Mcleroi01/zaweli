import type { PublicCaptionedPhoto, PublicPayload } from "@zaweli/template-engine/schema";
import { eclatV1 } from "./manifest.js";

/**
 * Démonstration d'Éclat. Personnage fictif (« Nadia »), textes génériques,
 * et AUCUNE photo réelle : des compositions graphiques générées tiennent
 * lieu de photos (décision C16, en attendant des visuels sous licence).
 */
const art = (label: string, tone: "ivory" | "rose" | "wine" | "gold", w = 900, h = 1200): PublicCaptionedPhoto => {
  const palettes = {
    ivory: ["#f6eee3", "#e8d6c2", "#5c1020"],
    rose: ["#f0d3cd", "#c98a8f", "#5c1020"],
    wine: ["#5c1020", "#2a0a12", "#dcc08c"],
    gold: ["#ecd9b2", "#c9a66b", "#2a0a12"],
  }[tone];
  const [a, b, ink] = palettes;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width="2">
<path d="M${w * 0.22} ${h * 0.86} V${h * 0.42} a${w * 0.28} ${w * 0.28} 0 0 1 ${w * 0.56} 0 V${h * 0.86}"/>
<path d="M${w * 0.3} ${h * 0.86} V${h * 0.45} a${w * 0.2} ${w * 0.2} 0 0 1 ${w * 0.4} 0 V${h * 0.86}"/>
</g>
<circle cx="${w * 0.5}" cy="${h * 0.42}" r="${w * 0.07}" fill="${ink}" fill-opacity=".14"/>
<text x="${w / 2}" y="${h * 0.93}" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="${w * 0.045}" fill="${ink}" fill-opacity=".7">${label}</text>
</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, alt: `Composition de démonstration : ${label}`, width: w, height: h };
};

export async function eclatDemoPayload(): Promise<PublicPayload> {
  return {
    schema: 1,
    rendererKey: eclatV1.rendererKey,
    salt: "demo-eclat-1.0.0",
    disabledSections: [],
    fields: {
      firstName: "Nadia",
      fullName: "Nadia Kalala",
      dateLabel: "12 décembre 2026",
      dateShort: "12 · 12 · 2026",

      introLine1: "Certaines personnes rendent le monde un peu plus beau simplement par leur présence…",
      introLine2: "Aujourd'hui, cette histoire est pour toi, Nadia.",
      introCta: "Découvrir ta surprise",

      birthdayEyebrow: "12 décembre",
      birthdayTitleTop: "Joyeux anniversaire,",
      birthdaySubtitle: "Une journée pour célébrer une personne qui mérite de belles choses.",
      birthdayPhoto: art("Portrait", "rose", 900, 1300),
      birthdayAccentPhoto: art("Détail", "ivory", 600, 1000),

      achievementEyebrow: "Une étape, un parcours, une réussite",
      achievementTitle: "Et si l'on célébrait aussi tout le chemin parcouru ?",
      achievementDay: "28",
      achievementMonth: "novembre",
      achievementYear: "2026",
      achievementParagraphs: [
        "Le 28 novembre, tu as franchi une étape importante : ton diplôme, après des années de travail.",
        "Derrière cette réussite, il y a des efforts, des doutes surmontés et beaucoup de détermination.",
        "Sois fière de toi. Tu as accompli quelque chose d'important.",
        "Que cette nouvelle étape t'ouvre des portes encore plus belles.",
      ],
      achievementTimeline: [
        { title: "Les années d'études", text: "Des efforts, des doutes, et beaucoup de détermination." },
        { title: "28 novembre 2026", text: "Le diplôme. Un chapitre se referme." },
        { title: "12 décembre 2026", text: "Ton anniversaire. Une nouvelle année commence." },
        { title: "Et maintenant", text: "De nouvelles portes, encore plus belles." },
      ],
      achievementPhotos: [
        { ...art("Le grand jour", "gold", 900, 1200), caption: "Le grand jour" },
        { ...art("Félicitations", "ivory", 1200, 900), caption: "Félicitations" },
        { ...art("Le sourire d'après", "rose", 1200, 900), caption: "Le sourire d'après" },
      ],

      galleryTitle: "Une galerie qui raconte une histoire",
      galleryIntro: "Touche une image pour l'ouvrir en grand.",
      galleryPhotos: [
        { ...art("Lumière", "rose", 1000, 1400), caption: "Lumière" },
        { ...art("Douceur", "ivory", 600, 1000), caption: "Douceur" },
        { ...art("Élégance", "gold", 800, 1000), caption: "Élégance" },
        { ...art("Un éclat de rire", "wine", 600, 1000), caption: "Un éclat de rire" },
        { ...art("Ensemble", "ivory", 1200, 800), caption: "Ensemble" },
        { ...art("Assurance", "rose", 800, 1000), caption: "Assurance" },
      ],

      letterTitle: "Quelques mots, rien que pour toi",
      letterGreeting: "Nadia,",
      letterParagraphs: [
        "Je voulais t'offrir un moment, pas seulement un message.",
        "Cette année t'a demandé beaucoup, et tu as tenu bon. Je t'ai vue avancer, douter parfois, puis repartir plus forte.",
        "Je suis fier de toi, et heureux de pouvoir te le dire aujourd'hui.",
        "Je te souhaite une année pleine de paix, de belles surprises et de raisons de sourire.",
        "Joyeux anniversaire.",
      ],
      letterSignature: "Avec affection.",

      magicCta: "J'ai encore une petite surprise pour toi",
      magicMessage: "N'oublie jamais à quel point tu es capable de belles choses.",

      finalLine: "Que cette nouvelle année de ta vie soit aussi belle que les rêves que tu portes en toi.",
      finalTitle: "Joyeux anniversaire, Nadia.",
      finalPhoto: art("Pour toujours", "wine", 900, 1350),
    },
  };
}
