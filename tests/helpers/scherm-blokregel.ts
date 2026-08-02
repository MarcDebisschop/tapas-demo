// ---------------------------------------------------------------------------
// tests/helpers/scherm-blokregel.ts
//
// Het invulscherm van deel 1, teruggebracht tot wat er voor deze meting toe
// doet: welke keuzetoestanden een deelnemer met de knoppen kan bereiken, en of
// een van die toestanden het blok afrondt.
//
// De twee handelingen hieronder zijn letterlijk overgenomen uit
// client/src/pages/deel1.tsx. Een uitspraak kan niet tegelijk de meest- en de
// minst-keuze zijn: wie een uitspraak op "meest" zet terwijl ze op "minst"
// stond, maakt de andere leeg. Precies dat maakte T4Teens onafmaakbaar.
//
// De volledigheidsregel zelf wordt niet nagebouwd. Die komt uit
// shared/verplicht-antwoorden.ts, dezelfde bron die het scherm en de server
// gebruiken. Zou hier een tweede kopie staan, dan bewaakte deze meting haar
// eigen aanname in plaats van het echte gedrag.
// ---------------------------------------------------------------------------
import { blokAntwoordVolledig } from "@shared/verplicht-antwoorden";
import type { BlokAntwoord, BlokVorm } from "@shared/verplicht-antwoorden";

export interface GemetenBlok extends BlokVorm {
  items?: { pos: string }[];
}

export const leegAntwoord = (): BlokAntwoord => ({
  most: null,
  least: null,
  itemEnergy: { most: null, least: null },
  blockEnergy: null,
});

export function klikMeest(a: BlokAntwoord, pos: string): BlokAntwoord {
  const least = a.least === pos ? null : a.least;
  return { ...a, most: a.most === pos ? null : pos, least };
}

export function klikMinst(a: BlokAntwoord, pos: string): BlokAntwoord {
  const most = a.most === pos ? null : a.most;
  return { ...a, least: a.least === pos ? null : pos, most };
}

/**
 * Kan de deelnemer dit blok afkrijgen?
 *
 * Loopt vanuit het lege blok alle keuzetoestanden af die met de knoppen van het
 * scherm bereikbaar zijn, en gunt de deelnemer bij elke toestand elke waarde op
 * de schalen. Levert geen enkele toestand een volledig blok, dan loopt de
 * deelnemer daar vast.
 */
export function blokIsAfTeKrijgen(blok: GemetenBlok): boolean {
  const posities = (blok.items ?? []).map((i) => i.pos);
  const gezien = new Set<string>();
  const wachtrij: BlokAntwoord[] = [leegAntwoord()];

  while (wachtrij.length > 0) {
    const huidig = wachtrij.shift()!;
    const vinger = `${huidig.most ?? "-"}|${huidig.least ?? "-"}`;
    if (gezien.has(vinger)) continue;
    gezien.add(vinger);

    const ingevuld: BlokAntwoord = {
      ...huidig,
      itemEnergy: { most: 1, least: -1 },
      blockEnergy: 1,
    };
    if (blokAntwoordVolledig(blok, ingevuld)) return true;

    for (const pos of posities) {
      wachtrij.push(klikMeest(huidig, pos));
      wachtrij.push(klikMinst(huidig, pos));
    }
  }
  return false;
}
