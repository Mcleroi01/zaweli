import type { GiftType } from "@zaweli/shared-types";

/**
 * Textes du site public, en français (langue de référence).
 * Le type `Dictionary` est déduit de ce fichier : chaque autre langue doit
 * fournir exactement les mêmes clés, sinon la compilation échoue.
 * Les titres contenant une mise en forme (<em>) sont des éléments React.
 */

export type TemplateSlug = "coffret" | "eclat";

/** Identifiants des étapes déclarées par les manifestes des modèles. */
export type StepId =
  | "recipient"
  | "envelope"
  | "jewel"
  | "riddles"
  | "gifts"
  | "celebration"
  | "letter"
  | "intro"
  | "portrait"
  | "achievement"
  | "gallery"
  | "magic"
  | "final";

/** Six écrans par modèle, dans l'ordre de `catalog.ts`. */
type Six<T> = readonly [T, T, T, T, T, T];

export type TemplateCopy = {
  name: string;
  tagline: string;
  occasion: string;
  pitch: string;
  coverAlt: string;
  screenAlts: Six<string>;
  highlights: ReadonlyArray<{ title: string; text: string }>;
};

const catalog: Record<TemplateSlug, TemplateCopy> = {
  coffret: {
    name: "Coffret",
    tagline: "Un écrin de joaillerie à ouvrir, étape par étape.",
    occasion: "Anniversaire",
    pitch:
      "Une enveloppe scellée à la cire, un écrin laqué, des énigmes qui retournent leur carte sur une photo, des paquets à déballer, une bougie à souffler et huit ballons qui cachent chacun un vœu. Chaque étape reste secrète tant que la précédente n'est pas ouverte.",
    coverAlt: "Coffret : l'enveloppe scellée d'un sceau de cire doré",
    screenAlts: [
      "L'enveloppe scellée",
      "L'écrin ouvert sur une photo en arche dorée",
      "Une énigme retournée sur sa photo",
      "Trois paquets déballés et leurs cadeaux",
      "Le titre « Joyeux anniversaire » et les ballons",
      "La lettre de fin, signée",
    ],
    highlights: [
      { title: "Un sceau à briser", text: "Le premier geste du destinataire ouvre l'enveloppe et lance le son." },
      { title: "Des énigmes", text: "Une bonne réponse retourne la carte sur une photo et un mot." },
      { title: "Des paquets", text: "Chaque paquet contient un vrai cadeau typé, présenté honnêtement." },
      { title: "Une bougie, huit vœux", text: "On souffle, puis chaque ballon éclaté libère un souhait." },
    ],
  },
  eclat: {
    name: "Éclat",
    tagline: "Un récit éditorial, comme un film qu'on fait défiler.",
    occasion: "Anniversaire & réussite",
    pitch:
      "Une ouverture en rideau, un portrait sous arche, une réussite racontée avec sa date et sa frise, une galerie qui s'ouvre en grand, une lettre qui se dévoile ligne par ligne, puis un moment magique. Pensé pour célébrer une personne et tout le chemin parcouru.",
    coverAlt: "Éclat : « Joyeux anniversaire, Nadia » et un portrait sous arche",
    screenAlts: [
      "L'ouverture : une phrase, puis le prénom",
      "Le portrait sous arche",
      "La réussite et sa date monumentale",
      "La frise du chemin parcouru",
      "La lettre sur papier ivoire",
      "Le final, signé",
    ],
    highlights: [
      { title: "Une ouverture en rideau", text: "Deux phrases, puis un trait doré qui ouvre la scène." },
      { title: "Une réussite datée", text: "Un diplôme, une étape, avec sa frise et ses photos." },
      { title: "Une galerie", text: "Jusqu'à dix photos légendées, à ouvrir en plein écran." },
      { title: "Une lettre", text: "Elle s'écrit sous les yeux du destinataire, à son rythme." },
    ],
  },
};

const stepTitles: Record<StepId, string> = {
  recipient: "Pour qui ?",
  envelope: "L'enveloppe",
  jewel: "L'écrin",
  riddles: "Les énigmes",
  gifts: "Les cadeaux",
  celebration: "Les vœux",
  letter: "La lettre",
  intro: "L'ouverture",
  portrait: "Le portrait",
  achievement: "La réussite",
  gallery: "La galerie",
  magic: "Le moment magique",
  final: "Le final",
};

const giftLabels: Record<GiftType, string> = {
  MONEY: "argent (promesse)",
  PHYSICAL: "objet",
  INVITATION: "invitation",
  VOUCHER: "bon cadeau",
  EXPERIENCE: "expérience",
};

export const fr = {
  meta: {
    siteTitle: "Zaweli — Offre un moment, pas seulement un message",
    description:
      "Zaweli met en scène tes mots, tes photos et tes cadeaux dans une expérience à ouvrir, conçue par un studio. Ton destinataire n'a qu'à toucher un lien.",
  },

  /** Sélecteur de langue : nom de chaque langue écrit dans cette langue. */
  language: {
    label: "Langue",
    switchTo: "Version française",
  },

  header: {
    nav: [
      { href: "/modeles", label: "Modèles" },
      { href: "/#parcours", label: "L'expérience" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
    ],
    homeLabel: "Zaweli, accueil",
    mainNav: "Navigation principale",
    mobileNav: "Navigation mobile",
    tryDemo: "Essayer une démo",
    signIn: "Se connecter",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
  },

  footer: {
    pitch: "Des expériences numériques à offrir, conçues par un studio, pour célébrer, surprendre ou remercier.",
    navLabel: "Pied de page",
    columns: [
      {
        title: "Découvrir",
        links: [
          { href: "/modeles", label: "Modèles" },
          { href: "/#parcours", label: "L'expérience" },
          { href: "/tarifs", label: "Tarifs" },
        ],
      },
      {
        title: "Essayer",
        links: [
          { href: "/modeles/coffret/demo", label: "Démo Coffret" },
          { href: "/modeles/eclat/demo", label: "Démo Éclat" },
        ],
      },
      {
        title: "Zaweli",
        links: [
          { href: "/a-propos", label: "À propos" },
          { href: "/contact", label: "Contact" },
          { href: "/questions", label: "Questions" },
        ],
      },
    ],
    status: "État des services",
    copyright: "© 2026 Zaweli",
    studio: "Les modèles sont conçus par le studio Zaweli.",
  },

  specs: {
    photos: "Photos",
    upTo: (n: number) => `Jusqu'à ${n}`,
    steps: "Étapes à remplir",
    gifts: "Cadeaux",
    optionalSections: "Sections facultatives",
    riddles: "Énigmes",
    writingHelp: "Aide à l'écriture",
    texts: (n: number) => `${n} textes`,
    range: (min: number, max: number) => `${min} à ${max}`,
    summary: (photos: number, steps: number, gifts: string | null) =>
      `Jusqu'à ${photos} photos · ${steps} étapes à remplir${gifts ? ` · ${gifts} cadeaux` : ""}`,
  },

  home: {
    kicker: "Expériences numériques à offrir",
    title: (
      <>
        Offre un <span className="whitespace-nowrap"><em>moment</em>,</span> pas seulement un message.
      </>
    ),
    lead: "Zaweli met en scène tes mots, tes photos et tes cadeaux dans une expérience à ouvrir, conçue par un studio. Ton destinataire n'a qu'à toucher un lien.",
    discover: "Découvrir les modèles",
    openDemo: "Ouvrir une démo →",
    heroCoffretAlt: "Le modèle Coffret : une enveloppe scellée",
    heroEclatAlt: "Le modèle Éclat : un portrait sous arche",
    proofs: [
      ["Aucun compte", "pour la personne qui reçoit"],
      ["Un lien et un QR code", "à partager où tu veux"],
      ["Pensé pour le téléphone", "d'abord, puis pour l'écran"],
    ],
    occasionsLabel: "Occasions",
    occasions: ["Anniversaire", "Diplôme", "Déclaration", "Remerciements", "Réussite", "Surprise", "Retrouvailles", "Félicitations"],
    journeyKicker: "(L'expérience)",
    journeyTitle: (
      <>
        Ce n&apos;est pas une carte. C&apos;est quelque chose <em>qu&apos;on ouvre</em>.
      </>
    ),
    journey: [
      {
        title: "Une enveloppe à briser",
        text: "Le premier geste appartient à ton destinataire : il brise le sceau, la carte glisse hors de l'enveloppe.",
        alt: "Enveloppe scellée d'un sceau de cire",
      },
      {
        title: "Un écrin qui s'ouvre",
        text: "Le couvercle se soulève sur une photo, cerclée d'or, et une phrase que tu as choisie.",
        alt: "Écrin ouvert sur une photo",
      },
      {
        title: "Des énigmes à résoudre",
        text: "Trois propositions, une seule juste. La bonne réponse retourne la carte sur un souvenir.",
        alt: "Carte d'énigme retournée sur une photo",
      },
      {
        title: "Des cadeaux à déballer",
        text: "Une invitation, un bon, une promesse : chaque paquet révèle un vrai cadeau, dit avec justesse.",
        alt: "Paquets déballés et tickets cadeaux",
      },
      {
        title: "Une bougie, huit vœux",
        text: "On souffle, les ballons s'envolent. Chacun cache un souhait que tu as écrit.",
        alt: "Joyeux anniversaire et ballons",
      },
      {
        title: "Une lettre pour finir",
        text: "Les derniers mots sont les tiens, signés, à relire autant de fois qu'on veut.",
        alt: "Lettre de fin signée",
      },
    ],
    modelsKicker: "(Les modèles)",
    modelsTitle: (
      <>
        Deux modèles, deux <em>façons</em> de raconter.
      </>
    ),
    modelsLead:
      "Chaque modèle est une œuvre complète : son décor, ses gestes, ses animations. Tu n'as rien à dessiner, seulement à remplir.",
    openTheDemo: "Ouvrir la démo",
    seeDetail: "Voir le détail →",
    giftsKicker: "(Les cadeaux)",
    giftsTitle: (
      <>
        Glisse un <em>vrai</em> cadeau dans le paquet.
      </>
    ),
    giftsLead:
      "Chaque paquet contient un cadeau que tu décris : ton destinataire le découvre en l'ouvrant. Et une promesse reste une promesse : Zaweli n'annonce jamais un transfert qui n'a pas eu lieu.",
    gifts: [
      { name: "Une invitation", example: "« Je t'invite à dîner samedi, 19 h 30. »" },
      { name: "Un bon cadeau", example: "« Bon pour une journée où c'est toi qui décides. »" },
      { name: "Un objet", example: "« Un parfum t'attend. Je te le remets ce week-end. »" },
      { name: "Une expérience", example: "« Un week-end à deux, au bord du lac. »" },
      { name: "Une somme", example: "« Je t'offre 50 USD », présentée comme une promesse." },
    ],
    howKicker: "(En trois temps)",
    howTitle: (
      <>
        Tu remplis. Le modèle <em>met en scène</em>.
      </>
    ),
    how: [
      ["Choisis", "Un modèle pour l'occasion. Ouvre sa démo : c'est exactement ce que verra ton destinataire."],
      ["Personnalise", "Le prénom, tes mots, tes photos, tes cadeaux. Un assistant te guide, étape par étape, sans rien à dessiner."],
      ["Partage", "Tu reçois un lien unique et un QR code. Envoie-le par WhatsApp, par SMS, ou imprime-le sur une carte."],
    ],
    businessKicker: "(Entreprises)",
    business: "Vœux à vos clients, invitations, récompenses d'équipe : un espace dédié aux entreprises est en préparation.",
    businessWhen: "Ouverture après le lancement.",
    faqKicker: "(Questions)",
    faqTitle: (
      <>
        Ce qu&apos;on nous <em>demande</em> souvent.
      </>
    ),
    allQuestions: "Toutes les questions →",
    endTitle: (
      <>
        Il y a quelqu&apos;un à qui tu veux dire <em>quelque chose</em>.
      </>
    ),
    chooseModel: "Choisir un modèle",
    comingSoon: "La création en ligne ouvre prochainement.",
  },

  models: {
    title: "Modèles",
    description: "Les modèles d'expériences Zaweli, conçus et animés par un studio. Ouvre leur démonstration.",
    kicker: "(Modèles)",
    heading: (
      <>
        Choisis <em>l&apos;écrin</em>, nous faisons le reste.
      </>
    ),
    lead: "Chaque modèle a son décor, ses gestes et son rythme. Ouvre sa démonstration : tu verras exactement ce que découvrira la personne qui reçoit. D'autres modèles sont en préparation.",
  },

  model: {
    allModels: "← Tous les modèles",
    create: "Créer avec ce modèle",
    fullscreen: "Ouvrir en plein écran",
    orPlay: "ou joue la démo dans le téléphone →",
    demoTitle: (name: string) => `Démonstration du modèle ${name}`,
    demoNote: "Démonstration réelle, avec des contenus fictifs.",
    customizeKicker: "(Ce que tu personnalises)",
    customizeTitle: (steps: number) => (
      <>
        Un assistant en <em>{steps} étapes</em>. Rien à dessiner.
      </>
    ),
    possibleGifts: (types: string) =>
      `Cadeaux possibles : ${types}. Le paquet et son animation appartiennent au modèle ; tu choisis ce qu'il contient.`,
    another: "Un autre modèle",
  },

  demo: {
    fallbackTitle: "Démonstration",
    title: (name: string) => `Démo ${name}`,
    description: (name: string) =>
      `Ouvre la démonstration du modèle ${name} : exactement ce que verra la personne qui reçoit l'expérience.`,
  },

  pricing: {
    title: "Tarifs",
    description: "Les formules Zaweli : une création offerte, puis Solo, Multi-usage et une formule annuelle.",
    kicker: "(Tarifs)",
    heading: (
      <>
        Une première <em>offerte</em>. Ensuite, selon tes occasions.
      </>
    ),
    lead: "Les prix seront annoncés à l'ouverture de la création en ligne. Paiement prévu par mobile money et par carte.",
    priceLater: "Prix à l'ouverture",
    /** Règles reprises du cahier des charges. AUCUN prix n'est affiché : ils ne sont pas encore fixés. */
    plans: [
      {
        name: "Découverte",
        tag: "Offerte",
        summary: "Ta première expérience, pour essayer.",
        lines: ["Une création, une seule fois", "Les modèles marqués « offerts »", "Lien unique et QR code", "Aide à l'écriture incluse, en quantité limitée"],
        featured: false,
      },
      {
        name: "Solo",
        tag: "7 jours",
        summary: "Une expérience soignée pour une occasion.",
        lines: ["Une création", "Valable 7 jours à partir du paiement", "Les modèles inclus dans la formule", "Modifications possibles pendant la validité"],
        featured: false,
      },
      {
        name: "Multi-usage",
        tag: "Tous les modèles",
        summary: "Pour gâter les mêmes personnes, plusieurs fois.",
        lines: ["Tous les modèles", "Jusqu'à 3 destinataires", "Créations illimitées pour ces 3 personnes", "Un 4ᵉ destinataire : une extension ou une nouvelle formule"],
        featured: true,
      },
      {
        name: "Annuelle",
        tag: "Bientôt",
        summary: "Pour celles et ceux qui célèbrent souvent.",
        lines: ["Tous les modèles, toute l'année", "Plus de destinataires", "Plus d'aide à l'écriture", "Détails communiqués à l'ouverture"],
        featured: false,
      },
    ],
    expiryKicker: "(À l'expiration)",
    expiryTitle: (
      <>
        Ce que tu as offert <em>reste</em> offert.
      </>
    ),
    expiry: [
      ["Créer et publier", "Pendant la validité de ta formule."],
      ["Modifier", "Pendant la validité de ta formule."],
      ["Aide à l'écriture", "Selon le quota de ta formule."],
      ["Ton destinataire", "Garde l'accès à ce que tu as publié, même après l'expiration."],
    ],
    meanwhile: "En attendant, ouvre une démonstration.",
    seeModels: "Voir les modèles",
  },

  about: {
    title: "À propos",
    description:
      "Zaweli conçoit des expériences numériques à offrir : un studio les dessine, tu les personnalises, ton destinataire les ouvre.",
    kicker: "(À propos)",
    heading: (
      <>
        Faire plaisir mérite mieux qu&apos;un <em>message</em> de plus.
      </>
    ),
    lead: "Zaweli permet à chacun de créer une expérience numérique unique pour célébrer, surprendre, remercier ou offrir un cadeau. La personne qui la reçoit l'ouvre par un simple lien, et la découvre pas à pas.",
    beliefsKicker: "(Ce qui nous guide)",
    beliefsTitle: (
      <>
        Quatre <em>engagements</em>, tenus dans chaque modèle.
      </>
    ),
    /** Contenu tiré du cahier des charges (mission, principes, positionnement). Aucun fait inventé. */
    beliefs: [
      {
        title: "Un studio dessine, tu racontes",
        text: "Chaque modèle est une œuvre complète, conçue par l'équipe Zaweli : son décor, ses gestes, ses animations. Tu n'as rien à dessiner ni à mettre en page, seulement tes mots, tes photos et tes cadeaux.",
      },
      {
        title: "Celui qui reçoit n'a rien à faire",
        text: "Pas de compte, pas d'application à installer. Un lien ou un QR code suffit pour ouvrir l'expérience, sur téléphone d'abord.",
      },
      {
        title: "Privé, par lien",
        text: "Une expérience n'est pas publiée sur un réseau : elle n'est visible que par les personnes à qui tu envoies son lien.",
      },
      {
        title: "Une promesse reste une promesse",
        text: "Un cadeau décrit dans un paquet est annoncé comme tel. Zaweli n'affiche jamais un paiement ou un transfert qui n'a pas réellement eu lieu.",
      },
    ],
    notKicker: "(Ce que Zaweli n'est pas)",
    notTitle: (
      <>
        Moins d&apos;outils, plus d&apos;<em>émotion</em>.
      </>
    ),
    not: ["Un éditeur de site à glisser-déposer", "Un générateur de cartes de vœux statiques", "Un réseau social"],
    endTitle: (
      <>
        Le mieux, c&apos;est encore <span className="whitespace-nowrap">de l&apos;<em>ouvrir</em>.</span>
      </>
    ),
    openDemo: "Ouvrir une démo",
    writeUs: "Nous écrire →",
  },

  questions: {
    title: "Questions",
    description: "Les réponses aux questions fréquentes sur Zaweli.",
    kicker: "(Questions)",
    heading: (
      <>
        Les <em>réponses</em>, simplement.
      </>
    ),
  },

  /** Questions fréquentes, partagées entre l'accueil et /questions. */
  faq: [
    {
      q: "La personne qui reçoit doit-elle créer un compte ?",
      a: "Non. Elle reçoit un lien (ou un QR code) et l'ouvre sur son téléphone ou son ordinateur. Rien à installer, rien à créer.",
    },
    {
      q: "Puis-je modifier le design d'un modèle ?",
      a: "Non, et c'est voulu. Chaque modèle est conçu, animé et testé par le studio. Tu personnalises ce qui compte — les mots, les photos, les cadeaux, les sections à garder — et le modèle s'occupe de la mise en scène.",
    },
    {
      q: "Un cadeau d'argent est-il vraiment envoyé ?",
      a: "Pas pour l'instant. Un cadeau d'argent est présenté comme une promesse : « Je t'offre 50 USD ». Zaweli n'affiche jamais un transfert qui n'a pas eu lieu.",
    },
    {
      q: "Mon expérience reste-t-elle en ligne si ma formule expire ?",
      a: "Oui. L'expiration te retire le droit de créer ou de modifier, pas l'accès de ton destinataire à ce que tu as déjà publié.",
    },
    {
      q: "Mes photos sont-elles visibles par tout le monde ?",
      a: "Non. Une expérience n'est accessible que par son lien, qui est long et aléatoire, et elle n'est pas référencée par les moteurs de recherche. Tu peux la désactiver à tout moment.",
    },
    {
      q: "Puis-je ajouter de la musique ?",
      a: "La musique d'ambiance arrive avec la création en ligne. Elle ne démarrera jamais toute seule : c'est le premier geste de ton destinataire qui la lance.",
    },
    {
      q: "Quand pourrai-je créer ma propre expérience ?",
      a: "La création en ligne ouvre prochainement. En attendant, tu peux parcourir les deux modèles en démonstration, exactement comme les verra ton destinataire.",
    },
  ],

  contact: {
    title: "Contact",
    description: "Écrire à Zaweli : une question, de l'aide sur une création, ou une demande d'entreprise.",
    kicker: "(Contact)",
    heading: (
      <>
        Écris-nous, on te <em>répond</em>.
      </>
    ),
    leadBefore: "Avant d'écrire, la réponse est peut-être déjà dans les ",
    leadLink: "questions fréquentes",
    leadAfter: ".",
    channels: {
      general: {
        kicker: "Questions et entreprises",
        text: "Une question sur les modèles, les formules, ou un projet pour ton entreprise.",
        subject: "Question sur Zaweli",
      },
      support: {
        kicker: "Aide",
        text: "Un souci avec une création, un lien qui ne s'ouvre pas, un paiement.",
        subject: "Demande d'aide",
      },
    },
    formTitle: "Laisser un message",
  },

  /** Formulaire de contact (composant client : chaînes simples uniquement). */
  contactForm: {
    topics: {
      question: "Une question sur Zaweli",
      aide: "De l'aide sur une création ou un lien",
      entreprise: "Une demande d'entreprise",
    },
    subject: "Sujet",
    name: "Ton prénom",
    message: "Ton message",
    submit: "Préparer l'e-mail",
    hint: "Ton application e-mail s'ouvre avec le message prêt à envoyer.",
  },

  /** Page 404 des adresses inconnues. */
  notFound: {
    title: "Page introuvable",
    text: "Cette adresse ne correspond à aucune page du site.",
    home: "Retour à l'accueil",
  },

  catalog,
  stepTitles,
  giftLabels,
};
