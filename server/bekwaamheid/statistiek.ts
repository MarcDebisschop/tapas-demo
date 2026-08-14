// ---------------------------------------------------------------------------
// server/bekwaamheid/statistiek.ts — de kwantielen die het ICC-interval nodig heeft.
//
// Dit bestand bestaat om één reden: sectie 13.1 van het draaiboek toetst de ICC
// op de ondergrens van het 95%-betrouwbaarheidsinterval, en dat interval vraagt
// kwantielen van de F-verdeling. Die staan nergens in het platform.
//
// Waarom zelf en niet uit een pakket. Er is geen afhankelijkheid in het project
// die dit al doet, en een pakket binnenhalen voor twee functies van elk twintig
// regels zet een onderhoudslast en een aanvalsvlak neer die niet in verhouding
// staan. De rekenkundige inhoud is bovendien oud en vaststaand.
//
// Waarom bisectie en niet Newton. De inverse van de F-verdeling is via
// Newton-Raphson sneller, maar Newton kan divergeren bij extreme
// vrijheidsgraden, en dan komt er stil een verkeerd getal uit. Bisectie op een
// monotone functie convergeert altijd. Deze functies lopen hoogstens een paar
// keer per schermbeurt, dus de snelheid doet niet mee; de zekerheid wel.
//
// De uitkomsten zijn geijkt op `scipy.stats.f.ppf` in
// `tests/bekwaamheid-statistiek.test.ts`.
// ---------------------------------------------------------------------------

/** Natuurlijke logaritme van de gammafunctie (Lanczos-benadering). */
export function logGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  const tmp0 = x + 5.5;
  const tmp = tmp0 - (x + 0.5) * Math.log(tmp0);
  let som = 1.000000000190015;
  for (let j = 0; j < 6; j += 1) {
    y += 1;
    som += c[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * som) / x);
}

/** Kettingbreuk voor de onvolledige bètafunctie (Lentz' methode). */
function betaKettingbreuk(a: number, b: number, x: number): number {
  const KLEIN = 1e-300;
  const NAUW = 3e-16;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < KLEIN) d = KLEIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < KLEIN) d = KLEIN;
    c = 1 + aa / c;
    if (Math.abs(c) < KLEIN) c = KLEIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < KLEIN) d = KLEIN;
    c = 1 + aa / c;
    if (Math.abs(c) < KLEIN) c = KLEIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < NAUW) break;
  }
  return h;
}

/**
 * De geregulariseerde onvolledige bètafunctie I_x(a, b).
 *
 * Dit is de verdelingsfunctie waaruit zowel de F- als de t-verdeling volgt. De
 * spiegeling bij grote x is nodig omdat de kettingbreuk daar traag convergeert.
 */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const voorfactor = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (voorfactor * betaKettingbreuk(a, b, x)) / a;
  return 1 - (voorfactor * betaKettingbreuk(b, a, 1 - x)) / b;
}

/**
 * Verdelingsfunctie van de F-verdeling: de kans dat F kleiner is dan of gelijk
 * aan `x`, bij `d1` en `d2` vrijheidsgraden.
 *
 * De vrijheidsgraden hoeven niet geheel te zijn. Dat is geen luxe: het
 * ICC-interval gebruikt de Satterthwaite-benadering, en die levert een gebroken
 * aantal vrijheidsgraden op.
 */
export function fVerdelingKans(x: number, d1: number, d2: number): number {
  if (!(x > 0)) return 0;
  return incompleteBeta(d1 / 2, d2 / 2, (d1 * x) / (d1 * x + d2));
}

/**
 * Het `p`-kwantiel van de F-verdeling: de waarde waaronder een aandeel `p` van
 * de verdeling ligt.
 *
 * Bisectie op een oplopende functie. De bovengrens wordt eerst verdubbeld tot ze
 * de kans voorbij `p` brengt, zodat er geen vaste bovengrens is die bij extreme
 * vrijheidsgraden te laag ligt.
 */
export function fKwantiel(p: number, d1: number, d2: number): number {
  if (!(p > 0) || !(p < 1)) throw new Error("Een kwantiel vraagt een kans tussen 0 en 1.");
  if (!(d1 > 0) || !(d2 > 0)) throw new Error("De F-verdeling vraagt positieve vrijheidsgraden.");

  let boven = 2;
  let stappen = 0;
  while (fVerdelingKans(boven, d1, d2) < p) {
    boven *= 2;
    stappen += 1;
    // 2^120 is ruim voorbij elk kwantiel dat in de praktijk voorkomt. Loopt de
    // grens toch weg, dan is er iets fundamenteel mis en is stil doorrekenen
    // erger dan stoppen.
    if (stappen > 120) throw new Error("Het F-kwantiel loopt weg; controleer de vrijheidsgraden.");
  }

  let onder = 0;
  for (let i = 0; i < 200; i += 1) {
    const midden = (onder + boven) / 2;
    if (fVerdelingKans(midden, d1, d2) < p) onder = midden;
    else boven = midden;
    if (boven - onder < 1e-12 * Math.max(1, boven)) break;
  }
  return (onder + boven) / 2;
}
