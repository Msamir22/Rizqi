---
description: Instructions for implementing mockups
---

# Mobile UI Mockup Generation Prompt (Nano-Banna)

## Product Context

- App name: **Astik**
- Platform: **Mobile only** (iOS & Android)
- Domain: **Fintech** (expense tracking + wealth tracking)
- Goal: Clear, trustworthy, calm, and efficient UI that supports frequent daily
  use.

---

## Purpose

Generate **high-fidelity mobile UI mockups** to be used as visual references for
product, UX, and frontend implementation.

---

## Task

Design **4 high-fidelity mobile UI mockups**, each with a **distinct visual
style and layout approach**, for the requested screen (e.g. form, list,
dashboard, modal, or mixed layout).

The screen type will be specified when invoking this workflow.

---

## 1. Data & Schema Constraints (Mandatory)

- Any data-driven UI must **strictly match the existing database schema**.
- Refer to:
  - `@schema.ts` **or**
  - `@supabase-types.ts`
- **Do NOT invent, rename, remove, or infer fields, properties, or data
  relationships**.
- Labels, data types, and required/optional states must reflect the schema
  exactly.

---

## 2. Design System & Colors (Mandatory)

- Use **only** the colors defined in `@colors.ts`.
- Do **not** introduce new colors, gradients, or shades.
- Apply colors consistently for:
  - Primary actions
  - Secondary actions
  - Backgrounds
  - Dividers and borders
  - Focus, active, and disabled states
  - Error, warning, and helper text

---

## 3. Mobile-First Layout Rules (Mandatory)

- All mockups must be designed for **mobile screens only**.
- Assume:
  - Single-column layouts
  - Thumb-friendly interactions
  - Safe-area awareness (top & bottom)
- Avoid desktop patterns such as:
  - Sidebars
  - Multi-column grids
  - Hover-based interactions

---

## 4. Screen-Type Conditional Guidelines

### 4.1 If the Screen Includes a Form

- Keep the form:
  - Simple
  - Fast to complete
  - Non-overwhelming
- Use:
  - Logical grouping of fields
  - Clear labels and helper text
  - Minimal required inputs
- Avoid unnecessary steps, decorative elements, or visual noise.

---

### 4.2 If the Screen Includes a List

- Clearly define:
  - List item structure
  - Primary vs secondary information
- Ensure:
  - Strong visual hierarchy
  - Easy scannability
  - Clear tap targets
- If applicable, describe:
  - Empty states
  - Loading states
  - Filters or sorting controls
  - Inline actions (if any)

---

### 4.3 If the Screen Includes a Dashboard

- Focus on:
  - At-a-glance clarity
  - Financial confidence and trust
- Clearly describe:
  - Metrics and KPIs
  - Charts or visual indicators
  - Information grouping and priority
- Avoid clutter and excessive data density.

---

### 4.4 If the Screen Includes a Modal, Sheet, or Overlay

- Specify:
  - Entry and exit behavior
  - Size and position (bottom sheet, full screen, centered modal)
- Ensure:
  - Clear primary action
  - Obvious dismissal behavior
  - No hidden or ambiguous interactions

---

## 5. Mockup Variations

- Create **4 distinct mockups**, each with a different design direction.
- Examples (not limitations):
  - Minimal and calm
  - Card-based
  - Data-dense but structured
  - Soft and friendly fintech style
- All mockups must follow the same:
  - Schema
  - Color system
  - Mobile constraints

---

## 6. Nano-Banna Description Requirements (Critical)

Produce a **pixel-precise visual description** intended for the nano-banna image
generation tool.

- Describe **every visible UI element**, including:
  - Screen structure and layout
  - Spacing, padding, and margins
  - Font sizes, weights, and hierarchy
  - Button sizes, shapes, and positions
  - Input, list item, and card styling
  - Icons (if any), including size and placement
  - Dividers, separators, and background layers

---

## 7. Zero Guessing Rule (Very Important)

- Do **not** leave any visual or behavioral detail unspecified.
- Do **not** allow nano-banna to:
  - Invent UI elements
  - Add decorative visuals
  - Infer missing content or interactions
- If an element exists, it must be explicitly described.
- If an element should not exist, ensure it is excluded by omission.

---

## 8. Output Structure

- Separate the output clearly into:
  - Mockup 1
  - Mockup 2
  - Mockup 3
  - Mockup 4
- Each mockup description must be:
  - Self-contained
  - Complete
  - Ready to be sent directly to nano-banna without modification

Please If you have any concerns/questions, you can ask me before starting the
implementation.
