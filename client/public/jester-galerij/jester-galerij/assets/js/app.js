/* ════════════════════════════════════════════════
   TaPas Jesters — interactie & theater
   ════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined";

  if (hasGSAP && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ── Voortgangsbalk + merkbalk-achtergrond ── */
  const fill = document.getElementById("scrollFill");
  const topbar = document.getElementById("topbar");
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    const p = max > 0 ? (h.scrollTop || document.body.scrollTop) / max : 0;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (topbar) topbar.classList.toggle("is-scrolled", (h.scrollTop || 0) > 60);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── Hero-intro: de nar verschijnt ── */
  if (hasGSAP && !reduced) {
    const tl = gsap.timeline({ delay: 0.25 });
    tl.fromTo(".poort__bg",
        { scale: 1.18, filter: "brightness(0.55)" },
        { scale: 1.08, filter: "brightness(1)", duration: 2.2, ease: "power2.out" }, 0)
      .fromTo(".poort__eyebrow",
        { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 0.4)
      .fromTo(".poort__title .line",
        { opacity: 0, y: 26, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.1, stagger: 0.16, ease: "power3.out" }, 0.6)
      .fromTo(".poort__lede",
        { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }, 1.1)
      .fromTo(".cta",
        { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 1.35);
  } else {
    document.querySelectorAll(".poort__title .line, .poort__eyebrow, .poort__lede, .cta")
      .forEach((el) => { el.style.opacity = 1; });
  }

  /* ── Parallax-hero ── */
  if (hasGSAP && !reduced) {
    gsap.to(".poort__bg", {
      yPercent: 18, ease: "none",
      scrollTrigger: { trigger: ".poort", start: "top top", end: "bottom top", scrub: 0.6 }
    });
  }

  /* ── Reveal-on-scroll ── */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ── Subtiele parallax op de bedrijf-beelden ── */
  if (hasGSAP && !reduced) {
    document.querySelectorAll("[data-parallax] .bedrijf__img").forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: img.closest("[data-parallax]"), start: "top bottom", end: "bottom top", scrub: 0.8 }
      });
    });
  }

  /* ════════════ De vijf functies ════════════ */
  const FN = {
    oog: {
      tag: "het oog", title: "Inzicht &amp; doorzicht",
      desc: "De (in)congruentie tussen intentie en daad zien en benoemen; blinde vlekken zichtbaar maken waar de organisatie zelf langs kijkt.",
      feed: "T4O-gap · HDD-synthese",
      glyph: '<svg viewBox="0 0 32 32" fill="none"><path d="M2 16 C7 8 13 6 16 6 C19 6 25 8 30 16 C25 24 19 26 16 26 C13 26 7 24 2 16 Z" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="16" r="5" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="16" r="1.8" fill="currentColor"/></svg>'
    },
    kompas: {
      tag: "het kompas", title: "Richting &amp; focus",
      desc: "Vastgelopen besluitvorming terug op koers en snelheid brengen; de juiste metrics identificeren waar het besluit op moet rusten.",
      feed: "T4O-richtingslagen · besluit-metrics",
      glyph: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.2"/><path d="M16 8 L19 16 L16 24 L13 16 Z" fill="currentColor"/><circle cx="16" cy="16" r="1.6" fill="currentColor"/></svg>'
    },
    venster: {
      tag: "het venster", title: "(Re)framing",
      desc: "De moed om te breken met oude patronen; het perspectief intern↔extern kantelen en het besluit \u201cout of the box\u201d durven herzien.",
      feed: "T4P-drivers · blinde-vlek-detectie",
      glyph: '<svg viewBox="0 0 32 32" fill="none"><rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M16 4 V28 M6 16 H26" stroke="currentColor" stroke-width="1"/></svg>'
    },
    gieter: {
      tag: "de gieter", title: "Verrijking",
      desc: "Psychologische veiligheid, gezonde groepsdynamica, ethiek en diversiteit het besluitproces in brengen — zodat de kwaliteit groeit.",
      feed: "Teamscan · 2MINSCAN · HDD",
      glyph: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 14 H20 V24 C20 25 19 26 18 26 H10 C9 26 8 25 8 24 Z" stroke="currentColor" stroke-width="1.2"/><path d="M20 16 L27 12 L24 19" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>'
    },
    lamp: {
      tag: "de lamp", title: "Vernieuwing",
      desc: "Het design van een betere besluitvorming — gekoppeld aan het talent en de energie die werkelijk in de organisatie aanwezig zijn.",
      feed: "T4P · T4O · energie-data",
      glyph: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 4 C11 4 8 8 8 12 C8 15 10 17 11 19 C12 20.5 12 22 12 22 H20 C20 22 20 20.5 21 19 C22 17 24 15 24 12 C24 8 21 4 16 4 Z" stroke="currentColor" stroke-width="1.2"/><path d="M12 25 H20 M13 28 H19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>'
    }
  };

  const tabs = document.querySelectorAll(".ftab");
  const pTag = document.getElementById("fpanelTag");
  const pTitle = document.getElementById("fpanelTitle");
  const pDesc = document.getElementById("fpanelDesc");
  const pFeed = document.getElementById("fpanelFeed");
  const pGlyph = document.getElementById("fpanelGlyph");

  function setFunction(key) {
    const d = FN[key];
    if (!d) return;
    const panelInner = [pTitle, pDesc, pFeed, pTag];
    if (hasGSAP && !reduced) {
      gsap.to(panelInner, { opacity: 0, duration: 0.18, ease: "power1.in", onComplete: paint });
      gsap.fromTo(pGlyph, { opacity: 0.04, rotate: -8 }, { opacity: 0.1, rotate: 0, duration: 0.7, ease: "power2.out" });
    } else { paint(); }
    function paint() {
      pTag.textContent = d.tag;
      pTitle.innerHTML = d.title;
      pDesc.innerHTML = d.desc;
      pFeed.innerHTML = d.feed;
      pGlyph.innerHTML = d.glyph;
      if (hasGSAP && !reduced) gsap.to(panelInner, { opacity: 1, duration: 0.4, ease: "power2.out" });
    }
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      setFunction(btn.dataset.fn);
    });
  });
  // initiële glyph
  if (pGlyph) pGlyph.innerHTML = FN.oog.glyph;

  /* ════════════ Het Narrencharter — levend document ════════════ */
  // Naam-invoer: klik op de lijn van de opdrachtgever om te tekenen
  const nameLine = document.getElementById("signNameLine");
  if (nameLine) {
    nameLine.setAttribute("contenteditable", "true");
    nameLine.setAttribute("spellcheck", "false");
    nameLine.dataset.placeholder = "uw naam";
    nameLine.setAttribute("role", "textbox");
    nameLine.setAttribute("aria-label", "Naam van de opdrachtgever");
    nameLine.style.cursor = "text";
    nameLine.style.minWidth = "60%";

    const ph = document.createElement("span");
    ph.textContent = "teken hier";
    ph.style.cssText = "opacity:0.4;font-style:italic;pointer-events:none;font-size:1rem;";
    nameLine.appendChild(ph);

    nameLine.addEventListener("focus", () => { if (nameLine.textContent.trim() === "teken hier") nameLine.textContent = ""; ph.remove(); });
    nameLine.addEventListener("input", () => { if (ph.parentNode) ph.remove(); });
    nameLine.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); nameLine.blur(); } });
  }

  // De zegel
  const sealBtn = document.getElementById("sealBtn");
  const sealDone = document.getElementById("sealDone");
  if (sealBtn) {
    sealBtn.addEventListener("click", () => {
      const sealed = sealBtn.classList.toggle("is-sealed");
      sealBtn.setAttribute("aria-pressed", sealed ? "true" : "false");
      if (sealDone) sealDone.classList.toggle("is-shown", sealed);
    });
  }

  /* ──────────────────────────────────────────────
     HOFNAR-MUZIEK
     Zachte middeleeuwse luit & blokfluit. Browsers blokkeren auto-audio,
     dus de muziek zet ongemerkt in bij de EERSTE aanraking van de bezoeker
     (klik, toets of scroll). Ze fadet langzaam in — het 'wat hoor ik nu'-
     effect — en lust naadloos. Een discreet knopje rechtsboven dempt of hervat.
     We respecteren prefers-reduced-motion: dan geen automatische inzet.
     ────────────────────────────────────────────── */
  (function hofnarMuziek() {
    const audio = document.getElementById("hofnarMuziek");
    const knop = document.getElementById("muziekToggle");
    if (!audio || !knop) return;

    const DOEL_VOLUME = 0.5;     // ingetogen eindniveau
    const FADE_MS = 4200;        // trage, bijna ongemerkte infade
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let gedempt = false;         // bezoeker heeft zelf gedempt
    let ingezet = false;         // muziek is al ooit gestart
    let fadeTimer = null;

    audio.volume = 0;

    function fadeNaar(doel, ms, naAfloop) {
      if (fadeTimer) cancelAnimationFrame(fadeTimer);
      const start = audio.volume;
      const t0 = performance.now();
      function stap(t) {
        const p = Math.min(1, (t - t0) / ms);
        // zachte ease-out curve
        const e = 1 - Math.pow(1 - p, 3);
        audio.volume = start + (doel - start) * e;
        if (p < 1) {
          fadeTimer = requestAnimationFrame(stap);
        } else if (naAfloop) {
          naAfloop();
        }
      }
      fadeTimer = requestAnimationFrame(stap);
    }

    function toonKnop() {
      knop.classList.add("is-zichtbaar");
    }

    function start() {
      if (ingezet || gedempt) return;
      ingezet = true;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          toonKnop();
          fadeNaar(DOEL_VOLUME, FADE_MS);
        }).catch(() => {
          // toch geblokkeerd — wacht op een volgende interactie
          ingezet = false;
        });
      } else {
        toonKnop();
        fadeNaar(DOEL_VOLUME, FADE_MS);
      }
    }

    // Eerste interactie = ongemerkte inzet. (Niet bij reduced-motion.)
    if (!reduceMotion) {
      const eersteKeer = () => {
        start();
        ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) =>
          window.removeEventListener(ev, eersteKeer)
        );
      };
      ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) =>
        window.addEventListener(ev, eersteKeer, { passive: true })
      );
    } else {
      // bij reduced-motion: muziek niet vanzelf, maar knop wel beschikbaar
      toonKnop();
      knop.classList.add("is-gedempt");
      knop.setAttribute("aria-pressed", "false");
      knop.setAttribute("aria-label", "Muziek afspelen");
      gedempt = true;
    }

    // Dempknopje
    knop.addEventListener("click", () => {
      if (!ingezet && !gedempt) {
        // nog niet gestart — deze klik start hem
        start();
        return;
      }
      gedempt = !gedempt;
      knop.classList.toggle("is-gedempt", gedempt);
      knop.setAttribute("aria-pressed", gedempt ? "false" : "true");
      knop.setAttribute("aria-label", gedempt ? "Muziek afspelen" : "Muziek dempen");
      if (gedempt) {
        fadeNaar(0, 700, () => audio.pause());
      } else {
        const p = audio.play();
        if (p && typeof p.then === "function") p.catch(() => {});
        fadeNaar(DOEL_VOLUME, 1400);
      }
    });

    // Pauzeer als het tabblad weg is; hervat zacht bij terugkeer (tenzij gedempt).
    document.addEventListener("visibilitychange", () => {
      if (!ingezet || gedempt) return;
      if (document.hidden) {
        audio.pause();
      } else {
        const p = audio.play();
        if (p && typeof p.then === "function") p.catch(() => {});
        fadeNaar(DOEL_VOLUME, 1600);
      }
    });
  })();
})();
