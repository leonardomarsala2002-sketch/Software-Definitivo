

# UI Redesign: Corporate Green Glass System

## Overview

Complete visual overhaul from the current white/transparent background to a **Corporate Green Glass** system with 3 clear visual hierarchy levels. This affects the global background, the AppShell layout structure, the sidebar, and all card components.

## Visual Hierarchy (3 Levels)

```text
Level 1: Green gradient background (full screen)
Level 2: Main Card (content wrapper) + Sidebar Base Card
Level 3: Inner Cards (dashboard cards) + Icon Cards (sidebar icons)
```

## Files to Modify

### 1. `src/index.css` - Global Background + Glass Classes

**Background**: Replace `body { background: #FFFFFF }` with a soft green gradient:
- `background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 30%, #a5d6a7 70%, #e8f5e9 100%)`
- Subtle, corporate, no neon, no acid tones
- Remove the `body::before` watermark logo (it won't be visible through the new system)

**New utility classes** (replace current glass utilities):
- `.glass-main-card` (Level 2): `bg-white/72`, `backdrop-blur-[16px]`, `border: 1px solid rgba(255,255,255,0.4)`, `shadow: 0 8px 32px rgba(0,0,0,0.06)`, `rounded-[20px]`
- `.glass-sidebar-base` (Level 2): `bg-white/70`, `backdrop-blur-[14px]`, `border: 1px solid rgba(255,255,255,0.4)`, `shadow: 0 4px 20px rgba(0,0,0,0.05)`, `rounded-[20px]`
- `.glass-card` (Level 3 - inner cards): `bg-white/80`, `backdrop-blur-[10px]`, `border: 1px solid rgba(255,255,255,0.35)`, lighter shadow, `rounded-[16px]`
- `.glass-icon-card` (Level 3 - sidebar icons): `bg-white/82`, `backdrop-blur-[8px]`, `border: 1px solid rgba(255,255,255,0.35)`, micro shadow, `rounded-[12px]`

**Hover effect** (corporate, all card levels):
- `transform: scale(1.015)` with `transition: all 200ms ease`
- No glow, no luminous effects
- `overflow: hidden` on all cards

**Remove** `.gradient-bg` (replaced by body gradient).

### 2. `src/components/ui/card.tsx` - Base Card Component

Update the default `Card` class to use Level 3 glass style:
- `rounded-[16px]`
- `bg-[rgba(255,255,255,0.80)]`
- `backdrop-blur-[10px]`
- `border border-[rgba(255,255,255,0.35)]`
- Lighter shadow than current
- Hover: subtle scale(1.015), `overflow-hidden`, transition 200ms
- No translate/shift effects

### 3. `src/components/AppShell.tsx` - Main Card Wrapper

The `<main>` area currently has no container card. Wrap the `<Outlet />` area in a **Main Card** (Level 2):

**Before**:
```text
[Sidebar] [Content area (no card)]
```

**After**:
```text
[Green BG] -> [Sidebar Base Card] | [Main Card wrapping all content]
```

Changes:
- Outer `div`: remove `gradient-bg`, the body gradient handles the background
- Add padding around the main area so the green background is visible as a frame
- Wrap content in a `div` with class `glass-main-card` that fills the available space
- The main card gets `rounded-[20px]`, proper padding, and `overflow-hidden`

### 4. `src/components/AppSidebar.tsx` - Sidebar Double Layer

**Sidebar Base Card** (Level 2):
- Wrap the entire sidebar content in a vertical card with `glass-sidebar-base`
- Full height, `rounded-[20px]`, proper margin from screen edges

**Icon Cards** (Level 3):
- Each navigation icon currently uses inline classes (`bg-white/50 shadow-md rounded-full`)
- Replace with `glass-icon-card` class: `rounded-[12px]` (square-ish, not round), `bg-white/82`, `backdrop-blur-[8px]`, micro shadow
- Active state: slightly more opaque + green icon color (keep `text-[#00C853]`)
- Hover: scale(1.015), 200ms ease, no glow

**Structural changes**:
- `aside` padding adjusted to show green background around the sidebar base card
- Logo container: stays as-is (round white circle), positioned inside the sidebar base card
- Icon shape: change from `rounded-full` to `rounded-[12px]` for the glass-icon-card look
- Size stays `h-11 w-11`

### 5. `src/pages/Dashboard.tsx` - Inner Cards Styling

- The `cardBase` constant changes from `"glass-card rounded-[12px] p-1"` to `"glass-card rounded-[16px] p-2"` (Level 3 style is now applied by the updated `.glass-card` class)
- All inner cards inherit the Level 3 glass properties automatically
- Add `overflow-hidden` to each card
- Hover effect handled by the CSS class (scale 1.015, 200ms)

## Spacing Rules

- Green background visible around all Level 2 elements (sidebar base card, main card)
- `p-3` (12px) around the outer shell to show green background as frame
- `gap-3.5` (14px) between inner cards (maintained from current)
- `p-3.5` (14px) inside the main card around the inner cards

## Color Palette Summary

| Element | Background | Blur | Border | Shadow |
|---------|-----------|------|--------|--------|
| Body BG | Green gradient | -- | -- | -- |
| Main Card (L2) | white/72 | 16px | white/40 | soft diffused |
| Sidebar Base (L2) | white/70 | 14px | white/40 | light visible |
| Inner Cards (L3) | white/80 | 10px | white/35 | lighter |
| Icon Cards (L3) | white/82 | 8px | white/35 | micro |

## What Does NOT Change

- Navigation structure and routing
- Dashboard grid layout (quadrant system with grid-template-areas)
- Functional logic (requests, calendar, agenda)
- Mobile bottom nav
- Button gradient (green gradient stays for primary buttons)
- Typography sizes (already scaled from previous work)

