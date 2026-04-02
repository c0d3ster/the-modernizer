# The Modernizer - Implementation Plan

A CLI tool that crawls outdated websites, extracts structured content, and regenerates them as modern, responsive Next.js applications.

---

## Table of Contents

1. [Project Overview and Architecture](#1-project-overview-and-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Component Library Strategy](#3-component-library-strategy)
4. [Repository Structure](#4-repository-structure)
5. [Phase 1: Foundation](#phase-1-foundation)
6. [Phase 2: Crawler](#phase-2-crawler)
7. [Phase 3: Extractor](#phase-3-extractor)
8. [Phase 4: Component Library (Atomic Design)](#phase-4-component-library-atomic-design)
9. [Phase 5: Generator](#phase-5-generator)
10. [Phase 6: CLI + Integration](#phase-6-cli--integration)
11. [Phase 7: Polish + Edge Cases](#phase-7-polish--edge-cases)
12. [Testing Strategy](#12-testing-strategy)
13. [Task Checklist](#13-task-checklist)
14. [Implementation Notes for Claude Code](#implementation-notes-for-claude-code)

---

## 1. Project Overview and Architecture

The Modernizer is a command-line tool that accepts a URL, crawls the site, extracts and structures its content, and outputs a complete Next.js + Tailwind CSS project with modern, mobile-friendly design. It targets brochure sites, landing pages, and simple informational sites (typically 5-50 pages of mostly static content).

### Pipeline Architecture

The system is a four-stage pipeline. Each stage has a clean interface boundary so it can be developed, tested, and improved independently.

| Stage       | Input                      | Output                         | Primary Tool           |
| ----------- | -------------------------- | ------------------------------ | ---------------------- |
| 1. Crawl    | Seed URL                   | Raw HTML + metadata per page   | Playwright / fetch     |
| 2. Extract  | Raw HTML per page          | Structured page schemas (JSON) | Cheerio + Claude API   |
| 3. Generate | Page schemas + site schema | Next.js project files          | Claude API + templates |
| 4. Output   | Generated project          | Runnable Next.js app           | File system            |

### Key Design Decisions

**Monorepo with shared schema package.** The TypeScript types that define content blocks, page schemas, and site schemas are the contract between every layer. Changes to the schema surface type errors across the whole codebase immediately.

**Deterministic first, LLM second.** Every stage tries fast, predictable code-based approaches before falling back to LLM calls. This keeps costs low, speed high, and output reproducible.

**Opinionated component library over freeform generation.** Rather than generating bespoke layouts, the system maps content into a fixed set of well-designed, responsive components. This trades layout flexibility for consistency and quality.

**Atomic design methodology.** Components are organized into atoms, molecules, organisms, and templates following Brad Frost's atomic design system. This creates a clear hierarchy of composition and makes the library intuitive to extend.

---

## 2. Tech Stack

| Layer                | Technology                                     | Purpose                                         |
| -------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Language             | TypeScript (Node.js)                           | Entire pipeline, shared types                   |
| Monorepo             | Turborepo                                      | Package management, build orchestration         |
| Crawling             | Playwright                                     | Headless browser for JS-rendered sites          |
| Crawling (fast path) | undici / native fetch                          | Static HTML sites (skip browser overhead)       |
| HTML parsing         | Cheerio                                        | DOM traversal, link extraction, content parsing |
| Content extraction   | Mozilla Readability (via @mozilla/readability) | Article-style content extraction                |
| LLM                  | Anthropic SDK (Claude Sonnet)                  | Content classification, structuring, generation |
| Output framework     | Next.js 14+ (App Router)                       | Generated site framework                        |
| Output styling       | Tailwind CSS                                   | Responsive utility-first styling                |
| CLI                  | Commander.js                                   | Command-line argument parsing                   |
| Testing              | Vitest                                         | Unit and integration tests                      |
| Validation           | Zod                                            | Runtime schema validation for LLM outputs       |

---

## 3. Component Library Strategy

### Why custom over Material UI

The Modernizer generates sites that should look custom and modern, not like a Material Design application. Material UI carries a recognizable aesthetic that is wrong for brochure sites. It also brings significant bundle size (80-150KB gzipped for a typical setup) that is unjustifiable for what are essentially static marketing pages. More importantly, MUI's theming system would fight against the dynamic brand color extraction; the tool needs to generate a custom Tailwind color scale per site, and MUI's theme provider model does not align well with that pattern.

The better mental model is shadcn/ui: unstyled or lightly styled primitives built on Tailwind that you own entirely. You can use shadcn components as a starting point for atoms, then build up from there. The generated output has zero runtime dependency on an external component library; every component is a plain React file in the output project.

### Where the component library lives

For v1, the component library lives inside the monorepo as a package (packages/ui). This keeps iteration speed high while the designs are still stabilizing. The generator references the component templates directly from this package when assembling output projects.

### When to extract: the readiness signals

Extracting too early adds friction (cross-repo PRs, version management, publish cycles) when you are still figuring out what the components need to look like. Extracting too late means the ui package accumulates hidden coupling with the rest of the monorepo. The right time is when the following signals converge:

- **Component APIs are stable.** You have run 10-20 real sites through the tool and the prop interfaces for atoms, molecules, and organisms have stopped changing significantly. A good heuristic: if the last 5 sites required zero changes to existing component props (only new content/data), the APIs are stable.
- **You want to use the components elsewhere.** The moment you find yourself copying component files into another project or thinking "I wish I could npm install this," it is time.
- **The preview app feels like documentation.** When apps/preview is comprehensive enough that someone unfamiliar with the project could browse it and understand every component, the library is mature enough to stand alone.
- **Generator coupling is minimal.** The generator should only interact with the ui package through two interfaces: reading component source files to copy into output projects, and importing TypeScript types. If you find the generator reaching into ui internals or ui importing from the generator/extractor/crawler, fix that coupling before extracting.

Realistically, this is a Phase 7+ activity. Do not attempt extraction until the core pipeline is working end-to-end and you have processed enough real sites to be confident in the component designs. Expect this to happen roughly 2-3 months after the initial v1 launch, depending on how many sites you run through it.

### Extraction process: step by step

When the readiness signals align, follow this process to cleanly extract packages/ui into its own repository without disrupting the working pipeline.

#### Step E.1: Audit and decouple

Before touching any repo structure, audit the dependency graph. Run a check for any imports in packages/ui that reference packages/crawler, packages/extractor, or packages/generator. There should be none; if there are, refactor them out first. The only allowed dependency from ui should be packages/schema (for the block type definitions). Also audit the reverse: make sure the generator only imports from ui through clean, documented entry points (the index.ts barrel exports), not by reaching into internal file paths.

#### Step E.2: Prepare the package for standalone publishing

Update packages/ui/package.json to be publishable. Add: name (e.g., @modernizer/ui or your preferred scope), version (start at 0.1.0), main/module/types entry points, files whitelist, repository URL, license, and peerDependencies (react, react-dom, next, tailwindcss). Add a build step that compiles TypeScript and outputs to a dist/ directory. Add an exports map so consumers can import from subpaths (@modernizer/ui/atoms, @modernizer/ui/organisms, etc.).

The package.json exports map should look like:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./atoms": "./dist/atoms/index.js",
    "./molecules": "./dist/molecules/index.js",
    "./organisms": "./dist/organisms/index.js",
    "./templates": "./dist/templates/index.js",
    "./styles": "./dist/styles/index.js"
  }
}
```

#### Step E.3: Inline or fork the schema dependency

The ui package imports block types from packages/schema. When ui moves to its own repo, it cannot reference a sibling monorepo package. You have two options:

- **Option A (recommended):** Publish packages/schema as its own npm package (e.g., @modernizer/schema) first. Both the ui repo and the modernizer monorepo depend on the published schema package. Changes to schema types require a schema release before either consumer can use them. This is the cleanest separation.
- **Option B:** Copy the relevant type definitions into the ui package and maintain them in both places. Simpler upfront but creates drift risk. Only viable if schema types are truly stable and rarely change.

#### Step E.4: Create the new repository

Create a new GitHub repository (e.g., modernizer-ui). Initialize it with the contents of packages/ui, preserving git history if desired (use git filter-branch or git subtree split to extract the package's commit history). Set up the new repo with: tsconfig, eslint, prettier, Vitest for tests, a build script (tsup or unbuild work well for library builds), Changesets for version management, and a GitHub Actions workflow for CI + npm publish.

#### Step E.5: Migrate the preview app

Move apps/preview into the new ui repository. It becomes the library's documentation and development playground, equivalent to a Storybook instance. Update its imports to reference the local package source (using workspace linking in the new repo) rather than monorepo paths. This preview app can also serve as the basis for a published documentation site if you want to showcase the component library publicly.

#### Step E.6: Update the Modernizer to consume the published package

Back in the Modernizer monorepo, remove packages/ui and apps/preview. Add @modernizer/ui as a dependency of packages/generator. Update the generator's component-writer.ts to resolve component source files from node_modules/@modernizer/ui instead of ../ui. Pin to a specific version in package.json so generator output is deterministic and does not break when the ui library ships a new version.

The generator has two strategies for consuming the library at this point:

- **Vendor mode (recommended for v1):** The generator reads component source files from the installed package and copies them into the output project, same as before extraction. The output project has no runtime dependency on @modernizer/ui. This is the safest approach because generated sites are fully self-contained.
- **Dependency mode (future):** The generator adds @modernizer/ui to the output project's package.json and imports components from it at runtime. This makes generated projects smaller and easier to update (just bump the ui version), but creates a hard dependency on the published package. Only move to this mode when the library is stable enough that version bumps are non-breaking.

#### Step E.7: Set up cross-repo workflows

Once the library is in its own repo, you need lightweight processes to keep things in sync:

- **Changesets + semantic versioning** in the ui repo. Every PR that changes component APIs gets a changeset entry. Patch for fixes, minor for new components or non-breaking prop additions, major for breaking prop changes.
- **A Renovate or Dependabot config** in the Modernizer repo that opens PRs when @modernizer/ui publishes a new version. Review these PRs by running the E2E test suite to catch regressions before merging.
- **A shared design tokens package** (or include tokens in @modernizer/schema) so spacing, typography, and color utilities stay in sync between the ui library and the generator's Tailwind config output.

### Post-extraction repo structure

After extraction, you have two repositories:

```
modernizer-ui/                    # Standalone component library repo
  src/
    atoms/
    molecules/
    organisms/
    templates/
    styles/
    index.ts
  preview/                        # Migrated from apps/preview
    app/
      page.tsx
      atoms/page.tsx
      molecules/page.tsx
  package.json                    # Publishable: @modernizer/ui
  tsup.config.ts                  # Library build config
  .changeset/                     # Version management

the-modernizer/                   # CLI tool monorepo (slimmer now)
  packages/
    schema/
    crawler/
    extractor/
    generator/                    # Now depends on @modernizer/ui from npm
  apps/
    cli/
    web/
```

### Atomic design structure

The component library follows atomic design methodology. This creates a natural composition hierarchy where complex page sections are built from simpler, reusable pieces.

| Layer     | What Lives Here                                                                               | Examples                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Atoms     | Smallest UI primitives. Single-purpose, no business logic.                                    | Button, Badge, Heading, Text, Icon, Image, Input, Link, Divider                                                                            |
| Molecules | Small groups of atoms functioning as a unit.                                                  | FeatureCard, TestimonialCard, TeamMemberCard, StatItem, PricingTier, NavLink, SearchBar, ContactDetail                                     |
| Organisms | Complex UI sections composed of molecules and atoms. These map 1:1 to ContentBlock types.     | Hero, FeatureGrid, TestimonialSection, TeamGrid, FAQ, CTABanner, ContactInfo, PricingTable, Stats, ImageGallery, LogoCloud, Footer, Navbar |
| Templates | Page-level layout skeletons that define block ordering and structural wrapping per archetype. | HomepageTemplate, AboutTemplate, ServicesTemplate, ContactTemplate, GenericTemplate                                                        |

The key mapping: ContentBlock types from the schema map to organisms. Each organism is composed of molecules and atoms. The generator assembles organisms into templates based on the page archetype. This means adding a new content block type requires building one new organism (possibly with new molecules/atoms), but the template and generator layers rarely need to change.

---

## 4. Repository Structure

```
the-modernizer/
  packages/
    schema/                    # Shared TypeScript types (the contract)
      src/
        index.ts               # Re-exports everything
        blocks.ts              # ContentBlock union + each block type
        page.ts                # PageSchema, PageArchetype
        site.ts                # SiteSchema, NavItem, BrandColors
        validation.ts          # Zod schemas mirroring the TS types
    ui/                        # Component library (atomic design)
      src/
        atoms/
          Button.tsx
          Badge.tsx
          Heading.tsx
          Text.tsx
          Icon.tsx
          Image.tsx
          Link.tsx
          Divider.tsx
          Input.tsx
          Container.tsx        # Max-width wrapper with responsive padding
          Section.tsx          # Vertical section with consistent py spacing
          index.ts
        molecules/
          FeatureCard.tsx
          TestimonialCard.tsx
          TeamMemberCard.tsx
          StatItem.tsx
          PricingTier.tsx
          NavLink.tsx
          NavDropdown.tsx
          ContactDetail.tsx    # Single contact line (phone, email, address)
          FAQItem.tsx          # Single accordion item (client component)
          GalleryImage.tsx
          LogoItem.tsx
          index.ts
        organisms/
          Hero.tsx             # Maps to HeroBlock
          TextSection.tsx      # Maps to TextSectionBlock
          FeatureGrid.tsx      # Maps to FeatureGridBlock
          Testimonials.tsx     # Maps to TestimonialBlock
          TeamGrid.tsx         # Maps to TeamGridBlock
          CTABanner.tsx        # Maps to CTABlock
          ContactInfo.tsx      # Maps to ContactInfoBlock
          FAQ.tsx              # Maps to FAQBlock (client component)
          Stats.tsx            # Maps to StatsBlock
          ImageGallery.tsx     # Maps to ImageGalleryBlock
          PricingTable.tsx     # Maps to PricingTableBlock
          LogoCloud.tsx        # Maps to LogoCloudBlock
          Embed.tsx            # Maps to EmbedBlock
          GenericSection.tsx   # Maps to GenericSectionBlock (fallback)
          Navbar.tsx           # Site navigation (client component)
          Footer.tsx           # Site footer
          index.ts
        templates/
          HomepageTemplate.tsx
          AboutTemplate.tsx
          ServicesTemplate.tsx
          ContactTemplate.tsx
          GenericTemplate.tsx
          index.ts
        styles/
          tokens.ts            # Spacing scale, type scale, color helpers
          tailwind-preset.ts   # Shared Tailwind config preset
        index.ts               # Re-exports all layers
    crawler/
      src/
        index.ts               # Main crawl() entry point
        fetcher.ts             # Static fetch + Playwright fallback
        link-extractor.ts      # Parse nav/body for internal links
        url-utils.ts           # Normalize, dedupe, same-domain filter
        rate-limiter.ts        # Concurrency + delay control
    extractor/
      src/
        index.ts               # Main extract() entry point
        strip-chrome.ts        # Remove shared nav/header/footer/sidebar
        block-splitter.ts      # Split body into raw content blocks
        metadata.ts            # Extract title, description, images
        classify.ts            # LLM-based block classification
        site-data.ts           # Extract nav structure, brand colors, footer
        prompts/
          classify-blocks.ts   # Prompt template for block classification
          classify-archetype.ts
          extract-nav.ts
          extract-brand.ts
    generator/
      src/
        index.ts               # Main generate() entry point
        scaffold.ts            # Create Next.js project skeleton
        page-generator.ts      # Render pages from schemas
        layout-generator.ts    # Generate root layout, nav, footer
        tailwind-config.ts     # Generate tailwind.config with brand colors
        asset-handler.ts       # Image references, downloads, optimization
        component-writer.ts    # Writes ui package components into output project
        block-renderer.ts      # Maps ContentBlock to organism component
  apps/
    cli/                       # CLI entry point
      src/
        index.ts               # Commander setup, orchestration
        progress.ts            # Terminal progress display
    preview/                   # Visual test harness for the component library
      app/
        page.tsx               # Renders all organisms with sample data
        atoms/page.tsx         # Atom showcase
        molecules/page.tsx     # Molecule showcase
    web/                       # (Future) Web UI
  turbo.json
  package.json
  tsconfig.base.json
```

---

## Phase 1: Foundation

_Schema definitions and project scaffolding. Everything else depends on this._

### Step 1.1: Initialize monorepo

Set up Turborepo with the four packages (schema, crawler, extractor, generator) and one app (cli). Configure shared tsconfig, eslint, and prettier. Each package builds independently and exports typed interfaces.

### Step 1.2: Define the content block types

This is the most important design decision in the entire project. These types are the data contract between extraction and generation. Start with these block types:

| Block Type          | Key Fields                                       | Covers                                       |
| ------------------- | ------------------------------------------------ | -------------------------------------------- |
| HeroBlock           | headline, subheadline, ctas[], backgroundImage?  | Hero banners, splash sections, main headers  |
| TextSectionBlock    | heading?, body (markdown string), alignment?     | About text, mission statements, descriptions |
| FeatureGridBlock    | heading?, features[]{title, description, icon?}  | Value props, service cards, benefits lists   |
| TestimonialBlock    | heading?, items[]{quote, author?, role?, image?} | Reviews, quotes, endorsements                |
| TeamGridBlock       | heading?, members[]{name, role, bio?, image?}    | Staff pages, leadership sections             |
| CTABlock            | heading, description?, ctas[], variant           | Call-to-action banners, signup sections      |
| ContactInfoBlock    | address?, phone?, email?, hours?, mapEmbed?      | Contact details, location info               |
| FAQBlock            | heading?, items[]{question, answer}              | FAQ sections, Q&A                            |
| StatsBlock          | heading?, stats[]{value, label, description?}    | Metrics, numbers, achievements               |
| ImageGalleryBlock   | heading?, images[]{src, alt, caption?}           | Photo galleries, image grids                 |
| PricingTableBlock   | heading?, tiers[]{name, price, features[], cta}  | Pricing sections                             |
| LogoCloudBlock      | heading?, logos[]{src, alt, href?}               | Partner logos, client logos, trust badges    |
| EmbedBlock          | html, source?                                    | Maps, videos, third-party widgets            |
| GenericSectionBlock | heading?, html                                   | Fallback for unclassified content            |

### Step 1.3: Define page and site schemas

PageSchema: slug, title, description, archetype (enum), blocks (ContentBlock[]). SiteSchema: site name, tagline, brandColors, navigation tree, footer data, and pages array. PageArchetype enum: homepage, about, services, contact, team, pricing, blog_listing, blog_post, faq, legal, generic.

### Step 1.4: Create Zod validation schemas

Mirror every TypeScript type with a Zod schema. These are critical for validating LLM output at runtime. The LLM returns JSON; Zod parses and validates it before the generator ever sees it. Invalid blocks fall back to GenericSectionBlock rather than crashing the pipeline.

### Step 1.5: Write schema tests

Unit tests that validate the Zod schemas accept well-formed data and reject malformed data. Include edge cases: empty arrays, missing optional fields, very long strings, HTML in string fields.

---

## Phase 2: Crawler

_Discovers and fetches all pages on a target site._

### Step 2.1: URL utilities

Build url-utils.ts with functions for: normalizing URLs (force HTTPS, strip trailing slashes, lowercase domain, remove fragments), checking same-domain, detecting asset URLs (.pdf, .png, .jpg, .doc, etc.), and deduplication via a Set of normalized URLs.

### Step 2.2: Static fetcher

Implement the fast path: plain HTTP fetch using undici. Fetch the page, check if the returned HTML contains meaningful content in the body (not just a loading spinner or empty div). If the body has substantial text content (heuristic: >200 characters of visible text after stripping tags), the static fetch succeeded. Return the HTML plus response metadata (status code, content-type, final URL after redirects).

### Step 2.3: Playwright fallback fetcher

When the static fetcher returns insufficient content, fall back to Playwright. Launch a headless Chromium instance, navigate to the URL, wait for networkidle (or a configurable timeout), then capture the final DOM via page.content(). Reuse the browser instance across pages to avoid the ~2s launch overhead per page. Close it after the crawl completes.

### Step 2.4: Link extractor

Parse HTML with Cheerio. Extract all internal links from: nav elements, anchor tags in the body, footer links, and sidebar navigation. Filter out hash-only links (#), javascript: links, and external domains. Normalize all discovered URLs. Return a deduplicated array.

### Step 2.5: BFS crawler with rate limiting

Implement a breadth-first crawl starting from the seed URL. Maintain a queue of URLs to visit and a Set of visited URLs. For each page: fetch it, extract links, add new links to the queue. Configurable options: max depth (default 3), max pages (default 50), concurrent requests (default 3), delay between requests (default 200ms). Respect robots.txt if present.

### Step 2.6: Crawl output format

Each crawled page produces a CrawlResult object:

```typescript
{ url, finalUrl, title, rawHtml, statusCode, fetchMethod, images[], assets[], internalLinks[], crawledAt }
```

### Step 2.7: Crawler tests

Unit tests for URL normalization, link extraction (mock HTML), and same-domain checking. Integration test that crawls a small local test server (use a simple Express app serving 3-4 static HTML pages with known link structure).

---

## Phase 3: Extractor

_Converts raw HTML into structured page schemas. The hardest layer to get right._

### Step 3.1: Chrome stripping (deterministic)

Given all crawled pages, identify shared elements that appear across most pages. Strategy: hash the outerHTML of top-level children in each page's body. Elements whose hash appears on >60% of pages are chrome (nav, header, footer, sidebar). Remove them from each page's content but preserve the first occurrence for site-level extraction. Also remove by semantic signals: elements with role="navigation", `<nav>`, `<header>`, `<footer>` tags, and common class names (cookie-banner, popup, modal, widget-area, sidebar).

### Step 3.2: Metadata extraction (deterministic)

From each page, extract: page title (from `<h1>`, falling back to `<title>` tag), meta description, Open Graph tags, canonical URL, and all image sources with their context (alt text, surrounding text, whether they are in a gallery, slider, or inline).

### Step 3.3: Block splitting (deterministic)

Split the remaining body content into discrete blocks. Split at: heading tags (h1-h4), `<hr>` elements, `<section>` or semantic container boundaries, and large structural divs (direct children of the main content area). Each block retains its inner HTML. Goal: 3-15 blocks per page. If a page produces only 1 block, it's likely a simple text page. If it produces >15, some blocks should be merged (adjacent paragraphs without headings between them).

### Step 3.4: Site-level data extraction (LLM)

Send the preserved chrome HTML (nav, footer) to the Claude API once per site. Extract: site name, tagline, complete navigation tree (nested structure with labels and URLs), footer content (address, phone, social links, legal text), and brand color candidates (parse the CSS for most-used non-neutral colors in backgrounds, links, and headings).

### Step 3.5: Block classification (LLM)

For each page, send its title + array of raw HTML blocks to the Claude API. The prompt provides the list of valid block types with descriptions and asks the LLM to classify each block and extract the structured fields for that type. Use Zod to validate the returned JSON. Any block that fails validation becomes a GenericSectionBlock with the raw HTML preserved.

Key prompt engineering considerations:

- Provide 2-3 few-shot examples covering common block types (hero, text section, testimonial).
- Instruct the LLM to preserve all text content exactly, never summarize or rewrite.
- Instruct JSON-only output with no markdown fences or preamble.
- Include the full block type schema definitions in the prompt so the LLM knows exactly what fields to return.

### Step 3.6: Page archetype classification (LLM)

After blocks are classified, send the page title + list of block types to the Claude API to classify the page archetype. This is a simple classification task: given "Our Residential Program" with blocks [text_section, text_section, text_section, cta], the archetype is "services" or "program_detail". This can be batched with block classification in the same API call to save a round trip.

### Step 3.7: Extraction output assembly

Assemble all extraction results into a complete SiteSchema: site-level data + array of PageSchemas. Validate the entire structure with the Zod site schema. Write it to disk as a JSON file (this also serves as a useful intermediate artifact for debugging).

### Step 3.8: Extractor tests

Unit tests for chrome stripping (mock multi-page HTML with shared elements), block splitting (various page structures), and metadata extraction. Integration tests using saved HTML fixtures from real sites (Edgehill pages are a good starting fixture set). Mock the Claude API for classification tests to keep them fast and deterministic.

---

## Phase 4: Component Library (Atomic Design)

_The React components that render each content block type. Organized in atomic design layers: atoms, molecules, organisms, templates._

### Step 4.1: Component architecture decisions

All components are React Server Components (no "use client" directive) unless they require interactivity (mobile nav toggle, FAQ accordion, image gallery lightbox). Each organism accepts its corresponding block type as props. All styling is Tailwind utility classes, no separate CSS files. Components are copied into the generated output project by the generator, so they must be self-contained with no imports outside the ui package.

The ui package lives at packages/ui and exports all layers. Components at each layer only import from layers below them: molecules import atoms, organisms import molecules and atoms, templates import organisms. No upward or sideways imports. This enforces a clean composition hierarchy.

### Step 4.2: Build atoms

Atoms are the smallest primitives. They wrap native HTML elements with consistent styling and accept standard props. Build these first since everything else composes from them.

| Atom      | Wraps                    | Key Props                                                             |
| --------- | ------------------------ | --------------------------------------------------------------------- |
| Button    | `<button>` / `<a>`       | variant (primary/secondary/ghost), size (sm/md/lg), href?, children   |
| Badge     | `<span>`                 | variant (default/success/warning), children                           |
| Heading   | `<h1>`-`<h6>`            | level (1-6), children; auto-maps to Tailwind type scale               |
| Text      | `<p>`                    | size (sm/base/lg), muted?, children                                   |
| Icon      | `<svg>`                  | name (from a small built-in icon set), size                           |
| Image     | Next.js `<Image>`        | src, alt, aspectRatio?, fill?, priority?                              |
| Link      | `<a>` / Next `<Link>`    | href, external?, children                                             |
| Divider   | `<hr>`                   | spacing (sm/md/lg)                                                    |
| Input     | `<input>` / `<textarea>` | type, label?, placeholder?                                            |
| Container | `<div>`                  | Max-width wrapper: max-w-6xl mx-auto px-4 sm:px-6 lg:px-8             |
| Section   | `<section>`              | Vertical padding wrapper: py-16 lg:py-24, optional background variant |

### Step 4.3: Build molecules

Molecules combine atoms into small functional units. Each molecule is a self-contained piece of UI that appears inside an organism.

| Molecule        | Composed From                   | Notes                                                                                 |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| FeatureCard     | Icon + Heading + Text           | Card with optional icon, title, description. Subtle border, rounded corners.          |
| TestimonialCard | Text + Text                     | Quote in serif italic + author name/role. Card variant.                               |
| TeamMemberCard  | Image + Heading + Text          | Photo (or placeholder avatar) + name + role + optional bio.                           |
| StatItem        | Heading + Text                  | Large number + label + optional description.                                          |
| PricingTier     | Heading + Text + Badge + Button | Tier name, price, feature list, CTA button. Highlighted variant for recommended tier. |
| NavLink         | Link                            | Single nav item with active state styling.                                            |
| NavDropdown     | NavLink + Link[]                | Dropdown trigger with child links. Handles hover/click open.                          |
| ContactDetail   | Icon + Text                     | Single contact line: icon (phone/email/map pin) + value.                              |
| FAQItem         | Heading + Text                  | Accordion item with expand/collapse (client component). Accessible aria attributes.   |
| GalleryImage    | Image                           | Image with lazy loading, aspect ratio container, optional caption.                    |
| LogoItem        | Image + Link                    | Logo with grayscale filter, color on hover, optional link.                            |

### Step 4.4: Build organisms

Organisms are the complex UI sections that map 1:1 to ContentBlock types from the schema. Each organism accepts its block type as props and composes molecules and atoms into a complete section. Build them in this priority order:

| Priority | Organism       | Molecules Used               | Notes                                                                                              |
| -------- | -------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| 1        | Hero           | Button                       | 3 variants: image bg, solid color bg, split layout. Mobile: stack vertically, reduce heading size. |
| 2        | TextSection    | (atoms only)                 | Heading + body. Body is markdown, render with prose formatting. max-w-3xl container.               |
| 3        | FeatureGrid    | FeatureCard                  | Responsive grid: 3 cols desktop, 2 tablet, 1 mobile.                                               |
| 4        | CTABanner      | Button                       | Full-width, brand color bg, heading + description + buttons.                                       |
| 5        | ContactInfo    | ContactDetail                | Card layout with address, phone, email, hours. Optional map embed.                                 |
| 6        | Testimonials   | TestimonialCard              | 2 cols desktop, 1 mobile. Optional carousel for >4 testimonials.                                   |
| 7        | TeamGrid       | TeamMemberCard               | 3-4 cols desktop, 2 tablet, 1 mobile.                                                              |
| 8        | FAQ            | FAQItem                      | Accordion list. Client component (useState for open/close state).                                  |
| 9        | Stats          | StatItem                     | Horizontal desktop, 2x2 grid mobile.                                                               |
| 10       | ImageGallery   | GalleryImage                 | Responsive grid. Optional lightbox (client component).                                             |
| 11       | PricingTable   | PricingTier                  | Side-by-side tiers, highlighted recommended. Stack on mobile.                                      |
| 12       | LogoCloud      | LogoItem                     | Horizontal row, wrapping. Centered layout.                                                         |
| 13       | Embed          | (atoms only)                 | Responsive iframe wrapper with aspect-ratio container. Sanitize HTML.                              |
| 14       | GenericSection | (atoms only)                 | Fallback: heading + sanitized HTML in prose container.                                             |
| 15       | Navbar         | NavLink, NavDropdown, Button | Responsive nav. Client component (mobile toggle). Logo left, CTA right.                            |
| 16       | Footer         | Link, ContactDetail          | Multi-column desktop, stacked mobile. Nav links + contact + legal.                                 |

### Step 4.5: Build templates

Templates define page-level layout structure per archetype. They do not contain content; they define which organisms appear in what order and how they are wrapped. The generator fills templates with organisms based on the page schema's block array.

| Template         | Typical Block Order                             | Layout Notes                                     |
| ---------------- | ----------------------------------------------- | ------------------------------------------------ |
| HomepageTemplate | Hero > FeatureGrid > Testimonials > CTA > Stats | Hero is full-bleed. Other sections alternate bg. |
| AboutTemplate    | TextSection > TeamGrid > Testimonials           | Constrained-width header. Prose-focused layout.  |
| ServicesTemplate | Hero (small) > TextSection > FeatureGrid > CTA  | Service details with supporting features.        |
| ContactTemplate  | TextSection > ContactInfo > Embed (map)         | Contact-focused with prominent phone/address.    |
| GenericTemplate  | blocks rendered in schema order                 | No archetype-specific wrapping. Safe fallback.   |

### Step 4.6: Design tokens and shared styles

Define a consistent design token system in packages/ui/src/styles/tokens.ts. This includes: spacing scale (section padding: py-16 lg:py-24; container: max-w-6xl mx-auto px-4 sm:px-6 lg:px-8), typography scale (h1 text-4xl lg:text-5xl, h2 text-3xl lg:text-4xl, h3 text-xl lg:text-2xl, body text-base lg:text-lg), and color utility helpers (functions to generate a full 50-900 color scale from a single brand hex value). Also create a Tailwind preset at packages/ui/src/styles/tailwind-preset.ts that generated projects extend, ensuring consistent base styles.

### Step 4.7: Preview app (visual test harness)

Build a standalone Next.js app at apps/preview that imports and renders every component with sample data. Organized by atomic layer: /atoms shows all atoms, /molecules shows all molecules, and the root page renders full organisms assembled into page-like layouts using Edgehill fixture data. This lets you visually verify every component before the generator exists and serves as living documentation for the component library.

---

## Phase 5: Generator

_Takes a SiteSchema and outputs a complete, runnable Next.js project._

### Step 5.1: Project scaffolding

Generate the Next.js project skeleton: package.json (with next, react, tailwindcss dependencies), tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js, and the app/ directory structure. This is all template-based, no LLM needed. The scaffolder writes these files to the output directory.

### Step 5.2: Tailwind config generation

Generate tailwind.config.ts with the site's brand colors mapped to a custom color scale. Take the primary brand color from the site schema and generate a full scale (50-900) using color manipulation (lighten/darken). Also set the default font family. This makes every component automatically use the site's brand without per-component customization.

### Step 5.3: Layout generation

Generate the root layout.tsx with: HTML head (title, meta description, font imports), the Nav component (built from the site schema navigation tree), and the Footer component (built from footer data). Every page inherits this layout.

### Step 5.4: Page generation from archetypes

For each page in the site schema, generate a page.tsx file at the correct route path. The generator looks up the page archetype and uses it to determine block ordering and any archetype-specific layout wrapping. Then it renders each content block through its component generator.

The page generation flow:

1. Map the page slug to a Next.js route path (e.g., /about/our-mission/ becomes app/about/our-mission/page.tsx).
2. Look up the archetype template, which defines any structural wrapping (e.g., homepage might have a full-bleed hero, while "about" pages have a constrained-width header).
3. For each block in the page schema, call the corresponding component generator to produce a JSX string.
4. Concatenate the component strings within the page template and write the file.

### Step 5.5: Asset handling

Strategy for images: reference the original URLs in the generated site. This means the modernized site initially depends on the old site's hosting for images. Add a --download-assets flag that fetches all images to a local public/ directory and rewrites the URLs. For a v1, referencing originals is fine and keeps the tool fast.

### Step 5.6: Static export verification

After generating the project, run next build programmatically to verify the output compiles without errors. Report any build failures with the offending file and error message so they can be debugged. This is the generator's self-test.

### Step 5.7: Generator tests

Feed the Edgehill SiteSchema (hand-crafted or from the extractor) through the generator. Verify: correct number of page files created, correct route paths, all components render valid JSX, next build succeeds, and the output visually matches expectations (manual review).

---

## Phase 6: CLI + Integration

_Wire everything together into a single command._

### Step 6.1: CLI argument parsing

Command signature:

```
npx the-modernizer <url> --output <dir> [options]
```

Options:

| Flag              | Default      | Description                                               |
| ----------------- | ------------ | --------------------------------------------------------- |
| --output, -o      | ./modernized | Output directory for the generated Next.js project        |
| --max-pages       | 50           | Maximum pages to crawl                                    |
| --max-depth       | 3            | Maximum link-following depth from seed URL                |
| --concurrency     | 3            | Parallel page fetches                                     |
| --style           | clean        | Design style preset: clean, minimal, warm, corporate      |
| --primary-color   | (extracted)  | Override the auto-detected brand color                    |
| --download-assets | false        | Download images to local public/ directory                |
| --schema-only     | false        | Stop after extraction, output the SiteSchema JSON only    |
| --from-schema     | (none)       | Skip crawl/extract, generate from a saved SiteSchema JSON |
| --verbose         | false        | Detailed logging                                          |
| --dry-run         | false        | Crawl and report page count/structure without generating  |

### Step 6.2: Pipeline orchestration

The CLI orchestrates the four stages sequentially: crawl, extract, generate, verify. Between each stage, validate the intermediate output. If --schema-only is set, stop after extraction and write the JSON. If --from-schema is set, skip to generation. This lets users inspect and manually edit the schema before regenerating, which is a powerful escape hatch for tricky sites.

### Step 6.3: Progress display

Show a clean terminal progress display: current stage, pages crawled/total discovered, pages extracted, pages generated, and a final summary with the output path and instructions to run the generated site (cd <dir> && npm install && npm run dev).

### Step 6.4: Error handling

Graceful degradation at every stage. A single page failing to crawl should not kill the pipeline. A single block failing to classify should fall back to GenericSection. A single page failing to generate should be logged and skipped. The final output summary reports what succeeded and what was skipped with reasons.

### Step 6.5: End-to-end integration test

Run the full CLI against a local test server serving mock HTML pages. Verify the output directory contains a valid Next.js project that builds successfully. This is the acceptance test for the entire system.

---

## Phase 7: Polish + Edge Cases

_Harden the tool for real-world sites._

### Step 7.1: Handle common site patterns

Add specific handling for common patterns the basic pipeline might miss:

- **WordPress sites:** detect wp-content paths, handle shortcodes (strip or convert), handle Yoast SEO meta.
- **Squarespace/Wix:** handle their specific JS rendering patterns (may need Playwright more often).
- **Single-page sites:** detect anchor-link navigation (#section) and split into logical sections rather than separate pages.
- **Cookie banners, popups, chat widgets:** detect and strip these (they are noise, not content).

### Step 7.2: Navigation simplification

Many old sites have bloated navigation with 7+ top-level items and deep nesting. Add an LLM pass that simplifies the nav structure: merge related sections, reduce to 4-6 top-level items, flatten unnecessary nesting. Preserve all pages (they remain accessible), just reorganize the nav.

### Step 7.3: SEO preservation

Carry over the old site's SEO data: page titles, meta descriptions, canonical URLs, Open Graph tags, and structured data (JSON-LD). Generate proper semantic HTML (h1-h6 hierarchy, alt text on images, landmark roles). Add a sitemap.xml and robots.txt to the generated project.

### Step 7.4: Performance defaults

The generated site should be fast by default. Use Next.js Image component for optimized images. Lazy load below-the-fold content. Minimal JS (most pages are server components). Generate proper meta viewport tag for mobile.

### Step 7.5: Design style presets

Implement the --style flag with presets that adjust the component library's visual tone. "Clean" (default): lots of whitespace, subtle borders, neutral palette with brand accent. "Minimal": even more whitespace, no borders, monochrome with single accent. "Warm": rounded corners, soft shadows, warmer neutral tones. "Corporate": tighter spacing, sharper corners, more structured layouts.

---

## 12. Testing Strategy

| Layer          | Test Type   | What to Test                                                                              |
| -------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Schema         | Unit        | Zod validation accepts valid data, rejects invalid data, handles edge cases               |
| Crawler        | Unit        | URL normalization, link extraction from mock HTML, same-domain filtering                  |
| Crawler        | Integration | Crawl a local test server with known page structure                                       |
| Extractor      | Unit        | Chrome stripping, block splitting, metadata extraction on mock HTML                       |
| Extractor      | Integration | Full extraction on saved HTML fixtures (Edgehill pages) with mocked LLM                   |
| Extractor      | Snapshot    | Save known-good extraction outputs, detect regressions                                    |
| UI (Atoms)     | Unit        | Each atom renders without errors with required and optional props                         |
| UI (Organisms) | Unit        | Each organism produces valid JSX for sample block data                                    |
| UI (Preview)   | Visual      | Preview app renders all components; manual review for design quality                      |
| Generator      | Integration | Full generation from a fixture SiteSchema, verify next build succeeds                     |
| CLI            | E2E         | Full pipeline against local test server, verify output builds and contains expected pages |

Keep Claude API calls out of unit tests by mocking. Use saved fixtures for integration tests. Only the E2E test hits the real API (and can be skipped in CI with an environment flag).

---

## 13. Task Checklist

Linear implementation order. Each task depends on the ones above it within its phase. Phases can partially overlap where noted.

### Phase 1: Foundation

- [ ] **1.1:** Initialize Turborepo monorepo with 5 packages (schema, ui, crawler, extractor, generator) + 2 apps (cli, preview) `[Medium]`
- [ ] **1.2:** Define all ContentBlock types in schema/blocks.ts `[Medium]`
- [ ] **1.3:** Define PageSchema, SiteSchema, PageArchetype in schema/ `[Medium]`
- [ ] **1.4:** Create Zod validation schemas mirroring all types `[Medium]`
- [ ] **1.5:** Write schema validation tests `[Small]`

### Phase 2: Crawler

- [ ] **2.1:** Implement url-utils.ts (normalize, dedupe, same-domain, asset detection) `[Small]`
- [ ] **2.2:** Implement static fetcher with content-sufficiency check `[Medium]`
- [ ] **2.3:** Implement Playwright fallback fetcher with browser reuse `[Medium]`
- [ ] **2.4:** Implement link extractor (Cheerio-based, multi-source) `[Medium]`
- [ ] **2.5:** Implement BFS crawler with rate limiting and depth cap `[Large]`
- [ ] **2.6:** Define CrawlResult type and integrate output format `[Small]`
- [ ] **2.7:** Write crawler tests (unit + integration with local server) `[Medium]`

### Phase 3: Extractor

- [ ] **3.1:** Implement chrome stripping (hash-based cross-page detection) `[Large]`
- [ ] **3.2:** Implement metadata extraction (title, description, images, OG tags) `[Medium]`
- [ ] **3.3:** Implement block splitter (heading-based + structural splitting) `[Large]`
- [ ] **3.4:** Build site-level data extraction prompt + LLM call (nav, footer, colors) `[Medium]`
- [ ] **3.5:** Build block classification prompt + LLM call with Zod validation `[Large]`
- [ ] **3.6:** Build page archetype classification (can batch with 3.5) `[Small]`
- [ ] **3.7:** Assemble full SiteSchema output with validation `[Medium]`
- [ ] **3.8:** Write extractor tests (unit + integration with HTML fixtures) `[Medium]`

### Phase 4: Component Library - Atoms (can start after 1.2)

- [ ] **4.1:** Set up packages/ui structure with atomic design folders and exports `[Small]`
- [ ] **4.2a:** Build Button atom (primary/secondary/ghost variants, link mode) `[Small]`
- [ ] **4.2b:** Build Heading atom (levels 1-6, auto Tailwind type scale) `[Small]`
- [ ] **4.2c:** Build Text atom (size variants, muted option) `[Small]`
- [ ] **4.2d:** Build Image atom (Next.js Image wrapper, aspect ratio, placeholder) `[Small]`
- [ ] **4.2e:** Build Icon atom (small built-in SVG icon set) `[Medium]`
- [ ] **4.2f:** Build Link, Badge, Divider, Input atoms `[Small]`
- [ ] **4.2g:** Build Container and Section layout atoms `[Small]`

### Phase 4: Component Library - Molecules

- [ ] **4.3a:** Build FeatureCard molecule (Icon + Heading + Text) `[Small]`
- [ ] **4.3b:** Build TestimonialCard molecule (quote + author) `[Small]`
- [ ] **4.3c:** Build TeamMemberCard molecule (photo + name + role + bio) `[Medium]`
- [ ] **4.3d:** Build StatItem molecule (large number + label) `[Small]`
- [ ] **4.3e:** Build PricingTier molecule (name + price + features + CTA) `[Medium]`
- [ ] **4.3f:** Build NavLink and NavDropdown molecules `[Medium]`
- [ ] **4.3g:** Build ContactDetail, FAQItem, GalleryImage, LogoItem molecules `[Medium]`

### Phase 4: Component Library - Organisms

- [ ] **4.4a:** Build Hero organism (3 variants: image bg, solid bg, split) `[Medium]`
- [ ] **4.4b:** Build TextSection organism `[Small]`
- [ ] **4.4c:** Build FeatureGrid organism `[Medium]`
- [ ] **4.4d:** Build CTABanner organism `[Small]`
- [ ] **4.4e:** Build ContactInfo organism `[Small]`
- [ ] **4.4f:** Build Testimonials organism `[Medium]`
- [ ] **4.4g:** Build TeamGrid organism `[Medium]`
- [ ] **4.4h:** Build FAQ organism (client component with accordion state) `[Medium]`
- [ ] **4.4i:** Build Stats organism `[Small]`
- [ ] **4.4j:** Build ImageGallery organism `[Medium]`
- [ ] **4.4k:** Build PricingTable organism `[Medium]`
- [ ] **4.4l:** Build LogoCloud, Embed, GenericSection organisms `[Medium]`
- [ ] **4.4m:** Build Navbar organism (client component, mobile hamburger) `[Large]`
- [ ] **4.4n:** Build Footer organism `[Medium]`

### Phase 4: Component Library - Templates + Infra

- [ ] **4.5a:** Build HomepageTemplate `[Medium]`
- [ ] **4.5b:** Build AboutTemplate, ServicesTemplate, ContactTemplate, GenericTemplate `[Medium]`
- [ ] **4.6:** Define design tokens and Tailwind preset in packages/ui/src/styles/ `[Medium]`
- [ ] **4.7:** Build preview app (apps/preview) with sample data for all layers `[Medium]`

### Phase 5: Generator (after Phase 3 + 4)

- [ ] **5.1:** Implement project scaffolder (package.json, configs, app/ structure) `[Medium]`
- [ ] **5.2:** Implement Tailwind config generator with brand color scaling `[Medium]`
- [ ] **5.3:** Implement layout generator (root layout with nav + footer) `[Medium]`
- [ ] **5.4:** Implement component writer (copies ui package components into output) `[Medium]`
- [ ] **5.5:** Implement page generator (archetype templates + block rendering) `[Large]`
- [ ] **5.6:** Implement asset handler (URL references + optional download) `[Medium]`
- [ ] **5.7:** Add build verification (run next build, report errors) `[Small]`
- [ ] **5.8:** Write generator tests (fixture schema through full generation) `[Medium]`

### Phase 6: CLI (after Phase 5)

- [ ] **6.1:** Implement CLI argument parsing with Commander.js `[Small]`
- [ ] **6.2:** Implement pipeline orchestration (crawl > extract > generate > verify) `[Medium]`
- [ ] **6.3:** Implement terminal progress display `[Small]`
- [ ] **6.4:** Implement error handling and graceful degradation `[Medium]`
- [ ] **6.5:** Write E2E integration test `[Large]`

### Phase 7: Polish (after Phase 6)

- [ ] **7.1:** Add WordPress/Squarespace/SPA-specific handling `[Large]`
- [ ] **7.2:** Implement navigation simplification (LLM pass) `[Medium]`
- [ ] **7.3:** Implement SEO preservation (meta, sitemap, robots.txt) `[Medium]`
- [ ] **7.4:** Add performance defaults (Next Image, lazy loading, viewport) `[Medium]`
- [ ] **7.5:** Implement design style presets (clean, minimal, warm, corporate) `[Large]`

### Future: Extract Component Library (after 10-20 real sites processed)

- [ ] **E.1:** Audit and decouple: remove any cross-package imports between ui and crawler/extractor/generator `[Medium]`
- [ ] **E.2:** Prepare packages/ui for standalone publish: package.json with exports map, build step, peerDependencies `[Medium]`
- [ ] **E.3:** Publish @modernizer/schema as its own npm package (shared type dependency) `[Medium]`
- [ ] **E.4:** Create modernizer-ui repo, migrate packages/ui source with git history, set up CI + Changesets + npm publish `[Large]`
- [ ] **E.5:** Migrate apps/preview into the new ui repo as the library dev playground `[Medium]`
- [ ] **E.6:** Update generator to consume @modernizer/ui from npm, update component-writer.ts to resolve from node_modules `[Medium]`
- [ ] **E.7:** Set up cross-repo workflows: Renovate/Dependabot for version bumps, E2E regression testing on ui updates `[Medium]`

---

## Implementation Notes for Claude Code

This document is designed to be handed to a Claude Code instance working in the project repository. Here are specific instructions for that handoff:

- Start with Phase 1 in full before moving to any other phase. The schema types are the foundation everything else depends on.
- Phase 4 (Component Library) can start as soon as Step 1.2 is complete. It does not depend on the crawler or extractor. Build atoms first, then molecules, then organisms, then templates.
- The ui package at packages/ui is where all React components live. It follows atomic design: atoms/ molecules/ organisms/ templates/. Components only import from layers below them.
- The preview app at apps/preview is the visual test harness. It should render every component at every atomic layer with sample data. Use this to verify designs before the generator exists.
- For LLM prompts (Steps 3.4, 3.5, 3.6, 7.2): store prompts as template literal functions in dedicated files. This makes them easy to iterate on independently.
- Use the Edgehill Recovery site (https://edgehillrecovery.org/) as the primary test fixture. Save its crawled HTML locally for repeatable integration tests.
- The generator copies components from packages/ui into the output project (not importing from an npm package). The component-writer.ts file handles this. Generated code should be readable and editable by a human after generation.
- The --schema-only and --from-schema flags are critical for development workflow. They let you iterate on extraction and generation independently.
- Use Anthropic SDK with model "claude-sonnet-4-20250514" for all LLM calls. Sonnet balances speed, cost, and quality for this use case.
- Every LLM call should have a Zod validation step on the response. Never trust raw LLM JSON output.
- Plan for eventual extraction of packages/ui into its own repo. Keep it loosely coupled: no imports from crawler, extractor, or generator packages. The only shared dependency should be packages/schema for the block type definitions.
