export const activity = {
  title: "Activitate",
  subtitle: "Urmărește istoricul sincronizărilor și monitorizează starea sincronizării produselor",
  breadcrumb: "Activitate",

  // Empty state
  noActivity: "Nicio activitate de sincronizare încă",
  noActivityDescription: "Când sincronizezi produsele cu magazinele tale, activitatea va apărea aici.",

  // Filters
  filters: {
    feed: "Sursă",
    store: "Magazin",
    status: "Status",
    allFeeds: "Toate sursele",
    allStores: "Toate magazinele",
    allStatuses: "Toate statusurile",
  },

  // Table columns
  columns: {
    time: "Timp",
    feed: "Sursă",
    store: "Magazin",
    status: "Status",
    products: "Produse",
    duration: "Durată",
    actions: "Acțiuni",
  },

  // Statuses
  statuses: {
    pending: "În așteptare",
    running: "În curs",
    completed: "Finalizat",
    failed: "Eșuat",
    partial: "Parțial",
  },

  // Product counts
  products: {
    created: "create",
    updated: "actualizate",
    skipped: "omise",
    failed: "eșuate",
    processed: "procesate",
  },

  // Sync types
  syncTypes: {
    full: "Sincronizare completă",
    incremental: "Sincronizare incrementală",
    manual: "Sincronizare manuală",
  },

  // Triggered by
  triggeredBy: {
    schedule: "Programat",
    manual: "Manual",
  },

  // Time formatting
  time: {
    justNow: "Chiar acum",
    minutesAgo: "acum {count} min",
    hoursAgo: "acum {count}h",
    yesterday: "Ieri",
    daysAgo: "acum {count} zile",
  },

  // Duration formatting
  duration: {
    seconds: "{count}s",
    minutes: "{count}m",
    hours: "{count}h",
  },

  // Actions
  actions: {
    viewDetails: "Vezi detalii",
    refresh: "Reîmprospătează",
  },

  // Detail dialog/sheet
  detail: {
    title: "Detalii sincronizare",
    syncType: "Tip sincronizare",
    triggeredBy: "Declanșat de",
    startedAt: "Început la",
    completedAt: "Finalizat la",
    duration: "Durată",
    summary: "Sumar",
    errors: "Erori",
    noErrors: "Fără erori",
    errorCount: "{count} eroare/erori",
    close: "Închide",
  },

  // Error states
  error: {
    failedToLoad: "Nu s-a putut încărca activitatea",
    tryAgain: "Încearcă din nou",
  },

  // Pagination
  pagination: {
    showing: "Afișare",
    to: "până la",
    of: "din",
    runs: "sincronizări",
    previous: "Anterior",
    next: "Următor",
  },

  // Upgrade
  upgrade: {
    title: "Abonează-te pentru a Debloca Jurnalul de Activitate",
    description:
      "Începe abonamentul pentru a urmări istoricul sincronizărilor și a monitoriza starea sincronizării produselor.",
    whatYouGet: "Ce vei primi",
    viewPlans: "Vezi Planurile",
    features: {
      trackSyncs: "Urmărește toate sincronizările în timp real",
      monitorErrors: "Monitorizează și depanează erorile de sincronizare",
      viewHistory: "Vizualizează istoricul complet de sincronizare",
      detailedLogs: "Accesează jurnale detaliate și metrici",
    },
  },
};
