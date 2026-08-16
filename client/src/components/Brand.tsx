import { Link, useLocation } from "wouter";
import { Moon, Sun } from "lucide-react";
import { DEMO_MODE } from "@/lib/demoMode";
import { PRODUCT_NAAM } from "@/lib/features";
import { useTheme } from "./ThemeProvider";
import { useOrganisatieMij } from "@/lib/organisatie-branding";
import { headerTitel } from "@shared/branding";
import { merkBestemming } from "@/lib/merkbestemming";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="TaPas Platform logo"
      role="img"
    >
      {/*
        Talentkompas-merkteken: een vierpuntige kompasroos waarvan de bovenste
        punt verlengd is en samen met de horizontale as een verborgen "T" vormt.
        Twee tinten geven diepte zonder het mark te laten afhangen van kleur.
      */}
      {/* Noord-naald (gevuld) — lange punt = stam van de T */}
      <path d="M16 2 L20 16 L16 13 L12 16 Z" fill="currentColor" />
      {/* Zuid-naald (zachter) */}
      <path d="M16 30 L12 16 L16 19 L20 16 Z" fill="currentColor" opacity="0.35" />
      {/* Oost/West-balk — vormt samen met de noordpunt de T-vorm */}
      <path d="M2 16 L13 16 L16 16 L30 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      {/* Kern */}
      <circle cx="16" cy="16" r="2.6" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="var(--card, #fff)" />
    </svg>
  );
}

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  // Binnen een afgeschermde omgeving blijft de merknaam binnen die omgeving.
  // Zonder deze regel zette ze een ingelogde beheerder op de publieke
  // onthaalpagina.
  const [pad] = useLocation();
  const bestemming = merkBestemming(pad);
  // De organisatie van de sessie, indien er een is. Null voor de prior en voor
  // iedereen zonder organisatiesessie; dan blijft de header ongewijzigd.
  const { data: mij } = useOrganisatieMij();
  const titel = headerTitel(PRODUCT_NAAM, mij?.naam ?? null);
  const eigenLogo = mij?.branding?.logoUrl ?? null;
  return (
    <>
    {DEMO_MODE && (
      <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 py-1.5 text-center text-xs text-amber-800 dark:text-amber-300">
        Demo-versie — read-only. Navigeer vrij door het platform.
      </div>
    )}
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={bestemming}>
          <a className="flex items-center gap-2 text-primary" data-testid="link-home">
            {/* Het eigen logo van de organisatie vervangt de kompasroos. Nooit
                het Earhart-vliegtuig: dat is het merkteken van TaPasCity. */}
            {eigenLogo ? (
              <img
                src={eigenLogo}
                alt=""
                className="h-7 w-7 object-contain"
                data-testid="afbeelding-organisatielogo"
              />
            ) : (
              <Logo />
            )}
            <span
              className="text-base font-semibold tracking-tight text-foreground"
              data-testid="tekst-producttitel"
            >
              {titel}
            </span>
          </a>
        </Link>
        <div className="flex items-center gap-2">
          {right}
          <button
            onClick={toggle}
            className="rounded-md border border-border p-2 text-muted-foreground hover-elevate"
            aria-label={theme === "dark" ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
