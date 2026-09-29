import React, { useLayoutEffect, useRef, useState } from 'react';
import { StepId, TestCaseType, ModelConfig, AnalysisResult } from './types/aquifer';
import { BLACK_KIPP_CONFIG, DEFAULT_INVERSION_CONFIG } from './data/presets';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { WorkflowStepper } from './components/layout/WorkflowStepper';
import { HelpDrawer } from './components/layout/HelpDrawer';

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
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
  const [testCase, setTestCase] = useState<TestCaseType>('inversion_10s');
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_INVERSION_CONFIG);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string>(DEFAULT_INVERSION_CONFIG.tests[0]?.id || 'test-1');
  const [configureSubTab, setConfigureSubTab] = useState<'positions' | 'tests'>('positions');

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
    setCompletedSteps(new Set());
  };

  const handleStepComplete = (step: StepId) => {
    setCompletedSteps((prev) => new Set(prev).add(step));
  };

  const handleNextStep = () => {
    handleStepComplete(currentStep);
    setCurrentStep((prev) => (Math.min(5, prev + 1) as StepId));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (Math.max(1, prev - 1) as StepId));
  };

  const handleResetWorkflow = () => {
    navigateToStep(1);
    setCompletedSteps(new Set());
    setConfig(DEFAULT_INVERSION_CONFIG);
    setTestCase('inversion_10s');
    setConfigureSubTab('positions');
    setResult(null);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F7F7F7] flex flex-col font-sans text-[#121212]">
      {/* Top Application Header */}
      <Header
        currentStep={currentStep}
        testCase={testCase}
        onReset={handleResetWorkflow}
        onToggleHelp={() => setIsHelpOpen(!isHelpOpen)}
        onOpenDocs={() => setIsDocsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        isHelpOpen={isHelpOpen}
      />

      {/* Main Layout Area */}
      <div className="min-h-0 flex-1 flex overflow-hidden">
        {/* Charcoal Sidebar */}
        <Sidebar
          currentStep={currentStep}
          onNavigateStep={navigateToStep}
          onOpenDocs={() => setIsDocsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          onOpenExamples={() => {
            navigateToStep(1);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Central Workspace */}
        <main ref={workspaceRef} className="min-h-0 flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Workflow Stepper */}
          <WorkflowStepper
            currentStep={currentStep}
            completedSteps={completedSteps}
            onSelectStep={navigateToStep}
          />

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
                  handleStepComplete(4);
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
