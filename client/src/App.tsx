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
import TwominscanAfname from "@/pages/twominscan-afname";
import HddHome from "@/pages/hdd-home";
import HddRapport from "@/pages/hdd-rapport";
import TwominscanRapport from "@/pages/twominscan-rapport";
import ImpactHome from "@/pages/impact-home";
import Lounge from "@/pages/lounge";
import AdminVraagbeheer from "@/pages/admin-vraagbeheer";
import { AdminLoginGate } from "@/components/AdminLoginGate";
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
      <Route path="/afname/:id/klaar" component={Klaar} />
      <Route path="/admin">{() => <AdminLoginGate><Admin /></AdminLoginGate>}</Route>
      <Route path="/admin/credits">{() => <AdminLoginGate><AdminCredits /></AdminLoginGate>}</Route>
      <Route path="/admin/toegang">{() => <AdminLoginGate><AdminToegang /></AdminLoginGate>}</Route>
      <Route path="/admin/vraagbeheer">{() => <AdminLoginGate><AdminVraagbeheer /></AdminLoginGate>}</Route>
      <Route path="/admin/coaches">{() => <AdminLoginGate><AdminCoaches /></AdminLoginGate>}</Route>
      <Route path="/admin/inzichten">{() => <AdminLoginGate><AdminInzichten /></AdminLoginGate>}</Route>
      <Route path="/admin/academy">{() => <AdminLoginGate><AdminAcademy /></AdminLoginGate>}</Route>
      <Route path="/admin/mailbeheer">{() => <AdminLoginGate><AdminMailbeheer /></AdminLoginGate>}</Route>
      <Route path="/admin/kwaliteit">{() => <AdminLoginGate><AdminKwaliteit /></AdminLoginGate>}</Route>
      <Route path="/admin/stm">{() => <AdminLoginGate><Stm /></AdminLoginGate>}</Route>
      <Route path="/admin/webinars">{() => <AdminLoginGate><Webinars /></AdminLoginGate>}</Route>
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
      <Route path="/2minscan" component={TwominscanAfname} />
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
                <AppRouter />
              </Router>
            )}
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
