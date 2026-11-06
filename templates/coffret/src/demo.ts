import type { PublicGift, PublicPayload, PublicPhoto } from "@zaweli/template-engine/schema";
import { riddleAnswerHash } from "@zaweli/template-engine/schema";
import { coffretV1 } from "./manifest.js";

/**
 * Contenu de DÉMONSTRATION de Coffret.
 *
 * Il reprend les textes de Pauline, mais AUCUNE photo réelle : les visuels
 * sont des illustrations générées (décision D4/C16 : jamais de photos
 * personnelles dans une démonstration publique). Le prénom est fictif.
 */
const illustration = (label: string, hue: number): PublicPhoto => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
<defs>
<radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="hsl(${hue} 45% 62%)"/><stop offset="1" stop-color="hsl(${hue} 55% 18%)"/></radialGradient>
<linearGradient id="o" x1="0" x2="1"><stop offset="0" stop-color="#a8782e"/><stop offset=".5" stop-color="#f3dc9e"/><stop offset="1" stop-color="#b8862f"/></linearGradient>
</defs>
<rect width="600" height="800" fill="url(#g)"/>
<circle cx="300" cy="300" r="120" fill="none" stroke="url(#o)" stroke-width="3" opacity=".8"/>
<circle cx="300" cy="300" r="70" fill="url(#o)" opacity=".18"/>
<path d="M300 220c-30 40-30 120 0 160c30-40 30-120 0-160z" fill="url(#o)" opacity=".55"/>
<text x="300" y="560" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#f6efe3" opacity=".85">${label}</text>
<text x="300" y="610" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#f3d58d" opacity=".7">Illustration de démonstration</text>
</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, alt: `Illustration de démonstration : ${label}`, width: 600, height: 800 };
};

const DEMO_SALT = "demo-coffret-1.0.0";

const gifts: PublicGift[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    type: "VOUCHER",
    status: "ANNOUNCED",
    data: { title: "Une journée entière où c'est toi qui décides de tout." },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    type: "INVITATION",
    status: "ANNOUNCED",
    data: { title: "Un dîner, rien que nous deux", place: "Le restaurant de ton choix", date: "2026-11-14", time: "19:30" },
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    type: "MONEY",
    status: "ANNOUNCED",
    data: { amount: 50, currency: "USD", receptionMode: "in_person", message: "Pour te faire plaisir, sans te justifier." },
  },
];

/** Construit la charge publique de démonstration (même format qu'une vraie expérience). */
export async function coffretDemoPayload(): Promise<PublicPayload> {
  const riddles = [
    {
      question: "Plus on en a, plus on brille. On en ajoute une chaque année, et aujourd'hui, c'est la tienne qui s'allume.",
      choices: ["Une étoile", "Une bougie", "Une perle"],
      answer: 1,
      hint: "Indice : regarde la date d'aujourd'hui.",
      photo: illustration("Une bougie", 20),
      reveal: "Une bougie de plus, et toujours autant d'éclat.",
    },
    {
      question: "Je ne coûte rien et pourtant je vaux tout. Je passe d'une personne à l'autre sans jamais me perdre. Chez toi, je suis contagieux.",
      choices: ["Un secret", "Ton sourire", "Un compliment"],
      answer: 1,
      hint: "Indice : tu le portes sur presque toutes tes photos.",
      photo: illustration("Ton sourire", 340),
      reveal: "Ton sourire. Celui qui fait du bien à tout le monde.",
    },
    {
      question: "On me prépare en cachette, on m'habille avec soin, et je n'existe vraiment qu'à l'instant où tu m'ouvres.",
      choices: ["Un rêve", "Un cadeau", "Une porte"],
      answer: 1,
      hint: "Indice : il y en a trois qui t'attendent juste après.",
      photo: illustration("Un cadeau", 45),
      reveal: "Un cadeau. Et il y en a trois pour toi.",
    },
  ];

  return {
    schema: 1,
    rendererKey: coffretV1.rendererKey,
    salt: DEMO_SALT,
    disabledSections: [],
    fields: {
      name: "Amani",
      sealCard: "Aujourd'hui, tout ce qui se trouve ici t'appartient. Il faudra ouvrir, deviner, et faire éclater quelques ballons.",
      sealCta: "Je suis prête",
      jewelTitle: "Il est fermé depuis ce matin.",
      jewelPhoto: illustration("L'écrin", 350),
      jewelReveal: "Dedans, il n'y avait rien de plus précieux que toi.",
      riddles: await Promise.all(
        riddles.map(async ({ answer, ...r }, index) => ({ ...r, answerHash: await riddleAnswerHash(DEMO_SALT, index, answer) })),
      ),
      giftsTitle: "Trois cadeaux, dans l'ordre que tu veux.",
      gifts,
      celebrationPhoto: illustration("Joyeux anniversaire", 0),
      wishes: ["Joie", "Paix", "Santé", "Audace", "Réussite", "Douceur", "Voyages", "Fous rires"],
      wishesDone: "Que chacun de ces vœux trouve sa place dans ta nouvelle année.",
      finalePhoto: illustration("Avec affection", 330),
      finaleLine: "Que cette nouvelle année te ressemble : belle, forte et lumineuse.",
      finaleLetter:
        "Je voulais t'offrir un moment, pas seulement un message. Un endroit rien qu'à toi, à ouvrir à ton rythme. Tu mérites qu'on prenne le temps de te célébrer.",
      finaleSignoff: "Avec toute mon affection.",
    },
  };
}
