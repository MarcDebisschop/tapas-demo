import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Network,
  PanelRightClose,
  ShieldCheck,
  X,
} from "lucide-react";
import { AppHeader } from "@/components/Brand";
import { BrandedError } from "@/components/BrandedError";
import { Skeleton } from "@/components/ui/skeleton";

type LijnToestand = "aandacht" | "lopend" | "stil" | "in_orde";
type VraagToestand =
  | "gesteld"
  | "erkend"
  | "in_behandeling"
  | "beantwoord"
  | "gedeeld";

interface Traject {
  id: number;
  naam: string;
  organisatieId: number;
  huidigeFase: number;
  zekerheidstrap: number | null;
  status: string;
  aangemaaktOp: string;
}

interface Fase {
  id: number;
  trajectId: number;
  volgnummer: number;
  naam: string;
  poortomschrijving: string | null;
  poortstatus: string;
  poortGeopendOp: string | null;
}

interface Partij {
  id: number;
  trajectId: number;
  soort: string;
  naam: string;
  ankerpunt: string | null;
  kring: number | null;
  rol: string | null;
}

interface Lijn {
  id: number;
  trajectId: number;
  partijEenId: number;
  partijTweeId: number;
  stiltedrempelDagen: number;
  aangemaaktOp: string;
  toestand: LijnToestand;
  dikte: number;
  stiltemeter: number;
}

interface Werkstroom {
  id: number;
  trajectId: number;
  naam: string;
  leiderPartijId: number | null;
  status: string;
  eerstvolgendeOplevering: string | null;
  eerstvolgendeOpleveringOp: string | null;
  aantalVragen: number;
  aantalAfgehandeld: number;
  voortgang: number;
}

interface Vraag {
  id: number;
  trajectId: number;
  lijnId: number;
  vragerPartijId: number;
  ontvangerPartijId: number;
  werkstroomId: number | null;
  vraagtekst: string;
  kader: string | null;
  antwoordtermijnOp: string | null;
  antwoordKring: number | null;
  toestand: VraagToestand;
  resterendeDagen: number | null;
  isOverschreden: boolean;
}

interface Gebeurtenis {
  id: number;
  trajectId: number;
  lijnId: number;
  tijdstip: string;
  soort: string;
  vaststelling: string;
}

interface VolledigTraject {
  traject: Traject;
  fasen: Fase[];
  partijen: Partij[];
  lijnen: Lijn[];
  werkstromen: Werkstroom[];
  vragen: Vraag[];
  gebeurtenissen: Gebeurtenis[];
}

interface KortTraject {
  id: number;
  naam: string;
  huidigeFase: number;
  status: string;
}

const lijnTeksten: Record<LijnToestand, string> = {
  in_orde: "in orde",
  lopend: "lopend",
  aandacht: "aandacht",
  stil: "stil",
};

const vraagTeksten: Record<VraagToestand, string> = {
  gesteld: "gesteld",
  erkend: "erkend",
  in_behandeling: "in behandeling",
  beantwoord: "beantwoord",
  gedeeld: "gedeeld",
};

const gebeurtenisTeksten: Record<string, string> = {
  gesprek: "Gesprek",
  bericht: "Bericht",
  overleg: "Overleg",
  vaststelling: "Vaststelling",
};

const werkstroomTeksten: Record<string, string> = {
  niet_gestart: "Nog niet gestart",
  lopend: "Lopend",
  geblokkeerd: "Geblokkeerd",
  afgerond: "Afgerond",
};

const poortTeksten: Record<string, string> = {
  gesloten: "Nog niet geopend",
  geopend: "Geopend",
  in_beoordeling: "In beoordeling",
};

const lijnKleuren: Record<LijnToestand, string> = {
  in_orde: "var(--regie-orde)",
  lopend: "var(--regie-lopend)",
  aandacht: "var(--regie-aandacht)",
  stil: "var(--regie-stil)",
};

const vastePosities = [
  { x: 50, y: 16 },
  { x: 19, y: 40 },
  { x: 81, y: 40 },
  { x: 31, y: 79 },
  { x: 69, y: 79 },
  { x: 50, y: 54 },
];

function gewoneTekst(waarde: string | null | undefined, woorden: Record<string, string>) {
  if (!waarde) return "Nog te bepalen";
  return woorden[waarde] ?? "Nog te bepalen";
}

function datum(waarde: string | null, metTijd = false) {
  if (!waarde) return "Nog niet gepland";

  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "short",
    year: metTijd ? "numeric" : undefined,
    hour: metTijd ? "2-digit" : undefined,
    minute: metTijd ? "2-digit" : undefined,
  }).format(new Date(waarde));
}

function partijNaam(partijId: number | null, partijen: Partij[]) {
  return partijen.find((partij) => partij.id === partijId)?.naam ?? "Onbekende partij";
}

function lijnNaam(lijn: Lijn, partijen: Partij[]) {
  return `${partijNaam(lijn.partijEenId, partijen)} en ${partijNaam(lijn.partijTweeId, partijen)}`;
}

function vraagTermijn(vraag: Vraag) {
  if (vraag.isOverschreden) return "Termijn over termijn";
  if (vraag.resterendeDagen === null) return "Geen termijn vastgelegd";
  if (vraag.resterendeDagen === 0) return "Vandaag verwacht";
  if (vraag.resterendeDagen === 1) return "Nog 1 dag";
  return `Nog ${vraag.resterendeDagen} dagen`;
}

function VraagKaartInhoud({
  vraag,
  partijen,
  werkstromen,
}: {
  vraag: Vraag;
  partijen: Partij[];
  werkstromen: Werkstroom[];
}) {
  const werkstroom = werkstromen.find((item) => item.id === vraag.werkstroomId);

  return (
    <>
      <p className="text-sm font-semibold leading-5 text-[var(--regie-tekst)]">
        {vraag.vraagtekst}
      </p>
      {vraag.kader ? (
        <p className="mt-2 text-xs leading-5 text-[var(--regie-gedempt)]">{vraag.kader}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {werkstroom ? (
          <span className="rounded-sm border border-[var(--regie-rand)] px-2 py-0.5 text-[11px] font-medium text-[var(--regie-gedempt)]">
            {werkstroom.naam}
          </span>
        ) : null}
        <span className="rounded-sm border border-[var(--regie-rand)] px-2 py-0.5 text-[11px] font-medium text-[var(--regie-gedempt)]">
          {partijNaam(vraag.vragerPartijId, partijen)} naar {partijNaam(vraag.ontvangerPartijId, partijen)}
        </span>
        {vraag.antwoordKring !== null ? (
          <span className="rounded-sm border border-[var(--regie-rand)] px-2 py-0.5 text-[11px] font-medium text-[var(--regie-gedempt)]">
            Kring {vraag.antwoordKring}
          </span>
        ) : null}
      </div>
      <p
        className="mt-3 text-xs font-semibold"
        style={{ color: vraag.isOverschreden ? "var(--regie-aandacht)" : "var(--regie-gedempt)" }}
      >
        {vraagTermijn(vraag)}
      </p>
    </>
  );
}

function VraagKaart({
  vraag,
  partijen,
  werkstromen,
}: {
  vraag: Vraag;
  partijen: Partij[];
  werkstromen: Werkstroom[];
}) {
  const basisKlasse =
    "rounded-[4px] border border-[var(--regie-rand)] bg-[var(--regie-vlak)] p-3 shadow-[0_1px_1px_rgba(40,37,29,0.04)]";

  if (vraag.isOverschreden) {
    return (
      <article
        data-testid="kaart-over-termijn"
        className={`${basisKlasse} border-l-[3px]`}
        style={{ borderLeftColor: "var(--regie-aandacht)" }}
      >
        <VraagKaartInhoud vraag={vraag} partijen={partijen} werkstromen={werkstromen} />
      </article>
    );
  }

  return (
    <article className={basisKlasse}>
      <VraagKaartInhoud vraag={vraag} partijen={partijen} werkstromen={werkstromen} />
    </article>
  );
}

function KolomTitel({ toestand, aantal }: { toestand: VraagToestand; aantal: number }) {
  const inhoud = (
    <>
      <span>{vraagTeksten[toestand]}</span>
      <span className="text-xs font-medium text-[var(--regie-gedempt)]">{aantal}</span>
    </>
  );

  if (toestand === "in_behandeling") {
    return (
      <h3
        data-testid="toestand-in-behandeling"
        className="flex items-center justify-between text-sm font-semibold text-[var(--regie-tekst)]"
      >
        {inhoud}
      </h3>
    );
  }

  return (
    <h3 className="flex items-center justify-between text-sm font-semibold text-[var(--regie-tekst)]">
      {inhoud}
    </h3>
  );
}

function Vragenbord({ gegevens }: { gegevens: VolledigTraject }) {
  const kolommen: VraagToestand[] = [
    "gesteld",
    "erkend",
    "in_behandeling",
    "beantwoord",
    "gedeeld",
  ];

  return (
    <section aria-labelledby="vragen-titel" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="regie-label">Vragenstroom</p>
          <h2 id="vragen-titel" className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
            Van vraag naar gedeeld antwoord
          </h2>
        </div>
        <p className="max-w-44 text-right text-xs leading-5 text-[var(--regie-gedempt)]">
          Leesbaar per toestand
        </p>
      </div>

      <div className="overflow-x-auto pb-2" data-testid="vragenbord-horizontaal">
        <div className="grid min-w-[940px] grid-cols-5 gap-3">
          {kolommen.map((toestand, index) => {
            const vragen = gegevens.vragen.filter((vraag) => vraag.toestand === toestand);
            const isGezamenlijkMoment = toestand === "gedeeld";

            return (
              <div
                key={toestand}
                className={`min-h-72 border-t pt-3 ${
                  isGezamenlijkMoment ? "border-l border-[var(--regie-rand)] pl-3" : "border-[var(--regie-rand)]"
                }`}
              >
                {index === 3 ? (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--regie-accent)]">
                    Antwoord gereed
                  </p>
                ) : null}
                {isGezamenlijkMoment ? (
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--regie-accent)]">
                    Gezamenlijk moment
                  </p>
                ) : null}
                <KolomTitel toestand={toestand} aantal={vragen.length} />
                <div className="mt-3 space-y-2.5">
                  {vragen.length > 0 ? (
                    vragen.map((vraag) => (
                      <VraagKaart
                        key={vraag.id}
                        vraag={vraag}
                        partijen={gegevens.partijen}
                        werkstromen={gegevens.werkstromen}
                      />
                    ))
                  ) : (
                    <p className="rounded-[4px] border border-dashed border-[var(--regie-rand)] p-3 text-xs leading-5 text-[var(--regie-gedempt)]">
                      Er zijn nog geen vragen in deze kolom. Nieuwe vragen worden zichtbaar zodra ze zijn vastgelegd.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Lijnenkaart({
  gegevens,
  kiesLijn,
  zichtbareLijnen,
}: {
  gegevens: VolledigTraject;
  kiesLijn: (lijn: Lijn) => void;
  zichtbareLijnen: Lijn[];
}) {
  const posities = useMemo(
    () =>
      new Map(
        gegevens.partijen.map((partij, index) => [
          partij.id,
          vastePosities[index % vastePosities.length],
        ]),
      ),
    [gegevens.partijen],
  );
  const opvallendeLijn =
    zichtbareLijnen.find((lijn) => lijn.toestand === "aandacht") ??
    zichtbareLijnen.find((lijn) => lijn.toestand === "stil");

  if (zichtbareLijnen.length === 0) {
    return (
      <section aria-labelledby="netwerk-titel" className="regie-paneel p-4">
        <p className="regie-label">Partijen en lijnen</p>
        <h2 id="netwerk-titel" className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
          Netwerk
        </h2>
        <p className="mt-5 text-sm leading-6 text-[var(--regie-gedempt)]">
          Er zijn nog geen lijnen in dit traject. Partijen en lijnen worden hier zichtbaar zodra ze zijn vastgelegd.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="netwerk-titel" className="regie-paneel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="regie-label">Partijen en lijnen</p>
          <h2 id="netwerk-titel" className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
            Netwerk
          </h2>
        </div>
        <span className="rounded-sm bg-[var(--regie-accent)] px-2 py-1 text-[11px] font-semibold text-white">
          {gegevens.partijen.length} partijen
        </span>
      </div>

      <svg
        viewBox="0 0 100 100"
        className="mt-2 h-[250px] w-full"
        aria-label="Netwerk van partijen en lijnen"
      >
        {zichtbareLijnen.map((lijn) => {
          const van = posities.get(lijn.partijEenId);
          const naar = posities.get(lijn.partijTweeId);
          if (!van || !naar) return null;

          return (
            <g
              key={lijn.id}
              role="button"
              tabIndex={0}
              aria-label={`${lijnNaam(lijn, gegevens.partijen)}, ${lijnTeksten[lijn.toestand]}`}
              className="cursor-pointer outline-none"
              onClick={() => kiesLijn(lijn)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  kiesLijn(lijn);
                }
              }}
            >
              <line
                x1={van.x}
                y1={van.y}
                x2={naar.x}
                y2={naar.y}
                stroke="transparent"
                strokeWidth="10"
              />
              <line
                x1={van.x}
                y1={van.y}
                x2={naar.x}
                y2={naar.y}
                stroke={lijnKleuren[lijn.toestand]}
                strokeWidth={lijn.dikte}
                strokeLinecap="round"
                strokeDasharray={lijn.toestand === "stil" ? "3 3" : undefined}
                pointerEvents="none"
              />
              {lijn.toestand === "aandacht" ? (
                <circle
                  cx={(van.x + naar.x) / 2}
                  cy={(van.y + naar.y) / 2}
                  r="2.4"
                  fill="var(--regie-aandacht)"
                />
              ) : null}
            </g>
          );
        })}
        {gegevens.partijen.map((partij) => {
          const positie = posities.get(partij.id);
          if (!positie) return null;
          return (
            <g key={partij.id} pointerEvents="none">
              <circle
                cx={positie.x}
                cy={positie.y}
                r="7.5"
                fill="var(--regie-vlak)"
                stroke="var(--regie-accent)"
                strokeWidth="0.8"
              />
              <text
                x={positie.x}
                y={positie.y + 0.9}
                textAnchor="middle"
                fontSize="3.1"
                fontWeight="700"
                fill="var(--regie-tekst)"
              >
                {partij.naam.slice(0, 2).toUpperCase()}
              </text>
              <text
                x={positie.x}
                y={positie.y + 11.5}
                textAnchor="middle"
                fontSize="3"
                fill="var(--regie-gedempt)"
              >
                {partij.naam}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[var(--regie-rand)] pt-3 text-xs">
        {(Object.keys(lijnTeksten) as LijnToestand[]).map((toestand) => (
          <div key={toestand} className="flex items-center gap-2 text-[var(--regie-gedempt)]">
            <span
              className={`h-2.5 w-5 ${toestand === "stil" ? "border-t-2 border-dashed" : "rounded-full"}`}
              style={{
                backgroundColor: toestand === "stil" ? "transparent" : lijnKleuren[toestand],
                borderColor: lijnKleuren[toestand],
              }}
            />
            {lijnTeksten[toestand]}
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--regie-rand)] pt-3">
        <p className="regie-label">Alle lijnen</p>
        <ul className="mt-2 space-y-1.5">
          {zichtbareLijnen.map((lijn) => (
            <li key={lijn.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-[4px] px-2 py-2 text-left transition-colors hover:bg-[var(--regie-achtergrond)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--regie-accent)]"
                onClick={() => kiesLijn(lijn)}
              >
                <span className="min-w-0 text-xs font-medium text-[var(--regie-tekst)]">
                  {lijnNaam(lijn, gegevens.partijen)}
                </span>
                <span
                  className="shrink-0 text-[11px] font-semibold"
                  style={{ color: lijnKleuren[lijn.toestand] }}
                >
                  {lijnTeksten[lijn.toestand]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 border-t border-[var(--regie-rand)] pt-3">
        {opvallendeLijn ? (
          <button
            type="button"
            className="w-full rounded-[4px] bg-[var(--regie-achtergrond)] px-3 py-2 text-left text-xs font-semibold text-[var(--regie-tekst)] hover:bg-[var(--regie-rand)]"
            onClick={() => kiesLijn(opvallendeLijn)}
          >
            {opvallendeLijn.toestand === "stil"
              ? `${opvallendeLijn.stiltemeter} dagen stil: ${lijnNaam(opvallendeLijn, gegevens.partijen)}`
              : `Aandacht op de lijn ${lijnNaam(opvallendeLijn, gegevens.partijen)}`}
          </button>
        ) : (
          <p className="text-xs font-semibold text-[var(--regie-orde)]">Alle lijnen zijn in orde.</p>
        )}
      </div>
    </section>
  );
}

function Werkstromen({
  gegevens,
  geselecteerdeWerkstroomId,
  kiesWerkstroom,
}: {
  gegevens: VolledigTraject;
  geselecteerdeWerkstroomId: number | null;
  kiesWerkstroom: (werkstroomId: number) => void;
}) {
  return (
    <section aria-labelledby="werkstromen-titel" className="regie-paneel p-4">
      <p className="regie-label">Werkstromen</p>
      <h2 id="werkstromen-titel" className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
        Afspraken in beweging
      </h2>
      {gegevens.werkstromen.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[var(--regie-gedempt)]">
          Er zijn nog geen werkstromen. Ze verschijnen hier zodra ze voor dit traject zijn vastgelegd.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {gegevens.werkstromen.map((werkstroom) => {
            return (
              <li key={werkstroom.id} className="border-t border-[var(--regie-rand)] pt-3">
                <button
                  type="button"
                  aria-pressed={geselecteerdeWerkstroomId === werkstroom.id}
                  onClick={() => kiesWerkstroom(werkstroom.id)}
                  className={`w-full rounded-[4px] p-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--regie-accent)] ${
                    geselecteerdeWerkstroomId === werkstroom.id
                      ? "bg-[var(--regie-achtergrond)]"
                      : "hover:bg-[var(--regie-achtergrond)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--regie-tekst)]">{werkstroom.naam}</p>
                      <p className="mt-1 text-xs text-[var(--regie-gedempt)]">
                        {gewoneTekst(werkstroom.status, werkstroomTeksten)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--regie-accent)]">
                      {werkstroom.aantalAfgehandeld}/{werkstroom.aantalVragen}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--regie-achtergrond)]"
                    aria-label={`${werkstroom.aantalAfgehandeld} van ${werkstroom.aantalVragen} vragen afgehandeld`}
                  >
                    <div
                      className="h-full rounded-full bg-[var(--regie-accent)]"
                      style={{ width: `${werkstroom.voortgang}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--regie-gedempt)]">
                    {werkstroom.eerstvolgendeOplevering
                      ? `${werkstroom.eerstvolgendeOplevering}: ${datum(werkstroom.eerstvolgendeOpleveringOp)}`
                      : "Nog geen volgende oplevering"}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Vandaag({ gegevens }: { gegevens: VolledigTraject }) {
  const fase =
    gegevens.fasen.find((item) => item.volgnummer === gegevens.traject.huidigeFase) ??
    gegevens.fasen[0];
  const aandacht = [
    ...gegevens.vragen
      .filter((vraag) => vraag.isOverschreden)
      .map((vraag) => ({
        sleutel: `vraag-${vraag.id}`,
        tekst: `Termijn over termijn: ${vraag.vraagtekst}`,
        kleur: "var(--regie-aandacht)",
      })),
    ...gegevens.lijnen
      .filter((lijn) => lijn.toestand === "stil")
      .map((lijn) => ({
        sleutel: `lijn-${lijn.id}`,
        tekst: `Stille lijn: ${lijnNaam(lijn, gegevens.partijen)}`,
        kleur: "var(--regie-stil)",
      })),
  ].slice(0, 5);

  const kringen = Array.from(
    new Set(gegevens.partijen.map((partij) => partij.kring).filter((kring): kring is number => kring !== null)),
  ).sort((een, twee) => een - twee);

  return (
    <aside className="space-y-4" aria-label="Vandaag">
      <section className="regie-paneel p-4">
        <p className="regie-label">Vandaag</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
          {fase ? `Fase ${fase.volgnummer}: ${fase.naam}` : "Fase nog niet bepaald"}
        </h2>
        <div className="mt-4 border-t border-[var(--regie-rand)] pt-3">
          <p className="text-xs font-semibold text-[var(--regie-tekst)]">Poort</p>
          <p className="mt-1 text-xs leading-5 text-[var(--regie-gedempt)]">
            {fase?.poortomschrijving ?? "Er is nog geen poortomschrijving vastgelegd."}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--regie-accent)]">
            {fase ? gewoneTekst(fase.poortstatus, poortTeksten) : "Nog te bepalen"}
          </p>
        </div>
      </section>

      <section className="regie-paneel p-4">
        <p className="regie-label">Aandacht</p>
        {aandacht.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--regie-gedempt)]">
            Er vragen vandaag geen lijnen of termijnen om extra aandacht.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {aandacht.map((item) => (
              <li key={item.sleutel} className="flex items-start gap-2 text-xs leading-5 text-[var(--regie-tekst)]">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: item.kleur }} />
                {item.tekst}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="regie-paneel p-4">
        <p className="regie-label">Geruchtenmeter</p>
        <p className="mt-3 text-sm leading-6 text-[var(--regie-gedempt)]">
          Er zijn nog geen peilingen voor dit traject. Deze weergave wordt beschikbaar zodra die gegevens worden vastgelegd.
        </p>
      </section>

      <section className="regie-paneel p-4">
        <p className="regie-label">Kringen</p>
        {kringen.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {kringen.map((kring) => {
              const aantal = gegevens.partijen.filter((partij) => partij.kring === kring).length;
              return (
                <li key={kring} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[var(--regie-tekst)]">Kring {kring}</span>
                  <span className="text-[var(--regie-gedempt)]">
                    {aantal} {aantal === 1 ? "partij" : "partijen"}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[var(--regie-gedempt)]">
            Er zijn nog geen kringen bij de partijen vastgelegd.
          </p>
        )}
      </section>
    </aside>
  );
}

function LijnDetail({
  lijn,
  gegevens,
  sluit,
}: {
  lijn: Lijn;
  gegevens: VolledigTraject;
  sluit: () => void;
}) {
  useEffect(() => {
    const sluitBijEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") sluit();
    };
    window.addEventListener("keydown", sluitBijEscape);
    return () => window.removeEventListener("keydown", sluitBijEscape);
  }, [sluit]);

  const gebeurtenissen = gegevens.gebeurtenissen.filter((gebeurtenis) => gebeurtenis.lijnId === lijn.id);
  const stil = lijn.toestand === "stil";

  return (
    <>
      <button
        type="button"
        aria-label="Sluit lijndetail"
        className="fixed inset-0 z-40 cursor-default bg-black/20"
        onClick={sluit}
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label={`Detail van ${lijnNaam(lijn, gegevens.partijen)}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--regie-rand)] bg-[var(--regie-vlak)] shadow-2xl md:w-[40vw]"
      >
        <header className="flex min-h-[64px] items-start justify-between gap-4 border-b border-[var(--regie-rand)] px-5 py-4">
          <div>
            <p className="regie-label">Lijndetail</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
              {lijnNaam(lijn, gegevens.partijen)}
            </h2>
          </div>
          <button
            type="button"
            onClick={sluit}
            className="rounded-sm p-1 text-[var(--regie-gedempt)] hover:bg-[var(--regie-achtergrond)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--regie-accent)]"
            aria-label="Sluit detail"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="border-b border-[var(--regie-rand)] pb-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: lijnKleuren[lijn.toestand] }}
              />
              <p className="text-sm font-semibold" style={{ color: lijnKleuren[lijn.toestand] }}>
                {lijnTeksten[lijn.toestand]}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--regie-gedempt)]">
              {stil
                ? `Stil sinds ${lijn.stiltemeter} dagen. De grens staat op ${lijn.stiltedrempelDagen} dagen.`
                : `Deze lijn is ${lijnTeksten[lijn.toestand]}.`}
            </p>
            {stil ? (
              <div className="mt-4 border-l-4 border-dashed border-[var(--regie-stil)] bg-[var(--regie-achtergrond)] px-3 py-2 text-xs font-medium text-[var(--regie-gedempt)]">
                {lijn.stiltemeter} dagen zonder contact
              </div>
            ) : null}
          </section>

          <section className="pt-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[var(--regie-accent)]" />
              <h3 className="text-base font-semibold text-[var(--regie-tekst)]">Chronologie</h3>
            </div>
            {gebeurtenissen.length === 0 ? (
              <p className="mt-4 rounded-[4px] border border-dashed border-[var(--regie-rand)] p-3 text-sm leading-6 text-[var(--regie-gedempt)]">
                Er zijn nog geen gebeurtenissen op deze lijn. Nieuwe vaststellingen worden hier van nieuw naar oud getoond.
              </p>
            ) : (
              <ol className="mt-4 space-y-0">
                {gebeurtenissen.map((gebeurtenis, index) => (
                  <li key={gebeurtenis.id} className="relative grid grid-cols-[24px_1fr] gap-3 pb-5">
                    {index < gebeurtenissen.length - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full border-l border-[var(--regie-rand)]" />
                    ) : null}
                    <span className="relative z-10 mt-1.5 h-3 w-3 rounded-full bg-[var(--regie-accent)]" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--regie-accent)]">
                        {gewoneTekst(gebeurtenis.soort, gebeurtenisTeksten)} · {datum(gebeurtenis.tijdstip, true)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--regie-tekst)]">{gebeurtenis.vaststelling}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

function RegiekamerLaden() {
  return (
    <div className="regiekamer min-h-screen p-5">
      <div className="mx-auto max-w-[1560px] space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-5 xl:grid-cols-[34fr_40fr_26fr]">
          <Skeleton className="h-[440px] w-full" />
          <Skeleton className="h-[640px] w-full" />
          <Skeleton className="h-[530px] w-full" />
        </div>
      </div>
    </div>
  );
}

export function TrajectOverzicht() {
  const { data: trajecten, isLoading, error, refetch } = useQuery<KortTraject[]>({
    queryKey: ["/api/traject/trajecten"],
  });

  if (isLoading) {
    return (
      <div className="regiekamer min-h-screen p-5">
        <Skeleton className="mx-auto h-60 max-w-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <BrandedError
        type="netwerk"
        actiePrimair={{ label: "Opnieuw laden", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="regiekamer min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--regie-accent)]">
          <ArrowLeft className="h-4 w-4" />
          Terug naar beheer
        </Link>
        <p className="regie-label mt-8">Regiekamer</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--regie-tekst)]">Kies een traject</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--regie-gedempt)]">
          Open een traject om partijen, lijnen, werkstromen en vragen in samenhang te bekijken.
        </p>

        {!trajecten || trajecten.length === 0 ? (
          <div className="regie-paneel mt-6 p-5">
            <p className="text-sm leading-6 text-[var(--regie-gedempt)]">
              Er zijn nog geen trajecten in deze organisatie. Ze verschijnen hier zodra ze zijn vastgelegd.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-2">
            {trajecten.map((traject) => (
              <li key={traject.id}>
                <Link
                  href={`/admin/trajecten/${traject.id}`}
                  className="regie-paneel flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--regie-achtergrond)]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--regie-tekst)]">{traject.naam}</span>
                    <span className="mt-1 block text-xs text-[var(--regie-gedempt)]">
                      Huidige fase: {traject.huidigeFase}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--regie-accent)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export function TrajectScherm() {
  const { trajectId } = useParams<{ trajectId: string }>();
  const [gekozenLijn, zetGekozenLijn] = useState<Lijn | null>(null);
  const [geselecteerdeWerkstroomId, zetGeselecteerdeWerkstroomId] = useState<number | null>(null);
  const { data: gegevens, isLoading, error, refetch } = useQuery<VolledigTraject>({
    queryKey: ["/api/traject/trajecten", trajectId],
    enabled: Boolean(trajectId),
  });

  useEffect(() => {
    zetGekozenLijn(null);
    zetGeselecteerdeWerkstroomId(null);
  }, [trajectId]);

  if (isLoading) return <RegiekamerLaden />;
  if (error || !gegevens) {
    return (
      <BrandedError
        type="netwerk"
        actiePrimair={{ label: "Opnieuw laden", onClick: () => void refetch() }}
      />
    );
  }

  const zichtbareLijnen =
    geselecteerdeWerkstroomId === null
      ? gegevens.lijnen
      : gegevens.lijnen.filter((lijn) =>
          gegevens.vragen.some(
            (vraag) =>
              vraag.lijnId === lijn.id && vraag.werkstroomId === geselecteerdeWerkstroomId,
          ),
        );

  const gefilterdeGegevens =
    geselecteerdeWerkstroomId === null
      ? gegevens
      : {
          ...gegevens,
          vragen: gegevens.vragen.filter(
            (vraag) => vraag.werkstroomId === geselecteerdeWerkstroomId,
          ),
        };

  return (
    <div className="regiekamer min-h-screen">
      <header className="border-b border-[var(--regie-rand)] bg-[var(--regie-vlak)]">
        <div className="mx-auto flex min-h-[64px] max-w-[1560px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[var(--regie-accent)] text-white">
              <Network className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="regie-label">Regiekamer</p>
              <h1 className="truncate text-base font-semibold text-[var(--regie-tekst)]">{gegevens.traject.naam}</h1>
            </div>
          </div>
          <Link
            href="/admin/trajecten"
            className="hidden items-center gap-2 text-sm font-semibold text-[var(--regie-accent)] sm:inline-flex"
          >
            Alle trajecten
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-[var(--regie-rand)] pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--regie-rand)] bg-[var(--regie-vlak)] px-2.5 py-1.5 text-xs font-semibold text-[var(--regie-tekst)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--regie-accent)]" />
            Zekerheidstrap {gegevens.traject.zekerheidstrap ?? "nog niet bepaald"}
          </span>
          <span className="text-xs text-[var(--regie-gedempt)]">
            Leesweergave van het traject
          </span>
        </div>

        {geselecteerdeWerkstroomId !== null ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[4px] border border-[var(--regie-rand)] bg-[var(--regie-vlak)] px-3 py-2 text-xs text-[var(--regie-tekst)]">
            <span>
              Filter actief: {gegevens.werkstromen.find((werkstroom) => werkstroom.id === geselecteerdeWerkstroomId)?.naam}
            </span>
            <button
              type="button"
              className="font-semibold text-[var(--regie-accent)] underline-offset-2 hover:underline"
              onClick={() => zetGeselecteerdeWerkstroomId(null)}
            >
              Toon alles
            </button>
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[34fr_minmax(0,40fr)_minmax(0,26fr)]">
          <div className="space-y-5">
            <Lijnenkaart
              gegevens={gegevens}
              kiesLijn={zetGekozenLijn}
              zichtbareLijnen={zichtbareLijnen}
            />
          </div>
          <div className="min-w-0 space-y-5">
            <Werkstromen
              gegevens={gegevens}
              geselecteerdeWerkstroomId={geselecteerdeWerkstroomId}
              kiesWerkstroom={(werkstroomId) =>
                zetGeselecteerdeWerkstroomId((huidig) =>
                  huidig === werkstroomId ? null : werkstroomId,
                )
              }
            />
            <Vragenbord gegevens={gefilterdeGegevens} />
          </div>
          <div className="min-w-0">
            <Vandaag gegevens={gefilterdeGegevens} />
          </div>
        </div>
      </main>

      {gekozenLijn ? (
        <LijnDetail lijn={gekozenLijn} gegevens={gegevens} sluit={() => zetGekozenLijn(null)} />
      ) : null}
    </div>
  );
}

export default TrajectScherm;
