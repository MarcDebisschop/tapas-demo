// ---------------------------------------------------------------------------
// server/t4teens/volledigheid.ts
//
// De volledigheidsregel van T4Teens: welke blokken ontbreken er nog?
//
// WAAROM DIT BESTAND ER IS
// De algemene poort in server/volledigheid-afname.ts leest de verwachte
// blokken uit de descriptor van het instrument. De descriptor van T4Teens
// draagt er geen: de blokken worden gebouwd in
// server/routes/vragenlijst-t4teens.ts, uit de itembank van de
// question-manager. Daardoor draaide de poort voor T4Teens op een lege lijst
// en weigerde ze niets. Een halve vragenlijst kon zo afgerond worden en kreeg
// daarna de toestand voltooid en een rapport.
//
// Deze module sluit dat gat zonder de blokken een derde keer te herhalen. Ze
// gebruikt dezelfde bron als de omzetting van bloksleutels naar itemsleutels:
// laadInstrumentItems("tapas-t4teens"). Die lijst staat in dezelfde volgorde
// als de blokken van de vragenlijstroute, met blokindex gelijk aan de positie
// in de lijst. tests/antwoordsleutels.test.ts bewaakt die aanname al.
//
// WAT ALS BEANTWOORD TELT
// Precies wat de scoring als antwoord meerekent, niet meer en niet minder. Die
// regel staat in server/t4teens/scoring.ts en wordt hier ingelezen via
// t4teensAntwoordGegeven(). Zo kan de poort nooit iets weigeren dat de scoring
// wel zou meerekenen, en nooit iets doorlaten dat de scoring als leeg ziet. In
// de praktijk komt dat neer op een echt getal in blockEnergy, in
// itemEnergy.most of als losse waarde. Nul is een geldig antwoord, niets
// aangeraakt is dat niet.
//
// WAAROM TWEE SLEUTELVORMEN AANVAARD WORDEN
// Het invulscherm bewaart onder bloksleutels (B0, B1, ...). Sommige eerdere
// afnames en de scoring zelf werken met itemsleutels (T4T-...). Een antwoord
// telt hier mee in beide vormen, zodat deze regel niemand buitensluit die
// werkelijk geantwoord heeft.
// ---------------------------------------------------------------------------

import { laadInstrumentItems } from "../question-manager";
import { t4teensAntwoordGegeven } from "./scoring";

const T4TEENS_INSTRUMENT = "tapas-t4teens";

/** De bloksleutels die T4Teens verwacht, in de volgorde van de itembank. */
export function verwachteT4TeensSleutels(): string[] {
  return laadInstrumentItems(T4TEENS_INSTRUMENT).map((_, index) => `B${index}`);
}

/**
 * Welke blokken van T4Teens zijn nog niet beantwoord?
 *
 * Geeft de bloksleutels terug in de volgorde van de vragenlijst. Een lege
 * lijst betekent: alles is ingevuld. Kent de server de itembank niet (lege
 * lijst items), dan valt er niets te weigeren en komt er ook niets uit.
 */
export function ontbrekendeT4TeensBlokken(
  responses: Record<string, unknown> | null | undefined,
): string[] {
  const gegeven = responses ?? {};
  const items = laadInstrumentItems(T4TEENS_INSTRUMENT);
  const uit: string[] = [];

  items.forEach((item, index) => {
    const bloksleutel = `B${index}`;
    const af =
      t4teensAntwoordGegeven(gegeven[bloksleutel]) ||
      t4teensAntwoordGegeven(gegeven[item.itemId]);
    if (!af) uit.push(bloksleutel);
  });

  return uit;
}
