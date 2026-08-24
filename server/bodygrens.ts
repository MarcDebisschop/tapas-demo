// Grens op de omvang van JSON-berichten.
//
// Express leest JSON standaard tot 100 kB en antwoordt daarboven met 413.
// Enkele wegen in dit platform sturen een bestand mee als base64 in het
// JSON-bericht, en die lopen ruim over die grens:
//
//   * het kandidaatrapport van T4Recruitment: een volledig T4P-rapport is als
//     PDF ongeveer 1 MB en als base64 ongeveer 1,3 MB;
//   * de bulk-import: het Excel-bestand gaat op dezelfde manier mee.
//
// De grens voor het hele platform verhogen zou werken, maar dan mag ook de
// aanmeldweg en elke andere route berichten van vele megabytes aannemen. Dat
// is aanvalsoppervlak dat niemand nodig heeft. Daarom krijgt enkel de handvol
// wegen die een bestand ontvangen een ruime grens, en blijft de rest op een
// bescheiden grens staan.
//
// Bewust GEEN ruime grens: PATCH /api/dashboard/:token. Daar gaat een foto
// mee, maar die verkleint de browser eerst tot 512 pixels. Een foto van vele
// megabytes hoort niet in de databank, ook niet wanneer de grens hem zou
// toelaten.

/** Ruime grens, voor de wegen die een bestand als base64 ontvangen. */
export const RUIME_BODYGRENS = "12mb";

/** Bescheiden grens voor al de rest. Tienmaal de standaard van Express. */
export const GEWONE_BODYGRENS = "1mb";

/**
 * De wegen die een bestand als base64 in het JSON-bericht ontvangen.
 * Patronen op req.path, dus zonder queryreeks.
 */
export const RUIME_BODYPADEN: RegExp[] = [
  // Kandidaatrapport uploaden voor de vergelijkende studie van T4Recruitment.
  /^\/api\/t4r\/sessions\/\d+\/candidate\/extract\/?$/,
  // Bulk-import: eerst controleren, dan verwerken. Beide dragen het bestand.
  /^\/api\/admin\/bulk-import\/(preview|verwerk)\/?$/,
];

/** True wanneer deze weg een ruim JSON-bericht mag ontvangen. */
export function magRuimBericht(pad: string): boolean {
  return RUIME_BODYPADEN.some((p) => p.test(pad));
}
