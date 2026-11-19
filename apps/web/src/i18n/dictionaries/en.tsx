import type { GiftType } from "@zaweli/shared-types";
import type { Dictionary } from "./index";
import type { StepId, TemplateCopy, TemplateSlug } from "./fr";

/**
 * Site text in English. A translation of the French reference (fr.tsx):
 * no facts, prices or contact details are added here.
 */

const catalog: Record<TemplateSlug, TemplateCopy> = {
  coffret: {
    name: "Coffret",
    tagline: "A jewellery box to open, one step at a time.",
    occasion: "Birthday",
    pitch:
      "A wax-sealed envelope, a lacquered jewellery box, riddles that flip their card over onto a photo, parcels to unwrap, a candle to blow out and eight balloons, each hiding a wish. Every step stays secret until the one before it has been opened.",
    coverAlt: "Coffret: the envelope closed with a gold wax seal",
    screenAlts: [
      "The sealed envelope",
      "The open jewellery box, showing a photo under a gold arch",
      "A riddle flipped over onto its photo",
      "Three unwrapped parcels and their gifts",
      "The “Happy birthday” title and the balloons",
      "The closing letter, signed",
    ],
    highlights: [
      { title: "A seal to break", text: "The recipient's first gesture opens the envelope and starts the sound." },
      { title: "Riddles", text: "A right answer flips the card over onto a photo and a few words." },
      { title: "Parcels", text: "Each parcel holds a real gift of a given kind, presented honestly." },
      { title: "One candle, eight wishes", text: "Blow it out, then every balloon you pop releases a wish." },
    ],
  },
  eclat: {
    name: "Éclat",
    tagline: "An editorial story, like a film you scroll through.",
    occasion: "Birthday & achievement",
    pitch:
      "A curtain-raising opening, a portrait under an arch, an achievement told with its date and timeline, a gallery that opens full screen, a letter revealed line by line, then a magic moment. Designed to celebrate a person and the whole road travelled.",
    coverAlt: "Éclat: “Joyeux anniversaire, Nadia” and a portrait under an arch",
    screenAlts: [
      "The opening: a sentence, then the first name",
      "The portrait under an arch",
      "The achievement and its monumental date",
      "The timeline of the road travelled",
      "The letter on ivory paper",
      "The finale, signed",
    ],
    highlights: [
      { title: "A curtain-raising opening", text: "Two sentences, then a gold line that opens the scene." },
      { title: "A dated achievement", text: "A degree, a milestone, with its timeline and photos." },
      { title: "A gallery", text: "Up to ten captioned photos, to open full screen." },
      { title: "A letter", text: "It writes itself before the recipient's eyes, at their own pace." },
    ],
  },
};

const stepTitles: Record<StepId, string> = {
  recipient: "Who is it for?",
  envelope: "The envelope",
  jewel: "The jewellery box",
  riddles: "The riddles",
  gifts: "The gifts",
  celebration: "The wishes",
  letter: "The letter",
  intro: "The opening",
  portrait: "The portrait",
  achievement: "The achievement",
  gallery: "The gallery",
  magic: "The magic moment",
  final: "The finale",
};

const giftLabels: Record<GiftType, string> = {
  MONEY: "money (a promise)",
  PHYSICAL: "an object",
  INVITATION: "an invitation",
  VOUCHER: "a gift voucher",
  EXPERIENCE: "an experience",
};

export const en: Dictionary = {
  meta: {
    siteTitle: "Zaweli — Give a moment, not just a message",
    description:
      "Zaweli stages your words, your photos and your gifts in an experience to open, designed by a studio. Your recipient only has to tap a link.",
  },

  language: {
    label: "Language",
    switchTo: "English version",
  },

  header: {
    nav: [
      { href: "/modeles", label: "Templates" },
      { href: "/#parcours", label: "The experience" },
      { href: "/tarifs", label: "Pricing" },
      { href: "/a-propos", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
    homeLabel: "Zaweli, home",
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    tryDemo: "Try a demo",
    signIn: "Sign in",
    openMenu: "Open the menu",
    closeMenu: "Close the menu",
  },

  footer: {
    pitch: "Digital experiences to give, designed by a studio, to celebrate, surprise or say thank you.",
    navLabel: "Footer",
    columns: [
      {
        title: "Discover",
        links: [
          { href: "/modeles", label: "Templates" },
          { href: "/#parcours", label: "The experience" },
          { href: "/tarifs", label: "Pricing" },
        ],
      },
      {
        title: "Try",
        links: [
          { href: "/modeles/coffret/demo", label: "Coffret demo" },
          { href: "/modeles/eclat/demo", label: "Éclat demo" },
        ],
      },
      {
        title: "Zaweli",
        links: [
          { href: "/a-propos", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/questions", label: "Questions" },
        ],
      },
    ],
    status: "Service status",
    copyright: "© 2026 Zaweli",
    studio: "The templates are designed by the Zaweli studio.",
  },

  specs: {
    photos: "Photos",
    upTo: (n) => `Up to ${n}`,
    steps: "Steps to fill in",
    gifts: "Gifts",
    optionalSections: "Optional sections",
    riddles: "Riddles",
    writingHelp: "Writing help",
    texts: (n) => `${n} texts`,
    range: (min, max) => `${min} to ${max}`,
    summary: (photos, steps, gifts) => `Up to ${photos} photos · ${steps} steps to fill in${gifts ? ` · ${gifts} gifts` : ""}`,
  },

  home: {
    kicker: "Digital experiences to give",
    title: (
      <>
        Give a <span className="whitespace-nowrap"><em>moment</em>,</span> not just a message.
      </>
    ),
    lead: "Zaweli stages your words, your photos and your gifts in an experience to open, designed by a studio. Your recipient only has to tap a link.",
    discover: "Discover the templates",
    openDemo: "Open a demo →",
    heroCoffretAlt: "The Coffret template: a sealed envelope",
    heroEclatAlt: "The Éclat template: a portrait under an arch",
    proofs: [
      ["No account", "for the person receiving it"],
      ["A link and a QR code", "to share wherever you like"],
      ["Designed for phones", "first, then for larger screens"],
    ],
    occasionsLabel: "Occasions",
    occasions: ["Birthday", "Graduation", "Declaration", "Thank you", "Achievement", "Surprise", "Reunion", "Congratulations"],
    journeyKicker: "(The experience)",
    journeyTitle: (
      <>
        It isn&apos;t a card. It&apos;s something <em>you open</em>.
      </>
    ),
    journey: [
      {
        title: "An envelope to break open",
        text: "The first gesture belongs to your recipient: they break the seal and the card slides out of the envelope.",
        alt: "Envelope closed with a wax seal",
      },
      {
        title: "A jewellery box that opens",
        text: "The lid lifts onto a photo, ringed with gold, and a sentence you chose.",
        alt: "Jewellery box open on a photo",
      },
      {
        title: "Riddles to solve",
        text: "Three options, only one right. The right answer flips the card over onto a memory.",
        alt: "Riddle card flipped over onto a photo",
      },
      {
        title: "Gifts to unwrap",
        text: "An invitation, a voucher, a promise: each parcel reveals a real gift, described truthfully.",
        alt: "Unwrapped parcels and gift tickets",
      },
      {
        title: "One candle, eight wishes",
        text: "Blow it out and the balloons fly away. Each one hides a wish you wrote.",
        alt: "Happy birthday and balloons",
      },
      {
        title: "A letter to finish",
        text: "The last words are yours, signed, to read again as many times as they like.",
        alt: "Signed closing letter",
      },
    ],
    modelsKicker: "(The templates)",
    modelsTitle: (
      <>
        Two templates, two <em>ways</em> to tell it.
      </>
    ),
    modelsLead:
      "Each template is a complete piece of work: its setting, its gestures, its animations. You have nothing to design, only to fill in.",
    openTheDemo: "Open the demo",
    seeDetail: "See the details →",
    giftsKicker: "(The gifts)",
    giftsTitle: (
      <>
        Slip a <em>real</em> gift into the parcel.
      </>
    ),
    giftsLead:
      "Each parcel holds a gift you describe: your recipient discovers it by opening it. And a promise stays a promise: Zaweli never announces a transfer that hasn't happened.",
    gifts: [
      { name: "An invitation", example: "“I'm taking you out to dinner on Saturday, 7:30 pm.”" },
      { name: "A gift voucher", example: "“Good for one day where you make all the decisions.”" },
      { name: "An object", example: "“A perfume is waiting for you. I'll give it to you this weekend.”" },
      { name: "An experience", example: "“A weekend for two, by the lake.”" },
      { name: "A sum of money", example: "“I'm giving you 50 USD”, presented as a promise." },
    ],
    howKicker: "(In three steps)",
    howTitle: (
      <>
        You fill it in. The template <em>stages it</em>.
      </>
    ),
    how: [
      ["Choose", "A template for the occasion. Open its demo: it's exactly what your recipient will see."],
      ["Personalise", "The first name, your words, your photos, your gifts. An assistant guides you, step by step, with nothing to design."],
      ["Share", "You get a unique link and a QR code. Send it by WhatsApp or text message, or print it on a card."],
    ],
    businessKicker: "(Businesses)",
    business: "Greetings for your clients, invitations, team rewards: a space dedicated to businesses is in preparation.",
    businessWhen: "Opening after launch.",
    faqKicker: "(Questions)",
    faqTitle: (
      <>
        What people often <em>ask</em> us.
      </>
    ),
    allQuestions: "All questions →",
    endTitle: (
      <>
        There&apos;s someone you want to tell <em>something</em>.
      </>
    ),
    chooseModel: "Choose a template",
    comingSoon: "Online creation opens soon.",
  },

  models: {
    title: "Templates",
    description: "Zaweli experience templates, designed and animated by a studio. Open their demo.",
    kicker: "(Templates)",
    heading: (
      <>
        Choose <em>the setting</em>, we do the rest.
      </>
    ),
    lead: "Each template has its own setting, gestures and rhythm. Open its demo: you'll see exactly what the person receiving it will discover. More templates are in preparation.",
  },

  model: {
    allModels: "← All templates",
    create: "Create with this template",
    fullscreen: "Open full screen",
    orPlay: "or play the demo in the phone →",
    demoTitle: (name) => `Demo of the ${name} template`,
    demoNote: "A real demo, with fictional content.",
    customizeKicker: "(What you personalise)",
    customizeTitle: (steps) => (
      <>
        An assistant in <em>{steps} steps</em>. Nothing to design.
      </>
    ),
    possibleGifts: (types) =>
      `Possible gifts: ${types}. The parcel and its animation belong to the template; you choose what's inside.`,
    another: "Another template",
  },

  demo: {
    fallbackTitle: "Demo",
    title: (name) => `${name} demo`,
    description: (name) => `Open the demo of the ${name} template: exactly what the person receiving the experience will see.`,
  },

  pricing: {
    title: "Pricing",
    description: "Zaweli plans: one free creation, then Solo, Multi-use and an annual plan.",
    kicker: "(Pricing)",
    heading: (
      <>
        Your first one is <em>free</em>. Then, depending on your occasions.
      </>
    ),
    lead: "Prices will be announced when online creation opens. Payment planned by mobile money and by card.",
    priceLater: "Price at opening",
    plans: [
      {
        name: "Discovery",
        tag: "Free",
        summary: "Your first experience, to try it out.",
        lines: ["One creation, one time only", "Templates marked “free”", "Unique link and QR code", "Writing help included, in limited amounts"],
        featured: false,
      },
      {
        name: "Solo",
        tag: "7 days",
        summary: "A polished experience for one occasion.",
        lines: ["One creation", "Valid for 7 days from payment", "The templates included in the plan", "Changes possible while it is valid"],
        featured: false,
      },
      {
        name: "Multi-use",
        tag: "All templates",
        summary: "To spoil the same people, several times.",
        lines: ["All templates", "Up to 3 recipients", "Unlimited creations for these 3 people", "A 4th recipient: an add-on or a new plan"],
        featured: true,
      },
      {
        name: "Annual",
        tag: "Soon",
        summary: "For those who celebrate often.",
        lines: ["All templates, all year round", "More recipients", "More writing help", "Details shared at opening"],
        featured: false,
      },
    ],
    expiryKicker: "(When it expires)",
    expiryTitle: (
      <>
        What you gave <em>stays</em> given.
      </>
    ),
    expiry: [
      ["Create and publish", "While your plan is valid."],
      ["Edit", "While your plan is valid."],
      ["Writing help", "Within your plan's quota."],
      ["Your recipient", "Keeps access to what you published, even after it expires."],
    ],
    meanwhile: "In the meantime, open a demo.",
    seeModels: "See the templates",
  },

  about: {
    title: "About",
    description: "Zaweli designs digital experiences to give: a studio designs them, you personalise them, your recipient opens them.",
    kicker: "(About)",
    heading: (
      <>
        Making someone happy deserves better than one more <em>message</em>.
      </>
    ),
    lead: "Zaweli lets anyone create a unique digital experience to celebrate, surprise, thank someone or give a gift. The person receiving it opens it with a simple link, and discovers it step by step.",
    beliefsKicker: "(What guides us)",
    beliefsTitle: (
      <>
        Four <em>commitments</em>, kept in every template.
      </>
    ),
    beliefs: [
      {
        title: "A studio designs, you tell the story",
        text: "Each template is a complete piece of work, designed by the Zaweli team: its setting, its gestures, its animations. You have nothing to design or lay out, only your words, your photos and your gifts.",
      },
      {
        title: "The person receiving it has nothing to do",
        text: "No account, no app to install. A link or a QR code is enough to open the experience, on a phone first.",
      },
      {
        title: "Private, by link",
        text: "An experience isn't published on a network: only the people you send its link to can see it.",
      },
      {
        title: "A promise stays a promise",
        text: "A gift described in a parcel is announced as exactly that. Zaweli never shows a payment or a transfer that hasn't actually happened.",
      },
    ],
    notKicker: "(What Zaweli isn't)",
    notTitle: (
      <>
        Fewer tools, more <em>emotion</em>.
      </>
    ),
    not: ["A drag-and-drop website builder", "A generator of static greeting cards", "A social network"],
    endTitle: (
      <>
        The best way is still <span className="whitespace-nowrap">to <em>open it</em>.</span>
      </>
    ),
    openDemo: "Open a demo",
    writeUs: "Write to us →",
  },

  questions: {
    title: "Questions",
    description: "Answers to frequently asked questions about Zaweli.",
    kicker: "(Questions)",
    heading: (
      <>
        The <em>answers</em>, simply.
      </>
    ),
  },

  faq: [
    {
      q: "Does the person receiving it need to create an account?",
      a: "No. They receive a link (or a QR code) and open it on their phone or computer. Nothing to install, nothing to create.",
    },
    {
      q: "Can I change a template's design?",
      a: "No, and that's on purpose. Each template is designed, animated and tested by the studio. You personalise what matters — the words, the photos, the gifts, the sections to keep — and the template takes care of the staging.",
    },
    {
      q: "Is a money gift really sent?",
      a: "Not for now. A money gift is presented as a promise: “I'm giving you 50 USD”. Zaweli never shows a transfer that hasn't happened.",
    },
    {
      q: "Does my experience stay online if my plan expires?",
      a: "Yes. Expiry removes your right to create or edit, not your recipient's access to what you've already published.",
    },
    {
      q: "Can everyone see my photos?",
      a: "No. An experience can only be reached through its link, which is long and random, and it isn't indexed by search engines. You can deactivate it at any time.",
    },
    {
      q: "Can I add music?",
      a: "Background music arrives with online creation. It will never start on its own: your recipient's first gesture starts it.",
    },
    {
      q: "When will I be able to create my own experience?",
      a: "Online creation opens soon. In the meantime, you can explore the two templates in demo mode, exactly as your recipient will see them.",
    },
  ],

  contact: {
    title: "Contact",
    description: "Write to Zaweli: a question, help with a creation, or a business enquiry.",
    kicker: "(Contact)",
    heading: (
      <>
        Write to us, we&apos;ll <em>reply</em>.
      </>
    ),
    leadBefore: "Before writing, the answer may already be in the ",
    leadLink: "frequently asked questions",
    leadAfter: ".",
    channels: {
      general: {
        kicker: "Questions and businesses",
        text: "A question about the templates, the plans, or a project for your business.",
        subject: "Question about Zaweli",
      },
      support: {
        kicker: "Help",
        text: "A problem with a creation, a link that won't open, a payment.",
        subject: "Help request",
      },
    },
    formTitle: "Leave a message",
  },

  contactForm: {
    topics: {
      question: "A question about Zaweli",
      aide: "Help with a creation or a link",
      entreprise: "A business enquiry",
    },
    subject: "Subject",
    name: "Your first name",
    message: "Your message",
    submit: "Prepare the email",
    hint: "Your email app opens with the message ready to send.",
  },

  notFound: {
    title: "Page not found",
    text: "This address doesn't match any page on the site.",
    home: "Back to home",
  },

  catalog,
  stepTitles,
  giftLabels,
};
