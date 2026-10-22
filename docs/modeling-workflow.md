# Example setup and experiment design

The v1.3 user workflow starts with **Your experiment** and no pre-entered site
wells. Define physical well positions and domain assumptions, configure tests
and periods, review, run, then inspect results. The numerical methods and both
baseline presets are unchanged. Optional sidebar examples teach Black–Kipp
first, then checkerboard tomography. Practice and personal experiments have
separate session state; merely browsing or loading an example does not overwrite
personal work. Example coordinates are not surveyed site data.

## Geometry, discretization, and boundaries

Enter all well positions in one local Cartesian system in meters. Translate a
surveyed/projected coordinate system to a common local origin if needed; do not
enter latitude/longitude degrees directly. The model is one horizontal layer,
with unit thickness and no-flow top/bottom.

Discretization means representing the domain with uniform cells. You may set Nx
and Ny directly, or request physical cell sizes. Requested sizes convert to
ceil(domain length / target size) cells, with actual sizes shown before applying.
No mesh refinement or solver change happens automatically. Compare resolutions
and domain extents to assess discretization and boundary effects.

Constant head fixes the oscillatory perturbation to zero at an edge; it does not
assert that groundwater elevation is zero. No flow imposes zero normal flux.
Choose these from the conceptual site model rather than treating them as tuning
controls. This implementation requires at least one horizontal constant-head
edge. The Black–Kipp reference assumes a homogeneous, infinite lateral domain,
whereas the numerical model has finite edges; comparisons can differ, especially
when boundary effects are significant.

## Periods and pumping amplitude

P is a full oscillation period in seconds; f = 1/P Hz. It is not the logger
sampling interval or total test duration. Qmax is the peak harmonic pumping-rate
amplitude in m³/s, not a cycling volume or peak-to-peak amplitude.

Each test card exposes P and Qmax. Changing P directly keeps Qmax fixed. The sweep
builder repeats selected pump/observer assignments over a linear range, a
logarithmic range, or an explicit list. Linear sweeps include the end point even
when the final increment is shorter. Preview the generated values before applying.
Applying requires confirmation and replaces the test list, not the wells or model.

Amplitude options are fixed Qmax or fixed cycling volume V, with Qmax = πV/P.
The latter is the rule in `examples/testing_inversion_2d_geostat.py`; it is not
an automatic assumption for arbitrary field experiments.

Original presets remain unchanged: Black–Kipp uses 20 log-spaced periods from 10
to 10,000 s; tomography starts with P=10 s. Generating another test list makes a
custom experiment. Current API safeguards remain 30 tests, 30 wells, and 100
response pairs. Eight original tomography setups × two periods = 72 pairs; three
periods would exceed the limit at 108 pairs. Reduce the selected setups/observers
or periods rather than silently dropping data. The original seven-period MATLAB
experiment across all eight setups is not supported in a single web run under
these limits.

## Forward output as inversion input

After a forward run in either pathway, choose **Use these responses for
inversion** in Results. This transfers actual full-precision predicted real/imaginary
heads, not rounded chart labels, preserving geometry, test IDs, roles, periods,
amplitudes and boundaries. Confirm the inverse grid (3–60 cells per axis). If it
differs from the generating grid, explicitly acknowledge discretization effects.
The original forward configuration/result is retained separately, and report
metadata record source and inverse grid counts. The observations are not resampled.
Continue through Review and explicitly run imported-data inversion; nothing
starts automatically. The export/import CSV path remains available as well.
Editing configuration clears the imported CSV and its automatic source link.
Changing the CSV or declaring another data origin also clears the source link.
This is a noise-free consistency exercise, not field validation or a demonstration
of independent recoverability. Exact starting properties may produce zero residual
in one inverse update; that is expected for this consistency exercise.

Forward prediction uses a homogeneous initial K/Ss model. It is not the
checkerboard truth generator. To reproduce the original heterogeneous P=10
baseline, use the separate checkerboard practice example and its synthetic-demo
mode. A Black–Kipp analytical benchmark and the checkerboard inverse problem
therefore remain scientifically distinct while sharing one user workflow.

The session state is in memory, not a persistent project store. Refreshing closes
the session; export reports/data you need to retain. A running solver locks
workspace navigation, reset and model changes to prevent orphaning the job.

Field data require processed steady-periodic real/imaginary heads in meters with
a consistent pumping phase reference. Raw logger/time-series processing is not
implemented. Import provenance is user-declared; the program cannot verify it.

## Development and built views

Port 8000 serves `web/dist` produced by `npm --prefix web run build`.
Port 1234 serves the live React development source and uses Python on 8000 for
calculations. Stop an old frontend terminal before starting `npm --prefix web run
dev`. The launcher keeps port 1234 explicit and moves old generated dev output to
the ignored `web/.parcel-dev-backups/` folder to avoid stale Windows Parcel output. Never
confuse an old dev server or cached tab with the new production build.

## Scientific references

- USGS, [System and Boundary Conceptualization in Ground-Water Flow Simulation](https://pubs.usgs.gov/twri/twri-3_B8/).
- USGS, [Documentation for the MODFLOW 6 Groundwater Flow Model](https://pubs.usgs.gov/publication/tm6A55): numerical grid and boundary concepts, not a claim that this app uses MODFLOW.
- Black and Kipp (1981), [Determination of hydrogeological parameters using sinusoidal pressure tests: A theoretical appraisal](https://doi.org/10.1029/WR017i003p00686).
- Cardiff et al., [Strategies for avoiding errors and ambiguities in the analysis of oscillatory pumping tests](https://www.sciencedirect.com/science/article/abs/pii/S0022169416304073).
