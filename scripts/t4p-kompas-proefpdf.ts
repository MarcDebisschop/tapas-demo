// ---------------------------------------------------------------------------
// scripts/t4p-kompas-proefpdf.ts
//
// Drukt een proefexemplaar van het T4P Business Kompas langs de volledige,
// echte keten: antwoordpatroon -> scoring -> kompascontract -> layout -> PDF.
// Er wordt niets nagebootst en niets afgekort, zodat wat je op het blad ziet
// exact is wat een deelnemer zou krijgen.
//
// Gebruik:  npx tsx scripts/t4p-kompas-proefpdf.ts /tmp/kompas.pdf [az|za]
// ---------------------------------------------------------------------------

import { writeFileSync } from "node:fs";
import { instrument } from "../server/instrument";
import { buildGeneratorContract, type Responses } from "../server/scoring";
import { bouwT4pBusinessKompas, renderT4pBusinessKompasHtml } from "../server/t4p/kompas";
import { renderRapportPdf, sluitPdfBrowser } from "../server/rapport-pdf";

/** Vast, synthetisch antwoordpatroon. Geen persoonsgegevens. */
function maakAntwoorden(richting: "az" | "za"): Responses {
  const responses: Responses = {};
  (instrument.blocks as any[]).forEach((b, i) => {
    const gesorteerd = [...b.items].sort((x: any, y: any) =>
      String(x.construct).localeCompare(String(y.construct), "nl"),
    );
    const eerste = gesorteerd[0];
    const laatste = gesorteerd[gesorteerd.length - 1];
    responses["B" + i] = {
      most: richting === "az" ? eerste.pos : laatste.pos,
      least: richting === "az" ? laatste.pos : eerste.pos,
      itemEnergy: { most: (i % 5) - 2, least: ((i + 2) % 5) - 2 },
      blockEnergy: (i % 3) - 1,
    };
  });
  return responses;
}

async function main(): Promise<void> {
  const pad = process.argv[2] ?? "/tmp/t4p-kompas-proef.pdf";
  const richting = (process.argv[3] as "az" | "za") ?? "az";

  const contract = buildGeneratorContract({
    respondentCode: "T4P-PROEF-001",
    name: "Proefdeelnemer",
    company: "TaPasCity",
    role: "Teamverantwoordelijke",
    consentScope: "profiel-generatie + rapport",
    consentTimestamp: "2026-01-01T00:00:00.000Z",
    responses: maakAntwoorden(richting),
    baseline: 6,
    connection: { q1: 5, q2: 6, q3: 7, q4: 8 },
    taal: "nl",
  });

  const kompas = bouwT4pBusinessKompas(contract as any);
  const html = renderT4pBusinessKompasHtml(kompas as any);
  const pdf = await renderRapportPdf(html);
  writeFileSync(pad, pdf);
  await sluitPdfBrowser();
  console.log(`${pad}  ${(pdf.length / 1024).toFixed(0)} kB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
