import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#121212]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white text-[#121212] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden border border-[#D6DADD]">
        <div className="p-4 bg-[#121212] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#C5050C]" />
            <h2 className="font-bold text-sm">Aquifer Imaging Studio Documentation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#A7ADB1] hover:text-white rounded hover:bg-[#2A2A2A] transition focus-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs leading-relaxed max-h-[80vh] overflow-y-auto bg-white">
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
