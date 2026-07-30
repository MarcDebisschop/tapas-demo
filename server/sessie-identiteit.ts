/**
 * server/sessie-identiteit.ts
 *
 * Auditbevinding H-1 (hoog). Nergens in de codebase werd `session.regenerate()`
 * aangeroepen. Daardoor bleef na een geslaagde login hetzelfde sessie-id gelden
 * als daarvoor: wie een bezoeker eerst een sessiecookie kan laten aannemen
 * (session fixation), erft na diens login de ingelogde sessie.
 *
 * Elk inlogpad zet zijn identiteit vanaf nu via `zetSessieIdentiteit()`. Die
 * doet altijd, en in deze volgorde:
 *   1. session.regenerate()  - nieuw, onvoorspelbaar sessie-id; de oude rij
 *                              wordt in de opslag verwijderd.
 *   2. de identiteitsvelden zetten op de VERSE sessie.
 *   3. session.save()        - zodat de cookie mee terugreist met het antwoord.
 *
 * `wisSessieIdentiteit()` is de tegenhanger voor uitloggen: identiteit weg en
 * het sessie-id vervangen, zodat een teruggespeelde cookie niets meer oplevert.
 */

/** Minimale vorm van het verzoek: alleen de sessie-API die we gebruiken. */
export interface VerzoekMetSessie {
  session?: {
    regenerate(cb: (fout?: any) => void): void;
    save(cb: (fout?: any) => void): void;
    destroy?(cb: (fout?: any) => void): void;
    [key: string]: any;
  };
}

/**
 * Vernieuwt het sessie-id en zet daarna de meegegeven identiteitsvelden.
 * Verwerpt bij een fout in regenerate of save, zodat de route met 500 kan
 * antwoorden in plaats van een schijnbaar geslaagde login te melden.
 */
export function zetSessieIdentiteit(
  req: VerzoekMetSessie,
  velden: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sessie = req.session;
    if (!sessie) return reject(new Error("Geen sessie op het verzoek."));
    sessie.regenerate((fout?: any) => {
      if (fout) return reject(fout);
      for (const [naam, waarde] of Object.entries(velden)) {
        (req.session as any)[naam] = waarde;
      }
      req.session!.save((bewaarFout?: any) => {
        if (bewaarFout) return reject(bewaarFout);
        resolve();
      });
    });
  });
}

/**
 * Wist de opgegeven identiteitsvelden en vervangt het sessie-id. Zo kan een
 * eerder buitgemaakte cookie na uitloggen niet hergebruikt worden.
 */
export function wisSessieIdentiteit(
  req: VerzoekMetSessie,
  velden: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sessie = req.session;
    if (!sessie) return resolve();
    for (const naam of velden) (sessie as any)[naam] = undefined;
    sessie.regenerate((fout?: any) => {
      if (fout) return reject(fout);
      req.session!.save((bewaarFout?: any) => {
        if (bewaarFout) return reject(bewaarFout);
        resolve();
      });
    });
  });
}
