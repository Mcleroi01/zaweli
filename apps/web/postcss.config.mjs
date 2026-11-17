// Tailwind passe par PostCSS : fonctionne avec webpack (build de production)
// comme avec Turbopack (développement).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
