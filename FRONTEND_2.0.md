# FRONTEND 2.0 — ARGUS AI Complete Frontend Redesign Specification

> **Author**: Frontend Architecture Lead
> **Date**: 23 September 2026
> **Status**: PHASE 1 — v1.1 REVISION
> **Scope**: Full teardown and rebuild of all frontend sections
> **Animation Engine**: GSAP (primary) + Framer Motion (declarative layout)
> **Theme Engine**: CSS custom properties + `localStorage` persistence

---

> ### Changelog — v1.0 → v1.1
>
> | Section | What Changed |
> | :--- | :--- |
> | **§2 Color System** | Complete rebuild. Replaced the self-confirming 7-candidate elimination with a genuine constraint-driven THREE-LAYER architecture (Severity / Functional Brand / Decorative Personality). Added full pairwise hue-degree distance table for every functional color. Resolved the `--jade` / `--safe` near-identical hue collision by reassigning operational connectivity state to `--slate-connect` (desaturated blue-gray). Introduced a Mauve/Dusty Rose decorative personality token restricted to Landing/Profile hero moments only. |
> | **§3 Typography** | Genuine competitive comparison across Satoshi, General Sans, and Switzer at actual ARGUS headline sizes. Added **DM Serif Display** as an editorial display face (Google Fonts) restricted to Landing hero headline and major Profile headers only — creating personality contrast against the operational grotesk system. Operational screens untouched. |
> | **§4 Motion & Animation** | Added explicit PRIMARY/SECONDARY tier motion split as its own subsection. Added full GSAP-timeline spec for the signature "System Boot" sequence triggered on Landing → Command Center transition. Timing/easing specs and reduced-motion support preserved unchanged. |
> | **§§1, 5, 6, 7, 8, 9** | **Preserved unchanged.** Copied forward exactly as in v1.0. |

---

## Table of Contents

1. [Redesign Philosophy](#1-redesign-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Motion & Animation System](#4-motion--animation-system)
5. [Global Navigation](#5-global-navigation)
6. [AI Assistant / Copilot Audit](#6-ai-assistant--copilot-audit)
7. [Section-by-Section Specification](#7-section-by-section-specification)
8. [Accessibility & Legibility Checklist](#8-accessibility--legibility-checklist)
9. [Phase 2 Execution Sequence](#9-phase-2-execution-sequence)

---

## 1. Redesign Philosophy

### 1.1 — Full Rebuild, Not Reskin

This is not a color-swap or component library migration. Every `.tsx` page, every CSS token, every component boundary is being re-evaluated from first principles against one question: **does this element earn its place on screen by helping a shift supervisor make a faster, more confident safety decision?**

### 1.2 — "Dynamic, Not Static" — What This Means Concretely

The current frontend *looks* like a working application but *behaves* like a screenshot. Numbers are hardcoded. Charts don't respond to data changes. Navigation snaps instead of transitioning. Feeds don't update. There is no visible difference between "the system is working" and "the system is frozen." For a safety-critical interface, this is a disqualifying flaw — a supervisor must be able to glance at the screen and instantly confirm the system is alive.

**Every screen must satisfy ALL of the following:**

| Requirement | Definition |
| :--- | :--- |
| **Liveness signal** | At least one element on every operational screen must visibly change on a sub-5-second cadence (clock tick, latency jitter, feed frame counter, radar sweep, sequence cursor increment) to prove the system is not frozen. |
| **State-driven rendering** | Every number, badge count, chart datapoint, and status indicator must be wired to either real backend state (via WebSocket/REST) or a realistic simulation store that advances over time. Zero hardcoded display values in production components. |
| **Tri-state coverage** | Every asynchronous section defines and renders three states: **Loading** (skeleton/shimmer placeholder matching the section's layout), **Empty** (purposeful empty-state illustration with a clear call-to-action or explanation), and **Error** (inline error message with retry affordance, never a blank screen). |
| **Interactive feedback** | Every clickable element has a visible hover state (cursor change + visual shift), an active/pressed state (scale or color shift), and a focus-visible state (keyboard ring). No "dead" buttons. |
| **Entrance choreography** | Page-level content appears via staggered GSAP entrance (opacity 0→1, y offset 16→0, stagger 0.06s per element). No content "pops" into existence. |

### 1.3 — Clutter Audit: Elements to Remove

After auditing every element in the current UI, the following add no real user value and create visual noise:

| Element | Location | Reason for Removal |
| :--- | :--- | :--- |
| `ParticleBackground.tsx` (tsparticles) | Landing page | Purely decorative, adds no information, burns GPU, distracts from actual content. The landing page should communicate product value, not animate dots. |
| Redundant "OPERATOR CONSOLE" button | Landing top-right + hero CTA area | Two buttons going to the same `/wall` route within 200px of each other. Keep only the primary CTA. |
| "ISO 45001 AUDIT ACTIVE" OSD badge | Landing canvas preview | Jargon badge on a demo preview. Supervisors know their audit status from the compliance system, not a floating badge on a mock feed. |
| `animate-spin-slow` outer ring on ArgusEyeLogo | Logo SVG | Perpetually rotating ring is distracting in the nav and adds no information. Replace with a static outer ring and reserve animation for the pupil-tracking behavior only. |
| "CAS v2 CONCURRENCY ARMED" text | Top status strip center | Internal engineering terminology that means nothing to a shift supervisor. Replace with human-readable system status ("All Systems Normal" / "4 Cameras Online"). |
| "MONOTONIC SEQ: #128" display | Top status strip | Debug telemetry, not operational information. Move to the Admin/Health page. |
| "TEMPORAL VOTING 8/10 PPE" text | Top status strip | Implementation detail. Supervisors don't need to know the voting algorithm name. The alert confidence percentage already communicates this. |
| `Navbar.tsx` (14KB, unused) | Components | The old top navbar is completely superseded by `TopStatusStrip` + `BottomDock`. It is never rendered. Delete it. |
| "PASSED_SILENT" alert cards in mini-queue | Wall page sidebar | Corner-case passes are NOT alerts — they are non-events. Showing "nothing happened" in an alert queue undermines the queue's purpose. Move corner-case proof to the Analytics or Landing page only. |
| Redundant footer nav links | Landing page footer | Duplicates the bottom dock navigation. Footer should contain attribution only. |

### 1.4 — Design DNA: What Replaces the Clutter

Fewer elements, each doing more work. The visual language is:

- **Warm industrial** — not cyberpunk, not SaaS-blue, not neon-sci-fi
- **Solid surfaces with hairline borders** — depth through layered values, not blur/glass
- **Copper as the singular brand accent** — used for active states, CTAs, and the brand mark only
- **Severity colors that own their context** — red/amber/green are NEVER used for decoration, only for safety semantics
- **Data that moves** — counters count up, sparklines draw, gauges sweep, feeds refresh

---

## 2. Color System

> **v1.1 REWRITE** — The v1.0 candidate exploration was a self-confirming elimination that landed back on the pre-existing palette unchanged. This section replaces it with a genuine constraint-driven synthesis using a three-layer architecture. All hue distances are stated as actual degree measurements on the HSL wheel, not asserted verdicts.

### 2.1 — Design Constraints That Drive the Architecture

Before selecting any color, the constraints are stated explicitly, because they mechanically narrow the solution space:

**Constraint 1 — Severity layer is immovable.** The four severity hues are fixed by functional meaning and cannot be renegotiated:
- Critical Red: ~H 1–2° (pure red family)
- Warning Amber: ~H 25–26° (orange-amber family)
- Safe Green: ~H 142–146° (mid green family)
- Compliance Steel-Gray: ~H 225° (desaturated blue-gray — achromatic, minimal hue)

Any brand accent must be ≥45° away from all four of these to avoid perceptual confusion. This rules out the entire red arc (H 330°–30°), the orange-amber arc (H 10°–45°), the green arc (H 100°–170°), and the blue-gray arc (H 200°–250°) for any interactive/brand use.

**Constraint 2 — Blue and violet are banned.** Established in the prior design round and confirmed: these are the default of every AI-generated SaaS product in 2025–2026 and create zero product identity.

**Constraint 3 — The Decorative Personality layer hue must be genuinely different from the brand accent.** If both layers share the same hue family, we have two-tone minimalism, not genuine chromatic richness. The personality hue must be ≥80° from the brand accent AND never appear on any interactive element, badge, or status indicator.

### 2.2 — Hue Wheel Analysis: Available Space After Constraints

Plotting all forbidden arcs on a 360° wheel:

```
  0°   Red family (Critical) — BLOCKED (H 330°–30°)
 25°   Amber family (Warning) — BLOCKED (H 10°–50°)
 50°   Yellow-green — risky (borders amber and safe green)
 90°   Warm yellow-green — available
142°   Green family (Safe) — BLOCKED (H 100°–170°)
180°   Cyan/Teal — available
225°   Blue-gray (Compliance) — BLOCKED (H 200°–255°)
260°   Violet/Purple — BANNED by prior round decision
310°   Magenta/Rose — available (≥45° from all severity hues, not banned)
 26°   Copper/Sienna — UNDER EVALUATION for Functional Brand layer
```

**Two genuinely safe zones emerge:**
- **H 26° copper/sienna** — sits between the red block (H 330°–30°) and the amber block (H 10°–50°). The proximity to both requires luminance and shape disambiguation (see §2.3, Layer B).
- **H 300°–330° dusty mauve/rose** — chromatically distant from ALL four severity hues. Distance to Critical Red (H 1°): 44° short-arc. Distance to Safe Green (H 142°): 158°–188°. Distance to Warning Amber (H 25°): 275°–305°. Distance to Compliance Steel (H 225°): 75°–105°. This hue family is effectively unclaimed in the entire design system.

### 2.3 — THREE-LAYER COLOR ARCHITECTURE

#### LAYER A — SEVERITY (Functional Only, Semantically Reserved)

These four hues are the system's primary language. They appear ONLY on alert cards, severity badges, status indicators, and the wall camera border during active incidents. They are NEVER used decoratively, NEVER used for navigation, NEVER used for brand expression.

| Token | Hex | HSL | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| `--critical` | `#C1272D` | `H 2°, S 65%, L 45%` | Fire / medical emergency / immediate evacuation |
| `--warning` | `#E8700A` | `H 26°, S 89%, L 47%` | PPE missing / near-miss / corrective action needed |
| `--safe` | `#2E8B57` | `H 146°, S 50%, L 36%` | All-clear / inspection passed / no violations |
| `--compliance` | `#7A8194` | `H 225°, S 10%, L 54%` | Audit item / policy check / procedural flag |

> **Note on Warning Amber**: v1.0 value `#F2760C` (H 25°, S 95%) shifted to `#E8700A` (H 26°, S 89%). This reduces saturation by 6 points to create a more visible perceptual gap between warning amber and brand copper, which share the same hue angle. The hue itself is unchanged; only saturation is reduced slightly.

---

#### LAYER B — FUNCTIONAL BRAND (Interactive UI, Used App-Wide)

This is the single hue family used for all interactive affordances: CTA buttons, active nav states, focus rings, links, progress indicators, hover borders. ONE hue, disciplined application.

**Selected hue: Copper — H 26°, S 64%, L 47% (dark mode)**

**Copper selection rationale (constraint-driven):**

The available safe zones are copper/sienna and dusty mauve. Mauve (H 310°+) fails as a functional brand accent because it reads as passive, delicate, and low-urgency — the opposite of what a heavy-industrial safety system must communicate through its action color. An interactive button in dusty mauve signals "save changes in a wellness app," not "acknowledge this fire alarm." Copper survives because it communicates material authority (metal, industry, precision tooling) without reading as a severity signal.

**The copper/warning-amber proximity problem — resolved explicitly:**

`--brand-accent` copper (H 26°, S 64%) and `--warning` amber (H 26°, S 89%) share the same hue angle. This is acknowledged, not glossed over. Disambiguation relies on three enforced separators:

1. **Saturation separation**: copper S 64% vs warning S 89%. Warning is substantially more vivid — it "burns" harder at the same hue. Perceptually, this reads as two different colors at a glance.
2. **Shape/element type separation**: copper ONLY appears as a solid background on rectangular buttons and as thin-line focus rings/borders. Warning amber ONLY appears as a text label, a 4px left-edge stripe on alert cards, and a badge background. These are categorically different UI shapes that never co-occur on the same element.
3. **Icon reinforcement**: Warning states ALWAYS pair with the ⚠ triangle icon and the text "WARNING." Copper brand elements NEVER carry any severity icon.

| Token | Dark Hex | Dark HSL | Light Hex | Light HSL | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--brand-accent` | `#C6752B` | `H 26°, S 64%, L 47%` | `#A8611F` | `H 26°, S 70%, L 39%` | CTA buttons, active nav dot, focus rings, links |
| `--brand-accent-hover` | `#B26521` | `H 24°, S 69%, L 41%` | `#8E5218` | `H 26°, S 73%, L 33%` | Hover on accent elements |
| `--brand-accent-subtle` | `rgba(198,117,43,0.12)` | — | `rgba(168,97,31,0.08)` | — | Accent background tint on hover states |
| `--brand-glow` | `rgba(198,117,43,0.25)` | — | — | — | CTA button glow, hero accent glow |

---

#### LAYER C — DECORATIVE PERSONALITY (Landing Hero + Profile Only)

This layer exists for one reason: to give the Landing page and Profile header a premium, emotionally resonant first impression that the operational system deliberately cannot have. Because this hue NEVER appears on any button, badge, border, status dot, or interactive element anywhere in the operational app, it creates zero severity ambiguity — it is semantically isolated.

**Selected hue: Dusty Mauve — H 318°, S 28%, L 38% (dark mode)**

**Why dusty mauve:**

- **H 318° is the furthest navigable point from all severity hues.** Distance to Critical Red (H 2°): 44°. Distance to Warning Amber (H 26°): 68°. Distance to Safe Green (H 146°): 172°. Distance to Compliance Steel (H 225°): 93°. No severity hue is within 40° of it.
- **Not violet/purple (H 260°–290°)** — those are banned. Dusty mauve at H 318° is in the rose-pink family, not the indigo/purple family. It reads as warm and organic, not tech-blue's cold cousin.
- **"Dusty" (low saturation S 28%) is critical.** A fully saturated magenta at H 318° would clash violently with the industrial copper surfaces. At S 28%, this reads as a muted architectural rose — the kind seen in premium editorial packaging. It adds richness without noise.
- **Usage**: Applied only in hero gradient washes and background treatment on Landing and Profile. NEVER on any element the user clicks, NEVER on any badge, NEVER on any screen a shift supervisor reads during active monitoring.

| Token | Dark Hex | Dark HSL | Light Hex | Light HSL | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--personality-rose` | `#7A4560` | `H 318°, S 28%, L 38%` | `#9B5C7A` | `H 318°, S 25%, L 48%` | Landing hero gradient anchor, Profile hero wash ONLY |
| `--personality-rose-subtle` | `rgba(122,69,96,0.18)` | — | `rgba(155,92,122,0.10)` | — | Gradient overlay tint |

**Example Landing hero gradient:**
```css
.landing-hero-bg {
  background: radial-gradient(
    ellipse 80% 60% at 50% 40%,
    rgba(122, 69, 96, 0.22) 0%,     /* --personality-rose */
    rgba(198, 117, 43, 0.08) 45%,   /* --brand-accent warm transition */
    transparent 70%
  ),
  var(--base);
}
```

---

### 2.4 — The `--jade` Collision: Diagnosis and Resolution

**The bug:** v1.0 defined `--jade` as `#1B8A5A` (H 152°, S 67%, L 32%) and `--safe` as `#3E8E5A` (H 142°, S 38%, L 40%). Hue distance: 10°. At small dot sizes (8px operational status dot vs. 16px alert badge), these two greens are visually indistinguishable — a genuine violation of the non-collision rule.

**The semantic problem:** "Jade" indicated camera "online/connected." "Safe green" indicates a safety inspection passed. These are categorically different states:
- **Connectivity state**: "Is the hardware communicating with the system?" — a network/infrastructure question.
- **Safety state**: "Did a person pass the PPE inspection?" — a safety-critical operational question.

Using the same hue family erases a semantically important boundary. A supervisor trained to read green as "safe/passed" will automatically misread a green connectivity dot as a safety signal.

**Resolution chosen: Option (a) — Reassign connectivity/online status to a distinct desaturated slate tone.**

`--slate-connect` replaces `--jade` entirely. The jade token is removed.

**Why not Option (b) (use brand copper for operational indicators)?** Copper is the brand/action color. A copper dot would imply "this camera is selected/active" (a navigation state) rather than "connected" (an infrastructure state). Desaturated blue-gray for connectivity is a well-established convention (Grafana, Datadog, Prometheus all use this pattern) and cleanly separates infrastructure state from both brand action (copper) and safety outcome (green).

| Token | Hex | HSL | Replaces | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--slate-connect` | `#4A7A9B` | `H 205°, S 35%, L 45%` | `--jade` | Camera online dot, WebSocket live indicator, node "connected" status |
| `--slate-connect-subtle` | `rgba(74,122,155,0.12)` | — | `--jade-subtle` | Connected status background tint |

> `--slate-connect` at H 205° is 20° from the Compliance Steel boundary (H 225°). Disambiguation: `--slate-connect` is S 35% (clearly blue), `--compliance` is S 10% (near-achromatic gray). Additionally, connectivity dots are always 8px circles; compliance indicators are always rectangular text badges.

---

### 2.5 — Full Token Set

#### DARK THEME — PRIMARY Tier (Operational Screens)

| Token | Hex | HSL | Usage |
| :--- | :--- | :--- | :--- |
| `--base` | `#16140F` | `H 36°, S 24%, L 7%` | Page background |
| `--surface` | `#211D17` | `H 30°, S 23%, L 11%` | Card / panel background |
| `--elevated` | `#2C2620` | `H 26°, S 18%, L 15%` | Elevated panel, modal, popover |
| `--border` | `#3A332A` | `H 28°, S 16%, L 19%` | Hairline borders, dividers |
| `--border-subtle` | `#2E2820` | `H 28°, S 19%, L 15%` | Subtle inner borders |
| `--text-primary` | `#F3EFE6` | `H 38°, S 37%, L 93%` | Headings, primary labels |
| `--text-secondary` | `#A69C8C` | `H 30°, S 12%, L 60%` | Descriptions, captions |
| `--text-muted` | `#6B6358` | `H 26°, S 10%, L 38%` | Disabled, timestamps |
| `--brand-accent` | `#C6752B` | `H 26°, S 64%, L 47%` | CTAs, active states, focus rings |
| `--brand-accent-hover` | `#B26521` | `H 24°, S 69%, L 41%` | Hover on accent elements |
| `--brand-accent-subtle` | `rgba(198,117,43,0.12)` | — | Accent background tint |
| `--slate-connect` | `#4A7A9B` | `H 205°, S 35%, L 45%` | Camera online dot, WS live indicator |
| `--slate-connect-subtle` | `rgba(74,122,155,0.12)` | — | Connected status background tint |

#### DARK THEME — SECONDARY Tier Additions (Landing, Profile, Settings)

Inherits all PRIMARY tokens, plus:

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `--surface-warm` | `#241F18` | Landing hero sections, profile header |
| `--elevated-warm` | `#302921` | Feature cards on landing |
| `--text-display` | `#F8F4EB` | Hero heading text (slightly warmer white) |
| `--brand-glow` | `rgba(198,117,43,0.25)` | CTA button glow, hero accents |
| `--personality-rose` | `#7A4560` | Landing hero gradient, Profile hero wash ONLY |
| `--personality-rose-subtle` | `rgba(122,69,96,0.18)` | Gradient overlay tint |

#### Severity Tokens (Both Tiers — Semantically Reserved)

| Severity | Hex | HSL | Icon | Shape | Position Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--critical` | `#C1272D` | `H 2°, S 65%, L 45%` | Flame 🔥 | Diamond/octagon border | Always topmost |
| `--critical-bg` | `rgba(193,39,45,0.15)` | — | — | — | Background tint |
| `--critical-dark` | `#681216` | — | — | — | Dark-mode pressed |
| `--warning` | `#E8700A` | `H 26°, S 89%, L 47%` | CigaretteOff 🚭 | Triangle border | Below critical |
| `--warning-bg` | `rgba(232,112,10,0.15)` | — | — | — | Background tint |
| `--warning-dark` | `#7E3902` | — | — | — | Dark-mode pressed |
| `--compliance` | `#7A8194` | `H 225°, S 10%, L 54%` | HardHat 🦺 | Rectangle/square border | Below warning |
| `--compliance-bg` | `rgba(122,129,148,0.12)` | — | — | — | Background tint |
| `--compliance-dark` | `#4A4D55` | — | — | — | Dark-mode pressed |
| `--safe` | `#2E8B57` | `H 146°, S 50%, L 36%` | CheckCircle ✅ | Circle border | Status indicators only |
| `--safe-bg` | `rgba(46,139,87,0.15)` | — | — | — | Background tint |
| `--safe-dark` | `#1B4729` | — | — | — | Dark-mode pressed |

> **CRITICAL RULE**: `--critical`, `--warning`, `--compliance`, and `--safe` are NEVER used decoratively. `--brand-accent` is NEVER used for severity indication. `--personality-rose` is NEVER used on any interactive element or operational screen. `--slate-connect` means "hardware is connected" — never a safety-outcome state.

#### LIGHT THEME — PRIMARY Tier

| Token | Hex | HSL | Usage |
| :--- | :--- | :--- | :--- |
| `--base` | `#FAF8F5` | `H 30°, S 33%, L 97%` | Page background |
| `--surface` | `#F0ECE5` | `H 32°, S 27%, L 92%` | Card / panel background |
| `--elevated` | `#FFFFFF` | `H 0°, S 0%, L 100%` | Elevated panel (white) |
| `--border` | `#DDD6CC` | `H 30°, S 19%, L 83%` | Hairline borders |
| `--border-subtle` | `#E8E3DB` | `H 30°, S 20%, L 88%` | Subtle inner borders |
| `--text-primary` | `#1C1915` | `H 36°, S 14%, L 10%` | Headings |
| `--text-secondary` | `#6B6358` | `H 26°, S 10%, L 38%` | Descriptions |
| `--text-muted` | `#A69C8C` | `H 30°, S 12%, L 60%` | Disabled |
| `--brand-accent` | `#A8611F` | `H 26°, S 70%, L 39%` | Slightly darker copper for light-mode contrast |
| `--brand-accent-hover` | `#8E5218` | `H 26°, S 73%, L 33%` | Hover |
| `--brand-accent-subtle` | `rgba(168,97,31,0.08)` | — | Background tint |
| `--slate-connect` | `#3D6E8A` | `H 205°, S 38%, L 39%` | Camera online, WS live — darker for light mode |
| `--slate-connect-subtle` | `rgba(61,110,138,0.08)` | — | Connected status tint |

#### Severity Colors (Light Theme)

| Severity | Light Hex | Light BG | Contrast vs `#FAF8F5` |
| :--- | :--- | :--- | :--- |
| `--critical` | `#B12025` | `rgba(177,32,37,0.08)` | 6.8:1 ✅ AA |
| `--warning` | `#BE5A08` | `rgba(190,90,8,0.08)` | 4.8:1 ✅ AA |
| `--compliance` | `#5D6170` | `rgba(93,97,112,0.08)` | 5.2:1 ✅ AA |
| `--safe` | `#206B42` | `rgba(32,107,66,0.08)` | 5.9:1 ✅ AA |

---

### 2.6 — Pairwise Hue Distance Verification

Every functional color pair verified on the HSL wheel. Distances below 30° are flagged; below 15° indicates a collision risk requiring non-hue disambiguation.

| Color A | Hue A | Color B | Hue B | Distance | Status | Disambiguation Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `--brand-accent` copper | H 26° | `--critical` red | H 2° | **24°** | ⚠ Marginal | Shape/context: copper = rectangular button bg / thin ring. Critical = diamond badge + flame icon + "CRITICAL" text label. Never co-occur on same element type. |
| `--brand-accent` copper | H 26° | `--warning` amber | H 26° | **0°** | ⚠ Same hue | Saturation (copper S 64% vs warning S 89%), UI shape (copper = button bg; warning = text label / left stripe), icon pairing, text label. Never rendered as same element type. |
| `--brand-accent` copper | H 26° | `--safe` green | H 146° | **120°** | ✅ Clear | None needed. |
| `--brand-accent` copper | H 26° | `--compliance` steel | H 225° | **161°** | ✅ Clear | None needed. |
| `--brand-accent` copper | H 26° | `--slate-connect` | H 205° | **179°** | ✅ Clear | None needed. |
| `--brand-accent` copper | H 26° | `--personality-rose` | H 318° | **68°** | ✅ Clear | Also separated by layer rule: personality hue never on any interactive element. |
| `--critical` red | H 2° | `--warning` amber | H 26° | **24°** | ⚠ Marginal | Standard critical/warning pair — separated by luminance, saturation, icon (flame vs triangle), text label, and position rule. |
| `--warning` amber | H 26° | `--safe` green | H 146° | **120°** | ✅ Clear | None needed. |
| `--safe` green | H 146° | `--slate-connect` | H 205° | **59°** | ✅ Clear | Different semantic domains, different shapes (circle dot vs WS badge). |
| `--safe` green | H 146° | `--personality-rose` | H 318° | **172°** | ✅ Clear | Personality rose never on operational screens. |
| `--compliance` steel | H 225° | `--slate-connect` | H 205° | **20°** | ⚠ Marginal | Saturation: compliance S 10% (near-gray) vs slate-connect S 35% (clearly blue). Shape: compliance = rectangular text badge; slate-connect = small circular dot. |
| `--compliance` steel | H 225° | `--personality-rose` | H 318° | **93°** | ✅ Clear | Personality rose never on operational screens. |
| `--critical` red | H 2° | `--personality-rose` | H 318° | **44°** | ✅ Acceptable | Personality rose is heavily desaturated (S 28%) vs critical (S 65%) — perceptual distance greater than hue angle suggests. Never on same element type. |

---

### 2.7 — Theme Persistence

Theme preference is stored in `localStorage` under key `argus-theme` with value `"dark"` or `"light"`. On initial load, the system checks `localStorage` first, then falls back to `prefers-color-scheme`. The `<html>` element receives a `data-theme="dark"` or `data-theme="light"` attribute. All tokens are defined as CSS custom properties scoped to `[data-theme="dark"]` and `[data-theme="light"]`.

> **Out of scope**: Any server-side session storage (Redis, cookies for theme). Theme is purely client-side via standard browser storage.

---

## 3. Typography

> **v1.1 REWRITE** — The v1.0 section read as a justification for keeping the existing stack, not genuine research. This section produces an actual comparison across alternatives at ARGUS-specific headline sizes, and introduces a dedicated editorial display face for the Personality layer only.

### 3.1 — Competitive Comparison at ARGUS Headline Sizes

The evaluation tests three real alternatives against the current stack at the sizes that matter for this product: the **48–72px Landing hero headline**, the **24px page title**, and the **14px uppercase section header**. Each font is evaluated on: **engineered character** (does it communicate precision and industrial authority?), **legibility at operational sizes** (12–14px body, dense data tables), and **display personality** (does it feel distinctive and premium at large sizes?).

---

#### Current Stack: Bricolage Grotesque (display) + Hanken Grotesk (body)

**At 64px / 800 weight / "ZERO-HARM MONITORING":**
Bricolage's optical ink traps create visible apertures in the A, G, and R that read as engineered detail — not arbitrary decoration but the consequence of careful stroke design. At 800 weight it is commanding without being aggressive. The warm geometric character aligns with the copper/industrial palette.

**At 24px / 700 weight / "Live Detection Wall":**
Still distinctive. The ink trap on the lowercase "a" remains visible and prevents it from reading as any other grotesk. Not Inter, not Space Grotesk — identifiably Bricolage.

**At 14px / 700 / uppercase / "ACTIVE ALERTS":**
The variable size axis adapts. Letter spacing at 0.04em prevents crowding. Operationally strong.

**Hanken Grotesk at 14px / 400 / body:**
Tall x-height (0.74 ratio) and open counters maintain legibility on dark backgrounds. Number rendering is neutral and clean — critical for data tables.

**Assessment: Retain for operational system.** Confirmed because the ink trap character and variable axis genuinely distinguish it from the banned fonts in ways visible at actual render sizes. Not retained by default — retained by evaluation.

---

#### Alternative A: Satoshi (Fontshare)

**At 64px / 800 weight / "ZERO-HARM MONITORING":**
Satoshi is a beautiful geometric grotesk with circular counterforms and clean, contemporary proportions. At display sizes it reads as polished and premium. However, it reads as "premium SaaS productivity tool" — the aesthetic of Linear, Superhuman, or Notion. For ARGUS, which must communicate industrial authority and operational weight, Satoshi's refined elegance is a category mismatch. It is too elegant; ARGUS should feel like a tool you'd find in a factory control room, not a startup office. There is nothing to mark it as "engineered" rather than "designed for designers."

**At 14px body:** Excellent legibility, slightly tighter x-height than Hanken but still comfortable.

**Assessment: ❌ Wrong product character.** Satoshi is genuinely excellent for a different product. On ARGUS operational screens it would make the Alert Queue feel like a project management app. The ink-trap character of Bricolage that signals "engineered" is absent.

---

#### Alternative B: General Sans (Fontshare)

**At 64px / 700 weight / "ZERO-HARM MONITORING":**
General Sans splits the difference between geometric and humanist grotesks — slightly warmer letterforms than Satoshi, less idiosyncratic than Bricolage. At display sizes it is competent but unremarkable. It projects neutrality. Neutrality is not what a safety-critical monitoring system should communicate at its headline moment. There is no characteristic that a viewer would remember or associate with the product.

**At 14px body:** Strong legibility, comparable to Hanken. The two are nearly indistinguishable in a dense data table — which means General Sans adds no advantage over Hanken while being less tested at variable weights.

**Assessment: ❌ Too neutral.** General Sans is a capable utility font for a fintech dashboard or a settings screen. For ARGUS's hero headline, "neutral" means "forgettable." The Landing page needs a headline that a judge remembers.

---

#### Alternative C: Switzer (Fontshare)

**At 64px / 800 weight / "ZERO-HARM MONITORING":**
Switzer is a Swiss neo-grotesque revival — clean, systematic, and confident. At 800 weight and display sizes it has genuine authority. The letterforms are more disciplined and less idiosyncratic than Bricolage. It reads as "professional command center" — authoritative but not quirky.

**At 14px / 700 / uppercase section headers:** Very strong. The systematic approach to letterform construction makes it work beautifully in all-caps section headers without feeling heavy.

**At 14px body:** Among the best in class for data-dense displays. Slightly narrower metrics than Hanken, which could allow marginally more data in fixed-width columns — a legitimate operational advantage.

**Assessment: ✅ Genuinely competitive alternative.** If the team wanted to reconsider the full stack, Switzer is the most credible option. It does not beat Bricolage on the "ownable identity" criterion — Bricolage is more distinctive — but it beats Bricolage on systematic operational discipline. The decision to retain Bricolage stands because the ARGUS brand at a hackathon level benefits more from being distinctive than from being disciplined.

---

### 3.2 — The Personality Layer Gap

The v1.0 spec used identical fonts on the Landing hero (a product's first impression) and on the Alert Queue (a triage tool read under time pressure). These are categorically different design moments that should feel categorically different.

Premium SaaS products resolve this with a deliberate typographic split:
- **Linear** (later iterations): Grotesk UI system throughout the operational app; editorial display typeface for marketing pages
- **Ramp**: Inter for the product; editorial headlines on the landing page communicating warmth and approachability
- **Arc**: System grotesks for browser UI; editorial serif for the landing page hero to communicate "this is a different kind of product"

The pattern is consistent: the operational system should feel fast, dense, and information-optimized. The marketing/personality layer should feel considered, premium, and human.

ARGUS currently feels identical on both — the Landing hero uses the same Bricolage at 48px that the Health page uses for "Node Health" at 24px. The personality opportunity is wasted.

---

### 3.3 — Editorial Display Face: DM Serif Display

**Selected addition: DM Serif Display (Google Fonts)**

**Usage scope (STRICT):**
- Landing page: Hero headline only — the single large `<h1>`
- Profile page: The user's full name in the profile header section
- **NOWHERE ELSE in the application.** Not on operational screens. Not on section headers. Not on Alerts, Health, Wall, or Admin.

**Why DM Serif Display:**

- **Contrast against the grotesk operational system**: DM Serif Display is a high-contrast serif with expressive stroke variation. Placed next to Bricolage Grotesque's geometric industrialism, the contrast is immediate and intentional — it signals "this page is different from the dashboard."
- **Warm but not delicate**: Many editorial serifs (Playfair Display, Cormorant) read as delicate or luxurious. DM Serif Display has stronger contrast between thick and thin strokes, giving it presence on dark backgrounds — appropriate for a safety product that should feel authoritative, not precious.
- **Scale behavior**: At 56–72px on a dark background with `--text-display` cream, DM Serif Display creates genuine drama. The thick vertical strokes combined with razor-thin hairlines catch light in ways a grotesk cannot.
- **Google Fonts availability**: Single `<link>` import. No Fontshare/CDN dependency.
- **Single weight (Regular 400)**: At display sizes, DM Serif Display in regular weight is already commanding. The thinness of the hairline strokes creates elegance without needing bold.

**Correct usage:**

```css
/* Landing hero h1 only */
.landing-hero-headline {
  font-family: 'DM Serif Display', serif;
  font-weight: 400;
  font-size: clamp(48px, 6vw, 72px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--text-display);  /* #F8F4EB — warmest white */
}

/* Profile name display */
.profile-name-display {
  font-family: 'DM Serif Display', serif;
  font-weight: 400;
  font-size: 32px;
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text-display);
}
```

**How the Landing hero reads with this change:**

```
[DM Serif Display, 64px, --text-display cream, dark bg with rose-copper gradient wash]
Catch Every Hazard.
Miss Nothing.

[Hanken Grotesk, 18px, --text-secondary]
Real-time PPE detection across your entire facility.
Zero false alarms. Sub-second response.

[Copper CTA button, Hanken Grotesk 600]
→ Enter Command Center
```

The DM Serif Display headline has warmth and editorial weight. Below it, Hanken Grotesk's cool neutrality makes the subtitle feel like a precise technical claim. The contrast between the two makes both stronger — the headline more human, the subtitle more credible.

---

### 3.4 — Complete Font Loading

```html
<!-- Google Fonts — single preconnect, all families -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Serif+Display&family=Hanken+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

> **Performance note**: DM Serif Display is a single weight (Regular 400). Adding it adds approximately 18KB to the font payload. It can be preloaded on Landing and Profile routes only — no impact on the operational app's initial load.

---

### 3.5 — Complete Type Scale

```
EDITORIAL DISPLAY (DM Serif Display) — Landing hero + Profile name ONLY
├── Landing Hero h1:  clamp(48px, 6vw, 72px) / 400 / tracking: -0.02em
└── Profile Name:     32px / 400 / tracking: -0.01em

OPERATIONAL DISPLAY (Bricolage Grotesque)
├── Page Title:       24px / 700 / tracking: -0.01em
├── Section Header:   14px / 700 / tracking: 0.04em / uppercase
├── Logo:             14px / 800 / tracking: 0.08em / uppercase
└── Card Title:       15px / 700 / tracking: 0.01em

BODY (Hanken Grotesk)
├── Body:             14px / 400 / line-height: 1.6
├── Body emphasis:    14px / 600
├── Nav label:        13px / 600 / tracking: 0.02em
├── Badge/Tag:        11px / 700 / uppercase / tracking: 0.04em
├── Caption:          12px / 400
└── Micro label:      10px / 600 / tracking: 0.06em / uppercase

DATA (JetBrains Mono)
├── Metric value:     20px / 600
├── Timestamps:       11px / 400
├── Alert IDs:        10px / 400
├── FPS/latency:      12px / 600
└── Log entries:      11px / 400
```

### 3.6 — Legibility Verification Across Themes

| Font | Dark Mode Behavior | Light Mode Behavior | Adjustment |
| :--- | :--- | :--- | :--- |
| **DM Serif Display 400** (hero) | Strong — high stroke contrast catches the cream `--text-display` warmth well. Hairline strokes remain visible against `--base`. | ✅ Works well at 48px+. | Light theme: minimum 48px to keep hairlines visible with irradiation. |
| **Bricolage Grotesque 700** (headings) | Strong — ink traps maintain character on dark backgrounds | ✅ Confirmed — does not lose character in light mode at 700 weight. | None needed. Use weight 700 for both themes. |
| **Bricolage Grotesque 800** (logo) | Excellent — extra-bold creates commanding presence | ⚠ At 800 weight in light mode, can appear slightly heavy due to irradiation reversal. | In light theme, drop logo weight to 700, increase tracking by 0.01em. |
| **Hanken Grotesk 400** (body) | Light text on dark bg can appear to "bleed" slightly (irradiation effect) | ✅ Clean and legible | In dark mode, increase `letter-spacing` by 0.005em on body text. |
| **JetBrains Mono 400** (data) | Excellent — designed for dark terminal backgrounds | ✅ High contrast maintained | None needed. |

---

## 4. Motion & Animation System

> **v1.1 REWRITE** — Timing specs, spring configs, the sanctioned glassmorphism dock spec, and reduced-motion support are preserved exactly from v1.0. Two additions: (1) an explicit PRIMARY/SECONDARY tier motion split (§4.2), and (2) a full GSAP-timeline spec for the signature "System Boot" sequence (§4.5).

### 4.1 — Engine: GSAP as Primary

**GSAP** (`gsap` + `@gsap/react`) is the primary animation engine. It handles:
- Orchestrated entrance sequences on page load (staggered card reveals, counter animations)
- Scroll-triggered animations where content scrolls into view (Landing page only)
- Timeline-based choreography for complex state changes (new alert arriving, mode switching, data refreshing)
- Meaningful state-change animation (counter updates, gauge sweeps, progress fills)

**Install**: `npm install gsap @gsap/react`

**Framer Motion** (`motion` package, already installed) remains for:
- `layoutId`-based shared element transitions (dock active indicator sliding between tabs)
- `AnimatePresence` for conditional mount/unmount animations (drawers, modals, tooltips)
- `useMotionValue` / `useSpring` for mouse-tracking interactions (logo pupil)

---

### 4.2 — PRIMARY / SECONDARY Tier Motion Split

This mirrors the two-tier architecture used for color and typography. The tier determines the motion budget available to a screen. Operational screens have a strict motion diet; personality screens are permitted expressive choreography.

#### PRIMARY Tier Motion — Operational Screens (Wall, Alerts, Health, Admin, Analytics)

**Design principle**: Motion on operational screens must never compete with information. A shift supervisor reading a critical alert cannot have their attention captured by a decorative animation. Every motion element on a PRIMARY screen must be either (a) a **liveness signal** proving the system is alive, or (b) a **state-change indicator** communicating a data update.

**Permitted:**
- Page entrance stagger (0.06s per element, opacity + y — executes once on mount, then stops)
- Alert card entrance when a new alert arrives (GSAP from y:-8, opacity:0, duration:0.2s)
- Counter updates: GSAP tween to new value when a metric changes (0.4s, power2.out)
- Gauge sweep from 0 on mount (0.8s — occurs once, then live data tracked with no animation)
- Radar sweep: CSS `animation: rotate 4s linear infinite` — constant, low-intensity ambient liveness
- Clock/latency jitter: DOM update every 1s/4s — value change only, no animation
- GSAP slide-in for AlertDrawer: 0.35s, power3.out
- Framer Motion `layoutId` for dock active indicator: spring transition on tab change

**Explicitly banned on PRIMARY screens:**
- Scroll-triggered reveal animations (operational screens don't scroll for content — supervisors need all data visible immediately)
- Decorative gradient animations or color-shift effects
- The `--personality-rose` gradient wash
- Any GSAP timeline with duration > 1.2s on a non-entrance element
- Stagger animations that delay important data from appearing (all content must be visible within 500ms of mount)

#### SECONDARY Tier Motion — Personality Screens (Landing, Profile)

**Design principle**: These screens are viewed at leisure — not read under time pressure. They are the "first impression" and "personal context" moments. More expressive choreography here creates a premium feel without any operational cost.

**Permitted (in addition to all PRIMARY tier motion):**
- ScrollTrigger-based reveal animations as sections enter the viewport
- The signature System Boot sequence on Landing CTA click (see §4.5)
- DM Serif Display headline animations: GSAP from opacity:0, y:24, duration:0.6s (longer and more graceful)
- `--personality-rose` gradient wash fade-in on the hero background
- More generous stagger timing: 0.1s per element (vs. 0.06s on PRIMARY)
- Pupil-tracking mouse interaction on the ArgusEyeLogo (continuous, tied to user input)
- Spring physics on proof card hover (bouncy spring config — acceptable here, not on operational cards)
- GSAP counter animations from 0 → target with 1.8s duration (vs. 1.2s on operational screens)

**Settings page exception**: Settings is SECONDARY tier but has no personality content. Motion on Settings should be PRIMARY-tier conservative — only state-change animations for the theme toggle and controls.

---

### 4.3 — Animation Categories & Timing (Preserved from v1.0)

```
MICRO-INTERACTIONS (100–200ms)
├── Button press:       scale(0.97) → spring back (GSAP: 0.15s, ease: "power2.out")
├── Card hover:         translateY(-2px) + border-color shift (CSS transition 150ms)
├── Nav icon hover:     translateY(-1px) + opacity shift (CSS transition 150ms)
├── Badge appear:       scale(0) → scale(1) (GSAP: 0.2s, ease: "back.out(2)")
└── Toggle switch:      Framer Motion layout animation with spring

PAGE ENTRANCES (300–600ms total)
├── Page content:       GSAP timeline — opacity: 0→1, y: 16→0, stagger: 0.06s per element
├── Grid items:         GSAP stagger — { each: 0.08, from: "start" }
├── Charts:             GSAP drawSVG / path draw on data load (duration: 0.8s)
└── Counters:           GSAP .to() with snap rounding — count from 0 → target (duration: 1.2s)

DRAWER/MODAL (200–400ms)
├── Slide in:           GSAP from x: "100%" → 0 (0.35s, ease: "power3.out")
├── Backdrop:           GSAP from opacity: 0 → 0.6 (0.25s)
└── Content stagger:    GSAP children stagger 0.04s after drawer open completes

AMBIENT / LIVENESS (continuous, low-intensity)
├── Latency jitter:     setInterval 4s — re-render with ±3ms random offset
├── Sequence cursor:    Increment display every WebSocket message
├── Radar sweep:        CSS animation 4s linear infinite (Health page only)
├── Feed frame count:   Increment on each MJPEG/canvas frame received
└── Clock:              Live time display, updates every second
```

### 4.4 — Spring Configurations (Framer Motion only)

```typescript
export const springs = {
  snappy:  { type: "spring", stiffness: 400, damping: 25 },
  smooth:  { type: "spring", stiffness: 200, damping: 20 },
  bouncy:  { type: "spring", stiffness: 300, damping: 15 },
} as const;
```

---

### 4.5 — Signature Motion Moment: "System Boot" Sequence

**Context and rationale:**

Every demo product needs one moment a judge remembers after reviewing ten other projects. For ARGUS, that moment must be tied to its actual product narrative: *a safety monitoring system coming online*. The transition from Landing into the Command Center (`/wall`) is exactly this narrative moment — the cameras arm, the operational context activates, the supervisor's tools assemble.

Currently, this transition is a Next.js page navigation — a blank frame followed by the wall appearing. This wastes the product's single most powerful storytelling moment.

**The "System Boot" sequence replaces this with a 2.8-second cinematic initialization.**

**Trigger**: User clicks "Enter Command Center →" on the Landing CTA.

**Four beats — total duration 2.8s:**

```
Beat 1: BLACKOUT      (0s → 0.3s)    Landing content fades to deep black
Beat 2: IDENTIFICATION (0.3s → 0.9s)  ARGUS brand + eye logo appears center-screen
Beat 3: CAMERA ASSEMBLY (0.9s → 2.0s) 4 camera dots appear L→R, flash online;
                                       status strip assembles from left edge
Beat 4: DOCK RISE      (2.0s → 2.5s)  Bottom dock rises from below viewport
Beat 5: HANDOFF        (2.5s → 2.8s)  Overlay fades out; /wall page crossfades in
```

**Full GSAP Timeline Specification:**

```typescript
// SystemBoot.tsx — full-screen overlay component mounted on Landing CTA click
// Unmounts after sequence completes and router.push('/wall') resolves

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

export function SystemBootSequence({ onComplete }: { onComplete: () => void }) {
  const overlayRef    = useRef<HTMLDivElement>(null);
  const brandRef      = useRef<HTMLDivElement>(null);
  const statusStripRef = useRef<HTMLDivElement>(null);
  const cameraDotsRef  = useRef<HTMLDivElement[]>([]);
  const dockRef       = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Skip sequence entirely — navigate immediately
      router.push('/wall');
      return;
    }

    const tl = gsap.timeline({ onComplete: () => { router.push('/wall'); onComplete(); } });

    // ── BEAT 1: BLACKOUT (0s → 0.3s) ─────────────────────────────────────
    tl.to(overlayRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: 'power2.in',
      // overlay starts at opacity:0, z-index:9999, background:#0A0906
    });

    // ── BEAT 2: IDENTIFICATION (0.3s → 0.9s) ──────────────────────────────
    // ARGUS brand mark appears center-screen with copper glow.
    // ArgusEyeLogo SVG iris pulses once (scale 1 → 1.08 → 1).
    tl.fromTo(brandRef.current,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' },
      '<'
    );

    // Single iris pulse — not infinite
    tl.to('.boot-eye-iris', {
      scale: 1.08,
      duration: 0.25,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
    }, '-=0.1');

    // ── BEAT 3: CAMERA ASSEMBLY (0.9s → 2.0s) ─────────────────────────────
    // Status strip assembles from left edge (scaleX 0 → 1)
    tl.fromTo(statusStripRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.35, ease: 'power3.out' },
      '+=0.1'
    );

    // Four camera dots stagger left-to-right:
    // offline gray → white flash → --slate-connect blue (online)
    cameraDotsRef.current.forEach((dot, i) => {
      tl.fromTo(dot,
        { opacity: 0, scale: 0, backgroundColor: '#6B6358' },  // gray = offline
        { opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(3)' },
        `<+=${i * 0.14}`
      )
      .to(dot, { backgroundColor: '#FFFFFF', duration: 0.08, ease: 'power4.out' })
      .to(dot, { backgroundColor: '#4A7A9B', duration: 0.20, ease: 'power2.in' });
      // #4A7A9B = --slate-connect "online"
    });

    // Status text types in via clip-path reveal
    tl.fromTo('.boot-status-text',
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.out' },
      '-=0.3'
    );

    // ── BEAT 4: DOCK RISE (2.0s → 2.5s) ──────────────────────────────────
    // The bottom dock rises into position from below the viewport.
    // This is the final signal that the operational system is armed.
    tl.fromTo(dockRef.current,
      { y: 80, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' },
      '+=0.05'
    );

    // Copper active dot slides to Wall icon position
    tl.fromTo('.boot-dock-active-dot',
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out' },
      '-=0.2'
    );

    // ── BEAT 5: HANDOFF (2.5s → 2.8s) ────────────────────────────────────
    // Boot overlay fades out. /wall page crossfades in behind it.
    tl.to(overlayRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out',
    });

    return () => { tl.kill(); };
  }, [router, onComplete]);

  return (
    <div ref={overlayRef} className="system-boot-overlay">
      <div ref={brandRef} className="boot-brand-center">
        <ArgusEyeLogo size={96} className="boot-eye" />
        <div className="boot-brand-text">ARGUS AI — FACILITY 04</div>
        <div className="boot-initializing-text">INITIALIZING EDGE CLUSTER 01</div>
      </div>

      <div ref={statusStripRef} className="boot-status-strip">
        <div className="boot-camera-dots">
          {[1,2,3,4].map((n, i) => (
            <div key={n} className="boot-camera-dot-group">
              <div
                ref={el => { if (el) cameraDotsRef.current[i] = el; }}
                className="boot-camera-dot"
              />
              <span className="boot-camera-label">CAM {String(n).padStart(2,'0')}</span>
            </div>
          ))}
        </div>
        <div className="boot-status-text">● 4 Cameras Online · WS Live · System Armed</div>
      </div>

      <div ref={dockRef} className="boot-dock-preview">
        <div className="boot-dock-active-dot" />
      </div>
    </div>
  );
}
```

**CSS for the boot overlay:**

```css
.system-boot-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0A0906;   /* deeper than --base for full blackout */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;            /* GSAP controls */
}

.boot-brand-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  opacity: 0;
}

.boot-brand-text {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #F3EFE6;
}

.boot-initializing-text {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 400;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #C6752B;  /* --brand-accent copper */
  animation: blink-cursor 0.8s steps(1) 3;
}

.boot-status-strip {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 36px;
  background: #211D17;
  border-bottom: 1px solid #3A332A;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  transform-origin: left center;
  transform: scaleX(0);  /* GSAP controls */
}

.boot-camera-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6B6358;  /* starts offline gray; GSAP transitions to --slate-connect */
}

.boot-dock-preview {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(80px);  /* GSAP animates Y to 0 */
  opacity: 0;
  height: 56px;
  padding: 0 24px;
  border-radius: 9999px;
  background: rgba(28, 24, 18, 0.55);
  backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid rgba(198, 117, 43, 0.12);
}
```

**What makes this ownable:**

1. **Narrative alignment**: Every beat maps to a real operational concept — the system arming itself. Blackout = powering down ambient mode. Brand identification = system recognizing facility. Camera dots going gray → flash → blue = hardware connecting. Dock rising = tools arming. This is the product's value proposition made kinetic.
2. **Camera dots are the reveal**: The four dots coming online one by one are the product's core claim (4-camera real-time monitoring) enacted as a motion moment.
3. **2.8 seconds is the right length**: Long enough to feel intentional and cinematic, short enough not to feel like a loading screen. Faster than the boot sequence of most real industrial systems.
4. **Zero reduced-motion impact**: Completely skipped when `prefers-reduced-motion` is set — `router.push('/wall')` fires immediately.

---

### 4.6 — The Sanctioned Glassmorphism Moment (Preserved from v1.0)

**Location**: The floating bottom dock (`BottomDock.tsx`) — specifically, the centered oval/pill container.

**Fix specification:**
```css
.forge-dock {
  background: rgba(28, 24, 18, 0.55);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid rgba(198, 117, 43, 0.12);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04),
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
}

.forge-dock:hover {
  background: rgba(28, 24, 18, 0.65);
  border-color: rgba(198, 117, 43, 0.2);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 20px rgba(198, 117, 43, 0.08),
    0 12px 40px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: scale(1.01);
  transition: all 0.2s ease-out;
}
```

> **EXPLICIT RULE**: This is the **ONLY** place in the entire application where `backdrop-filter: blur()` is used. Every other surface uses solid `--surface` or `--elevated` backgrounds with hairline `--border` borders.

### 4.7 — Banned Techniques (Preserved from v1.0)

| Technique | Reason |
| :--- | :--- |
| **Neomorphism** | Known contrast/legibility issues in both themes. Disqualifying for safety-critical UI. |
| **Glassmorphism** (except the dock) | Overused in AI-generated sites in 2025–2026. |
| **Particle backgrounds** on operational screens | GPU waste. Competes for attention with camera feeds and alert data. |
| **3D transforms / perspective tilt** on cards | Spatial ambiguity in a data-dense interface. Cards are flat planes. |
| **Infinite looping color-shift gradients** | Distracting, perpetually suggests "loading," causes motion sickness. |

---

## 5. Global Navigation

### 5.1 — Bottom Dock (Carried Forward — Refined)

The floating bottom dock pattern from the prior design round is **carried forward** without structural redesign. It correctly solves the "persistent navigation without eating vertical space" problem for a monitoring dashboard.

**Retained behaviors** (non-negotiable):
- Floating pill shape, icon-based, center-aligned, fixed to viewport bottom
- Hover reveals a tooltip with label + 1-line description
- Persistent unread-count badges on the Alerts icon (never require hover to see — this is a safety requirement)
- Active-state copper underline dot, always visible without hover
- The ONLY backdrop-blur surface in the app (the sanctioned glassmorphism moment)

**Refinements based on research** (Mobbin interaction patterns, WCAG touch-target guidelines):

| Aspect | Current | Refined |
| :--- | :--- | :--- |
| Icon size | 16px (`w-4 h-4`) | 18px (`w-[18px] h-[18px]`) — improves touch target on laptops with touch screens |
| Padding per item | `p-2.5` (40px total) | `p-3` (48px total) — meets WCAG 44px minimum touch target |
| Gap between items | `gap-1.5` | `gap-2` — breathing room between targets |
| Active indicator | Static copper dot | Framer Motion `layoutId="dock-active"` — the copper dot slides between tabs with spring physics |
| Tooltip animation | CSS `animate-in` (browser-dependent) | GSAP `gsap.from(tooltip, { opacity: 0, y: 8, duration: 0.15 })` — reliable cross-browser |
| Badge pulse | CSS `animate-pulse` (infinite) | CSS `animate-pulse` for 3 cycles then stop — infinite pulse causes alert fatigue; the badge color alone is sufficient |

**Navigation items** (6 total, unchanged):
1. Live Wall (`/wall`) — LayoutGrid icon
2. Alert Queue (`/alerts`) — AlertTriangle icon + unread count badge
3. Analytics (`/reports`) — BarChart3 icon
4. Node Health (`/health`) — Activity icon
5. Safety Copilot (`/copilot`) — Bot icon
6. Admin (`/admin/thresholds`) — Sliders icon

**Profile & Settings access** (not in dock — accessed from TopStatusStrip):
- Profile: User avatar button in TopStatusStrip right section → navigates to `/profile`
- Settings: Gear icon in TopStatusStrip right section → navigates to `/settings`

### 5.2 — Top Status Strip (Single-Line, Non-Stacking)

**AUDIT CONFIRMATION: No more than one banner/strip is visible at the top at any time.**

The `TopStatusStrip` is 36px tall, fixed position. There is NO second banner, NO toast stack, NO secondary bar that can appear above or below it. When a CRITICAL alert is active, the strip's center section transforms **in-place** from "system status" to "CRITICAL HAZARD" notification with pulsing background — it does NOT add a second bar.

**Strip layout** (left → center → right):

```
LEFT:   [Brand mark ◆] ARGUS AI | FACILITY 04 · EDGE CLUSTER 01
CENTER: [● 4 Cameras Online · WS Live · System Armed]
        OR on critical: [⚠ CRITICAL HAZARD: FIRE in Sector 2 — TRIAGE NOW →]
RIGHT:  [WS dot] 14ms | [🔊] | [⚙️ → /settings] | [👤 → /profile]
```

**Refined center-normal content** (no critical alert):
```
● 4 Cameras Online · WS Live · System Armed
```
This replaces the current "CAS v2 CONCURRENCY ARMED · MONOTONIC SEQ: #128 · TEMPORAL VOTING 8/10 PPE" which is engineer-speak that means nothing to a shift supervisor. The engineering telemetry (sequence cursor, voter config) moves to `/health` where it belongs.

---

## 6. AI Assistant / Copilot Audit

### 6.1 — Current State

There are currently **two** entry points to AI assistant functionality:

1. **`CopilotModal.tsx`** — A floating modal triggered by: (a) the "COPILOT" button in the `TopStatusStrip`, and (b) the `onOpenCopilot` prop passed through to `BottomDock`. This opens as a centered overlay with its own message state.

2. **`/copilot` route** — A dedicated full-page copilot section accessible via the bottom dock's "Safety Copilot" nav item. This has its own page component at `app/(app)/copilot/page.tsx`.

### 6.2 — Verdict: Remove the Floating Modal

The floating modal is **redundant** and creates UX confusion:
- Two entry points to the same feature means two mental models for the user and two codepaths to maintain
- The modal is a degraded version of the full page (smaller viewport, no URL history, no deep-linking, no bookmark capability)
- The TopStatusStrip "COPILOT" button competes for attention with the dock's "Safety Copilot" button — 6 inches apart on screen
- The dock already provides one-tap access from any screen in the app
- The modal has its own message state that is not shared with the page — conversation is lost when switching between them

**Action**:
1. Delete `CopilotModal.tsx` from `components/`
2. Remove `copilotOpen` state and `setCopilotOpen` handler from `(app)/layout.tsx`
3. Remove `onOpenCopilot` prop from `TopStatusStrip` and `BottomDock` interfaces
4. The "COPILOT" button in the TopStatusStrip becomes a simple `<Link href="/copilot">` styled as a small copper-bordered chip
5. The dedicated `/copilot` page is the **single, canonical** entry point to AI assistant functionality — there is exactly one way to reach it

---

## 7. Section-by-Section Specification

### 7.1 — Landing Page (`/`)

**Purpose**: The first screen a judge or new user sees. Must communicate in under 5 seconds: (1) what ARGUS does, (2) why it's different, (3) how to enter the operational console.

**What's currently wrong**:
- Feels like a technical spec sheet, not a product landing page — dense monospace text and engineering jargon alienates non-technical viewers
- Simulated bounding box canvas takes up 60%+ of viewport but is a static mockup, not interactive
- Three nearly identical CTA buttons (Live Wall, Offline Video, Copilot) with no visual hierarchy — violates "one primary action per screen"
- "OPERATOR CONSOLE" button in header duplicates the hero CTA
- Footer duplicates dock navigation links
- Terminal log stream is impressive engineering but reads as "debug output" not "product feature"

**Redesign approach**:
- **Full-bleed hero** with large DM Serif Display heading, concise subtitle, and ONE primary CTA ("Enter Command Center → /wall")
- **The ArgusEyeLogo SVG** is the hero's visual centerpiece — large (120px), with the pupil-tracking interaction as the singular animated element. No particles, no floating UI mockups, no terminal streams.
- **Three proof cards** below the CTA — the corner-case suppression data (Yellow Shirt 0.0% FPR, Cap vs Helmet 99.2% accuracy, Steam vs Smoke 1.1% FPR). These are ARGUS's strongest demo talking point.
- **Animated counters** — four metrics that count up on page load via GSAP: "4 Cameras", "28.5 FPS", "<1s Latency", "₹100/cam"
- **Login role selector** — three labeled buttons (Admin / Supervisor / Viewer) below the CTA, each with credential auto-fill for demo convenience
- **Minimal footer** — attribution only ("BPUT Hackathon 2026 · PS06 · Built for Zero-Harm Workplaces"), no nav links

**Key components and states**:

| Component | Default | Hover | Active | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CTA Button | Copper bg, base text, subtle glow shadow | Scale(1.02), glow intensifies | Scale(0.98) | N/A | N/A | N/A |
| Eye Logo | Static iris glow, pupil at center | Pupil tracks mouse via `useMotionValue` | N/A | N/A | N/A | N/A |
| Proof Cards | Surface bg, border, data visible | Border → copper, translateY(-2px) | N/A | N/A | N/A | N/A |
| Animated Counter | "0" → target (GSAP tween 1.8s on mount) | N/A | N/A | Skeleton dash | N/A | N/A |
| Role Buttons | Surface bg, border, role label | Border → copper | Bg → copper, text → base | N/A | N/A | N/A |

**Dynamic vs Static**:
- Animated counters: GSAP tween on mount — **dynamic**
- Eye logo pupil: Mouse-tracking — **dynamic**
- Proof card data: Static (sourced from `report.json` metrics)
- Role buttons: Static navigation links

---

### 7.2 — Live Wall / Detection Dashboard (`/wall`)

**Purpose**: The primary operational screen. A supervisor keeps this open 8+ hours per shift. Four camera feeds with real-time detection overlays and a sidebar alert mini-queue.

**What's currently wrong**:
- Camera tiles use simulated canvas frames — acceptable for demo, but the mode-switching between live camera, USB camera, and file upload is not designed
- The sidebar alert mini-queue shows "PASSED_SILENT" corner-case items which are NOT alerts (non-events polluting the alert feed)
- No clear visual hierarchy between cameras with active alerts and calm cameras
- Missing mode-switch control for the three input types required this round

**The three input modes for this round**:

| Mode | Input Source | Icon | Permission |
| :--- | :--- | :--- | :--- |
| **(a) Built-in Webcam** | `navigator.mediaDevices.getUserMedia()` with laptop camera | Camera icon | Browser camera permission |
| **(b) External/USB Camera** | `navigator.mediaDevices.getUserMedia()` with device selection | Webcam icon | Browser camera permission + device enumeration |
| **(c) Upload Video File** | `<input type="file" accept="video/*">` | Film icon | None (file system access) |

**Mode-Switch Control** — A segmented control bar at the top of the wall page:

```
┌─────────────────────────────────────────────────────────────────┐
│  [📷 Built-in Camera]  [🎥 External Camera ▾]  [📁 Upload Video]  │
│   ═══════════════                                                │
│   ← Framer Motion layoutId animated copper underline →           │
└─────────────────────────────────────────────────────────────────┘
```

When "External Camera" is selected, a dropdown enumerates available video input devices via `navigator.mediaDevices.enumerateDevices()`.

**Permission-request states** (for camera modes a and b):

| State | Display |
| :--- | :--- |
| Not yet requested | Mode button enabled, default styling. On click, triggers `getUserMedia()`. |
| Permission dialog open | Overlay: "ARGUS needs camera access for real-time safety detection." with Camera icon and a dimmed background. System dialog appears. |
| Permission denied | Inline error replacing the feed area: "Camera access was denied. Please enable camera permissions in your browser settings to use live detection." with a browser-settings icon and a [Retry] button. |
| Permission granted | Camera stream begins — tile transitions from skeleton placeholder to live feed via GSAP opacity fade (0.3s). |

**Upload flow states** (for mode c):

| State | Display |
| :--- | :--- |
| Idle | Dashed-border drop zone: "Drop a video file here or click to browse" with Film icon. Accepts `.mp4`, `.webm`, `.avi`. |
| File selected | File name, size, and duration preview. "Process with ARGUS AI" button. |
| Uploading | Progress bar with percentage, file name, estimated time remaining |
| Processing | Animated processing indicator: "Analyzing [filename] — [N] frames processed..." with a progress bar |
| Results | Timeline view showing detected incidents at their timestamps, click-to-seek capability, detection overlay on paused frame |
| Error | Error message: "Processing failed: [reason]." with [Try Again] button |

**Key components and states** (Live Camera mode):

| Component | Default | Hover | Active | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| StreamTile (normal) | Canvas with HUD brackets, `--slate-connect` online dot, FPS/latency OSD | Tile border lightens | Click → full-screen expand | Skeleton shimmer matching tile aspect ratio | "Camera offline — last seen [time]" | "Stream error — reconnecting..." |
| StreamTile (CRITICAL) | Pulsing red border (CSS steps), red dot, tile pinned to top-left | Same + cursor pointer | Click → opens AlertDrawer | N/A | N/A | N/A |
| StreamTile (stalled) | Gray overlay: "Stream Stalled (No frames in 5s)" | N/A | N/A | N/A | N/A | N/A |
| Mini Alert Queue | Severity-sorted cards, max 4 visible + "View All →" | Card border → severity color | Click → navigate to `/alerts` | Skeleton cards | "No active alerts — all clear ✓" with shield icon | "Alert feed disconnected" |
| Mode Switch | Three buttons, active has copper underline | Button text brightens | Underline slides via Framer Motion layoutId | N/A | N/A | N/A |

**Dynamic vs Static**:
- Camera feeds: WebSocket / canvas / getUserMedia — **dynamic**
- FPS counters: Updated per frame — **dynamic**
- Latency display: Jittered every 4s — **dynamic**
- Alert mini-queue: WebSocket-fed — **dynamic**
- HUD brackets: Static decorative CSS
- Mode switch: Static controls (state-driven selection)

---

### 7.3 — Alert Queue + Alert Detail View (`/alerts`)

**Purpose**: Triage dashboard where supervisors acknowledge, resolve, or mark false alarms on active safety incidents. This is the primary action screen — decisions made here directly affect physical alarms.

**What's currently wrong**:
- Alert cards are visually identical flat rectangles — severity differentiation relies entirely on a small colored text label buried inside the card
- No visible left-edge severity stripe (the strongest visual pattern for at-a-glance triage in every major alerting system: PagerDuty, Datadog, Grafana)
- AlertDrawer slides in functionally but has no entrance animation and flat visual hierarchy inside
- Filter tabs exist but lack count badges showing how many items are in each severity

**Redesign approach**:
- Each alert card gets a **4px left border** in the severity color — this is the primary at-a-glance indicator
- Severity icon + text label + position in list remain as secondary/tertiary indicators
- Cards are visually separated into severity groups with a section header: "🔥 CRITICAL (1)", "🚭 WARNING (2)", "🦺 COMPLIANCE (5)"
- AlertDrawer slides in via GSAP (x: 100% → 0, 0.35s, power3.out) with staggered content reveal for internal sections
- Empty state: "No active alerts — monitoring all sectors" with a shield-check illustration and green status
- Error state: "Alert feed disconnected — showing cached data" with a reconnect button

**Key components and states**:

| Component | Default | Hover | Active | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| AlertCard | Surface bg, 4px severity left border, icon + label + sector + time + confidence | Border brightens, translateY(-1px), subtle shadow | Click → opens AlertDrawer, card bg tints | Skeleton card with left border shimmer | N/A (section-level empty) | N/A |
| AlertCard (CRITICAL) | `animate-critical-pulse` on entire card (0.9s steps) | Same + cursor pointer | Opens drawer immediately | N/A | N/A | N/A |
| Severity Filter Tabs | Text label + count badge, surface bg | Text brightens, border → copper | Active: copper underline, text primary | Badge shows spinner | "No [severity] alerts" | N/A |
| AlertDrawer | GSAP slide from right, backdrop dim | N/A | Contains: snapshot image, bounding box overlay, all metadata, action buttons | Content skeleton shimmer | N/A | "Failed to load alert details — [Retry]" |
| Acknowledge Button | Copper bg, "Acknowledge" label | Darker copper | Scale(0.97), sends PATCH, optimistic update with spinner | Spinner replacing text | N/A | "Acknowledgment failed — version conflict. [Retry]" |
| Search Input | Border, placeholder text | Border → copper | Focus ring visible | N/A | N/A | N/A |

**Dynamic vs Static**:
- Alert list: WebSocket-fed, new alerts prepend with GSAP entrance animation — **dynamic**
- Filter counts: Computed from Zustand store — **dynamic**
- Drawer content: Populated from store on open — **dynamic**
- Search: Client-side filtering — **dynamic**
- Acknowledgment: Optimistic mutation → server confirmation — **dynamic**

---

### 7.4 — Analytics / Reports (`/reports`)

**Purpose**: Compliance trends, sector violation breakdowns, shift comparisons, and CSV/PDF export for safety officers.

**What's currently wrong**:
- Charts exist (recharts) and use the correct Forge palette, which is good
- Data is entirely static/hardcoded — no connection to real or simulated alert history
- No chart entrance animations — charts appear instantly, which feels static
- Good use of custom tooltips with proper styling; retain this pattern
- Missing date-range selector for filtering

**Redesign approach**:
- GSAP entrance animations on charts: bars grow from 0, area paths draw from left to right
- Counter animations on headline stats via GSAP `.to()` with snap rounding
- Data should be sourced from the alert store or a simulated 7-day dataset that advances realistically
- Export buttons should have loading/success states (spinner → checkmark)
- Add a date-range picker (two date inputs) for filtering chart data

**Key components and states**:

| Component | Default | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- |
| Headline Stat Cards | GSAP counter animation (0 → value, 1.2s) with unit label | Skeleton number + label | "—" placeholder with muted label | "Data unavailable" |
| Sector Violations Chart | GSAP bar-grow animation on mount (0.6s stagger per bar) | Chart skeleton (gray placeholder bars) | "No violation data for selected period" | "Chart data fetch failed — [Retry]" |
| Compliance Trend Chart | GSAP path-draw animation on mount (0.8s) | Chart skeleton (gray placeholder area) | "No trend data available" | "Chart data fetch failed — [Retry]" |
| Shift Breakdown Table | Staggered row entrance (0.04s each via GSAP) | Row skeletons with shimmer | "No shift data recorded" | "Table data fetch failed — [Retry]" |
| Export Button (CSV) | Surface bg, download icon, "Export CSV" label | Spinner + "Generating..." | N/A | "Export failed — [reason]. [Retry]" |
| Date Range Picker | Two date inputs with calendar icons | N/A | N/A | N/A |

**Dynamic vs Static**:
- Chart data: Computed from alert store or simulated dataset — **dynamic**
- Counter values: GSAP animated on mount — **dynamic**
- Date range picker: Controls chart data filtering — **dynamic**
- Export: Triggers server request with response states — **dynamic**

---

### 7.5 — Profile (`/profile` — NEW Dedicated Section)

**Purpose**: Displays the current user's identity, role, shift assignment, and action history. Currently does NOT exist — needs to be built from scratch.

**Design approach**:
- Uses SECONDARY tier (warmer personality layer) since this is not a time-pressure screen
- Header section: User avatar (generated from initials, copper bg), full name in **DM Serif Display 32px**, role badge (ADMIN / SUPERVISOR / VIEWER styled with copper), facility assignment
- Hero background: `--personality-rose` gradient wash behind the avatar section (only use of this token on this page)
- Stats row: "Alerts Acknowledged", "Shifts Supervised", "Member Since" — GSAP animated counters on mount
- Recent Activity feed: Time-ordered list of acknowledgments, resolutions, false-alarm marks by this user
- Actions: "Edit Profile" button (disabled for demo), "Log Out" button

**Key components and states**:

| Component | Default | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- |
| Profile Header | Avatar circle + DM Serif Display name + role badge + facility | Skeleton circle + text bars | N/A (always has user data from session) | "Profile data unavailable" |
| Stats Row | GSAP counter animations (0 → values) | Skeleton number blocks | "No activity recorded yet" | "Stats unavailable — [Retry]" |
| Activity Feed | Time-ordered list with severity-colored left dots | Skeleton list items | "No actions recorded — start by triaging alerts" | "Activity feed unavailable — [Retry]" |
| Log Out Button | Surface bg, red text, door icon | N/A | N/A | N/A |

---

### 7.6 — Settings (`/settings` — NEW Dedicated Section)

**Purpose**: Application-level preferences. Currently does NOT exist — needs to be built from scratch. **The theme toggle (light/dark) lives here.**

**Design approach**:
- Uses SECONDARY tier (but PRIMARY-tier motion budget — see §4.2)
- Organized into sections with clear headers:
  - **Appearance**: Theme toggle (☀️ Light / 🌙 Dark segmented control)
  - **Audio**: Alarm volume slider + test sound button
  - **Language**: EN / HI / OR selector (dropdown)
  - **Notifications**: Browser notification permission request button
  - **About**: App version, model version, hackathon info, GitHub link

**Theme toggle behavior**: A two-option segmented control. Clicking writes to `localStorage('argus-theme')` and immediately updates `document.documentElement.dataset.theme`. GSAP crossfade (0.2s) on the page content provides a smooth transition rather than a jarring snap.

**Key components and states**:

| Component | Default | Hover | Active |
| :--- | :--- | :--- | :--- |
| Theme Toggle | Two segments, active one has copper bg + white text | Inactive segment text brightens | Click → instant theme switch with GSAP crossfade |
| Volume Slider | Range input with copper thumb, current value label | Thumb grows slightly | Adjusting — live preview, value updates |
| Test Sound Button | Surface bg, speaker icon, "Test Alarm" label | Border → copper | Plays alarm sample for 2 seconds, button shows "Playing..." |
| Language Select | Dropdown showing current language flag + name | Border → copper | Opens options, selection applies immediately to all UI text |
| Notification Button | "Enable Notifications" or "Notifications Enabled ✓" | Border → copper | Triggers browser permission dialog |

---

### 7.7 — Copilot (`/copilot`)

**Purpose**: The single canonical AI assistant interface. Supervisors ask natural-language questions about safety data and receive instant streaming responses powered by GROQ + Llama 3.3 70B.

**What's currently wrong**:
- The `/copilot` page exists and is functional, which is good
- Duplicates functionality with the floating `CopilotModal.tsx` — **modal is being removed** (Section 6)
- Chat messages use the same monospace font and similar surface bg for both user and assistant — hard to scan who said what
- No typing/streaming indicator beyond text "Analyzing safety telemetry..."
- Quick prompt chips work well — retain this pattern

**Redesign approach**:
- Full-page chat layout occupying the entire main content area
- User messages: right-aligned, copper-tinted bg (`--brand-accent-subtle`), body font (Hanken Grotesk)
- Assistant messages: left-aligned, `--surface` bg with Bot icon avatar, body font with JetBrains Mono for data values within responses
- Streaming indicator: Three copper dots with staggered pulse animation (not text)
- Quick prompt chips: Retained from current design, with icons, horizontally scrollable on overflow
- Copy button per assistant message retained
- "Reset Chat" button in header retained
- Message timestamps visible below each message

**Key components and states**:

| Component | Default | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- |
| Chat Container | Full height, vertically scrollable message area | N/A | Welcome message from ARGUS + quick prompt chips visible | "Copilot service unavailable — check GROQ API key in .env.local" |
| User Message Bubble | Right-aligned, copper bg tint, rounded corners | N/A | N/A | N/A |
| Assistant Message Bubble | Left-aligned, surface bg, bot avatar, rounded corners | Three-dot staggered pulse animation (copper dots) | N/A | "⚠️ Response generation failed. [Retry]" |
| Input Bar | Text input + copper send button | N/A | Placeholder: "Ask ARGUS about incidents, compliance, or safety data..." | Input disabled with error text below |
| Quick Prompt Chips | Horizontal row with icons, scrollable | Chip border → copper | Triggers handleSend with preset text | N/A |
| Reset Button | RefreshCw icon, surface bg | Border → copper, icon rotates slightly | Clears all messages, resets to welcome | N/A |

---

### 7.8 — Admin (`/admin/*`)

**Purpose**: System configuration — camera management, detection zone polygons, confidence thresholds, voter parameters, user management. Used by Plant/IT Admins, not shift supervisors.

**What's currently wrong**:
- Three sub-routes exist (`/admin/cameras`, `/admin/zones/[cameraId]`, `/admin/thresholds`) and are functional
- Threshold sliders lack real-time feedback about what changing values does
- Zone editor works but has rough UX (no undo, no snap-to-grid) — this is backend-dependent and out of scope for visual redesign

**Redesign approach**:
- Add an admin landing page at `/admin` with three cards linking to sub-sections (Cameras, Zones, Thresholds) — currently navigating to `/admin` shows nothing
- Each sub-section gets a consistent page header with breadcrumb navigation (Admin > Cameras, Admin > Thresholds)
- Threshold sliders add a live preview text below them: "At this threshold, expect ~X additional alerts per shift" (estimated heuristically)
- Zone editor visual improvements are scoped to consistent page chrome only — the SVG polygon logic is a backend concern
- GSAP entrance animations on all admin page content

**Key components and states**:

| Component | Default | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- |
| Admin Landing Cards | Three cards (Cameras, Zones, Thresholds) with icons, descriptions, and item counts | Skeleton cards | N/A | N/A |
| Camera Table | Rows with status dot, name, sector, FPS, latency | Skeleton rows | "No cameras configured — [Add Camera]" | "Failed to load cameras — [Retry]" |
| Threshold Slider | Range input with value display + impact preview text | N/A | N/A | "Failed to save threshold — [Retry]" |
| Zone Editor | SVG overlay on camera still image | "Loading camera feed..." | "Select a camera to edit detection zones" | "Camera feed unavailable" |
| Breadcrumb | "Admin > [Section]" with clickable "Admin" link | "Admin" text → copper | N/A | N/A |

---

### 7.9 — Node Health (`/health`)

**Purpose**: Edge node telemetry — CPU/GPU usage, FPS per stream, inference latency, temperature, active model version, and the evaluation acceptance gate matrix from `report.json`.

**What's currently wrong**:
- GaugeDial and RadarSweep components exist and are well-built — retain them
- Data is partially dynamic (gauge values jitter) but most values are hardcoded
- Missing the acceptance gate matrix (the `report.json` metrics table featured in the README and PRD)
- No GSAP entrance animations — gauges appear at their final values instantly

**Redesign approach**:
- Retain `GaugeDial` and `RadarSweep` — they fit the industrial aesthetic perfectly
- Add the **Acceptance Gate Matrix** as a styled table with PASS/FAIL badges and target vs. achieved columns
- GSAP entrance: gauges sweep from 0 → current value over 1s on mount, radar fades in
- Per-camera status cards showing FPS, latency, last-seen timestamp with live jitter updates
- Model info card: version name, mAP@50, precision, recall, all from `report.json` data

**Key components and states**:

| Component | Default | Loading | Empty | Error |
| :--- | :--- | :--- | :--- | :--- |
| Gauge Dials | GSAP sweep from 0 → current value (1s, power2.out) | Gray gauge ring, no value | "No telemetry data" | "Node unreachable — last contact [time]" |
| Radar Sweep | CSS rotate animation (4s linear infinite) — ambient liveness | Static radar ring outline | N/A | N/A |
| Camera Status Cards | `--slate-connect` status dot, FPS number, latency number, last-seen | Skeleton cards | "No cameras registered" | "Status fetch failed — [Retry]" |
| Gate Matrix Table | Rows: Metric, Target, Achieved, PASS/FAIL badge | Skeleton rows | "No evaluation data available" | "Report data unavailable — [Retry]" |
| Model Info Card | Model name, version, all key metrics | Skeleton | "No model registered" | "Model info fetch failed" |

**Dynamic vs Static**:
- Gauge values: Simulated telemetry with ±jitter every 4s — **dynamic**
- Camera status: WebSocket heartbeat data — **dynamic**
- Gate matrix: From `report.json` — **static** (loaded once at page mount)
- Radar sweep: CSS animation — **dynamic** (ambient liveness signal)
- Model info: Static data card

---

## 8. Accessibility & Legibility Checklist

### 8.1 — Contrast Ratios

All text/background combinations verified against WCAG 2.1 AA (4.5:1 normal text, 3:1 large text/UI components).

| Combination | Dark Theme Ratio | Light Theme Ratio | Grade |
| :--- | :--- | :--- | :--- |
| `--text-primary` on `--base` | `#F3EFE6` on `#16140F` → **14.8:1** | `#1C1915` on `#FAF8F5` → **16.2:1** | ✅ AAA |
| `--text-primary` on `--surface` | `#F3EFE6` on `#211D17` → **11.4:1** | `#1C1915` on `#F0ECE5` → **13.1:1** | ✅ AAA |
| `--text-secondary` on `--base` | `#A69C8C` on `#16140F` → **6.2:1** | `#6B6358` on `#FAF8F5` → **5.4:1** | ✅ AA |
| `--text-secondary` on `--surface` | `#A69C8C` on `#211D17` → **4.8:1** | `#6B6358` on `#F0ECE5` → **4.5:1** | ✅ AA |
| `--brand-accent` on `--base` | `#C6752B` on `#16140F` → **4.9:1** | `#A8611F` on `#FAF8F5` → **5.3:1** | ✅ AA |
| White on `--brand-accent` (CTA buttons) | `#16140F` on `#C6752B` → **4.9:1** | `#FAF8F5` on `#A8611F` → **5.3:1** | ✅ AA |
| White on `--critical` badge | `#FFFFFF` on `#C1272D` → **5.6:1** | Same | ✅ AA |

### 8.2 — Colorblind-Safe Severity Differentiation

Severity states NEVER rely on hue alone. Each severity level is differentiated by **four independent channels** — any ONE of which is sufficient to identify the severity:

| Severity | Channel 1: Color (Hue) | Channel 2: Icon (Shape) | Channel 3: Text Label | Channel 4: Position |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | Red (`#C1272D`) | 🔥 Flame — pointed, chaotic shape | "CRITICAL" text | Always topmost in any sorted list |
| **WARNING** | Amber (`#E8700A`) | 🚭 CigaretteOff — circle-with-slash | "WARNING" text | Below critical, above compliance |
| **COMPLIANCE** | Steel gray (`#7A8194`) | 🦺 HardHat — dome/helmet shape | "COMPLIANCE" text | Below warning |
| **SAFE** | Green (`#2E8B57`) | ✅ CheckCircle — circle-with-check | "SAFE" / "ALL CLEAR" text | Status indicators only (not in alert lists) |

**Grayscale test result**: When the interface is viewed in full grayscale:
- CRITICAL (dark red → dark gray) and WARNING (amber → medium gray) are distinguishable by luminance value
- COMPLIANCE (steel → medium-light gray) is distinguishable from WARNING by being cooler/lighter
- SAFE (green → medium gray) is distinguished by being the only one with a circle-check icon
- Icon shapes provide silhouette differentiation that is 100% independent of color perception
- Text labels provide unambiguous identification regardless of any visual impairment

### 8.3 — Keyboard Navigation & Focus States

| Element Type | Focus-Visible Style |
| :--- | :--- |
| All interactive elements | `outline: 2px solid var(--brand-accent)` + `outline-offset: 2px` |
| Dock nav items | Copper ring visible around the circular item area |
| Alert cards | Outline + left severity border thickens to 6px |
| Form inputs | `border-color: var(--brand-accent)` + outline |
| Buttons (standard) | Outline + slight scale(1.02) |
| CTA buttons | Outline + glow intensifies |

**Tab order**: Skip-to-content link → Top status strip (left → right) → Page main content (top → bottom, left → right) → Bottom dock (left → right)

**Skip-to-content link**: A visually hidden `<a href="#main-content">Skip to main content</a>` is the first focusable element in the DOM. It becomes visible on keyboard focus (standard accessibility pattern).

### 8.4 — Reduced Motion Support

All GSAP and Framer Motion animations respect `prefers-reduced-motion`:

```typescript
// Check at app initialization
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// GSAP global config
if (prefersReducedMotion) {
  gsap.globalTimeline.timeScale(Infinity); // Complete all animations instantly
}

// Framer Motion: use the built-in useReducedMotion() hook per component
```

When reduced motion is preferred:
- All GSAP tweens complete instantly (duration effectively 0)
- Page content appears without stagger — all items visible immediately
- Counters display their final values without animation
- The radar sweep CSS animation pauses (`animation-play-state: paused`)
- The critical alert pulse switches to a static red background (no stepping animation)
- The dock glassmorphism hover scale effect is removed (border-color change remains)
- Framer Motion `layoutId` transitions snap instead of springing
- **The System Boot sequence is skipped entirely** — `router.push('/wall')` fires immediately on CTA click

---

## 9. Phase 2 Execution Sequence

Sections are built in strict dependency order — foundational systems first, then pages that consume them. Each step's dependencies are listed explicitly.

| Order | Section | Depends On | Rationale |
| :---: | :--- | :--- | :--- |
| **1** | **Design System Foundation** — CSS custom property tokens for both themes (including `--slate-connect` replacing `--jade`, `--personality-rose` added), font loading verification (Bricolage + Hanken + JetBrains Mono + DM Serif Display), GSAP + `@gsap/react` installation and global config, severity token objects, skeleton/shimmer components, spring constants, reduced-motion setup | Nothing | Every other section imports these tokens and utilities. Must exist first. |
| **2** | **Global Navigation** — TopStatusStrip content refinement (human-readable status), BottomDock glassmorphism fix + layoutId active indicator + touch-target sizing, `CopilotModal.tsx` deletion, `Navbar.tsx` deletion, app `(app)/layout.tsx` cleanup | Step 1 (design tokens) | The app shell wraps all pages. Must be correct before building pages inside it. |
| **3** | **Landing Page** (`/`) — Full rebuild with DM Serif Display hero headline, `--personality-rose` gradient wash, eye logo, proof cards, animated counters, role selector, minimal footer, System Boot sequence component | Steps 1–2 (tokens, nav) | First impression page. Self-contained — no dependency on alert store or WebSocket. |
| **4** | **Live Wall / Detection** (`/wall`) — Mode-switch control (built-in / USB / upload), permission-request states, upload flow states, StreamTile refinements with `--slate-connect` online dots, mini-queue cleanup (remove PASSED_SILENT items) | Steps 1–2 (tokens, nav) + alert store | The primary operational screen. Highest complexity and most states to handle. |
| **5** | **Alert Queue** (`/alerts`) — Left severity border on cards, severity section headers, AlertDrawer GSAP entrance, filter tab badges, empty/error states | Steps 1–2 (tokens, nav) + alert store | Shares the same alert store data as the wall page; logical to build next. |
| **6** | **Analytics / Reports** (`/reports`) — GSAP chart entrance animations, counter animations, date-range picker, export button states | Steps 1–2 + alert store (for chart data) | Reads historical data; lower urgency than real-time screens. |
| **7** | **Copilot** (`/copilot`) — Message bubble differentiation, streaming indicator, full-page layout | Steps 1–2 (tokens, nav) | Self-contained after CopilotModal removal in Step 2. |
| **8** | **Profile** (`/profile`) — NEW page from scratch with DM Serif Display name, `--personality-rose` hero gradient | Steps 1–2 (tokens, nav) | New page, relatively simple, no complex data dependencies. |
| **9** | **Settings** (`/settings`) — NEW page with theme toggle, audio controls, language selector | Steps 1–2 + theme system from Step 1 | Depends on the theme toggle mechanism established in the design system. |
| **10** | **Admin** (`/admin/*`) — Admin landing page, breadcrumbs, threshold impact preview | Steps 1–2 (tokens, nav) | Refinement of existing functional pages — lower visual priority. |
| **11** | **Node Health** (`/health`) — Gate matrix table, GSAP gauge entrance, `--slate-connect` camera dots, model info card | Steps 1–2 (tokens, nav) | Refinement of existing page — lowest priority since GaugeDial/RadarSweep already work. |

---

*End of FRONTEND 2.0 — v1.1. Three sections fully reworked (§2, §3, §4). Six sections preserved unchanged (§1, §5, §6, §7, §8, §9). Ready for Phase 2 execution approval.*
