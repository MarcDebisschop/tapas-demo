import { useParams } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Publieke organisatie-evaluatie (route #/evaluatie-organisatie/:token).
 * ------------------------------------------------------------------
 * Implementeert §7 van de bouwspecificatie ("Flow 1 — Organisatie-
 * evaluatie") woordelijk: schermkop, introtekst, contextkaart, vragen A-F,
 * signalen en afronding, bevestiging. Slaat automatisch op bij elke
 * stapwissel (§14.3) en laat terugkeren zonder dataverlies toe: het token
 * blijft geldig tot de definitieve indiening.
 */

const NAVY = "#16384a";

type Sectie = {
  code: string;
  titel: string;
  vragen: Array<{
    code: string;
    tekst: string;
    type: "schaal" | "tekst";
    verplicht: boolean;
    maxLengte?: number;
  }>;
};

type Context = {
  opleidingTitel: string;
  organisatieNaam: string;
  datum: string;
  coachNaam: string;
  aantalDeelnemers: number | null;
  doelstellingSamenvatting: string;
  contactNaam: string;
  contactEmail: string;
};

type OphaalResultaat = {
  evaluatieId: number;
  taal: string;
  context: Context;
  secties: Sectie[];
  evaluatie: {
    status: string;
    basisinfoKlopt: string | null;
    basisinfoToelichting: string | null;
    magContactOpnemen: boolean | null;
    signaalNiveau: string | null;
    signaalTypes: string | null;
    signaalBeschrijving: string | null;
    signaalWilContact: boolean | null;
    signaalContactNaam: string | null;
    signaalContactEmail: string | null;
    signaalContactTelefoon: string | null;
  };
  antwoorden: Array<{ vraagCode: string; numeriekeWaarde: number | null; tekstWaarde: string | null }>;
};

type SignaalType =
  | "inhoudelijke_mismatch"
  | "onvoldoende_voorbereiding"
  | "onprofessionele_communicatie"
  | "onveilige_groepsdynamiek"
  | "grensoverschrijdend_gedrag"
  | "vertrouwelijkheid_privacy"
  | "organisatie_logistiek"
  | "andere";

const SIGNAAL_TYPE_LABELS: Record<SignaalType, string> = {
  inhoudelijke_mismatch: "Inhoudelijke mismatch",
  onvoldoende_voorbereiding: "Onvoldoende voorbereiding",
  onprofessionele_communicatie: "Onprofessionele communicatie",
  onveilige_groepsdynamiek: "Onveilige groepsdynamiek",
  grensoverschrijdend_gedrag: "Grensoverschrijdend gedrag",
  vertrouwelijkheid_privacy: "Vertrouwelijkheid of privacy",
  organisatie_logistiek: "Organisatie/logistiek",
  andere: "Andere",
};

function formatteerDatum(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function EvaluatieOrganisatie() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error, refetch } = useQuery<OphaalResultaat>({
    queryKey: [`/api/evaluations/public/${token}`],
    retry: false,
  });

  const [stap, setStap] = useState(0); // 0 = contextkaart, 1..6 = A..F, 7 = signalen/afronding
  const [waarden, setWaarden] = useState<Record<string, number | null>>({});
  const [teksten, setTeksten] = useState<Record<string, string>>({});
  const [basisinfoKlopt, setBasisinfoKlopt] = useState<"ja" | "gedeeltelijk" | "nee" | "">("");
  const [basisinfoToelichting, setBasisinfoToelichting] = useState("");
  const [signaalNiveau, setSignaalNiveau] = useState<"geen" | "aandachtspunt" | "ernstig">("geen");
  const [signaalTypes, setSignaalTypes] = useState<SignaalType[]>([]);
  const [signaalBeschrijving, setSignaalBeschrijving] = useState("");
  const [signaalWilContact, setSignaalWilContact] = useState<boolean | null>(null);
  const [signaalContactNaam, setSignaalContactNaam] = useState("");
  const [signaalContactEmail, setSignaalContactEmail] = useState("");
  const [signaalContactTelefoon, setSignaalContactTelefoon] = useState("");
  const [magContactOpnemen, setMagContactOpnemen] = useState<boolean | null>(null);
  const [ingevuld, setIngevuld] = useState(false);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const geinitialiseerd = useRef(false);

  useEffect(() => {
    if (!data || geinitialiseerd.current) return;
    geinitialiseerd.current = true;
    const w: Record<string, number | null> = {};
    const t: Record<string, string> = {};
    for (const a of data.antwoorden) {
      if (a.numeriekeWaarde != null) w[a.vraagCode] = a.numeriekeWaarde;
      if (a.tekstWaarde != null) t[a.vraagCode] = a.tekstWaarde;
    }
    setWaarden(w);
    setTeksten(t);
    if (data.evaluatie.basisinfoKlopt) setBasisinfoKlopt(data.evaluatie.basisinfoKlopt as any);
    if (data.evaluatie.basisinfoToelichting) setBasisinfoToelichting(data.evaluatie.basisinfoToelichting);
    if (data.evaluatie.signaalNiveau) setSignaalNiveau(data.evaluatie.signaalNiveau as any);
    if (data.evaluatie.signaalTypes) {
      try {
        setSignaalTypes(JSON.parse(data.evaluatie.signaalTypes));
      } catch {
        /* negeren */
      }
    }
    if (data.evaluatie.signaalBeschrijving) setSignaalBeschrijving(data.evaluatie.signaalBeschrijving);
    if (data.evaluatie.signaalWilContact != null) setSignaalWilContact(data.evaluatie.signaalWilContact);
    if (data.evaluatie.signaalContactNaam) setSignaalContactNaam(data.evaluatie.signaalContactNaam);
    if (data.evaluatie.signaalContactEmail) setSignaalContactEmail(data.evaluatie.signaalContactEmail);
    if (data.evaluatie.signaalContactTelefoon) setSignaalContactTelefoon(data.evaluatie.signaalContactTelefoon);
    if (data.evaluatie.magContactOpnemen != null) setMagContactOpnemen(data.evaluatie.magContactOpnemen);
    // Contactgegevens bij een signaal starten voorgevuld met de gekende contactgegevens.
    if (!data.evaluatie.signaalContactNaam && data.context.contactNaam) setSignaalContactNaam(data.context.contactNaam);
    if (!data.evaluatie.signaalContactEmail && data.context.contactEmail) setSignaalContactEmail(data.context.contactEmail);
  }, [data]);

  const antwoordenPayload = useMemo(() => {
    if (!data) return [];
    return data.secties.flatMap((s) =>
      s.vragen.map((v) => ({
        vraagCode: v.code,
        numeriekeWaarde: v.type === "schaal" ? waarden[v.code] ?? null : null,
        tekstWaarde: v.type === "tekst" ? teksten[v.code] ?? null : null,
      })),
    );
  }, [data, waarden, teksten]);

  const bewaarConcept = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/evaluations/public/${token}/save`, {
        basisinfoKlopt: basisinfoKlopt || undefined,
        basisinfoToelichting: basisinfoToelichting || undefined,
        signaalNiveau,
        signaalTypes,
        signaalBeschrijving: signaalBeschrijving || undefined,
        signaalWilContact: signaalWilContact ?? undefined,
        signaalContactNaam: signaalContactNaam || undefined,
        signaalContactEmail: signaalContactEmail || undefined,
        signaalContactTelefoon: signaalContactTelefoon || undefined,
        magContactOpnemen: magContactOpnemen ?? undefined,
        antwoorden: antwoordenPayload,
      });
    },
  });

  const indienen = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/evaluations/public/${token}/submit`, {
        basisinfoKlopt: basisinfoKlopt || undefined,
        basisinfoToelichting: basisinfoToelichting || undefined,
        signaalNiveau,
        signaalTypes,
        signaalBeschrijving: signaalBeschrijving || undefined,
        signaalWilContact: signaalWilContact ?? undefined,
        signaalContactNaam: signaalContactNaam || undefined,
        signaalContactEmail: signaalContactEmail || undefined,
        signaalContactTelefoon: signaalContactTelefoon || undefined,
        magContactOpnemen: magContactOpnemen ?? undefined,
        antwoorden: antwoordenPayload,
      });
      return res.json();
    },
    onSuccess: () => setIngevuld(true),
    onError: async (err: any) => {
      setFoutmelding("Er ontbreken nog verplichte antwoorden. Kijk de stappen na en vul ze aan.");
    },
  });

  function volgendeStap() {
    setFoutmelding(null);
    bewaarConcept.mutate();
    setStap((s) => s + 1);
  }
  function vorigeStap() {
    setFoutmelding(null);
    setStap((s) => Math.max(0, s - 1));
  }

  if (isLoading) {
    return (
      <Scherm>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Bezig met laden…
        </div>
      </Scherm>
    );
  }

  if (error || !data) {
    return (
      <Scherm>
        <div className="text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
          <p className="font-medium">Deze link is niet (meer) geldig.</p>
          <p className="text-sm text-slate-500">
            De uitnodiging is verlopen, ingetrokken of al ingevuld. Neem contact op met TaPasCity voor een nieuwe link.
          </p>
        </div>
      </Scherm>
    );
  }

  if (ingevuld || data.evaluatie.status === "verzonden") {
    return (
      <Scherm>
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
          <p className="text-lg font-semibold" style={{ color: NAVY }}>
            Dank u. Uw feedback is goed ontvangen.
          </p>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            TaPasCity gebruikt deze informatie om sterke praktijken te behouden en gerichte verbeteringen door te
            voeren.
          </p>
        </div>
      </Scherm>
    );
  }

  const totaalStappen = data.secties.length + 2; // contextkaart + secties + signalen/afronding

  return (
    <Scherm>
      <div className="w-full max-w-lg mx-auto space-y-6">
        <Kop stap={stap} totaal={totaalStappen} contact={data.context.contactNaam} />

        {stap === 0 && (
          <Contextkaart
            context={data.context}
            basisinfoKlopt={basisinfoKlopt}
            setBasisinfoKlopt={setBasisinfoKlopt}
            basisinfoToelichting={basisinfoToelichting}
            setBasisinfoToelichting={setBasisinfoToelichting}
          />
        )}

        {stap >= 1 && stap <= data.secties.length && (
          <VragenSectie
            sectie={data.secties[stap - 1]}
            waarden={waarden}
            setWaarde={(code, v) => setWaarden((w) => ({ ...w, [code]: v }))}
            teksten={teksten}
            setTekst={(code, v) => setTeksten((t) => ({ ...t, [code]: v }))}
          />
        )}

        {stap === data.secties.length + 1 && (
          <SignalenEnAfronding
            signaalNiveau={signaalNiveau}
            setSignaalNiveau={setSignaalNiveau}
            signaalTypes={signaalTypes}
            setSignaalTypes={setSignaalTypes}
            signaalBeschrijving={signaalBeschrijving}
            setSignaalBeschrijving={setSignaalBeschrijving}
            signaalWilContact={signaalWilContact}
            setSignaalWilContact={setSignaalWilContact}
            signaalContactNaam={signaalContactNaam}
            setSignaalContactNaam={setSignaalContactNaam}
            signaalContactEmail={signaalContactEmail}
            setSignaalContactEmail={setSignaalContactEmail}
            signaalContactTelefoon={signaalContactTelefoon}
            setSignaalContactTelefoon={setSignaalContactTelefoon}
            magContactOpnemen={magContactOpnemen}
            setMagContactOpnemen={setMagContactOpnemen}
          />
        )}

        {foutmelding && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {foutmelding}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={vorigeStap} disabled={stap === 0}>
            Vorige
          </Button>
          {stap < data.secties.length + 1 ? (
            <Button onClick={volgendeStap} style={{ backgroundColor: NAVY }}>
              Volgende
            </Button>
          ) : (
            <Button
              onClick={() => indienen.mutate()}
              disabled={indienen.isPending}
              style={{ backgroundColor: NAVY }}
            >
              {indienen.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Evaluatie verzenden
            </Button>
          )}
        </div>
      </div>
    </Scherm>
  );
}

function Scherm({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}

function Kop({ stap, totaal, contact }: { stap: number; totaal: number; contact: string }) {
  const voornaam = (contact ?? "").trim().split(/\s+/)[0] || "";
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
        TaPasCity
      </div>
      {stap === 0 ? (
        <>
          <h1 className="text-xl font-semibold" style={{ color: NAVY }}>
            Hoe beoordeelt u deze TaPasCity-opleiding?
          </h1>
          <p className="text-sm text-slate-500">
            Uw feedback helpt ons onze kwaliteitsstandaard waar te maken. Invultijd: ongeveer 3 minuten.
          </p>
          {voornaam && (
            <p className="text-sm text-slate-600 pt-2">
              Beste {voornaam},<br />
              dank u om kort terug te blikken op deze opleiding. Uw feedback wordt vertrouwelijk verwerkt.
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            Stap {stap + 1} van {totaal}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${((stap + 1) / totaal) * 100}%`, backgroundColor: NAVY }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Contextkaart({
  context,
  basisinfoKlopt,
  setBasisinfoKlopt,
  basisinfoToelichting,
  setBasisinfoToelichting,
}: {
  context: Context;
  basisinfoKlopt: "ja" | "gedeeltelijk" | "nee" | "";
  setBasisinfoKlopt: (v: "ja" | "gedeeltelijk" | "nee") => void;
  basisinfoToelichting: string;
  setBasisinfoToelichting: (v: string) => void;
}) {
  const rijen: Array<[string, string]> = [
    ["OPLEIDING", context.opleidingTitel],
    ["ORGANISATIE", context.organisatieNaam],
    ["DATUM", formatteerDatum(context.datum)],
    ["COACH/FACILITATOR", context.coachNaam || "—"],
    ["AANTAL DEELNEMERS", context.aantalDeelnemers != null ? String(context.aantalDeelnemers) : "—"],
    ["BEVESTIGDE DOELSTELLING", context.doelstellingSamenvatting || "—"],
  ];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <dl className="space-y-3">
        {rijen.map(([label, waarde]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
            <dd className="text-sm text-slate-800">{waarde}</dd>
          </div>
        ))}
      </dl>
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-sm font-medium text-slate-700">Klopt deze basisinformatie?</p>
        <div className="flex gap-2">
          {(["ja", "gedeeltelijk", "nee"] as const).map((optie) => (
            <button
              key={optie}
              type="button"
              onClick={() => setBasisinfoKlopt(optie)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                basisinfoKlopt === optie
                  ? "text-white border-transparent"
                  : "text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
              style={basisinfoKlopt === optie ? { backgroundColor: NAVY } : undefined}
            >
              {optie === "ja" ? "Ja" : optie === "gedeeltelijk" ? "Gedeeltelijk" : "Nee"}
            </button>
          ))}
        </div>
        {(basisinfoKlopt === "gedeeltelijk" || basisinfoKlopt === "nee") && (
          <div className="pt-1">
            <label className="text-sm text-slate-600">Wat klopt niet of verdient nuancering?</label>
            <Textarea
              value={basisinfoToelichting}
              onChange={(e) => setBasisinfoToelichting(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SchaalKeuze({ waarde, onChange }: { waarde: number | null; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Score ${n} van 10`}
          className={`h-9 rounded-md text-sm font-medium border transition-colors ${
            waarde === n ? "text-white border-transparent" : "text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
          style={waarde === n ? { backgroundColor: NAVY } : undefined}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function VragenSectie({
  sectie,
  waarden,
  setWaarde,
  teksten,
  setTekst,
}: {
  sectie: Sectie;
  waarden: Record<string, number | null>;
  setWaarde: (code: string, v: number) => void;
  teksten: Record<string, string>;
  setTekst: (code: string, v: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
        {sectie.code}. {sectie.titel}
      </h2>
      {sectie.vragen.map((v) => (
        <div key={v.code} className="space-y-2">
          <p className="text-sm text-slate-800">
            {v.tekst}
            {!v.verplicht && <span className="text-slate-400"> (optioneel)</span>}
          </p>
          {v.type === "schaal" ? (
            <SchaalKeuze waarde={waarden[v.code] ?? null} onChange={(n) => setWaarde(v.code, n)} />
          ) : (
            <Textarea
              value={teksten[v.code] ?? ""}
              onChange={(e) => setTekst(v.code, e.target.value)}
              maxLength={v.maxLengte}
              rows={3}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SignalenEnAfronding(props: {
  signaalNiveau: "geen" | "aandachtspunt" | "ernstig";
  setSignaalNiveau: (v: "geen" | "aandachtspunt" | "ernstig") => void;
  signaalTypes: SignaalType[];
  setSignaalTypes: (v: SignaalType[]) => void;
  signaalBeschrijving: string;
  setSignaalBeschrijving: (v: string) => void;
  signaalWilContact: boolean | null;
  setSignaalWilContact: (v: boolean) => void;
  signaalContactNaam: string;
  setSignaalContactNaam: (v: string) => void;
  signaalContactEmail: string;
  setSignaalContactEmail: (v: string) => void;
  signaalContactTelefoon: string;
  setSignaalContactTelefoon: (v: string) => void;
  magContactOpnemen: boolean | null;
  setMagContactOpnemen: (v: boolean) => void;
}) {
  const {
    signaalNiveau,
    setSignaalNiveau,
    signaalTypes,
    setSignaalTypes,
    signaalBeschrijving,
    setSignaalBeschrijving,
    signaalWilContact,
    setSignaalWilContact,
    signaalContactNaam,
    setSignaalContactNaam,
    signaalContactEmail,
    setSignaalContactEmail,
    signaalContactTelefoon,
    setSignaalContactTelefoon,
    magContactOpnemen,
    setMagContactOpnemen,
  } = props;

  function toggleType(t: SignaalType) {
    setSignaalTypes(signaalTypes.includes(t) ? signaalTypes.filter((x) => x !== t) : [...signaalTypes, t]);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <p className="text-sm font-medium text-slate-700">
          Wilt u een belangrijk kwaliteits- of veiligheidssignaal delen?
        </p>
        <div className="flex flex-col gap-2">
          {(
            [
              ["geen", "Nee"],
              ["aandachtspunt", "Ja, ik wil een aandachtspunt delen"],
              ["ernstig", "Ja, ik wil een ernstig signaal delen"],
            ] as const
          ).map(([waarde, label]) => (
            <button
              key={waarde}
              type="button"
              onClick={() => setSignaalNiveau(waarde)}
              className={`text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                signaalNiveau === waarde ? "border-transparent text-white" : "text-slate-600 border-slate-200"
              }`}
              style={signaalNiveau === waarde ? { backgroundColor: NAVY } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {signaalNiveau !== "geen" && (
          <div className="pt-2 space-y-4 border-t border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Type signaal</p>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(SIGNAAL_TYPE_LABELS) as SignaalType[]).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm text-slate-600">
                    <Checkbox checked={signaalTypes.includes(t)} onCheckedChange={() => toggleType(t)} />
                    {SIGNAAL_TYPE_LABELS[t]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-600">Beschrijf feitelijk wat er gebeurde.</label>
              <Textarea
                value={signaalBeschrijving}
                onChange={(e) => setSignaalBeschrijving(e.target.value)}
                maxLength={2000}
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <p className="text-sm text-slate-700 mb-1">Wenst u hierover persoonlijk gecontacteerd te worden?</p>
              <JaNeeKeuze waarde={signaalWilContact} onChange={setSignaalWilContact} />
            </div>
            {signaalWilContact && (
              <div className="grid gap-2">
                <Input
                  placeholder="Naam"
                  value={signaalContactNaam}
                  onChange={(e) => setSignaalContactNaam(e.target.value)}
                />
                <Input
                  placeholder="E-mail"
                  value={signaalContactEmail}
                  onChange={(e) => setSignaalContactEmail(e.target.value)}
                />
                <Input
                  placeholder="Telefoon (optioneel)"
                  value={signaalContactTelefoon}
                  onChange={(e) => setSignaalContactTelefoon(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
        <p className="text-sm font-medium text-slate-700">
          Mogen we contact opnemen indien we uw feedback beter willen begrijpen?
        </p>
        <JaNeeKeuze waarde={magContactOpnemen} onChange={setMagContactOpnemen} />
      </div>
    </div>
  );
}

function JaNeeKeuze({ waarde, onChange }: { waarde: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[
        [true, "Ja"],
        [false, "Nee"],
      ].map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v as boolean)}
          className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
            waarde === v ? "text-white border-transparent" : "text-slate-600 border-slate-200"
          }`}
          style={waarde === v ? { backgroundColor: NAVY } : undefined}
        >
          {label as string}
        </button>
      ))}
    </div>
  );
}
