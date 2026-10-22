# Aquifer Imaging Studio design context

Existing React/Parcel/Tailwind application. Preserve its identity; this is a scientific workflow restructuring, not a rebrand.

## Theme
- Inter for interface text; JetBrains Mono for coordinates, units, values and run output.
- Primary #C5050C, hover #9B0000; page #F7F7F7; white cards; #121212 header/sidebar; border #D6DADD; secondary text #4B4F52.
- Existing identity is a Lucide Layers glyph inside a red square, followed by Aquifer Imaging Studio and University of Wisconsin–Madison / Department of Geoscience. There is no local photographic or graphic brand logo asset.
- Compact dark header, 224px dark sidebar, generous scientific workspace, rounded white cards with subtle borders, visible units, restrained red active states.
- Preserve Reset confirmation, Help & Glossary at top-right. Documentation/About belong only in sidebar.

## New layout direction
An editable personal experiment is the main destination. Sidebar Examples is optional practice; Black–Kipp first, P=10 second. Browsing examples must not replace a personal experiment.
Avoid duplicate top and sidebar step lists. Use one bottom-centered, translucent guide showing a compact journey and an expandable contextual teaching card. No points, mascots or confetti. Future steps remain locked until valid.
Use semantic labels, strong contrast behind translucent surfaces, keyboard support, click-outside/Escape dismissal, reduced-motion support. The guide must not cover forms or Continue actions.

## Scientific constraints
- Physical wells have coordinates only; pump/observer roles are assigned per test setup later.
- Domain dimensions, target cell width/height and actual Nx × Ny counts must be clear. Finer cells cost more and do not alone prove accuracy.
- Constant head means zero oscillatory head perturbation, not zero elevation. No flow means zero normal flux. Fixed no-flow top/bottom in a 2D unit-thickness single-layer model; current solver requires at least one horizontal constant-head edge.
- Period is a complete pumping cycle in seconds, not logging interval. Peak pumping amplitude Qmax is m³/s, not peak-to-peak. Fixed-volume option preserves Qmax = πV/P.
- Black–Kipp is an analytical comparison under homogeneous/infinite-domain assumptions, not a second unrelated project type. Label differences from finite-domain numerical predictions.
- Forward complex-head data can seed inversion with exact IDs, periods, rates and real/imaginary values. Label these synthetic, never measured field observations. If a different inversion grid is required, explicitly preview/confirm it; never claim exact baseline parity.
- Keep all existing solver plots, interactive diagnostics, full-screen plotting and reports. Do not alter numerical algorithms or original example parameters.
