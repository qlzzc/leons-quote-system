import { escapeHtml } from '../lib/format.js';

export function renderLogin(state) {
  const otpDigits = Array.from({ length: 6 }).map((_, index) => state.otpCode?.[index] || '');

  return `
    <div class="app-shell">
      <div class="screen-center">
        <section class="auth-card">
          <div class="eyebrow">Client Portal</div>
          <h1 class="headline auth-headline" style="margin-top:20px;">Secure client access<br><em>by phone verification.</em></h1>
          <p class="lede auth-lede">Enter the phone number associated with your project. A one-time verification code will be sent before any proposal or project material is shown.</p>

          ${state.error ? `<div class="message message--error section">${escapeHtml(state.error)}</div>` : ''}
          ${state.message ? `<div class="message message--success section">${escapeHtml(state.message)}</div>` : ''}

          ${!state.otpSent ? `
            <div class="section stack">
              <div class="field-group">
                <label class="field-label" for="phone-input">Phone number</label>
                <input id="phone-input" class="field-input" type="tel" placeholder="+1 780 555 0123" value="${escapeHtml(state.pendingPhone)}" autocomplete="tel" ${state.loading ? 'disabled' : ''}>
              </div>
              <button class="button button--primary" id="send-otp-button" ${state.loading ? 'disabled' : ''}>
                ${state.loading ? `<span class="btn-spinner"></span> Sending...` : 'Send code'}
              </button>
            </div>
          ` : `
            <div class="section stack" id="otp-step">
              <div class="otp-summary">
                <div class="meta-label">Verification</div>
                <div class="body-copy" style="margin-top:8px;">Code sent to ${escapeHtml(state.pendingPhone)}.</div>
              </div>
              <div class="field-group">
                <label class="field-label" for="otp-input-0">Verification code</label>
                <div class="otp-grid">
                  ${otpDigits.map((digit, index) => `<input id="otp-input-${index}" data-otp-index="${index}" class="field-input otp-input" inputmode="numeric" maxlength="1" autocomplete="one-time-code" value="${escapeHtml(digit)}" ${state.loading ? 'disabled' : ''}>`).join('')}
                </div>
              </div>
              <button class="button button--primary" id="verify-otp-button" ${state.loading ? 'disabled' : ''}>
                ${state.loading
                  ? `<span class="btn-spinner"></span> Verifying, please wait...`
                  : 'Verify and continue'}
              </button>
              <div class="otp-actions">
                <button class="button" id="resend-otp-button" type="button" ${state.loading ? 'disabled' : ''}>Resend code</button>
                <button class="button" id="change-number-button" type="button" ${state.loading ? 'disabled' : ''}>Change number</button>
              </div>
            </div>
          `}
          <p class="footer-note">Only phone numbers authorized for portal access can continue.</p>
        </section>
      </div>
    </div>

    <style>
      .btn-spinner {
        display:inline-block;
        width:13px; height:13px;
        border:2px solid rgba(255,255,255,0.35);
        border-top-color:rgba(255,255,255,0.9);
        border-radius:50%;
        animation:spin 0.6s linear infinite;
        vertical-align:middle;
        margin-right:6px;
      }
      @keyframes spin { to { transform:rotate(360deg); } }
    </style>
  `;
}

export function mountLogin({ state, onSendOtp, onVerifyOtp, onResendOtp, onChangeNumber, onOtpInput }) {
  document.getElementById('send-otp-button')?.addEventListener('click', () => {
    const phone = document.getElementById('phone-input')?.value || '';
    onSendOtp(phone);
  });

  document.getElementById('resend-otp-button')?.addEventListener('click', () => {
    onResendOtp();
  });

  document.getElementById('change-number-button')?.addEventListener('click', () => {
    onChangeNumber();
  });

  const otpInputs = [...document.querySelectorAll('[data-otp-index]')];
  if (otpInputs.length && !state.loading) {
    const otpStep = document.getElementById('otp-step');
    window.requestAnimationFrame(() => {
      otpStep?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstEmptyInput = otpInputs.find((input) => !input.value) || otpInputs[0];
      firstEmptyInput?.focus();
      firstEmptyInput?.select?.();
    });
  }

  otpInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      const code = otpInputs.map((field) => field.value).join('');
      onOtpInput(code);
      if (input.value && otpInputs[index + 1]) otpInputs[index + 1].focus();
      if (otpInputs.every((field) => field.value)) {
        onVerifyOtp(code);
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && otpInputs[index - 1]) otpInputs[index - 1].focus();
      if (event.key === 'Enter') {
        const code = otpInputs.map((field) => field.value).join('');
        onVerifyOtp(code);
      }
    });
    input.addEventListener('focus', () => {
      if (state.loading) return;
      input.select?.();
    });
  });

  document.getElementById('verify-otp-button')?.addEventListener('click', () => {
    const code = otpInputs.map((input) => input.value).join('');
    onVerifyOtp(code);
  });
}
