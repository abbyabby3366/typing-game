import { ICONS } from './icons';
import { escapeHtml } from './escapeHtml';

export function showCyberToast(
  container: HTMLElement,
  message: string,
  isError: boolean = false
): void {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  const iconHtml = isError ? ICONS.alert(16) : ICONS.zap(16);
  toast.innerHTML = `${iconHtml} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3800);
}
