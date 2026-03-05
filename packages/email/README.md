# @workspace/email

Email templates built with [React Email](https://react.email). Sent via [Resend](https://resend.com) from Trigger.dev tasks.

## Templates

| Template | Sent when |
|----------|-----------|
| `SyncCompletedEmail` | A store sync finishes successfully |
| `SyncFailedEmail` | A store sync fails |
| `NewProductsReportEmail` | New products are detected in a feed |
| `IntegrationIssueEmail` | A Shopify integration has an error |
| `WeeklyDigestEmail` | Weekly summary (cron) |
| `MonthlyDigestEmail` | Monthly summary (cron) |

## Scripts

```bash
pnpm dev   # preview templates in browser (React Email dev server)
```
