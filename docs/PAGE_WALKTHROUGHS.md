# Contextual page walkthroughs

The optional journey guide explains the current experiment screen by spotlighting
one actual section at a time. It never edits configuration, changes a workflow
stage, submits an analysis or bypasses validation. Each page has its own stops;
conditional UI such as the imported CSV is included only when present.

The design follows the installed Apple Design skill's web foundations and its
`onboarding.md › Best practices`: “consider making it optional”, and
`modality.md › Best practices`: “Always give people an obvious way to dismiss a
modal view.” Existing brand, contrast and typography tokens remain unchanged.
The single task is explaining an oscillatory-tomography screen in place.

- Click the bottom guide to dim the screen and highlight the first section.
- Next/Back visit sections of this page. Done finishes; Skip, Close, Escape or
  clicking the dimmed backdrop exits immediately. No tour launches automatically.
- Minimize journey guide replaces the bar with a 46px circle at bottom right.
  Back to top is a separate centered control. Clicking the circle restores the
  bar and opens the current-page tour. Minimized state survives ordinary screen
  and workspace changes during this app session.
- The native modal top layer makes underlying controls inert. Tab/Shift+Tab
  remain in the explanation; closing returns keyboard focus to the launcher.
- A viewport-bounded card keeps Close, Skip and navigation visible. Long text
  scrolls inside the card. Section geometry is remeasured on scrolling and
  resizing. Very tall sections highlight the visible part above the explanation.
- Target scrolling is immediate rather than animated; motion never carries
  required information. Reduced transparency has an opaque launcher variant.

Implementation: `utils/walkthrough.ts` owns page content and pure placement;
`PageWalkthrough.tsx` owns the modal/spotlight; `JourneyGuide.tsx` owns the launcher.
Stable `data-tour` attributes or semantic section labels connect stops to the
rendered UI. `App` owns minimization preference. The separate footer strip keeps
guide controls from covering forms.

Verification includes placement bounds/non-overlap at desktop, phone and short
landscape sizes; actual Next/Back/Skip/Done/Close/Escape callbacks; preference
retention; browser focus, spotlight movement, resizing and dismissal checks.

Release checks: 61 frontend tests passed, TypeScript passed, and the production
build passed. Browser QA completed all five page tours, including the optional
CSV stop and forward-result transfer stop; exercised Next/Back/Done/Skip/Close,
Escape, backdrop dismissal, minimize/reopen and bidirectional Tab wrapping.
Desktop, 390×844 portrait and 844×390 landscape were checked; resize now reveals
the actual target again before remeasuring. A real Python forward run supplied
the result-page QA data. No scientific input or solver code changed.
