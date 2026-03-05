// Email templates

// Digest emails
export {
  WeeklyDigestEmail,
  type WeeklyDigestEmailProps,
} from "./templates/weekly-digest.js";

export {
  MonthlyDigestEmail,
  type MonthlyDigestEmailProps,
} from "./templates/monthly-digest.js";

// Sync notification emails
export {
  SyncCompletedEmail,
  type SyncCompletedEmailProps,
} from "./templates/sync-completed.js";

export {
  SyncFailedEmail,
  type SyncFailedEmailProps,
} from "./templates/sync-failed.js";

export {
  NewProductsReportEmail,
  type NewProductsReportEmailProps,
  type NewProduct,
} from "./templates/new-products-report.js";

// Integration emails
export {
  IntegrationIssueEmail,
  type IntegrationIssueEmailProps,
  type IssueType,
} from "./templates/integration-issue.js";
