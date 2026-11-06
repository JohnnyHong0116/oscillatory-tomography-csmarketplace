import React, { useEffect, useRef } from 'react';

/** An in-app modal keeps replacement review accessible in embedded browsers,
 * where a synchronous browser confirm can block the entire tab. Escape and
 * outside clicks cancel; focus returns to the invoking example action. */
export function PracticePreviewConfirm({onConfirm,onClose}:{onConfirm:()=>void;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const origin=document.activeElement as HTMLElement|null;
    ref.current?.showModal();
    return ()=>{ref.current?.close();origin?.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} aria-labelledby="practice-replace-title"
    onCancel={e=>{e.preventDefault();onClose();}}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    className="m-auto w-[min(480px,calc(100%-32px))] rounded-2xl border border-slate-200 p-6 shadow-2xl backdrop:bg-black/45 text-slate-900">
    <h2 id="practice-replace-title" className="font-bold text-lg">Replace practice results?</h2>
    <p className="mt-3 text-sm leading-6 text-slate-600">Opening this computed preview replaces the current practice configuration and results. Your personal experiment is preserved. Cancel to export your current practice first.</p>
    <div className="mt-5 flex flex-wrap justify-end gap-3">
      <button type="button" autoFocus onClick={onClose} className="min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold focus-ring">Cancel</button>
      <button type="button" onClick={onConfirm} className="min-h-11 rounded-lg bg-[#C5050C] text-white px-4 py-2 text-sm font-semibold hover:bg-[#9B0000] focus-ring">Open preview</button>
    </div>
  </dialog>;
}
