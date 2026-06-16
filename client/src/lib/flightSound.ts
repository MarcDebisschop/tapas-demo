// =============================================================================
// flightSound — discreet "oud vliegtuigje" motorgeluid voor "De vlucht".
//
// Volledig synthetisch via de Web Audio API: geen audiobestand, geen externe
// asset, werkt ook na publicatie (geen LLM/connector-afhankelijkheid).
//
// Karakter: een laag, warm propeller-brommetje (zoals een oude eenmotorige
// sportvliegtuig) — opgebouwd uit een lage zaagtand-grondtoon plus een
// amplitude-puls die de propellerslagen nabootst. Discreet qua volume.
//
// Levensloop:
//   start()  → motor slaat aan, toerental loopt rustig op tot kruissnelheid
//   cruise() → blijft stabiel doordraaien (lichte natuurlijke variatie)
//   stop()   → toerental zakt, motor sputtert kort na en valt zacht stil
//             (nooit abrupt afgekapt)
//
// Respecteert prefers-reduced-motion (default uit) en een gebruikers-mute.
// Audio mag pas starten na een gebruikersgebaar (klik op "De vlucht") — dat is
// hier het geval, want start() wordt vanuit een klik aangeroepen.
// =============================================================================

const LS_MUTE = "tapas_vlucht_geluid_uit_v1";

export function geluidUit(): boolean {
  try {
    return localStorage.getItem(LS_MUTE) === "1";
  } catch {
    return false;
  }
}

export function zetGeluidUit(uit: boolean) {
  try {
    if (uit) localStorage.setItem(LS_MUTE, "1");
    else localStorage.removeItem(LS_MUTE);
  } catch {
    /* ignore */
  }
}

type Fase = "uit" | "startend" | "kruis" | "stoppend";

// Doel-volume: bewust laag/discreet.
const KRUIS_GAIN = 0.05; // hoofdvolume tijdens vliegen
const KRUIS_HZ = 92; // grondtoon kruissnelheid (Hz) — lage warme brom
const STATIONAIR_HZ = 46; // grondtoon bij stationair/uitlopen
const PROP_RATIO = 2.0; // propeller-puls t.o.v. grondtoon

class VliegtuigMotor {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  // Grondtoon (laag, zaagtand) + sub-octaaf voor body.
  private grond: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;

  // Propeller-puls: LFO moduleert een gain-trap → "tuk-tuk-tuk".
  private propLfo: OscillatorNode | null = null;
  private propDepth: GainNode | null = null;
  private propGate: GainNode | null = null;

  // Ruis (lucht / uitlaat) heel zacht eronder.
  private ruisBron: AudioBufferSourceNode | null = null;
  private ruisGain: GainNode | null = null;

  private faseStatus: Fase = "uit";
  private wankelTmr: number | null = null;
  private stopTmr: number[] = [];

  private maakRuisBuffer(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // bruine ruis (zachter, warmer dan witte)
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.0;
    }
    return buf;
  }

  start() {
    if (geluidUit()) return;
    // Hervat een bestaande context of bouw er een.
    if (this.faseStatus !== "uit") {
      this.cruise();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const now = ctx.currentTime;

      // ---- Master + zachte low-pass zodat niets schel klinkt ----
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, now);
      lp.Q.setValueAtTime(0.6, now);
      master.connect(lp);
      lp.connect(ctx.destination);
      this.master = master;

      // ---- Propeller-gate: alle toon loopt hier doorheen en wordt gepulst ----
      const propGate = ctx.createGain();
      propGate.gain.setValueAtTime(0.6, now);
      propGate.connect(master);
      this.propGate = propGate;

      // LFO (propellerslag) → diepte → moduleert propGate.gain
      const propLfo = ctx.createOscillator();
      propLfo.type = "sine";
      propLfo.frequency.setValueAtTime((STATIONAIR_HZ * PROP_RATIO) / 12, now);
      const propDepth = ctx.createGain();
      propDepth.gain.setValueAtTime(0.35, now);
      propLfo.connect(propDepth);
      propDepth.connect(propGate.gain);
      propLfo.start(now);
      this.propLfo = propLfo;
      this.propDepth = propDepth;

      // ---- Grondtoon (zaagtand, laag) ----
      const grond = ctx.createOscillator();
      grond.type = "sawtooth";
      grond.frequency.setValueAtTime(STATIONAIR_HZ, now);
      const grondGain = ctx.createGain();
      grondGain.gain.setValueAtTime(0.5, now);
      grond.connect(grondGain);
      grondGain.connect(propGate);
      grond.start(now);
      this.grond = grond;

      // ---- Sub-octaaf (sine) voor warme body ----
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(STATIONAIR_HZ / 2, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.4, now);
      sub.connect(subGain);
      subGain.connect(propGate);
      sub.start(now);
      this.sub = sub;

      // ---- Zachte uitlaat-ruis ----
      const ruisBron = ctx.createBufferSource();
      ruisBron.buffer = this.maakRuisBuffer(ctx);
      ruisBron.loop = true;
      const ruisGain = ctx.createGain();
      ruisGain.gain.setValueAtTime(0.04, now);
      const ruisLp = ctx.createBiquadFilter();
      ruisLp.type = "lowpass";
      ruisLp.frequency.setValueAtTime(420, now);
      ruisBron.connect(ruisLp);
      ruisLp.connect(ruisGain);
      ruisGain.connect(master);
      ruisBron.start(now);
      this.ruisBron = ruisBron;
      this.ruisGain = ruisGain;

      // ---- Startsequentie: motor slaat aan, toerental loopt op ----
      this.faseStatus = "startend";
      // Eerst een paar "krukas"-stoten, dan vloeiend op kruistoeren.
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(KRUIS_GAIN * 0.5, now + 0.25); // motor pakt
      master.gain.exponentialRampToValueAtTime(KRUIS_GAIN * 0.32, now + 0.55); // dipje
      master.gain.exponentialRampToValueAtTime(KRUIS_GAIN, now + 2.2); // op toeren

      // Toerental (grondtoon + propellerpuls) loopt op naar kruis.
      this.rampToerental(STATIONAIR_HZ, KRUIS_HZ, now + 0.1, now + 2.4);

      // Na de opstart automatisch in kruis-fase.
      const t = window.setTimeout(() => this.cruise(), 2500);
      this.stopTmr.push(t);
    } catch {
      this.faseStatus = "uit";
    }
  }

  private rampToerental(vanHz: number, naarHz: number, t0: number, t1: number) {
    if (!this.ctx || !this.grond || !this.sub || !this.propLfo) return;
    this.grond.frequency.cancelScheduledValues(t0);
    this.grond.frequency.setValueAtTime(vanHz, t0);
    this.grond.frequency.exponentialRampToValueAtTime(naarHz, t1);
    this.sub.frequency.cancelScheduledValues(t0);
    this.sub.frequency.setValueAtTime(vanHz / 2, t0);
    this.sub.frequency.exponentialRampToValueAtTime(naarHz / 2, t1);
    // propellerslag schaalt mee met toerental
    this.propLfo.frequency.cancelScheduledValues(t0);
    this.propLfo.frequency.setValueAtTime((vanHz * PROP_RATIO) / 12, t0);
    this.propLfo.frequency.exponentialRampToValueAtTime((naarHz * PROP_RATIO) / 12, t1);
  }

  cruise() {
    if (!this.ctx || this.faseStatus === "uit" || this.faseStatus === "stoppend") return;
    this.faseStatus = "kruis";
    const ctx = this.ctx;
    // Lichte, natuurlijke toerental-wankel zodat het niet steriel klinkt.
    if (this.wankelTmr == null) {
      this.wankelTmr = window.setInterval(() => {
        if (!this.ctx || !this.grond || !this.sub || !this.propLfo) return;
        if (this.faseStatus !== "kruis") return;
        const now = this.ctx.currentTime;
        const wankel = KRUIS_HZ * (1 + (Math.random() - 0.5) * 0.03); // ±1.5%
        this.grond.frequency.exponentialRampToValueAtTime(wankel, now + 0.9);
        this.sub.frequency.exponentialRampToValueAtTime(wankel / 2, now + 0.9);
        this.propLfo.frequency.exponentialRampToValueAtTime((wankel * PROP_RATIO) / 12, now + 0.9);
      }, 1400) as unknown as number;
    }
  }

  // Motor uitzetten — bewust geleidelijk: toerental zakt, propeller draait
  // trager, korte na-sputter, en valt dan zacht stil. Nooit abrupt.
  stop() {
    if (!this.ctx || this.faseStatus === "uit" || this.faseStatus === "stoppend") {
      this.hardOpruimen();
      return;
    }
    this.faseStatus = "stoppend";
    if (this.wankelTmr != null) {
      window.clearInterval(this.wankelTmr);
      this.wankelTmr = null;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Toerental zakt naar onder stationair (motor verliest kracht).
    this.rampToerental(KRUIS_HZ, STATIONAIR_HZ * 0.62, now, now + 2.4);

    // Propellerslag wordt trager → hoorbaar uitdraaien.
    if (this.propLfo) {
      this.propLfo.frequency.cancelScheduledValues(now);
      this.propLfo.frequency.setValueAtTime((KRUIS_HZ * PROP_RATIO) / 12, now);
      this.propLfo.frequency.exponentialRampToValueAtTime(0.8, now + 2.6);
    }
    // Diepere puls-modulatie → "tuk ... tuk .... tuk" terwijl hij stilvalt.
    if (this.propDepth) {
      this.propDepth.gain.cancelScheduledValues(now);
      this.propDepth.gain.setValueAtTime(0.35, now);
      this.propDepth.gain.linearRampToValueAtTime(0.6, now + 2.0);
    }

    if (this.master) {
      const g = this.master.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(KRUIS_GAIN, now);
      // Twee kleine na-sputters voor het zachte uitsterven.
      g.linearRampToValueAtTime(KRUIS_GAIN * 0.72, now + 0.7);
      g.linearRampToValueAtTime(KRUIS_GAIN * 0.5, now + 1.1);
      g.linearRampToValueAtTime(KRUIS_GAIN * 0.55, now + 1.35); // sputter na
      g.linearRampToValueAtTime(KRUIS_GAIN * 0.28, now + 1.9);
      g.exponentialRampToValueAtTime(0.0001, now + 2.9); // volledig stil
    }

    // Na het uitsterven oscillatoren netjes afbreken.
    const t = window.setTimeout(() => this.hardOpruimen(), 3100);
    this.stopTmr.push(t);
  }

  private hardOpruimen() {
    this.stopTmr.forEach((t) => window.clearTimeout(t));
    this.stopTmr = [];
    if (this.wankelTmr != null) {
      window.clearInterval(this.wankelTmr);
      this.wankelTmr = null;
    }
    const stoppen = [this.grond, this.sub, this.propLfo, this.ruisBron];
    stoppen.forEach((n) => {
      try {
        n?.stop();
      } catch {
        /* al gestopt */
      }
    });
    try {
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.master = null;
    this.grond = null;
    this.sub = null;
    this.propLfo = null;
    this.propDepth = null;
    this.propGate = null;
    this.ruisBron = null;
    this.ruisGain = null;
    this.faseStatus = "uit";
  }

  // Onmiddellijk dempen (bv. bij mute midden in de vlucht) — kort uitfaden.
  demp() {
    if (!this.ctx || !this.master) {
      this.hardOpruimen();
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    const t = window.setTimeout(() => this.hardOpruimen(), 500);
    this.stopTmr.push(t);
  }
}

// Eén gedeelde motor voor de hele app.
let motor: VliegtuigMotor | null = null;
function getMotor(): VliegtuigMotor {
  if (!motor) motor = new VliegtuigMotor();
  return motor;
}

export const vlucht = {
  start: () => getMotor().start(),
  cruise: () => getMotor().cruise(),
  stop: () => getMotor().stop(),
  demp: () => getMotor().demp(),
};
