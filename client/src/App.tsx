import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useState } from "react";
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
      <Route path="/impact" component={ImpactHome} />
      <Route path="/lounge" component={Lounge} />
      {/* Wereld-shortcuts: redirect naar meest relevante bestaande pagina */}
      <Route path="/werk">{() => <Redirect to="/start" />}</Route>
      <Route path="/studie">{() => <Redirect to="/start" />}</Route>
      <Route path="/voor-deelnemers">{() => <Redirect to="/mijn" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            {!introDone && (
              <PoortenIntro onComplete={() => setIntroDone(true)} />
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
