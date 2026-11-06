import { ExportExperiment, ImportExperiment } from './components/ExperimentExchange';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { StepId, TestCaseType, ExampleType, ModelConfig, AnalysisResult } from './types/aquifer';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { HelpDrawer } from './components/layout/HelpDrawer';
import { JourneyGuide } from './components/layout/JourneyGuide';
import { Step1SelectTestCase } from './components/steps/Step1SelectTestCase';
import { Step2ConfigureModel } from './components/steps/Step2ConfigureModel';
import { Step3ReviewInputs } from './components/steps/Step3ReviewInputs';
import { Step4RunAnalysis } from './components/steps/Step4RunAnalysis';
import { Step5ExploreResults } from './components/steps/Step5ExploreResults';
import { InversionTransfer } from './components/steps/InversionTransfer';
import { ReportModal } from './components/modals/ReportModal';
import { DocumentationModal } from './components/modals/DocumentationModal';
import { AboutModal } from './components/modals/AboutModal';
import { PracticePreviewConfirm } from './components/modals/PracticePreviewConfirm';
import {
  createExample,
  createExperiment,
  ExperimentSession,
  modelIssues,
  testIssues,
} from './utils/experimentWorkflow';

type View = 'project' | 'examples' | 'example';
type Sessions = { project: ExperimentSession; example: ExperimentSession };

/** Personal work and practice are separate sessions. Navigating to Examples
 * never loads a preset into the user's project or drops its completed results. */
export default function App() {
  const workspaceRef = useRef<HTMLElement>(null);
  const [sessions, setSessions] = useState<Sessions>(() => ({
    project: createExperiment(),
    example: createExample('black_kipp'),
  }));
  const [view, setView] = useState<View>('project');
  const key = view === 'example' ? 'example' : 'project';
  const session = sessions[key];
  const { step: currentStep, config, result, selectedTestId } = session;
  const [focusTestId, setFocusTestId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches);
  const [isGuideMinimized, setIsGuideMinimized] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [transferSource, setTransferSource] = useState<ExperimentSession | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<'matlab_3d' | 'matlab_3d_quick' | null>(null);

  // Each callback captures its session key. A completed practice run cannot
  // accidentally write to personal work if another session is later selected.
  const update = (patch: Partial<ExperimentSession>) =>
    setSessions((previous) => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  const resetWorkspaceScroll = () => {
    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.scrollTop = 0;
      workspace.scrollLeft = 0;
    }
  };
  useLayoutEffect(() => {
    resetWorkspaceScroll();
    const frame = requestAnimationFrame(resetWorkspaceScroll);
    return () => cancelAnimationFrame(frame);
  }, [view, currentStep]);

  const navigate = (step: StepId) => {
    if (running) return;
    update({ step });
    resetWorkspaceScroll();
    requestAnimationFrame(resetWorkspaceScroll);
  };
  const next = () => {
    const problems =
      currentStep === 1
        ? modelIssues(config)
        : currentStep === 2 || currentStep === 3
          ? testIssues(config)
          : [];
    if (problems.length) {
      setNotice(problems.join(' '));
      return;
    }
    setNotice('');
    navigate(Math.min(5, currentStep + 1) as StepId);
  };
  const openView = (target: View) => {
    if (running) return;
    setView(target);
    setNotice('');
    setFocusTestId(null);
    resetWorkspaceScroll();
    requestAnimationFrame(resetWorkspaceScroll);
  };
  const changeConfig = (nextConfig: ModelConfig) => {
    const {siteContext: previousContext,...previousModel}=config;
    const {siteContext: nextContext,...nextModel}=nextConfig;
    // Entered site planes/datum are display context, not new solver inputs.
    // Preserve completed results and imported phasors when only context changes.
    if(JSON.stringify(previousModel)===JSON.stringify(nextModel)) {update({config:nextConfig});return;}
    // An edited experiment cannot reuse observations as though the old geometry,
    // roles, periods and amplitudes still applied. Require a fresh input review.
    if (session.runInput.csv)
      setNotice(
        'Configuration changed: imported observations were cleared. Re-import matching data or generate a new forward run.',
      );
    update({
      config: nextConfig,
      result: null,
      runInput: {
        ...session.runInput,
        csv: '',
        // Black–Kipp is a forward comparison; changing pathways must not carry
        // a checkerboard/imported inversion mode into its forward-only API path.
        analysisMode: nextConfig.testCase === 'black_kipp' ? 'forward' : session.runInput.analysisMode,
      },
      forwardSource: null,
    });
  };
  const loadExample = (type: ExampleType) => {
    if (running || type === 'field_data') return;
    if (
      (sessions.example.result || sessions.example.step > 1) &&
      !window.confirm(
        'Replace the current practice configuration and results? Your personal experiment will not change.',
      )
    )
      return;
    setSessions((previous) => ({ ...previous, example: createExample(type) }));
    openView('example');
  };
  const previewExample = async (type: 'matlab_3d' | 'matlab_3d_quick', replace = false) => {
    if (running || loadingPreview) return;
    if (!replace && (sessions.example.result || sessions.example.step > 1)) {setPendingPreview(type);return;}
    setLoadingPreview(true);
    try {
      // Lazy chunks keep the initial app small. Saved results have their exact
      // generating configuration; reject stale artifacts rather than relabeling.
      const module = type === 'matlab_3d' ? await import('./data/matlab3dPreview.json') : await import('./data/matlab3dQuickPreview.json');
      // Parcel's JSON chunks may resolve directly to module.exports; other
      // runtimes expose an ES-module default. Accept both documented shapes.
      const candidate = module as unknown as {config?: unknown; default?: unknown};
      const artifact = (candidate.config ? module : candidate.default) as typeof import('./data/matlab3dPreview.json');
      const prepared = createExample(type);
      if (JSON.stringify(artifact.config) !== JSON.stringify(prepared.config)) throw new Error('Example preview is stale. Load inputs and run the example, or regenerate its preview.');
      const savedResult = { ...artifact.result, examplePreview: artifact.provenance } as AnalysisResult;
      setSessions(previous => ({...previous, example:{...prepared,step:5,result:savedResult}}));
      openView('example');
    } catch (cause) { setNotice((cause as Error).message); }
    finally { setLoadingPreview(false); }
  };
  const approveProjectReplacement = () =>
    !(sessions.project.config.wells.length || sessions.project.result) ||
    window.confirm(
      'Replace Your experiment with this configuration? The current personal configuration and results will be discarded. Practice will remain available.',
    );
  const copyExample = () => {
    if (!approveProjectReplacement()) return;
    setSessions((previous) => ({
      ...previous,
      project: { ...structuredClone(previous.example), name: 'Experiment from example', step: 1 },
    }));
    openView('project');
  };
  const handleResetWorkflow = () => {
    if (running || view === 'examples') return;
    if (
      !window.confirm(
        'Reset this workspace?\n\nThis will discard its current configuration and results. Your other workspace is preserved. This cannot be undone.',
      )
    )
      return;
    setSessions((previous) => ({
      ...previous,
      [key]: key === 'project' ? createExperiment() : createExample(previous.example.config.examplePreset ?? previous.example.config.testCase),
    }));
    setFocusTestId(null);
    setNotice('');
    resetWorkspaceScroll();
    requestAnimationFrame(resetWorkspaceScroll);
  };
  const completeTransfer = (prepared: ExperimentSession) => {
    if (key === 'example' && !approveProjectReplacement()) return;
    setSessions((previous) => ({
      ...previous,
      project: {
        ...prepared,
        name: key === 'example' ? 'Inversion from practice forward data' : prepared.name,
      },
    }));
    setTransferSource(null);
    setView('project');
    setFocusTestId(null);
    setNotice(
      'Synthetic forward observations are ready. Review the inverse model, then continue to Data & run.',
    );
    resetWorkspaceScroll();
  };
  const source = session.forwardSource;

  return (
    <div className="h-dvh min-h-0 overflow-hidden bg-[#F7F7F7] flex flex-col text-[#121212]">
      <Header
        title={
          view === 'examples' ? 'Example library' : key === 'example' ? 'Example practice' : 'Your experiment'
        }
        disabled={running || view === 'examples'}
        onReset={handleResetWorkflow}
        onToggleHelp={() => setIsHelpOpen(!isHelpOpen)}
        isHelpOpen={isHelpOpen}
      />
      <div className="relative min-h-0 flex-1 flex overflow-hidden">
        <Sidebar
          view={view}
          disabled={running}
          onOpenProject={() => openView('project')}
          onOpenExamples={() => openView('examples')}
          onOpenDocs={() => setIsDocsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className="relative min-h-0 min-w-0 flex-1 flex flex-col">
          <main
            ref={workspaceRef}
            tabIndex={-1}
            aria-label="Experiment workspace"
            className="min-h-0 flex-1 min-w-0 overflow-y-auto outline-none"
          >
            <div className="p-4 sm:p-6">
              {view === 'examples' ? (
                <>
                  {notice && <p role="status" className="max-w-5xl mx-auto mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{notice}</p>}
                  <div className="max-w-5xl mx-auto mb-4 rounded-xl border bg-white p-4 text-sm text-[#4B4F52]">
                    Practice examples are separate from Your experiment. Start with Black–Kipp to explore
                    forward responses, then try the checkerboard inverse problem.
                    <button
                      onClick={() => openView('example')}
                      className="ml-3 font-semibold text-[#C5050C] underline focus-ring"
                    >
                      Resume practice
                    </button>
                  </div>
                  <Step1SelectTestCase
                    selectedTestCase={sessions.example.config.examplePreset ?? sessions.example.config.testCase}
                    onSelectTestCase={loadExample}
                    onPreview={previewExample}
                    loadingPreview={loadingPreview}
                    onNext={() => {}}
                  />
                </>
              ) : (
                <>
                  <section className="max-w-7xl mx-auto mb-5 space-y-3">
                    {config.examplePreset && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
                      <strong>{config.examplePreset==='matlab_3d'?'MATLAB 3D original configuration · Python forward workflow':'MATLAB-inspired 3D · reduced recovery workflow'}</strong>
                      <p>{config.examplePreset==='matlab_3d'?'The supplied preset has 8,000 cells, 27 ports, 104 tests and 1,404 responses. Full forward runs are supported; the complete inversion exceeds the interactive budget. Choose the quick recovery option in Examples to inspect inversion.':'The supplied quick preset uses 512 cells, the original 27 port positions, W14 pumping and 14 observers at each of four periods. It demonstrates inversion with a reduced acquisition and mesh.'} Inputs remain editable; this label records preset provenance. {config.syntheticRealization==='matlab_reference' ? 'This preset uses the MATLAB-generated legacy seed-0 truth on its matching fixed mesh.' : 'Custom NumPy realizations use a different random stream from MATLAB.'}</p>
                      {result?.examplePreview && <p className="mt-1 font-semibold">Saved Python-computed preview · {new Date(result.examplePreview.generatedAt).toLocaleDateString()}. To recompute, return to Data & run.</p>}
                    </div>}
                    {result && !result.solverRevision && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Historical solver output: rerun with the current solver before comparing it with the MATLAB references.</p>}
                    <div className="experiment-heading">
                      <label className="experiment-name-label">
                        {key === 'example' ? 'EXAMPLE PRACTICE · separate workspace' : 'YOUR EXPERIMENT'}
                        <input
                          aria-label="Experiment name"
                          value={session.name}
                          onChange={(event) => update({ name: event.target.value })}
                          disabled={running}
                          className="experiment-name-input"
                        />
                      </label>
                      {currentStep === 1 && <label className="experiment-pathway-label">Model pathway
                          <select
                            aria-label="Model pathway"
                            value={config.testCase}
                            onChange={(event) =>
                              changeConfig({ ...config, testCase: event.target.value as TestCaseType })
                            }
                            className="experiment-pathway-select"
                          >
                            <option value="inversion_10s">Forward model / tomography-ready experiment</option>
                            <option value="black_kipp" disabled={config.dimension===3}>
                              Forward model with Black–Kipp analytical comparison
                            </option>
                          </select>
                      </label>}
                      {key === 'example' && (
                        <button
                          disabled={running}
                          onClick={copyExample}
                          className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold focus-ring"
                        >
                          Copy configuration to Your experiment
                        </button>
                      )}
                    </div>
                    {notice && (
                      <p
                        role="status"
                        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
                      >
                        {notice}
                      </p>
                    )}
                    {source && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950">
                        Synthetic input source retained: {source.result.pairs.length} forward responses on{' '}
                        {source.config.gridNx} × {source.config.gridNy}{source.config.dimension===3?` × ${source.config.gridNz}`:""} cells. Current inversion grid:{' '}
                        {config.gridNx} × {config.gridNy}{config.dimension===3?` × ${config.gridNz}`:""}. Raw observations were not resampled.{' '}
                        {source.config.gridNx !== config.gridNx || source.config.gridNy !== config.gridNy || (config.dimension===3&&source.config.gridNz!==config.gridNz)
                          ? 'Different grids introduce discretization differences.'
                          : 'Generating and inverse grid counts match.'}
                      </div>
                    )}
                    {currentStep === 1 && <details className="experiment-pathway-help"><summary>About the model pathways</summary><p>Both pathways use your wells and tests. Black–Kipp compares a homogeneous, infinite-aquifer analytical solution with the finite-domain model. Forward outputs from either pathway can become synthetic inversion input. Periods and pumping amplitudes are configurable; no period is fixed at 10 seconds.</p></details>}
                    {currentStep === 1 && key === 'project' && <ImportExperiment onImport={imported => { if(!approveProjectReplacement())return; setSessions(previous=>({...previous,project:imported}));setFocusTestId(null);setNotice('Experiment imported. Review inputs before running; saved results are retained as historical outputs.');window.history.replaceState(null,'',window.location.pathname+window.location.search);resetWorkspaceScroll(); }} />}
                    {currentStep === 3 && result && <button onClick={()=>navigate(5)} className="w-fit rounded-lg border bg-white px-4 py-2 text-sm font-semibold focus-ring">View saved results</button>}
                  </section>
                  {(currentStep === 1 || currentStep === 2) && (
                    <Step2ConfigureModel
                      key={`${key}-${currentStep}`}
                      stage={currentStep === 1 ? 'positions' : 'tests'}
                      config={config}
                      onChangeConfig={changeConfig}
                      activeTestId={selectedTestId}
                      onChangeActiveTestId={(id) => update({ selectedTestId: id })}
                      focusTestId={focusTestId}
                      onFocusTestHandled={() => setFocusTestId(null)}
                      onNext={next}
                      onPrev={() => navigate(1)}
                    />
                  )}
                  {currentStep === 3 && (
                    <Step3ReviewInputs
                      config={config}
                      selectedTestId={selectedTestId}
                      onChangeSelectedTestId={(id) => update({ selectedTestId: id })}
                      onEditTest={(id) => {
                        update({ selectedTestId: id, step: 2 });
                        setFocusTestId(id);
                      }}
                      onNext={next}
                      onPrev={() => navigate(2)}
                    />
                  )}
                  {currentStep === 4 && (
                    <Step4RunAnalysis
                      key={key}
                      config={config}
                      input={session.runInput}
                      existingResult={result}
                      allowSynthetic={true}
                      onChangeConfig={changeConfig}
                      onChangeInput={(runInput) =>
                        update({
                          runInput,
                          result: null,
                          forwardSource:
                            runInput.analysisMode === 'measured_inversion' &&
                            runInput.observationSource === 'synthetic' &&
                            runInput.csv === session.runInput.csv
                              ? session.forwardSource
                              : null,
                        })
                      }
                      onRunningChange={setRunning}
                      onResult={(nextResult) =>
                        update({
                          result: {
                            ...nextResult,
                            ...(source && nextResult.observationSource === 'synthetic'
                              ? {
                                  forwardInput: {
                                    sourceGrid: { nx: source.config.gridNx, ny: source.config.gridNy, ...(source.config.dimension===3?{nz:source.config.gridNz}:{}) },
                                    inversionGrid: { nx: config.gridNx, ny: config.gridNy, ...(config.dimension===3?{nz:config.gridNz}:{}) },
                                    responsePairs: source.result.pairs.length,
                                    generatingTruth: source.result.syntheticTruth ?? null,
                                  },
                                }
                              : {}),
                          },
                        })
                      }
                      onExplore={() => navigate(5)}
                      onPrev={() => navigate(3)}
                    />
                  )}
                  {currentStep === 5 && result && <div className="max-w-7xl mx-auto mb-5"><ExportExperiment session={session}/></div>}
                  {currentStep === 5 && result && (
                    <Step5ExploreResults
                      key={key}
                      config={config}
                      result={result}
                      onOpenReport={() => setIsReportOpen(true)}
                      onTransfer={() => setTransferSource(structuredClone(session))}
                      onPrev={() => navigate(4)}
                    />
                  )}
                  {currentStep === 5 && !result && (
                    <p className="rounded-xl border bg-white p-6">Run the analysis before viewing results.</p>
                  )}
                </>
              )}
            </div>
          </main>
          {view !== 'examples' && !isHelpOpen && (
            <div className="relative h-16 shrink-0" aria-label="Workflow navigation tools">
            <JourneyGuide
              minimized={isGuideMinimized}
              onMinimizedChange={setIsGuideMinimized}
              step={currentStep}
              disabled={running}
              onBack={(step) => {
                if (step < currentStep) navigate(step);
              }}
              onTop={() => {
                workspaceRef.current?.scrollTo({
                  top: 0,
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                });
                workspaceRef.current?.focus({ preventScroll: true });
              }}
            />
            </div>
          )}
        </div>
        <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>
      {transferSource && (
        <InversionTransfer
          source={transferSource}
          onClose={() => setTransferSource(null)}
          onTransfer={completeTransfer}
        />
      )}
      {pendingPreview && <PracticePreviewConfirm onClose={()=>setPendingPreview(null)} onConfirm={()=>{const type=pendingPreview;setPendingPreview(null);return previewExample(type,true);}}/>}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        config={config}
        result={result}
      />
      <DocumentationModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
