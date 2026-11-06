# v1.5 — reusable experiments and 3D

## Experiment files and links

On Results, **Save & share experiment → Export experiment** offers a complete
`.experiment.csv` and a self-contained share link. The separate **Response-only
CSV** remains a flat data table; it cannot restore a whole experiment.

The complete CSV has RFC-4180 `section,value` records. JSON cells preserve all
nested settings without rounding: experiment name, well coordinates and physical
metadata, test IDs/names/roles/periods/amplitudes, empty period groups, numerical
priors and boundaries, raw observation CSV and provenance, results (including
volumes), and the original generating run for forward-to-inversion transfers.
Do not edit nested records in spreadsheet software that might truncate cells.
This is an exchange/archive file; the flat response export is for spreadsheets.

On Your experiment's first screen, choose the complete CSV or paste a link.
Opening a link also offers an import preview. **Import & review inputs** validates
the archive before replacing personal work (with confirmation if work exists),
opens Review, and never starts a solve automatically. **View saved results** shows
historical outputs. Editing scientific inputs invalidates those outputs as before.
Review → Data & run allows rerunning or changing the declared data source.

Links gzip the same experiment into a URL fragment, without a server-side upload
or network fetch during import. Anyone with a link can decode its contents.
A localhost URL only opens directly on a machine running the app, but its full
link can be pasted into another running copy's import control. There is no cloud
hosting service. Links over 60,000 payload characters are refused with a CSV
fallback; they are never truncated or stripped of results. Import is capped at
32 MB after decompression. CSV version 1 uses explicit format/version metadata;
unsupported versions, mismatched result IDs/shapes and invalid models fail before
state changes. Save an experiment before refreshing; sessions remain in memory.

## Period groups and signal legend

New tests carry their period in their initial name and remain in that period's
group. Review groups cards by exact numeric period; grouping does not rename
existing tests, reassign IDs, merge nearby periods or change API ordering.
Results offers period-group scopes with a subordinate grouped test picker.
The signal map still depicts one pumping test at a time; previous/next navigates
the tests within the selected scope.

The size legend sits inside the signal SVG, including in enlarged view, so its
circles scale with the actual markers. It uses the exact marker-size function:
log mode scales **radius**, and linear mode scales **area above a visible minimum**.
Reference values and units are shown. The scale is fixed across all tests for
the chosen predicted/measured source. The planar map uses raw arg(real + i·imag).
The 3D map defaults to relative phase delay in seconds and also offers raw phase.
Pump symbols are not head values.

## Paper-informed 3D signal map

The visual reference is Figure 4 (PDF page 7) of Cardiff et al.,
[Aquifer Imaging with Oscillatory Hydraulic Tomography: Application at the Field Scale](https://www.boisestate.edu/wp-content/uploads/sites/290/2020/01/Cardiff-et-al-2019-OHT-field-scale-online-gwat.12960.pdf#page=7),
DOI 10.1111/gwat.12960. It shows vertical well traces, distance/elevation axes,
a square pumping symbol, amplitude-sized receiver circles and relative phase
delay colors. Our map follows those encodings with actual configured point ports;
it does not reproduce that field dataset or imply the same site geometry.

For the solver convention `h(t) = Re[Φ exp(iωt)]`, the derived display delay is
`mod(reference phase − receiver phase, 360°) × period / 360°`. An explicit receiver
can be selected as reference. Automatic reference takes the first phase after
the largest circular gap, giving the smallest covering arc. This is a display
convention, not an inferred first arrival or groundwater travel time. Delay is
ambiguous modulo one pumping cycle; its color range is per test. Zero-amplitude
phasors have no defined phase and are excluded from the delay reference.

The equal-scale scene includes numeric XYZ rulers, floor/back grids, model edges,
coincident-XY port guides, amplitude and color legends, test/source context,
hover/click/keyboard inspection and drag-to-orbit controls. XY/XZ/YZ views project
all ports; they are not spatial slices and can overlap. Enlarged view retains the
camera controls and shows test context and selected values beside the plot.

Optional vertical datum, ground-surface Z and water-table Z are entered by the
user in Site context. Unknown planes are absent. These annotations do not change
the solver, impose a water-table boundary or invalidate existing results. Lines
between ports are geometry guides, not simulated casings or screened intervals.

## 3D scientific contract

Scientific source inspected: upstream
[testing_inversion_3D_geostat.m](https://github.com/wischydro-cardiff/oscillatory-tomography/blob/7aa7146ec4d7dce63f0a4a6922ed458d6df56d5f/testing_inversion_3D_geostat.m).
The Python finite-volume, interpolation, forward, analytic sensitivity, covariance
and inverse solvers already accept 3D. This update exposes those existing paths
through the API instead of implementing an independent solver in React.

- Select **3D · spatial volume** in Model dimensions. Define X/Y/Z extents, Nx/Ny/Nz,
  Z correlation length and inline well Z coordinates. Z is local elevation,
  positive upward, with a shared datum. Wells are point ports, **not** simulated
  screened intervals or borehole-integrated responses. K is isotropic.
- All six faces accept zero-head-perturbation or no-flow boundaries. At least
  one constant-head face is required by the adapter. Top is maximum Z; bottom
  is minimum Z. Wells must lie within outer cell centers for the existing IDW.
- Interactive limits: 30 ports; 2D and inversion support 30 tests / 100 response
  pairs. 3D forward supports 108 tests / 1,500 pairs; 8,000 total 3D cells
  for forward, 3,600 for inversion. No silent coarsening. Transfer allows explicit
  inverse Nx/Ny/Nz changes while preserving original generating data and geometry.
- The 3D checkerboard follows the upstream 15 m x/y/z sign(sin) formula with
  means −9.2 / −11.2 and jumps 1 / 0.05. Geostatistical generating covariance
  has lengths 20 / 20 / 4 m and variances 4 / 0.1. Inverse priors use configured
  X/Y/Z lengths. Custom NumPy seeds reproduce Python fields. The supplied 3D presets use frozen MATLAB-generated legacy seed-0 truth on their matching meshes.
- API volumes use `[z][y][x]`; the scientific core retains MATLAB/Fortran
  y-fastest ordering. Existing 2D field keys contain a middle-slice compatibility
  view in 3D. Volume RMSE uses **all cells**, not the middle slice.
- Result fields offer rotatable three-plane cell-center slices and horizontal
  layer inspection. Signal maps project actual 3D ports with equal spatial scale,
  amplitude marker sizes, phase colors, inspection and enlargement. There is no
  interpolation or fictitious continuous hydraulic signal surface between wells.
- Black–Kipp remains a **2D** homogeneous confined-aquifer analytical benchmark.
  The API rejects its use as a 3D analytical comparison. Existing 2D presets and
  scientific paths remain unchanged.

The upstream full 3D run is 20³ cells, 27 ports, four periods (5/10/50/100 s),
104 pumping setups and 1,404 response pairs. Its full inversion exceeds this
interactive API budget. These features do **not** claim exact full MATLAB baseline
parity, and no reduced web run should be described as that baseline.

## MATLAB 3D example library

**Examples → Professor’s MATLAB example** offers two paths, each with a saved
computed preview and editable inputs:

| Path | Mesh | Acquisition | Run mode |
| --- | --- | --- | --- |
| Original configuration | 20³ = 8,000 cells, 4 m edges | 27 point ports; 104 tests; 1,404 complex responses | Full Python forward |
| Quick recovery | 8³ = 512 cells, 10 m edges | Same 27 port positions; central W14 pump; 14 observers; 4 tests / 56 responses | Python synthetic inversion |

Both use the −40…40 m domain, periods 5/10/50/100 s, Qmax = 0.01π/P m³/s,
six zero-perturbation constant-head faces, geostatistical field statistics and
MATLAB-generated legacy seed-0 reference truth. The quick observers are the six axial and eight corner ports. Its
coarser field realization and acquisition are explicitly different from the full
case. Its truth is generated in MATLAB on that reduced mesh, rather than resampled from the full field. The 3D MATLAB
script's boundary comment is stale: its executable `bdry_types` sets all six to 1.

**View forward results / View recovery results** load genuine saved Python
results directly into Results. **Load original inputs / Load quick inputs** begin
at Wells & model and follow the existing five-stage workflow. Personal work stays
separate. Preview replacement has an in-app confirmation with Cancel, Escape and
outside-click dismissal. A provenance banner distinguishes saved previews from
fresh runs; result archives and reports retain generation metadata. Editing
scientific inputs invalidates the saved output as usual.

Canonical inputs live in `web/src/data/matlab3dConfig.json` and
`matlab3dQuickConfig.json`. Regenerate both preview artifacts from the repository
root (PowerShell):

```powershell
.\.venv\Scripts\python.exe scripts/generate_web_3d_examples.py
```

Artifacts record the exact configuration, generation time, upstream source and a
SHA-256 of the Python source tree. They are loaded as separate chunks on demand.
Full 3D forward runs batch same-period pumps through the core's existing shared
frequency solves; completion events follow actual batch completion. The inverse
kernel and its original limits remain unchanged. Full 8,000-cell / 1,404-response
inversion remains outside the interactive budget, and is never silently reduced.

## Validation

`tests/test_web_3d.py` compares the adapter to the existing 3D solver, verifies
vertical distances, reciprocity/rate scaling, deterministic generating fields,
volume ordering, finite checkerboard/geostatistical inversion and boundary/size
rejection. Existing 2D tests remain required. Frontend archive tests cover Unicode,
full precision, well metadata, source provenance, link and CSV round trips,
3D volumes, corrupt archives, exact period identity and numerical marker legends.

Browser checks cover CSV/link import → review → real forward run, saved results,
signal size-mode switching, 3D slice/rotation controls, keyboard point inspection,
whole CSV download, share-link import and responsive layouts. Test grids are small
functional checks. Independent MATLAB comparisons, numerical corrections and acceptance criteria are documented in [MATLAB_PARITY.md](MATLAB_PARITY.md). Full 3D inversion parity is not claimed.

Design applies the installed Apple Design skill's charting-data/charts, entering-data,
layout and accessibility principles to the existing web theme. Data controls stay
labelled, numerical scale semantics are explicit, and share/import preserve user
review before any solver action.
