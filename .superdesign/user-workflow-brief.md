# New user workflow proposal

Create a desktop-first scientific experiment workspace, not an example chooser landing page.

1. Wells & model: first screen asks users to locate physical wells on a coordinate map or through an inline-editable table; roles are not assigned yet. Domain, cell sizes/discretization and boundary conditions are clearly grouped below.
2. Tests & periods: define one pump with selected observers per setup; apply a linear range/increment, logarithmic range/count or explicit list of periods without redefining wells. Editable peak pumping amplitude with accurate units and brief notes.
3. Review: verify wells, grid, assumptions, all test setups and period/amplitude settings.
4. Data & run: forward-model simulation, or user-supplied observations for inversion. Synthetic forward outputs can be transferred into the observation-input schema with clear provenance.
5. Results: numerical responses, optional applicable Black–Kipp comparison, interactive plots and full export. Offer Use these synthetic responses for inversion with explicit source/target grid confirmation and preserved raw complex values.

## What to design now
A polished first-screen desktop prototype at 1440px wide, using real existing theme. Main heading Your experiment / Define wells & model. Empty-state well placement map with physical axes and discreet grid; no fabricated field wells already present. Table/add-well controls alongside it. Domain/cell-size card and boundary controls below. Show illustrative defaults only for domain and grid, labeled editable starting values, not site measurements.
Sidebar: Your experiment active, Examples, Documentation, About. Examples opens a lightweight practice panel with Black–Kipp first and P=10 checkerboard second. Clarify examples do not overwrite personal work. Header Help & Glossary and Reset.
A small translucent bottom-centered Journey guide with 5 stages; first stage active, future stages locked. Expand it to a contextual explanation of what users do now and why. Give a small optional preview of the forward → observations → inversion connection inside the teaching card, not a competing second navigation bar.
Make the UI English to match the current app. Accessible focus and comfortable input sizing. Keep Continue visible and disabled until at least two valid physical wells exist. No claims that a prototype executes the solver, no fake results, no data-upload feature unless supported by existing code.

## Acceptance for later implementation
Personal project and examples retain separate state. Forward-to-inversion transfer preserves well/test IDs and raw complex values; changed grids require explicit confirmation. Existing baseline paths and scientific outputs remain intact. Blank inputs remain editable. No advance navigation bypasses validation.
