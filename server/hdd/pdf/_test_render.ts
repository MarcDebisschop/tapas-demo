/* Test harness: render both variants from the Loop test fixture. */
import { writeFileSync } from "node:fs";
import { bouwFase2Aggregaat, BoardMemberInput } from "../aggregatie";
import { buildFlagshipInput } from "./mapping";
import { renderFlagshipPdf } from "./index";

const DEMO_LEDEN: BoardMemberInput[] = [
  { id: 1, naam: "Dimitri O", rol: "Co-founder", samenvatting: "Versatile change architect; relational-facilitative edge.", teamscan: { vertrouwen: 4.2, conflict: 4.0, betrokkenheid: 4.3, verantwoordelijkheid: 4.1, resultaten: 4.4 }, energy: { fase: 0, energie: 9 }, talent: { talentFoci: ["Strategy", "Operational", "Interrelational"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Try Hard", "Be Strong", "Hurry Up"], driverRisico: "matig", stratumIndicatie: 4 } },
  { id: 2, naam: "Maarten Bodewes", rol: "Co-founder", samenvatting: "Systems designer and entrepreneurial driver; high role-congruence.", teamscan: { vertrouwen: 4.1, conflict: 4.2, betrokkenheid: 4.0, verantwoordelijkheid: 4.2, resultaten: 4.5 }, energy: { fase: 0, energie: 9 }, talent: { talentFoci: ["Operational", "Innovation", "Strategy"], versnellers: ["Analysis", "Facilitation", "Result-orientation"], drivers: ["Try Hard", "Be Strong", "Hurry Up"], driverRisico: "matig", stratumIndicatie: 4 } },
  { id: 3, naam: "Marloes Mantel", rol: "VP of People (verified)", samenvatting: "End-to-end change leadership; burnout-sensitive if control is lost.", teamscan: { vertrouwen: 4.0, conflict: 3.8, betrokkenheid: 4.1, verantwoordelijkheid: 3.9, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Operational", "Strategy"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Hurry Up", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 3 } },
  { id: 4, naam: "Cedric Schepers", rol: "Management team", samenvatting: "Connector-strategist-doer; people and systems awareness.", teamscan: { vertrouwen: 3.9, conflict: 3.7, betrokkenheid: 4.0, verantwoordelijkheid: 3.8, resultaten: 4.1 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Interrelational", "Strategy", "Operational"], versnellers: ["Analysis", "Impact"], drivers: ["Hurry Up", "Be Strong", "Please Others"], driverRisico: "matig", stratumIndicatie: 3 } },
  { id: 5, naam: "Rob Weston", rol: "Management team", samenvatting: "Strategic clarity + innovation + execution; perfectionism watch-point.", teamscan: { vertrouwen: 4.1, conflict: 4.0, betrokkenheid: 4.2, verantwoordelijkheid: 4.0, resultaten: 4.3 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Strategy", "Innovation", "Operational"], versnellers: ["Analysis", "Facilitation", "Impact"], drivers: ["Be Perfect", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 4 } },
  { id: 6, naam: "Ryan Helps", rol: "Management team", samenvatting: "High-energy transformation leader; sensitive to recognition.", teamscan: { vertrouwen: 4.0, conflict: 3.9, betrokkenheid: 4.1, verantwoordelijkheid: 3.9, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Operational", "Strategy", "Innovation"], versnellers: ["Facilitation", "Result-orientation", "Analysis"], drivers: ["Be Perfect", "Try Hard", "Be Strong"], driverRisico: "hoog", stratumIndicatie: 3 } },
  { id: 7, naam: "Menno Schreuder", rol: "Management team", samenvatting: "Systems thinker; high conscientiousness, low emotional volatility.", teamscan: { vertrouwen: 4.2, conflict: 4.1, betrokkenheid: 4.0, verantwoordelijkheid: 4.1, resultaten: 4.2 }, energy: { fase: 0, energie: 8 }, talent: { talentFoci: ["Strategy", "Operational", "Interrelational"], versnellers: ["Analysis", "Facilitation", "Result-orientation"], drivers: ["Be Perfect", "Be Strong", "Try Hard"], driverRisico: "matig", stratumIndicatie: 3 } },
];

async function main() {
  const agg = bouwFase2Aggregaat({ context: "ma", vereistStratum: 5, leden: DEMO_LEDEN });
  console.log("AGG index=", agg.index, "verdict=", agg.verdict, "n=", agg.n,
    "d1band=", agg.d1TeamHealth.band, "energyBand=", agg.d2Energy.band,
    "cogfit=", agg.cognitiveMap.fit, "teamMax=", agg.cognitiveMap.teamMaxStratum);
  console.log("perPillar=", JSON.stringify((agg.d1TeamHealth.detail as any).perPillar));
  console.log("stratum dist=", JSON.stringify(agg.cognitiveMap.distribution));

  for (const audience of ["investor", "team"] as const) {
    const fi = buildFlagshipInput({
      audience, agg, leden: DEMO_LEDEN,
      company: "Loop Earplugs",
      investorLabel: "the investing party",
      revenueNow: "\u20ac190M", revenueTarget: "\u20ac500M+",
      fteFrom: 300, fteTo: 600,
      date: "June 2026",
    });
    const buf = await renderFlagshipPdf(fi);
    const out = `/tmp/app-flagship-${audience}.pdf`;
    writeFileSync(out, buf);
    console.log("WROTE", out, buf.length, "bytes");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
