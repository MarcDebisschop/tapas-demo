import type { GateResultaat, RodeVlag } from "./schema";

/**
 * Het Go/No-Go-scharnier "onder de motorkap" (gate-evaluator
 * "hdd-onder-de-motorkap").
 * ------------------------------------------------------------------
 * Zodra alle board members Fase 1 (Teamscan + 2MINSCAN) hebben afgerond,
 * evalueert het platform of het traject verdergaat. De logica is
 * risicogestuurd: één HOOG signaal, of twee of meer MIDDEN-signalen, wijst op
 * dysfunctioneel teamgedrag en geeft een "No-Go". Het traject stopt dan na
 * Fase 1: een ploeg die op dit niveau niet functioneert, draagt het plan niet,
 * en een diepteanalyse van de individuele profielen verandert dat niet.
 *
 * Blijven die signalen uit, dan volgt een "Go naar Fase 2". De diepteanalyse
 * heeft dan één centrale vraag: kan deze ploeg de ambitie waarmaken? Het
 * platform ADVISEERT; de investerende organisatie houdt de eindregie en kan het advies
 * gemotiveerd bevestigen of overrulen.
 *
 * Deze prototype-versie werkt op een neutraal Fase 1-aggregaat-contract. De
 * concrete drempels worden samen met Marc gekalibreerd op echte data; ze staan
 * hier expliciet als constanten zodat ze één plek hebben.
 */

// Kalibreerbare drempels (voorstel, samen te ijken op echte afnames).
export const GATE_DREMPELS = {
  waardenfitLaag: 3.0,        // gemiddelde fundamentlaag (1 tot 5) hieronder = risico
  vertrouwensGap: 1.5,        // belang-vs-prestatie gap per element
  minGapElementen: 2,         // aantal elementen boven gap-drempel
  energieBalansNegatief: 0,   // team-energiebalans hieronder = spanning
  spreidingHoog: 1.2,         // onderlinge standaarddeviatie hierboven = spreiding
};

// Neutraal Fase 1-aggregaat dat de gate verwacht. De aggregatie-module vult
// dit uit de Teamscan- en 2MINSCAN-bronnen; ontbrekende velden tellen niet mee.
export interface Fase1Aggregaat {
  waardenfitGemiddelde?: number;       // fundamentlaag (1 tot 5)
  vertrouwenOnderDrempel?: boolean;    // Lencioni-laag 2 onder drempel
  vertrouwensGaps?: number[];          // gap per anatomie-element
  conflictZwak?: boolean;              // lagen 3 en 4 onder drempel
  energieBalans?: number;              // team-energiebalans (negatief = spanning)
  spreiding?: number;                  // onderlinge variantie tussen leden
}

export function verzamelRodeVlaggen(a: Fase1Aggregaat): RodeVlag[] {
  const vlaggen: RodeVlag[] = [];

  if (a.waardenfitGemiddelde != null && a.waardenfitGemiddelde < GATE_DREMPELS.waardenfitLaag) {
    vlaggen.push({
      indicator: "waardenfit",
      ernst: "hoog",
      toelichting:
        "De waarden- en normenfit (fundamentlaag) scoort laag. Zonder gedeelde " +
        "waardenbasis kan vertrouwen er niet duurzaam bovenop ankeren.",
    });
  }

  if (a.vertrouwenOnderDrempel) {
    vlaggen.push({
      indicator: "vertrouwen",
      ernst: "hoog",
      toelichting:
        "Kwetsbaarheidsvertrouwen scoort onder de drempel: het draagvlak voor " +
        "open samenwerking staat onder druk.",
    });
  }

  if (a.vertrouwensGaps) {
    const grote = a.vertrouwensGaps.filter((g) => g > GATE_DREMPELS.vertrouwensGap);
    if (grote.length >= GATE_DREMPELS.minGapElementen) {
      vlaggen.push({
        indicator: "vertrouwens-gap",
        ernst: "hoog",
        toelichting:
          `Op ${grote.length} vertrouwenselementen is de kloof tussen wat het team ` +
          "belangrijk vindt en hoe het presteert groot.",
      });
    }
  }

  if (a.conflictZwak) {
    vlaggen.push({
      indicator: "conflict-betrokkenheid",
      ernst: "midden",
      toelichting:
        "Productief conflict en/of betrokkenheid scoren zwak: besluiten dreigen " +
        "oppervlakkig draagvlak te krijgen.",
    });
  }

  if (a.energieBalans != null && a.energieBalans < GATE_DREMPELS.energieBalansNegatief) {
    vlaggen.push({
      indicator: "energiebalans",
      ernst: "midden",
      toelichting:
        "De energiebalans van het team is negatief, een vroege voorspeller van " +
        "spanning en uitputtingsrisico.",
    });
  }

  if (a.spreiding != null && a.spreiding > GATE_DREMPELS.spreidingHoog) {
    vlaggen.push({
      indicator: "spreiding",
      ernst: "midden",
      toelichting:
        "De onderlinge spreiding tussen board members is hoog: leden ervaren het " +
        "team verschillend, wat op onderhuidse breuklijnen kan wijzen.",
    });
  }

  return vlaggen;
}

export function evalueerGate(a: Fase1Aggregaat): GateResultaat {
  const signalen = verzamelRodeVlaggen(a);
  const hoog = signalen.filter((s) => s.ernst === "hoog").length;
  const midden = signalen.filter((s) => s.ernst === "midden").length;

  // Signalen stoppen het traject; hun afwezigheid opent Fase 2.
  const advies: "go" | "no-go" = hoog >= 1 || midden >= 2 ? "no-go" : "go";

  const samenvatting =
    advies === "no-go"
      ? "Advies: het traject stopt hier. De Fase 1-signalen wijzen op " +
        "dysfunctioneel teamgedrag. Zolang dat niet is opgelost, draagt deze ploeg " +
        "het plan niet, en een diepteanalyse verandert daar niets aan. De " +
        "investerende organisatie houdt de eindregie en kan gemotiveerd toch " +
        "verdiepen."
      : "Advies: start Fase 2. De verkenning laat geen dysfunctionele signalen " +
        "zien, dus de diepteanalyse is zinvol. Haar centrale vraag: kan deze ploeg " +
        "de ambitie waarmaken?";

  return { advies, signalen, samenvatting };
}
