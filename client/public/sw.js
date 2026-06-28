// TaPas Platform — Service Worker (SPA routing fix voor pplx.app S3)
//
// Probleem: pplx.app S3 geeft "No static asset" voor alle paden die geen
//           bestaand S3-bestand zijn (bijv. /dashboard/TOKEN, /poort, /lounge).
//           De Node-backend (port 5000) wordt nooit bereikt voor deze paden.
//
// Oplossing: Deze service worker onderschept navigatie-requests.
//            Als het pad geen statisch asset is, stuurt hij de browser door
//            naar de hash-versie: /dashboard/TOKEN → /#/dashboard/TOKEN
//
// Werkt pas NA de eerste keer laden van de app (sw moet eerst geregistreerd zijn).
// Marc heeft de app al eerder bezocht → sw wordt geregistreerd → alle volgende
// navigaties (ook directe URLs) worden correct afgehandeld.

const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp3|mp4|pdf|webp|ogg|json|txt|html|webmanifest)$/i;

// Paden die direct naar S3 mogen (statische bestanden en directories)
const STATIC_PREFIXES = [
  '/assets/',
  '/t4teens/',
  '/jester/',
  '/jester-galerij/',
  '/lounge/',
  '/poort/',
  '/academy/',
  '/merk/',
  '/island/',
  '/img/',
  '/port/',        // Node backend via /port/5000/
  '/__pplx_auth/', // Perplexity auth callback
];

// SPA-routes die via hash afgehandeld moeten worden
const SPA_PREFIXES = [
  '/dashboard/',
  '/admin',
  '/coach',
  '/deelnemer/',
  '/afname/',
  '/start',
  '/mijn',
  '/lounge',
  '/academy',
  '/poort',
  '/magic/',
  '/t4r',
  '/teamscan',
  '/2minscan',
  '/hdd',
  '/impact',
  '/werk',
  '/studie',
  '/voor-begeleiders',
  '/voor-deelnemers',
  '/r/',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Alleen navigatie-requests afvangen (geen assets, API-calls, etc.)
  if (event.request.mode !== 'navigate') return;

  const pathname = url.pathname;

  // Root en hash-routes: door laten gaan
  if (pathname === '/' || pathname === '/index.html') return;

  // Auth-callback: door laten gaan
  if (pathname.startsWith('/__pplx_auth/')) return;

  // Statische bestanden met extensie: door laten gaan
  if (STATIC_EXTENSIONS.test(pathname)) return;

  // Bekende statische prefixen: door laten gaan
  for (const prefix of STATIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return;
  }

  // SPA-route gedetecteerd: redirect naar hash-versie
  // /dashboard/TOKEN → /#/dashboard/TOKEN
  const hashUrl = url.origin + '/#' + pathname + url.search;
  event.respondWith(
    Response.redirect(hashUrl, 302)
  );
});
