// =============================================================================
// server/twominscan/organisatiefotos.ts — portretfoto's van één opgegeven
// pagina op de website van de organisatie zelf.
// -----------------------------------------------------------------------------
// WAAROM DIT ZO ENG BEGRENSD IS
//
// Een foto van een deelnemer in een rapport zetten is prettig voor de lezer,
// maar het blijft een persoonsgegeven. Automatisch het web afzoeken naar een
// foto van iemand is daarom geen weg die dit platform opgaat: er is dan geen
// grondslag, geen bron die de organisatie zelf publiceerde, en geen zekerheid
// dat het de juiste persoon is.
//
// Wat deze route wel doet, is precies de weg die een coach vandaag met de hand
// zou lopen: één pagina openen die de organisatie zélf publiceerde (bijvoorbeeld
// de directie- of teampagina), kijken welke portretten daar staan, en per
// persoon bevestigen welke foto bij wie hoort.
//
// De grenzen staan hieronder in code en niet in een handleiding:
//   - alleen https, alleen de exacte pagina die de coach opgeeft, geen crawl;
//   - zoekmachines, sociale netwerken en fotobanken worden geweigerd;
//   - robots.txt van die website wordt gerespecteerd;
//   - hoogstens 12 afbeeldingen, elk hoogstens 2 MB, alleen echte afbeeldingen;
//   - de bron-URL gaat mee terug en hoort in het rapport te blijven staan;
//   - de server bewaart niets: wat de coach niet bevestigt, verdwijnt.
//
//   POST /api/twominscan/organisatiefotos
//     body { paginaUrl: string, namen?: string[] }
//     -> { bron, host, kandidaten: [{ url, dataUrl, alt, tekst, naamGok, score }] }
// =============================================================================
import type { Express, Request, Response } from "express";
import { z } from "zod";

const schema = z.object({
  paginaUrl: z.string().url(),
  namen: z.array(z.string()).max(50).optional(),
});

/** Geen zoekmachines, sociale netwerken of fotobanken: enkel de eigen website. */
const GEWEIGERDE_HOSTS = [
  "google.", "bing.", "duckduckgo.", "yandex.", "baidu.",
  "facebook.", "instagram.", "linkedin.", "twitter.", "x.com", "tiktok.",
  "pinterest.", "gettyimages.", "shutterstock.", "istockphoto.", "alamy.",
  "youtube.", "flickr.",
];

const MAX_PAGINA_BYTES = 3 * 1024 * 1024;
const MAX_BEELD_BYTES = 2 * 1024 * 1024;
const MAX_KANDIDATEN = 12;
const TIJDSLIMIET_MS = 8000;

export interface FotoKandidaat {
  url: string;
  dataUrl: string;
  alt: string;
  tekst: string;
  naamGok: string | null;
  score: number;
}

function geweigerdeHost(host: string): boolean {
  const h = host.toLowerCase();
  return GEWEIGERDE_HOSTS.some((deel) => h.includes(deel));
}

async function haalTekst(url: string, maxBytes: number): Promise<string> {
  const antwoord = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIJDSLIMIET_MS),
    headers: { "User-Agent": "TaPasCity-2MINSCAN/1.0 (+https://www.tapascity.com)" },
  });
  if (!antwoord.ok) throw new Error(`De pagina antwoordde met status ${antwoord.status}.`);
  const buffer = Buffer.from(await antwoord.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new Error("De pagina is te groot om te lezen.");
  return buffer.toString("utf8");
}

/**
 * Respecteert robots.txt voor onze eigen agent op de gevraagde pagina.
 * Geen robots.txt of een onleesbare robots.txt betekent: toegestaan.
 */
export async function magVolgensRobots(paginaUrl: string): Promise<boolean> {
  const doel = new URL(paginaUrl);
  let regels = "";
  try {
    regels = await haalTekst(`${doel.origin}/robots.txt`, 256 * 1024);
  } catch {
    return true;
  }
  const regelsPerAgent: Record<string, string[]> = {};
  let agent = "";
  for (const rij of regels.split(/\r?\n/)) {
    const schoon = rij.split("#")[0].trim();
    if (!schoon) continue;
    const [sleutelRuw, ...rest] = schoon.split(":");
    const sleutel = sleutelRuw.trim().toLowerCase();
    const waarde = rest.join(":").trim();
    if (sleutel === "user-agent") {
      agent = waarde.toLowerCase();
      regelsPerAgent[agent] = regelsPerAgent[agent] ?? [];
    } else if (sleutel === "disallow" && agent) {
      (regelsPerAgent[agent] = regelsPerAgent[agent] ?? []).push(waarde);
    }
  }
  const vanToepassing = regelsPerAgent["*"] ?? [];
  const pad = doel.pathname || "/";
  return !vanToepassing.some((verbod) => verbod && verbod !== "/" ? pad.startsWith(verbod) : verbod === "/");
}

function naamDelen(naam: string): string[] {
  return naam
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((deel) => deel.length >= 3);
}

/** Hoeveel naamdelen komen voor in de tekst rond de afbeelding of in de alt. */
function scoorNaam(naam: string, tekst: string): number {
  const delen = naamDelen(naam);
  if (!delen.length) return 0;
  const schoon = tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const geraakt = delen.filter((deel) => schoon.includes(deel)).length;
  return geraakt / delen.length;
}

export function zoekAfbeeldingen(html: string, paginaUrl: string): { url: string; alt: string; tekst: string }[] {
  const uit: { url: string; alt: string; tekst: string }[] = [];
  const gezien = new Set<string>();
  const imgRegex = /<img\b[^>]*>/gi;
  let treffer: RegExpExecArray | null;
  while ((treffer = imgRegex.exec(html)) !== null) {
    const tag = treffer[0];
    const src =
      /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bdata-src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bsrcset\s*=\s*["']([^"'\s,]+)/i.exec(tag)?.[1] ??
      "";
    if (!src || src.startsWith("data:")) continue;
    let absoluut: string;
    try {
      absoluut = new URL(src, paginaUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(absoluut) || gezien.has(absoluut)) continue;
    gezien.add(absoluut);
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? "";
    // Tekstvenster rond de afbeelding: daar staat in de praktijk de naam.
    const van = Math.max(0, treffer.index - 400);
    const tot = Math.min(html.length, treffer.index + tag.length + 400);
    const tekst = html
      .slice(van, tot)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    uit.push({ url: absoluut, alt, tekst });
  }
  return uit;
}

async function haalBeeldAlsDataUrl(url: string): Promise<string | null> {
  try {
    const antwoord = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIJDSLIMIET_MS),
      headers: { "User-Agent": "TaPasCity-2MINSCAN/1.0 (+https://www.tapascity.com)" },
    });
    if (!antwoord.ok) return null;
    const soort = (antwoord.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!soort.startsWith("image/") || soort === "image/svg+xml") return null;
    const buffer = Buffer.from(await antwoord.arrayBuffer());
    if (!buffer.byteLength || buffer.byteLength > MAX_BEELD_BYTES) return null;
    return `data:${soort};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export function registerOrganisatiefotoRoutes(app: Express): void {
  app.post("/api/twominscan/organisatiefotos", async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Ongeldige aanvraag" });
    }
    const { paginaUrl, namen = [] } = parsed.data;

    let doel: URL;
    try {
      doel = new URL(paginaUrl);
    } catch {
      return res.status(400).json({ error: "Geen geldige webadres." });
    }
    if (doel.protocol !== "https:") {
      return res.status(400).json({ error: "Alleen een https-adres van de organisatie zelf is toegelaten." });
    }
    if (geweigerdeHost(doel.host)) {
      return res.status(400).json({
        error:
          "Deze weg werkt alleen met een pagina op de website van de organisatie zelf. " +
          "Zoekmachines, sociale netwerken en fotobanken zijn uitgesloten.",
      });
    }

    if (!(await magVolgensRobots(doel.toString()))) {
      return res.status(403).json({ error: "De robots.txt van deze website sluit deze pagina uit." });
    }

    let html: string;
    try {
      html = await haalTekst(doel.toString(), MAX_PAGINA_BYTES);
    } catch (e: any) {
      return res.status(502).json({ error: e?.message ?? "Kon de pagina niet lezen." });
    }

    const gevonden = zoekAfbeeldingen(html, doel.toString())
      // Alleen afbeeldingen van dezelfde website: geen beeld van derden meenemen.
      .filter((beeld) => {
        try {
          return !geweigerdeHost(new URL(beeld.url).host);
        } catch {
          return false;
        }
      })
      .map((beeld) => {
        let naamGok: string | null = null;
        let score = 0;
        for (const naam of namen) {
          const s = Math.max(scoorNaam(naam, beeld.alt), scoorNaam(naam, beeld.tekst));
          if (s > score) {
            score = s;
            naamGok = naam;
          }
        }
        return { ...beeld, naamGok, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_KANDIDATEN);

    const kandidaten: FotoKandidaat[] = [];
    for (const beeld of gevonden) {
      const dataUrl = await haalBeeldAlsDataUrl(beeld.url);
      if (!dataUrl) continue;
      kandidaten.push({
        url: beeld.url,
        dataUrl,
        alt: beeld.alt,
        tekst: beeld.tekst.slice(0, 240),
        naamGok: beeld.score >= 0.5 ? beeld.naamGok : null,
        score: Math.round(beeld.score * 100) / 100,
      });
    }

    return res.json({ bron: doel.toString(), host: doel.host, kandidaten });
  });
}
