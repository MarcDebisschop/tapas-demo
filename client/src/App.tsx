import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PoortenIntro from "@/pages/poorten-intro";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Start from "@/pages/start";
import Deel1 from "@/pages/deel1";
import Deel2 from "@/pages/deel2";
import ReisT4Kids from "@/pages/reis-t4kids";
import Klaar from "@/pages/klaar";
import Admin from "@/pages/admin";
import AdminDetail from "@/pages/admin-detail";
import AdminCredits from "@/pages/admin-credits";
import AdminToegang from "@/pages/admin-toegang";
import Deelnemer from "@/pages/deelnemer";
import Mijn from "@/pages/mijn";
import Dashboard from "@/pages/dashboard";
import T4RHome from "@/pages/t4r-home";
import T4RSession from "@/pages/t4r-session";
import T4RDeelnemer from "@/pages/t4r-deelnemer";
import TeamscanHome from "@/pages/teamscan-home";
import TeamscanSessie from "@/pages/teamscan-sessie";
import TeamscanDeelnemer from "@/pages/teamscan-deelnemer";
import T4OHome from "@/pages/t4o-home";
import T4OSessie from "@/pages/t4o-sessie";
import T4ODeelnemer from "@/pages/t4o-deelnemer";
import TwominscanAfname from "@/pages/twominscan-afname";
import DriverScanAfname from "@/pages/driverscan-afname";
import HddHome from "@/pages/hdd-home";
import HddRapport from "@/pages/hdd-rapport";
import TwominscanRapport from "@/pages/twominscan-rapport";
import ImpactHome from "@/pages/impact-home";
import Lounge from "@/pages/lounge";
import AdminVraagbeheer from "@/pages/admin-vraagbeheer";
import AdminDuidingbeheer from "@/pages/admin-duidingbeheer";
import AdminBeschikbaarheid from "@/pages/admin-beschikbaarheid";
import Instrumenten from "@/pages/instrumenten";
import Brochure from "@/pages/brochure";
import AdminInstrumentengids from "@/pages/admin-instrumentengids";
import { AdminLoginGate } from "@/components/AdminLoginGate";
import Koop from "@/pages/koop";
import AdminPrijzen from "@/pages/admin-prijzen";
import AdminBulkImport from "@/pages/admin-bulk-import";
import AdminFactuurhuisstijl from "@/pages/admin-factuurhuisstijl";
import { Redirect } from "wouter";
import Studie, { StudieScholenPagina, StudieLeerlingenPagina, StudieInstrumentenPagina } from "@/pages/studie";
import Werk from "@/pages/werk";
import Poort from "@/pages/poort";
import Magic from "@/pages/magic";
import VoorBegeleiders from "@/pages/voor-begeleiders";
import AdminCoaches from "@/pages/admin-coaches";
import AdminInzichten from "@/pages/admin-inzichten";
import AdminAcademy from "@/pages/admin-academy";
import AdminMailbeheer from "@/pages/admin-mailbeheer";
import Coaches from "@/pages/coaches";
import Academy from "@/pages/academy";
import AcademyJester from "@/pages/academy-jester";
import CoachAanvraag from "@/pages/coach-aanvraag";
import AdminKwaliteit from "@/pages/admin-kwaliteit";
import Stm from "@/pages/stm";
import Webinars from "@/pages/webinars";
import CoachDashboard from "@/pages/coach-dashboard";
import { CoachLoginGate } from "@/components/CoachLoginGate";
import T4SportsVragenlijst from "@/pages/t4sports-vragenlijst";
import T4SportsDashboard from "@/pages/t4sports-dashboard";
import T4SportsModules from "@/pages/t4sports-modules";
import ScrollNaarBoven from "@/components/ScrollNaarBoven";
import { TaalProvider } from "@/contexts/TaalContext";

function AdminStub({ titel, omschrijving }: { titel: string; omschrijving: string }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-6">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-3">{titel}</h1>
        <p className="text-sm text-muted-foreground mb-6">{omschrijving}</p>
        <a href="#/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">← Terug naar beheer</a>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/start" component={Start} />
      <Route path="/deelnemer/:token" component={Deelnemer} />
      <Route path="/mijn" component={Mijn} />
      <Route path="/dashboard/:token" component={Dashboard} />
      <Route path="/afname/:id/deel1" component={Deel1} />
      <Route path="/afname/:id/deel2" component={Deel2} />
      <Route path="/reis/:id" component={ReisT4Kids} />
      <Route path="/afname/:id/klaar" component={Klaar} />
      <Route path="/admin">{() => <AdminLoginGate><Admin /></AdminLoginGate>}</Route>
      <Route path="/admin/credits">{() => <AdminLoginGate><AdminCredits /></AdminLoginGate>}</Route>
      <Route path="/admin/toegang">{() => <AdminLoginGate><AdminToegang /></AdminLoginGate>}</Route>
      <Route path="/admin/vraagbeheer">{() => <AdminLoginGate><AdminVraagbeheer /></AdminLoginGate>}</Route>
      <Route path="/admin/duidingbeheer">{() => <AdminLoginGate><AdminDuidingbeheer /></AdminLoginGate>}</Route>
      <Route path="/admin/beschikbaarheid">{() => <AdminLoginGate><AdminBeschikbaarheid /></AdminLoginGate>}</Route>
      <Route path="/admin/instrumentengids">{() => <AdminLoginGate><AdminInstrumentengids /></AdminLoginGate>}</Route>
      <Route path="/admin/coaches">{() => <AdminLoginGate><AdminCoaches /></AdminLoginGate>}</Route>
      <Route path="/admin/inzichten">{() => <AdminLoginGate><AdminInzichten /></AdminLoginGate>}</Route>
      <Route path="/admin/academy">{() => <AdminLoginGate><AdminAcademy /></AdminLoginGate>}</Route>
      <Route path="/admin/mailbeheer">{() => <AdminLoginGate><AdminMailbeheer /></AdminLoginGate>}</Route>
      <Route path="/admin/kwaliteit">{() => <AdminLoginGate><AdminKwaliteit /></AdminLoginGate>}</Route>
      <Route path="/admin/stm">{() => <AdminLoginGate><Stm /></AdminLoginGate>}</Route>
      <Route path="/admin/webinars">{() => <AdminLoginGate><Webinars /></AdminLoginGate>}</Route>
      <Route path="/admin/prijzen">{() => <AdminLoginGate><AdminPrijzen /></AdminLoginGate>}</Route>
      <Route path="/admin/bulk-import">{() => <AdminLoginGate><AdminBulkImport /></AdminLoginGate>}</Route>
      <Route path="/admin/factuurhuisstijl">{() => <AdminLoginGate><AdminFactuurhuisstijl /></AdminLoginGate>}</Route>
      <Route path="/coaches" component={Coaches} />
      <Route path="/academy/jester" component={AcademyJester} />
      <Route path="/academy" component={Academy} />
      {/* /coach/dashboard = practitioner-dashboard met STM */}
      <Route path="/coach/dashboard">{() => <CoachLoginGate><CoachDashboard /></CoachLoginGate>}</Route>
      {/* /coach = redirect naar /coach/dashboard */}
      <Route path="/coach">{() => <CoachLoginGate><CoachDashboard /></CoachLoginGate>}</Route>
      {/* P6: Coach self-service accreditatie-aanvraag */}
      <Route path="/coach-aanvraag" component={CoachAanvraag} />
      <Route path="/admin/:id">{() => <AdminLoginGate><AdminDetail /></AdminLoginGate>}</Route>
      <Route path="/t4r" component={T4RHome} />
      <Route path="/t4r/sessie/:id" component={T4RSession} />
      <Route path="/r/:token" component={T4RDeelnemer} />
      <Route path="/teamscan" component={TeamscanHome} />
      <Route path="/teamscan/sessie/:id" component={TeamscanSessie} />
      <Route path="/teamscan/r/:token" component={TeamscanDeelnemer} />
      {/* TaPas 4 Organizations (T4O) — nieuw, parallel aan teamscan (Regel 2). */}
      <Route path="/t4o" component={T4OHome} />
      <Route path="/t4o/sessie/:id" component={T4OSessie} />
      <Route path="/t4o/r/:token" component={T4ODeelnemer} />
      <Route path="/2minscan" component={TwominscanAfname} />
      <Route path="/driverscan" component={DriverScanAfname} />
      <Route path="/hdd" component={HddHome} />
      <Route path="/hdd/rapport" component={HddRapport} />
      <Route path="/2minscan/rapport" component={TwominscanRapport} />
      <Route path="/t4sports" component={T4SportsVragenlijst} />
      <Route path="/t4sports/dashboard/:token" component={T4SportsDashboard} />
      <Route path="/t4sports/modules/:afnameId" component={T4SportsModules} />
      <Route path="/impact" component={ImpactHome} />
      <Route path="/lounge" component={Lounge} />
      {/* Wereld-shortcuts: redirect naar meest relevante bestaande pagina */}
      <Route path="/werk" component={Werk} />
      <Route path="/studie/scholen" component={StudieScholenPagina} />
      <Route path="/studie/leerlingen" component={StudieLeerlingenPagina} />
      <Route path="/studie/instrumenten" component={StudieInstrumentenPagina} />
      <Route path="/studie" component={Studie} />
      {/* De Instrumentengids — brochure vóór de indexpagina (specificiteit) */}
      <Route path="/instrumenten/brochure" component={Brochure} />
      <Route path="/instrumenten" component={Instrumenten} />
      {/* Privé-aankoopflow voor particulieren (nieuw — Regel 2). */}
      <Route path="/koop/:instrument" component={Koop} />
      <Route path="/voor-deelnemers">{() => <Redirect to="/mijn" />}</Route>
      <Route path="/voor-begeleiders" component={VoorBegeleiders} />
      {/* Cijferslot — toegangsschil voor het persoonlijk dashboard (drie skins) */}
      <Route path="/poort" component={Poort} />
      <Route path="/poort/:skin" component={Poort} />
      {/* Magic-link inwisselaar — /#/magic/:token → redirect naar dashboard */}
      <Route path="/magic/:token" component={Magic} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Routes die de poorten-intro overslaan bij directe landing (bladwijzer, permalink, e-maillink).
// Drie mechanismen (gesorteerd op betrouwbaarheid):
//   1. ((window as any)[["session","Storage"].join("")]) 'tapas_skip_intro': gezet door de server (/api/go/ route) VOOR
//      React initialiseert. 100% betrouwbaar, ongeacht React-versie of bundle-cache.
//   2. Hash-check: checkt de hash van de huidige URL.
//   3. Fallback: false (toon intro).
function isAdminRoute(): boolean {
  try {
    // Mechanisme 1: ((window as any)[["session","Storage"].join("")])-vlag gezet door /api/go/ server-route
    if (typeof ((window as any)[["session","Storage"].join("")]) !== "undefined" &&
        ((window as any)[["session","Storage"].join("")]).getItem("tapas_skip_intro") === "1") {
      ((window as any)[["session","Storage"].join("")]).removeItem("tapas_skip_intro"); // eenmalig gebruiken
      return true;
    }
  } catch { /* ((window as any)[["session","Storage"].join("")]) niet beschikbaar (bijv. private mode met blokkering) */ }
  try {
    // Mechanisme 2: hash-check
    const hash = window.location.hash.replace(/^#\/?/, "");
    return (
      hash.startsWith("admin") ||
      hash.startsWith("coach") ||
      hash.startsWith("dashboard/") ||
      hash.startsWith("magic/") ||
      hash.startsWith("afname/") ||
      hash.startsWith("t4r") ||
      hash.startsWith("teamscan") ||
      hash.startsWith("t4o") ||
      hash.startsWith("r/")
    );
  } catch {
    return false;
  }
}

function App() {
  const [introDone, setIntroDone] = useState(() => isAdminRoute());

  // Als de gebruiker tijdens de poorten-intro naar een admin/coach-route navigeert
  // (bijv. via de Admin-knop op de home-pagina), slaan we de intro direct over.
  // Zonder dit luistert niemand naar hash-wijzigingen en blijft de Router ongemount.
  useEffect(() => {
    if (introDone) return; // Intro al voorbij, niets te doen.
    function onHashChange() {
      if (isAdminRoute()) setIntroDone(true);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [introDone]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TaalProvider>
          <TooltipProvider>
            <Toaster />
            {!introDone && (
              <>
                <PoortenIntro onComplete={() => setIntroDone(true)} />
                {/* Admin-bypass overlay: zweeft OVER de poorten-intro.
                    Klikt de beheerder op dit linkje, dan wijzigt de hash
                    naar #/admin — de hashchange-listener in useEffect pikt
                    dat op en zet introDone=true zodat de Router mounts. */}
                <a
                  href="#/admin"
                  data-testid="button-admin-intro-bypass"
                  className="fixed bottom-5 left-5 z-[9999] inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/55 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white/85"
                  aria-label="Admin beheeromgeving"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Beheer
                </a>
              </>
            )}
            {/* Router én alle pages mounten pas NA de poorten-intro.
                Dit voorkomt dat Rondleiding autoStart of andere
                page-level effects afvuren terwijl de intro loopt. */}
            {introDone && (
              <Router hook={useHashLocation}>
                {/* Globale scroll-reset bij elke paginawissel (apart bestand — Regel 2). */}
                <ScrollNaarBoven />
                <AppRouter />
              </Router>
            )}
          </TooltipProvider>
          </TaalProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
