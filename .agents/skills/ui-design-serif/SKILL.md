---
name: Serif Design System
description: Editorial serif-based design system with Playfair Display, burnished gold accents, and typographic elegance for premium UI
---

<role>
You are an expert frontend engineer, UI/UX designer, visual design specialist, and typography expert. Your goal is to help the user integrate a design system into an existing codebase in a way that is visually consistent, maintainable, and idiomatic to their tech stack.

Before proposing or writing any code, first build a clear mental model of the current system:

- Identify the tech stack (e.g. React, Next.js, Vue, Tailwind, shadcn/ui, etc.).
- Understand the existing design tokens (colors, spacing, typography, radii, shadows), global styles, and utility patterns.
- Review the current component architecture (atoms/molecules/organisms, layout primitives, etc.) and naming conventions.
- Note any constraints (legacy CSS, design library in use, performance or bundle-size considerations).

Ask the user focused questions to understand the user's goals. Do they want:

- a specific component or page redesigned in the new style,
- existing components refactored to the new system, or
- new pages/features built entirely in the new style?

Once you understand the context and scope, do the following:

- Propose a concise implementation plan that follows best practices, prioritizing:
  - centralizing design tokens,
  - reusability and composability of components,
  - minimizing duplication and one-off styles,
  - long-term maintainability and clear naming.
- When writing code, match the user's existing patterns (folder structure, naming, styling approach, and component patterns).
- Explain your reasoning briefly as you go, so the user understands *why* you're making certain architectural or design choices.

Always aim to:

- Preserve or improve accessibility.
- Maintain visual consistency with the provided design system.
- Leave the codebase in a cleaner, more coherent state than you found it.
- Ensure layouts are responsive and usable across devices.
- Make deliberate, creative design choices (layout, motion, interaction details, and typography) that express the design system's personality instead of producing a generic or boilerplate UI.
</role>

# Design Style: Serif

## Design Philosophy

### Core Principle

**Typographic elegance through classical restraint.** This design system draws inspiration from the finest editorial publications, literary magazines, and luxury brand identities. It believes that the highest form of design is one that elevates content through refined typography, considered spacing, and deliberate simplicity.

The serif typeface is not merely a font choice—it is the soul of this aesthetic. Every curve of the letterform, every carefully weighted stroke, speaks to centuries of typographic tradition. This design honors that heritage while executing with modern precision.

### The Visual Vibe

**Editorial. Timeless. Warm. Refined.**

Imagine opening a beautifully designed hardcover book or a premium architecture magazine. The pages breathe. The typography has room to speak. Nothing screams for attention because everything has been placed with intention. This is the feeling we create.

**Emotional Keywords:**

- *Timeless* — This design would feel appropriate today, a decade ago, or a decade from now. It transcends trends.
- *Warm* — The ivory backgrounds, the organic serif curves, the golden accent create an inviting, human quality.
- *Sophisticated* — Small caps, refined rules, generous margins all whisper quality and attention to detail.
- *Literary* — This feels like it belongs in the world of ideas, of considered communication, of meaningful content.
- *Confident* — True elegance comes from restraint, not embellishment. This design is secure enough to be quiet.

**What This Design Is NOT:**

- Not cold or stark (despite being minimal)
- Not trendy or ephemeral (the serif anchors it in timelessness)
- Not decorative or ornate (restraint is key)
- Not corporate or generic (the typography gives it soul)
- Not loud or aggressive (it draws you in rather than demanding attention)

### The DNA of This Style

#### 1. The Signature Serif

The **Playfair Display** typeface is the cornerstone. Its high contrast between thick and thin strokes, its elegant ball terminals, and its classical proportions immediately establish editorial gravitas. This font has presence—it commands attention without raising its voice.

**Where it appears:**

- All major headlines (h1, h2, h3)
- Large display numbers (pricing, stats)
- Pull quotes in testimonials
- Logo wordmark

**Why it works:** Serif typefaces carry associations with tradition, trustworthiness, and intellectual depth. Playfair Display specifically feels both classical and contemporary—it's not stuffy or old-fashioned but brings warmth and character.

#### 2. The Warm Palette

Color in this system is used with extreme restraint. The palette is essentially monochromatic with a single warm accent:

- **Ivory (#FAFAF8)** — A cream-tinted white that feels warmer than pure white
- **Rich Black (#1A1A1A)** — Deep but not harsh, for primary text
- **Warm Gray (#6B6B6B)** — For secondary text, with slight warmth
- **Burnished Gold (#B8860B)** — The single accent color, used sparingly for emphasis

The gold accent is inspired by gold leaf in illuminated manuscripts, the gilded edges of fine books, the brass details in luxury interiors. It adds just enough warmth and distinction without overwhelming the monochrome foundation.

#### 3. The Rule Line System

Thin horizontal rules (1px lines) are a defining element:

- Section dividers
- Card borders (top accent lines)
- Underline effects on key elements
- Table separators

These rules are inspired by editorial layouts where fine lines create structure and rhythm without visual weight. They're always in the border color (#E8E4DF), slightly warmer than pure gray.

#### 4. Small Caps & Tracking

**Small caps** are used extensively for:

- Section labels
- Meta information (dates, categories)
- Supporting text
- Navigation items

Combined with **generous letter-spacing (0.1em - 0.15em)**, small caps create a refined, sophisticated look that's distinctly editorial. This is not a cheap trick—it's a typography fundamental that separates thoughtful design from generic output.

#### 5. Generous Whitespace

This design breathes. Margins are large. Padding is substantial. Line heights are relaxed.

- Section padding: `py-32` to `py-44`
- Content max-width: `max-w-5xl` (narrower for reading comfort)
- Line height for body: `1.75` (very relaxed)
- Letter spacing for body: slight positive tracking for readability

The whitespace isn't empty—it's an active design element that gives the typography room to perform.

#### 6. Asymmetric Balance

While the overall aesthetic is classical, the layouts embrace asymmetric compositions:

- Hero: Centered but with offset decorative elements
- Benefits: Uneven column splits (1.3fr / 0.7fr)
- Cards: Thin top border creates visual weight at top

This prevents the design from feeling static or predictable while maintaining elegance.

### Differentiation: Minimalism With Soul

Many minimalist designs strip away so much that they become characterless—white backgrounds, gray text, system fonts. This design proves that minimalism and personality are not mutually exclusive.

**The serif typeface is the key differentiator.** It brings:

- Visual interest without decoration
- Warmth without color
- Character without complexity
- Timelessness without being dated

This is minimalism with a point of view. It has something to say.

---

## Design Token System (The DNA)

### Color Strategy

**Monochrome With Warmth:** An intentionally limited palette that gains sophistication through restraint. The single gold accent provides just enough distinction.

| Token | Value | Usage & Context |
|:------|:------|:----------------|
| `background` | `#FAFAF8` | Primary canvas. Warm ivory that feels more refined than pure white. |
| `foreground` | `#1A1A1A` | Primary text. Rich black, not pure black. |
| `muted` | `#F5F3F0` | Secondary surfaces, card backgrounds. Slightly warmer than background. |
| `muted-foreground` | `#6B6B6B` | Secondary text. Warm gray with softness. |
| `accent` | `#B8860B` | Burnished gold. Links, highlights, key interactive elements. |
| `accent-secondary` | `#D4A84B` | Lighter gold for gradients and hover states. |
| `accent-foreground` | `#FFFFFF` | Text on accent backgrounds. |
| `border` | `#E8E4DF` | Warm gray for rules, dividers, card borders. |
| `card` | `#FFFFFF` | Card surfaces. Pure white for maximum lift from ivory background. |
| `ring` | `#B8860B` | Focus rings. Matches accent gold. |

---

### Typography System

**Font Pairing (Editorial System):**

- **Display/Headlines:** `"Playfair Display", Georgia, serif` — Elegant high-contrast serif for all headings. The signature of this design.
- **Body/UI:** `"Source Sans 3", system-ui, sans-serif` — Clean, highly readable sans-serif that complements without competing.
- **Monospace:** `"IBM Plex Mono", monospace` — For labels and small caps treatments.

**Type Scale & Usage:**

| Element | Size | Font | Weight | Tracking | Notes |
|:--------|:-----|:-----|:-------|:---------|:------|
| Hero Headline | `7xl` → `4.5rem` | Playfair Display | Normal | `-0.02em` | Tight leading (1.1). Center-aligned. |
| Section Headlines | `4xl` → `2.5rem` | Playfair Display | Normal | `-0.01em` | Leading 1.2. |
| Card Titles | `xl` → `1.25rem` | Playfair Display | Semibold | Normal | Leading 1.3. |
| Body Text | `base` → `lg` | Source Sans 3 | Normal | `0.01em` | Relaxed line-height (1.75). |
| Section Labels | `xs` (12px) | IBM Plex Mono | Medium | `0.15em` | UPPERCASE small caps style. |
| Navigation | `sm` | Source Sans 3 | Medium | `0.05em` | Slightly tracked. |

**Small Caps Pattern:**

```css
.small-caps {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
```

---

### Spacing & Layout

**Core Principle:** Luxurious breathing room. This design is not afraid of empty space.

- **Section Spacing:** Large vertical padding (`py-32` to `py-44`) creates paced, contemplative scrolling.
- **Container Width:** `max-w-5xl` (64rem) for narrower, more readable content columns.
- **Component Density:** Generous internal padding (p-8 to p-10) on cards.
- **Grid Gaps:** `gap-8` to `gap-12` between grid items.

**Layout Patterns:**

- Hero: Centered, narrow container, stacked elements
- Features: 3-column grid with generous gaps
- Benefits: Asymmetric 2-column (`grid-cols-[1.3fr_0.7fr]`)
- Use thin rule lines to create visual structure

---

### Borders, Surfaces & Shadows

**Surfaces:**

- Cards use pure white (`#FFFFFF`) for lift from ivory background
- Very subtle shadows—this isn't about depth, it's about refinement
- Thin borders (1px) in warm gray

**Border System:**

| Token | Value | Usage |
|:------|:------|:------|
| `border-thin` | `1px solid #E8E4DF` | Primary borders, rules |
| `border-accent` | `1px solid #B8860B` | Accent borders, highlighted cards |

**Shadow System:**

| Token | Value | Usage |
|:------|:------|:------|
| `shadow-sm` | `0 1px 2px rgba(26,26,26,0.04)` | Subtle lift |
| `shadow-md` | `0 4px 12px rgba(26,26,26,0.06)` | Cards, hover states |
| `shadow-lg` | `0 8px 24px rgba(26,26,26,0.08)` | Elevated elements |

**Rule Lines (Critical for Style Identity):**

- Thin horizontal rules as section dividers
- Top border accent on cards (1px accent color)
- Decorative rule under headlines

---

## Component Styling & Interactions

### Buttons

**Primary Button:**

- Background: `accent` gold
- Text: White, medium weight, slightly tracked
- Border-radius: `rounded-md` (6px)
- Shadow: Very subtle, accent-tinted (`shadow-sm`)
- Hover: Color shifts to `accent-secondary`, shadow enhances to `shadow-accent`, subtle lift (-translate-y-0.5)
- Active: Returns to base position (translate-y-0)
- Minimum height: 44px on mobile (accessibility)

**Secondary/Outline Button:**

- Background: Transparent
- Border: `1px` in `foreground` color
- Hover: Fill with `muted` background, border and text shift to `accent` color

**Ghost Button:**

- No background or border
- Text: `muted-foreground` → `foreground` on hover
- Underline appears on hover with `accent` color

**Animation:** Refined transitions (`200ms`). Subtle lift on primary buttons.

---

### Cards

**Standard Card:**

- Background: `card` (white)
- Border: `1px` in `border` color
- Border-radius: `rounded-lg` (8px)
- Shadow: `shadow-sm`
- Top accent: Optional `2px` accent border on top edge

**Hover Effects:**

- Shadow increases to `shadow-md`
- Border color shifts to `border-hover`
- Smooth `200ms` transition

---

### Section Labels

A consistent label pattern appears at the start of each section:

```jsx
<div className="mb-6 flex items-center gap-4">
  <span className="h-px flex-1 bg-[var(--border)]" />
  <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-[var(--accent)]">
    Section Name
  </span>
  <span className="h-px flex-1 bg-[var(--border)]" />
</div>
```

---

## The "Bold Factor" (Signature Elements)

1. **Dramatic Serif Headlines:** Oversized serif typography (7xl in hero)
2. **Rule Line System:** Thin horizontal rules for rhythm and structure
3. **Small Caps Labels:** Tracked uppercase monospace for section labels
4. **Burnished Gold Accent:** Single warm accent to prevent sterility
5. **Generous Whitespace:** `py-32` to `py-44` padding
6. **Large Display Numbers:** Serif display numbers at 5xl+
7. **Decorative Quote Marks:** Large opening quote marks in accent gold
8. **Asymmetric Layouts:** Uneven columns for visual interest
9. **Paper Texture Overlay:** Subtle noise at 30% opacity
10. **Ambient Glow:** Large blurred circle with 2% opacity accent

---

## Responsive Strategy

### Mobile Adaptations (< 768px)

- Hero headline: `text-[2.5rem]`
- Stats: 2-column grid
- Features/Cards: Single column, gap-8 minimum
- All buttons: Min 44px height
- Touch: `touch-manipulation` on all interactive elements

### Key Principles

- Typography scales down but hierarchy stays clear
- Serif font impact preserved on all devices
- Rule lines and gold accents remain consistent
- Touch targets meet WCAG AAA (44x44px minimum)

---

## Accessibility

- All text meets WCAG AA contrast
- Focus rings: `ring-2 ring-accent ring-offset-2`
- Body line-height: 1.75
- Base font: 16px minimum
- `prefers-reduced-motion` respected
- Semantic HTML with proper heading hierarchy
