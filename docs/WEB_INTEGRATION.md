# React/Python integration

## Layout

| Path | Responsibility |
| --- | --- |
| `web/src/components/steps/` | React configuration, review, run, and results screens |
| `web/src/api/analysis.ts` | Typed request construction and measurement CSV parsing |
| `src/oscillatory_tomography/api.py` | Input validation, well/test mapping, HTTP response serialization |
| `src/oscillatory_tomography/grid.py` | Physical well interpolation and frequency grouping |
| `src/oscillatory_tomography/forward.py` | Actual complex periodic pressure responses and sensitivities |
| `src/oscillatory_tomography/inversion.py` | Geostatistical inverse solver when measured phasors are supplied |
| `tests/test_api.py` | Multi-test mapping, validation, HTTP contract, and inverse check |

The frontend retains physical wells independently of test-specific pumping and
observation assignments. The adapter maps stable well IDs to the solver's
one-based well numbers, sorts rows by angular frequency and pumping well, then
maps the computed complex responses back to their original test/well identities.
It returns responses in the user's test order.

## Analysis semantics

`POST /api/v1/analyze` accepts the grid, wells, tests, boundary conditions,
initial log-conductivity and log-storage, and optional measurements. Each test
uses one pumping well, one or more selected observation wells, its own period
in seconds, and a pumping amplitude in m³/s. The solver uses a one-layer,
unit-thickness domain with no-flow top/bottom boundaries. Horizontal boundary
conditions are configurable. Well coordinates must lie within the outer cell
centers because the solver's interpolation stencil cannot reach beyond them.

The explicit `analysisMode` controls the data semantics. `forward` returns
complex predictions and pair geometry without claiming a spatial estimate.
`measured_inversion` requires one real/imaginary value for every configured
test-observation pair. `synthetic_demo` recreates the original P=10
checkerboard truth and generates its observations before inversion. Inversion
responses include estimated fields, synthetic truth/error fields when
applicable, final-Jacobian sensitivity coverage, response diagnostics, and the
accepted objective history. The measurement CSV header is
`testId,wellId,real,imag`.

The run screen uses `POST /api/v1/jobs` followed by `GET /api/v1/jobs/{id}`.
This local single-process queue reports actual completed forward tests and
inversion iterations, but does not support cancellation or survive a server
restart. Black–Kipp mode performs forward solves and adds analytical amplitude,
phase, errors, and effective diffusivity/transmissivity/storativity for each
pair. Its web preset is a reduced
interactive subset of the full Python/MATLAB benchmark, not a claim of
300×300-grid numerical equivalence.

The API limits grids to 3–60 cells per axis, 30 wells, 30 tests, and 100
test-observation pairs. These are application bounds, not scientific limits of
the package; they keep synchronous local HTTP requests manageable. Larger
jobs should use an asynchronous worker and persistent result storage.

## Current scope and next work

- The React results table, CSV, and report all read the same API result.
- The report exporter uses one canonical report object for PDF, DOCX,
  Markdown, HTML, plain-text, and JSON downloads.
- Both P=10 tomography and Black–Kipp have working web presets and plotted
  solver responses. The P=10 synthetic demo produces the original four-field
  comparison plus error, sensitivity, residual, and convergence views.
- Raw pressure time-series ingestion, phase extraction, uncertainty fields,
  long-running job control, and persistent experiments are future work.
- `maxIterations`, data error variance, and correlation lengths affect the
  inversion. The P=10 preset exposes the baseline iteration ceiling of 30 in
  Step 2 under "Boundary Conditions, Inversion Priors & Solver Controls"; the
  tolerance checks can stop the solver earlier. A forward-only run uses the
  initial ln(K)/ln(Ss) fields.
- The UI polls an in-process solver job. Closing the browser stops polling,
  but does not stop the Python solve. Do not treat browser navigation as solver
  cancellation.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
cd web
npm ci
npm run typecheck
npm run build
```

The backend tests include a true forward solve with the same well changing
roles between tests, a complete-measurement inverse solve, and a real HTTP
request through FastAPI's test client. The React build verifies TypeScript and
bundling. The local browser workflow was also exercised from configuration
through a returned forward result.
