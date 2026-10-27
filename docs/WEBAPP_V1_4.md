# Webapp v1.4 — grouped experiments and spatial signals

Branch: `webappv1.4`, based on `user-workflow-studio`. React/Parcel/Tailwind and
the existing Python forward, sensitivity, covariance and inverse algorithms are
retained. No preset numerical values or main workflow stages are changed.

## Period groups

`utils/periodGroups.ts` derives sorted groups from exact numeric test periods.
It does not round/merge nearby periods, renumber IDs, reorder the submitted API
tests, or change pumping rates. UI-only `ModelConfig.periodGroups` preserves
intentionally empty groups in the current session; these are not solver jobs.
The group dropdown filters tests, and Add test to group explicitly sets its
period. New groups with existing periods open the existing group instead.

All-tests view shows period headings with contextual add actions. A period
input remains mounted while edited; clearing it yields a visible invalid draft,
not an injected zero or a disappearing card. Moving to another period takes
effect after blur. Review's Edit test reveals that test even across groups.
The optional period sweep still previews and confirms replacement of actual
tests; it clears obsolete organizational groups on apply. Existing 30-test and
100-response-pair limits are retained and validated before running.

This follows progressive disclosure for the optional bulk builder, while
keeping primary group/add controls visible. The motivation is reduced clutter,
not hiding validation or mandatory input:
[NN/g: Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/).

## Signal map

`SignalMap.tsx` renders exactly one test, never a merged multi-pump experiment.
Coordinates have equal x/y physical scale. Triangles identify the pump, circles
identify receivers, and small gray markers identify unused/unavailable wells.
No head response is fabricated at the pumping well. Marker size uses a fixed
across-tests scale for the selected source: logarithmic radius by default, or
linear amplitude/area above an explicitly disclosed minimum visible size.

Complex amplitude is `hypot(real, imag)`. Cyclic color represents
`atan2(imag, real)` in degrees, not the Black–Kipp comparison's separately wrapped
negative-argument phase delay. Phase is undefined at zero magnitude. There is
no spatial interpolation or suggestion that these discrete values are a
recovered aquifer property map.

Forward results default to the map and predicted heads. When observations
exist, the map defaults to those; a selector switches to model predictions.
Imported field measurements and synthetic observations are labelled separately.
Test arrows/dropdown, hover/focus, click/Enter pinning, selection reset on test
change and the existing accessible enlarged viewer are retained.

The configuration role-map's follow-card translation is desktop-only. Mobile
single-column layout uses normal flow so it cannot cover the bottom Continue
button. QA verifies both 375px no horizontal overflow and first-click bottom
navigation after adding a test in a new period group.

OHT uses periodic sources and receiver amplitude/phase observations; this map
displays those point responses rather than a transient pressure-wave simulation:
[Cardiff et al. (2019), Aquifer Imaging with OHT](https://www.boisestate.edu/wp-content/uploads/sites/290/2020/01/Cardiff-et-al-2019-OHT-field-scale-online-gwat.12960.pdf).

## Synthetic truth selection

`synthetic.py` exposes the two branches already in
`examples/testing_inversion_2d_geostat.py`. It reuses the existing covariance
realization routine and Fortran cell ordering. Original example code remains
an independent reference for parity tests.

| Truth | Original generating parameters |
| --- | --- |
| Checkerboard | ln(K) mean −9.2, ln(Ss) mean −11.2; x/y check lengths 10 m; jumps ±1 and ±0.05 |
| Geostatistical | Same means; exponential covariance, x/y correlation lengths 20 m; variances 4 and 0.1; explicit NumPy random seed (default 0) |

Generating statistics are distinct from inverse starting values and inverse
covariance priors. Seed + grid reproduces Python realizations, not MATLAB RNG
draws. The random generator is local to each request, so concurrent calls do
not share global RNG state. No independent per-test field is generated: all
tests in one run use the same truth realization.

The API accepts optional `syntheticField` and bounded integer `syntheticSeed`.
Omitting them preserves old-client behavior: homogeneous forward or checkerboard
synthetic inversion. Heterogeneous fields are rejected for the homogeneous
Black–Kipp analytic comparison and imported-data inversion. Synthetic forward
returns truth and generation metadata but no invented measurements, fit errors,
inverse objective or estimated field. Synthetic recovery returns actual truth,
estimate, field error and fit diagnostics. Reports record generation parameters
and seeds; direct forward transfer retains raw phasors and generating provenance.
Imported CSV does not automatically acquire ground-truth error metrics.

## Verification

```powershell
npm --prefix web run typecheck
npm --prefix web test
.\.venv\Scripts\python.exe -m pytest -q
npm --prefix web run build
```

New tests cover exact field equality against both original Python branches
(including 50×50), seed repeatability and changes, API modes/rejections, raw
forward-to-inverse transfer, exact period grouping and editable drafts, marker
scales/phase wrapping/zero signals, source labels, maps/enlargement, metadata
and forward-versus-inverse metrics. Browser QA uses small custom grids; it is
functional verification, not a claim of full 30-iteration MATLAB result parity.

Dependency audit during this update reported two pre-existing transitive
advisories (`dompurify` critical; `source-map-js` high). No dependency upgrade is
silently bundled into this scientific/UI change; these remain follow-up work.
