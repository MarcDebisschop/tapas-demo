import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

const THEME_KEY = "tapas_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default = ALTIJD donker: iedereen krijgt meteen die ervaring bij het
  // opstarten. Wisselt de gebruiker bewust naar licht, dan onthouden we die
  // keuze; zonder bewuste keuze blijft de app donker, ongeacht de systeemmodus.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const opgeslagen = window.localStorage.getItem(THEME_KEY);
      if (opgeslagen === "light" || opgeslagen === "dark") return opgeslagen;
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* localStorage niet beschikbaar — geen probleem, default blijft donker */
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
