import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bouwRolInhoud,
  kringTekst,
  leesServermelding,
  ROLKEUZES,
  rolTekst,
  vraagtWerkstroom,
} from "@/lib/regiekamer-personen";

interface RolVanPersoon {
  id: number;
  rol: string;
  werkstroomId: number | null;
  werkstroomNaam: string | null;
  toegekendOp: number;
}

interface PersoonInPaneel {
  id: number;
  naam: string;
  email: string;
  actief: boolean;
  aanduiding: string | null;
  partijId: number | null;
  partijNaam: string | null;
  kring: number | null;
  rollen: RolVanPersoon[];
}

interface RolAntwoord {
  rol: { id: number; rol: string };
  waarschuwing: string | null;
}

interface KorteWerkstroom {
  id: number;
  naam: string;
}

interface KortePartij {
  id: number;
  naam: string;
}

const veldKlasse =
  "w-full rounded-[4px] border border-[var(--regie-rand)] bg-[var(--regie-achtergrond)] px-2.5 py-2 text-sm text-[var(--regie-tekst)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--regie-accent)]";

const knopKlasse =
  "rounded-[4px] bg-[var(--regie-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60";

const stilleKnopKlasse =
  "rounded-[4px] border border-[var(--regie-rand)] px-2.5 py-1.5 text-xs font-semibold text-[var(--regie-tekst)] hover:bg-[var(--regie-achtergrond)] disabled:opacity-60";

function datumVanTijdstip(tijdstip: number): string {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(tijdstip));
}

/**
 * De opmerking over belang. Ze blokkeert niets: de handeling is geslaagd. Ze
 * blijft staan tot de gebruiker ze zelf wegklikt, en ze ziet er anders uit dan
 * een weigering: een volle omkadering in de kleur voor iets dat loopt, met een
 * eigen knop.
 */
function Opmerking({
  melding,
  wegklikken,
}: {
  melding: string;
  wegklikken: () => void;
}) {
  return (
    <div
      data-testid="melding-waarschuwing"
      role="status"
      className="mt-2 rounded-[4px] border bg-[var(--regie-achtergrond)] px-3 py-2.5"
      style={{ borderColor: "var(--regie-lopend)" }}
    >
      <p className="text-xs font-semibold" style={{ color: "var(--regie-lopend)" }}>
        Opmerking bij deze toekenning
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--regie-tekst)]">{melding}</p>
      <button type="button" onClick={wegklikken} className={`mt-2 ${stilleKnopKlasse}`}>
        Ik heb het gelezen
      </button>
    </div>
  );
}

function RolRegel({
  rol,
  intrekken,
  bezig,
}: {
  rol: RolVanPersoon;
  intrekken: (rolId: number) => void;
  bezig: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--regie-rand)] py-2">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-[var(--regie-tekst)]">
          {rolTekst(rol.rol)}
          {rol.werkstroomNaam ? `: ${rol.werkstroomNaam}` : ""}
        </span>
        <span className="mt-0.5 block text-[11px] text-[var(--regie-gedempt)]">
          Gekregen op {datumVanTijdstip(rol.toegekendOp)}
        </span>
      </span>
      <button
        type="button"
        className={stilleKnopKlasse}
        disabled={bezig}
        onClick={() => intrekken(rol.id)}
      >
        Rol intrekken
      </button>
    </li>
  );
}

export function PersonenPaneel({
  trajectId,
  werkstromen,
  partijen,
  sluit,
}: {
  trajectId: string;
  werkstromen: KorteWerkstroom[];
  partijen: KortePartij[];
  sluit: () => void;
}) {
  const geheugen = useQueryClient();
  const [naam, zetNaam] = useState("");
  const [email, zetEmail] = useState("");
  const [partijKeuze, zetPartijKeuze] = useState("");
  const [foutBijToevoegen, zetFoutBijToevoegen] = useState<string | null>(null);
  const [gekozenPersoonId, zetGekozenPersoonId] = useState<number | null>(null);
  const [gekozenRol, zetGekozenRol] = useState<string>(ROLKEUZES[0]);
  const [gekozenWerkstroom, zetGekozenWerkstroom] = useState("");
  const [fout, zetFout] = useState<string | null>(null);
  const [waarschuwing, zetWaarschuwing] = useState<string | null>(null);

  useEffect(() => {
    const sluitBijEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") sluit();
    };
    window.addEventListener("keydown", sluitBijEscape);
    return () => window.removeEventListener("keydown", sluitBijEscape);
  }, [sluit]);

  const { data: gelezenPersonen, isLoading } = useQuery<PersoonInPaneel[]>({
    queryKey: ["/api/traject/trajecten", trajectId, "personen"],
    enabled: Boolean(trajectId),
  });

  const personen = gelezenPersonen ?? [];

  const verversLijst = () => {
    void geheugen.invalidateQueries({
      queryKey: ["/api/traject/trajecten", trajectId, "personen"],
    });
  };

  const toevoegen = useMutation({
    mutationFn: async () => {
      const antwoord = await apiRequest(
        "POST",
        `/api/traject/trajecten/${trajectId}/personen`,
        {
          naam,
          email,
          partijId: partijKeuze === "" ? null : Number(partijKeuze),
        },
      );
      return (await antwoord.json()) as PersoonInPaneel;
    },
    onSuccess: () => {
      zetNaam("");
      zetEmail("");
      zetPartijKeuze("");
      zetFoutBijToevoegen(null);
      verversLijst();
    },
    onError: (reden: Error) => zetFoutBijToevoegen(leesServermelding(reden.message)),
  });

  const opInactief = useMutation({
    mutationFn: async (persoonId: number) => {
      await apiRequest("PATCH", `/api/traject/personen/${persoonId}/inactief`, {});
    },
    onSuccess: () => {
      zetFout(null);
      verversLijst();
    },
    onError: (reden: Error) => zetFout(leesServermelding(reden.message)),
  });

  const rolGeven = useMutation({
    mutationFn: async (persoonId: number) => {
      const antwoord = await apiRequest(
        "POST",
        `/api/traject/personen/${persoonId}/rollen`,
        bouwRolInhoud(
          gekozenRol,
          gekozenWerkstroom === "" ? null : Number(gekozenWerkstroom),
        ),
      );
      return (await antwoord.json()) as RolAntwoord;
    },
    onSuccess: (antwoord) => {
      zetFout(null);
      zetWaarschuwing(antwoord.waarschuwing);
      zetGekozenWerkstroom("");
      verversLijst();
    },
    onError: (reden: Error) => zetFout(leesServermelding(reden.message)),
  });

  const rolIntrekken = useMutation({
    mutationFn: async (rolId: number) => {
      await apiRequest("PATCH", `/api/traject/rollen/${rolId}/intrekken`, {});
    },
    onSuccess: () => {
      zetFout(null);
      verversLijst();
    },
    onError: (reden: Error) => zetFout(leesServermelding(reden.message)),
  });

  const bezig =
    opInactief.isPending || rolGeven.isPending || rolIntrekken.isPending;

  return (
    <>
      <button
        type="button"
        aria-label="Sluit het overzicht van de mensen"
        className="fixed inset-0 z-40 cursor-default bg-black/20"
        onClick={sluit}
      />
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Mensen en rollen"
        data-testid="personenpaneel"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--regie-rand)] bg-[var(--regie-vlak)] shadow-2xl md:w-[40vw]"
      >
        <header className="flex min-h-[64px] items-start justify-between gap-4 border-b border-[var(--regie-rand)] px-5 py-4">
          <div>
            <p className="regie-label">Dit traject</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--regie-tekst)]">
              Mensen en rollen
            </h2>
          </div>
          <button
            type="button"
            onClick={sluit}
            data-testid="personenpaneel-sluit"
            aria-label="Sluit dit overzicht"
            className="rounded-sm p-1 text-[var(--regie-gedempt)] hover:bg-[var(--regie-achtergrond)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--regie-accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="border-b border-[var(--regie-rand)] pb-5">
            <h3 className="text-sm font-semibold text-[var(--regie-tekst)]">
              Iemand toevoegen
            </h3>
            <form
              data-testid="persoon-toevoegen"
              className="mt-3 space-y-2"
              onSubmit={(gebeurtenis) => {
                gebeurtenis.preventDefault();
                toevoegen.mutate();
              }}
            >
              <label className="block text-xs font-medium text-[var(--regie-gedempt)]">
                Naam
                <input
                  className={`mt-1 ${veldKlasse}`}
                  value={naam}
                  onChange={(gebeurtenis) => zetNaam(gebeurtenis.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-[var(--regie-gedempt)]">
                Adres voor berichten
                <input
                  className={`mt-1 ${veldKlasse}`}
                  value={email}
                  onChange={(gebeurtenis) => zetEmail(gebeurtenis.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-medium text-[var(--regie-gedempt)]">
                Hoort bij
                <select
                  className={`mt-1 ${veldKlasse}`}
                  value={partijKeuze}
                  onChange={(gebeurtenis) => zetPartijKeuze(gebeurtenis.target.value)}
                >
                  <option value="">Bij geen enkele partij</option>
                  {partijen.map((partij) => (
                    <option key={partij.id} value={String(partij.id)}>
                      {partij.naam}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className={knopKlasse}
                disabled={toevoegen.isPending}
              >
                {toevoegen.isPending ? "Bezig met toevoegen" : "Toevoegen"}
              </button>
            </form>
            {foutBijToevoegen ? (
              <p
                data-testid="melding-weigering-toevoegen"
                role="alert"
                className="mt-2 rounded-[4px] border-l-[3px] bg-[var(--regie-achtergrond)] px-3 py-2 text-xs font-semibold leading-5"
                style={{
                  borderLeftColor: "var(--regie-aandacht)",
                  color: "var(--regie-aandacht)",
                }}
              >
                {foutBijToevoegen}
              </p>
            ) : null}
          </section>

          <section className="pt-5">
            <h3 className="text-sm font-semibold text-[var(--regie-tekst)]">
              Wie er nu bij hoort
            </h3>

            {isLoading ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : null}

            {!isLoading && personen.length === 0 ? (
              <p className="mt-4 rounded-[4px] border border-dashed border-[var(--regie-rand)] p-3 text-sm leading-6 text-[var(--regie-gedempt)]">
                Er staan nog geen mensen in dit traject. Wie u hierboven
                toevoegt, verschijnt in deze lijst.
              </p>
            ) : null}

            <ul className="mt-4 space-y-3">
              {personen.map((persoon) => (
                <li
                  key={persoon.id}
                  data-testid={`persoon-${persoon.id}`}
                  className="rounded-[4px] border border-[var(--regie-rand)] bg-[var(--regie-achtergrond)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--regie-tekst)]">
                        <UserRound
                          className="h-4 w-4 shrink-0 text-[var(--regie-accent)]"
                          aria-hidden="true"
                        />
                        <span className="break-words">{persoon.naam}</span>
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--regie-gedempt)]">
                        {persoon.partijNaam ?? "Bij geen enkele partij"} ·{" "}
                        {kringTekst(persoon.kring)}
                      </p>
                    </div>
                    {persoon.actief ? (
                      <button
                        type="button"
                        className={stilleKnopKlasse}
                        disabled={bezig}
                        onClick={() => opInactief.mutate(persoon.id)}
                      >
                        Doet niet meer mee
                      </button>
                    ) : null}
                  </div>

                  {persoon.aanduiding ? (
                    <p
                      data-testid="persoon-niet-meer-actief"
                      className="mt-2 rounded-[4px] border border-dashed border-[var(--regie-rand)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--regie-gedempt)]"
                    >
                      {persoon.aanduiding}
                    </p>
                  ) : null}

                  {persoon.rollen.length > 0 ? (
                    <ul className="mt-2">
                      {persoon.rollen.map((rol) => (
                        <RolRegel
                          key={rol.id}
                          rol={rol}
                          bezig={bezig}
                          intrekken={(rolId) => rolIntrekken.mutate(rolId)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 border-t border-[var(--regie-rand)] pt-2 text-[11px] text-[var(--regie-gedempt)]">
                      Deze persoon draagt op dit moment geen rol.
                    </p>
                  )}

                  {gekozenPersoonId === persoon.id ? (
                    <div className="mt-3 space-y-2 border-t border-[var(--regie-rand)] pt-3">
                      <label className="block text-xs font-medium text-[var(--regie-gedempt)]">
                        Welke rol
                        <select
                          className={`mt-1 ${veldKlasse}`}
                          value={gekozenRol}
                          onChange={(gebeurtenis) => {
                            zetGekozenRol(gebeurtenis.target.value);
                            zetGekozenWerkstroom("");
                          }}
                        >
                          {ROLKEUZES.map((keuze) => (
                            <option key={keuze} value={keuze}>
                              {rolTekst(keuze)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {vraagtWerkstroom(gekozenRol) ? (
                        <label
                          data-testid="werkstroomkeuze"
                          className="block text-xs font-medium text-[var(--regie-gedempt)]"
                        >
                          Welke werkstroom
                          <select
                            className={`mt-1 ${veldKlasse}`}
                            value={gekozenWerkstroom}
                            onChange={(gebeurtenis) =>
                              zetGekozenWerkstroom(gebeurtenis.target.value)
                            }
                          >
                            <option value="">Nog te kiezen</option>
                            {werkstromen.map((werkstroom) => (
                              <option key={werkstroom.id} value={String(werkstroom.id)}>
                                {werkstroom.naam}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={knopKlasse}
                          disabled={rolGeven.isPending}
                          onClick={() => rolGeven.mutate(persoon.id)}
                        >
                          Rol geven
                        </button>
                        <button
                          type="button"
                          className={stilleKnopKlasse}
                          onClick={() => {
                            zetGekozenPersoonId(null);
                            zetFout(null);
                          }}
                        >
                          Laat maar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`mt-2 ${stilleKnopKlasse}`}
                      onClick={() => {
                        zetGekozenPersoonId(persoon.id);
                        zetGekozenRol(ROLKEUZES[0]);
                        zetGekozenWerkstroom("");
                        zetFout(null);
                      }}
                    >
                      Een rol geven
                    </button>
                  )}

                  {gekozenPersoonId === persoon.id && fout ? (
                    <p
                      data-testid="melding-weigering"
                      role="alert"
                      className="mt-2 rounded-[4px] border-l-[3px] bg-[var(--regie-achtergrond)] px-3 py-2 text-xs font-semibold leading-5"
                      style={{
                        borderLeftColor: "var(--regie-aandacht)",
                        color: "var(--regie-aandacht)",
                      }}
                    >
                      {fout}
                    </p>
                  ) : null}
                  {gekozenPersoonId === persoon.id && waarschuwing ? (
                    <Opmerking
                      melding={waarschuwing}
                      wegklikken={() => zetWaarschuwing(null)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}

export default PersonenPaneel;
