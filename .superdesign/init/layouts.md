# Existing shell sources
## web/src/App.tsx

```tsx
import React, { useLayoutEffect, useRef, useState } from 'react';
import { StepId, TestCaseType, ModelConfig, AnalysisResult } from './types/aquifer';
import { BLACK_KIPP_CONFIG, DEFAULT_INVERSION_CONFIG } from './data/presets';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { HelpDrawer } from './components/layout/HelpDrawer';
import { BackToTopButton } from './components/layout/BackToTopButton';

import { Step1SelectTestCase } from './components/steps/Step1SelectTestCase';
import { Step2ConfigureModel } from './components/steps/Step2ConfigureModel';
import { Step3ReviewInputs } from './components/steps/Step3ReviewInputs';
import { Step4RunAnalysis } from './components/steps/Step4RunAnalysis';
import { Step5ExploreResults } from './components/steps/Step5ExploreResults';

import { ReportModal } from './components/modals/ReportModal';
import { DocumentationModal } from './components/modals/DocumentationModal';
import { AboutModal } from './components/modals/AboutModal';

export default function App() {
  const workspaceRef = useRef<HTMLElement>(null);
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [testCase, setTestCase] = useState<TestCaseType>('black_kipp');
  const [config, setConfig] = useState<ModelConfig>(BLACK_KIPP_CONFIG);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string>(BLACK_KIPP_CONFIG.tests[0]?.id || 'period-1');
  const [configureSubTab, setConfigureSubTab] = useState<'positions' | 'tests'>('positions');
  const [configureFocusTestId, setConfigureFocusTestId] = useState<string | null>(null);

  // Layout states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Modals state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const resetWorkspaceScroll = () => {
    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.scrollTop = 0;
      workspace.scrollLeft = 0;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // Also reset when a user selects the step they are already viewing. React
  // does not rerun effects for an unchanged currentStep value.
  const navigateToStep = (step: StepId) => {
    setCurrentStep(step);
    resetWorkspaceScroll();
    window.requestAnimationFrame(resetWorkspaceScroll);
  };

  // The central workspace owns the page scroll. Reset it whenever workflow
  // navigation mounts a new step so buttons near the previous step's footer
  // do not leave the next screen positioned at its bottom.
  useLayoutEffect(() => {
    resetWorkspaceScroll();
    const frame = window.requestAnimationFrame(resetWorkspaceScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep]);

  const handleSelectTestCase = (tc: TestCaseType) => {
    if (tc === 'field_data') return;
    setTestCase(tc);
    setResult(null);
    const preset = tc === 'black_kipp' ? BLACK_KIPP_CONFIG : DEFAULT_INVERSION_CONFIG;
    setConfig(preset);
    setSelectedTestId(preset.tests[0].id);
    setConfigureSubTab('positions');
    setConfigureFocusTestId(null);
  };

  const handleNextStep = () => {
    setCurrentStep((prev) => (Math.min(5, prev + 1) as StepId));
  };

  // Forward navigation belongs to each screen's validated Continue action.
  // Even after returning to an earlier screen, the sidebar cannot bypass
  // input review or analysis execution by jumping to a later step.
  const handleSidebarNavigation = (step: StepId) => {
    if (step <= currentStep) navigateToStep(step);
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (Math.max(1, prev - 1) as StepId));
  };

  const handleResetWorkflow = () => {
    // Confirm before any state or navigation changes so Cancel preserves the workspace.
    if (!window.confirm('Reset workflow?\n\nThis will discard your current configuration and results and return to the Black–Kipp starting example. This cannot be undone.')) return;
    navigateToStep(1);
    setConfig(BLACK_KIPP_CONFIG);
    setTestCase('black_kipp');
    setConfigureSubTab('positions');
    setConfigureFocusTestId(null);
    setSelectedTestId(BLACK_KIPP_CONFIG.tests[0].id);
    setResult(null);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F7F7F7] flex flex-col font-sans text-[#121212]">
      {/* Top Application Header */}
      <Header
        testCase={testCase}
        onReset={handleResetWorkflow}
        onToggleHelp={() => setIsHelpOpen(!isHelpOpen)}
        isHelpOpen={isHelpOpen}
      />

      {/* Main Layout Area */}
      <div className="relative min-h-0 flex-1 flex overflow-hidden">
        {/* Charcoal Sidebar */}
        <Sidebar
          currentStep={currentStep}
          onNavigateStep={handleSidebarNavigation}
          onOpenDocs={() => setIsDocsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          onOpenExamples={() => {
            navigateToStep(1);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Central Workspace */}
        <div className="relative min-h-0 min-w-0 flex-1 flex flex-col">
        <main ref={workspaceRef} tabIndex={-1} className="min-h-0 flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Step Content Container */}
          <div className="p-4 sm:p-6 flex-1 bg-[#F7F7F7]">
            {currentStep === 1 && (
              <Step1SelectTestCase
                selectedTestCase={testCase}
                onSelectTestCase={handleSelectTestCase}
                onNext={handleNextStep}
              />
            )}

            {currentStep === 2 && (
              <Step2ConfigureModel
                config={config}
                onChangeConfig={(nextConfig) => { setConfig(nextConfig); setResult(null); }}
                activeTestId={selectedTestId}
                onChangeActiveTestId={setSelectedTestId}
                initialSubTab={configureSubTab}
                onChangeSubTab={setConfigureSubTab}
                focusTestId={configureFocusTestId}
                onFocusTestHandled={() => setConfigureFocusTestId(null)}
                onNext={handleNextStep}
                onPrev={handlePrevStep}
              />
            )}

            {currentStep === 3 && (
              <Step3ReviewInputs
                config={config}
                selectedTestId={selectedTestId}
                onChangeSelectedTestId={setSelectedTestId}
                onEditTest={(testId) => {
                  setSelectedTestId(testId);
                  setConfigureSubTab('tests');
                  setConfigureFocusTestId(testId);
                  navigateToStep(2);
                }}
                onNext={handleNextStep}
                onPrev={handlePrevStep}
              />
            )}

            {currentStep === 4 && (
              <Step4RunAnalysis
                config={config}
                onResult={(nextResult) => {
                  setResult(nextResult);
                }}
                onExplore={() => navigateToStep(5)}
                onPrev={handlePrevStep}
              />
            )}

            {currentStep === 5 && result && (
              <Step5ExploreResults
                config={config}
                result={result}
                onOpenReport={() => setIsReportOpen(true)}
                onPrev={handlePrevStep}
              />
            )}
            {currentStep === 5 && !result && <div className="bg-white border rounded-xl p-6">Run the analysis before viewing results.</div>}
          </div>
        </main>

        {currentStep === 2 && configureSubTab === 'tests' && !isHelpOpen && (
          <BackToTopButton scrollContainerRef={workspaceRef} />
        )}
        </div>

        {/* Collapsible Technical Help & Glossary Drawer */}
        <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>

      {/* Modals */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        config={config}
        result={result}
      />

      <DocumentationModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />
    </div>
  );
};

```
## web/src/components/layout/Header.tsx

```tsx
import React from 'react';
import { Layers, HelpCircle, RotateCcw } from 'lucide-react';
import { TestCaseType } from '../../types/aquifer';

interface HeaderProps {
  testCase: TestCaseType;
  onReset: () => void;
  onToggleHelp: () => void;
  isHelpOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  testCase,
  onReset,
  onToggleHelp,
  isHelpOpen,
}) => {
  const getTestCaseLabel = (tc: TestCaseType) => {
    switch (tc) {
      case 'inversion_10s':
        return 'P = 10 s Multi-Test Tomography';
      case 'black_kipp':
        return 'Multi-frequency Black–Kipp Comparison';
      case 'field_data':
        return 'Field Data Analysis (Planned)';
    }
  };

  return (
    <header className="shrink-0 bg-[#121212] text-white border-b border-[#2A2A2A] shadow-xs relative z-20">
      {/* UW–Madison Brand Top Red Accent Stripe */}
      <div className="h-1 bg-[#C5050C] w-full" />

      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Brand & UW Madison Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#C5050C] text-white shadow-xs font-black text-base">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-white text-sm sm:text-base tracking-tight leading-none">
                Aquifer Imaging Studio
              </h1>
              <span className="bg-[#2A2A2A] text-[#E1E5E7] border border-[#3A3A3A] text-[10px] font-mono font-medium px-1.5 py-0.2 rounded">
                v1.2.1
              </span>
            </div>
            <p className="text-[11px] text-[#A7ADB1] font-medium mt-0.5">
              University of Wisconsin–Madison &bull; Department of Geoscience
            </p>
          </div>
        </div>

        {/* Active Case Tag */}
        <div className="hidden lg:flex items-center space-x-2 bg-[#2A2A2A] border border-[#3A3A3A] rounded px-3 py-1">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#A7ADB1]">
            Active Case:
          </span>
          <span className="text-xs font-semibold text-white">
            {getTestCaseLabel(testCase)}
          </span>
        </div>

        {/* Quick Action Tools */}
        <div className="flex items-center space-x-2">
          {/* Secondary Buttons: White with neutral border & black text */}
          <button
            onClick={onReset}
            aria-label="Reset workflow"
            className="flex items-center space-x-1.5 text-xs bg-white text-[#121212] hover:bg-[#F1F2F3] border border-[#D6DADD] px-2.5 py-1.5 rounded font-semibold transition focus-ring"
            title="Reset Workflow to Default"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#4B4F52]" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onToggleHelp}
            aria-label="Help & Glossary"
            aria-expanded={isHelpOpen}
            aria-controls="help-glossary-panel"
            className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded transition focus-ring ${
              isHelpOpen
                ? 'bg-[#C5050C] text-white border border-[#C5050C] shadow-xs'
                : 'bg-white text-[#121212] hover:bg-[#F1F2F3] border border-[#D6DADD]'
            }`}
            title="Toggle Contextual Technical Help"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help & Glossary</span>
          </button>
        </div>
      </div>
    </header>
  );
};

```

## web/src/components/layout/Sidebar.tsx

```tsx
import React from 'react';
import {
  PlusCircle,
  BarChart3,
  BookOpen,
  Info,
  ChevronLeft,
  ChevronRight,
  Database,
  Activity,
  Layers,
  FlaskConical,
} from 'lucide-react';
import { StepId } from '../../types/aquifer';

interface SidebarProps {
  currentStep: StepId;
  onNavigateStep: (step: StepId) => void;
  onOpenDocs: () => void;
  onOpenAbout: () => void;
  onOpenExamples: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  onNavigateStep,
  onOpenDocs,
  onOpenAbout,
  onOpenExamples,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`bg-[#121212] border-r border-[#2A2A2A] text-[#E1E5E7] flex flex-col justify-between transition-all duration-200 z-10 ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div className="p-2 space-y-4">
        {/* Collapse button */}
        <div className="flex justify-end mb-1">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Action Button: Badger Red */}
        <div className="space-y-1">
          <button
            onClick={() => onNavigateStep(1)}
            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-bold transition focus-ring ${
              currentStep === 1
                ? 'bg-[#C5050C] text-white shadow-xs'
                : 'bg-[#C5050C] text-white hover:bg-[#9B0000]'
            }`}
          >
            <PlusCircle className="w-4 h-4 flex-shrink-0 text-white" />
            {!isCollapsed && <span>New Analysis</span>}
          </button>
        </div>

        <hr className="border-[#2A2A2A]" />

        {/* Navigation Steps */}
        <nav className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1 text-[10px] font-bold text-[#A7ADB1] uppercase tracking-wider">
              Workflow Steps
            </div>
          )}

          {[
            { id: 1, label: '1. Select Test Case', icon: FlaskConical },
            { id: 2, label: '2. Configure Model', icon: Layers },
            { id: 3, label: '3. Review Inputs', icon: Database },
            { id: 4, label: '4. Run Analysis', icon: Activity },
            { id: 5, label: '5. Explore Results', icon: BarChart3 },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = currentStep === item.id;
            const isLocked = item.id > currentStep;
            return (
              <button
                key={item.id}
                onClick={() => onNavigateStep(item.id as StepId)}
                disabled={isLocked}
                aria-current={isSelected ? 'step' : undefined}
                aria-label={item.label}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs transition focus-ring ${
                  isSelected
                    ? 'bg-[#2A1215] text-white font-semibold border-l-3 border-[#C5050C]'
                    : isLocked
                    ? 'text-[#6B7074] opacity-50 cursor-not-allowed'
                    : 'text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A]'
                }`}
                title={isLocked ? `${item.label} — use the Continue button to proceed` : item.label}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isSelected ? 'text-[#C5050C]' : 'text-[#A7ADB1]'
                  }`}
                />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <hr className="border-[#2A2A2A]" />

        {/* Auxiliary Links */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1 text-[10px] font-bold text-[#A7ADB1] uppercase tracking-wider">
              Resources
            </div>
          )}

          <button
            onClick={onOpenExamples}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="Example Cases"
          >
            <FlaskConical className="w-4 h-4 flex-shrink-0 text-[#C5050C]" />
            {!isCollapsed && <span>Example Cases</span>}
          </button>

          <button
            onClick={onOpenDocs}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="Documentation"
          >
            <BookOpen className="w-4 h-4 flex-shrink-0 text-[#A7ADB1]" />
            {!isCollapsed && <span>Documentation</span>}
          </button>

          <button
            onClick={onOpenAbout}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
            title="About Project"
          >
            <Info className="w-4 h-4 flex-shrink-0 text-[#A7ADB1]" />
            {!isCollapsed && <span>About Studio</span>}
          </button>
        </div>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-[#2A2A2A] bg-[#0A0A0A] text-[11px] text-[#A7ADB1]">
          <div className="font-semibold text-white">UW–Madison Geoscience</div>
          <div>Department of Geoscience</div>
          <div className="text-[10px] text-[#6B7074] mt-0.5">Oscillatory Tomography</div>
        </div>
      )}
    </aside>
  );
};

```

## web/src/components/layout/BackToTopButton.tsx

```tsx
import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopButtonProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/** Listen to the workspace, not the window: this app scrolls inside <main>. */
export const BackToTopButton: React.FC<BackToTopButtonProps> = ({ scrollContainerRef }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const workspace = scrollContainerRef.current;
    if (!workspace) return;
    const updateVisibility = () => setVisible(workspace.scrollTop > 200);
    updateVisibility();
    workspace.addEventListener('scroll', updateVisibility, { passive: true });
    return () => workspace.removeEventListener('scroll', updateVisibility);
  }, [scrollContainerRef]);

  const returnToTop = () => {
    const workspace = scrollContainerRef.current;
    if (!workspace) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    workspace.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Move keyboard focus out of the button before it disappears at the top.
    workspace.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={returnToTop}
      aria-label="Back to top of test setup"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`group absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex h-11 items-center justify-center rounded-full border border-white/30 bg-slate-700/70 px-3 text-sm font-semibold text-white shadow-lg backdrop-blur-md hover:bg-slate-700/90 focus-visible:bg-slate-700/90 focus-ring transition-all duration-300 motion-reduce:transition-none ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <ArrowUp className="h-5 w-5 shrink-0" aria-hidden="true" />
      {/* Width and spacing animate together so the resting button is circular.
          Focus and touch devices reveal the same label without requiring a mouse. */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-32 group-focus-visible:opacity-100 [@media(hover:none)]:ml-2 [@media(hover:none)]:max-w-32 [@media(hover:none)]:opacity-100 motion-reduce:transition-none">
        Back to top
      </span>
    </button>
  );
};

```

## web/src/components/layout/HelpDrawer.tsx

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { X, Search, BookOpen, HelpCircle } from 'lucide-react';
import { WORKFLOW_HELP } from '../../data/workflowHelp';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GlossaryItem {
  term: string;
  symbol?: string;
  unit?: string;
  category: string;
  definition: string;
  details: string;
}

const GLOSSARY: GlossaryItem[] = [
  {
    term: 'ln(K)',
    symbol: 'ln(K)',
    unit: 'ln(m/s)',
    category: 'Parameters',
    definition: 'Natural logarithm of hydraulic conductivity K.',
    details:
      'Hydraulic conductivity measures the ease with which water moves through pore spaces or fractures. Logging K enforces positivity and models log-normal hydraulic conductivity distributions common in natural aquifers.',
  },
  {
    term: 'ln(Ss)',
    symbol: 'ln(S_s)',
    unit: 'ln(1/m)',
    category: 'Parameters',
    definition: 'Natural logarithm of specific storage S_s.',
    details:
      'Specific storage is the volume of water released from storage per unit volume of aquifer per unit decline in hydraulic head. In oscillatory tests, S_s governs phase attenuation and time lag.',
  },
  {
    term: 'Pumping Period',
    symbol: 'P',
    unit: 'seconds (s)',
    category: 'Testing',
    definition: 'Oscillation cycle duration of the sinusoidal pumping signal.',
    details:
      'Sinusoidal water withdrawal/injection creates periodic pressure waves. High-frequency (short P) waves decay rapidly and probe near-well regions, while low-frequency (long P) waves penetrate deep into the domain.',
  },
  {
    term: 'Jacobian Matrix',
    symbol: 'J',
    unit: 'm / parameter',
    category: 'Inversion',
    definition: 'Matrix of sensitivities (partial derivatives ∂h_i / ∂m_j).',
    details:
      'Each column describes how predicted real and imaginary head components change with a cell parameter. The Python solver computes analytic sensitivities for ln(K) and ln(Ss), which the geostatistical inversion uses to update the estimated fields.',
  },
  {
    term: 'Correlation Length',
    symbol: 'l_x, l_y',
    unit: 'meters (m)',
    category: 'Geostatistics',
    definition: 'Spatial autocorrelation distance in prior covariance matrix Q_ss.',
    details:
      'Specifies the distance over which aquifer parameter fluctuations remain spatially correlated. Larger correlation lengths impose smoother spatial parameter continuity.',
  },
  {
    term: 'Peak Memory',
    symbol: 'RAM',
    unit: 'Megabytes (MB)',
    category: 'Computing',
    definition: 'Peak RAM required during Jacobian storage and matrix inversions.',
    details:
      'Inversion requires solving dense linear systems involving J^T * W * J + Q_ss^-1. For a grid of Nx*Ny cells and M observations, memory scales with O(N * M) or O(N^2).',
  },
  {
    term: 'Data-Error Variance',
    symbol: 'σ_d^2',
    unit: 'm^2',
    category: 'Inversion',
    definition: 'Assumed variance of pressure transducer noise.',
    details:
      'Used to construct the data weighting matrix W = (1/σ_d^2) * I. Controls the trade-off between fitting noisy head observations and respecting the prior geostatistical model.',
  },
  {
    term: 'Oscillatory Hydraulic Tomography',
    category: 'Theory',
    definition: 'Periodic hydraulic testing method for 2-D/3-D spatial imaging.',
    details:
      'Instead of pumping to steady-state or step-drawdown, a periodic flow rate Q(t) = Q_0 sin(2π t / P) is applied. Phase lag and amplitude ratio at multiple observation wells allow high-resolution tomographic inversion without net fluid extraction.',
  },
  {
    term: 'Black–Kipp Analytical Solution',
    category: 'Theory',
    definition: 'Closed-form analytical solution for periodic flow in homogeneous radial aquifers.',
    details:
      'Provides exact solutions for pressure wave propagation in radial aquifers. Used as a benchmark to compare finite-difference numerical models against theoretical amplitude and phase curves.',
  },
];

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    if (!isOpen) return;
    // Listen without an overlay: the outside click can still activate the
    // underlying control. Exclude the header toggle so it closes only once.
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!panelRef.current?.contains(target) && !target.closest('[aria-controls="help-glossary-panel"]')) onClose();
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        document.querySelector<HTMLButtonElement>('[aria-controls="help-glossary-panel"]')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['All', 'Workflow', 'Parameters', 'Testing', 'Inversion', 'Geostatistics', 'Results', 'Theory', 'Computing'];

  const filtered = [...WORKFLOW_HELP, ...GLOSSARY].filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      `${item.term} ${item.category} ${'symbol' in item ? item.symbol : ''} ${'unit' in item ? item.unit : ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      item.details.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div ref={panelRef} id="help-glossary-panel" role="complementary" aria-labelledby="help-glossary-title" className="absolute inset-y-0 right-0 w-full sm:w-[30rem] max-w-full bg-[#121212] border-l border-[#2A2A2A] text-white shadow-2xl z-40 flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#0A0A0A]">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-[#C5050C]" />
          <h2 id="help-glossary-title" className="font-bold text-base text-white">Help & Technical Glossary</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close help and glossary"
          className="p-1 rounded text-[#A7ADB1] hover:text-white hover:bg-[#2A2A2A] transition focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-[#2A2A2A] bg-[#121212] space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#A7ADB1]" />
          <input
            aria-label="Search help and glossary"
            type="text"
            placeholder="Search workflows, settings, plots, exports…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1C1C1C] border border-[#3A3A3A] text-xs rounded pl-8 pr-3 py-2 text-white focus:border-[#C5050C] outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={selectedCategory === cat}
              className={`text-[10px] px-2 py-0.5 rounded transition ${
                selectedCategory === cat
                  ? 'bg-[#C5050C] text-white font-bold'
                  : 'bg-[#1C1C1C] text-[#A7ADB1] hover:bg-[#2A2A2A] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Terms List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 text-sm">
        <p className="text-[#A7ADB1] leading-relaxed">Browse guidance for the current app or search a term. Click outside this panel or press Escape to close it.</p>
        <p className="text-xs text-[#A7ADB1]" role="status">{filtered.length} topics</p>
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#A7ADB1]">
            No terms found matching "{searchTerm}".
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.term}
              className="bg-[#181818] border border-[#2A2A2A] rounded-lg p-3 space-y-2 hover:border-[#444444] transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-white text-sm flex flex-wrap items-center gap-1.5">
                  <span>{item.term}</span>
                  {'symbol' in item && item.symbol && (
                    <span className="text-[11px] font-mono text-[#A7ADB1] bg-[#121212] border border-[#2A2A2A] px-1 py-0.2 rounded">
                      {item.symbol}
                    </span>
                  )}
                </div>
                {'unit' in item && item.unit && (
                  <span className="text-[10px] text-[#C5050C] font-mono font-bold">
                    [{item.unit}]
                  </span>
                )}
              </div>

              <div className="text-slate-200 font-medium leading-relaxed">
                {item.definition}
              </div>

              <p className="text-[#A7ADB1] text-sm leading-relaxed pt-2 border-t border-[#2A2A2A]">
                {item.details}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-[#2A2A2A] bg-[#0A0A0A] text-[11px] text-[#A7ADB1] flex items-center justify-between">
        <span className="flex items-center space-x-1">
          <HelpCircle className="w-3.5 h-3.5 text-[#C5050C]" />
          <span>UW Geoscience Reference</span>
        </span>
        <span className="text-[10px] font-mono text-[#A7ADB1]">Cardiff et al.</span>
      </div>
    </div>
  );
};

```
