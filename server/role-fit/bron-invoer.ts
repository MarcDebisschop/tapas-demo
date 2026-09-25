// ---------------------------------------------------------------------------
// server/role-fit/bron-invoer.ts
//
// Zet een aangeleverde bron om in platte tekst: geplakte tekst, een
// organisatie-URL, of een PDF-, DOCX- of TXT-bestand (base64).
//
// VEILIGHEID
// - Bestanden: grootte beperkt tot 700 kB, magic bytes gecontroleerd, DOCX
//   met een grens op de uitgepakte grootte (tegen zip-bommen).
// - URL: alleen http en https, geen inloggegevens in de URL, geen private,
//   lokale of link-local adressen (ook niet na DNS-resolutie en niet na een
//   omleiding), time-out en groottegrens. HTML wordt tot tekst herleid; scripts
//   en stijlen verdwijnen.
// - De tekst is data. Er wordt niets uit uitgevoerd.
// ---------------------------------------------------------------------------
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import JSZip from "jszip";

export const MAX_BESTAND_BYTES = 700 * 1024;
export const MAX_TEKST_TEKENS = 60000;
export const MAX_URL_BYTES = 1024 * 1024;
export const URL_TIMEOUT_MS = 8000;
const MAX_DOCX_UITGEPAKT = 5 * 1024 * 1024;

export class BronFout extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function normaliseer(tekst: string): string {
  return tekst
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEKST_TEKENS);
}

export function htmlNaarTekst(html: string): string {
  return normaliseer(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

export function decodeerBase64(b64: string): Buffer {
  const schoon = b64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(schoon)) throw new BronFout("Het bestand is niet correct gecodeerd.");
  const buf = Buffer.from(schoon, "base64");
  if (buf.length === 0) throw new BronFout("Het bestand is leeg.");
  if (buf.length > MAX_BESTAND_BYTES) throw new BronFout("Het bestand is groter dan 700 kB.", 413);
  return buf;
}

export async function tekstUitPdf(buf: Buffer): Promise<string> {
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new BronFout("Dit is geen geldig PDF-bestand.");
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  try {
    const r = await pdfParse(buf);
    return normaliseer(r.text ?? "");
  } catch {
    throw new BronFout("Het PDF-bestand kon niet gelezen worden.");
  }
}

export async function tekstUitDocx(buf: Buffer): Promise<string> {
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new BronFout("Dit is geen geldig Word-bestand (.docx).");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new BronFout("Het Word-bestand kon niet gelezen worden.");
  }
  const doc = zip.file("word/document.xml");
  if (!doc) throw new BronFout("Het Word-bestand bevat geen documenttekst.");
  const grootte = (doc as any)?._data?.uncompressedSize;
  if (typeof grootte === "number" && grootte > MAX_DOCX_UITGEPAKT) throw new BronFout("Het Word-bestand is te groot.", 413);
  const xml = await doc.async("string");
  if (xml.length > MAX_DOCX_UITGEPAKT) throw new BronFout("Het Word-bestand is te groot.", 413);
  return normaliseer(
    xml
      .replace(/<w:tab\/>/g, " ")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"),
  );
}

export function tekstUitTxt(buf: Buffer): string {
  if (buf.includes(0)) throw new BronFout("Dit tekstbestand bevat binaire inhoud.");
  return normaliseer(buf.toString("utf8"));
}

// ---- URL ------------------------------------------------------------------------
export function isPrivaatAdres(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("::ffff:")) return isPrivaatAdres(s.slice(7));
    return s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("ff");
  }
  return true;
}

export async function toetsUrl(ruw: string, resolve: (h: string) => Promise<string[]> = standaardResolve): Promise<URL> {
  let url: URL;
  try {
    url = new URL(ruw);
  } catch {
    throw new BronFout("Ongeldige URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BronFout("Alleen http- en https-adressen zijn toegestaan.");
  if (url.username || url.password) throw new BronFout("Een URL met inloggegevens is niet toegestaan.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    throw new BronFout("Lokale adressen zijn niet toegestaan.");
  const adressen = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (adressen.length === 0) throw new BronFout("Het adres kon niet gevonden worden.");
  if (adressen.some(isPrivaatAdres)) throw new BronFout("Private of interne netwerkadressen zijn niet toegestaan.");
  return url;
}

async function standaardResolve(host: string): Promise<string[]> {
  const r = await lookup(host, { all: true });
  return r.map((x) => x.address);
}

export async function tekstUitUrl(ruw: string, fetcher: typeof fetch = fetch): Promise<{ tekst: string; url: string; titel: string }> {
  let url = await toetsUrl(ruw);
  for (let sprong = 0; sprong < 4; sprong++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), URL_TIMEOUT_MS);
    try {
      const r = await fetcher(url.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "TaPas-RoleFit/1.0", accept: "text/html,text/plain" },
      });
      if (r.status >= 300 && r.status < 400) {
        const naar = r.headers.get("location");
        if (!naar) throw new BronFout("Omleiding zonder doel.");
        url = await toetsUrl(new URL(naar, url).toString());
        continue;
      }
      if (!r.ok) throw new BronFout(`De pagina antwoordde met status ${r.status}.`, 502);
      const type = r.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/xhtml/.test(type)) throw new BronFout("De pagina is geen tekst of HTML.", 415);
      const lengte = Number(r.headers.get("content-length") ?? "0");
      if (lengte > MAX_URL_BYTES) throw new BronFout("De pagina is te groot.", 413);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_URL_BYTES) throw new BronFout("De pagina is te groot.", 413);
      const html = buf.toString("utf8");
      const titel = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? url.hostname).trim().slice(0, 200);
      return { tekst: type.includes("text/plain") ? normaliseer(html) : htmlNaarTekst(html), url: url.toString(), titel };
    } catch (e) {
      if (e instanceof BronFout) throw e;
      throw new BronFout("De pagina kon niet opgehaald worden.", 502);
    } finally {
      clearTimeout(t);
    }
  }
  throw new BronFout("Te veel omleidingen.");
}
