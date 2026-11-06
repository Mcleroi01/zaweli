import { defineManifest, f } from "@zaweli/template-engine/schema";

/**
 * Éclat 1.0.0 — second template officiel, issu de la page réalisée pour Fifi.
 * Récit éditorial et cinématographique, au défilement : introduction en
 * rideau, anniversaire, réussite (facultatif), galerie (facultatif), lettre
 * (facultatif), moment magique (facultatif), final.
 *
 * ⚠ Version publiée = immuable (voir le garde-fou du test).
 */
export const eclatV1 = defineManifest({
  slug: "eclat",
  version: "1.0.0",
  rendererKey: "eclat@1.0.0",
  name: "Éclat",
  category: "felicitations",
  description:
    "Un récit éditorial, comme un film : une ouverture en rideau, un portrait sous arche, une réussite mise en scène, une galerie, une lettre qui se dévoile et un moment magique.",
  audience: "personal",

  steps: [
    { id: "recipient", title: "Pour qui ?", fields: ["firstName", "fullName", "dateLabel", "dateShort"] },
    { id: "intro", title: "L'ouverture", fields: ["introLine1", "introLine2", "introCta"] },
    { id: "portrait", title: "Le portrait", fields: ["birthdayEyebrow", "birthdayTitleTop", "birthdaySubtitle", "birthdayPhoto", "birthdayAccentPhoto"] },
    {
      id: "achievement",
      title: "La réussite",
      fields: [
        "achievementEyebrow",
        "achievementTitle",
        "achievementDay",
        "achievementMonth",
        "achievementYear",
        "achievementParagraphs",
        "achievementTimeline",
        "achievementPhotos",
      ],
    },
    { id: "gallery", title: "La galerie", fields: ["galleryTitle", "galleryIntro", "galleryPhotos"] },
    { id: "letter", title: "La lettre", fields: ["letterTitle", "letterGreeting", "letterParagraphs", "letterSignature"] },
    { id: "magic", title: "Le moment magique", fields: ["magicCta", "magicMessage"] },
    { id: "final", title: "Le final", fields: ["finalLine", "finalTitle", "finalPhoto"] },
  ],

  sections: [
    { id: "birthday", optional: false },
    { id: "achievement", optional: true },
    { id: "gallery", optional: true },
    { id: "letter", optional: true },
    { id: "magic", optional: true },
    { id: "final", optional: false },
  ],

  fields: {
    firstName: f.shortText({ label: "Prénom", required: true, min: 1, max: 20 }),
    fullName: f.shortText({ label: "Nom complet (affiché à la fin)", required: true, max: 48 }),
    dateLabel: f.shortText({ label: "Date en toutes lettres", required: true, max: 32, help: "Ex. « 5 novembre 2026 »" }),
    dateShort: f.shortText({ label: "Date courte", required: true, max: 16, help: "Ex. « 05 · 11 · 2026 »" }),

    introLine1: f.longText({ label: "Première phrase d'ouverture", required: true, max: 140, aiAssist: true }),
    introLine2: f.shortText({ label: "Seconde phrase (contient le prénom)", required: true, max: 80, aiAssist: true }),
    introCta: f.shortText({ label: "Bouton d'ouverture", required: true, max: 32 }),

    birthdayEyebrow: f.shortText({ label: "Surtitre du portrait", required: true, max: 28 }),
    birthdayTitleTop: f.shortText({ label: "Titre au-dessus du prénom", required: true, max: 24, help: "Ex. « Happy Birthday, »" }),
    birthdaySubtitle: f.shortText({ label: "Sous-titre", required: true, max: 120, aiAssist: true }),
    birthdayPhoto: f.photo({ label: "Portrait principal (arche)", ratio: "3:4", required: true }),
    birthdayAccentPhoto: f.photo({ label: "Petit portrait d'accompagnement", ratio: "3:5" }),

    achievementEyebrow: f.shortText({ label: "Surtitre de la réussite", max: 48 }),
    achievementTitle: f.shortText({ label: "Titre de la réussite", max: 90, aiAssist: true }),
    achievementDay: f.shortText({ label: "Jour (grand chiffre)", max: 2 }),
    achievementMonth: f.shortText({ label: "Mois", max: 12 }),
    achievementYear: f.shortText({ label: "Année", max: 4 }),
    achievementParagraphs: f.textList({ label: "Paragraphes", min: 0, max: 4, maxEach: 320 }),
    achievementTimeline: f.entryList({ label: "Frise (étapes)", min: 0, max: 4, titleMax: 28, textMax: 110 }),
    achievementPhotos: f.photoList({ label: "Photos de l'événement", min: 0, max: 3, captionMax: 28 }),

    galleryTitle: f.shortText({ label: "Titre de la galerie", max: 70 }),
    galleryIntro: f.shortText({ label: "Phrase d'introduction", max: 80 }),
    galleryPhotos: f.photoList({ label: "Photos", min: 0, max: 10, captionMax: 36 }),

    letterTitle: f.shortText({ label: "Titre de la lettre", max: 60 }),
    letterGreeting: f.shortText({ label: "Formule d'appel", max: 28, help: "Ex. « Nadia, »" }),
    letterParagraphs: f.textList({ label: "Paragraphes de la lettre", min: 0, max: 12, maxEach: 480 }),
    letterSignature: f.shortText({ label: "Signature", max: 40 }),

    magicCta: f.shortText({ label: "Bouton du moment magique", max: 48 }),
    magicMessage: f.shortText({ label: "Message révélé", max: 110, aiAssist: true }),

    finalLine: f.shortText({ label: "Phrase finale", required: true, max: 130, aiAssist: true }),
    finalTitle: f.shortText({ label: "Titre final", required: true, max: 60, help: "Ex. « Happy Birthday, Nadia. »" }),
    finalPhoto: f.photo({ label: "Photo de fond du final", ratio: "2:3", required: true }),
  },

  // 3 photos de scène + 3 de la réussite + 10 de la galerie.
  media: { maxPhotos: 16 },
  progression: { mode: "sequential", restartable: true },
});

export type EclatManifest = typeof eclatV1;
