export function mountQuoteSigning({ state, onSubmit }) {
  const canvas = document.getElementById('quote-signature-canvas');
  if (!canvas) return;

  const signerInput = document.getElementById('quote-signer-name');
  const agreementInput = document.getElementById('quote-agreement-checkbox');
  const placeholder = document.getElementById('quote-signature-placeholder');
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasInk = Boolean(state.quoteSigning?.signatureData);

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#565954';
    redrawSavedSignature();
  }

  function setPlaceholderVisibility() {
    placeholder.style.display = hasInk ? 'none' : 'grid';
  }

  function redrawSavedSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.quoteSigning?.signatureData) {
      hasInk = false;
      setPlaceholderVisibility();
      return;
    }
    const image = new Image();
    image.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(image, 0, 0, rect.width, rect.height);
      hasInk = true;
      setPlaceholderVisibility();
    };
    image.src = state.quoteSigning.signatureData;
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  function start(event) {
    if (state.quoteSigning?.submitting) return;
    drawing = true;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    hasInk = true;
    setPlaceholderVisibility();
    event.preventDefault();
  }

  function move(event) {
    if (!drawing) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    event.preventDefault();
  }

  function stop() {
    if (!drawing) return;
    drawing = false;
    ctx.beginPath();
    state.quoteSigning.signatureData = canvas.toDataURL('image/png');
  }

  resizeCanvas();
  setPlaceholderVisibility();
  if (window.__quoteSignatureResizeHandler) {
    window.removeEventListener('resize', window.__quoteSignatureResizeHandler);
  }
  window.__quoteSignatureResizeHandler = resizeCanvas;
  window.addEventListener('resize', window.__quoteSignatureResizeHandler);

  signerInput?.addEventListener('input', (event) => {
    state.quoteSigning.signerName = event.currentTarget.value;
  });

  agreementInput?.addEventListener('change', (event) => {
    state.quoteSigning.agreementAccepted = Boolean(event.currentTarget.checked);
  });

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', stop);

  document.querySelector('[data-action="clear-quote-signature"]')?.addEventListener('click', () => {
    if (state.quoteSigning?.submitting) return;
    state.quoteSigning.signatureData = '';
    hasInk = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPlaceholderVisibility();
  });

  document.querySelector('[data-action="submit-quote-signature"]')?.addEventListener('click', () => {
    state.quoteSigning.signatureData = state.quoteSigning.signatureData || canvas.toDataURL('image/png');
    onSubmit({
      signerName: state.quoteSigning.signerName || '',
      agreementAccepted: Boolean(state.quoteSigning.agreementAccepted),
      signatureData: state.quoteSigning.signatureData || '',
    });
  });
}
