/** Même message pour une expérience inexistante, désactivée ou suspendue (S19). */
export default function ExperienceNotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl">Cette expérience n&apos;est plus disponible.</h1>
      <p className="mt-4 text-muted">Le lien est peut-être incorrect, ou son auteur l&apos;a désactivée.</p>
    </main>
  );
}
