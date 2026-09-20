/**
 * server/mailpoort/html-versie.ts
 *
 * Een bericht krijgt een klikbare versie naast zijn platte tekst.
 * ---------------------------------------------------------------------------
 * AANLEIDING. Een board member kreeg zijn uitnodiging, klikte de link aan, en
 * las "404, pagina niet gevonden". Het adres in de adresbalk stopte precies waar
 * het token hoorde te beginnen:
 *
 *     https://tapas-demo.onrender.com/#/deelnemer/
 *
 * Het platform verstuurde tot nu toe enkel platte tekst. In een plat bericht
 * staat geen link; er staat een reeks tekens die het programma van de ontvanger
 * zelf tot een link moet maken. Dat programma stopt bij de eerste regelovergang,
 * en platte tekst breekt elke regel na hoogstens 76 tekens. Onze regel was
 * langer, dus brak het token eraf. Het token klopte, de uitnodiging stond klaar,
 * en de ontvanger kwam nergens.
 *
 * Deze module stuurt naast de platte tekst ook een html-versie mee. Daarin is
 * elke link een echte verwijzing, dus hoeft het programma van de ontvanger zelf
 * geen link meer te herkennen. Een regelovergang kan het token dan niet meer
 * afbreken. De platte tekst gaat nog altijd mee voor wie geen html leest.
 */

/** Tekens die in html een betekenis hebben, worden onschadelijk gemaakt. */
function veilig(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Zoekt de webadressen in een regel platte tekst.
 *
 * Een sluitend leesteken achteraan hoort bij de zin en niet bij het adres, dus
 * een punt, komma of sluithaakje aan het eind blijft buiten de verwijzing.
 */
const ADRES = /https?:\/\/[^\s<>"]+/g;

function knipLeesteken(adres: string): { adres: string; staart: string } {
  const match = adres.match(/[.,;:!?)\]}]+$/);
  if (!match) return { adres, staart: "" };
  return { adres: adres.slice(0, adres.length - match[0].length), staart: match[0] };
}

/** Eén regel tekst wordt html, met de adressen als echte verwijzing. */
export function regelNaarHtml(regel: string): string {
  let uit = "";
  let positie = 0;
  // exec in een lus in plaats van matchAll: de doeltaal van dit project is ouder
  // dan de iterator die matchAll teruggeeft.
  const zoeker = new RegExp(ADRES.source, "g");
  let gevonden: RegExpExecArray | null;
  while ((gevonden = zoeker.exec(regel)) !== null) {
    const start = gevonden.index;
    uit += veilig(regel.slice(positie, start));
    const { adres, staart } = knipLeesteken(gevonden[0]);
    const href = veilig(adres);
    uit += `<a href="${href}" style="color:#0C4E54;word-break:break-all">${href}</a>`;
    uit += veilig(staart);
    positie = start + gevonden[0].length;
  }
  uit += veilig(regel.slice(positie));
  return uit;
}

/**
 * De html-versie van een bericht dat als platte tekst geschreven is.
 *
 * Geen opsmuk: een kolom, een leesbare letter en witruimte tussen de alinea's.
 * Een bericht dat eruitziet als een nieuwsbrief belandt vaker in de ongewenste
 * post, en een uitnodiging hoort in de gewone post.
 */
export function htmlVanTekst(tekst: string): string {
  const regels = (tekst ?? "").replace(/\r\n/g, "\n").split("\n");
  const body = regels
    .map((regel) =>
      regel.trim() === ""
        ? '<div style="height:12px"></div>'
        : `<div style="margin:0 0 6px 0">${regelNaarHtml(regel)}</div>`,
    )
    .join("\n");

  return [
    '<!doctype html>',
    '<html lang="nl"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#F7F6F2">',
    '<div style="max-width:600px;margin:0 auto;padding:24px;',
    'font-family:Calibri,Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;',
    'color:#28251D;background:#F9F8F5">',
    body,
    "</div></body></html>",
  ].join("");
}
