"use client";

import { useState } from "react";
import { CONTACT } from "@/content/contact";

const TOPICS = [
  { value: "question", label: "Une question sur Zaweli", to: CONTACT.general },
  { value: "aide", label: "De l'aide sur une création ou un lien", to: CONTACT.support },
  { value: "entreprise", label: "Une demande d'entreprise", to: CONTACT.general },
] as const;

/**
 * Prépare un e-mail dans l'application du visiteur (mailto) : rien n'est envoyé
 * à un serveur Zaweli tant que l'API n'est pas en ligne.
 */
export function ContactForm() {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("question");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = TOPICS.find((x) => x.value === topic) ?? TOPICS[0];
    const subject = `${t.label}${name ? ` — ${name}` : ""}`;
    const body = `${message}\n\n${name ? `— ${name}` : ""}`.trim();
    window.location.href = `mailto:${t.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const field = "mt-2 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-[1rem] outline-none transition-colors focus:border-primary";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <label className="block">
        <span className="text-[0.92rem] text-muted">Sujet</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value as typeof topic)} className={field}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[0.92rem] text-muted">Ton prénom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={field} />
      </label>
      <label className="block">
        <span className="text-[0.92rem] text-muted">Ton message</span>
        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className={`${field} resize-y`} />
      </label>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="submit"
          className="inline-flex h-13 items-center rounded-full bg-primary px-7 text-[0.98rem] text-paper transition-colors hover:bg-primary-hover"
        >
          Préparer l&apos;e-mail
        </button>
        <span className="text-[0.88rem] text-muted">Ton application e-mail s&apos;ouvre avec le message prêt à envoyer.</span>
      </div>
    </form>
  );
}
