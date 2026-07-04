// =============================================================================
// server/bulk-import/excel.ts  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Genereert Excel-templates (.xlsx) per instrument en parseert een geüploade
// .xlsx OF .csv terug naar gevalideerde rijen. Gebruikt SheetJS (xlsx, MIT).
//
// De kolomkoppen worden STRIKT gevalideerd tegen de template-definitie: als de
// koppen niet exact matchen, komt er een duidelijke foutmelding zodat een
// verkeerd bestandsformaat meteen zichtbaar is.
// =============================================================================

import * as XLSX from "xlsx";
import {
  type InstrumentTemplate,
  type VeldDef,
  GELDIGE_TALEN,
  STANDAARD_TAAL,
  isGeldigeTaal,
} from "./templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
export function genereerTemplateWorkbook(tpl: InstrumentTemplate): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: "Deelnemers" — kolomkoppen + 1 voorbeeldrij.
  const koppen = tpl.velden.map((v) => v.kolom);
  const voorbeeld = tpl.velden.map((v) => voorbeeldWaarde(v, tpl));
  const dataSheet = XLSX.utils.aoa_to_sheet([koppen, voorbeeld]);
  // Kolombreedtes voor leesbaarheid.
  dataSheet["!cols"] = tpl.velden.map((v) => ({ wch: Math.max(v.kolom.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, dataSheet, "Deelnemers");

  // Sheet 2: "Instructies" — uitleg per kolom + algemene toelichting.
  const instructieRijen: string[][] = [
    [tpl.titel],
    [tpl.instructie],
    [],
    ["Kolom", "Verplicht?", "Uitleg"],
    ...tpl.velden.map((v) => [v.kolom, v.verplicht ? "JA" : "nee", v.hint]),
    [],
    ["Toegestane talen", GELDIGE_TALEN.join(", ")],
    ["Belangrijk", "Wijzig de kolomkoppen in het tabblad 'Deelnemers' NIET — ze moeten exact overeenkomen."],
    ["Formaat", "Bewaar als .xlsx of .csv en upload het bestand terug in de bulk-import."],
  ];
  const instructieSheet = XLSX.utils.aoa_to_sheet(instructieRijen);
  instructieSheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, instructieSheet, "Instructies");

  return wb;
}

export function templateAlsBuffer(tpl: InstrumentTemplate): Buffer {
  const wb = genereerTemplateWorkbook(tpl);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
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
// Parsing + validatie
// ---------------------------------------------------------------------------
// `data` is de ruwe bestandsinhoud (Buffer). SheetJS detecteert xlsx vs csv
// automatisch op basis van de inhoud.
export function parseUpload(data: Buffer, tpl: InstrumentTemplate): ParseResultaat {
  const fouten: ParseFout[] = [];
  const rijen: BulkRij[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: "buffer" });
  } catch {
    return { rijen, fouten: [{ rij: 0, kolom: "", melding: "Bestand kon niet gelezen worden. Upload een geldig .xlsx- of .csv-bestand." }] };
  }

  const sheetNaam = wb.SheetNames[0];
  if (!sheetNaam) {
    return { rijen, fouten: [{ rij: 0, kolom: "", melding: "Het bestand bevat geen werkbladen." }] };
  }
  const sheet = wb.Sheets[sheetNaam];
  // Als 2D-array van cellen; header = eerste rij.
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });

  if (matrix.length === 0) {
    return { rijen, fouten: [{ rij: 0, kolom: "", melding: "Het bestand is leeg." }] };
  }

  const koppen = (matrix[0] as unknown[]).map((c) => String(c ?? "").trim());
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
    const rowArr = matrix[r] as unknown[];
    // Sla volledig lege rijen over.
    const nietLeeg = rowArr.some((c) => String(c ?? "").trim() !== "");
    if (!nietLeeg) continue;

    const dataRijNr = r; // 1-gebaseerd datarijnummer (rij 1 = eerste datarij)
    const waarden: Record<string, string> = {};
    for (const v of tpl.velden) {
      waarden[v.sleutel] = String(rowArr[kolomIndex[v.sleutel]] ?? "").trim();
    }

    // Validatie per veld.
    let rijHeeftFout = false;
    for (const v of tpl.velden) {
      const val = waarden[v.sleutel];
      if (v.verplicht && val === "") {
        fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `'${v.kolom}' is verplicht maar leeg.` });
        rijHeeftFout = true;
        continue;
      }
      if (val === "") continue;
      // E-mailvelden.
      if ((v.sleutel === "email" || v.sleutel === "ouderEmail") && !EMAIL_RE.test(val)) {
        fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `'${val}' is geen geldig e-mailadres.` });
        rijHeeftFout = true;
      }
      // Taalvalidatie.
      if (v.sleutel === "taal" && !isGeldigeTaal(val.toLowerCase())) {
        fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `Taal '${val}' is ongeldig. Gebruik: ${GELDIGE_TALEN.join(", ")}.` });
        rijHeeftFout = true;
      }
      // T4O-ringvalidatie: 'groep' moet leiding/medewerker/stakeholder zijn.
      if (v.sleutel === "groep" && tpl.instrumentId === "t4o") {
        if (!(T4O_RINGEN as readonly string[]).includes(val.toLowerCase())) {
          fouten.push({ rij: dataRijNr, kolom: v.kolom, melding: `Ring/Groep '${val}' is ongeldig. Gebruik: ${T4O_RINGEN.join(", ")}.` });
          rijHeeftFout = true;
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
    rijen.push({ rij: dataRijNr, waarden });
    void rijHeeftFout;
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
