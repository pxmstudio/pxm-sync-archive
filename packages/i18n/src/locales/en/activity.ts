export const activity = {
  title: "Activity",
  subtitle: "Track your store sync history and monitor product synchronization status",
  breadcrumb: "Activity",

  // Empty state
  noActivity: "No sync activity yet",
  noActivityDescription: "When you sync products to your stores, the activity will appear here.",

  // Filters
  filters: {
    feed: "Feed",
    store: "Store",
    status: "Status",
    allFeeds: "All feeds",
    allStores: "All stores",
    allStatuses: "All statuses",
  },

  // Table columns
  columns: {
    time: "Time",
    feed: "Feed",
    store: "Store",
    status: "Status",
    products: "Products",
    duration: "Duration",
    actions: "Actions",
  },

  // Statuses
  statuses: {
    pending: "Pending",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    partial: "Partial",
  },

  // Product counts
  products: {
    created: "created",
    updated: "updated",
    skipped: "skipped",
    failed: "failed",
    processed: "processed",
  },

  // Sync types
  syncTypes: {
    full: "Full sync",
    incremental: "Incremental sync",
    manual: "Manual sync",
  },

  // Triggered by
  triggeredBy: {
    schedule: "Scheduled",
    manual: "Manual",
  },

  // Time formatting
  time: {
    justNow: "Just now",
    minutesAgo: "{count} min ago",
    hoursAgo: "{count}h ago",
    yesterday: "Yesterday",
    daysAgo: "{count} days ago",
  },

  // Duration formatting
  duration: {
    seconds: "{count}s",
    minutes: "{count}m",
    hours: "{count}h",
  },

  // Actions
  actions: {
    viewDetails: "View details",
    refresh: "Refresh",
  },

  // Detail dialog/sheet
  detail: {
    title: "Sync Run Details",
    syncType: "Sync type",
    triggeredBy: "Triggered by",
    startedAt: "Started at",
    completedAt: "Completed at",
    duration: "Duration",
    summary: "Summary",
    errors: "Errors",
    noErrors: "No errors",
    errorCount: "{count} error(s)",
    close: "Close",
  },

  // Error states
  error: {
    failedToLoad: "Failed to load activity",
    tryAgain: "Try again",
  },

  // Pagination
  pagination: {
    showing: "Showing",
    to: "to",
    of: "of",
    runs: "sync runs",
    previous: "Previous",
    next: "Next",
  },

  // Upgrade
  upgrade: {
    title: "Subscribe to Unlock Activity Log",
    description:
      "Start your subscription to track sync history and monitor product synchronization status.",
    whatYouGet: "What you'll get",
    viewPlans: "View Plans",
    features: {
      trackSyncs: "Track all sync runs in real-time",
      monitorErrors: "Monitor and debug sync errors",
      viewHistory: "View complete sync history",
      detailedLogs: "Access detailed sync logs and metrics",
    },
  },
};
