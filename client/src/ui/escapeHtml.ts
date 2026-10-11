const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Escapes untrusted text (player names, titles) before it is interpolated into innerHTML templates
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
