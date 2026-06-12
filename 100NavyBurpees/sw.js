// Service Worker — App-Shell Offline-Cache (TASK-003).
//
// Bewusste Strategie (deckt sich mit den Projekt-Regeln in CLAUDE.md):
//   * Navigation/HTML   -> network-first: online immer die frische App (haeufige Deploys!),
//                          offline Fallback auf die gecachte Shell. Vermeidet "alte Version".
//   * Google-Fonts/GET  -> cache-first + Hintergrund-Refresh (stale-while-revalidate): aendern
//                          sich praktisch nie, schnellster Start, offline verfuegbar.
//   * Sheet/Apps-Script -> network-only (NIE cachen): Trainingsdaten muessen frisch sein, und
//                          ein gecachter POST waere fatal. Spiegelt "kein localStorage fuer
//                          Session-Daten" + den verworfenen Draft-Cache auf SW-Ebene.
//
// Cache-Versionierung: CACHE bei strukturellen Aenderungen bumpen -> activate raeumt Alt-Caches.
// (Die HTML selbst ist network-first, muss also fuer Updates NICHT gebumpt werden.)
const CACHE='burpee-shell-v1';
const SHELL=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});

// Hosts, deren Antworten NIE in den Cache duerfen (Live-Daten lesen + Schreib-Endpunkt).
const NEVER=/docs\.google\.com|script\.google(usercontent)?\.com/;
const FONTS=/fonts\.(googleapis|gstatic)\.com/;

self.addEventListener('fetch',e=>{
  const req=e.request;
  // Nur GET wird behandelt; alles andere (POST ans Apps-Script) + Live-Daten -> Browser-Default (Netz).
  if(req.method!=='GET'||NEVER.test(req.url))return;

  // Navigation (die HTML-Seite selbst): network-first, Cache nur als Offline-Fallback.
  if(req.mode==='navigate'){
    e.respondWith(
      fetch(req)
        .then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r})
        .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./')))
    );
    return;
  }

  // Fonts + sonstige GET-Assets: cache-first, im Hintergrund nachladen.
  e.respondWith(caches.match(req).then(cached=>{
    const net=fetch(req).then(r=>{
      const cacheable=r&&r.status===200&&(FONTS.test(req.url)||req.url.startsWith(self.location.origin));
      if(cacheable){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}
      return r;
    }).catch(()=>cached);
    return cached||net;
  }));
});
