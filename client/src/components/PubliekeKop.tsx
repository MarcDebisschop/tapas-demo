// ===========================================================================
// PubliekeKop.tsx: de kopbalk van de publieke positioneringslaag.
//
// De navigatie vertrekt van journeys en niet van rollen: Platform,
// Oplossingen, Outputs, Voor partners, Aanmelden. De rolgebonden ingangen
// blijven bestaan achter "Aanmelden", als operationele laag.
//
// De onthaalpagina houdt haar eigen kopbalk, met dezelfde opschriften uit
// HOOFDNAVIGATIE. Zo blijft die pagina op zichzelf staan en blijft de
// navigatie toch op één plaats vastgelegd.
// ===========================================================================

import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";
import { HOOFDNAVIGATIE } from "@/data/oplossingen";
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

export default function PubliekeKop({ nu }: { nu?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="bar" data-testid="publieke-kop">
      <div className="wrap">
        <Link href="/" className="merk">
          <Kompasteken maat={30} />
          <span>
            <span className="naam">Tapas CORE</span>
            <span className="onder">de beslislaag voor talentbeslissingen</span>
          </span>
        </Link>
        <nav className="hoofdnav" aria-label="Hoofdnavigatie">
          {HOOFDNAVIGATIE.map((item) => (
            <Link
              key={item.label}
              href={item.pad}
              className={nu === item.label ? "nu" : undefined}
              onClick={() => {
                if (item.pad === "/" && item.sectie) onthoudBlok(item.sectie);
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="knop knop-2"
          onClick={toggle}
          data-testid="publiek-thema"
          aria-label={
            theme === "dark" ? "Wissel naar de lichte weergave" : "Wissel naar de donkere weergave"
          }
        >
          {theme === "dark" ? "Licht" : "Donker"}
        </button>
        <Link
          href="/"
          className="knop knop-1"
          data-testid="publiek-kennismaking"
          onClick={() => onthoudBlok("contact")}
        >
          Plan een kennismaking
        </Link>
      </div>
    </header>
  );
}
