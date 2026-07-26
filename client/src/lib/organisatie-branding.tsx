// ---------------------------------------------------------------------------
// client/src/lib/organisatie-branding.tsx - de personalisatie van fase 9 op
// het scherm zetten.
//
// De BESLISSING (welke achtergrond, en vooral: mag het Earhart-watermerk?)
// staat bewust niet hier maar in `shared/branding.ts`, als pure functie. Dit
// bestand doet er enkel twee dingen mee: het bevragen van de server en het
// aanbrengen op `documentElement`. Zo blijft de merkregel toetsbaar zonder DOM
// en kan niemand haar omzeilen door dit bestand te herschrijven.
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  brandingBesluit,
  ORGANISATIE_BRANDING_KLASSE,
  type Branding,
  type BrandingBesluit,
} from "@shared/branding";

export interface OrganisatieMij {
  ok: boolean;
  organisatieId: number;
  naam: string;
  branding: Branding;
}

/**
 * De organisatie van de huidige sessie, of null. Bruikbaar buiten de
 * organisatie-gate: een 401 is hier geen fout maar het normale antwoord voor
 * iedereen die geen organisatiesessie heeft.
 */
export function useOrganisatieMij() {
  return useQuery<OrganisatieMij | null>({
    queryKey: ["/api/organisatie/me"],
    queryFn: getQueryFn<OrganisatieMij | null>({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}

/** Het besluit voor de huidige sessie, klaar om te gebruiken of aan te brengen. */
export function useBrandingBesluit(): BrandingBesluit {
  const { data } = useOrganisatieMij();
  return brandingBesluit(
    data ? "organisatie" : "geen",
    data?.naam ?? null,
    data?.branding ?? null,
  );
}

/**
 * Brengt het besluit aan op `documentElement`. Enkel het aanbrengen; wat er
 * aangebracht wordt is elders beslist.
 */
export function pasBrandingToe(besluit: BrandingBesluit, wortel: HTMLElement): void {
  const stijl = wortel.style;
  if (besluit.klasse) {
    wortel.classList.add(besluit.klasse);
  } else {
    wortel.classList.remove(ORGANISATIE_BRANDING_KLASSE);
  }
  // Lege waarden worden gewist en niet op "none" gezet: dan valt de basiskleur
  // uit het thema er weer onder vandaan, ook bij het afmelden.
  if (besluit.achtergrondAfbeelding) {
    stijl.setProperty("--organisatie-achtergrond-afbeelding", besluit.achtergrondAfbeelding);
  } else {
    stijl.removeProperty("--organisatie-achtergrond-afbeelding");
  }
  if (besluit.achtergrondKleur) {
    stijl.setProperty("--organisatie-achtergrond-kleur", besluit.achtergrondKleur);
  } else {
    stijl.removeProperty("--organisatie-achtergrond-kleur");
  }
}

/** Houdt `documentElement` gelijk met de sessie. Eenmaal aanroepen, in App. */
export function OrganisatieBranding() {
  const besluit = useBrandingBesluit();
  useEffect(() => {
    pasBrandingToe(besluit, document.documentElement);
  }, [
    besluit.klasse,
    besluit.achtergrondAfbeelding,
    besluit.achtergrondKleur,
  ]);
  return null;
}
