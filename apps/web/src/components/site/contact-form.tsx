"use client";

import { useState } from "react";
import { CONTACT } from "@/content/contact";
import type { Dictionary } from "@/i18n/dictionaries";

const TOPICS = [
  { value: "question", to: CONTACT.general },
  { value: "aide", to: CONTACT.support },
  { value: "entreprise", to: CONTACT.general },
] as const;

type Labels = Dictionary["contactForm"];

/**
 * Prépare un e-mail dans l'application du visiteur (mailto) : rien n'est envoyé
 * à un serveur Zaweli tant que l'API n'est pas en ligne.
 */
export function ContactForm({ labels }: { labels: Labels }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("question");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = TOPICS.find((x) => x.value === topic) ?? TOPICS[0];
    const subject = `${labels.topics[t.value]}${name ? ` — ${name}` : ""}`;
    const body = `${message}\n\n${name ? `— ${name}` : ""}`.trim();
    window.location.href = `mailto:${t.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const field = "mt-2 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-[1rem] outline-none transition-colors focus:border-primary";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <label className="block">
        <span className="text-[0.92rem] text-muted">{labels.subject}</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value as typeof topic)} className={field}>
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {labels.topics[t.value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[0.92rem] text-muted">{labels.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={field} />
      </label>
      <label className="block">
        <span className="text-[0.92rem] text-muted">{labels.message}</span>
        <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className={`${field} resize-y`} />
      </label>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="submit"
          className="inline-flex h-13 items-center rounded-full bg-primary px-7 text-[0.98rem] text-paper transition-colors hover:bg-primary-hover"
        >
          {labels.submit}
        </button>
        <span className="text-[0.88rem] text-muted">{labels.hint}</span>
      </div>
    </form>
  );
}
