"use client";

import { useRuntime } from "@zaweli/template-engine/react";
import type { PublicCaptionedPhoto, PublicPhoto } from "@zaweli/template-engine/schema";

/**
 * Adaptateur de données d'Éclat : reconstruit, à partir de la charge
 * publique, l'objet de contenu qu'utilisaient les scènes du projet Fifi.
 * Les scènes gardent ainsi leur code d'origine ; seule la source change
 * (des champs validés au lieu de constantes).
 */
export type Photo = { src: string; alt: string; width: number; height: number };
export type GallerySize = "feature" | "tall" | "small" | "wide";
export type GalleryItem = Photo & { caption: string; size: GallerySize; cutout?: boolean; type?: "image" | "video"; poster?: string };

/** Disposition éditoriale asymétrique, appliquée selon la position de la photo. */
const GALLERY_PATTERN: GallerySize[] = ["feature", "tall", "small", "tall", "wide", "small", "small", "tall", "wide", "small"];

const toPhoto = (p: PublicPhoto): Photo => ({ src: p.src, alt: p.alt, width: p.width ?? 1200, height: p.height ?? 1600 });

export function useEclatContent() {
  const { field, isSectionEnabled } = useRuntime();
  const text = (id: string, fallback = "") => field<string>(id) ?? fallback;
  const list = <T,>(id: string) => field<T[]>(id) ?? [];

  const firstName = text("firstName");
  const photo = (id: string) => {
    const p = field<PublicPhoto>(id);
    return p ? toPhoto(p) : undefined;
  };

  const ORDER = ["birthday", "achievement", "gallery", "letter", "magic", "final"];
  const active = ORDER.filter(isSectionEnabled);
  /** Numéro de chapitre (« 01 », « 02 »…) calculé sur les seules sections affichées. */
  const chapter = (id: string) => String(active.indexOf(id) + 1).padStart(2, "0");

  return {
    enabled: isSectionEnabled,
    chapter,
    person: { firstName, fullName: text("fullName", firstName) },
    dates: { birthdayLabel: text("dateLabel"), birthdayShort: text("dateShort") },
    intro: { line1: text("introLine1"), line2: text("introLine2"), cta: text("introCta", "Découvrir ta surprise") },
    birthday: {
      eyebrow: text("birthdayEyebrow"),
      titleTop: text("birthdayTitleTop"),
      titleName: firstName,
      subtitle: text("birthdaySubtitle"),
      photo: photo("birthdayPhoto")!,
      accent: photo("birthdayAccentPhoto"),
    },
    achievement: {
      eyebrow: text("achievementEyebrow"),
      title: text("achievementTitle"),
      dateDay: text("achievementDay"),
      dateMonth: text("achievementMonth"),
      dateYear: text("achievementYear"),
      paragraphs: list<string>("achievementParagraphs"),
      timeline: list<{ title: string; text: string }>("achievementTimeline").map((e) => ({ label: e.title, text: e.text })),
      photos: list<PublicCaptionedPhoto>("achievementPhotos").map((p) => ({ ...toPhoto(p), caption: p.caption ?? "" })),
    },
    gallery: {
      eyebrow: "Galerie",
      title: text("galleryTitle"),
      intro: text("galleryIntro", "Touche une photo pour l'ouvrir en grand."),
      items: list<PublicCaptionedPhoto>("galleryPhotos").map<GalleryItem>((p, i) => ({
        ...toPhoto(p),
        caption: p.caption ?? "",
        size: GALLERY_PATTERN[i % GALLERY_PATTERN.length]!,
      })),
    },
    letter: {
      eyebrow: text("letterTitle"),
      greeting: text("letterGreeting"),
      paragraphs: list<string>("letterParagraphs"),
      signature: text("letterSignature"),
    },
    magic: {
      eyebrow: "Un petit moment magique",
      cta: text("magicCta"),
      message: text("magicMessage"),
      again: "Encore une fois",
    },
    final: {
      line: text("finalLine"),
      title: text("finalTitle"),
      date: text("dateLabel"),
      restart: "Revivre l'expérience",
      photo: photo("finalPhoto")!,
    },
  };
}

export type EclatContent = ReturnType<typeof useEclatContent>;
