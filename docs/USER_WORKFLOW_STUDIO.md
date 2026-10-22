# User workflow studio (web v1.3.0)

## Architecture boundaries

- `App.tsx` coordinates two in-memory ExperimentSession instances (personal/practice),
  validated stage navigation and utility dialogs. Browsing the library never
  loads a preset into the personal session.
- `utils/experimentWorkflow.ts` owns blank-session creation, preset cloning,
  geometry/test gates and the forward-to-inversion transfer contract.
- `Step2ConfigureModel` reuses the original well/test editors in explicit
  positions/tests stages; it does not implement an alternative numerical model.
- `JourneyGuide` is the single compact stage navigator/teaching popover.
- `InversionTransfer` uses a native modal dialog (focus/inert/Escape), previewed
  validation and an explicit changed-grid acknowledgement.
- `RunInput` is session-owned so returning to review does not lose an uploaded
  CSV or silently change data origin. A changed experiment invalidates its result
  and imported CSV. A modified CSV/origin invalidates its automatic source link.
- `Step4RunAnalysis` still submits the existing API schema; progress is reported
  by Python, not fabricated. Session changes/reset are locked while solving.
- Existing field/response charts, inspection/enlargement and report formats remain.
  Diagnostics without underlying data are not shown as empty plot tabs.

## Scientific contract

The legacy `testCase` API field is a numerical pathway selector, not a user's
project identity. No Python algorithm, baseline parameter or phase convention
is changed. Both forward pathways can supply synthetic phasors to the existing
imported-observation inverse solver. That does not turn homogeneous forward
predictions into a heterogeneous checkerboard truth experiment.

Handoff validates response completeness, unique pair IDs, finite raw complex
values, source grid, pump roles, periods and rates. It clones source data and
retains exact geometry/boundaries. The target inverse grid is explicit and may
not exceed 60 cells per axis; grid differences are acknowledged and recorded.
Changing a grid does not resample observations or establish baseline parity.

## Validation

Run `npm --prefix web test`, `npm --prefix web run typecheck`,
`npm --prefix web run build` and `.venv/Scripts/python.exe -m pytest -q`.
Frontend regression tests cover isolated sessions, reset cancellation, gated
navigation, review-to-test focus intent, editable numeric inputs and exact
forward-data transfer. Python tests exercise the unchanged solver/API contract.

Manual browser QA additionally covers full-height sidebar, independent scroll,
period sweep, real forward → inverse execution, changed-grid confirmation,
input provenance, plot enlargement and guide dismissal. These checks are not
a claim of independent MATLAB or field-data validation.
