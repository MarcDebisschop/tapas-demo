// Temperamentenwiel — renderer (framework-onafhankelijk, tekent in een <svg>).
//
// Tekent het wiel exact volgens de gemeten mat:
//   - 24 posities van 15°, positie 1 start op 12 uur
//   - per positie VIER radiale kleurbanden = kleurvolgorde 1/2/3 + kostkleur in de kern
//   - bij de acht meng-posities: twee in elkaar grijpende driehoeken op de grens 1/2
//   - optioneel de donkere kernwaas met INNER WHY van de gedrukte mat
//
// Er worden geen kwadranten vlak ingekleurd en geen gradiënten toegepast.

import {
  KLEUR,
  LETTERSTIJL,
  POSITIES,
  RADII,
  SECTOREN,
  positieByWielpositie,
  type Positie,
} from "./posities";

const NS = "http://www.w3.org/2000/svg";
const C = 500; // middelpunt
const STAP = 15; // graden per positie

/** Deelnemer op het wiel. zone blijft null bij een 2MINSCAN-resultaat. */
export interface WielDeelnemer {
  naam: string;
  initialen: string;
  wielpositie: string;
  zone?: "classic" | "accommodating" | null;
}

export interface WielOpties {
  acroniemen?: boolean;
  wielposities?: boolean;
  sectoren?: boolean;
  /** Donkere kernwaas + INNER WHY van de gedrukte mat. Standaard uit. */
  kern?: boolean;
  deelnemers?: WielDeelnemer[];
}

type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(naam: K, attrs: Attrs = {}): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, naam);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}

function pol(hoek: number, r: number): [number, number] {
  const a = ((hoek - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function ringPad(a0: number, a1: number, r0: number, r1: number): string {
  const [x0, y0] = pol(a0, r1);
  const [x1, y1] = pol(a1, r1);
  const [x2, y2] = pol(a1, r0);
  const [x3, y3] = pol(a0, r0);
  const groot = a1 - a0 > 180 ? 1 : 0;
  if (r0 <= 0.5) return `M ${C} ${C} L ${x0} ${y0} A ${r1} ${r1} 0 ${groot} 1 ${x1} ${y1} Z`;
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${groot} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${groot} 0 ${x3} ${y3} Z`;
}

function boogPad(hoek0: number, hoek1: number, r: number): string {
  const [x0, y0] = pol(hoek0, r);
  const [x1, y1] = pol(hoek1, r);
  const groot = Math.abs(hoek1 - hoek0) > 180 ? 1 : 0;
  const richting = hoek1 > hoek0 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${groot} ${richting} ${x1} ${y1}`;
}

/**
 * Meng-markering: driehoek van kleur 2 naar buiten, driehoek van kleur 1 naar
 * binnen. Maten uit de mat: basis 8°, hoogte 36 eenheden aan beide zijden.
 */
function mengDriehoeken(g: SVGGElement, midden: number, p: Positie): void {
  const grens = RADII.band2[1];
  const halfHoek = 4;
  const hoogte = 36;
  const buiten = [pol(midden - halfHoek, grens), pol(midden + halfHoek, grens), pol(midden, grens + hoogte)];
  const binnen = [pol(midden - halfHoek, grens), pol(midden + halfHoek, grens), pol(midden, grens - hoogte)];
  g.appendChild(el("polygon", { points: buiten.map((q) => q.join(",")).join(" "), fill: KLEUR[p.volgorde[1]] }));
  g.appendChild(el("polygon", { points: binnen.map((q) => q.join(",")).join(" "), fill: KLEUR[p.volgorde[0]] }));
}

/** Bouwt het volledige wiel in het meegegeven svg-element. */
export function bouwWiel(svg: SVGSVGElement, opties: WielOpties = {}): SVGSVGElement {
  const o = {
    acroniemen: true,
    wielposities: true,
    sectoren: true,
    kern: false,
    deelnemers: [] as WielDeelnemer[],
    ...opties,
  };
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", "0 0 1000 1000");

  const defs = el("defs");
  svg.appendChild(defs);
  const gBanden = el("g");
  svg.appendChild(gBanden);

  POSITIES.forEach((p) => {
    const a0 = (p.nr - 1) * STAP;
    const a1 = a0 + STAP;
    const midden = a0 + STAP / 2;
    [RADII.band1, RADII.band2, RADII.band3, RADII.band4].forEach((rr, i) => {
      gBanden.appendChild(
        el("path", { d: ringPad(a0, a1, rr[0], rr[1]), fill: KLEUR[p.volgorde[i]], stroke: "none" }),
      );
    });
    if (p.gemengd) mengDriehoeken(gBanden, midden, p);
  });

  // Donkere kernwaas van de gedrukte mat: alleen wanneer de kern expliciet aan
  // staat, zodat de kleurlagen in het binnengebied volledig zichtbaar blijven.
  if (o.kern) {
    gBanden.appendChild(el("circle", { cx: C, cy: C, r: RADII.schaduw, fill: "#000", opacity: 0.36 }));
  }

  const gLijn = el("g", { stroke: "#14110f", "stroke-width": 1.2, fill: "none" });
  for (let i = 0; i < 24; i++) {
    const a = i * STAP;
    const [x0, y0] = pol(a, RADII.band3[0]);
    const [x1, y1] = pol(a, RADII.band1[1]);
    gLijn.appendChild(el("line", { x1: x0, y1: y0, x2: x1, y2: y1, opacity: 0.6 }));
  }
  (
    [
      [RADII.band1[1], 2.5],
      [RADII.band1[0], 2],
      [RADII.band2[0], 2],
      [RADII.band3[0], 2],
    ] as Array<[number, number]>
  ).forEach(([r, w]) => gLijn.appendChild(el("circle", { cx: C, cy: C, r, "stroke-width": w })));
  svg.appendChild(gLijn);

  if (o.kern) {
    const gk = el("g");
    gk.appendChild(
      el("circle", { cx: C, cy: C, r: RADII.band4[1], fill: "none", stroke: "#f4f1ec", "stroke-width": 2, opacity: 0.7 }),
    );
    (["INNER", "WHY"] as const).forEach((woord, i) => {
      const t = el("text", {
        x: C,
        y: C - 4 + i * 22,
        "text-anchor": "middle",
        fill: "#f4f1ec",
        "font-size": 17,
        "letter-spacing": 2.5,
        "font-weight": 600,
      });
      t.textContent = woord;
      gk.appendChild(t);
    });
    [45, 135, 225, 315].forEach((a) => {
      const [x, y] = pol(a, 44);
      gk.appendChild(el("circle", { cx: x, cy: y, r: 8.5, fill: "#f4f1ec", opacity: 0.55 }));
    });
    svg.appendChild(gk);
  }

  // acroniemband
  const gLabel = el("g");
  gLabel.appendChild(
    el("circle", {
      cx: C,
      cy: C,
      r: (RADII.labelband[0] + RADII.labelband[1]) / 2,
      fill: "none",
      stroke: "#f0efed",
      "stroke-width": RADII.labelband[1] - RADII.labelband[0],
    }),
  );
  [RADII.labelband[0], RADII.labelband[1]].forEach((r) =>
    gLabel.appendChild(el("circle", { cx: C, cy: C, r, fill: "none", stroke: "#14110f", "stroke-width": 1.2 })),
  );
  svg.appendChild(gLabel);

  // wielpositieband
  const gPos = el("g");
  gPos.appendChild(
    el("circle", {
      cx: C,
      cy: C,
      r: (RADII.positieband[0] + RADII.positieband[1]) / 2,
      fill: "none",
      stroke: "#e6e3de",
      "stroke-width": RADII.positieband[1] - RADII.positieband[0],
    }),
  );
  svg.appendChild(gPos);

  function boogTekst(
    parent: SVGGElement,
    id: string,
    r: number,
    midden: number,
    tekst: string,
    attrs: Record<string, string | number | boolean | undefined> & { perLetter?: boolean },
  ): void {
    const onder = midden > 90 && midden < 270;
    const marge = 7.4;
    const d = onder ? boogPad(midden + marge, midden - marge, r) : boogPad(midden - marge, midden + marge, r);
    defs.appendChild(el("path", { id, d, fill: "none" }));
    const { perLetter, ...rest } = attrs;
    const t = el("text", { "text-anchor": "middle", ...(rest as Attrs) });
    const tp = el("textPath", { href: `#${id}`, startOffset: "50%" });
    tp.setAttribute("xlink:href", `#${id}`);
    if (perLetter) {
      // N magenta, O cyaan, overige letters bijna zwart (matconventie)
      Array.from(tekst).forEach((teken) => {
        const ts = el("tspan", { fill: LETTERSTIJL[teken] ?? LETTERSTIJL.basis });
        if (LETTERSTIJL[teken]) ts.setAttribute("font-weight", "800");
        ts.textContent = teken;
        tp.appendChild(ts);
      });
    } else {
      tp.textContent = tekst;
    }
    t.appendChild(tp);
    parent.appendChild(t);
  }

  POSITIES.forEach((p) => {
    const midden = (p.nr - 1) * STAP + STAP / 2;
    const onder = midden > 90 && midden < 270;
    if (o.acroniemen) {
      boogTekst(
        gLabel,
        `tw-lab-${p.nr}`,
        onder ? RADII.labelband[0] + 13 : RADII.labelband[0] + 24,
        midden,
        p.acroniem,
        { fill: LETTERSTIJL.basis, "font-size": 16.5, "font-weight": 600, "letter-spacing": 0.4, perLetter: true },
      );
    }
    if (o.wielposities) {
      boogTekst(
        gPos,
        `tw-wp-${p.nr}`,
        onder ? RADII.positieband[0] + 8 : RADII.positieband[0] + 18,
        midden,
        p.wielpositie,
        { fill: "#3c3a38", "font-size": 13.5, "font-weight": 600, "letter-spacing": 0.6 },
      );
    }
  });

  // grijze tickband met sectorgrenzen op 22,5 + k*45 graden
  const gTick = el("g");
  gTick.appendChild(
    el("circle", {
      cx: C,
      cy: C,
      r: (RADII.tickband[0] + RADII.tickband[1]) / 2,
      fill: "none",
      stroke: "#a1a1a1",
      "stroke-width": RADII.tickband[1] - RADII.tickband[0],
    }),
  );
  for (let k = 0; k < 8; k++) {
    const a = 22.5 + k * 45;
    const [x0, y0] = pol(a, RADII.tickband[0]);
    const [x1, y1] = pol(a, RADII.tickband[1]);
    gTick.appendChild(el("line", { x1: x0, y1: y0, x2: x1, y2: y1, stroke: "#14110f", "stroke-width": 3 }));
  }
  svg.appendChild(gTick);

  if (o.sectoren) {
    const gS = el("g");
    SECTOREN.forEach((s) => {
      const [x, y] = pol(s.hoek, (RADII.sectorband[0] + RADII.sectorband[1]) / 2);
      const t = el("text", {
        x,
        y: y + 8,
        "text-anchor": "middle",
        fill: "#1c1a19",
        "font-size": 24,
        "font-weight": 700,
      });
      t.textContent = String(s.nr);
      gS.appendChild(t);
    });
    svg.appendChild(gS);
  }

  if (o.deelnemers.length) tekenDeelnemers(svg, o.deelnemers);
  return svg;
}

/**
 * Deelnemers op het wiel. De radiale plaatsing is GEEN kleurbetekenis: de
 * markers liggen in een aparte markerzone. zone 'classic' = buitenste helft,
 * 'accommodating' = binnenste helft, onbekend = capsule over beide, omdat de
 * 2MINSCAN die nuance niet meet.
 */
export function tekenDeelnemers(svg: SVGSVGElement, deelnemers: WielDeelnemer[]): void {
  const g = el("g", { class: "deelnemers" });
  const perPositie: Record<number, WielDeelnemer[]> = {};
  deelnemers.forEach((d) => {
    const p = positieByWielpositie(d.wielpositie);
    if (!p) return;
    (perPositie[p.nr] = perPositie[p.nr] ?? []).push(d);
  });

  Object.entries(perPositie).forEach(([nr, lijst]) => {
    const midden = (Number(nr) - 1) * STAP + STAP / 2;
    lijst.forEach((d, i) => {
      const spreiding = lijst.length > 1 ? (i - (lijst.length - 1) / 2) * 4.6 : 0;
      const hoek = midden + spreiding;
      const rBuiten = RADII.markerBuiten;
      const rBinnen = RADII.markerBinnen;
      if (!d.zone) {
        const [xa, ya] = pol(hoek, rBuiten);
        const [xb, yb] = pol(hoek, rBinnen);
        g.appendChild(
          el("line", { x1: xa, y1: ya, x2: xb, y2: yb, stroke: "#ffffff", "stroke-width": 42, "stroke-linecap": "round" }),
        );
        g.appendChild(
          el("line", {
            x1: xa,
            y1: ya,
            x2: xb,
            y2: yb,
            stroke: "#1c1a19",
            "stroke-width": 34,
            "stroke-linecap": "round",
            opacity: 0.93,
          }),
        );
        const [xm, ym] = pol(hoek, (rBuiten + rBinnen) / 2);
        const t = el("text", {
          x: xm,
          y: ym + 5.5,
          "text-anchor": "middle",
          fill: "#fff",
          "font-size": 15.5,
          "font-weight": 700,
          "letter-spacing": 0.4,
        });
        t.textContent = d.initialen;
        g.appendChild(t);
      } else {
        const r = d.zone === "accommodating" ? rBinnen : rBuiten;
        const [x, y] = pol(hoek, r);
        g.appendChild(el("circle", { cx: x, cy: y, r: 21, fill: "#2b2725", stroke: "#fff", "stroke-width": 3.5 }));
        const t = el("text", { x, y: y + 6, "text-anchor": "middle", fill: "#fff", "font-size": 16, "font-weight": 700 });
        t.textContent = d.initialen;
        g.appendChild(t);
      }
    });
  });
  svg.appendChild(g);
}
