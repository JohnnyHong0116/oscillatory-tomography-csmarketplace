import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  MapPin,
  Plus,
  Trash2,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  Settings,
  Copy,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  HelpCircle,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { ModelConfig, Well, BoundaryCondition, TomographyTest } from '../../types/aquifer';

interface Step2Props {
  config: ModelConfig;
  onChangeConfig: (newConfig: ModelConfig) => void;
  activeTestId?: string;
  onChangeActiveTestId?: (id: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const Step2ConfigureModel: React.FC<Step2Props> = ({
  config,
  onChangeConfig,
  activeTestId: propActiveTestId,
  onChangeActiveTestId,
  onNext,
  onPrev,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'tests'>('positions');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedWellId, setSelectedWellId] = useState<string | null>(config.wells[0]?.id || null);
  const [newWellName, setNewWellName] = useState(`W${config.wells.length + 1}`);
  const [newWellX, setNewWellX] = useState(60);
  const [newWellY, setNewWellY] = useState(60);
  const [editingWellId, setEditingWellId] = useState<string | null>(null);
  const [editWellName, setEditWellName] = useState('');
  const [editWellX, setEditWellX] = useState(0);
  const [editWellY, setEditWellY] = useState(0);
  const [editWellError, setEditWellError] = useState<string | null>(null);

  // Active test being edited/visualized in "Configure Tests" sub-tab
  const [internalActiveTestId, setInternalActiveTestId] = useState<string>(config.tests[0]?.id || 'test-1');
  const activeTestId = propActiveTestId || internalActiveTestId;

  const setActiveTestId = (id: string) => {
    setInternalActiveTestId(id);
    if (onChangeActiveTestId) onChangeActiveTestId(id);
  };
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [mapYOffset, setMapYOffset] = useState<number>(0);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const testRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const tabGridRef = useRef<HTMLDivElement>(null);

  const updateMapAlignment = (testId: string) => {
    const cardEl = testRefs.current[testId];
    const gridEl = tabGridRef.current;
    const mapEl = mapContainerRef.current;

    if (cardEl && gridEl && mapEl) {
      const gridRect = gridEl.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      const idealY = Math.max(0, Math.round(cardRect.top - gridRect.top));

      const gridHeight = gridEl.offsetHeight;
      const mapHeight = mapEl.offsetHeight;
      const maxTranslateY = Math.max(0, gridHeight - mapHeight);

      // Adaptive clamping: Map aligns near the test, but never extends past the grid bottom or under the screen
      const adaptiveY = Math.min(idealY, maxTranslateY);
      setMapYOffset(adaptiveY);
    }
  };

  const handleSelectTest = (testId: string) => {
    setActiveTestId(testId);
    requestAnimationFrame(() => {
      updateMapAlignment(testId);
      const cardEl = testRefs.current[testId];
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  useEffect(() => {
    if (activeSubTab === 'tests' && activeTestId) {
      requestAnimationFrame(() => {
        updateMapAlignment(activeTestId);
      });
    }
  }, [activeTestId, activeSubTab, config.tests.length]);

  // Domain change handler
  const handleDomainChange = (field: keyof ModelConfig, val: number) => {
    onChangeConfig({ ...config, [field]: val });
  };

  const handleBoundaryChange = (side: keyof typeof config.boundaries, val: BoundaryCondition) => {
    onChangeConfig({
      ...config,
      boundaries: {
        ...config.boundaries,
        [side]: val,
      },
    });
  };

  // Well Position handlers
  const handleUpdateWell = (id: string, updatedFields: Partial<Well>) => {
    const updated = config.wells.map((w) => (w.id === id ? { ...w, ...updatedFields } : w));
    onChangeConfig({ ...config, wells: updated });
  };

  const handleStartEditingWell = (well: Well) => {
    setSelectedWellId(well.id);
    setEditingWellId(well.id);
    setEditWellName(well.name);
    setEditWellX(well.x);
    setEditWellY(well.y);
    setEditWellError(null);
  };

  const handleCancelEditingWell = () => {
    setEditingWellId(null);
    setEditWellError(null);
  };

  const handleSaveWell = () => {
    if (!editingWellId) return;
    const name = editWellName.trim();
    if (!name) {
      setEditWellError('Enter a label for this well.');
      return;
    }
    if (config.wells.some((well) => well.id !== editingWellId && well.name.trim().toLowerCase() === name.toLowerCase())) {
      setEditWellError(`A well named ${name} already exists.`);
      return;
    }
    if (!Number.isFinite(editWellX) || !Number.isFinite(editWellY)) {
      setEditWellError('Enter valid numeric X and Y coordinates.');
      return;
    }
    const halfCellX = (config.maxX - config.minX) / (2 * config.gridNx);
    const halfCellY = (config.maxY - config.minY) / (2 * config.gridNy);
    const minReachableX = config.minX + halfCellX;
    const maxReachableX = config.maxX - halfCellX;
    const minReachableY = config.minY + halfCellY;
    const maxReachableY = config.maxY - halfCellY;
    if (editWellX < minReachableX || editWellX > maxReachableX || editWellY < minReachableY || editWellY > maxReachableY) {
      setEditWellError(`Coordinates must stay within the solver cell centers: X ${minReachableX} to ${maxReachableX} m and Y ${minReachableY} to ${maxReachableY} m.`);
      return;
    }
    handleUpdateWell(editingWellId, { name, x: editWellX, y: editWellY });
    handleCancelEditingWell();
  };

  const handleAddWell = () => {
    const id = `w-${crypto.randomUUID()}`;
    const name = newWellName || `W${config.wells.length + 1}`;
    const newWell: Well = {
      id,
      name,
      x: Math.min(config.maxX, Math.max(config.minX, newWellX)),
      y: Math.min(config.maxY, Math.max(config.minY, newWellY)),
    };

    onChangeConfig({
      ...config,
      wells: [...config.wells, newWell],
    });
    setSelectedWellId(id);
    setNewWellName(`W${config.wells.length + 2}`);
  };

  const handleDeleteWell = (id: string) => {
    if (config.wells.length <= 2) {
      alert('At least 2 well positions are required to configure oscillatory tomography tests.');
      return;
    }
    const updatedWells = config.wells.filter((w) => w.id !== id);

    // Clean up tests if deleted well was used
    const updatedTests = config.tests.map((t) => {
      let newPumping = t.pumpingWellId;
      if (t.pumpingWellId === id) {
        newPumping = updatedWells[0]?.id || '';
      }
      return {
        ...t,
        pumpingWellId: newPumping,
        observationWellIds: t.observationWellIds.filter((wId) => wId !== id && wId !== newPumping),
      };
    });

    onChangeConfig({
      ...config,
      wells: updatedWells,
      tests: updatedTests,
    });
    if (editingWellId === id) handleCancelEditingWell();
    if (selectedWellId === id) setSelectedWellId(updatedWells[0]?.id || null);
  };

  // --- Test Configuration Handlers ---
  const handleAddTest = () => {
    const testNum = config.tests.length + 1;
    const newTestId = `test-${crypto.randomUUID()}`;
    const firstWellId = config.wells[0]?.id || 'w-1';
    const remainingWellIds = config.wells.filter((w) => w.id !== firstWellId).map((w) => w.id);

    const newTest: TomographyTest = {
      id: newTestId,
      name: `Test ${testNum}`,
      pumpingWellId: firstWellId,
      observationWellIds: remainingWellIds,
    };

    onChangeConfig({
      ...config,
      tests: [...config.tests, newTest],
    });
    handleSelectTest(newTestId);
  };

  const handleDuplicateTest = (testId: string) => {
    const testToDup = config.tests.find((t) => t.id === testId);
    if (!testToDup) return;

    const newTestId = `test-${crypto.randomUUID()}`;
    const newTest: TomographyTest = {
      ...testToDup,
      id: newTestId,
      name: `${testToDup.name} (Copy)`,
    };

    onChangeConfig({
      ...config,
      tests: [...config.tests, newTest],
    });
    handleSelectTest(newTestId);
  };

  const handleDeleteTest = (testId: string) => {
    if (config.tests.length <= 1) {
      alert('At least one oscillatory tomography test is required.');
      return;
    }
    const updated = config.tests.filter((t) => t.id !== testId);
    onChangeConfig({ ...config, tests: updated });
    if (activeTestId === testId) {
      setActiveTestId(updated[0]?.id || '');
    }
  };

  const handleUpdateTestName = (testId: string, newName: string) => {
    const updated = config.tests.map((t) => (t.id === testId ? { ...t, name: newName } : t));
    onChangeConfig({ ...config, tests: updated });
  };

  const handleSetPumpingWell = (testId: string, pumpingWellId: string) => {
    const updated = config.tests.map((t) => {
      if (t.id !== testId) return t;
      // Remove newly selected pumping well from observation wells if it was in observations
      const updatedObs = t.observationWellIds.filter((id) => id !== pumpingWellId);
      return {
        ...t,
        pumpingWellId,
        observationWellIds: updatedObs,
      };
    });
    onChangeConfig({ ...config, tests: updated });
  };

  const handleToggleObservationWell = (testId: string, wellId: string) => {
    const updated = config.tests.map((t) => {
      if (t.id !== testId) return t;
      // Disallow toggling pumping well as observation well
      if (t.pumpingWellId === wellId) return t;

      const isObs = t.observationWellIds.includes(wellId);
      const updatedObs = isObs
        ? t.observationWellIds.filter((id) => id !== wellId)
        : [...t.observationWellIds, wellId];

      return {
        ...t,
        observationWellIds: updatedObs,
      };
    });
    onChangeConfig({ ...config, tests: updated });
  };

  // --- Validation Logic ---
  const validateTest = (t: TomographyTest) => {
    const errors: string[] = [];
    if (!t.pumpingWellId) {
      errors.push('No pumping well selected.');
    }
    if (!t.observationWellIds || t.observationWellIds.length === 0) {
      errors.push('At least 1 observation well is required.');
    }
    if (t.observationWellIds.includes(t.pumpingWellId)) {
      errors.push('Pumping well cannot also be selected as an observation well.');
    }
    return errors;
  };

  const testValidationResults = config.tests.map((t) => ({
    testId: t.id,
    testName: t.name,
    errors: validateTest(t),
  }));

  const isAllTestsValid = config.tests.length > 0 && testValidationResults.every((r) => r.errors.length === 0);

  // SVG Map Geometry setup
  const svgWidth = 360;
  const svgHeight = 360;
  const padding = 45;
  const plotWidth = svgWidth - 2 * padding;
  const plotHeight = svgHeight - 2 * padding;

  const mapXToSvg = (x: number) => {
    const norm = (x - config.minX) / (config.maxX - config.minX || 1);
    return padding + norm * plotWidth;
  };

  const mapYToSvg = (y: number) => {
    const norm = (y - config.minY) / (config.maxY - config.minY || 1);
    return svgHeight - padding - norm * plotHeight;
  };

  const mapSvgToX = (svgX: number) => {
    const norm = (svgX - padding) / plotWidth;
    return Math.round((config.minX + norm * (config.maxX - config.minX)) * 10) / 10;
  };

  const mapSvgToY = (svgY: number) => {
    const norm = (svgHeight - padding - svgY) / plotHeight;
    return Math.round((config.minY + norm * (config.maxY - config.minY)) * 10) / 10;
  };

  const [draggingWellId, setDraggingWellId] = useState<string | null>(null);

  const updateWellPositionFromPointer = (
    svgElement: SVGSVGElement,
    clientX: number,
    clientY: number,
    wellId: string
  ) => {
    const rect = svgElement.getBoundingClientRect();
    const svgX = clientX - rect.left;
    const svgY = clientY - rect.top;

    const boundedSvgX = Math.max(padding, Math.min(svgWidth - padding, svgX));
    const boundedSvgY = Math.max(padding, Math.min(svgHeight - padding, svgY));

    const newX = mapSvgToX(boundedSvgX);
    const newY = mapSvgToY(boundedSvgY);

    handleUpdateWell(wellId, { x: newX, y: newY });
  };

  const handleMapPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeSubTab !== 'positions') return;
  };

  const handleMapPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingWellId || activeSubTab !== 'positions') return;
    updateWellPositionFromPointer(e.currentTarget, e.clientX, e.clientY, draggingWellId);
  };

  const handleMapPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingWellId) {
      setDraggingWellId(null);
    }
  };

  const handleWellPointerDown = (e: React.PointerEvent<SVGGElement>, wellId: string) => {
    if (activeSubTab !== 'positions') return;
    e.stopPropagation();
    setSelectedWellId(wellId);
    setDraggingWellId(wellId);
    (e.currentTarget as unknown as Element).setPointerCapture(e.pointerId);
  };

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Map clicks for moving well positions apply on Well Positions screen
    if (activeSubTab !== 'positions') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickSvgX = e.clientX - rect.left;
    const clickSvgY = e.clientY - rect.top;

    if (
      clickSvgX >= padding &&
      clickSvgX <= svgWidth - padding &&
      clickSvgY >= padding &&
      clickSvgY <= svgHeight - padding
    ) {
      const clickX = mapSvgToX(clickSvgX);
      const clickY = mapSvgToY(clickSvgY);

      if (selectedWellId) {
        handleUpdateWell(selectedWellId, { x: clickX, y: clickY });
      }
    }
  };

  const activeTest = config.tests.find((t) => t.id === activeTestId) || config.tests[0];
  const selectedWell = config.wells.find((w) => w.id === selectedWellId);

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#121212] tracking-tight">
            Step 2: Model Configuration & Test Setup
          </h2>
          <p className="text-xs text-[#4B4F52] mt-0.5">
            Define spatial well positions neutrally, configure multi-test pumping/observation assignments, and set domain grid boundaries.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onPrev}
            className="flex items-center space-x-1 bg-white hover:bg-[#F1F2F3] text-[#121212] border border-[#D6DADD] text-xs font-semibold px-3 py-1.5 rounded transition focus-ring"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            onClick={onNext}
            disabled={!isAllTestsValid}
            className={`flex items-center space-x-1.5 text-xs font-bold px-4 py-1.5 rounded shadow-xs transition focus-ring ${
              isAllTestsValid
                ? 'bg-[#C5050C] hover:bg-[#9B0000] text-white'
                : 'bg-[#E1E5E7] text-[#6B7074] cursor-not-allowed'
            }`}
            title={!isAllTestsValid ? 'Please resolve test configuration errors before proceeding.' : ''}
          >
            <span>Review Inputs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-tab Switcher Bar: 1. Define Well Positions & Domain vs 2. Configure Tests */}
      <div className="bg-white border border-[#D6DADD] rounded-xl p-1.5 flex items-center space-x-2 shadow-xs">
        <button
          onClick={() => setActiveSubTab('positions')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs font-bold transition focus-ring ${
            activeSubTab === 'positions'
              ? 'bg-[#121212] text-white shadow-xs'
              : 'bg-transparent text-[#4B4F52] hover:bg-[#F1F2F3] hover:text-[#121212]'
          }`}
        >
          <MapPin className={`w-4 h-4 ${activeSubTab === 'positions' ? 'text-[#C5050C]' : 'text-[#6B7074]'}`} />
          <span>1. Define Well Positions & Domain</span>
          <span className="text-[10px] opacity-80 font-normal">({config.wells.length} physical wells)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tests')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs font-bold transition focus-ring relative ${
            activeSubTab === 'tests'
              ? 'bg-[#121212] text-white shadow-xs'
              : 'bg-transparent text-[#4B4F52] hover:bg-[#F1F2F3] hover:text-[#121212]'
          }`}
        >
          <FlaskConical className={`w-4 h-4 ${activeSubTab === 'tests' ? 'text-[#C5050C]' : 'text-[#6B7074]'}`} />
          <span>2. Configure Tests</span>
          <span className="text-[10px] opacity-80 font-normal">({config.tests.length} tests)</span>
          {!isAllTestsValid && (
            <span className="w-2 h-2 rounded-full bg-[#C5050C] animate-ping absolute right-3" />
          )}
        </button>
      </div>

      {/* TAB 1: DEFINE WELL POSITIONS & DOMAIN */}
      {activeSubTab === 'positions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Setup (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Section: Define Well Positions */}
            <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#D6DADD] pb-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#C5050C]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
                    Define Well Positions
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#6B7074]">
                  Total Wells: {config.wells.length}
                </span>
              </div>

              {/* Guidance Message */}
              <div className="bg-[#F1F2F3] border border-[#D6DADD] rounded-lg p-3 flex items-start space-x-2.5 text-xs text-[#121212]">
                <HelpCircle className="w-4 h-4 text-[#C5050C] flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  <strong>Guidance:</strong> Define all available wells here. Pumping and observation roles are assigned separately for each test in the next tab.
                </p>
              </div>

              {/* Well Inventory Controls */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#121212]">Physical Well Coordinates</span>
                  <span className="text-[11px] text-[#6B7074]">Selected: {selectedWell?.name || 'None'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {config.wells.map((w) => {
                    const isSelected = w.id === selectedWellId;
                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedWellId(w.id)}
                        onDoubleClick={() => handleStartEditingWell(w)}
                        title="Double-click to edit this well"
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#121212] border-[#121212] text-white shadow-xs'
                            : 'bg-white border-[#D6DADD] text-[#121212] hover:bg-[#F7F7F7]'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold font-mono ${
                              isSelected ? 'bg-[#C5050C] text-white' : 'bg-[#E1E5E7] text-[#121212]'
                            }`}
                          >
                            {w.name}
                          </span>
                          <span className="font-semibold">{w.name}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] font-mono">
                          <span className={isSelected ? 'text-[#E1E5E7]' : 'text-[#6B7074]'}>
                            ({w.x}m, {w.y}m)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditingWell(w);
                            }}
                            className={`p-1 rounded transition ${
                              isSelected
                                ? 'hover:bg-[#2A2A2A] text-[#A7ADB1] hover:text-white'
                                : 'hover:bg-[#F1F2F3] text-[#6B7074] hover:text-[#121212]'
                            }`}
                            aria-label={`Edit ${w.name}`}
                            title={`Edit ${w.name}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWell(w.id);
                            }}
                            className={`p-1 rounded transition ${
                              isSelected
                                ? 'hover:bg-[#2A2A2A] text-[#A7ADB1] hover:text-[#FF8080]'
                                : 'hover:bg-[#F1F2F3] text-[#6B7074] hover:text-[#C5050C]'
                            }`}
                            title="Remove well position"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Existing Well Editor */}
                {editingWellId && (
                  <div className="bg-[#FFF8F8] border border-[#F3B8BB] p-3 rounded-lg space-y-2 mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold text-[#121212] flex items-center space-x-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-[#C5050C]" />
                        <span>Edit Well Position</span>
                      </div>
                      <span className="text-[10px] text-[#6B7074]">Well ID and test assignments are preserved</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="edit-well-name" className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">Label</label>
                        <input
                          id="edit-well-name"
                          type="text"
                          value={editWellName}
                          onChange={(event) => { setEditWellName(event.target.value); setEditWellError(null); }}
                          onKeyDown={(event) => { if (event.key === 'Enter') handleSaveWell(); if (event.key === 'Escape') handleCancelEditingWell(); }}
                          className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-semibold focus:border-[#C5050C] outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-well-x" className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">X Position (m)</label>
                        <input
                          id="edit-well-x"
                          type="number"
                          step="0.1"
                          value={editWellX}
                          onChange={(event) => { setEditWellX(Number(event.target.value)); setEditWellError(null); }}
                          onKeyDown={(event) => { if (event.key === 'Enter') handleSaveWell(); if (event.key === 'Escape') handleCancelEditingWell(); }}
                          className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-well-y" className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">Y Position (m)</label>
                        <input
                          id="edit-well-y"
                          type="number"
                          step="0.1"
                          value={editWellY}
                          onChange={(event) => { setEditWellY(Number(event.target.value)); setEditWellError(null); }}
                          onKeyDown={(event) => { if (event.key === 'Enter') handleSaveWell(); if (event.key === 'Escape') handleCancelEditingWell(); }}
                          className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                        />
                      </div>
                    </div>

                    {editWellError && <p role="alert" className="text-[10px] text-[#9B0000]">{editWellError}</p>}

                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={handleCancelEditingWell} className="flex items-center gap-1 rounded border border-[#D6DADD] bg-white px-3 py-1.5 text-xs font-semibold text-[#121212] hover:bg-[#F1F2F3]">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button type="button" onClick={handleSaveWell} className="flex items-center gap-1 rounded bg-[#121212] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2A2A2A]">
                        <Check className="w-3.5 h-3.5 text-[#7ED38C]" /> Save Changes
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Well Form */}
                {!editingWellId && <div className="bg-[#F7F7F7] border border-[#D6DADD] p-3 rounded-lg space-y-2 mt-3">
                  <div className="text-xs font-bold text-[#121212] flex items-center space-x-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#C5050C]" />
                    <span>Add New Well Position</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">Label</label>
                      <input
                        type="text"
                        placeholder="e.g. W7"
                        value={newWellName}
                        onChange={(e) => setNewWellName(e.target.value)}
                        className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-semibold focus:border-[#C5050C] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">X Position (m)</label>
                      <input
                        type="number"
                        placeholder="X"
                        value={newWellX}
                        onChange={(e) => setNewWellX(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6B7074] mb-0.5">Y Position (m)</label>
                      <input
                        type="number"
                        placeholder="Y"
                        value={newWellY}
                        onChange={(e) => setNewWellY(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddWell}
                    className="w-full bg-[#121212] hover:bg-[#2A2A2A] text-white font-bold text-xs py-1.5 rounded transition focus-ring flex items-center justify-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Well Position to Map</span>
                  </button>
                </div>}
              </div>
            </div>

            {/* Section: Domain & Grid Dimensions */}
            <div className="bg-white border border-[#D6DADD] rounded-xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center space-x-2 border-b border-[#D6DADD] pb-2">
                <Layers className="w-4 h-4 text-[#C5050C]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212]">
                  Domain Boundary & Spatial Discretization
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Min X (m)
                  </label>
                  <input
                    type="number"
                    value={config.minX}
                    onChange={(e) => handleDomainChange('minX', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Max X (m)
                  </label>
                  <input
                    type="number"
                    value={config.maxX}
                    onChange={(e) => handleDomainChange('maxX', parseFloat(e.target.value) || 100)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Min Y (m)
                  </label>
                  <input
                    type="number"
                    value={config.minY}
                    onChange={(e) => handleDomainChange('minY', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Max Y (m)
                  </label>
                  <input
                    type="number"
                    value={config.maxY}
                    onChange={(e) => handleDomainChange('maxY', parseFloat(e.target.value) || 100)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Grid Nx (cells)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={config.gridNx}
                    onChange={(e) => handleDomainChange('gridNx', parseInt(e.target.value) || 40)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                    Grid Ny (cells)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={config.gridNy}
                    onChange={(e) => handleDomainChange('gridNy', parseInt(e.target.value) || 40)}
                    className="w-full bg-white border border-[#D6DADD] rounded px-2.5 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                  />
                </div>

                <div className="col-span-2 bg-[#F1F2F3] border border-[#D6DADD] rounded p-2 text-[11px] font-mono flex items-center justify-between text-[#121212]">
                  <span>Total Grid Cells:</span>
                  <span className="font-bold text-[#C5050C]">
                    {config.gridNx * config.gridNy} cells ({( (config.maxX - config.minX) / config.gridNx ).toFixed(1)}m × {( (config.maxY - config.minY) / config.gridNy ).toFixed(1)}m)
                  </span>
                </div>
              </div>
            </div>

            {/* Advanced Settings Collapsible */}
            <div className="bg-white border border-[#D6DADD] rounded-xl overflow-hidden shadow-xs">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-3 bg-[#F1F2F3] hover:bg-[#E1E5E7] text-[#121212] flex items-center justify-between text-xs font-bold border-b border-[#D6DADD] transition focus-ring"
              >
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-[#4B4F52]" />
                  <span>Boundary Conditions, Inversion Priors & Solver Controls</span>
                </div>
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-[#4B4F52]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#4B4F52]" />
                )}
              </button>

              {showAdvanced && (
                <div className="p-4 space-y-4 text-xs bg-white">
                  <div>
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-[#4B4F52] mb-2">
                      Domain Boundary Conditions
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(['west', 'east', 'south', 'north', 'top', 'bottom'] as const).map((side) => (
                        <div key={side} className="bg-[#F7F7F7] border border-[#D6DADD] p-2 rounded">
                          <label className="block text-[10px] font-semibold capitalize text-[#6B7074] mb-1">
                            {side} Boundary
                          </label>
                          <select
                            value={config.boundaries[side]}
                            onChange={(e) => handleBoundaryChange(side, e.target.value as BoundaryCondition)}
                            disabled={side === 'top' || side === 'bottom'}
                            className="w-full bg-white border border-[#D6DADD] text-xs rounded px-1.5 py-1 text-[#121212] focus:border-[#C5050C] outline-none"
                          >
                            <option value="constant_head">Constant Head (h=0)</option>
                            <option value="no_flow">No Flow (∂h/∂n=0)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#D6DADD]">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                        Initial ln(K) [m/s]
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={config.initialLnK}
                        onChange={(e) => handleDomainChange('initialLnK', parseFloat(e.target.value) || -9.2)}
                        className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                        Initial ln(Ss) [1/m]
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={config.initialLnSs}
                        onChange={(e) => handleDomainChange('initialLnSs', parseFloat(e.target.value) || -11.5)}
                        className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1 text-xs text-[#121212] font-mono focus:border-[#C5050C]"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#D6DADD]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-xl">
                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-[#4B4F52]">
                          Solver convergence
                        </h4>
                        <p className="text-[10px] text-[#6B7074] mt-1 leading-relaxed">
                          This is a safety ceiling, not a required iteration count. The inversion stops earlier when its objective and parameter-change tolerances converge. The original P=10 baseline uses a ceiling of 30 and normally stops after 8 iterations.
                        </p>
                      </div>
                      <label className="w-full sm:w-56">
                        <span className="block text-[11px] font-semibold text-[#4B4F52] mb-1">
                          Maximum inversion iterations
                        </span>
                        <input
                          aria-label="Maximum inversion iterations"
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={config.maxIterations}
                          onChange={(event) => handleDomainChange('maxIterations', Math.max(1, Math.min(50, parseInt(event.target.value, 10) || 30)))}
                          className="w-full bg-white border border-[#D6DADD] rounded px-2 py-1.5 text-xs text-[#121212] font-mono focus:border-[#C5050C] outline-none"
                        />
                        <span className="block text-[10px] text-[#527A35] mt-1">P=10 baseline default: 30</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Button to Next Sub-tab */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveSubTab('tests')}
                className="flex items-center space-x-2 bg-[#121212] hover:bg-[#2A2A2A] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition focus-ring"
              >
                <span>Proceed to Configure Tests</span>
                <ArrowRight className="w-4 h-4 text-[#C5050C]" />
              </button>
            </div>
          </div>

          {/* Right Column: Neutral Well Map Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4 sticky top-6 self-start">
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-white shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#C5050C]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                    Well Positions Map
                  </h3>
                </div>
                <span className="text-[10px] text-[#FEF2F2] bg-[#3B0A0E] border border-[#9B0000] px-2 py-0.5 rounded font-mono">
                  Drag well or click map to relocate
                </span>
              </div>

              {/* Neutral SVG Map */}
              <div className="relative bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-2 flex flex-col items-center justify-center">
                <svg
                  width={svgWidth}
                  height={svgHeight}
                  onClick={handleMapClick}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  className={`select-none touch-none ${draggingWellId ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                >
                  {/* Background Aquifer Domain */}
                  <rect
                    x={padding}
                    y={padding}
                    width={plotWidth}
                    height={plotHeight}
                    fill="#181818"
                    stroke="#333333"
                    strokeWidth="2"
                  />

                  {/* Grid Mesh lines */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const x = padding + (i / 8) * plotWidth;
                    const y = padding + (i / 8) * plotHeight;
                    return (
                      <React.Fragment key={i}>
                        <line
                          x1={x}
                          y1={padding}
                          x2={x}
                          y2={svgHeight - padding}
                          stroke="#282828"
                          strokeDasharray="2,2"
                        />
                        <line
                          x1={padding}
                          y1={y}
                          x2={svgWidth - padding}
                          y2={y}
                          stroke="#282828"
                          strokeDasharray="2,2"
                        />
                      </React.Fragment>
                    );
                  })}

                  {/* Axis Labels */}
                  <text x={svgWidth / 2} y={svgHeight - 10} fill="#A7ADB1" fontSize="10" textAnchor="middle">
                    X Coordinate (meters)
                  </text>
                  <text
                    x={12}
                    y={svgHeight / 2}
                    fill="#A7ADB1"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(-90 12 ${svgHeight / 2})`}
                  >
                    Y Coordinate (meters)
                  </text>

                  {/* Min/Max ticks */}
                  <text x={padding} y={svgHeight - padding + 15} fill="#6B7074" fontSize="9" textAnchor="middle">
                    {config.minX}m
                  </text>
                  <text x={svgWidth - padding} y={svgHeight - padding + 15} fill="#6B7074" fontSize="9" textAnchor="middle">
                    {config.maxX}m
                  </text>

                  {/* Neutral Well Position Markers */}
                  {config.wells.map((well) => {
                    const cx = mapXToSvg(well.x);
                    const cy = mapYToSvg(well.y);
                    const isSelected = well.id === selectedWellId;
                    const isDragging = well.id === draggingWellId;

                    return (
                      <g
                        key={well.id}
                        onPointerDown={(e) => handleWellPointerDown(e, well.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWellId(well.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartEditingWell(well);
                        }}
                        className={`transition-transform select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      >
                        {isSelected && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r="12"
                            fill="none"
                            stroke="#C5050C"
                            strokeWidth="2"
                            strokeDasharray="3,2"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r="6"
                          fill={isSelected ? '#C5050C' : '#E1E5E7'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        <text
                          x={cx + 9}
                          y={cy + 3}
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="bold"
                        >
                          {well.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="text-[10px] text-[#A7ADB1] mt-2 text-center font-mono">
                  All well positions are neutral (W1–W{config.wells.length}). Roles assigned in Step 2b.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURE TESTS */}
      {activeSubTab === 'tests' && (
        <>
        <div ref={tabGridRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Multi-Test Cards (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-[#D6DADD] rounded-xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#121212] flex items-center space-x-2">
                  <FlaskConical className="w-4 h-4 text-[#C5050C]" />
                  <span>Oscillatory Tomography Tests ({config.tests.length})</span>
                </h3>
                <p className="text-[11px] text-[#6B7074] mt-0.5">
                  Configure pumping and observation well role assignments for each experiment.
                </p>
              </div>

              <button
                onClick={handleAddTest}
                className="flex items-center space-x-1.5 bg-[#C5050C] hover:bg-[#9B0000] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition focus-ring"
              >
                <Plus className="w-4 h-4" />
                <span>Add Test</span>
              </button>
            </div>

            {/* Validation Banner if any test is invalid */}
            {!isAllTestsValid && (
              <div className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] p-3 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 text-[#B91C1C]" />
                  <span>Configuration Errors Detected</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {testValidationResults
                    .filter((r) => r.errors.length > 0)
                    .map((r) => (
                      <li key={r.testId}>
                        <strong>{r.testName}:</strong> {r.errors.join(' ')}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* List of Test Cards / Accordions */}
            <div className="space-y-4">
              {config.tests.map((test, index) => {
                const isActive = test.id === activeTestId;
                const errors = validateTest(test);
                const isValid = errors.length === 0;

                const pumpingWell = config.wells.find((w) => w.id === test.pumpingWellId);
                const obsWells = config.wells.filter((w) => test.observationWellIds.includes(w.id));

                return (
                  <div
                    key={test.id}
                    ref={(el) => {
                      testRefs.current[test.id] = el;
                    }}
                    onClick={() => handleSelectTest(test.id)}
                    className={`bg-white border rounded-xl overflow-hidden transition shadow-xs cursor-pointer ${
                      isActive
                        ? 'border-[#121212] ring-2 ring-[#121212]/10'
                        : isValid
                        ? 'border-[#D6DADD] hover:border-[#A7ADB1]'
                        : 'border-[#FCA5A5]'
                    }`}
                  >
                    {/* Test Card Header Bar */}
                    <div
                      className={`p-3.5 flex items-center justify-between border-b text-xs ${
                        isActive ? 'bg-[#121212] text-white' : 'bg-[#F7F7F7] text-[#121212]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                            isActive ? 'bg-[#C5050C] text-white' : 'bg-[#E1E5E7] text-[#121212]'
                          }`}
                        >
                          {index + 1}
                        </span>

                        {editingTestId === test.id ? (
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={test.name}
                              onChange={(e) => handleUpdateTestName(test.id, e.target.value)}
                              className="bg-white border border-[#D6DADD] text-[#121212] px-2 py-0.5 rounded text-xs font-bold"
                              autoFocus
                            />
                            <button
                              onClick={() => setEditingTestId(null)}
                              className="p-1 text-emerald-500 hover:text-emerald-400"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm">{test.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTestId(test.id);
                              }}
                              className={`p-1 rounded transition ${
                                isActive ? 'hover:bg-[#2A2A2A] text-[#A7ADB1]' : 'hover:bg-[#E1E5E7] text-[#6B7074]'
                              }`}
                              title="Rename test"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        {!isValid && (
                          <span className="bg-[#FEF2F2] border border-[#FECDD3] text-[#B91C1C] text-[10px] font-bold px-2 py-0.5 rounded">
                            Invalid Setup
                          </span>
                        )}

                        <button
                          onClick={() => handleDuplicateTest(test.id)}
                          className={`p-1.5 rounded transition ${
                            isActive
                              ? 'hover:bg-[#2A2A2A] text-[#A7ADB1] hover:text-white'
                              : 'hover:bg-[#E1E5E7] text-[#6B7074]'
                          }`}
                          title="Duplicate test"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteTest(test.id)}
                          className={`p-1.5 rounded transition ${
                            isActive
                              ? 'hover:bg-[#2A2A2A] text-[#A7ADB1] hover:text-[#FF8080]'
                              : 'hover:bg-[#E1E5E7] text-[#6B7074] hover:text-[#C5050C]'
                          }`}
                          title="Delete test"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Test Card Body */}
                    <div className="p-4 space-y-4 text-xs bg-white">
                      {/* Pumping Well Selector */}
                      <div className="space-y-1.5">
                        <label className="block font-bold text-[#121212] text-[11px] uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 bg-[#C5050C] rounded-xs inline-block" />
                            <span>Pumping Well (Select exactly 1)</span>
                          </span>
                          <span className="text-[10px] text-[#6B7074] font-normal font-mono">
                            Selected: {pumpingWell ? pumpingWell.name : 'None'}
                          </span>
                        </label>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {config.wells.map((well) => {
                            const isPumping = test.pumpingWellId === well.id;
                            return (
                              <button
                                key={well.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetPumpingWell(test.id, well.id);
                                }}
                                className={`py-1.5 px-2 rounded text-xs font-bold border transition flex items-center justify-center space-x-1 ${
                                  isPumping
                                    ? 'bg-[#FEF2F2] border-[#C5050C] text-[#C5050C] ring-2 ring-[#C5050C]/20'
                                    : 'bg-white border-[#D6DADD] text-[#121212] hover:bg-[#F7F7F7]'
                                }`}
                              >
                                <span>{well.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Observation Wells Selector */}
                      <div className="space-y-1.5 pt-2 border-t border-[#D6DADD]">
                        <label className="block font-bold text-[#121212] text-[11px] uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 bg-[#2563EB] rounded-full inline-block" />
                            <span>Observation Wells (Select 1 or more)</span>
                          </span>
                          <span className="text-[10px] text-[#6B7074] font-normal font-mono">
                            Selected: {obsWells.length} wells
                          </span>
                        </label>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {config.wells.map((well) => {
                            const isPumping = test.pumpingWellId === well.id;
                            const isObs = test.observationWellIds.includes(well.id);

                            if (isPumping) {
                              return (
                                <div
                                  key={well.id}
                                  className="p-2 rounded border border-[#E1E5E7] bg-[#F7F7F7] opacity-60 text-[11px] flex items-center justify-between text-[#6B7074]"
                                  title="Pumping well cannot be selected as an observation well"
                                >
                                  <span className="font-semibold">{well.name}</span>
                                  <span className="text-[9px] bg-[#E1E5E7] px-1 py-0.2 rounded font-mono">
                                    Pumping
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <label
                                key={well.id}
                                onClick={(e) => e.stopPropagation()}
                                className={`p-2 rounded border text-xs cursor-pointer transition flex items-center justify-between ${
                                  isObs
                                    ? 'bg-[#EFF6FF] border-[#2563EB] text-[#1D4ED8] font-bold'
                                    : 'bg-white border-[#D6DADD] text-[#4B4F52] hover:bg-[#F7F7F7]'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={isObs}
                                    onChange={() => handleToggleObservationWell(test.id, well.id)}
                                    className="rounded border-[#D6DADD] text-[#2563EB] focus:ring-[#2563EB]"
                                  />
                                  <span>{well.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-[#6B7074]">
                                  ({well.x}m, {well.y}m)
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary Tagline */}
                      <div className="bg-[#F7F7F7] border border-[#D6DADD] rounded-lg p-2.5 text-[11px] font-mono text-[#121212] flex items-center justify-between">
                        <div>
                          <span className="font-bold text-[#C5050C]">Pumping:</span>{' '}
                          {pumpingWell ? pumpingWell.name : 'None'}
                        </div>
                        <div>
                          <span className="font-bold text-[#2563EB]">Observations:</span>{' '}
                          {obsWells.length > 0 ? obsWells.map((w) => w.name).join(', ') : 'None'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Test Map & LEGEND (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div
              ref={mapContainerRef}
              style={{
                transform: `translateY(${mapYOffset}px)`,
                transition: 'transform 300ms cubic-bezier(0.2, 0, 0, 1)',
              }}
              className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4 text-white shadow-md space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-2">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#C5050C]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                    Test Role Visualization ({activeTest?.name})
                  </h3>
                </div>
                <span className="text-[10px] text-[#A7ADB1] bg-[#1C1C1C] border border-[#2A2A2A] px-2 py-0.5 rounded font-mono">
                  Live Test Preview
                </span>
              </div>

              {/* Interactive SVG Test Map */}
              <div className="relative bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg p-2 flex flex-col items-center justify-center">
                <svg width={svgWidth} height={svgHeight} className="select-none">
                  {/* Background Domain */}
                  <rect
                    x={padding}
                    y={padding}
                    width={plotWidth}
                    height={plotHeight}
                    fill="#181818"
                    stroke="#333333"
                    strokeWidth="2"
                  />

                  {/* Grid Mesh */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const x = padding + (i / 8) * plotWidth;
                    const y = padding + (i / 8) * plotHeight;
                    return (
                      <React.Fragment key={i}>
                        <line
                          x1={x}
                          y1={padding}
                          x2={x}
                          y2={svgHeight - padding}
                          stroke="#282828"
                          strokeDasharray="2,2"
                        />
                        <line
                          x1={padding}
                          y1={y}
                          x2={svgWidth - padding}
                          y2={y}
                          stroke="#282828"
                          strokeDasharray="2,2"
                        />
                      </React.Fragment>
                    );
                  })}

                  {/* Axis Labels */}
                  <text x={svgWidth / 2} y={svgHeight - 10} fill="#A7ADB1" fontSize="10" textAnchor="middle">
                    X Coordinate (meters)
                  </text>
                  <text
                    x={12}
                    y={svgHeight / 2}
                    fill="#A7ADB1"
                    fontSize="10"
                    textAnchor="middle"
                    transform={`rotate(-90 12 ${svgHeight / 2})`}
                  >
                    Y Coordinate (meters)
                  </text>

                  {/* Render Well Roles for Active Test */}
                  {config.wells.map((well) => {
                    const cx = mapXToSvg(well.x);
                    const cy = mapYToSvg(well.y);

                    const isPumping = activeTest?.pumpingWellId === well.id;
                    const isObservation = activeTest?.observationWellIds.includes(well.id);

                    if (isPumping) {
                      return (
                        <g key={well.id}>
                          {/* Dynamic radiating pressure wave fronts around pumping well */}
                          <circle
                            cx={cx}
                            cy={cy}
                            fill="none"
                            stroke="#C5050C"
                            className="animate-hydraulic-wave-1"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            fill="none"
                            stroke="#C5050C"
                            className="animate-hydraulic-wave-2"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            fill="none"
                            stroke="#C5050C"
                            className="animate-hydraulic-wave-3"
                          />
                          <polygon
                            points={`${cx},${cy - 9} ${cx + 8},${cy + 6} ${cx - 8},${cy + 6}`}
                            fill="#C5050C"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text
                            x={cx}
                            y={cy - 12}
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {well.name} (Pump)
                          </text>
                        </g>
                      );
                    }

                    if (isObservation) {
                      return (
                        <g key={well.id}>
                          <circle cx={cx} cy={cy} r="6" fill="#2563EB" stroke="#ffffff" strokeWidth="1.5" />
                          <text
                            x={cx + 9}
                            y={cy + 3}
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="semibold"
                          >
                            {well.name}
                          </text>
                        </g>
                      );
                    }

                    // Not used in this test
                    return (
                      <g key={well.id} className="opacity-40">
                        <circle cx={cx} cy={cy} r="5" fill="none" stroke="#6B7074" strokeWidth="1.5" strokeDasharray="2,2" />
                        <text
                          x={cx + 8}
                          y={cy + 3}
                          fill="#888888"
                          fontSize="9"
                          fontWeight="normal"
                        >
                          {well.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* LEGEND - REQUIREMENT 3: Appears ONLY on Configure Tests screen */}
                <div className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-lg p-3 mt-2 space-y-1.5 text-xs text-[#E1E5E7]">
                  <div className="text-[10px] uppercase font-bold text-[#A7ADB1] border-b border-[#2A2A2A] pb-1 tracking-wider">
                    Role Map Legend ({activeTest?.name})
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-[#C5050C] rounded-xs flex-shrink-0 inline-block" />
                      <span className="font-semibold text-white">Pumping Well</span>
                      <span className="text-[10px] text-[#A7ADB1]">(Sinusoidal flow source Q)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 bg-[#2563EB] rounded-full flex-shrink-0 inline-block" />
                      <span className="font-semibold text-white">Observation Well</span>
                      <span className="text-[10px] text-[#A7ADB1]">(Pressure transducer)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full border border-dashed border-[#6B7074] flex-shrink-0 inline-block" />
                      <span className="text-[#A7ADB1]">Not used in this test</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Keep the sub-step progression visible where the user finishes the
            test list instead of requiring a return to the page header. */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setActiveSubTab('positions')}
            className="flex items-center space-x-2 bg-white hover:bg-[#F1F2F3] text-[#121212] border border-[#D6DADD] font-bold text-xs px-5 py-2.5 rounded-lg transition focus-ring"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Well Positions</span>
          </button>
          <button
            onClick={onNext}
            disabled={!isAllTestsValid}
            title={!isAllTestsValid ? 'Resolve the test configuration errors before reviewing inputs.' : ''}
            className={`flex items-center space-x-2 font-bold text-xs px-5 py-2.5 rounded-lg shadow-xs transition focus-ring ${
              isAllTestsValid
                ? 'bg-[#C5050C] hover:bg-[#9B0000] text-white'
                : 'bg-[#E1E5E7] text-[#6B7074] cursor-not-allowed'
            }`}
          >
            <span>Proceed to Review Inputs</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        </>
      )}
    </div>
  );
};
