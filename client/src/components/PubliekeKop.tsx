// ===========================================================================
// PubliekeKop.tsx: de kopbalk van de publieke positioneringslaag.
//
// De navigatie vertrekt van journeys en niet van rollen: Platform,
// Oplossingen, Outputs, Voor partners, Aanmelden. De rolgebonden ingangen
// blijven bestaan achter "Aanmelden", als operationele laag.
//
// TWEETALIG
// De kopbalk staat in de taal van de publieke laag, met Engels als standaard.
// De opschriften komen uit hoofdnavigatie(taal), de eigen teksten uit
// publiek/teksten-paginas.ts, en de schakelaar staat rechts, naast de
// thema-knop. Omdat het label met de taal wisselt, wordt de actieve stand op
// het pad vergeleken en niet op het label: pagina's geven daarom hun pad door
// in "nu".
//
// De onthaalpagina houdt haar eigen kopbalk, met dezelfde opschriften uit de
// hoofdnavigatie. Zo blijft die pagina op zichzelf staan en blijft de
// navigatie toch op één plaats vastgelegd.
// ===========================================================================

import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { hoofdnavigatie } from "@/publiek/inhoud";
import { kies, TaalKeuze, usePubliekeTaal } from "@/publiek/taal";
import { T } from "@/publiek/teksten-paginas";
import { onthoudBlok } from "@/lib/naar-blok";

/** Het kompasteken naast de merknaam, gelijk aan dat op de onthaalpagina. */
export function Kompasteken({ maat = 30 }: { maat?: number }) {
  return (
    <svg width={maat} height={maat} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18.2" stroke="var(--accent)" strokeWidth="1.4" opacity=".45" />
      <circle cx="20" cy="20" r="12.4" stroke="var(--accent)" strokeWidth="1" opacity=".25" />
      <path d="M20 4.6 L23.3 18.1 L16.7 18.1 Z" fill="var(--accent)" />
      <path d="M20 35.4 L23.3 18.1 L16.7 18.1 Z" fill="var(--accent)" opacity=".38" />
      <path d="M35.4 20 L21.9 23.3 L4.6 20 L21.9 16.7 Z" fill="var(--primary)" opacity=".55" />
      <circle cx="20" cy="20" r="2.1" fill="var(--primary)" stroke="var(--card)" strokeWidth="1.2" />
    </svg>
  );
}

/** De kopbalk. In "nu" staat het pad van de pagina waarop de bezoeker staat. */
export default function PubliekeKop({ nu }: { nu?: string }) {
  const { theme, toggle } = useTheme();
  const { taal } = usePubliekeTaal();
  return (
    <header className="bar" data-testid="publieke-kop">
      <div className="wrap">
        <Link href="/" className="merk">
          <Kompasteken maat={30} />
          <span>
            <span className="naam">Tapas CORE</span>
            <span className="onder">{kies(T.kop.merkonder, taal)}</span>
          </span>
        </Link>
        <nav className="hoofdnav" aria-label="Hoofdnavigatie">
          {hoofdnavigatie(taal).map((item) => (
            <Link
              key={item.pad}
              href={item.pad}
              className={nu === item.pad ? "nu" : undefined}
              onClick={() => {
                if (item.pad === "/" && item.sectie) onthoudBlok(item.sectie);
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <TaalKeuze />
        <button
          type="button"
          className="knop knop-2"
          onClick={toggle}
          data-testid="publiek-thema"
          aria-label={
            theme === "dark"
              ? kies(T.kop.naarLicht, taal)
              : kies(T.kop.naarDonker, taal)
          }
        >
          {theme === "dark" ? kies(T.kop.licht, taal) : kies(T.kop.donker, taal)}
        </button>
        <Link
          href="/"
          className="knop knop-1"
          data-testid="publiek-kennismaking"
          onClick={() => onthoudBlok("contact")}
        >
          {kies(T.kop.kennismaking, taal)}
        </Link>
      </div>
    </header>
  );
}
