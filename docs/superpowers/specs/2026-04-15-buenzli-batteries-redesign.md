# Buenzli Batteries — Full Site Redesign

**Date:** 2026-04-15
**Status:** Design approved, pending implementation
**Client:** Buenzli Batteries GmbH (Zurich, Switzerland)
**Current site:** https://buenzlibatteries.ch (WordPress + Divi + WooCommerce)
**Goal:** Full site redesign with high-end visual design, GSAP scroll animations, DE + EN

---

## 1. Business Context

Buenzli Batteries GmbH is a Swiss e-bike battery repair service based in Zurich.
They specialize in cell replacement, BMS service, and capacity testing for Stromer,
Bosch, and Flyer batteries. Price range CHF 180-1,200. Open Mon-Sun 09:00-17:00.
Phone: 078 244 92 10.

The current site is a heavy WordPress + Divi + WooCommerce setup with outdated
design, excessive inline CSS, slow load times, and a generic template feel. The
redesign replaces this with a premium, fast, animation-rich site that matches the
quality of the service.

E-commerce (shop) is TBD — the design is lead-generation first (contact form +
phone), with the option to add a shop later.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Animations | GSAP (ScrollTrigger, ScrollSmoother) |
| Icons | Lucide React |
| i18n | next-intl (DE + EN) |
| Fonts | Bebas Neue (display), Inter (body), Roboto Mono (specs/numbers) |
| Deployment | Vercel |
| Images | Unsplash stock placeholders (marked for replacement with real photos) |

**No CMS.** Content lives in code and i18n JSON files. The site is mostly static
with no dynamic data requirements.

---

## 3. Color Palette

Derived from the existing site's `#2ea3f2` blue accent, refined into a full system.

| Role | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Primary Blue | `#2ea3f2` | `--color-primary` | CTAs, links, accents, glow effects |
| Deep Blue | `#0a1628` | `--color-deep` | Hero backgrounds, dark sections |
| Near Black | `#111827` | `--color-dark` | Alternate dark sections, text on light |
| Light Gray | `#f8fafc` | `--color-light` | Light section backgrounds |
| White | `#ffffff` | `--color-white` | Cards, text on dark |
| Electric Cyan | `#06b6d4` | `--color-cyan` | Hover states, secondary accent |
| Success Green | `#22c55e` | `--color-success` | Trust badges, "free diagnosis" callouts |

Dark sections (`deep`, `dark`) alternate with light sections (`light`, `white`)
to create visual rhythm.

---

## 4. Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | Bebas Neue | 400 | Section headings, hero headline, large numbers |
| Body | Inter | 400, 500, 600 | Paragraphs, nav, buttons, form labels |
| Mono | Roboto Mono | 400, 500 | Price tags, specs, technical data |

Scale (desktop): Hero h1 = 5rem, Section h2 = 3rem, h3 = 1.5rem, body = 1rem.
Mobile: Hero h1 = 2.5rem, Section h2 = 2rem, h3 = 1.25rem, body = 1rem.

---

## 5. Pages

### Phase 1 — Homepage (this spec)
The homepage is the primary deliverable and the template for all other pages.

### Phase 2 — Subpages (separate spec)
- `/akkuservice` — Detailed service descriptions, pricing table
- `/stromer` — Stromer-specific repairs, reset to 100% health
- `/bosch` — Bosch PowerTube/PowerPack services
- `/flyer` — Flyer/Panasonic cell services
- `/faq` — Full FAQ page
- `/ueber-uns` — About, team, workshop
- `/kontakt` — Contact form + map + opening hours

### Phase 3 — i18n (EN translations)
All pages duplicated in English via `[lang]` dynamic routing.

### Phase 4 — Shop (if confirmed)
Online shop for battery products/services. Stack TBD (Snipcart, Shopify Storefront, or custom).

**This spec covers Phase 1 only.**

---

## 6. Homepage Sections (top to bottom)

### 6.1 Navigation

**Behavior:** Sticky. Transparent with white text over the dark hero. On scroll
past the hero, transitions to frosted glass (`backdrop-blur-xl`) with dark text.

**Layout:**
- Left: Logo (Buenzli Batteries logo from current site)
- Center: Menu links — Akkuservice | Marken | FAQ | Uber uns | Kontakt
- Right: Language toggle (DE/EN) + CTA button "Anrufen: 078 244 92 10"

**Mobile (< 768px):** Hamburger icon. Full-screen overlay menu with staggered
link entrance animation. Phone CTA always visible.

### 6.2 Hero (full viewport, dark background)

**Background:** Deep blue `#0a1628` with an animated subtle energy grid or
floating particle effect (GSAP-driven, lightweight canvas or pure CSS). Not
heavy 3D — just enough movement to feel alive.

**Content (centered):**
- Bebas Neue headline (5rem desktop, 2.5rem mobile):
  **"Ihr eBike-Akku. Wie neu."**
  EN: "Your eBike Battery. Like New."
- Inter subline (1.25rem):
  "Professionelle Zellentausch & Reparatur in Zurich. Diagnose kostenlos."
  EN: "Professional cell replacement & repair in Zurich. Free diagnosis."
- Two CTAs side by side:
  - Primary (filled blue): "Kostenlose Diagnose anfragen" → scrolls to contact
  - Secondary (ghost/outline): "078 244 92 10" → tel: link
- Scroll-down chevron with subtle bounce animation

**Stats bar** anchored to bottom of hero viewport:
- "2'500+ Akkus repariert" | "ab CHF 180" | "100% Gesundheit"
- Numbers animate with count-up on page load

**Animations:**
- Headline: fade up + letter stagger (0.3s delay after load)
- Subline: fade up (0.5s delay)
- CTAs: fade up (0.7s delay)
- Stats: count-up (1s delay)
- Background particles: continuous subtle float

### 6.3 Problem to Solution (light section)

**Layout:** Two-column on desktop (left problem, right solution), stacked on mobile.

**Left column — The Problem:**
- Icon + "Akku schwach?" heading
- 3 pain points with small icons:
  - Battery losing capacity, range dropping
  - New battery costs CHF 800-1,500+
  - Old batteries = electronic waste

**Right column — The Solution:**
- Icon + "Wir reparieren." heading
- 3 solutions mirroring the pain points:
  - Cell replacement restores full capacity
  - Repair costs CHF 180-1,200 (up to 50% savings)
  - Sustainable: extend life, reduce waste

**Visual centerpiece:** Animated battery health gauge that fills from ~50% (red/orange)
to 100% (green) as the section scrolls into view.

**Animations:** Left column slides in from left, right from right (ScrollTrigger).
Battery gauge animates on scroll.

### 6.4 Services (dark section)

**Layout:** 3 cards in a row (desktop), stacked (mobile).

**Card 1 — Diagnose (free):**
- Icon: Search/scan (Lucide `ScanSearch`)
- Title: "Kostenlose Diagnose"
- Description: "Restkapazitat, Zellbalance, Entladung, Innenwiderstand, Sicherheit — komplett kostenlos."
- Price badge: "Kostenlos"
- CTA: "Diagnose anfragen →"

**Card 2 — Zellentausch:**
- Icon: Battery (Lucide `BatteryCharging`)
- Title: "Zellentausch"
- Description: "Einzelne Zellen ersetzen mit Originalqualitat. Volle Kapazitat, wie ein neuer Akku."
- Price badge: "ab CHF 180"
- CTA: "Mehr erfahren →"

**Card 3 — BMS Service:**
- Icon: Cpu (Lucide `Cpu`)
- Title: "BMS Service"
- Description: "Reset, Rekalibrierung, 100% Gesundheitsstatus. Ihr Akku zeigt wieder volle Leistung."
- Price badge: "ab CHF 120"
- CTA: "Mehr erfahren →"

**Card styling:** Dark card (`#111827`) on deep blue background. Subtle border.
On hover: lift (translateY -4px), blue glow border (`box-shadow: 0 0 20px rgba(46,163,242,0.3)`).

**Animations:** Cards stagger fade-up on ScrollTrigger (0.15s offset each).

### 6.5 Brand Specialists (light section)

**Layout:** 3-column grid (desktop), stacked (mobile).

**Each brand card:**
- Large brand logo (Stromer, Bosch, Flyer) — stock/placeholder
- Brand name as heading
- 2-line key service description
- CTA button linking to brand-specific page

**Stromer:** "Zellentausch, Reset auf 100% Gesundheit. Alle Stromer-Modelle."
**Bosch:** "PowerTube, PowerPack — alle Bosch-Systeme. Professionelle Reparatur."
**Flyer:** "Panasonic-Zellen, komplette Aufarbeitung. Flyer-Spezialist."

**Animations:** Stagger scale-in on ScrollTrigger.

### 6.6 Process / How It Works (dark section, SIGNATURE ANIMATION)

This is the premium animation section — pinned while the user scrolls through 4 steps.

**Layout:** Horizontal timeline with 4 steps connected by a line.

**Steps:**
1. **Kontakt aufnehmen** — "Rufen Sie uns an oder fullen Sie das Formular aus."
   Icon: Phone
2. **Kostenlose Diagnose** — "Wir prufen Ihren Akku professionell und kostenlos."
   Icon: ScanSearch
3. **Reparatur** — "Zellentausch in 3-5 Werktagen. Originalqualitat."
   Icon: Wrench
4. **Abholung** — "Ihr Akku — wie neu. Mit Gesundheitszertifikat."
   Icon: CheckCircle

**Animation (GSAP ScrollTrigger, scrub):**
- Section is pinned (sticky) for the duration of 4 scroll-lengths
- A connecting line between the 4 step circles fills progressively in blue
- Each step circle lights up (fills blue) as the line reaches it
- Step text and icon fade in when the step activates
- On mobile: vertical timeline, same progressive fill behavior

### 6.7 Trust / Social Proof (light section)

**Layout:**
- Top: Google Reviews badge (stars + rating + count) — placeholder for now
- Middle: 3 testimonial cards in a row with quote, name, bike model
- Bottom: Trust badges row — "Swiss Quality" | "Nachhaltig" | "Garantie" | "2'500+ Reparaturen"

**Testimonials (placeholder content, to be replaced):**
1. "Mein Stromer-Akku hatte nur noch 55% Kapazitat. Nach dem Zellentausch wieder 100%. Absolut empfehlenswert." — M. Keller, Stromer ST5
2. "Schnell, fair, transparent. Die Diagnose war kostenlos und die Reparatur hat sich absolut gelohnt." — S. Brunner, Bosch PowerTube
3. "Halber Preis eines neuen Akkus, volle Leistung. Top Service!" — R. Meier, Flyer Gotour

**Animations:** Fade-in on scroll. Trust badges stagger in.

### 6.8 FAQ Accordion (dark section)

**6-8 questions with smooth expand/collapse (GSAP height animation):**

1. "Wie lange dauert die Reparatur?" — "In der Regel 3-5 Werktage nach Diagnose."
2. "Welche Marken repariert ihr?" — "Stromer, Bosch, Flyer und viele weitere. Kontaktieren Sie uns fur Ihre Marke."
3. "Ist Reparatur gunstiger als ein neuer Akku?" — "Ja, in der Regel 40-60% gunstiger als ein Neuakku."
4. "Gibt es Garantie?" — "Ja, auf alle Zellentausch-Arbeiten geben wir Garantie."
5. "Ist die Diagnose wirklich kostenlos?" — "Ja, komplett kostenlos und unverbindlich."
6. "Kann ich meinen Akku per Post schicken?" — "Ja, wir bieten schweizweiten Service per Versand an."

**Styling:** Dark background, white text. Blue accent on active/expanded item.
Plus/minus toggle icon that rotates on open/close.

### 6.9 CTA / Contact (gradient section)

**Background:** Gradient from `#0a1628` to `#2ea3f2` (deep blue to primary blue).

**Content:**
- Headline (Bebas Neue, white): "Akku schwach? Wir helfen."
- Subline: "Kostenlose Diagnose. Reparatur in 3-5 Tagen. Schweizweit."

**Two columns (desktop):**
- Left: Contact form
  - Fields: Name, Email, Telefon, Marke (dropdown: Stromer/Bosch/Flyer/Andere), Nachricht (textarea)
  - Submit button: "Anfrage senden"
  - Note: form submits to email or a simple endpoint (no backend DB needed)
- Right: Direct contact info
  - Large phone number: 078 244 92 10 (clickable tel: link)
  - Opening hours: Mo-So, 09:00-17:00
  - Address/location indicator: Zurich, Switzerland
  - Optional: small map or Zurich pin illustration

**Mobile:** Stacked, form first, then contact info.

### 6.10 Footer (dark)

**Layout:** 4 columns (desktop), stacked (mobile).

- **Col 1:** Logo + 1-line company description + social icons
- **Col 2:** Navigation links (Akkuservice, Marken, FAQ, Uber uns, Kontakt)
- **Col 3:** Legal links (Impressum, Datenschutz, AGB, Cookie Policy)
- **Col 4:** Contact info (phone, hours, location)

**Bottom bar:** "© 2026 Bunzli Batteries GmbH. Alle Rechte vorbehalten."

---

## 7. Animations Spec (GSAP)

| Element | Animation Type | Trigger | Duration |
|---------|---------------|---------|----------|
| Hero background | Continuous particle float | Page load | Infinite |
| Hero headline | Fade up + letter stagger | Page load | 0.8s, delay 0.3s |
| Hero subline | Fade up | Page load | 0.6s, delay 0.5s |
| Hero CTAs | Fade up | Page load | 0.6s, delay 0.7s |
| Stats count-up | Number increment | Page load | 1.5s, delay 1s |
| Problem/Solution columns | Slide in from sides | ScrollTrigger (top 80%) | 0.8s |
| Battery gauge | Fill animation | ScrollTrigger (scrub) | Scroll-linked |
| Service cards | Stagger fade up | ScrollTrigger (top 80%) | 0.6s, stagger 0.15s |
| Brand cards | Stagger scale in | ScrollTrigger (top 80%) | 0.6s, stagger 0.15s |
| Process timeline | Progressive line fill + step activation | ScrollTrigger (pinned, scrub) | Scroll-linked |
| Testimonials | Fade in | ScrollTrigger (top 80%) | 0.6s |
| Trust badges | Stagger fade in | ScrollTrigger (top 80%) | 0.4s, stagger 0.1s |
| FAQ accordion | Height expand/collapse | Click | 0.4s |
| Navbar transition | Background blur + color change | Scroll past hero | 0.3s |

**Performance rules:**
- Use `will-change: transform` only on actively animating elements
- Prefer transforms over layout properties (no animating width/height/top/left)
- Hero particles: pure CSS or lightweight canvas, not Three.js
- Lazy load all images below the fold
- Total GSAP bundle (core + ScrollTrigger): ~30KB gzipped

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|-----------|-------|---------------|
| Desktop | >= 1280px | Full layout, 3-col grids, horizontal timeline |
| Tablet | 768-1279px | 2-col grids, timeline adapts |
| Mobile | < 768px | Single column, vertical timeline, hamburger nav, stacked CTAs |

---

## 9. i18n Strategy

Using `next-intl` with file-based translations:

```
lib/i18n/
├── de.json    # German (default)
└── en.json    # English
```

URL structure: `buenzlibatteries.ch/` (DE default), `buenzlibatteries.ch/en/` (EN).
Language toggle in the navbar switches between versions.

All user-visible text lives in translation files, not hardcoded in components.

---

## 10. Project Structure

```
buenzli-batteries/
├── app/
│   ├── layout.tsx                 # Root layout, fonts, metadata, GSAP setup
│   ├── [lang]/
│   │   ├── layout.tsx             # Lang-specific layout, next-intl provider
│   │   ├── page.tsx               # Homepage (assembles all sections)
│   │   ├── akkuservice/page.tsx   # Phase 2
│   │   ├── stromer/page.tsx       # Phase 2
│   │   ├── bosch/page.tsx         # Phase 2
│   │   ├── flyer/page.tsx         # Phase 2
│   │   ├── faq/page.tsx           # Phase 2
│   │   ├── ueber-uns/page.tsx     # Phase 2
│   │   └── kontakt/page.tsx       # Phase 2
│   └── globals.css                # Tailwind base, CSS variables, font imports
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── MobileMenu.tsx
│   │   └── Footer.tsx
│   ├── sections/
│   │   ├── Hero.tsx
│   │   ├── ProblemSolution.tsx
│   │   ├── Services.tsx
│   │   ├── BrandSpecialists.tsx
│   │   ├── Process.tsx
│   │   ├── Trust.tsx
│   │   ├── FAQ.tsx
│   │   └── ContactCTA.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Accordion.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   └── LanguageToggle.tsx
│   └── animations/
│       ├── ScrollReveal.tsx        # Generic scroll-triggered reveal wrapper
│       ├── CountUp.tsx             # Animated number counter
│       ├── ProcessTimeline.tsx     # Pinned scroll timeline (signature)
│       └── ParticleGrid.tsx        # Hero background effect
├── lib/
│   ├── i18n/
│   │   ├── de.json
│   │   ├── en.json
│   │   └── config.ts
│   └── gsap.ts                    # GSAP plugin registration (ScrollTrigger)
├── public/
│   ├── images/
│   │   ├── logo-buenzli-2025.jpg  # From current site
│   │   ├── hero-placeholder.jpg   # Unsplash e-bike battery
│   │   ├── stromer-logo.png       # Placeholder
│   │   ├── bosch-logo.png         # Placeholder
│   │   └── flyer-logo.png         # Placeholder
│   └── fonts/                     # Self-hosted if needed
├── tailwind.config.ts             # Custom colors, fonts, animations
├── next.config.ts                 # i18n config, image domains
├── package.json
└── README.md
```

---

## 11. Dependencies

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "gsap": "^3.12",
    "next-intl": "^3.20",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "tailwindcss": "^3.4",
    "autoprefixer": "^10.4",
    "postcss": "^8.4",
    "@types/react": "^18.3",
    "@types/node": "^20"
  }
}
```

---

## 12. Form Handling

The contact form (section 6.9) needs a simple backend. Options:

**Recommended: Vercel Serverless Function + email.**
- API route at `/api/contact` receives form POST
- Validates with Zod (name, email, phone, brand, message)
- Sends email via Resend (free tier: 100 emails/day, plenty for this)
- Returns success/error JSON
- Client shows success toast or error message

No database needed. No user accounts. Just form-to-email.

---

## 13. SEO & Metadata

- LocalBusiness schema markup (JSON-LD) — migrate from current site
- Service schema for each service type
- OpenGraph and Twitter meta tags with preview image
- Canonical URLs for DE/EN variants with hreflang tags
- Sitemap.xml generated by Next.js
- robots.txt allowing all crawlers

---

## 14. Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 90 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Total page weight | < 500KB (excl. images) |
| GSAP bundle | ~30KB gzipped |

---

## 15. Image Strategy

All images are Unsplash stock placeholders. Each placeholder image file is named
descriptively and accompanied by a comment in the component indicating what real
photo should replace it:

```tsx
{/* PLACEHOLDER: Replace with real workshop photo of battery cell replacement */}
<Image src="/images/hero-placeholder.jpg" ... />
```

Unsplash images to source:
- Hero: e-bike battery close-up or workshop scene
- Services: battery diagnostics equipment, cells, circuit boards
- Brands: e-bike lifestyle shots (Stromer, Bosch, Flyer style bikes)
- Trust: workshop environment, professional at work
- About: team/workshop (Phase 2)

---

## 16. Out of Scope (this phase)

- E-commerce / shop functionality
- Blog / content pages
- User accounts / authentication
- CMS integration
- Brand-specific subpages (Phase 2)
- English translations (Phase 3)
- Real photography (client provides later)
- Analytics setup (Phase 2+)
