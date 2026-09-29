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

Without measurements, the API returns only predicted complex phasors,
amplitudes, phases, and pair geometry. It does not claim to have estimated a
spatial parameter field. With one measured real/imaginary pair for every
configured test-observation pair, it runs the quasi-linear geostatistical
inverse solver and returns estimated ln(K) and ln(Ss) grids, predictions,
residuals, iteration count, and objective value. The UI CSV header is
`testId,wellId,real,imag`.

The API limits grids to 3–60 cells per axis, 30 wells, 30 tests, and 100
test-observation pairs. These are application bounds, not scientific limits of
the package; they keep synchronous local HTTP requests manageable. Larger
jobs should use an asynchronous worker and persistent result storage.

## Current scope and next work

- The React results table, CSV, and report all read the same API result.
- The Black–Kipp analytical example is still run through the Python CLI, not
  through the web API. Its card is disabled in React.
- Raw pressure time-series ingestion, phase extraction, uncertainty fields,
  long-running job control, and persistent experiments are future work.
- `maxIterations`, data error variance, and correlation lengths affect the
  inversion. A forward-only run uses the initial ln(K)/ln(Ss) fields.
- The UI calls the API synchronously. Closing the browser aborts the client
  request, but the server computation may continue until its current solve
  finishes. Do not treat browser cancellation as solver cancellation.

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
