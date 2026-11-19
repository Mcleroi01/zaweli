import type { Locale } from "@zaweli/shared-types";

/**
 * Libellés de l'assistant de création dans les langues autres que le français.
 * Les manifestes (immuables, versionnés) sont rédigés en français : leurs
 * libellés servent de repli. Clés : `<modèle>.<champ|étape|section>`.
 */
type Labels = { steps: Record<string, string>; sections: Record<string, string>; fields: Record<string, { label: string; help?: string }> };

const EN: Record<string, Labels> = {
  coffret: {
    steps: {
      recipient: "Who is it for?",
      envelope: "The envelope",
      jewel: "The jewel box",
      riddles: "The riddles",
      gifts: "The gifts",
      celebration: "The wishes",
      letter: "The letter",
    },
    sections: { jewel: "jewel box", riddles: "riddles", gifts: "gifts", celebration: "celebration", finale: "finale" },
    fields: {
      name: { label: "First name of the person celebrated" },
      age: { label: "Age (optional)" },
      from: { label: "Your signature (optional)" },
      sealCard: { label: "Text of the card in the envelope", help: "E.g. “Today, everything in here is yours. You'll have to open, guess and pop a few balloons.”" },
      sealCta: { label: "Entry button", help: "E.g. “I'm ready”" },
      jewelTitle: { label: "Jewel box title" },
      jewelPhoto: { label: "Photo revealed by the jewel box" },
      jewelReveal: { label: "Sentence revealed with the photo" },
      riddles: { label: "Riddles" },
      giftsTitle: { label: "Gifts title" },
      gifts: { label: "Gifts to unwrap" },
      celebrationPhoto: { label: "Celebration photo" },
      wishes: { label: "The 8 wishes hidden in the balloons" },
      wishesDone: { label: "Sentence after the last balloon" },
      finalePhoto: { label: "Letter photo" },
      finaleLine: { label: "Sentence under the first name" },
      finaleLetter: { label: "The letter" },
      finaleSignoff: { label: "Closing words" },
    },
  },
  eclat: {
    steps: {
      recipient: "Who is it for?",
      intro: "The opening",
      portrait: "The portrait",
      achievement: "The achievement",
      gallery: "The gallery",
      letter: "The letter",
      magic: "The magic moment",
      final: "The finale",
    },
    sections: { birthday: "portrait", achievement: "achievement", gallery: "gallery", letter: "letter", magic: "magic moment", final: "finale" },
    fields: {
      firstName: { label: "First name" },
      fullName: { label: "Full name (shown at the end)" },
      dateLabel: { label: "Date written out", help: "E.g. “5 November 2026”" },
      dateShort: { label: "Short date", help: "E.g. “05 · 11 · 2026”" },
      introLine1: { label: "First opening sentence" },
      introLine2: { label: "Second sentence (includes the first name)" },
      introCta: { label: "Opening button" },
      birthdayEyebrow: { label: "Portrait kicker" },
      birthdayTitleTop: { label: "Title above the first name", help: "E.g. “Happy Birthday,”" },
      birthdaySubtitle: { label: "Subtitle" },
      birthdayPhoto: { label: "Main portrait (arch)" },
      birthdayAccentPhoto: { label: "Small accompanying portrait" },
      achievementEyebrow: { label: "Achievement kicker" },
      achievementTitle: { label: "Achievement title" },
      achievementDay: { label: "Day (large number)" },
      achievementMonth: { label: "Month" },
      achievementYear: { label: "Year" },
      achievementParagraphs: { label: "Paragraphs" },
      achievementTimeline: { label: "Timeline (steps)" },
      achievementPhotos: { label: "Photos of the event" },
      galleryTitle: { label: "Gallery title" },
      galleryIntro: { label: "Introduction sentence" },
      galleryPhotos: { label: "Photos" },
      letterTitle: { label: "Letter title" },
      letterGreeting: { label: "Greeting", help: "E.g. “Nadia,”" },
      letterParagraphs: { label: "Letter paragraphs" },
      letterSignature: { label: "Signature" },
      magicCta: { label: "Magic moment button" },
      magicMessage: { label: "Revealed message" },
      finalLine: { label: "Final sentence" },
      finalTitle: { label: "Final title", help: "E.g. “Happy Birthday, Nadia.”" },
      finalPhoto: { label: "Finale background photo" },
    },
  },
};

/** En français, seuls les noms de scènes manquent aux manifestes (« Inclure l'écrin »). */
const FR: Record<string, Labels> = {
  coffret: { steps: {}, fields: {}, sections: { jewel: "l'écrin", riddles: "les énigmes", gifts: "les cadeaux", celebration: "la fête", finale: "la lettre" } },
  eclat: {
    steps: {},
    fields: {},
    sections: { birthday: "le portrait", achievement: "la réussite", gallery: "la galerie", letter: "la lettre", magic: "le moment magique", final: "le final" },
  },
};

const BY_LOCALE: Record<Locale, Record<string, Labels>> = { fr: FR, en: EN };

export function templateLabels(locale: Locale, slug: string) {
  const labels = BY_LOCALE[locale][slug];
  const translated = locale !== "fr";
  return {
    step: (id: string, fallback: string) => labels?.steps[id] ?? fallback,
    section: (id: string) => labels?.sections[id] ?? id,
    field: (id: string, fallback: { label: string; help?: string }) => ({
      label: labels?.fields[id]?.label ?? fallback.label,
      help: translated && labels?.fields[id] ? labels.fields[id].help : fallback.help,
    }),
  };
}
