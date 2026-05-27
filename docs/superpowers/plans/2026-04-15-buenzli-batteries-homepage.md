# Buenzli Batteries Homepage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-end animated homepage for Buenzli Batteries GmbH (Swiss e-bike battery repair) using Next.js 14, Tailwind CSS, and GSAP scroll animations.

**Architecture:** Next.js App Router with `[lang]` dynamic routing for DE/EN i18n via next-intl. 10 homepage sections as individual client components (GSAP requires DOM access). Reusable animation wrappers (ScrollReveal, CountUp) to DRY scroll-triggered effects. All text in i18n JSON files, images are Unsplash placeholders.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS 3.4, GSAP 3.12 (ScrollTrigger), next-intl, Lucide React, Resend (contact form email), Vercel deployment.

**Spec:** `docs/superpowers/specs/2026-04-15-buenzli-batteries-redesign.md`

**Project directory:** `~/Desktop/Projects/buenzli-batteries`

---

## File Structure

```
buenzli-batteries/
├── app/
│   ├── layout.tsx                    # Root HTML shell, fonts, metadata
│   ├── globals.css                   # Tailwind directives, CSS vars, custom utilities
│   ├── [lang]/
│   │   ├── layout.tsx                # next-intl provider wrapper
│   │   └── page.tsx                  # Homepage — assembles all sections
│   └── api/
│       └── contact/route.ts          # Contact form handler (Resend email)
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx                # Sticky nav with glassmorphism scroll effect
│   │   ├── MobileMenu.tsx            # Full-screen overlay mobile menu
│   │   └── Footer.tsx                # 4-col footer
│   ├── sections/
│   │   ├── Hero.tsx                  # Full-viewport hero with particle bg
│   │   ├── ProblemSolution.tsx       # 2-col problem→solution + battery gauge
│   │   ├── Services.tsx              # 3 service cards with hover glow
│   │   ├── BrandSpecialists.tsx      # Stromer/Bosch/Flyer brand cards
│   │   ├── Process.tsx               # 4-step pinned scroll timeline (signature)
│   │   ├── Trust.tsx                 # Testimonials + trust badges
│   │   ├── FAQ.tsx                   # Accordion with GSAP height animation
│   │   └── ContactCTA.tsx            # Gradient section with form + contact info
│   ├── ui/
│   │   ├── Button.tsx                # Primary/ghost/outline variants
│   │   ├── Card.tsx                  # Dark card with hover glow
│   │   ├── Accordion.tsx             # Single accordion item with GSAP expand
│   │   ├── Badge.tsx                 # Price/trust badge
│   │   ├── Input.tsx                 # Form input/textarea/select
│   │   └── LanguageToggle.tsx        # DE/EN switcher
│   └── animations/
│       ├── ScrollReveal.tsx          # Generic scroll-triggered reveal wrapper
│       ├── CountUp.tsx               # Animated number counter
│       ├── ProcessTimeline.tsx       # Pinned horizontal/vertical timeline
│       └── ParticleGrid.tsx          # Lightweight hero background effect
├── lib/
│   ├── gsap.ts                       # GSAP + ScrollTrigger registration
│   └── i18n/
│       ├── config.ts                 # next-intl routing config
│       ├── de.json                   # German translations
│       └── en.json                   # English translations
├── public/
│   └── images/                       # Unsplash placeholders + logo
├── middleware.ts                      # next-intl locale detection middleware
├── tailwind.config.ts                # Custom palette, fonts, animations
├── next.config.ts                    # next-intl plugin config
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `~/Desktop/Projects/buenzli-batteries/` (entire project scaffold)

- [ ] **Step 1: Create Next.js project**

```bash
cd ~/Desktop/Projects
npx create-next-app@14 buenzli-batteries --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Expected: Project created at `~/Desktop/Projects/buenzli-batteries` with Next.js 14, TypeScript, Tailwind.

- [ ] **Step 2: Install dependencies**

```bash
cd ~/Desktop/Projects/buenzli-batteries
npm install gsap next-intl lucide-react
```

Expected: 3 packages added to `dependencies` in `package.json`.

- [ ] **Step 3: Configure Tailwind with custom palette**

Replace `tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2ea3f2",
        deep: "#0a1628",
        dark: "#111827",
        light: "#f8fafc",
        cyan: "#06b6d4",
        success: "#22c55e",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["Roboto Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Set up globals.css**

Replace `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #2ea3f2;
  --color-deep: #0a1628;
  --color-dark: #111827;
  --color-light: #f8fafc;
  --color-cyan: #06b6d4;
  --color-success: #22c55e;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: "Inter", sans-serif;
  color: #111827;
  background: #ffffff;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 5: Set up root layout with fonts**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Bebas_Neue, Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Bünzli Batteries — eBike Akku Reparatur Zürich",
  description:
    "Professionelle eBike Akku Reparatur und Zellentausch in Zürich. Stromer, Bosch, Flyer. Kostenlose Diagnose.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="de"
      className={`${bebasNeue.variable} ${inter.variable} ${robotoMono.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create placeholder homepage**

Replace `app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-deep text-white flex items-center justify-center">
      <h1 className="font-display text-6xl tracking-wide">
        Bünzli Batteries
      </h1>
    </main>
  );
}
```

- [ ] **Step 7: Verify dev server runs**

```bash
cd ~/Desktop/Projects/buenzli-batteries
npm run dev
```

Expected: Dev server at http://localhost:3000 showing "Bünzli Batteries" in Bebas Neue on a dark blue background.

- [ ] **Step 8: Initialize git and commit**

```bash
cd ~/Desktop/Projects/buenzli-batteries
git init
git add .
git commit -m "feat: scaffold Next.js 14 project with Tailwind, GSAP, fonts, custom palette"
```

---

## Task 2: GSAP Setup + Animation Wrappers

**Files:**
- Create: `lib/gsap.ts`
- Create: `components/animations/ScrollReveal.tsx`
- Create: `components/animations/CountUp.tsx`

- [ ] **Step 1: Create GSAP registration module**

Create `lib/gsap.ts`:

```ts
"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
```

- [ ] **Step 2: Create ScrollReveal wrapper**

Create `components/animations/ScrollReveal.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  duration?: number;
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance = 60,
  duration = 0.8,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const directionMap = {
      up: { y: distance },
      down: { y: -distance },
      left: { x: distance },
      right: { x: -distance },
    };

    const from = { opacity: 0, ...directionMap[direction] };

    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        ...from,
        duration,
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    });

    return () => ctx.revert();
  }, [delay, direction, distance, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create CountUp component**

Create `components/animations/CountUp.tsx`:

```tsx
"use client";

import { useRef, useEffect, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface CountUpProps {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  separator?: string;
}

export default function CountUp({
  end,
  prefix = "",
  suffix = "",
  duration = 1.5,
  className = "",
  separator = "'",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!ref.current) return;

    const obj = { value: 0 };

    const ctx = gsap.context(() => {
      gsap.to(obj, {
        value: end,
        duration,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 90%",
          toggleActions: "play none none none",
        },
        onUpdate: () => {
          const rounded = Math.round(obj.value);
          const formatted = rounded
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
          setDisplay(formatted);
        },
      });
    });

    return () => ctx.revert();
  }, [end, duration, separator]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
```

- [ ] **Step 4: Verify with a quick test page**

Temporarily update `app/page.tsx` to test the animations:

```tsx
"use client";

import ScrollReveal from "@/components/animations/ScrollReveal";
import CountUp from "@/components/animations/CountUp";

export default function Home() {
  return (
    <main>
      <section className="min-h-screen bg-deep flex items-center justify-center">
        <h1 className="font-display text-6xl text-white">Scroll Down</h1>
      </section>
      <section className="min-h-screen bg-light flex flex-col items-center justify-center gap-8">
        <ScrollReveal>
          <h2 className="font-display text-4xl">This fades up</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.2} direction="left">
          <p className="text-xl">This slides from the left</p>
        </ScrollReveal>
        <CountUp end={2500} suffix="+" className="font-display text-5xl text-primary" />
      </section>
    </main>
  );
}
```

Run `npm run dev`, scroll down. Expected: heading fades up, paragraph slides from left, number counts up to 2,500+.

- [ ] **Step 5: Commit**

```bash
git add lib/gsap.ts components/animations/ScrollReveal.tsx components/animations/CountUp.tsx app/page.tsx
git commit -m "feat: GSAP setup + ScrollReveal and CountUp animation wrappers"
```

---

## Task 3: UI Primitives (Button, Card, Badge, Input, Accordion)

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Card.tsx`
- Create: `components/ui/Badge.tsx`
- Create: `components/ui/Input.tsx`
- Create: `components/ui/Accordion.tsx`

- [ ] **Step 1: Create Button component**

Create `components/ui/Button.tsx`:

```tsx
import { forwardRef } from "react";

type ButtonVariant = "primary" | "ghost" | "outline";
type ButtonSize = "default" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25",
  ghost:
    "bg-transparent text-white border border-white/30 hover:border-white/60 hover:bg-white/5",
  outline:
    "bg-transparent text-primary border border-primary hover:bg-primary/10",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "default", className = "", href, children, ...props }, ref) => {
    const classes = `inline-flex items-center justify-center font-body font-medium rounded-lg transition-all duration-300 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    if (href) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
```

- [ ] **Step 2: Create Card component**

Create `components/ui/Card.tsx`:

```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = "", hover = true }: CardProps) {
  return (
    <div
      className={`bg-dark rounded-2xl border border-white/10 p-8 transition-all duration-300 ${
        hover
          ? "hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(46,163,242,0.15)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create Badge component**

Create `components/ui/Badge.tsx`:

```tsx
type BadgeVariant = "primary" | "success" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary/15 text-primary border-primary/20",
  success: "bg-success/15 text-success border-success/20",
  neutral: "bg-white/10 text-white/70 border-white/10",
};

export default function Badge({ children, variant = "primary", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Create Input component**

Create `components/ui/Input.tsx`:

```tsx
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

const baseStyles =
  "w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200 font-body";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", ...props }, ref) => (
    <label className="block">
      <span className="text-sm text-white/70 mb-1.5 block font-body">{label}</span>
      <input ref={ref} className={`${baseStyles} ${className}`} {...props} />
    </label>
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className = "", ...props }, ref) => (
    <label className="block">
      <span className="text-sm text-white/70 mb-1.5 block font-body">{label}</span>
      <textarea ref={ref} className={`${baseStyles} resize-none ${className}`} rows={4} {...props} />
    </label>
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = "", ...props }, ref) => (
    <label className="block">
      <span className="text-sm text-white/70 mb-1.5 block font-body">{label}</span>
      <select ref={ref} className={`${baseStyles} ${className}`} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-dark">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
);
Select.displayName = "Select";
```

- [ ] **Step 5: Create Accordion component**

Create `components/ui/Accordion.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { Plus, Minus } from "lucide-react";

interface AccordionProps {
  question: string;
  answer: string;
}

export default function Accordion({ question, answer }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!contentRef.current || !innerRef.current) return;

    if (isOpen) {
      gsap.to(contentRef.current, {
        height: 0,
        duration: 0.4,
        ease: "power2.inOut",
      });
    } else {
      gsap.to(contentRef.current, {
        height: innerRef.current.offsetHeight,
        duration: 0.4,
        ease: "power2.inOut",
      });
    }

    setIsOpen(!isOpen);
  };

  return (
    <div className="border-b border-white/10">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-lg font-body font-medium text-white group-hover:text-primary transition-colors">
          {question}
        </span>
        <span className="text-primary ml-4 flex-shrink-0 transition-transform duration-300">
          {isOpen ? <Minus size={20} /> : <Plus size={20} />}
        </span>
      </button>
      <div ref={contentRef} className="h-0 overflow-hidden">
        <div ref={innerRef} className="pb-5">
          <p className="text-white/60 font-body leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/
git commit -m "feat: UI primitives — Button, Card, Badge, Input, Accordion"
```

---

## Task 4: i18n Setup (next-intl DE + EN)

**Files:**
- Create: `lib/i18n/config.ts`
- Create: `lib/i18n/de.json`
- Create: `lib/i18n/en.json`
- Create: `middleware.ts`
- Create: `i18n/request.ts`
- Modify: `next.config.ts`
- Create: `app/[lang]/layout.tsx`
- Create: `app/[lang]/page.tsx`
- Create: `components/ui/LanguageToggle.tsx`

- [ ] **Step 1: Create i18n config**

Create `lib/i18n/config.ts`:

```ts
export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";
```

- [ ] **Step 2: Create German translations**

Create `lib/i18n/de.json`:

```json
{
  "nav": {
    "services": "Akkuservice",
    "brands": "Marken",
    "faq": "FAQ",
    "about": "Über uns",
    "contact": "Kontakt",
    "call": "Anrufen: 078 244 92 10"
  },
  "hero": {
    "title": "Ihr eBike-Akku. Wie neu.",
    "subtitle": "Professionelle Zellentausch & Reparatur in Zürich. Diagnose kostenlos.",
    "cta_primary": "Kostenlose Diagnose anfragen",
    "cta_phone": "078 244 92 10",
    "stat_repairs": "Akkus repariert",
    "stat_price": "ab CHF",
    "stat_health": "Gesundheit"
  },
  "problem": {
    "title_problem": "Akku schwach?",
    "title_solution": "Wir reparieren.",
    "pain_1": "Kapazität sinkt, Reichweite schrumpft",
    "pain_2": "Neuer Akku kostet CHF 800–1'500+",
    "pain_3": "Alte Akkus = Elektroschrott",
    "solution_1": "Zellentausch stellt volle Kapazität wieder her",
    "solution_2": "Reparatur ab CHF 180 — bis zu 50% günstiger",
    "solution_3": "Nachhaltig: Lebensdauer verlängern, Abfall reduzieren"
  },
  "services": {
    "title": "Unsere Services",
    "diagnosis_title": "Kostenlose Diagnose",
    "diagnosis_desc": "Restkapazität, Zellbalance, Entladung, Innenwiderstand, Sicherheit — komplett kostenlos.",
    "diagnosis_price": "Kostenlos",
    "diagnosis_cta": "Diagnose anfragen",
    "cell_title": "Zellentausch",
    "cell_desc": "Einzelne Zellen ersetzen mit Originalqualität. Volle Kapazität, wie ein neuer Akku.",
    "cell_price": "ab CHF 180",
    "cell_cta": "Mehr erfahren",
    "bms_title": "BMS Service",
    "bms_desc": "Reset, Rekalibrierung, 100% Gesundheitsstatus. Ihr Akku zeigt wieder volle Leistung.",
    "bms_price": "ab CHF 120",
    "bms_cta": "Mehr erfahren"
  },
  "brands": {
    "title": "Marken-Spezialisten",
    "stromer_desc": "Zellentausch, Reset auf 100% Gesundheit. Alle Stromer-Modelle.",
    "bosch_desc": "PowerTube, PowerPack — alle Bosch-Systeme. Professionelle Reparatur.",
    "flyer_desc": "Panasonic-Zellen, komplette Aufarbeitung. Flyer-Spezialist.",
    "cta": "Mehr erfahren"
  },
  "process": {
    "title": "So funktioniert's",
    "step1_title": "Kontakt aufnehmen",
    "step1_desc": "Rufen Sie uns an oder füllen Sie das Formular aus.",
    "step2_title": "Kostenlose Diagnose",
    "step2_desc": "Wir prüfen Ihren Akku professionell und kostenlos.",
    "step3_title": "Reparatur",
    "step3_desc": "Zellentausch in 3–5 Werktagen. Originalqualität.",
    "step4_title": "Abholung",
    "step4_desc": "Ihr Akku — wie neu. Mit Gesundheitszertifikat."
  },
  "trust": {
    "title": "Das sagen unsere Kunden",
    "review_1": "Mein Stromer-Akku hatte nur noch 55% Kapazität. Nach dem Zellentausch wieder 100%. Absolut empfehlenswert.",
    "review_1_author": "M. Keller",
    "review_1_bike": "Stromer ST5",
    "review_2": "Schnell, fair, transparent. Die Diagnose war kostenlos und die Reparatur hat sich absolut gelohnt.",
    "review_2_author": "S. Brunner",
    "review_2_bike": "Bosch PowerTube",
    "review_3": "Halber Preis eines neuen Akkus, volle Leistung. Top Service!",
    "review_3_author": "R. Meier",
    "review_3_bike": "Flyer Gotour",
    "badge_swiss": "Swiss Quality",
    "badge_sustainable": "Nachhaltig",
    "badge_guarantee": "Garantie",
    "badge_repairs": "2'500+ Reparaturen"
  },
  "faq": {
    "title": "Häufige Fragen",
    "q1": "Wie lange dauert die Reparatur?",
    "a1": "In der Regel 3–5 Werktage nach Diagnose.",
    "q2": "Welche Marken repariert ihr?",
    "a2": "Stromer, Bosch, Flyer und viele weitere. Kontaktieren Sie uns für Ihre Marke.",
    "q3": "Ist Reparatur günstiger als ein neuer Akku?",
    "a3": "Ja, in der Regel 40–60% günstiger als ein Neuakku.",
    "q4": "Gibt es Garantie?",
    "a4": "Ja, auf alle Zellentausch-Arbeiten geben wir Garantie.",
    "q5": "Ist die Diagnose wirklich kostenlos?",
    "a5": "Ja, komplett kostenlos und unverbindlich.",
    "q6": "Kann ich meinen Akku per Post schicken?",
    "a6": "Ja, wir bieten schweizweiten Service per Versand an."
  },
  "contact": {
    "title": "Akku schwach? Wir helfen.",
    "subtitle": "Kostenlose Diagnose. Reparatur in 3–5 Tagen. Schweizweit.",
    "name": "Name",
    "email": "E-Mail",
    "phone": "Telefon",
    "brand": "Marke",
    "brand_other": "Andere",
    "message": "Nachricht",
    "submit": "Anfrage senden",
    "success": "Vielen Dank! Wir melden uns innerhalb von 24 Stunden.",
    "error": "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    "hours": "Mo–So, 09:00–17:00",
    "location": "Zürich, Schweiz"
  },
  "footer": {
    "description": "Professionelle eBike Akku Reparatur und Zellentausch in Zürich.",
    "legal": "Rechtliches",
    "impressum": "Impressum",
    "privacy": "Datenschutz",
    "terms": "AGB",
    "cookies": "Cookie Policy",
    "rights": "Alle Rechte vorbehalten."
  }
}
```

- [ ] **Step 3: Create English translations**

Create `lib/i18n/en.json`:

```json
{
  "nav": {
    "services": "Services",
    "brands": "Brands",
    "faq": "FAQ",
    "about": "About",
    "contact": "Contact",
    "call": "Call: 078 244 92 10"
  },
  "hero": {
    "title": "Your eBike Battery. Like New.",
    "subtitle": "Professional cell replacement & repair in Zurich. Free diagnosis.",
    "cta_primary": "Request Free Diagnosis",
    "cta_phone": "078 244 92 10",
    "stat_repairs": "Batteries repaired",
    "stat_price": "from CHF",
    "stat_health": "Health"
  },
  "problem": {
    "title_problem": "Battery weak?",
    "title_solution": "We repair it.",
    "pain_1": "Capacity dropping, range shrinking",
    "pain_2": "New battery costs CHF 800–1,500+",
    "pain_3": "Old batteries = electronic waste",
    "solution_1": "Cell replacement restores full capacity",
    "solution_2": "Repair from CHF 180 — up to 50% cheaper",
    "solution_3": "Sustainable: extend life, reduce waste"
  },
  "services": {
    "title": "Our Services",
    "diagnosis_title": "Free Diagnosis",
    "diagnosis_desc": "Residual capacity, cell balance, discharge, internal resistance, safety — completely free.",
    "diagnosis_price": "Free",
    "diagnosis_cta": "Request diagnosis",
    "cell_title": "Cell Replacement",
    "cell_desc": "Replace individual cells with original quality. Full capacity, like a new battery.",
    "cell_price": "from CHF 180",
    "cell_cta": "Learn more",
    "bms_title": "BMS Service",
    "bms_desc": "Reset, recalibration, 100% health status. Your battery shows full performance again.",
    "bms_price": "from CHF 120",
    "bms_cta": "Learn more"
  },
  "brands": {
    "title": "Brand Specialists",
    "stromer_desc": "Cell replacement, reset to 100% health. All Stromer models.",
    "bosch_desc": "PowerTube, PowerPack — all Bosch systems. Professional repair.",
    "flyer_desc": "Panasonic cells, complete refurbishment. Flyer specialist.",
    "cta": "Learn more"
  },
  "process": {
    "title": "How It Works",
    "step1_title": "Get in touch",
    "step1_desc": "Call us or fill out the form.",
    "step2_title": "Free Diagnosis",
    "step2_desc": "We check your battery professionally and for free.",
    "step3_title": "Repair",
    "step3_desc": "Cell replacement in 3–5 business days. Original quality.",
    "step4_title": "Pick Up",
    "step4_desc": "Your battery — like new. With health certificate."
  },
  "trust": {
    "title": "What Our Customers Say",
    "review_1": "My Stromer battery was down to 55% capacity. After the cell replacement, back to 100%. Highly recommended.",
    "review_1_author": "M. Keller",
    "review_1_bike": "Stromer ST5",
    "review_2": "Fast, fair, transparent. The diagnosis was free and the repair was absolutely worth it.",
    "review_2_author": "S. Brunner",
    "review_2_bike": "Bosch PowerTube",
    "review_3": "Half the price of a new battery, full performance. Top service!",
    "review_3_author": "R. Meier",
    "review_3_bike": "Flyer Gotour",
    "badge_swiss": "Swiss Quality",
    "badge_sustainable": "Sustainable",
    "badge_guarantee": "Warranty",
    "badge_repairs": "2,500+ Repairs"
  },
  "faq": {
    "title": "Frequently Asked Questions",
    "q1": "How long does the repair take?",
    "a1": "Usually 3–5 business days after diagnosis.",
    "q2": "Which brands do you repair?",
    "a2": "Stromer, Bosch, Flyer and many more. Contact us for your brand.",
    "q3": "Is repair cheaper than a new battery?",
    "a3": "Yes, usually 40–60% cheaper than a new battery.",
    "q4": "Is there a warranty?",
    "a4": "Yes, we provide warranty on all cell replacement work.",
    "q5": "Is the diagnosis really free?",
    "a5": "Yes, completely free and non-binding.",
    "q6": "Can I send my battery by post?",
    "a6": "Yes, we offer Switzerland-wide service by shipping."
  },
  "contact": {
    "title": "Battery weak? We help.",
    "subtitle": "Free diagnosis. Repair in 3–5 days. Switzerland-wide.",
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "brand": "Brand",
    "brand_other": "Other",
    "message": "Message",
    "submit": "Send Request",
    "success": "Thank you! We'll get back to you within 24 hours.",
    "error": "Something went wrong. Please try again.",
    "hours": "Mon–Sun, 09:00–17:00",
    "location": "Zurich, Switzerland"
  },
  "footer": {
    "description": "Professional eBike battery repair and cell replacement in Zurich.",
    "legal": "Legal",
    "impressum": "Imprint",
    "privacy": "Privacy Policy",
    "terms": "Terms",
    "cookies": "Cookie Policy",
    "rights": "All rights reserved."
  }
}
```

- [ ] **Step 4: Create next-intl request config**

Create `i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { locales, type Locale } from "@/lib/i18n/config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !locales.includes(locale as Locale)) {
    locale = "de";
  }

  return {
    locale,
    messages: (await import(`@/lib/i18n/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Create middleware for locale detection**

Create `middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "@/lib/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "as-needed",
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

- [ ] **Step 6: Update next.config.ts**

Replace `next.config.ts` with:

```ts
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Create lang layout**

Create `app/[lang]/layout.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!locales.includes(lang as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 8: Create lang homepage**

Create `app/[lang]/page.tsx`:

```tsx
import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("hero");

  return (
    <main className="min-h-screen bg-deep text-white flex items-center justify-center">
      <h1 className="font-display text-6xl tracking-wide">{t("title")}</h1>
    </main>
  );
}
```

- [ ] **Step 9: Update root page.tsx to redirect**

Replace `app/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { defaultLocale } from "@/lib/i18n/config";

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
```

- [ ] **Step 10: Create LanguageToggle**

Create `components/ui/LanguageToggle.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export default function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = () => {
    const newLocale = locale === "de" ? "en" : "de";
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return (
    <button
      onClick={switchLocale}
      className="text-sm font-body font-medium px-3 py-1.5 rounded-md border border-white/20 hover:border-white/40 transition-colors"
    >
      {locale === "de" ? "EN" : "DE"}
    </button>
  );
}
```

- [ ] **Step 11: Verify i18n works**

Run `npm run dev`. Visit `http://localhost:3000` — should redirect to `/de` and show "Ihr eBike-Akku. Wie neu." Visit `/en` — should show "Your eBike Battery. Like New."

- [ ] **Step 12: Commit**

```bash
git add lib/i18n/ i18n/ middleware.ts next.config.ts app/page.tsx app/[lang]/ components/ui/LanguageToggle.tsx
git commit -m "feat: i18n setup with next-intl — DE + EN translations, locale routing"
```

---

## Task 5: Navbar + MobileMenu

**Files:**
- Create: `components/layout/Navbar.tsx`
- Create: `components/layout/MobileMenu.tsx`

- [ ] **Step 1: Create Navbar**

Create `components/layout/Navbar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Phone, Menu, X } from "lucide-react";
import LanguageToggle from "@/components/ui/LanguageToggle";
import MobileMenu from "./MobileMenu";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: t("services"), href: "#services" },
    { label: t("brands"), href: "#brands" },
    { label: t("faq"), href: "#faq" },
    { label: t("about"), href: "#about" },
    { label: t("contact"), href: "#contact" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-deep/80 backdrop-blur-xl border-b border-white/10 shadow-lg"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <a href="#" className="flex-shrink-0">
              <span className="font-display text-2xl text-white tracking-wider">
                BÜNZLI BATTERIES
              </span>
            </a>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-body text-white/70 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right side */}
            <div className="hidden lg:flex items-center gap-4">
              <LanguageToggle />
              <Button variant="primary" size="default" href="tel:+41782449210">
                <Phone size={16} className="mr-2" />
                {t("call")}
              </Button>
            </div>

            {/* Mobile hamburger */}
            <div className="flex items-center gap-3 lg:hidden">
              <LanguageToggle />
              <button
                onClick={() => setMobileOpen(true)}
                className="text-white p-2"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <MobileMenu
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={navLinks}
        phoneLabel={t("call")}
      />
    </>
  );
}
```

- [ ] **Step 2: Create MobileMenu**

Create `components/layout/MobileMenu.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap";
import { X, Phone } from "lucide-react";
import Button from "@/components/ui/Button";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  links: { label: string; href: string }[];
  phoneLabel: string;
}

export default function MobileMenu({ isOpen, onClose, links, phoneLabel }: MobileMenuProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayRef.current || !linksRef.current) return;

    if (isOpen) {
      document.body.style.overflow = "hidden";
      gsap.to(overlayRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.from(linksRef.current.children, {
        y: 30,
        opacity: 0,
        stagger: 0.08,
        duration: 0.4,
        ease: "power3.out",
        delay: 0.15,
      });
    } else {
      document.body.style.overflow = "";
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" });
    }
  }, [isOpen]);

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[60] bg-deep flex flex-col items-center justify-center opacity-0 ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white p-2"
        aria-label="Close menu"
      >
        <X size={28} />
      </button>

      <div ref={linksRef} className="flex flex-col items-center gap-8">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={onClose}
            className="font-display text-4xl text-white hover:text-primary transition-colors"
          >
            {link.label}
          </a>
        ))}
        <Button variant="primary" size="lg" href="tel:+41782449210">
          <Phone size={18} className="mr-2" />
          {phoneLabel}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Navbar.tsx components/layout/MobileMenu.tsx
git commit -m "feat: Navbar with glassmorphism scroll + animated mobile menu"
```

---

## Task 6: Hero Section

**Files:**
- Create: `components/animations/ParticleGrid.tsx`
- Create: `components/sections/Hero.tsx`

- [ ] **Step 1: Create ParticleGrid background**

Create `components/animations/ParticleGrid.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";

export default function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const particleCount = 60;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const init = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(46, 163, 242, 0.4)";
        ctx.fill();

        // Draw lines between nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(46, 163, 242, ${0.1 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    init();
    draw();

    window.addEventListener("resize", () => {
      resize();
      init();
    });

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
```

- [ ] **Step 2: Create Hero section**

Create `components/sections/Hero.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "@/lib/gsap";
import { ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import CountUp from "@/components/animations/CountUp";
import ParticleGrid from "@/components/animations/ParticleGrid";

export default function Hero() {
  const t = useTranslations("hero");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(titleRef.current, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
        ease: "power3.out",
      });
      gsap.from(subtitleRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.6,
        delay: 0.5,
        ease: "power3.out",
      });
      gsap.from(ctaRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        delay: 0.7,
        ease: "power3.out",
      });
      gsap.to(chevronRef.current, {
        y: 10,
        duration: 1.2,
        ease: "power1.inOut",
        repeat: -1,
        yoyo: true,
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="relative min-h-screen bg-deep flex flex-col items-center justify-center overflow-hidden">
      <ParticleGrid />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1
          ref={titleRef}
          className="font-display text-5xl md:text-7xl lg:text-8xl text-white tracking-wider leading-none"
        >
          {t("title")}
        </h1>

        <p
          ref={subtitleRef}
          className="mt-6 text-lg md:text-xl text-white/70 font-body max-w-2xl mx-auto"
        >
          {t("subtitle")}
        </p>

        <div ref={ctaRef} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="primary" size="lg" href="#contact">
            {t("cta_primary")}
          </Button>
          <Button variant="ghost" size="lg" href="tel:+41782449210">
            {t("cta_phone")}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-deep/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-around">
          <div className="text-center">
            <CountUp end={2500} suffix="+" className="font-display text-3xl md:text-4xl text-white" />
            <p className="text-xs md:text-sm text-white/50 font-body mt-1">{t("stat_repairs")}</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <span className="font-display text-3xl md:text-4xl text-white">
              {t("stat_price")} 180
            </span>
            <p className="text-xs md:text-sm text-white/50 font-body mt-1">CHF</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <CountUp end={100} suffix="%" className="font-display text-3xl md:text-4xl text-white" />
            <p className="text-xs md:text-sm text-white/50 font-body mt-1">{t("stat_health")}</p>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div ref={chevronRef} className="absolute bottom-24 z-10">
        <ChevronDown size={28} className="text-white/40" />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/animations/ParticleGrid.tsx components/sections/Hero.tsx
git commit -m "feat: Hero section with particle grid, entrance animations, stats counter"
```

---

## Task 7: Content Sections (Problem/Solution, Services, Brands)

**Files:**
- Create: `components/sections/ProblemSolution.tsx`
- Create: `components/sections/Services.tsx`
- Create: `components/sections/BrandSpecialists.tsx`

- [ ] **Step 1: Create ProblemSolution section**

Create `components/sections/ProblemSolution.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { BatteryWarning, Banknote, Trash2, BatteryCharging, PiggyBank, Leaf } from "lucide-react";
import ScrollReveal from "@/components/animations/ScrollReveal";

export default function ProblemSolution() {
  const t = useTranslations("problem");

  const pains = [
    { icon: BatteryWarning, text: t("pain_1") },
    { icon: Banknote, text: t("pain_2") },
    { icon: Trash2, text: t("pain_3") },
  ];

  const solutions = [
    { icon: BatteryCharging, text: t("solution_1") },
    { icon: PiggyBank, text: t("solution_2") },
    { icon: Leaf, text: t("solution_3") },
  ];

  return (
    <section className="py-24 md:py-32 bg-light">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-16">
          {/* Problem */}
          <ScrollReveal direction="left">
            <div>
              <h2 className="font-display text-4xl md:text-5xl text-dark mb-8">
                {t("title_problem")}
              </h2>
              <div className="space-y-6">
                {pains.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                      <item.icon size={20} className="text-red-500" />
                    </div>
                    <p className="text-dark/70 font-body text-lg pt-1.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Solution */}
          <ScrollReveal direction="right">
            <div>
              <h2 className="font-display text-4xl md:text-5xl text-primary mb-8">
                {t("title_solution")}
              </h2>
              <div className="space-y-6">
                {solutions.map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon size={20} className="text-primary" />
                    </div>
                    <p className="text-dark/70 font-body text-lg pt-1.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create Services section**

Create `components/sections/Services.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { ScanSearch, BatteryCharging, Cpu } from "lucide-react";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function Services() {
  const t = useTranslations("services");

  const services = [
    {
      icon: ScanSearch,
      title: t("diagnosis_title"),
      desc: t("diagnosis_desc"),
      price: t("diagnosis_price"),
      priceVariant: "success" as const,
      cta: t("diagnosis_cta"),
    },
    {
      icon: BatteryCharging,
      title: t("cell_title"),
      desc: t("cell_desc"),
      price: t("cell_price"),
      priceVariant: "primary" as const,
      cta: t("cell_cta"),
    },
    {
      icon: Cpu,
      title: t("bms_title"),
      desc: t("bms_desc"),
      price: t("bms_price"),
      priceVariant: "primary" as const,
      cta: t("bms_cta"),
    },
  ];

  return (
    <section id="services" className="py-24 md:py-32 bg-deep">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="font-display text-4xl md:text-5xl text-white text-center mb-16">
            {t("title")}
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <ScrollReveal key={i} delay={i * 0.15}>
              <Card>
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <service.icon size={24} className="text-primary" />
                  </div>
                  <Badge variant={service.priceVariant}>{service.price}</Badge>
                </div>
                <h3 className="font-display text-2xl text-white mb-3">{service.title}</h3>
                <p className="text-white/50 font-body leading-relaxed mb-6">{service.desc}</p>
                <a
                  href="#contact"
                  className="text-primary font-body font-medium text-sm hover:text-cyan transition-colors inline-flex items-center gap-1"
                >
                  {service.cta} →
                </a>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create BrandSpecialists section**

Create `components/sections/BrandSpecialists.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Button from "@/components/ui/Button";

export default function BrandSpecialists() {
  const t = useTranslations("brands");

  const brands = [
    { name: "Stromer", desc: t("stromer_desc"), color: "from-blue-600 to-blue-800" },
    { name: "Bosch", desc: t("bosch_desc"), color: "from-red-600 to-red-800" },
    { name: "Flyer", desc: t("flyer_desc"), color: "from-emerald-600 to-emerald-800" },
  ];

  return (
    <section id="brands" className="py-24 md:py-32 bg-light">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="font-display text-4xl md:text-5xl text-dark text-center mb-16">
            {t("title")}
          </h2>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {brands.map((brand, i) => (
            <ScrollReveal key={i} delay={i * 0.15}>
              <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Brand color header */}
                <div className={`h-32 bg-gradient-to-br ${brand.color} flex items-center justify-center`}>
                  <span className="font-display text-4xl text-white tracking-wider">
                    {brand.name}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl text-dark mb-2">{brand.name}</h3>
                  <p className="text-dark/60 font-body mb-6">{brand.desc}</p>
                  <Button variant="outline" size="default">
                    {t("cta")} →
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/sections/ProblemSolution.tsx components/sections/Services.tsx components/sections/BrandSpecialists.tsx
git commit -m "feat: ProblemSolution, Services, BrandSpecialists sections"
```

---

## Task 8: Process Timeline (Signature Animation)

**Files:**
- Create: `components/animations/ProcessTimeline.tsx`
- Create: `components/sections/Process.tsx`

- [ ] **Step 1: Create ProcessTimeline animation component**

Create `components/animations/ProcessTimeline.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface ProcessTimelineProps {
  steps: Step[];
}

export default function ProcessTimeline({ steps }: ProcessTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current || !lineRef.current) return;

    const ctx = gsap.context(() => {
      // Pin the section and scrub the line
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: `+=${steps.length * 100}%`,
          pin: true,
          scrub: 1,
        },
      });

      // Animate the progress line
      tl.to(lineRef.current, {
        width: "100%",
        duration: 1,
        ease: "none",
      });

      // Activate each step progressively
      stepsRef.current.forEach((step, i) => {
        if (!step) return;
        const progress = (i + 1) / steps.length;

        tl.to(
          step,
          {
            opacity: 1,
            scale: 1,
            duration: 0.2,
          },
          progress - 0.15
        );
      });
    });

    return () => ctx.revert();
  }, [steps.length]);

  return (
    <div ref={containerRef} className="min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto px-4 w-full">
        {/* Desktop: horizontal */}
        <div className="hidden md:block">
          {/* Line track */}
          <div className="relative h-1 bg-white/10 rounded-full mb-16">
            <div
              ref={lineRef}
              className="absolute top-0 left-0 h-full bg-primary rounded-full w-0"
            />
            {/* Step markers on the line */}
            {steps.map((_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white/20 bg-deep"
                style={{ left: `${((i + 1) / steps.length) * 100 - 100 / steps.length / 2}%` }}
              />
            ))}
          </div>

          {/* Step cards */}
          <div className="grid grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                ref={(el) => { stepsRef.current[i] = el; }}
                className="text-center opacity-30 scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  {step.icon}
                </div>
                <h3 className="font-display text-xl text-white mb-2">{step.title}</h3>
                <p className="text-white/50 font-body text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical */}
        <div className="md:hidden space-y-8">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                {i < steps.length - 1 && <div className="w-0.5 flex-1 bg-white/10 mt-2" />}
              </div>
              <div className="pb-8">
                <h3 className="font-display text-xl text-white mb-1">{step.title}</h3>
                <p className="text-white/50 font-body text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Process section**

Create `components/sections/Process.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Phone, ScanSearch, Wrench, CheckCircle } from "lucide-react";
import ProcessTimeline from "@/components/animations/ProcessTimeline";
import ScrollReveal from "@/components/animations/ScrollReveal";

export default function Process() {
  const t = useTranslations("process");

  const steps = [
    {
      icon: <Phone size={24} className="text-primary" />,
      title: t("step1_title"),
      description: t("step1_desc"),
    },
    {
      icon: <ScanSearch size={24} className="text-primary" />,
      title: t("step2_title"),
      description: t("step2_desc"),
    },
    {
      icon: <Wrench size={24} className="text-primary" />,
      title: t("step3_title"),
      description: t("step3_desc"),
    },
    {
      icon: <CheckCircle size={24} className="text-primary" />,
      title: t("step4_title"),
      description: t("step4_desc"),
    },
  ];

  return (
    <section className="bg-deep">
      <div className="pt-24 pb-8 max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="font-display text-4xl md:text-5xl text-white text-center">
            {t("title")}
          </h2>
        </ScrollReveal>
      </div>
      <ProcessTimeline steps={steps} />
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/animations/ProcessTimeline.tsx components/sections/Process.tsx
git commit -m "feat: Process section with pinned scroll timeline signature animation"
```

---

## Task 9: Trust, FAQ, Contact, Footer

**Files:**
- Create: `components/sections/Trust.tsx`
- Create: `components/sections/FAQ.tsx`
- Create: `components/sections/ContactCTA.tsx`
- Create: `components/layout/Footer.tsx`

- [ ] **Step 1: Create Trust section**

Create `components/sections/Trust.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Star, Shield, Leaf, Award, Wrench } from "lucide-react";
import ScrollReveal from "@/components/animations/ScrollReveal";

export default function Trust() {
  const t = useTranslations("trust");

  const reviews = [
    { text: t("review_1"), author: t("review_1_author"), bike: t("review_1_bike") },
    { text: t("review_2"), author: t("review_2_author"), bike: t("review_2_bike") },
    { text: t("review_3"), author: t("review_3_author"), bike: t("review_3_bike") },
  ];

  const badges = [
    { icon: Shield, text: t("badge_swiss") },
    { icon: Leaf, text: t("badge_sustainable") },
    { icon: Award, text: t("badge_guarantee") },
    { icon: Wrench, text: t("badge_repairs") },
  ];

  return (
    <section className="py-24 md:py-32 bg-light">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="font-display text-4xl md:text-5xl text-dark text-center mb-4">
            {t("title")}
          </h2>
          {/* Google reviews placeholder */}
          <div className="flex items-center justify-center gap-1 mb-16">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={20} className="fill-yellow-400 text-yellow-400" />
            ))}
            <span className="ml-2 text-dark/60 font-body text-sm">4.9 / 5</span>
          </div>
        </ScrollReveal>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {reviews.map((review, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-dark/70 font-body leading-relaxed mb-6">
                  &ldquo;{review.text}&rdquo;
                </p>
                <div>
                  <p className="font-body font-semibold text-dark">{review.author}</p>
                  <p className="text-dark/50 font-body text-sm">{review.bike}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {badges.map((badge, i) => (
            <ScrollReveal key={i} delay={i * 0.1}>
              <div className="flex items-center gap-2 bg-white rounded-full px-5 py-2.5 shadow-sm">
                <badge.icon size={18} className="text-primary" />
                <span className="font-body font-medium text-dark text-sm">{badge.text}</span>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create FAQ section**

Create `components/sections/FAQ.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Accordion from "@/components/ui/Accordion";

export default function FAQ() {
  const t = useTranslations("faq");

  const faqs = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
    { q: t("q5"), a: t("a5") },
    { q: t("q6"), a: t("a6") },
  ];

  return (
    <section id="faq" className="py-24 md:py-32 bg-dark">
      <div className="max-w-3xl mx-auto px-4">
        <ScrollReveal>
          <h2 className="font-display text-4xl md:text-5xl text-white text-center mb-16">
            {t("title")}
          </h2>
        </ScrollReveal>

        <ScrollReveal>
          <div>
            {faqs.map((faq, i) => (
              <Accordion key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create ContactCTA section**

Create `components/sections/ContactCTA.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Phone, Clock, MapPin } from "lucide-react";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Button from "@/components/ui/Button";
import { Input, Textarea, Select } from "@/components/ui/Input";

export default function ContactCTA() {
  const t = useTranslations("contact");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
        (e.target as HTMLFormElement).reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const brandOptions = [
    { value: "stromer", label: "Stromer" },
    { value: "bosch", label: "Bosch" },
    { value: "flyer", label: "Flyer" },
    { value: "other", label: t("brand_other") },
  ];

  return (
    <section id="contact" className="py-24 md:py-32 bg-gradient-to-br from-deep to-primary/80">
      <div className="max-w-6xl mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl text-white mb-4">{t("title")}</h2>
            <p className="text-white/70 font-body text-lg">{t("subtitle")}</p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Form */}
          <ScrollReveal direction="left">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input label={t("name")} name="name" required />
              <Input label={t("email")} name="email" type="email" required />
              <Input label={t("phone")} name="phone" type="tel" />
              <Select label={t("brand")} name="brand" options={brandOptions} />
              <Textarea label={t("message")} name="message" required />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "..." : t("submit")}
              </Button>
              {status === "success" && (
                <p className="text-success font-body text-sm text-center">{t("success")}</p>
              )}
              {status === "error" && (
                <p className="text-red-400 font-body text-sm text-center">{t("error")}</p>
              )}
            </form>
          </ScrollReveal>

          {/* Contact info */}
          <ScrollReveal direction="right">
            <div className="flex flex-col justify-center gap-8">
              <a
                href="tel:+41782449210"
                className="flex items-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Phone size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-display text-3xl text-white">078 244 92 10</p>
                  <p className="text-white/50 font-body text-sm">Jetzt anrufen</p>
                </div>
              </a>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <Clock size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-body font-semibold text-white">{t("hours")}</p>
                  <p className="text-white/50 font-body text-sm">Öffnungszeiten</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <MapPin size={24} className="text-primary" />
                </div>
                <div>
                  <p className="font-body font-semibold text-white">{t("location")}</p>
                  <p className="text-white/50 font-body text-sm">Standort</p>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create Footer**

Create `components/layout/Footer.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Phone, Clock, MapPin } from "lucide-react";

export default function Footer() {
  const tNav = useTranslations("nav");
  const tFooter = useTranslations("footer");
  const tContact = useTranslations("contact");

  const navLinks = [
    { label: tNav("services"), href: "#services" },
    { label: tNav("brands"), href: "#brands" },
    { label: tNav("faq"), href: "#faq" },
    { label: tNav("about"), href: "#about" },
    { label: tNav("contact"), href: "#contact" },
  ];

  const legalLinks = [
    { label: tFooter("impressum"), href: "/impressum" },
    { label: tFooter("privacy"), href: "/datenschutz" },
    { label: tFooter("terms"), href: "/agb" },
    { label: tFooter("cookies"), href: "/cookies" },
  ];

  return (
    <footer className="bg-deep border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <span className="font-display text-xl text-white tracking-wider block mb-3">
              BÜNZLI BATTERIES
            </span>
            <p className="text-white/50 font-body text-sm">{tFooter("description")}</p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-body font-semibold text-white mb-4">Navigation</h4>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-white/50 font-body text-sm hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-body font-semibold text-white mb-4">{tFooter("legal")}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-white/50 font-body text-sm hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-body font-semibold text-white mb-4">{tNav("contact")}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                <Phone size={14} /> 078 244 92 10
              </div>
              <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                <Clock size={14} /> {tContact("hours")}
              </div>
              <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                <MapPin size={14} /> {tContact("location")}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-white/30 font-body text-sm">
            &copy; {new Date().getFullYear()} Bünzli Batteries GmbH. {tFooter("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/sections/Trust.tsx components/sections/FAQ.tsx components/sections/ContactCTA.tsx components/layout/Footer.tsx
git commit -m "feat: Trust, FAQ, ContactCTA sections + Footer"
```

---

## Task 10: Assemble Homepage + Contact API

**Files:**
- Modify: `app/[lang]/page.tsx`
- Create: `app/api/contact/route.ts`

- [ ] **Step 1: Assemble all sections in homepage**

Replace `app/[lang]/page.tsx` with:

```tsx
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/sections/Hero";
import ProblemSolution from "@/components/sections/ProblemSolution";
import Services from "@/components/sections/Services";
import BrandSpecialists from "@/components/sections/BrandSpecialists";
import Process from "@/components/sections/Process";
import Trust from "@/components/sections/Trust";
import FAQ from "@/components/sections/FAQ";
import ContactCTA from "@/components/sections/ContactCTA";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ProblemSolution />
        <Services />
        <BrandSpecialists />
        <Process />
        <Trust />
        <FAQ />
        <ContactCTA />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Create contact API route**

Create `app/api/contact/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

// Minimal Zod-like validation inline (avoid extra dep for now)
function validate(data: Record<string, unknown>) {
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const brand = typeof data.brand === "string" ? data.brand.trim() : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";

  if (!name || name.length > 200) return null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!message || message.length > 5000) return null;

  return { name, email, phone: phone.slice(0, 30), brand: brand.slice(0, 50), message };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = validate(body);

    if (!data) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // For now: log to console. Replace with Resend when API key is available.
    // To enable Resend:
    // 1. npm install resend
    // 2. Add RESEND_API_KEY to .env.local
    // 3. Uncomment the Resend block below and remove the console.log

    console.log("Contact form submission:", data);

    /*
    import { Resend } from "resend";
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Bünzli Batteries <noreply@buenzlibatteries.ch>",
      to: "info@buenzlibatteries.ch",
      subject: `Neue Anfrage von ${data.name}`,
      text: `Name: ${data.name}\nEmail: ${data.email}\nTelefon: ${data.phone}\nMarke: ${data.brand}\n\nNachricht:\n${data.message}`,
    });
    */

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run dev server and verify full page**

```bash
cd ~/Desktop/Projects/buenzli-batteries
npm run dev
```

Visit `http://localhost:3000`. Expected: full homepage with all 10 sections rendering, animations firing on scroll, mobile menu working on narrow viewport.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/[lang]/page.tsx app/api/contact/route.ts
git commit -m "feat: assemble homepage with all sections + contact API route"
```

---

## Task 11: SEO Metadata + Structured Data

**Files:**
- Modify: `app/[lang]/layout.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add SEO metadata to lang layout**

Update `app/[lang]/layout.tsx` — add metadata generation:

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const isDE = lang === "de";

  return {
    title: isDE
      ? "Bünzli Batteries — eBike Akku Reparatur Zürich"
      : "Bünzli Batteries — eBike Battery Repair Zurich",
    description: isDE
      ? "Professionelle eBike Akku Reparatur und Zellentausch in Zürich. Stromer, Bosch, Flyer. Kostenlose Diagnose. CHF 180–1200."
      : "Professional eBike battery repair and cell replacement in Zurich. Stromer, Bosch, Flyer. Free diagnosis. CHF 180–1,200.",
    alternates: {
      canonical: `https://buenzlibatteries.ch/${lang}`,
      languages: {
        de: "https://buenzlibatteries.ch/de",
        en: "https://buenzlibatteries.ch/en",
      },
    },
    openGraph: {
      title: "Bünzli Batteries — eBike Akku Reparatur",
      description: isDE
        ? "Zellentausch & Reparatur in Zürich. Kostenlose Diagnose."
        : "Cell replacement & repair in Zurich. Free diagnosis.",
      url: `https://buenzlibatteries.ch/${lang}`,
      siteName: "Bünzli Batteries",
      locale: isDE ? "de_CH" : "en_US",
      type: "website",
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!locales.includes(lang as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: "Bünzli Batteries GmbH",
            description:
              "Professionelle eBike Akku Reparatur und Zellentausch in Zürich",
            url: "https://buenzlibatteries.ch",
            telephone: "+41782449210",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Zürich",
              addressCountry: "CH",
            },
            openingHours: "Mo-Su 09:00-17:00",
            priceRange: "CHF 180-1200",
            sameAs: [],
            hasOfferCatalog: {
              "@type": "OfferCatalog",
              name: "eBike Akku Services",
              itemListElement: [
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Kostenlose Akku-Diagnose",
                    description: "Restkapazität, Zellbalance, Sicherheitscheck",
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Zellentausch",
                    description: "Einzelne Zellen ersetzen mit Originalqualität",
                  },
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    priceCurrency: "CHF",
                    minPrice: 180,
                  },
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "BMS Service",
                    description: "Reset, Rekalibrierung, 100% Gesundheitsstatus",
                  },
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    priceCurrency: "CHF",
                    minPrice: 120,
                  },
                },
              ],
            },
          }),
        }}
      />
    </NextIntlClientProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/[lang]/layout.tsx
git commit -m "feat: SEO metadata, OpenGraph, hreflang, JSON-LD structured data"
```

---

## Task 12: Final Polish + Verify

**Files:**
- Various touch-ups across existing files

- [ ] **Step 1: Run full type check**

```bash
cd ~/Desktop/Projects/buenzli-batteries
npx tsc --noEmit
```

Fix any type errors found.

- [ ] **Step 2: Run dev server and manually verify all sections**

```bash
npm run dev
```

Checklist:
- [ ] Hero loads with particle animation and entrance animations
- [ ] Stats count up
- [ ] Navbar turns glassmorphic on scroll
- [ ] Problem/Solution slides in from sides
- [ ] Service cards stagger in with hover glow
- [ ] Brand cards appear with scale animation
- [ ] Process timeline pins and scrolls through 4 steps
- [ ] Testimonials and trust badges appear on scroll
- [ ] FAQ accordion opens/closes smoothly
- [ ] Contact form submits (check console for log)
- [ ] Footer renders 4 columns
- [ ] Language toggle switches DE ↔ EN
- [ ] Mobile menu works (resize to < 768px)

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: successful build with no errors. Note any warnings.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final polish, type fixes, production build verified"
```

---

## Summary

| Task | Description | Files |
|------|------------|-------|
| 1 | Project scaffolding | 6 files |
| 2 | GSAP + animation wrappers | 3 files |
| 3 | UI primitives | 5 files |
| 4 | i18n setup (DE + EN) | 10 files |
| 5 | Navbar + MobileMenu | 2 files |
| 6 | Hero section | 2 files |
| 7 | Content sections (Problem, Services, Brands) | 3 files |
| 8 | Process timeline (signature) | 2 files |
| 9 | Trust, FAQ, Contact, Footer | 4 files |
| 10 | Assemble homepage + contact API | 2 files |
| 11 | SEO + structured data | 1 file |
| 12 | Final polish + verify | 0 new files |

**Total: 12 tasks, ~40 files, ~12 commits**
