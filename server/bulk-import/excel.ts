// =============================================================================
// server/bulk-import/excel.ts
// -----------------------------------------------------------------------------
// Genereert Excel-templates (.xlsx) per instrument en parseert een geüploade
// .xlsx OF .csv terug naar gevalideerde rijen.
//
// AUDITBEVINDING (kwetsbare afhankelijkheid): dit bestand gebruikte SheetJS
// ("xlsx"). Voor dat pakket staan twee kwetsbaarheden met ernst "hoog" open
// (prototypevervuiling en een regressie bij het uitpakken van bestanden) waarvoor
// in de npm-uitgave GEEN oplossing bestaat - `npm audit fix` kan er niets aan
// doen. Omdat deze module net bestanden inleest die van buiten komen (een beheerder
// uploadt een lijst deelnemers), was dit de gevaarlijkste plaats in het platform
// om zo'n pakket te gebruiken.
//
// De module gebruikt nu:
//   - write-excel-file en read-excel-file (beide MIT, onderhouden) voor .xlsx.
//     Die brengen samen acht pakketten mee en staan zelf zonder open
//     kwetsbaarheden; na de omschakeling meldt de kwetsbaarheidscontrole voor
//     alles wat we meeleveren nul bevindingen.
//   - een eigen, kleine CSV-lezer voor .csv, zodat er voor dat formaat helemaal
//     geen derde partij meer tussen zit.
//
// Het bestandstype wordt bepaald op de inhoud (een .xlsx is een zip en begint met
// "PK"), niet op de bestandsnaam - die kan een gebruiker vrij kiezen.
//
// De kolomkoppen worden STRIKT gevalideerd tegen de template-definitie: als de
// koppen niet exact matchen, komt er een duidelijke foutmelding zodat een
// verkeerd bestandsformaat meteen zichtbaar is.
//
// LET OP: `templateAlsBuffer` en `parseUpload` zijn asynchroon. De aanroepers in
// routes.ts gebruiken `await`.
// =============================================================================

import writeXlsxFile from "write-excel-file/node";
import readXlsxFile from "read-excel-file/node";
import { Readable } from "node:stream";
import {
  type InstrumentTemplate,
  type VeldDef,
  GELDIGE_TALEN,
  STANDAARD_TAAL,
  isGeldigeTaal,
} from "./templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Maximaal aantal datarijen dat we inlezen; beschermt tegen een enorm bestand. */
const MAX_RIJEN = 5000;

export interface ParseFout {
  rij: number; // 1-gebaseerd t.o.v. de datarijen (excl. kop); 0 = kop-/bestandsfout
  kolom: string;
  melding: string;
}

// Eén genormaliseerde datarij: sleutel -> waarde (string) + de ruwe waarden.
export interface BulkRij {
  rij: number;
  waarden: Record<string, string>;
}

export interface ParseResultaat {
  rijen: BulkRij[];
  fouten: ParseFout[];
}

// ---------------------------------------------------------------------------
// Template-generatie
// ---------------------------------------------------------------------------
export async function templateAlsBuffer(tpl: InstrumentTemplate): Promise<Buffer> {
  // Blad 1: "Deelnemers" - kolomkoppen in vet + een voorbeeldrij.
  const koppen = tpl.velden.map((v) => ({ value: v.kolom, fontWeight: "bold" as const }));
  const voorbeeld = tpl.velden.map((v) => ({ value: voorbeeldWaarde(v, tpl) }));
  const breedtes = tpl.velden.map((v) => ({ width: Math.max(v.kolom.length + 2, 18) }));

  // Blad 2: "Instructies" - uitleg per kolom plus algemene toelichting.
  const vet = { fontWeight: "bold" as const };
  const instructieRijen = [
    [{ value: tpl.titel, ...vet }],
    [{ value: tpl.instructie }],
    [],
    [{ value: "Kolom", ...vet }, { value: "Verplicht?", ...vet }, { value: "Uitleg", ...vet }],
    ...tpl.velden.map((v) => [
      { value: v.kolom },
      { value: v.verplicht ? "JA" : "nee" },
      { value: v.hint },
    ]),
    [],
    [{ value: "Toegestane talen" }, { value: GELDIGE_TALEN.join(", ") }],
    [
      { value: "Belangrijk" },
      {
        value:
          "Wijzig de kolomkoppen in het tabblad 'Deelnemers' NIET - ze moeten exact overeenkomen.",
      },
    ],
    [
      { value: "Formaat" },
      { value: "Bewaar als .xlsx of .csv en upload het bestand terug in de bulk-import." },
    ],
  ];

  const uit = await writeXlsxFile(
    [
      { sheet: "Deelnemers", data: [koppen, voorbeeld], columns: breedtes },
      {
        sheet: "Instructies",
        data: instructieRijen,
        columns: [{ width: 24 }, { width: 12 }, { width: 60 }],
      },
    ] as any,
    { buffer: true } as any,
  );
  return await (uit as unknown as { toBuffer(): Promise<Buffer> }).toBuffer();
}

// T4O-ringen (organisatiescan): de kolom 'Ring/Groep' moet exact één van deze
// waarden bevatten. Bewust hier gedefinieerd zodat excel.ts geen server-module
// (schema.ts) hoeft te importeren.
const T4O_RINGEN = ["leiding", "medewerker", "stakeholder"] as const;

function voorbeeldWaarde(v: VeldDef, tpl: InstrumentTemplate): string {
  // Voor de T4O-organisatiescan is 'groep' een ring met vaste waarden.
  if (v.sleutel === "groep" && tpl.instrumentId === "t4o") return "leiding";
  switch (v.sleutel) {
    case "voornaam":
      return "Jan";
    case "achternaam":
      return "Peeters";
    case "email":
      return "jan.peeters@voorbeeld.be";
    case "taal":
      return "nl";
    case "rol":
      return "Teamlid";
    case "ouderNaam":
      return v.verplicht ? "Els Peeters" : "";
    case "ouderEmail":
      return v.verplicht ? "els.peeters@voorbeeld.be" : "";
    case "groep":
      return "Groep A";
    case "functieniveau":
      return "Directie";
    case "team":
      return "Finance";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Inlezen: bestandstype op inhoud, niet op naam
// ---------------------------------------------------------------------------

/** Een .xlsx is een zip-bestand en begint altijd met de bytes "PK\x03\x04". */
function isXlsx(data: Buffer): boolean {
  return data.length > 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

/** Zet een ingelezen cel om naar vlakke tekst, welk celtype het ook is. */
export function celTekst(waarde: unknown): string {
  if (waarde === null || waarde === undefined) return "";
  if (typeof waarde === "string") return waarde.trim();
  if (typeof waarde === "number" || typeof waarde === "boolean") return String(waarde).trim();
  if (waarde instanceof Date) return waarde.toISOString().slice(0, 10);
  const o = waarde as Record<string, unknown>;
  // Formulecel: gebruik het berekende resultaat.
  if ("result" in o) return celTekst(o.result);
  // Hyperlinkcel.
  if ("text" in o && typeof o.text === "string") return o.text.trim();
  if ("value" in o) return celTekst(o.value);
  if ("error" in o) return "";
  return String(waarde).trim();
}

/**
 * Kleine CSV-lezer: verwerkt aanhalingstekens, ingesloten scheidingstekens en
 * regeleinden, en dubbele aanhalingstekens als ontsnapping. Detecteert zelf of het
 * scheidingsteken een komma of een puntkomma is (Excel in het Nederlands schrijft
 * puntkomma's).
 */
export function leesCsv(tekst: string): string[][] {
  const zonderBom = tekst.replace(/^\uFEFF/, "");
  const eersteRegel = zonderBom.split(/\r?\n/)[0] ?? "";
  const scheiding =
    (eersteRegel.match(/;/g)?.length ?? 0) > (eersteRegel.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rijen: string[][] = [];
  let rij: string[] = [];
  let cel = "";
  let inAanhaling = false;

  for (let i = 0; i < zonderBom.length; i++) {
    const teken = zonderBom[i];
    if (inAanhaling) {
      if (teken === '"') {
        if (zonderBom[i + 1] === '"') {
          cel += '"';
          i++;
        } else {
          inAanhaling = false;
        }
      } else {
        cel += teken;
      }
      continue;
    }
    if (teken === '"') {
      inAanhaling = true;
    } else if (teken === scheiding) {
      rij.push(cel);
      cel = "";
    } else if (teken === "\n") {
      rij.push(cel);
      rijen.push(rij);
      rij = [];
      cel = "";
    } else if (teken !== "\r") {
      cel += teken;
    }
  }
  if (cel !== "" || rij.length > 0) {
    rij.push(cel);
    rijen.push(rij);
  }
  // Volledig lege regels weglaten.
  return rijen.filter((r) => r.some((c) => c.trim() !== ""));
}

async function leesMatrix(data: Buffer): Promise<string[][]> {
  if (!isXlsx(data)) {
    return leesCsv(data.toString("utf8")).map((r) => r.map((c) => c.trim()));
  }
  // read-excel-file leest uit een stroom; we geven de al ingelezen buffer door.
  const bladen = (await readXlsxFile(Readable.from(data))) as unknown;
  // Zonder bladkeuze geeft de lezer alle bladen terug; wij nemen het eerste.
  const eersteBlad: unknown[][] = Array.isArray(bladen)
    ? Array.isArray((bladen as unknown[])[0])
      ? (bladen as unknown[][])
      : (((bladen as any[])[0]?.data ?? []) as unknown[][])
    : [];
  const matrix: string[][] = [];
  for (const rij of eersteBlad) {
    if (matrix.length > MAX_RIJEN) break;
    const cellen = (rij ?? []).map((c) => celTekst(c));
    if (cellen.some((c) => c !== "")) matrix.push(cellen);
  }
  return matrix;
}

// ---------------------------------------------------------------------------
// Parsing + validatie
// ---------------------------------------------------------------------------
// `data` is de ruwe bestandsinhoud (Buffer); het type wordt op de inhoud bepaald.
export async function parseUpload(
  data: Buffer,
  tpl: InstrumentTemplate,
): Promise<ParseResultaat> {
  const fouten: ParseFout[] = [];
  const rijen: BulkRij[] = [];

  let matrix: string[][];
  try {
    matrix = await leesMatrix(data);
  } catch {
    return {
      rijen,
      fouten: [
        {
          rij: 0,
          kolom: "",
          melding: "Bestand kon niet gelezen worden. Upload een geldig .xlsx- of .csv-bestand.",
        },
      ],
    };
  }

  if (matrix.length === 0) {
    return { rijen, fouten: [{ rij: 0, kolom: "", melding: "Het bestand is leeg." }] };
  }

  const koppen = (matrix[0] ?? []).map((c) => String(c ?? "").trim());
  const verwacht = tpl.velden.map((v) => v.kolom);

  // STRIKTE kolomvalidatie: exact dezelfde koppen, zelfde volgorde.
  const kopFouten = valideerKoppen(koppen, verwacht);
  if (kopFouten.length > 0) {
    return { rijen, fouten: kopFouten };
  }

  // Map kolomindex -> velddef.
  const kolomIndex: Record<string, number> = {};
  tpl.velden.forEach((v, i) => {
    kolomIndex[v.sleutel] = i;
  });

  for (let r = 1; r < matrix.length; r++) {
    if (r > MAX_RIJEN) {
      fouten.push({
        rij: 0,
        kolom: "",
        melding: `Het bestand bevat meer dan ${MAX_RIJEN} rijen. Splits het op in kleinere bestanden.`,
      });
      break;
    }
    const rowArr = matrix[r] ?? [];
    // Sla volledig lege rijen over.
    const nietLeeg = rowArr.some((c) => String(c ?? "").trim() !== "");
    if (!nietLeeg) continue;

    const dataRijNr = r; // 1-gebaseerd datarijnummer (rij 1 = eerste datarij)
    const waarden: Record<string, string> = Object.create(null);
    for (const v of tpl.velden) {
      waarden[v.sleutel] = String(rowArr[kolomIndex[v.sleutel]] ?? "").trim();
    }

    // Validatie per veld.
    for (const v of tpl.velden) {
      const val = waarden[v.sleutel];
      if (v.verplicht && val === "") {
        fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `'${v.kolom}' is verplicht maar leeg.` });
        continue;
      }
      if (val === "") continue;
      // E-mailvelden.
      if ((v.sleutel === "email" || v.sleutel === "ouderEmail") && !EMAIL_RE.test(val)) {
        fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `'${val}' is geen geldig e-mailadres.` });
      }
      // Taalvalidatie.
      if (v.sleutel === "taal" && !isGeldigeTaal(val.toLowerCase())) {
        fouten.push({
          rij: dataRijNr,
          kolom: v.kolom,
          melding: `Taal '${val}' is ongeldig. Gebruik: ${GELDIGE_TALEN.join(", ")}.`,
        });
      }
      // T4O-ringvalidatie: 'groep' moet leiding/medewerker/stakeholder zijn.
      if (v.sleutel === "groep" && tpl.instrumentId === "t4o") {
        if (!(T4O_RINGEN as readonly string[]).includes(val.toLowerCase())) {
          fouten.push({
            rij: dataRijNr,
            kolom: v.kolom,
            melding: `Ring/Groep '${val}' is ongeldig. Gebruik: ${T4O_RINGEN.join(", ")}.`,
          });
        }
      }
    }

    // Normaliseer de T4O-ring naar kleine letters voor geldige rijen.
    if (tpl.instrumentId === "t4o" && waarden.groep) waarden.groep = waarden.groep.toLowerCase();

    // Normaliseer taal (default nl) voor geldige rijen. Enkel wanneer het
    // template een taal-veld heeft (T4O heeft er geen → waarden.taal undefined).
    if (waarden.taal !== undefined) {
      if (waarden.taal === "") waarden.taal = STANDAARD_TAAL;
      else waarden.taal = waarden.taal.toLowerCase();
    }

    // Ook rijen met fouten toevoegen aan de preview zodat de UI ze kan tonen;
    // de verwerk-stap slaat foutrijen over.
    rijen.push({ rij: dataRijNr, waarden: { ...waarden } });
  }

  return { rijen, fouten };
}

function valideerKoppen(koppen: string[], verwacht: string[]): ParseFout[] {
  const fouten: ParseFout[] = [];
  // Filter trailing lege koppen weg (Excel kan extra lege kolommen meesturen).
  const opgeschoond = [...koppen];
  while (opgeschoond.length > 0 && opgeschoond[opgeschoond.length - 1] === "") {
    opgeschoond.pop();
  }
  if (opgeschoond.length !== verwacht.length) {
    fouten.push({
      rij: 0,
      kolom: "",
      melding: `Verkeerd kolomaantal: ${opgeschoond.length} gevonden, ${verwacht.length} verwacht. Verwachte koppen: ${verwacht.join(" | ")}.`,
    });
    return fouten;
  }
  for (let i = 0; i < verwacht.length; i++) {
    if (opgeschoond[i] !== verwacht[i]) {
      fouten.push({
        rij: 0,
        kolom: opgeschoond[i] ?? "",
        melding: `Kolom ${i + 1} moet '${verwacht[i]}' zijn, maar is '${opgeschoond[i] ?? ""}'. Gebruik de originele template.`,
      });
    }
  }
  return fouten;
}
