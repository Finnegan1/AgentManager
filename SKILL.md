---
name: fumadocs-tanstack-start
description: >
  How to write, organize, and structure documentation content with Fumadocs on TanStack Start (SPA mode).
  Trigger this skill whenever the user wants to write or improve docs pages, add MDX content, organize
  the sidebar, use Fumadocs components (Callout, Cards, tabs, etc.), set up navigation structure,
  manage frontmatter, create doc sections, or asks about anything related to authoring content
  in their Fumadocs docs site — even if they just say "add a docs page" or "how do I structure my docs".
---

# Fumadocs Content Authoring (TanStack Start / SPA)

This skill covers how to write, structure, and organize documentation content in a Fumadocs project
running on TanStack Start in SPA mode.

**Key mental model:** Content lives in `content/docs/` as MDX files. The file path becomes the URL slug.
Sidebar structure is controlled via `meta.json` files. Everything is assembled at build time.

---

## Project Layout (content-relevant files only)

```
content/docs/
  meta.json              ← top-level sidebar order/config
  index.mdx              → /docs
  getting-started.mdx    → /docs/getting-started
  guides/
    meta.json            ← sidebar config for this folder
    setup.mdx            → /docs/guides/setup
  (group)/               ← parentheses = no slug impact
    page.mdx             → /docs/page
source.config.ts         ← extend frontmatter schema here
components/mdx.tsx       ← register custom MDX components here
```

---

## 1. Writing MDX Pages

### Frontmatter (top of every `.mdx` file)
```mdx
---
title: Getting Started
description: A brief description shown in search results and cards
icon: RocketIcon         # lucide-react icon name — shown in sidebar
---

## First Section

Your content here...
```

Built-in frontmatter fields:

| Field | Purpose |
|---|---|
| `title` | Page title (required). Renders as the `<h1>` — don't add a `#` heading manually. |
| `description` | Shown in search results, link cards, and OG images |
| `icon` | Lucide icon name shown next to the page in sidebar |

### Adding custom frontmatter fields
Extend the schema in `source.config.ts`:
```ts
import { frontmatterSchema, defineDocs } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema.extend({
      badge: z.string().optional(),       // e.g. "New" or "Beta"
      draft: z.boolean().default(false),  // hide from production
    }),
  },
});
```
Access in the route as `page.data.badge`, `page.data.draft`.

---

## 2. File & Slug Conventions

| File path (relative to `content/docs/`) | URL |
|---|---|
| `index.mdx` | `/docs` |
| `getting-started.mdx` | `/docs/getting-started` |
| `guides/index.mdx` | `/docs/guides` |
| `guides/setup.mdx` | `/docs/guides/setup` |
| `(group)/page.mdx` | `/docs/page` — parentheses group, no slug |

**Rules:**
- `index.mdx` in a folder → that folder's index page
- Parentheses folders `(group-name)/` group pages without changing their slugs
- No duplicate URLs allowed anywhere in the tree — Fumadocs locates active items by pathname

---

## 3. Sidebar Structure with `meta.json`

Create a `meta.json` in any folder to control how it appears in the sidebar.

```json
{
  "title": "Guides",
  "defaultOpen": true,
  "pages": [
    "index",
    "installation",
    "---Configuration---",
    "basic-config",
    "advanced-config",
    "...",
    "!internal-notes",
    "[GitHub](https://github.com/org/repo)"
  ]
}
```

### `pages` array syntax

| Syntax | Effect |
|---|---|
| `"page-name"` | Include a specific page (without `.mdx`) |
| `"..."` | Insert remaining pages, sorted alphabetically |
| `"z...a"` | Remaining pages, reverse alphabetical |
| `"---Label---"` | Visual separator with a label |
| `"---[Icon]Label---"` | Separator with a lucide icon |
| `"!page"` | Exclude a page from `...` expansion |
| `"...folder"` | Inline/extract a subfolder's pages at this level |
| `"./path/to/page"` | Reference a page by relative path |
| `"[Text](url)"` | Insert an external link |
| `"external:[Text](url)"` | External link with indicator icon |
| `"[Icon][Text](url)"` | External link with custom icon |

When `pages` is specified, **only listed items are shown** — unlisted pages are hidden unless `...` is present.

### Folder options

| Field | Description |
|---|---|
| `title` | Display name in sidebar |
| `icon` | Lucide icon name |
| `defaultOpen` | Open folder by default (`true`/`false`) |
| `collapsible` | Allow collapsing (default: `true`) |
| `root` | Mark as a root section — renders as a **sidebar tab** |
| `pages` | Ordered list of items (see above) |

### Root folders = sidebar tabs
```json
{
  "title": "API Reference",
  "root": true
}
```
Root folders appear as top-level tabs in the sidebar. Only the active tab's pages are shown. Great for separating "Guides" from "API Reference" from "Changelog".

---

## 4. MDX Components

All components are available in `.mdx` files without importing — they're registered globally in `components/mdx.tsx`.

### Callout
```mdx
<Callout>Default info callout</Callout>

<Callout type="warn" title="Before you continue">
  Make sure you've completed the prerequisites.
</Callout>

<Callout type="error" title="Breaking change">
  This API was removed in v2.
</Callout>
```

Types: `info` (default) · `warn` / `warning` · `error` · `success` · `idea`

### Cards
```mdx
<Cards>
  <Card href="/docs/quickstart" title="Quickstart">
    Get up and running in 5 minutes.
  </Card>
  <Card href="/docs/api" title="API Reference" icon={<CodeIcon />}>
    Full API documentation.
  </Card>
</Cards>
```

### Code tabs
```mdx
```ts tab="TypeScript"
const greeting: string = 'Hello';
```

```js tab="JavaScript"
const greeting = 'Hello';
```
```

### Include / embed another MDX file
```mdx
<include>./shared/prereqs.mdx</include>
```
Path is relative to the current file. Great for reusing content like prerequisite sections.

### NPM install commands (auto-generates all package managers)
````mdx
```npm
npm install my-package
```
````
Renders tabs for npm / pnpm / yarn / bun automatically.

### Shiki code annotations
```mdx
```ts
const old = 'remove this';   // [!code --]
const new = 'add this';      // [!code ++]
const focus = 'focus here';  // [!code focus]
const highlight = 'notice';  // [!code highlight]
```
```

### Heading TOC control
```mdx
# This heading is hidden from TOC [!toc]

# This only appears in TOC [toc]

# Custom anchor ID [#my-custom-id]
```

---

## 5. Headings & Structure Best Practices

- **Don't use `# H1`** in your MDX body — Fumadocs renders `title` from frontmatter as the H1. Start your content with `##`.
- Headings auto-generate anchor IDs (e.g. `## Hello World` → `#hello-world`).
- Override with `[#custom-id]` syntax if the heading text is likely to change.
- The Table of Contents is auto-generated from all headings in the page.

---

## 6. Linking Between Pages

Internal links use the framework's `<Link>` component automatically (prefetching, no hard reload):
```mdx
See [Getting Started](/docs/getting-started) for more.

[Configuration guide](./configuration)  ← relative paths also work
```

External links automatically get `rel="noreferrer noopener" target="_blank"`.

### "Further reading" cards from sibling pages
In the route component (not in MDX), you can render peer pages as cards:
```tsx
import { getPageTreePeers } from 'fumadocs-core/page-tree';

<Cards>
  {getPageTreePeers(source.getPageTree(), '/docs/current-page').map((peer) => (
    <Card key={peer.url} title={peer.name} href={peer.url}>
      {peer.description}
    </Card>
  ))}
</Cards>
```

---

## 7. Custom MDX Components

Register custom components in `components/mdx.tsx` — they're available in all MDX files without importing:

```tsx
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { MyPlayground } from './playground';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    MyPlayground,           // use as <MyPlayground /> in MDX
    // override default elements:
    // img: (props) => <ZoomableImage {...props} />,
    ...components,
  };
}
```

---

## 8. Quick Reference

| Task | How |
|------|-----|
| Create a new page | Add `.mdx` file in `content/docs/` |
| Set page title | `title:` in frontmatter |
| Control sidebar order | `meta.json` → `pages` array |
| Hide a page from sidebar | Don't include it in `meta.json` `pages` (when `pages` is defined) |
| Create a section separator | `"---Label---"` in `meta.json` pages |
| Add an external sidebar link | `"[Text](https://...)"` in `meta.json` pages |
| Group pages without changing URLs | Wrap folder name in `(parentheses)` |
| Create sidebar tabs | `meta.json` with `"root": true` in a subfolder |
| Reuse content across pages | `<include>./path/to/file.mdx</include>` |
| Add a tip/warning box | `<Callout type="warn">...</Callout>` |
| Show multi-language code | Code blocks with `tab="Label"` |
| Add page icon in sidebar | `icon: IconName` in frontmatter |
| Custom frontmatter fields | Extend schema in `source.config.ts` |

---

## 9. Official Docs

- Markdown/MDX guide: https://www.fumadocs.dev/docs/markdown
- Page conventions & slugs: https://www.fumadocs.dev/docs/page-conventions
- Navigation: https://www.fumadocs.dev/docs/navigation
- Collections/frontmatter schema: https://www.fumadocs.dev/docs/mdx/collections
- Built-in UI components: https://www.fumadocs.dev/docs/ui/components
