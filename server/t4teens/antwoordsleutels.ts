// ---------------------------------------------------------------------------
// server/t4teens/antwoordsleutels.ts
//
// Omzetting van bloksleutels naar itemsleutels voor T4Teens.
//
// WAAROM DIT NODIG IS
// Het invulscherm (client/src/pages/deel1.tsx) bewaart elk antwoord onder een
// bloksleutel van de vorm B<blokindex>. Die sleutel komt uit de vragenlijst die
// server/routes/vragenlijst-t4teens.ts aanlevert. De scoring
// (server/t4teens/scoring.ts) zoekt een antwoord daarentegen op met de
// itemsleutel uit de itembank (T4T-...). Tussen die twee zat geen omzetting,
// waardoor elk antwoord onvindbaar was en een volledig ingevulde afname op nul
// gescoorde items uitkwam.
//
// WAAROM DE OMZETTING OP VOLGORDE MAG
// De vragenlijstroute bouwt precies één blok per item, in de volgorde van de
// itembank, met blockIndex gelijk aan de positie in die lijst. Blokindex i
// wijst dus altijd item i aan. tests/antwoordsleutels.test.ts bewaakt die
// aanname, want de route houdt een eigen kopie van de itemlijst bij.
//
// WAAROM HIER EN NIET IN DE CLIENT OF IN DE OPSLAG
// Deze omzetting raakt geen enkel opgeslagen gegeven aan. De antwoorden blijven
// bewaard zoals ze binnenkwamen; ze worden pas op het laatste moment vertaald,
// vlak voor ze de scoring in gaan. Daardoor blijven ook afnames die al eerder
// werden ingevuld gewoon scoorbaar, en hoeft er niets in de databank te worden
// omgezet.
// ---------------------------------------------------------------------------

import { laadInstrumentItems } from "../question-manager";

const T4TEENS_INSTRUMENT = "tapas-t4teens";

function blokIndexVan(sleutel: string): number | null {
  const gevonden = /^B(\d+)$/.exec(sleutel);
  return gevonden ? Number(gevonden[1]) : null;
}

/**
 * Zet de antwoorden van deel 1 om van bloksleutels naar itemsleutels.
 * Sleutels die geen bloksleutel zijn (bijvoorbeeld al een itemsleutel) blijven
 * onaangeroerd staan, net als bloksleutels zonder overeenkomstig item.
 */
export function naarItemSleutels(
  responses: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const bron = responses ?? {};
  const items = laadInstrumentItems(T4TEENS_INSTRUMENT);
  const uit: Record<string, unknown> = {};

  for (const [sleutel, waarde] of Object.entries(bron)) {
    const index = blokIndexVan(sleutel);
    const item = index === null ? undefined : items[index];
    uit[item ? item.itemId : sleutel] = waarde;
  }

  return uit;
}
