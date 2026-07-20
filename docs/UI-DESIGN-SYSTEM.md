# The Noviq UI Playbook — a reusable design-system reference

> Copy this file into any new project and hand it to your AI coding assistant (or
> yourself) as the north star for the UI. It captures **the philosophy, the exact
> tokens, the patterns, the animation stack, the libraries, and the prompts** that
> produced this look: dark-first, OKLCH, tinted neutrals, glass + grain + mesh,
> fluid type, and motion that respects the user.
>
> It is deliberately **framework-light** — the core is plain CSS variables + CSS
> Modules, so it drops into Next.js, Vite, Astro, SvelteKit, or plain HTML.

---

## 0. TL;DR — the 10 rules that make it look like this

1. **Dark-first.** Design the dark theme first; light is an override of the semantic layer only.
2. **OKLCH color, never `#000`/`#fff`.** Neutrals carry a faint cool hue (~265°) so nothing is dead grey.
3. **3-tier tokens.** primitives → semantic roles → component tokens. Components touch **only** tiers 2–3.
4. **One accent hue.** A single vivid color (electric violet ~285°) + danger/success/warning. No rainbow.
5. **Fluid type with `clamp()`.** Three font roles: display / sans / mono. Tabular figures for money & hashes.
6. **4px base, 8px rhythm.** All spacing from a fixed scale. No magic numbers, ever.
7. **Reusable surface patterns.** Glass card, edge-light ring, film grain, animated mesh — a few classes reused everywhere.
8. **Motion from shared tokens.** The same easings/durations feed CSS, Framer Motion, and GSAP so everything feels identical.
9. **Respect the user.** Honor `prefers-reduced-motion` and `hover:none`; progressive-enhance heavy effects (WebGL) over a CSS fallback.
10. **CSS Modules + CSS variables.** No utility-class soup. Component tokens (`--card-bg`) keep components declarative.

---

## 1. Philosophy

The whole look is **"quiet luxury for software"**: near-black tinted surfaces, one
electric accent, generous space, crisp type, and motion that feels physical but never
shouts. It reads as *expensive and calm* because:

- **Tinted neutrals** (a faint hue in every grey) avoid the cheap, flat feel of pure greyscale.
- **OKLCH** keeps perceived lightness consistent across hues — your accent, danger, and success all "weigh" the same.
- **Depth via translucency**, not heavy borders: glass fills, 1px gradient edge-lights, layered tinted shadows.
- **Restraint**: one accent, a tight type scale, and a small set of patterns applied consistently.

---

## 2. The token architecture (copy `tokens.css` verbatim)

Three tiers in one file. **Tier 1** is raw values (never used directly by components).
**Tier 2** is semantic roles (what components consume). **Tier 3** is component tokens.

### 2.1 Color primitives (OKLCH)

```css
:root {
  /* Neutral ramp — cool hue 265, faint chroma. Dark (990) → light (50). NO #000/#fff. */
  --neutral-990: oklch(0.14 0.018 265);
  --neutral-950: oklch(0.16 0.02 265);
  --neutral-900: oklch(0.19 0.02 265);
  --neutral-850: oklch(0.22 0.021 265);
  --neutral-800: oklch(0.26 0.022 265);
  --neutral-700: oklch(0.32 0.023 265);
  --neutral-600: oklch(0.44 0.023 265);
  --neutral-500: oklch(0.56 0.022 265);
  --neutral-400: oklch(0.68 0.02 265);
  --neutral-300: oklch(0.78 0.016 265);
  --neutral-200: oklch(0.86 0.013 265);
  --neutral-100: oklch(0.92 0.011 265);
  --neutral-50:  oklch(0.96 0.01 265);

  /* Brand accent — electric indigo/violet, hue 285. Pick ONE hue and commit. */
  --violet-200: oklch(0.86 0.07 285);
  --violet-300: oklch(0.78 0.12 285);
  --violet-400: oklch(0.70 0.16 285);
  --violet-500: oklch(0.62 0.19 285);
  --violet-600: oklch(0.55 0.19 285);
  --violet-700: oklch(0.47 0.17 285);

  --red-300: oklch(0.75 0.14 27);  --red-400: oklch(0.68 0.19 27);
  --red-500: oklch(0.62 0.22 27);  --red-600: oklch(0.54 0.21 27);
  --green-300: oklch(0.82 0.12 155); --green-400: oklch(0.75 0.15 155);
  --green-500: oklch(0.68 0.16 155); --green-600: oklch(0.60 0.15 155);
  --amber-400: oklch(0.82 0.14 75);  --amber-500: oklch(0.76 0.16 75);
}
```

> **To re-skin for a different brand:** change the accent hue (the `285` in the
> `--violet-*` ramp) and, optionally, the neutral hue (`265`). Keep the lightness/
> chroma columns — they're tuned. That single change re-themes the whole app.

### 2.2 Spacing, type, radii, shadows, motion primitives

```css
:root {
  /* Spacing — 4px base, 8px rhythm */
  --space-1:.25rem; --space-2:.5rem; --space-3:.75rem; --space-4:1rem;
  --space-5:1.5rem; --space-6:2rem; --space-7:3rem; --space-8:4rem;
  --space-9:6rem;  --space-10:8rem;

  /* Fluid type — clamp(min, preferred, max), modular ~1.24 */
  --fs-step--1: clamp(0.8rem, 0.76rem + 0.2vw, 0.9rem);   /* caption */
  --fs-step-0:  clamp(0.95rem, 0.9rem + 0.25vw, 1.05rem); /* body    */
  --fs-step-1:  clamp(1.1rem, 1rem + 0.45vw, 1.32rem);
  --fs-step-2:  clamp(1.32rem, 1.16rem + 0.72vw, 1.72rem);
  --fs-step-3:  clamp(1.6rem, 1.36rem + 1.1vw, 2.2rem);
  --fs-step-4:  clamp(1.95rem, 1.56rem + 1.9vw, 3rem);
  --fs-step-5:  clamp(2.4rem, 1.8rem + 3vw, 4rem);
  --fs-step-6:  clamp(3rem, 2rem + 4.8vw, 5.5rem);         /* display hero */

  --lh-tight:1.05; --lh-snug:1.2; --lh-normal:1.55;
  --tracking-tight:-0.02em; --tracking-wide:0.08em;
  --weight-regular:400; --weight-medium:500; --weight-semibold:600; --weight-bold:700;

  /* Three font roles (next/font or @font-face supply the -src vars) */
  --font-display: var(--font-display-src,"Space Grotesk"), ui-sans-serif, system-ui, sans-serif;
  --font-sans:    var(--font-sans-src,"Geist"), ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono:    var(--font-mono-src,"Geist Mono"), ui-monospace, "SFMono-Regular", monospace;

  --radius-xs:4px; --radius-sm:8px; --radius-md:12px; --radius-lg:16px;
  --radius-xl:24px; --radius-2xl:32px; --radius-full:9999px;

  /* Tinted, layered shadows + accent glow */
  --shadow-1: 0 1px 2px  oklch(0.10 0.02 265 / 0.40);
  --shadow-2: 0 4px 12px oklch(0.10 0.02 265 / 0.42);
  --shadow-3: 0 12px 32px oklch(0.08 0.02 265 / 0.48);
  --shadow-4: 0 24px 64px oklch(0.06 0.02 265 / 0.55);
  --shadow-accent-glow: 0 0 28px oklch(0.62 0.19 285 / 0.40);
  --shadow-danger-glow: 0 0 28px oklch(0.62 0.22 27 / 0.40);

  --blur-sm:8px; --blur-md:16px; --blur-lg:28px;
  --z-base:0; --z-raised:10; --z-dropdown:100; --z-sticky:200;
  --z-overlay:300; --z-modal:400; --z-toast:500;
}
```

### 2.3 Semantic roles (Tier 2 — dark-first defaults)

```css
:root {
  --surface-0: var(--neutral-990); --surface-1: var(--neutral-950);
  --surface-2: var(--neutral-900); --surface-3: var(--neutral-850);
  --surface-inset: var(--neutral-800);

  --text-primary: var(--neutral-50);  --text-secondary: var(--neutral-300);
  --text-muted:   var(--neutral-400); --text-faint: var(--neutral-500);
  --text-inverse: var(--neutral-990);

  --border-subtle: oklch(0.32 0.02 265 / 0.55);
  --border-strong: oklch(0.44 0.023 265 / 0.80);

  --accent: var(--violet-500); --accent-hover: var(--violet-400);
  --accent-active: var(--violet-600); --accent-muted: oklch(0.62 0.19 285 / 0.16);
  --accent-contrast: var(--neutral-50);

  --danger: var(--red-500);  --danger-muted: oklch(0.62 0.22 27 / 0.16);
  --success: var(--green-500); --success-muted: oklch(0.68 0.16 155 / 0.16);
  --warning: var(--amber-500); --warning-muted: oklch(0.76 0.16 75 / 0.16);

  --ring: var(--violet-400);
  --glass-bg: oklch(0.22 0.021 265 / 0.55);
  --glass-border: oklch(0.72 0.06 285 / 0.16);
  --glass-highlight: oklch(0.92 0.02 265 / 0.09);
  --link: var(--violet-300); --link-hover: var(--violet-200);
}
```

### 2.4 Component tokens (Tier 3 — components reference ONLY these)

```css
:root {
  --card-bg: var(--surface-2); --card-border: var(--border-subtle);
  --card-radius: var(--radius-lg); --card-padding: var(--space-6); --card-shadow: var(--shadow-2);

  --btn-accent-bg: var(--accent); --btn-accent-bg-hover: var(--accent-hover);
  --btn-accent-bg-active: var(--accent-active); --btn-accent-fg: var(--accent-contrast);
  --btn-radius: var(--radius-sm); --btn-padding-y: var(--space-2); --btn-padding-x: var(--space-4);

  --input-bg: var(--surface-1); --input-border: var(--border-subtle);
  --input-border-focus: var(--accent); --input-radius: var(--radius-sm);

  --code-bg: var(--surface-0); --code-fg: var(--neutral-200); --code-radius: var(--radius-sm);
}
```

### 2.5 Light theme = override Tier 2 only

```css
[data-theme="light"] {
  --surface-0: oklch(0.98 0.006 265); --surface-1: oklch(0.96 0.008 265);
  --surface-2: oklch(0.99 0.005 265); --surface-3: oklch(0.94 0.01 265);
  --text-primary: var(--neutral-950); --text-secondary: var(--neutral-700);
  --accent: var(--violet-600);        /* darker accent for contrast on light */
  --border-subtle: oklch(0.55 0.02 265 / 0.24);
  /* ...re-tint shadows lighter; still no pure white */
}
```

> **Never** redefine Tier 1 or Tier 3 in the theme block. Only the semantic layer flips.

---

## 3. Base layer (`globals.css`)

Import order matters: `tokens.css` → `motion.css` → reset → base elements.

Key base rules that carry a lot of the "polish":

```css
html { color-scheme: dark; scroll-behavior: smooth;
       -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
body { background: var(--surface-0); color: var(--text-primary);
       font-family: var(--font-sans); font-size: var(--fs-step-0); line-height: var(--lh-normal); }

h1,h2,h3,h4,h5,h6 { font-family: var(--font-display); font-weight: var(--weight-semibold);
       line-height: var(--lh-tight); letter-spacing: var(--tracking-tight); text-wrap: balance; }
p  { text-wrap: pretty; }
code,kbd,samp,pre { font-family: var(--font-mono); font-size: 0.92em; }

/* Money, addresses, hashes read better with tabular figures */
.tabular,[data-tabular]{ font-variant-numeric: tabular-nums; font-feature-settings:"tnum" 1; }

/* One global focus ring for EVERYTHING — accessibility for free */
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: var(--radius-xs); }

@media (hover: none){ a:hover{ color: var(--link); } }  /* touch: don't stick hover states */
```

Add a **no-FOUC theme script** in `<head>` so a saved light theme applies before paint:

```html
<script>(function(){try{if(localStorage.getItem("app-theme")==="light"){document.documentElement.dataset.theme="light"}}catch(e){}})()</script>
```

---

## 4. Reusable surface patterns (`patterns.module.css`)

These four classes are 80% of the "wow". Consume Tier 2/3 tokens only.

### 4.1 Glass card

```css
.glassCard {
  position: relative; background: var(--glass-bg);
  border: 1px solid var(--glass-border); border-radius: var(--card-radius);
  box-shadow: var(--shadow-2); overflow: clip;
  backdrop-filter: blur(var(--blur-md)) saturate(1.25);
  -webkit-backdrop-filter: blur(var(--blur-md)) saturate(1.25);
}
/* Fallback where backdrop-filter is unsupported */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glassCard { background: var(--surface-2); }
}
```

### 4.2 Edge-light ring (1px gradient border via mask)

```css
.edgeLight { position: relative; }
.edgeLight::before {
  content:""; position:absolute; inset:0; border-radius:inherit; padding:1px; pointer-events:none;
  background: linear-gradient(140deg, var(--glass-highlight) 0%, transparent 38%,
              transparent 62%, oklch(0.72 0.08 285 / 0.22) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
```

### 4.3 Film grain (SVG noise, low opacity)

```css
.filmGrain::after {
  content:""; position:absolute; inset:0; z-index:var(--z-raised); pointer-events:none;
  opacity:0.035; mix-blend-mode:overlay; background-size:140px 140px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### 4.4 Animated mesh gradient (GPU-cheap, two blurred blobs drifting)

```css
.mesh { position:absolute; inset:0; z-index:var(--z-base); overflow:hidden;
        background-color:var(--surface-0); pointer-events:none; }
.mesh::before,.mesh::after { content:""; position:absolute; inset:-30%;
        will-change:transform; filter:blur(var(--blur-lg)); background-repeat:no-repeat; }
.mesh::before { background-image:
    radial-gradient(38% 42% at 22% 28%, oklch(0.62 0.19 285 / 0.40), transparent 70%),
    radial-gradient(34% 38% at 78% 20%, oklch(0.55 0.19 285 / 0.28), transparent 70%);
  animation: meshDriftA 24s var(--ease-in-out) infinite alternate; }
.mesh::after  { background-image:
    radial-gradient(40% 44% at 68% 78%, oklch(0.50 0.14 300 / 0.30), transparent 70%),
    radial-gradient(30% 34% at 30% 82%, oklch(0.62 0.16 250 / 0.24), transparent 70%);
  animation: meshDriftB 30s var(--ease-in-out) infinite alternate; }
@keyframes meshDriftA { from{transform:translate3d(-4%,-3%,0) scale(1)} to{transform:translate3d(6%,5%,0) scale(1.15)} }
@keyframes meshDriftB { from{transform:translate3d(3%,4%,0) scale(1.1)} to{transform:translate3d(-5%,-6%,0) scale(1)} }
@media (prefers-reduced-motion: reduce){ .mesh::before,.mesh::after{ animation:none } }
```

**Compose them**: a full-bleed background is just
`<div class="mesh filmGrain" aria-hidden="true" />`, and a hero card is
`class="glassCard edgeLight"`.

---

## 5. Motion system (the single source of feel)

Keep the easings/durations in **one file, mirrored in JS**, so CSS, Framer Motion, and
GSAP all animate identically.

### 5.1 `motion.css`

```css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* default: confident settle */
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);  /* UI micro-interactions      */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* playful overshoot          */

  --dur-1:120ms; --dur-2:200ms; --dur-3:320ms; --dur-4:500ms; --dur-5:800ms;
  --transition-colors: color var(--dur-2) var(--ease-out-quart),
    background-color var(--dur-2) var(--ease-out-quart), border-color var(--dur-2) var(--ease-out-quart);
}
/* Global reduced-motion kill-switch */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{ animation-duration:.01ms !important; animation-iteration-count:1 !important;
    transition-duration:.01ms !important; scroll-behavior:auto !important; }
}
```

### 5.2 `motion.ts` (byte-identical mirror for JS libraries)

```ts
export const easings = {
  outExpo:[0.16,1,0.3,1], outQuart:[0.25,1,0.5,1], inOut:[0.65,0,0.35,1], spring:[0.34,1.56,0.64,1],
} as const;
export const durationsSec = { 1:0.12, 2:0.2, 3:0.32, 4:0.5, 5:0.8 } as const;
export const prefersReducedMotion = () =>
  typeof window!=="undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
```

### 5.3 Framer Motion presets (`lib/motion.ts`)

```ts
import { easings, durationsSec } from "./motion";
const tBase = { duration: durationsSec[3], ease: easings.outExpo };

export const fadeUp = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:tBase} };
export const fadeIn = { hidden:{opacity:0},      show:{opacity:1,transition:tBase} };
export const scaleIn= { hidden:{opacity:0,scale:0.96}, show:{opacity:1,scale:1,transition:tBase} };
export const staggerParent = (stagger=0.08,delay=0)=>({ hidden:{},
  show:{ transition:{ staggerChildren:stagger, delayChildren:delay } } });
export const springTap = { whileTap:{scale:0.97}, transition:{type:"spring",stiffness:400,damping:22} };
export const inView = { once:true, amount:0.3 } as const;   // play once, 30% visible
```

### 5.4 The reduced-motion strategy (do all three)

1. **Global CSS kill-switch** (above) — neutralizes CSS transitions/animations.
2. **`<MotionConfig reducedMotion="user">`** wrapping the app — makes every Framer
   `motion.*` honor the OS setting (drops transforms, keeps opacity) with zero per-component code.
3. **Guard JS animations** (GSAP, WebGL) with `if (prefersReducedMotion()) return;` and render the resolved end-state statically.

---

## 6. Signature animation recipes

### 6.1 Scroll reveal (Framer) — fade + rise, once

```tsx
<motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={inView}>
  {children}
</motion.div>
```
Stagger a group with `staggerParent` on the parent and `fadeUp` on each child.

### 6.2 Pinned scroll "beat" (GSAP ScrollTrigger) — a scrubbed storyboard

```tsx
useEffect(() => {
  if (prefersReducedMotion()) { /* set final state, return */ return; }
  gsap.registerPlugin(ScrollTrigger);
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ scrollTrigger:{ trigger:el, start:"top top", end:"+=220%", pin:true, scrub:0.6 } });
    tl.from(".a",{opacity:0,y:20,duration:0.6})
      .from(".b",{opacity:0,y:12,stagger:0.5},">-0.1")
      .from(".stamp",{opacity:0,scale:0.4,rotate:-8,ease:"back.out(1.7)",duration:0.7},">");
  }, el);
  return () => ctx.revert();
}, []);
```

### 6.3 WebGL hero backdrop — progressive enhancement over CSS

The pattern: the **CSS `.mesh` + grain always render**; a lightweight React Three Fiber
fullscreen-shader plasma layers on top **only** when mounted, WebGL is available, and
motion is allowed. Any error falls back silently.

```tsx
const WebGLBackdrop = dynamic(() => import("./WebGLBackdrop"), { ssr:false });
// on mount: if (!prefersReducedMotion() && webglAvailable()) setEnhance(true)
// render:   <div class="mesh filmGrain">{enhance && <ErrorBoundary><WebGLBackdrop/></ErrorBoundary>}</div>
```
The shader itself is a single `ScreenQuad` + fragment shader (no geometry, no textures),
`powerPreference:"low-power"`, `dpr={[1,1.5]}` — cheap enough for a hero.

### 6.4 Button micro-interactions

- hover: background shifts + `--shadow-accent-glow`
- active: `transform: scale(0.97)` on `--dur-1`
- loading: absolutely-positioned spinner + dimmed label, `aria-busy`
- transitions scoped to `background-color, border-color, transform, box-shadow` (never `all`)

---

## 7. Component conventions (the kit)

Every component is a `.tsx` + co-located `.module.css`, and **only reads Tier 3 tokens**.
Patterns that keep them clean:

- **Local private vars for variants.** The button defines `--_bg/--_fg/--_bg-hover` and
  each variant just reassigns them — one base rule, many variants:
  ```css
  .btn { --_bg:transparent; --_fg:var(--text-primary); background:var(--_bg); color:var(--_fg); }
  .accent { --_bg:var(--btn-accent-bg); --_fg:var(--btn-accent-fg); }
  ```
- **Class-builder helper** so a link can look identical to a button:
  `buttonClassName(variant,size,extra)` → shared by `<button>` and `<a>`.
- **Sizes hit real tap targets**: sm 34px / md 44px / lg 52px min-height.
- **Radix UI primitives** (unstyled) for anything with a11y behavior — Dialog, Dropdown,
  Tabs, Toast, Tooltip — then styled with your tokens. You get focus traps, ARIA, and
  keyboard nav for free; you keep full visual control.
- **Semantic HTML + one global focus ring.** Prefer real `<button>`/`<a>`; the global
  `:focus-visible` means you rarely write focus styles per component.
- **Tabular numerals** on money/addresses/hashes; **mono font** for anything hex.

Typical component set to build first: `Button`, `Card`, `Badge`, `Field/Input`,
`CodeBlock`, `Skeleton`, `Stat`, `Toast`, plus layout primitives `Container`, `Stack`,
`Grid`, `PageHeader`.

---

## 8. The stack (libraries & why)

| Concern | Library | Notes |
|---|---|---|
| Styling | **CSS Modules + CSS variables** | No Tailwind. Tokens do the theming; modules scope the styles. |
| A11y primitives | **@radix-ui/react-*** | dialog, dropdown-menu, tabs, toast, tooltip — unstyled, accessible. |
| UI animation | **framer-motion** | reveals, gestures, layout, `AnimatePresence`, `MotionConfig`. |
| Scroll choreography | **gsap** + **ScrollTrigger** | pinned/scrubbed storyboard beats. |
| 3D / shaders | **three** + **@react-three/fiber** + **@react-three/drei** | hero backdrop (`ScreenQuad` + fragment shader). |
| Fonts | **next/font** (Geist, Geist Mono, Space Grotesk) | self-hosted, `display:swap`, exposed as `--font-*-src`. |
| Data/state (this app) | @tanstack/react-query, wagmi/viem | not UI, but how live data reaches the components. |

Minimal install for the **UI core** in a fresh project:

```bash
pnpm add framer-motion gsap @radix-ui/react-dialog @radix-ui/react-tabs \
  @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-dropdown-menu
# optional 3D hero:
pnpm add three @react-three/fiber @react-three/drei
```

Fonts: display = a geometric grotesk (Space Grotesk), sans = Geist, mono = Geist Mono
(or any clean trio filling those three roles).

---

## 9. The prompts / skills that produced this UI

This UI was built by invoking specialized design skills at the **start of each UI phase**,
then holding them to the token rules above. If your assistant has equivalent skills, call
them; otherwise, paste the directive in §10 as the system prompt.

**Skills used (invoke the relevant one before building each surface):**

- `meta-skills:modern-web-design` — trends, micro-interactions, scrollytelling, bold-minimalism, a11y, performance.
- `ui-ux-pro-max:design-system` — token architecture (primitive→semantic→component), specs.
- `ui-ux-pro-max:ui-styling` — component styling, dark mode, responsive layout.
- `ui-ux-pro-max:ui-ux-pro-max` — styles, color systems, font pairings, UX guidelines.
- `core-3d-animation:motion-framer` — Framer Motion choreography.
- `core-3d-animation:gsap-scrolltrigger` — GSAP scroll-driven sequences.
- `core-3d-animation:threejs-webgl` / `react-three-fiber` — the WebGL hero.
- `animation-components:*` — pre-built animated component references when useful.

**How they were used:** *"Invoke the design skill at the start of each UI phase, then
implement strictly with the 3-tier tokens, CSS Modules, and shared motion tokens — no
Tailwind, no inline magic numbers, dark-first OKLCH, respect reduced-motion."*

---

## 10. Drop-in directive (paste this to your AI assistant on a new project)

> Build the UI as a **3-tier design-token system** in CSS variables (primitives →
> semantic roles → component tokens) in a single `tokens.css`, imported once via
> `globals.css`. **Dark-first**; `[data-theme="light"]` overrides only the semantic
> layer. **OKLCH color only; never `#000`/`#fff`** — tint every neutral with a faint
> hue (~265°). **One accent hue** (~285° electric violet) plus danger/success/warning.
> **Fluid `clamp()` type** with three font roles (display grotesk / sans / mono),
> tabular-nums for numbers and hashes. **4px base / 8px spacing scale** — no magic
> numbers. Provide reusable patterns: **glass card, edge-light ring, film grain,
> animated mesh gradient**. Put **easings + durations in one motion file mirrored in
> TS** so CSS, Framer Motion, and GSAP share identical feel. **Respect
> `prefers-reduced-motion`** three ways: a global CSS kill-switch,
> `<MotionConfig reducedMotion="user">`, and JS guards for GSAP/WebGL. Use **CSS
> Modules + CSS variables only (no Tailwind)** and **Radix UI unstyled primitives** for
> accessible behavior. One global `:focus-visible` ring. Ship a `/styleguide` route
> that renders every token + pattern + component so the system is verifiable. Keep it
> calm, spacious, and restrained — quiet luxury, not loud.

---

## 11. The `/styleguide` route — keep it

It's the living reference: it renders every color ramp, the fluid type scale, spacing,
radii, shadows, motion (easings + durations), the four surface patterns, and the live
component kit — with a theme toggle to verify the semantic layer flips correctly.

**Recommendation: keep it, don't delete it.** It costs nothing at runtime (it's just a
page users never navigate to), it's your fastest way to catch design drift, and it's the
single best artifact to show collaborators or reviewers "here's the system." If you want
it hidden in production, gate it instead of removing it — e.g. render it only when
`process.env.NODE_ENV !== "production"`, or add `export const metadata = { robots: "noindex" }`
so it isn't indexed. In this project it's already unlinked from user navigation, so it's
effectively private already.

---

## 12. Reuse checklist for a new project

1. Copy `tokens.css`, `motion.css`, `motion.ts`, `patterns.module.css`, `globals.css`.
2. Change the accent hue (and optionally neutral hue). Done — it's re-themed.
3. Wire three fonts into `--font-display-src / -sans-src / -mono-src`.
4. Add the no-FOUC theme `<script>` and a theme toggle writing `localStorage`.
5. Wrap the app in your motion provider (`<MotionConfig reducedMotion="user">`).
6. Build the component kit reading Tier 3 tokens only.
7. Add a full-bleed `<div class="mesh filmGrain">` background; optionally the WebGL hero.
8. Stand up `/styleguide` and use it to keep yourself honest.
