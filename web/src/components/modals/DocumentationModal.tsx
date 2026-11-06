import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white text-[#121212] w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-xl shadow-2xl overflow-hidden border border-[#D6DADD]">
        <div className="p-4 bg-[#121212] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#C5050C]" />
            <h2 className="font-bold text-sm">Aquifer Imaging Studio Documentation</h2>
          </div>
          <button
            aria-label="Close Documentation"
            onClick={onClose}
            className="p-1 text-[#A7ADB1] hover:text-white rounded hover:bg-[#2A2A2A] transition focus-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-0 p-6 space-y-4 text-xs leading-relaxed overflow-y-auto bg-white">
          <section className="rounded-lg border border-[#D6DADD] bg-[#F7F7F7] p-4 space-y-2">
            <h3 className="text-sm font-bold">Your experiment · user workflow</h3>
            <p>Start with physical well locations in local Cartesian meters. Define the domain, cell sizes and boundary assumptions, then assign one pump and its observers for each test setup. Apply a period range or list and specify peak pumping amplitude.</p>
            <p>Continue through Review → Data &amp; run → Results. A forward run predicts homogeneous-model responses. Use these responses for inversion transfers full-precision synthetic real/imaginary heads into the imported-data workflow after explicit grid review. Synthetic recovery is not field validation.</p>
            <p>Choose 2D or 3D in Model dimensions. In 3D, Z is elevation (positive upward); wells are point ports. Define all three grid axes and six boundary faces. Black–Kipp analytical comparison remains 2D. Result volumes offer rotatable orthogonal slices and individual horizontal layers.</p><p>Examples are optional practice projects, separate from Your experiment: Black–Kipp first, then the original P=10 checkerboard inversion. The solver supports 30 ports. 2D and inversion allow 30 tests / 100 pairs; 3D forward allows 108 tests / 1,500 pairs. The MATLAB 3D example offers original 8,000-cell forward inputs and an explicitly reduced 512-cell recovery, plus saved Python-computed previews; 2D inversion grids are limited to 60 × 60. 3D volumes support up to 8,000 forward cells or 3,600 inversion cells. The supplied presets are checked against actual MATLAB runs with explicit numerical tolerances. 3D presets use MATLAB-generated reference truth; custom NumPy fields use a different random stream. The full 3D inverse run remains outside the interactive budget. Projects remain in memory; use Save & share experiment on Results for a complete CSV or link before refreshing. Import either on the first Your experiment screen to review and reuse it.</p>
          </section>
          <div>
            <h3 className="font-bold text-sm text-[#121212] mb-1">
              Scientific Background & Methods
            </h3>
            <p className="text-[#4B4F52]">
              Oscillatory hydraulic tomography is a high-resolution, non-destructive hydrogeological technique. By applying a sinusoidal flow rate at a central pumping well, periodic head oscillations propagate through the aquifer matrix. The amplitude decay and phase shift measured at surrounding observation wells encode the spatial variation of hydraulic conductivity K(x,y) and specific storage S_s(x,y).
            </p>
          </div>

          <div className="border-t border-[#D6DADD] pt-3">
            <h3 className="font-bold text-sm text-[#121212] mb-1">
              Inversion Workflow (MATLAB / Python Transcription)
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-[#4B4F52]">
              <li>
                <strong>Forward Solver:</strong> Solves periodic diffusion PDE ∇ · (K ∇ h) = S_s (∂h/∂t) in the frequency domain.
              </li>
              <li>
                <strong>Sensitivity Jacobian J:</strong> Calculated using adjoint state formulations to map parameter sensitivities.
              </li>
              <li>
                <strong>Geostatistical Optimization:</strong> Minimizes objective function Φ(m) = (d_obs - f(m))ᵀ C_d⁻¹ (d_obs - f(m)) + (m - m_0)ᵀ Q_ss⁻¹ (m - m_0).
              </li>
            </ol>
          </div>

          <div className="border-t border-[#D6DADD] pt-3">
            <h3 className="font-bold text-sm text-[#121212] mb-1">
              References & Publications
            </h3>
            <p className="text-[#6B7074] font-mono text-[11px]">
              Cardiff, M., & Barrash, W. (2011). 3-D transient hydraulic tomography in unconfined aquifers. Water Resources Research, 47(12).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
