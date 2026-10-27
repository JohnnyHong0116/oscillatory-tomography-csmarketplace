# v1.4.1 interaction design and release review

## Scope and thesis

Aquifer Imaging Studio is a React web application for geoscience researchers,
not a native Apple application. Apply Apple HIG's foundations and interaction
principles; do not imitate macOS chrome, introduce Apple branding, or alter the
scientific workflow/solver. Thesis: select an experimental period, configure
one pumping test, and inspect the same physical response in chart and numbers.

The requested `dickwu/apple-design-skill` was installed locally with the standard
skill installer. This review uses its downloaded references: accessibility,
layout, typography, color, designing-for-macos, cross-platform, code-audit,
charting-data, charts, focus-and-selection, motion and entering-data.

## Review before implementation: needs work

- High: period identity and test counts are hidden in a dropdown. Replace with
  directly selectable period tiles and an explicit contextual Add test action.
  `layout.md > Visual hierarchy`: "Group related items"; `entering-data.md >
  Best practices`: "offer choices instead of requiring text entry."
- High: every test's full form is rendered simultaneously. Keep readable
  summaries, open the active form, and preserve the Review → Edit test focus path.
  `layout.md > Visual hierarchy`: "Use progressive disclosure".
- High: small plot marks are difficult to hit and the plot feels unresponsive
  between marks. Add a full-area nearest-point probe, visible crosshair, concise
  local tooltip, arrow-key exploration, Enter pinning and Escape clear.
  `charts.md > Best practices`: "expanding the hit target to include the entire
  plot area".
- Medium: numbers and marks are separate exploration surfaces. Add searchable,
  sortable raw-data rows that share the chart's selected response ID and allow
  full-precision filtered export. `charting-data.md > Best practices` and
  `charts.md > Descriptive content` favor purposeful, gradually revealed detail.
- Medium: 10–12px instructional text and large repeated black headers compete
  with science content. Raise utility text to 13px where practical, use spacing
  and weight for hierarchy, and reserve red for selection/primary actions.
  `typography.md > Ensuring legibility` and `color.md > Best practices`.

These source observations are not a claim of native HIG compliance or a
substitute for assistive-technology testing.

## Compact token plan

Retain Inter and JetBrains Mono: 24px page heading, 16px section heading, 14px
body/control, 13px utility, minimum 11px nonessential caption. Values remain
tabular. Light canvas #F3F5F7, panel #FFFFFF, ink #18222D (16.09:1 on white),
muted #566372 (6.13:1), accent #C5050C (white-on-accent 6.17:1). Scientific dark
canvas #101820, ink #E7EDF4 (15.18:1), muted #9EACBC (7.74:1). Ratios computed
from sRGB luminance, not a screenshot. These are product tokens, not hard-coded
Apple system color values. Dark chart surfaces are intentional; this release
does not claim a complete automatic dark appearance for all existing screens.

## Layout and signature

The period rail is the signature: visible cycle labels, frequency and test
counts, with a restrained sine glyph connecting the control to oscillatory
pumping. It is not a simulated response or decorative looping animation.

Regular: period rail → selected-period toolbar → test summaries/editor | map.

```text
[All] [10 s · 8 tests] [50 s · 2 tests] [+ period]
[Selected period summary                    + test]
[Test 1 form                ][well-role map       ]
[Test 2 compact summary     ][                    ]
```

Compact: scrollable period rail → full-width action → one-column test editor
→ role map in normal flow. Results retain the same plot/inspector relationship;
the enlarged viewer places details beside plots only when space permits.

## Restraint and quality floor

Remove repeated expanded forms and the redundant period-selection dropdown.
Do not add glass to content cards: translucency belongs only to functional
floating controls already present. Brief 160–200ms feedback may emphasize a
new selection; no delayed interactions, fake progress or animated solver data.
Respect reduced motion, reduced transparency, increased contrast, visible
keyboard focus, readable zoomed text and compact layouts. `motion.md > Best
practices`: "Add motion purposefully" and "Make motion optional".

## Release verification

Run TypeScript, frontend regression tests, Python tests and a production build.
Exercise period creation/selection, editing drafts, inactive test expansion,
chart probes/keyboard selection, table selection/filter/sort/export, full-screen
plots, narrow layouts and real Python forward/inversion runs in a temporary
browser tab. Verify v1.4.1 assets are served, stop only QA-owned servers, then
fast-forward `webapp-playground` and push normally (no history rewrite).

Completed checks for this release:

- 56 frontend tests and 40 Python tests passed; TypeScript and the production
  build passed. Python reports one existing Starlette/httpx deprecation warning.
- Real browser runs: geostatistical forward prediction and synthetic joint
  inversion, seed 42, custom 8×8 QA grid, nine tests at 10 and 50 seconds,
  44 response pairs. This is functional QA, not a MATLAB baseline-parity claim.
- Period creation, first test creation inside an empty group, visible selected
  states and single-editor expansion worked. Numbered test search treats
  “Test 9” as one phrase, avoiding accidental matches against other tests' W9.
- Full-area chart clicks, keyboard browsing/pinning, linked amplitude/phase
  selection, convergence inspection, table row selection and actual CSV download
  were exercised. The downloaded row retained raw double-precision phasors.
- Desktop and 390px compact layouts were inspected. Compact navigation occupies
  56px; the page has no horizontal overflow. The table scrolls internally, and
  the enlarged chart places the inspector below the plot on compact screens.
- Fixed selections retain the crosshair/ring and inspector, while the floating
  tooltip disappears to preserve plot visibility. Browser console: no errors.

The requested `dickwu/apple-design-skill` was installed locally and its HIG
foundation, accessibility, charting, motion and input references informed these
changes. Installation is separate from repository dependencies; this app does
not require that skill or any Apple runtime to build or run.

## Follow-up: discoverability and responsive plot sizing

The sweep was technically available but hidden behind a vague collapsed label.
That was a discoverability failure. It now remains visible in Tests & periods,
with a top-of-page shortcut and three explicit methods: Custom list, Linear
increments and Logarithmic spacing. Default scope is the selected test, avoiding
an unexpectedly large Cartesian product. Preview counts, range endpoints,
amplitude rules, validation limits and replacement confirmation remain intact.
Only supporting scientific guidance is collapsed.

Width-only SVG sizing made map and diagnostic heights grow on wide screens.
The shared viewer now caps inline visual height using viewport units, preserves
aspect ratios and viewBox coordinates, and bounds square heatmaps too. Maps use
a near-square canvas, shorter inline height and a compact control grid. Field
and diagnostic grids choose column counts from available content width.
Full-screen plots retain scrolling inspectors and a reachable Close action;
documentation, About and report controls also accommodate compact/short views.
The journey toolbar now occupies a reserved footer strip instead of covering
form actions while the page scrolls. Its center position and expandable guide
remain available.

This applies `layout.md › Adaptability` and
the skill's web-platform foundations. Existing colors, contrast, type and
motion tokens above are retained. The scientific purpose remains inspectable
well responses; no solver, sampling formula or numerical baseline changed.

Follow-up verification: 57 frontend tests, TypeScript and production build
passed. Browser QA exercised all three period entry methods, applied linear
and logarithmic sweeps, and ran real Python forward predictions. Layout checks
covered 1920×1080, 1111×720, 768×1024, 390×844 and 844×390. No workspace horizontal
overflow was found in those checks; inline plots remained bounded, resized
plots still selected the correct response, and enlarged views retained a
reachable Close action. Browser console reported no errors. An existing local
server was reused; no user-owned process was stopped.
