// Cyberpunk Vector SVG Icon Library (Zero Emojis)

function svg(paths: string, size = 18, extraClass = ''): string {
  const cls = extraClass ? `class="cyber-icon ${extraClass}"` : 'class="cyber-icon"';
  return `<svg ${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export const ICONS = {
  // Mode Selector Icons
  bot: (size = 20) =>
    svg(
      `<rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line>`,
      size
    ),
  zen: (size = 20) =>
    svg(
      `<circle cx="12" cy="12" r="10"></circle><path d="M12 2a5 5 0 0 0 0 10 5 5 0 0 1 0 10"></path><circle cx="12" cy="7" r="1.5" fill="currentColor"></circle><circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>`,
      size
    ),
  globe: (size = 20) =>
    svg(
      `<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>`,
      size
    ),

  // Audio Icons
  volume: (size = 18) =>
    svg(
      `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`,
      size
    ),
  volumeMuted: (size = 18) =>
    svg(
      `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`,
      size
    ),

  // Actions & Indicators
  zap: (size = 16) =>
    svg(`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>`, size),
  alert: (size = 16) =>
    svg(
      `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`,
      size
    ),
  check: (size = 16) =>
    svg(`<polyline points="20 6 9 17 4 12"></polyline>`, size),
  copy: (size = 16) =>
    svg(
      `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`,
      size
    ),
  settings: (size = 16) =>
    svg(
      `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`,
      size
    ),
  music: (size = 16) =>
    svg(
      `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`,
      size
    ),
  play: (size = 14) =>
    svg(`<polygon points="5 3 19 12 5 21 5 3"></polygon>`, size),
  stop: (size = 14) =>
    svg(`<rect x="4" y="4" width="16" height="16" rx="2"></rect>`, size),
  folder: (size = 16) =>
    svg(
      `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>`,
      size
    ),
  link: (size = 16) =>
    svg(
      `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>`,
      size
    ),
  key: (size = 16) =>
    svg(
      `<path d="m21 2-2 2m-1.5 1.5L16 7l2 2-1.5 1.5L15 9l-2 2m-2-2a5.5 5.5 0 1 0-7.78 7.78 5.5 5.5 0 0 0 7.78-7.78Z"></path>`,
      size
    ),
  pause: (size = 14) =>
    svg(
      `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`,
      size
    ),
  x: (size = 14) =>
    svg(
      `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`,
      size
    ),
  flame: (size = 14) =>
    svg(
      `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>`,
      size
    ),
  chevronDown: (size = 14) =>
    svg(`<polyline points="6 9 12 15 18 9"></polyline>`, size),
  chart: (size = 16) =>
    svg(
      `<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>`,
      size
    ),
  keyboard: (size = 16) =>
    svg(
      `<rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10"></path>`,
      size
    ),
  trophy: (size = 16) =>
    svg(
      `<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>`,
      size
    ),
  trash: (size = 15) =>
    svg(
      `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`,
      size
    ),
};

