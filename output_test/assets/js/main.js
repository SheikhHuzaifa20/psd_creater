document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.querySelector('.psd-canvas');
  const viewport = document.querySelector('.psd-viewport');
  function resize() {
    if (!canvas || !viewport) return;
    const scale = Math.min(1, viewport.clientWidth / 1200);
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.transformOrigin = 'top left';
    viewport.style.height = (800 * scale) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(viewport);
});
