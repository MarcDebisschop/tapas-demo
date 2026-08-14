/**
 * De kolom "licentie" op `/admin/toegang`, en de samenvattingsregel erboven.
 *
 * Bouwplan §9.7: "Het scherm `/admin/toegang` suggereert nu controle die niet
 * bestaat. Zodra de poort er is, wordt de suggestie waar — en dan moet het scherm
 * ook laten zien dat er een tweede voorwaarde is."
 *
 * Dat is precies wat hier gebeurt. `poort-platformdelen.ts` legt het feit vast
 * waar dit component op rust: tot de poort er kwam, werden de vlaggen in
 * `toegangen` door geen enkel eindpunt gelezen om iets te weigeren. De
 * schakelaars op dat scherm waren decoratief. Nu doen ze iets — en juist daarom
 * moet ernaast staan dat ze het niet alleen doen.
 *
 * ---------------------------------------------------------------------------
 * Waarom hier geen kleur zonder woorden staat
 * ---------------------------------------------------------------------------
 *
 * Elke stand krijgt een woord mee, niet alleen een tint. Een beheerder die
 * kleurenblind is, moet dit scherm kunnen lezen, en een schermlezer moet er iets
 * mee kunnen. Dat is geen extra: het is de reden dat `LicentieBeeld` een
 * `samenvatting` in woorden teruggeeft in plaats van een cijfer.
 *
 * ---------------------------------------------------------------------------
 * Waarom een leeg beeld hier stil blijft
 * ---------------------------------------------------------------------------
 *
 * Op `/admin/toegang` staan beheerders die nooit met een instrument werken. Bij
 * hen is "geen licentie" geen tekort maar een niet-gestelde vraag. Daarom rendert
 * `buiten_het_register` grijs en zonder aandachtstekens, en zegt het scherm wat
 * het is: deze persoon staat niet in het register van geaccrediteerden.
 */

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BadgeCheck, CircleSlash, Clock, Minus } from "lucide-react";
import type { Taal } from "@shared/i18n";
import { maakKolomVertaler } from "./licentiekolom-teksten";

/** De vorm zoals `GET /api/bekwaamheid/licentiebeeld` hem teruggeeft. */
export type Licentiestand =
  | "buiten_het_register"
  | "geen_licenties"
  | "in_orde"
  | "let_op"
  | "geen_afnamerecht";

export interface LicentieDeelRegel {
  instrumentId: string;
  status: string;
  afnamerecht: boolean;
  reden: string | null;
}

export interface BeheerderLicentiebeeld {
  stand: Licentiestand;
  metAfnamerecht: number;
  zonderAfnamerecht: number;
  metAlert: number;
  metVoorwaarde: number;
  eerstverlopend: { instrumentId: string; geldigTot: string; dagen: number } | null;
  samenvatting: string;
  perInstrument: Array<{
    instrumentId: string;
    status: string;
    afnamerecht: boolean;
    reden: string | null;
    geldigTot: string | null;
    alertActief: boolean;
  }>;
  perPlatformdeel: Record<string, LicentieDeelRegel[]>;
}

export interface LicentiebeeldAntwoord {
  peildatum: string;
  perBeheerder: Record<string, BeheerderLicentiebeeld>;
}

/**
 * De tint per stand.
 *
 * `buiten_het_register` en `geen_licenties` zijn met opzet dezelfde neutrale
 * tint: geen van beide is een fout, en het onderscheid staat in de woorden.
 */
const TINT: Record<Licentiestand, { rand: string; vlak: string; tekst: string }> = {
  buiten_het_register: {
    rand: "border-border",
    vlak: "bg-muted/40",
    tekst: "text-muted-foreground",
  },
  geen_licenties: { rand: "border-border", vlak: "bg-muted/40", tekst: "text-muted-foreground" },
  in_orde: {
    rand: "border-emerald-600/25",
    vlak: "bg-emerald-600/10",
    tekst: "text-emerald-700 dark:text-emerald-400",
  },
  let_op: {
    rand: "border-amber-600/30",
    vlak: "bg-amber-600/10",
    tekst: "text-amber-700 dark:text-amber-400",
  },
  geen_afnamerecht: {
    rand: "border-destructive/25",
    vlak: "bg-destructive/10",
    tekst: "text-destructive",
  },
};

function Teken({ stand }: { stand: Licentiestand }) {
  const klasse = "mr-1 h-3 w-3 shrink-0";
  if (stand === "in_orde") return <BadgeCheck className={klasse} aria-hidden />;
  if (stand === "let_op") return <AlertTriangle className={klasse} aria-hidden />;
  if (stand === "geen_afnamerecht") return <CircleSlash className={klasse} aria-hidden />;
  return <Minus className={klasse} aria-hidden />;
}

/**
 * De samenvattingsregel bij de naam van een beheerder.
 *
 * `beeld` mag ontbreken. Dat gebeurt bij elke beheerder zonder registerrij, en
 * dat is de meerderheid — het eindpunt geeft alleen rijen terug voor mensen die
 * er wél in staan. Zie de kop van `routes-licentiebeeld.ts`.
 */
export function LicentieSamenvatting({
  beeld,
  taal,
  testid,
}: {
  beeld: BeheerderLicentiebeeld | undefined;
  taal: Taal;
  testid: string;
}) {
  const w = maakKolomVertaler(taal);
  const stand: Licentiestand = beeld?.stand ?? "buiten_het_register";
  const tint = TINT[stand];
  const samenvatting = beeld?.samenvatting ?? w("buiten_het_register");

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={testid}>
      <Badge
        variant="outline"
        className={`${tint.rand} ${tint.vlak} ${tint.tekst}`}
        data-testid={`${testid}-stand`}
      >
        <Teken stand={stand} />
        {w(stand)}
      </Badge>
      <span className="text-xs text-muted-foreground" data-testid={`${testid}-tekst`}>
        {samenvatting}
      </span>
      {beeld?.eerstverlopend && beeld.eerstverlopend.dagen >= 0 && (
        <span className="inline-flex items-center text-xs text-muted-foreground">
          <Clock className="mr-1 h-3 w-3" aria-hidden />
          {w("verloopt")} {beeld.eerstverlopend.geldigTot}
        </span>
      )}
    </div>
  );
}

/**
 * De cel naast één schakelaar.
 *
 * Drie uitkomsten, en het onderscheid tussen de laatste twee is hetzelfde
 * onderscheid dat de poort maakt tussen weigeren en niet kunnen toetsen:
 *
 *   • licenties gevonden — status en afnamerecht per instrument
 *   • persoon in het register, geen licentie voor dit deel — een echte leemte
 *   • geen instrument achter dit deel — niets te toetsen, geen tekort
 *
 * `heeftInstrument` komt niet uit een tweede afbeelding in de browser maar uit de
 * vraag of dit platformdeel-id bij íemand in `perPlatformdeel` voorkomt. Zo staat
 * de afbeelding instrument → platformdeel op één plaats: op de server.
 */
export function LicentieCel({
  regels,
  taal,
  heeftInstrument,
  binnenRegister,
  testid,
}: {
  regels: LicentieDeelRegel[] | undefined;
  taal: Taal;
  heeftInstrument: boolean;
  binnenRegister: boolean;
  testid: string;
}) {
  const w = maakKolomVertaler(taal);

  if (!heeftInstrument) {
    return (
      <span className="text-[11px] leading-tight text-muted-foreground" data-testid={testid}>
        {w("geen_instrument")}
      </span>
    );
  }

  if (!regels || regels.length === 0) {
    return (
      <span
        className={`text-[11px] leading-tight ${binnenRegister ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
        data-testid={testid}
      >
        {binnenRegister ? w("geen_licentie_voor_deel") : w("buiten_het_register")}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-0.5 text-[11px] leading-tight" data-testid={testid}>
      {regels.map((r) => (
        <span key={r.instrumentId} className="whitespace-nowrap">
          <span
            className={
              r.afnamerecht ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
            }
          >
            {r.afnamerecht ? w("recht") : w("geen_recht")}
          </span>
          <span className="text-muted-foreground"> · {r.status.replace(/_/g, " ")}</span>
          {r.reden && <span className="block text-muted-foreground">{r.reden}</span>}
        </span>
      ))}
    </span>
  );
}
