# Extension System

A plugin-like extension system that allows new applications to extend and customize the frontend without modifying core client code.

## Features

- **Navigation Extensions**: Add, replace, or hide menu items
- **Page Slot Extensions**: Add custom content to page slots (before/after/replace/hide)
- **Data Hooks**: Intercept data loading and saving operations
- **Priority-based Conflict Resolution**: Multiple plugins can target the same item, highest priority wins
- **Server/Client Hybrid**: Navigation computed on server, slots/hooks on client

## Directory Structure

```
client/src/
├── extensions/           # Extension system core
│   ├── registry.ts        # Type definitions
│   ├── index.ts           # Server-side loader
│   ├── context.tsx        # ExtensionProvider (client)
│   ├── utils/             # Utility functions
│   └── hooks/             # React hooks
│
└── plugins/               # Extension plugins
    └── freight/           # Example: Freight module
        ├── index.ts       # Extension definition
        ├── nav.ts         # Navigation config
        └── slots/         # Page slot components (or sections/ for legacy)
```

## Usage

### 1. Enable Plugins

Add plugin dirs under `src/plugins/<id>/` with `index.ts`; they are auto-discovered by `npm run prepare`. Set `ENABLED_PLUGINS` (comma-separated):

```bash
ENABLED_PLUGINS=freight,custom-module
```

### 2. Create a Plugin

Create a directory under `plugins/` and export an `Extension`:

```typescript
// plugins/my-plugin/index.ts
import type { Extension } from '@/extensions/registry'

const myExtension: Extension = {
  id: 'my-plugin',
  name: 'My Plugin',
  priority: 100,
  
  adminNav: [/* ... */],
  sections: [/* ... */],   // page slot extensions (legacy key; slots preferred in types)
  dataHooks: [/* ... */]
}

export default myExtension
```

### 3. Navigation Extensions

```typescript
adminNav: [
  {
    id: 'add-menu',
    position: 'after',        // 'before' | 'after' | 'replace' | 'hide'
    targetId: 'store',        // Target menu item ID
    items: [/* MenuNode[] */],
    priority: 100             // Optional, overrides Extension priority
  }
]
```

### 4. Page Slot Extensions

Page **slots** define where extension content can be mounted (before/after/replace a slot). Use **blocks** for CMS-driven page content. Slots = "where"; blocks = "what".

```typescript
sections: [
  {
    id: 'my-slot-content',
    page: 'admin/store/products/edit',
    position: 'after',
    targetSlot: 'ProductOrganize',   // or targetSection (deprecated)
    component: MySlotComponent,
    priority: 100
  }
]
```

In page components use `usePageSlots(page)` and `renderSlot(slotId, visibleSlots, replacements, DefaultComponent, props)`.

#### Migration from sections (deprecated)

| Old | New |
|-----|-----|
| `usePageSections(page)` | `usePageSlots(page)` |
| `visibleSections` / `beforeSections` / `afterSections` | `visibleSlots` / `beforeSlots` / `afterSlots` |
| `renderSection(...)` | `renderSlot(slotId, visibleSlots, replacements, Component, props)` |
| `targetSection` in extension | `targetSlot` (or keep `targetSection` during compat window) |

```ts
// Before
const { visibleSections, beforeSections, afterSections, replacements } = usePageSections('admin/store/products/edit')
renderSection('ProductInfo', visibleSections, replacements, ProductInfo, {})

// After
const { visibleSlots, beforeSlots, afterSlots, replacements } = usePageSlots('admin/store/products/edit')
renderSlot('ProductInfo', visibleSlots, replacements, ProductInfo, {})
```

### Tabbed Admin Pages Pattern

For admin pages that render a local `Tabs` UI (for example customer detail, freight-service edit, settings dialogs), keep the core page generic and let extensions inject extra tabs by targeting an existing slot with `position: 'after'`.

Recommended pattern in the page component:

```typescript
const { visibleSlots, afterSlots, replacements } = usePageSlots('admin/store/customers/detail')

const tabExtensions = afterSlots.filter(ext => ext.component && (ext.targetSlot ?? ext.targetSection))
const panelExtensions = afterSlots.filter(ext => ext.component && !(ext.targetSlot ?? ext.targetSection))

const allTabs = buildTabbedPageTabs({
  defaultTabs,
  tabExtensions,
  getAnchorSlotId: slotKeyToSlotId,
  translate: t,
  extensionProps: { customer, onUpdate: handleCustomerUpdate }
})
```

Plugin side:

```typescript
sections: [{
  id: 'loyalty-customer-rewards-tab',
  page: 'admin/store/customers/detail',
  position: 'after',
  targetSlot: 'CustomerInbox',
  component: CustomerRewardsTab,
}]
```

Optional convention for plugin tab labels:

```typescript
MyTabComponent.tabLabel = 'My Tab'
// or
MyTabComponent.tabLabel = (t) => t('myPlugin.tabs.myTab')
```

This keeps `src/client` unaware of plugin namespaces like `loyalty`, while still allowing each extension to own its own label/i18n.

### 5. Data Hooks

```typescript
dataHooks: [
  {
    id: 'my-data-hook',
    page: 'admin/store/products/edit',
    priority: 100,
    onLoad: async (data) => {
      // Transform data on load
      return { ...data, customField: 'value' }
    },
    onSave: async (data) => {
      // Process data before save
      return data
    }
  }
]
```

## Deprecation (section → slot)

The following **section** APIs are deprecated and will be removed in the **next major version**. Use the Slot API instead.

| Deprecated | Use instead |
|------------|-------------|
| `usePageSections(page)` | `usePageSlots(page)` |
| `renderSection(...)` | `renderSlot(...)` |
| `getPageSectionReplacements(extensions, page)` | `getPageSlotReplacements(extensions, page)` |
| `DEFAULT_SECTIONS` | `DEFAULT_SLOTS` |
| Extension field `targetSection` | `targetSlot` |

**Scope:** All of the above remain supported during the compatibility window; only the listed names will be removed. No behavior change until removal.

## Examples

See `plugins/freight/` for a complete example.


## Routes, skins and public files

`prepare` reads Next environment files (production files for `npm run build`) and
uses `ENABLED_PLUGINS`, or `NEXT_PUBLIC_ENABLED_PLUGINS` when the former is absent.
Unset enables all installed contributions; an explicitly empty value disables all.
Keep build and runtime values consistent. Excluded plugins supply no loaders,
routes, skins, assets or short URL rewrites.

Routes live under `app/<area>/plugins/<id>/` for admin, account, auth and the
storefront route group. Public aliases are rewrites to those owned folders. A
plugin cannot overwrite core admin/account/auth folders. Storefront short aliases
skip reserved core prefixes; reserved pages remain available only under the
plugin's physical namespace. Conflicting aliases and static mounts fail prepare.
Keep plugin layouts in route child folders so the generated extension guard wraps
all storefront/account/auth pages. Admin blocks both aliases and physical plugin
URLs while the workspace disables their owner.

Skins may declare `workspaceSlugs` in their root `manifest.json`. The nonempty
list restricts storefront, account and auth selection to those exact workspace
slugs; omit it for a reusable skin. Area metadata cannot override the root scope.
Invalid metadata fails the build. Workspace extension availability also gates skin
selection and the admin skin picker. Fallback is the built-in store or baseline
account/auth layout.

A plugin's `public/` directory copies to `public/plugins/<id>/`. An optional
`public-mounts.json`, for example `[{"source":"/gallery","directory":"media"}]`,
mounts `/gallery/*` to that plugin's public media directory after host file checks.
Assets are public resources. Mounts cannot replace reserved core prefixes or
another plugin's route/mount. Skin public assets retain `/skins/<skinId>/` for
built-ins and `/plugins/<id>/<skinId>/` for extensions.

Prepare plans all routes, skins and public copies before deleting any old output.
Hashes record generated ownership; host files, modified output, traversal and
source/destination links are rejected. On upgrading an old manifest without hashes,
only output identical to its current source can be adopted. Back up/review the
specific ignored output named by the error, remove that generated file, and rerun
prepare. Do not delete source or host files to bypass ownership validation.

## Server storefront contributions

A plugin may export a `StorefrontServerProvider` from `storefront-server.ts`.
This file must import `server-only`. Its loader is generated separately from the
shared extension bundle. Implement `matches(config)` to scope the contribution;
workspace and deployment activation are checked before loading it. Multiple
matching providers or import failures are explicit errors.

Optional hooks contribute home Open Graph images, organization JSON-LD, CMS
presentation/breadcrumbs, legacy route decisions and sitemap entries. Entries must
use the current request origin; `includeCatalogue: false` suppresses the generic
product/category catalogue when the plugin supplies a different content model.
The host keeps its normal CMS/shop behavior when no provider matches. Customer
catalogues, contact details, assets and SEO content remain in the plugin package.
