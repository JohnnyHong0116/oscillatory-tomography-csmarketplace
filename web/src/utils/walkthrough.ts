import { StepId } from "../types/aquifer";
export interface TourStop {
  selector: string;
  title: string;
  text: string;
}
/** Current-page explanations only: no edits, submissions or workflow bypass. */
export const pageTours: Record<StepId, TourStop[]> = {
  1: [
    {
      selector: '[data-tour="well-entry"]',
      title: "Place your physical wells",
      text: "Enter a name and local X/Y coordinates in meters. In 3D, enter Z as elevation using a common datum. Add each real well here; pumping and observation roles are assigned separately for each test on the next screen.",
    },
    {
      selector: '[aria-label="Physical well positions in local coordinates"]',
      title: "Check the well layout",
      text: "Compare this map with your site. Select a well and use its edit control for exact coordinates. All wells share the same local coordinate origin.",
    },
    {
      selector: '[data-tour="spatial-wells"]',
      title: "Inspect the 3D layout",
      text: "Drag to rotate, Ctrl-drag to pan, and scroll to zoom. The cube switches between standard views. Select a well to check its coordinates or double-click to edit.",
    },
    {
      selector: '[aria-label="Cell size and boundary conditions"]',
      title: "Choose resolution and boundaries",
      text: "Cell size sets spatial discretization. Constant-head and no-flow edges are modeling assumptions. Use site knowledge and resolution/domain checks; smaller cells do not automatically improve accuracy.",
    },
    {
      selector: '[data-tour="solver-settings"]',
      title: "Starting properties and solver controls",
      text: "Open this section after leaving the tour to set initial ln(K), ln(Ss), inversion priors and iteration budget. Continue to Tests becomes available when well and model checks pass.",
    },
  ],
  2: [
    {
      selector: '[aria-label="Period groups"]',
      title: "Switch periods beside the editor",
      text: "This toolbar stays visible while editing. Select a period group to see its tests. Add test inherits that period. Create a new group to configure another period.",
    },
    {
      selector: '[aria-label="Multi-period experiment builder"]',
      title: "Build a period sweep",
      text: "Choose Custom list, Linear increments or Logarithmic spacing. Select a well setup and amplitude rule, inspect the preview, then apply. Applying replaces tests after confirmation; wells stay in place.",
    },
    {
      selector: '.test-editor:has([aria-expanded="true"])',
      title: "Configure a pumping test",
      text: "Set cycle period P and peak pumping amplitude Qmax. Choose exactly one pump and at least one observer. Every test keeps its own roles, period and amplitude.",
    },
    {
      selector: '[data-tour="test-map"]',
      title: "Verify the assigned roles",
      text: "Check the active test’s pump, observers and unused wells on this map. Then use Proceed to Review Inputs when the test checks pass.",
    },
  ],
  3: [
    {
      selector: '[data-tour="review-readiness"]',
      title: "Resolve readiness checks",
      text: "Review validation messages before running. Fix errors in the appropriate configuration screen; this tour cannot bypass readiness checks.",
    },
    {
      selector: '[data-tour="review-summary"]',
      title: "Review the scientific setup",
      text: "Check the domain, grid, hydraulic assumptions and response count. Confirm this describes the experiment you intend to run.",
    },
    {
      selector: '[data-tour="review-tests"]',
      title: "Check every test",
      text: "Verify pumping/observation assignments, periods and amplitudes. Edit test returns to that exact test. Select Continue to Data & run after the readiness checks pass.",
    },
  ],
  4: [
    {
      selector: '[aria-label="Analysis data source"]',
      title: "Choose the data pathway",
      text: "Forward prediction calculates responses. Synthetic recovery generates test data and inverts it. Imported phasors use supplied complex observations. Synthetic checks are not field validation.",
    },
    {
      selector: '[aria-label="Measured phasors CSV"]',
      title: "Supply processed observations",
      text: "Match each response to its test and observation well. Preserve real/imaginary heads, units and provenance. Resolve import validation before starting inversion.",
    },
    {
      selector: '[data-tour="run-progress"]',
      title: "Follow actual solver progress",
      text: "After starting a run, progress reflects Python solver stages. Configuration is locked while solving. The tour does not start a calculation.",
    },
    {
      selector: '[aria-label="Solver events"]',
      title: "Read execution events",
      text: "This console records test execution and inversion events. Once results are ready, Explore results opens the maps, fields and diagnostics.",
    },
  ],
  5: [
    {
      selector: '[data-tour="result-scope"]',
      title: "Choose responses to inspect",
      text: "Use the results scope to select a period, a test, or all responses. In a joint inversion, test selection filters response diagnostics; parameter fields remain the one joint estimate.",
    },
    {
      selector: '[data-tour="result-plots"]',
      title: "Explore the actual output",
      text: "Change plots with these tabs. Hover or click to inspect, use arrow keys and Enter to pin values, or enlarge a plot. The signal map uses marker size for amplitude. In 3D, choose relative phase delay or raw phase for color. Open Slice positions to adjust X, Y and Z for volume fields.",
    },
    {
      selector: '[data-tour="result-export"]',
      title: "Export results",
      text: "Export response CSV for numerical data, or Generate report for a formatted summary. Save & share experiment creates a complete CSV or share link.",
    },
    {
      selector: '[data-tour="save-experiment"]',
      title: "Save the experiment in a folder",
      text: "Save the current setup, observations, and results. Choose a folder and add tags. Open Folders in the sidebar to find and resume experiments saved on this computer.",
    },
    {
      selector: '[aria-label="Forward result actions"]',
      title: "Continue from forward output",
      text: "Transfer full-precision forward responses as explicitly labeled synthetic inversion input. Review the inversion grid first. Synthetic recovery checks consistency, not independent field validity.",
    },
  ],
};
export interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
/** Bounded, non-overlapping explanation placement, including short viewports.
 * Tall sections highlight the visible part above the card. */
export function tourLayout(
  rect: TourRect,
  vw: number,
  vh: number,
  cardWidth: number,
  cardHeight: number,
) {
  const pad = 12,
    gap = 12,
    width = Math.min(cardWidth, vw - 24),
    height = Math.min(cardHeight, vh * 0.46);
  const left = Math.max(pad, Math.min(rect.left - 6, vw - pad - 24));
  const top = Math.max(pad, Math.min(rect.top - 6, vh - pad - 24));
  let box = {
    left,
    top,
    width: Math.max(24, Math.min(rect.width + 12, vw - left - pad)),
    height: Math.max(24, Math.min(rect.height + 12, vh - top - pad)),
  };
  let x = Math.min(left, vw - width - pad),
    y = box.top + box.height + gap;
  if (y + height > vh - pad) {
    if (box.top - height - gap >= pad) y = box.top - height - gap;
    else {
      y = vh - height - pad;
      x = vw - width - pad;
      const nextTop = Math.min(box.top, y - gap - 24);
      box = {
        ...box,
        top: nextTop,
        height: Math.max(24, Math.min(box.height, y - gap - nextTop)),
      };
    }
  }
  return {
    box,
    card: {
      left: Math.max(pad, x),
      top: Math.max(pad, y),
      width,
      maxHeight: height,
    },
  };
}
