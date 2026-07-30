/**
 * client/src/lib/afname-bewijs.ts
 *
 * Auditbevinding K-1 (kritiek). De server vraagt op de invul- en koppelroutes van
 * een afname een bezitsbewijs: de onraadbare respondentCode of het invite-token
 * van die afname. Het oplopende id volstaat niet meer.
 *
 * Deze module is de enige plaats waar de webclient dat bewijs bewaart en opvraagt.
 * Opslag gebeurt in de tabbladopslag (sessionStorage), zodat het bewijs verdwijnt
 * wanneer het tabblad sluit en niet in een gedeelde link belandt.
 */

/** Sleutel per afname; ook gebruikt door het eindscherm. */
export function bewijsSleutel(afnameId: number): string {
  return `tapas-afnamebewijs-${afnameId}`;
}

/** Bewaart het bewijs voor deze afname. Mislukken mag de flow nooit blokkeren. */
export function bewaarBewijs(afnameId: number, bewijs: unknown): void {
  if (typeof window === "undefined") return;
  if (typeof bewijs !== "string" || !bewijs.trim()) return;
  try {
    window.sessionStorage.setItem(bewijsSleutel(afnameId), bewijs.trim());
  } catch {
    // Geblokkeerde opslag mag het invullen niet stoppen.
  }
}

/** Het bewaarde bewijs voor deze afname, of null. */
export function haalBewijs(afnameId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(bewijsSleutel(afnameId));
  } catch {
    return null;
  }
}

/**
 * Leest het afname-id uit een API-pad zoals `/api/afnames/12/connection` of
 * `/api/t4sports/afnames/12/info`. Geeft null voor elk ander pad.
 */
export function afnameIdUitPad(pad: string): number | null {
  const m = /^\/api\/(?:t4sports\/)?afnames\/(\d+)(?:\/|$)/.exec(pad);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : null;
}

/**
 * De extra verzoekkop met het bezitsbewijs, als er voor dit pad een bewijs
 * bekend is. Anders een leeg object, zodat de aanroeper hem altijd kan spreiden.
 */
export function bewijsKop(pad: string): Record<string, string> {
  const id = afnameIdUitPad(pad);
  if (id === null) return {};
  const bewijs = haalBewijs(id);
  return bewijs ? { "X-TaPas-Bewijs": bewijs } : {};
}
