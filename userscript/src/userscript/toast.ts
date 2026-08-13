export type ToastType = 'success' | 'warning' | 'error';

const TOAST_ID = 'mpv-toast';

/**
 * Dark-mode aware. `copyText`, when given, adds a manual Copy button for it — pass the actual
 * payload (a video URL, an mpv shell command) explicitly rather than the displayed message: the
 * original script tried to strip a prefix off `message` to recover it, but that prefix never
 * matched any message actually shown, so the button always copied the whole sentence verbatim
 * (e.g. copying "Opening in MPV..." itself instead of the video URL).
 */
export function showToast(message: string, type: ToastType, copyText?: string): void {
  document.getElementById(TOAST_ID)?.remove();

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isError = type === 'error';

  const bgColor = isError ? '#e74c3c' : isDark ? '#333' : '#fff';
  const textColor = isError ? '#fff' : isDark ? '#fff' : '#333';
  const borderColor = isError ? 'transparent' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const btnBg = isError ? 'rgba(255,255,255,0.2)' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const btnBorder = isError ? 'rgba(255,255,255,0.3)' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const btnColor = isError ? '#fff' : isDark ? '#fff' : '#333';

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${bgColor};
    color: ${textColor};
    border: 1px solid ${borderColor};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 99999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: mpv-fade-in 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  if (copyText !== undefined) {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = `
      background: ${btnBg};
      border: 1px solid ${btnBorder};
      color: ${btnColor};
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    copyBtn.onclick = () => {
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
          }, 1000);
        })
        .catch(() => {
          // Best-effort manual copy button — nothing useful to do if the clipboard API itself fails.
        });
    };
    toast.appendChild(copyBtn);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'mpv-fade-out 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}
