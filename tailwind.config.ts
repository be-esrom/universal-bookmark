import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables (see globals.css) so the same class names
        // resolve to different values under `.dark` — components never need
        // their own dark: variants for basic color.
        paper: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        clay: "rgb(var(--color-clay) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-dark": "rgb(var(--color-accent-dark) / <alpha-value>)",
        // Inverted-fill chips (active pill, avatar) — deliberately separate
        // from ink/paper, which flip meaning in dark mode.
        solid: "rgb(var(--color-solid) / <alpha-value>)",
        "solid-foreground": "rgb(var(--color-solid-fg) / <alpha-value>)",
      },
      fontFamily: {
        // No webfont load — relies on the real system font, exactly like
        // apple.com does: SF Pro on Apple devices, a close system fallback
        // everywhere else.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "1.25rem",
        tab: "980px",
        control: "0.75rem",
      },
      boxShadow: {
        card: "0 2px 24px rgba(0,0,0,0.06)",
        "card-hover": "0 12px 40px rgba(0,0,0,0.10)",
        panel: "0 8px 40px rgba(0,0,0,0.16)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.28, 0.11, 0.32, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
