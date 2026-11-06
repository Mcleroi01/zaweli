import { defineManifest, f } from "@zaweli/template-engine/schema";

/**
 * Coffret 1.0.0 — premier template officiel ZAWELI, issu du projet Pauline.
 *
 * Chaque clé de l'ancien `src/content.js` est devenue un champ DÉCLARÉ.
 * Les libellés d'interface fixes du design (« Touche le sceau »,
 * « Continuer », « Il est temps. »…) restent dans le template : ils ne
 * sont pas personnalisables.
 *
 * ⚠ Version publiée = immuable. Toute modification exige une nouvelle
 * version (1.0.1, 1.1.0…) et un nouveau dossier de renderer si le rendu change.
 */
export const coffretV1 = defineManifest({
  slug: "coffret",
  version: "1.0.0",
  rendererKey: "coffret@1.0.0",
  name: "Coffret",
  category: "anniversaire",
  description:
    "Un coffret de haute joaillerie à ouvrir étape par étape : enveloppe scellée, écrin, énigmes, cadeaux à déballer, bougie à souffler et ballons à éclater.",
  audience: "personal",

  steps: [
    { id: "recipient", title: "Pour qui ?", fields: ["name", "age", "from"] },
    { id: "envelope", title: "L'enveloppe", fields: ["sealCard", "sealCta"] },
    { id: "jewel", title: "L'écrin", fields: ["jewelTitle", "jewelPhoto", "jewelReveal"] },
    { id: "riddles", title: "Les énigmes", fields: ["riddles"] },
    { id: "gifts", title: "Les cadeaux", fields: ["giftsTitle", "gifts"] },
    { id: "celebration", title: "Les vœux", fields: ["celebrationPhoto", "wishes", "wishesDone"] },
    { id: "letter", title: "La lettre", fields: ["finalePhoto", "finaleLine", "finaleLetter", "finaleSignoff"] },
  ],

  sections: [
    { id: "jewel", optional: true },
    { id: "riddles", optional: true },
    { id: "gifts", optional: true },
    { id: "celebration", optional: false },
    { id: "finale", optional: false },
  ],

  fields: {
    name: f.shortText({ label: "Prénom de la personne fêtée", required: true, min: 1, max: 24 }),
    age: f.integer({ label: "Âge (facultatif)", min: 1, max: 120 }),
    from: f.shortText({ label: "Ta signature (facultatif)", max: 40 }),

    sealCard: f.longText({
      label: "Texte de la carte dans l'enveloppe",
      required: true,
      max: 200,
      aiAssist: true,
      help: "Ex. « Aujourd'hui, tout ce qui se trouve ici t'appartient. Il faudra ouvrir, deviner, et faire éclater quelques ballons. »",
    }),
    sealCta: f.shortText({ label: "Bouton d'entrée", required: true, max: 24, help: "Ex. « Je suis prête »" }),

    jewelTitle: f.shortText({ label: "Titre de l'écrin", required: true, max: 60, aiAssist: true }),
    jewelPhoto: f.photo({ label: "Photo révélée par l'écrin", ratio: "3:4", required: true }),
    jewelReveal: f.shortText({ label: "Phrase révélée avec la photo", required: true, max: 90, aiAssist: true }),

    riddles: f.riddleList({
      label: "Énigmes",
      min: 1,
      max: 3,
      choices: 3,
      questionMax: 220,
      choiceMax: 30,
      hintMax: 100,
      revealMax: 80,
      photo: { required: true, ratio: "2:3" },
    }),

    giftsTitle: f.shortText({ label: "Titre des cadeaux", required: true, max: 60 }),
    gifts: f.giftList({
      label: "Cadeaux à déballer",
      min: 1,
      max: 3,
      types: ["MONEY", "PHYSICAL", "INVITATION", "VOUCHER", "EXPERIENCE"],
    }),

    celebrationPhoto: f.photo({ label: "Photo de la célébration", ratio: "3:4", required: true }),
    wishes: f.wordList({ label: "Les 8 vœux cachés dans les ballons", exactly: 8, maxEach: 14 }),
    wishesDone: f.shortText({ label: "Phrase après le dernier ballon", required: true, max: 120, aiAssist: true }),

    finalePhoto: f.photo({ label: "Photo de la lettre", ratio: "3:4", required: true }),
    finaleLine: f.shortText({ label: "Phrase sous le prénom", required: true, max: 120, aiAssist: true }),
    finaleLetter: f.longText({ label: "La lettre", required: true, min: 20, max: 600, aiAssist: true }),
    finaleSignoff: f.shortText({ label: "Formule de fin", required: true, max: 60 }),
  },

  // 3 photos de scène + 1 par énigme (3 au plus).
  media: { maxPhotos: 6 },
  progression: { mode: "sequential", restartable: true },
});

export type CoffretManifest = typeof coffretV1;
