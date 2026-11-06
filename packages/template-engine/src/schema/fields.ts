/**
 * DSL des champs de personnalisation.
 *
 * Chaque constructeur produit une description SÉRIALISABLE (JSON) : elle est
 * stockée dans app.template_versions.manifest et sert à générer :
 *  1. le schéma Zod de validation du contenu (API = autorité, web = confort) ;
 *  2. le formulaire de l'assistant de création ;
 *  3. les contrôles avant publication.
 *
 * Il n'existe volontairement AUCUN champ « HTML libre », « couleur libre »
 * ou « position » : l'utilisateur personnalise, il n'édite pas (principe P1).
 */
import type { GiftType } from "@zaweli/shared-types";

type Base = { label: string; help?: string };

export type ShortTextField = Base & {
  kind: "shortText";
  required: boolean;
  min: number;
  max: number;
  aiAssist: boolean;
};

export type LongTextField = Base & {
  kind: "longText";
  required: boolean;
  min: number;
  max: number;
  aiAssist: boolean;
};

export type IntegerField = Base & { kind: "integer"; required: boolean; min: number; max: number };

export type SelectField = Base & {
  kind: "select";
  required: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type ToggleField = Base & { kind: "toggle"; default: boolean };

export type PhotoField = Base & {
  kind: "photo";
  required: boolean;
  /** Ratio imposé par le design, ex. "2:3". */
  ratio: `${number}:${number}`;
  altMax: number;
};

export type WordListField = Base & { kind: "wordList"; min: number; max: number; maxEach: number };

export type GiftListField = Base & { kind: "giftList"; min: number; max: number; types: GiftType[] };

/** Énigmes à choix multiple (classe « affective » : débloque une photo et un message). */
export type RiddleListField = Base & {
  kind: "riddleList";
  min: number;
  max: number;
  /** Nombre exact de propositions par énigme. */
  choices: number;
  questionMax: number;
  choiceMax: number;
  hintMax: number;
  revealMax: number;
  photo: { required: boolean; ratio: `${number}:${number}` };
};

/** Liste de paragraphes (ex. les paragraphes d'une lettre). */
export type TextListField = Base & { kind: "textList"; min: number; max: number; maxEach: number };

/** Liste de photos légendées (ex. une galerie). */
export type PhotoListField = Base & { kind: "photoList"; min: number; max: number; captionMax: number };

/** Liste d'entrées titre + texte (ex. une frise chronologique). */
export type EntryListField = Base & { kind: "entryList"; min: number; max: number; titleMax: number; textMax: number };

export type FieldDef =
  | ShortTextField
  | LongTextField
  | IntegerField
  | SelectField
  | ToggleField
  | PhotoField
  | WordListField
  | GiftListField
  | RiddleListField
  | TextListField
  | PhotoListField
  | EntryListField;

export type FieldKind = FieldDef["kind"];

const positive = (n: number, what: string) => {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} doit être un entier positif (reçu ${n})`);
  return n;
};

const bounds = (min: number, max: number, what: string) => {
  positive(min, `${what}.min`);
  positive(max, `${what}.max`);
  if (max < min) throw new Error(`${what} : max (${max}) < min (${min})`);
};

/** Constructeurs du DSL. */
export const f = {
  shortText(o: { label: string; max: number; min?: number; required?: boolean; aiAssist?: boolean; help?: string }): ShortTextField {
    const min = o.min ?? 0;
    bounds(min, o.max, o.label);
    return { kind: "shortText", label: o.label, help: o.help, required: o.required ?? false, min, max: o.max, aiAssist: o.aiAssist ?? false };
  },

  longText(o: { label: string; max: number; min?: number; required?: boolean; aiAssist?: boolean; help?: string }): LongTextField {
    const min = o.min ?? 0;
    bounds(min, o.max, o.label);
    return { kind: "longText", label: o.label, help: o.help, required: o.required ?? false, min, max: o.max, aiAssist: o.aiAssist ?? false };
  },

  integer(o: { label: string; min: number; max: number; required?: boolean; help?: string }): IntegerField {
    if (o.max < o.min) throw new Error(`${o.label} : max < min`);
    return { kind: "integer", label: o.label, help: o.help, required: o.required ?? false, min: o.min, max: o.max };
  },

  select(o: { label: string; options: Array<{ value: string; label: string }>; required?: boolean; help?: string }): SelectField {
    if (o.options.length === 0) throw new Error(`${o.label} : au moins une option`);
    if (new Set(o.options.map((x) => x.value)).size !== o.options.length) throw new Error(`${o.label} : options en double`);
    return { kind: "select", label: o.label, help: o.help, required: o.required ?? false, options: o.options };
  },

  toggle(o: { label: string; default?: boolean; help?: string }): ToggleField {
    return { kind: "toggle", label: o.label, help: o.help, default: o.default ?? false };
  },

  photo(o: { label: string; ratio: `${number}:${number}`; required?: boolean; altMax?: number; help?: string }): PhotoField {
    return { kind: "photo", label: o.label, help: o.help, required: o.required ?? false, ratio: o.ratio, altMax: o.altMax ?? 140 };
  },

  wordList(o: { label: string; exactly?: number; min?: number; max?: number; maxEach: number; help?: string }): WordListField {
    const min = o.exactly ?? o.min ?? 0;
    const max = o.exactly ?? o.max ?? min;
    bounds(min, max, o.label);
    positive(o.maxEach, `${o.label}.maxEach`);
    return { kind: "wordList", label: o.label, help: o.help, min, max, maxEach: o.maxEach };
  },

  giftList(o: { label: string; min: number; max: number; types: GiftType[]; help?: string }): GiftListField {
    bounds(o.min, o.max, o.label);
    if (o.types.length === 0) throw new Error(`${o.label} : au moins un type de cadeau`);
    return { kind: "giftList", label: o.label, help: o.help, min: o.min, max: o.max, types: o.types };
  },

  riddleList(o: {
    label: string;
    min: number;
    max: number;
    choices: number;
    questionMax: number;
    choiceMax: number;
    hintMax: number;
    revealMax: number;
    photo: { required: boolean; ratio: `${number}:${number}` };
    help?: string;
  }): RiddleListField {
    bounds(o.min, o.max, o.label);
    if (o.choices < 2) throw new Error(`${o.label} : au moins 2 propositions`);
    return { kind: "riddleList", ...o };
  },

  textList(o: { label: string; min: number; max: number; maxEach: number; help?: string }): TextListField {
    bounds(o.min, o.max, o.label);
    positive(o.maxEach, `${o.label}.maxEach`);
    return { kind: "textList", ...o };
  },

  photoList(o: { label: string; min: number; max: number; captionMax: number; help?: string }): PhotoListField {
    bounds(o.min, o.max, o.label);
    return { kind: "photoList", ...o };
  },

  entryList(o: { label: string; min: number; max: number; titleMax: number; textMax: number; help?: string }): EntryListField {
    bounds(o.min, o.max, o.label);
    return { kind: "entryList", ...o };
  },
};
