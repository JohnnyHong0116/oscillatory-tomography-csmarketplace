/** Reveal newly rendered content only after React and layout have settled. */
export function revealAfterRender(
  getElement: () => HTMLElement | null,
  block: ScrollLogicalPosition = 'start',
  moveFocus = true
) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const element = getElement();
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
      if (moveFocus) element.focus({ preventScroll: true });
    });
  });
}
