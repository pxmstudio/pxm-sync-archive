# @workspace/i18n

Internationalization for the web app. Supports English and Romanian.

## Locales

Each locale is split into namespaces:

- `common` — shared labels, actions, status text
- `navigation` — sidebar and breadcrumb labels
- `auth` — sign-in, sign-up, invite flows
- `settings` — all settings pages
- `dashboard`, `shop`, `feeds`, `sync`, `activity` — page-specific strings
- `suppliers`, `products`, `collections`, `retailers` — entity-specific strings

## Usage

```tsx
import { useTranslation } from "@workspace/i18n/hooks"

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t.common.save}</h1>
}
```

## Adding a new language

1. Copy `src/locales/en/` to `src/locales/{code}/`
2. Translate all string values
3. Add the locale to the exports in `src/locales/` and register it in the context provider
