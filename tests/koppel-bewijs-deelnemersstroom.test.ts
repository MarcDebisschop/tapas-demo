// ---------------------------------------------------------------------------
// tests/koppel-bewijs-deelnemersstroom.test.ts - Auditbevinding K-1, kant van de
// deelnemer.
//
// Waarom deze test bestaat: het dichten van K-1 mag de gewone deelnemersstroom
// niet stukmaken. De server eist sinds K-1 een bezitsbewijs (de respondentCode
// of het invite-token) op POST /api/afnames/:id/koppel-dashboard. Een deelnemer
// is geen beheerder en mag die code dus niet uit een publieke route kunnen
// opvragen - anders is het "bewijs" geen bewijs meer.
//
// De gekozen weg: de code reist mee in het antwoord van het afronden van deel 2
// (dat antwoord krijgt alleen wie de vragenlijst echt afrondt), deel2.tsx bewaart
// ze in de tabbladopslag, en het eindscherm stuurt ze mee.
//
// Wat deze tests bewijzen:
//   1. De publieke afnameroute geeft de respondentCode NIET aan een niet-beheerder.
//   2. Het afrondantwoord bevat de afnamerij (en dus de code) voor wie afrondt.
//   3. deel2.tsx bewaart de code onder dezelfde sleutel die klaar.tsx uitleest.
//   4. Het eindscherm valt terug op die opgeslagen code en blokkeert het
//      versturen zolang er geen bewijs is.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const lees = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
const afnames = lees("../server/routes/afnames.ts");
const deel2 = lees("../client/src/pages/deel2.tsx");
const klaar = lees("../client/src/pages/klaar.tsx");

describe("K-1: de publieke afnameroute lekt het bewijs niet", () => {
  it("geeft een niet-beheerder geen respondentCode", () => {
    const start = afnames.indexOf('app.get("/api/afnames/:id"');
    expect(start).toBeGreaterThan(-1);
    const route = afnames.slice(start, afnames.indexOf("\n  });", start));
    // Enkel het beheerderspad geeft de volledige rij terug.
    expect(route).toMatch(/adminIdVanSessie\(req\) !== null\) return res\.json\(a\)/);
    const beperkt = route.slice(route.indexOf("res.json({"));
    expect(beperkt).not.toContain("respondentCode");
  });
});

describe("K-1: het bewijs bereikt de deelnemer via het afronden", () => {
  it("het afrondantwoord bevat de afnamerij", () => {
    const start = afnames.indexOf('app.post("/api/afnames/:id/connection"');
    expect(start).toBeGreaterThan(-1);
    const route = afnames.slice(start, start + 9000);
    expect(route).toMatch(/res\.json\(\{ afname: updated/);
  });

  it("deel2 bewaart de code onder de sleutel van klaar.tsx", () => {
    expect(deel2).toMatch(/import \{ bewijsSleutel \} from "@\/pages\/klaar"/);
    expect(deel2).toMatch(/sessionStorage\.setItem\(bewijsSleutel\(id\), code\)/);
    expect(deel2).toMatch(/uitkomst\?\.afname\?\.respondentCode/);
  });

  it("de sleutel is per afname en op een plaats gedefinieerd", () => {
    expect(klaar).toMatch(/export function bewijsSleutel\(afnameId: number\)/);
    expect(klaar).toMatch(/`tapas-afnamebewijs-\$\{afnameId\}`/);
    // Geen tweede, eigen sleutelvorm elders in de client.
    expect(deel2).not.toContain("tapas-afnamebewijs-");
  });
});

describe("K-1: het eindscherm stuurt het bewijs mee of verstuurt niet", () => {
  it("valt terug op de opgeslagen code", () => {
    expect(klaar).toMatch(/const bewijs = data\?\.respondentCode \?\? bewijsUitOpslag\(id\)/);
    expect(klaar).toMatch(/respondentCode: bewijs,/);
  });

  it("blokkeert het versturen zonder bewijs", () => {
    expect(klaar).toMatch(/if \(!emailGeldig \|\| !bewijs\) return;/);
  });

  it("gebruikt de publieke afnameroute, zodat de pagina ook voor een deelnemer werkt", () => {
    expect(klaar).toMatch(/queryKey: \["\/api\/afnames", id\]/);
    expect(klaar).not.toMatch(/queryKey: \["\/api\/admin\/afnames", id\]/);
  });
});
