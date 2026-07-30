/**
 * server/doorgifteregister.ts
 *
 * Auditbevinding P-2 (ernst laag, privacy): "De mailkoppeling staat niet in het
 * centrale doorgifteregister, in tegenstelling tot de taalmodelkoppeling."
 *
 * Het platform had al een controleerbaar register voor één doorgifte - de
 * profieldata die naar het taalmodel van Google kan gaan. Maar er is een tweede
 * kanaal waarlangs persoonsgegevens het platform verlaten: de uitnodigingsmails.
 * Daarvoor gaan naam, e-mailadres en de persoonlijke link naar de mailleverancier.
 * Dat kanaal stond nergens in het register, waardoor het overzicht dat het
 * verwerkingsregister (AVG art. 30) moet dragen onvolledig was.
 *
 * Deze module brengt beide kanalen samen in één lijst. Ze leidt de mailregel af
 * uit de FEITELIJKE configuratie: zonder SMTP-instellingen verstuurt de mailer
 * niets (simulatiemodus) en dan meldt het register dat ook zo. Zo blijft het
 * register een waarneming en geen belofte.
 */

/** Eén regel in het register: één ontvanger, één doel, één stand. */
export interface DoorgifteKanaal {
  /** Korte sleutel, bv. "taalmodel" of "e-mail". */
  kanaal: string;
  /** Leesbare omschrijving van wat er doorgegeven wordt. */
  doel: string;
  /** Welke gegevenscategorieen het platform verlaten. */
  gegevens: string;
  /** Wie de gegevens ontvangt. */
  ontvanger: string;
  /** Waar die ontvanger verwerkt, voor de doorgiftetoets. */
  land: string;
  /** Staat het kanaal nu feitelijk aan? */
  actief: boolean;
  /** Wat er juridisch geregeld moet zijn voor dit kanaal. */
  grondslagVereist: string;
  /** Toelichting bij de vastgestelde stand. */
  vaststelling: string;
}

/** Leest de mailconfiguratie zoals de mailer ze zelf leest. */
function smtpHost(): string {
  return (process.env.SMTP_HOST ?? "").trim();
}

/**
 * De mailregel. `SMTP_HOST` bepaalt of er echt verstuurd wordt: ontbreekt hij,
 * dan draait de mailer in simulatiemodus en verlaat er geen enkel gegeven het
 * platform.
 */
export function mailDoorgifteKanaal(): DoorgifteKanaal {
  const host = smtpHost();
  const actief = host.length > 0;
  return {
    kanaal: "e-mail",
    doel: "Uitnodigingen en herinneringen met een persoonlijke deelnemerslink versturen.",
    gegevens: "Naam, e-mailadres, instrumentnaam en de persoonlijke link.",
    ontvanger: actief ? `SMTP-leverancier (${host})` : "geen (simulatiemodus)",
    land: actief ? "af te leiden uit de leverancier; te bevestigen in de doorgiftetoets" : "n.v.t.",
    actief,
    grondslagVereist:
      "Verwerkersovereenkomst met de mailleverancier; bij verwerking buiten de EER " +
      "ook een doorgiftetoets (AVG art. 44 e.v.).",
    vaststelling: actief
      ? "SMTP is geconfigureerd: uitnodigingsmails worden effectief verstuurd."
      : "SMTP is niet geconfigureerd: de mailer logt enkel en verstuurt niets.",
  };
}

/**
 * Het volledige register: de bestaande taalmodelregels plus de mailregel.
 * De taalmodelregels komen als parameter binnen, zodat deze module niets hoeft
 * te weten over de duidingmodule en apart te testen blijft.
 */
export function volledigDoorgifteRegister(
  taalmodelRegels: Array<{
    instrumentId: string;
    label: string;
    liveDuidingAan: boolean;
    ontvanger: string;
    land: string;
    grondslagVereist: string;
  }>,
): DoorgifteKanaal[] {
  const taalmodel: DoorgifteKanaal[] = taalmodelRegels.map((r) => ({
    kanaal: `taalmodel: ${r.label}`,
    doel: "Profieldata laten duiden door een taalmodel voor de rapporttekst.",
    gegevens:
      "Gepseudonimiseerde scores en constructen. Een poort weigert de doorgifte " +
      "zodra er iets identificeerbaars in de inhoud staat.",
    ontvanger: r.ontvanger,
    land: r.land,
    actief: r.liveDuidingAan,
    grondslagVereist: r.grondslagVereist,
    vaststelling: r.liveDuidingAan
      ? "Live duiding staat aan voor dit instrument: er gaat inhoud naar het model."
      : "Live duiding staat uit: het rapport gebruikt de statische duiding.",
  }));

  return [...taalmodel, mailDoorgifteKanaal()];
}
