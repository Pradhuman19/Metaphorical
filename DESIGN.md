# Design System: News Cross-Check "Editorial Precision"

## 1. Overview & Strategy
**The Creative North Star: "The Digital Curator"**
A high-end editorial experience that moves away from "browser utility" and toward a premium broadsheet feel.

### Core Principles
- **High-Contrast Authority**: Heavy, monolithic header anchors the experience.
- **Intentional Asymmetry**: Purple-tinted whitespace and "The Bleed" across edges.
- **The No-Line Rule**: Boundaries defined by background shifts, not 1px borders.

---

## 2. Color Palette
Our palette balances stark authority with the urgent energy of "Breaking News" orange.

- **Header Monolith**: `#0F172A` (Rich Dark Neutral)
- **Primary Signature**: `#FF8000` (Urgent Orange)
- **Surface (Background)**: `#FAF8FF` (Soft tinted slate-white)
- **Surface Elevation**:
  - **Level 1 (Card)**: `#FFFFFF` (Highest priority)
  - **Level 2 (Section)**: `#F2F3FF` (Secondary areas)

---

## 3. Typography
**Inter** is the exclusive font family, treated with rhythmic variation.

- **Headline (The Lead)**: `headline-sm` (1.5rem / 24px)
- **Title (The Sub-head)**: `title-md` (1.125rem / 18px)
- **Body (The Copy)**: `body-md` (0.875rem / 14px), 1.5 line-height.
- **Labels (Metadata)**: `label-sm` (0.6875rem / 11px), ALL-CAPS, +0.05em spacing.

---

## 4. Components & Interactions
- **Cards**: xl corner radius (12px / 0.75rem), xl internal padding.
- **Buttons**:
  - **Primary**: Solid `#FF8000`, white text, md corner radius (6px).
  - **Secondary**: `surface-container-low` background, `primary` text.
- **Elevation**: Nested depth via stacking cards on soft backgrounds.
- **Shimmer Effects**: Used during analysis to indicate active verification.
