import { ErrorMode } from '../game/typingEngine';
import { ICONS } from './icons';

export const CATEGORY_LABELS: Record<string, string> = {
  cyberpunk: 'Cyberpunk & Matrix',
  scifi: 'Sci-Fi Classics (Dune/Asimov)',
  philosophy: 'AI & Philosophy (Turing)',
  lyrics: 'Lyrics Mode (24 Songs)',
  all: 'All Curated Archives',
  custom: 'Custom Passage...',
};

export function renderSoloPanel(
  selectedBotDiff: string,
  customBotWpm: number,
  selectedErrorMode: ErrorMode,
  selectedCategory: string,
  categoryLabel: string,
  isActive: boolean
): string {
  return `
    <div id="panel-solo-mode" class="tab-panel ${isActive ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Section 01: AI Challenger -->
      <div class="section-group">
        <div class="section-header">
          <span class="section-number">01</span>
          <span class="section-title">SELECT AI OPPONENT</span>
        </div>
        <div class="bot-difficulty-grid">
          <button type="button" class="bot-diff-card ${selectedBotDiff === 'easy' ? 'active' : ''}" data-diff="easy">
            <span class="diff-badge badge-easy">EASY</span>
            <span class="diff-name">DRONE-ALPHA</span>
            <span class="diff-speed">~38 WPM</span>
          </button>
          <button type="button" class="bot-diff-card ${selectedBotDiff === 'medium' ? 'active' : ''}" data-diff="medium">
            <span class="diff-badge badge-medium">NORMAL</span>
            <span class="diff-name">NEXUS-V2</span>
            <span class="diff-speed">~68 WPM</span>
          </button>
          <button type="button" class="bot-diff-card ${selectedBotDiff === 'hard' ? 'active' : ''}" data-diff="hard">
            <span class="diff-badge badge-hard">EXPERT</span>
            <span class="diff-name">CYBER-VIPER</span>
            <span class="diff-speed">~98 WPM</span>
          </button>
          <button type="button" class="bot-diff-card ${selectedBotDiff === 'cybergod' ? 'active' : ''}" data-diff="cybergod">
            <span class="diff-badge badge-god">CYBERGOD</span>
            <span class="diff-name">QUANTUM-CORE</span>
            <span class="diff-speed">~135 WPM</span>
          </button>
          <button type="button" class="bot-diff-card ${selectedBotDiff === 'custom' ? 'active' : ''}" data-diff="custom">
            <span class="diff-badge badge-custom">CUSTOM</span>
            <span class="diff-name">CUSTOM-UNIT</span>
            <span class="diff-speed" id="card-custom-wpm-label">~${customBotWpm} WPM</span>
          </button>
        </div>

        <!-- Custom Bot Speed Controls -->
        <div id="bot-custom-wpm-wrapper" class="setting-row ${selectedBotDiff === 'custom' ? '' : 'hidden'}" style="margin-top: 10px; background: rgba(217, 70, 239, 0.05); border: 1px solid rgba(217, 70, 239, 0.25); border-radius: 4px; padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label class="setting-label" style="margin: 0; color: #d946ef; font-weight: 700;">CUSTOM AI OPPONENT SPEED</label>
            <div style="display: flex; align-items: center; gap: 6px;">
              <input id="input-custom-bot-wpm" type="number" min="15" max="250" value="${customBotWpm}" class="input-cyber" style="width: 72px; text-align: center; font-size: 0.95rem; font-weight: 700; padding: 3px 6px; border-color: rgba(217, 70, 239, 0.4);" />
              <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #d946ef; font-weight: 700;">WPM</span>
            </div>
          </div>
          <input id="slider-custom-bot-wpm" type="range" min="15" max="250" step="5" value="${customBotWpm}" style="width: 100%; accent-color: #d946ef; cursor: pointer;" />
          <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted); margin-top: 4px;">
            <span>15 WPM</span>
            <span>60 WPM</span>
            <span>100 WPM</span>
            <span>160 WPM</span>
            <span>250 WPM</span>
          </div>
        </div>
      </div>

      <!-- Section 02: Match Rules & Archive -->
      <div class="section-group">
        <div class="section-header">
          <span class="section-number">02</span>
          <span class="section-title">MATCH PROTOCOL & ARCHIVE</span>
        </div>
        <div class="config-grid-2col">
          <div class="setting-row">
            <label class="setting-label">ERROR TOLERANCE</label>
            <div class="mode-toggle-group">
              <button type="button" class="mode-btn solo-mode-btn ${selectedErrorMode === 'allow_errors' ? 'active' : ''}" data-mode="allow_errors">
                ALLOW ERRORS
              </button>
              <button type="button" class="mode-btn solo-mode-btn ${selectedErrorMode === 'strict_errors' ? 'active' : ''}" data-mode="strict_errors">
                STRICT MODE
              </button>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">PASSAGE ARCHIVE</label>
            <div class="cyber-dropdown" id="dropdown-solo">
              <button type="button" class="cyber-dropdown-trigger" id="dropdown-trigger-solo">
                <span id="dropdown-selected-solo">${categoryLabel}</span>
                <span class="cyber-dropdown-caret">${ICONS.chevronDown(14)}</span>
              </button>
              <div class="cyber-dropdown-menu hidden" id="dropdown-menu-solo">
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'cyberpunk' ? 'active' : ''}" data-val="cyberpunk">
                  Cyberpunk & Matrix
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'scifi' ? 'active' : ''}" data-val="scifi">
                  Sci-Fi Classics (Dune/Asimov)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'philosophy' ? 'active' : ''}" data-val="philosophy">
                  AI & Philosophy (Turing)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'lyrics' ? 'active' : ''}" data-val="lyrics">
                  Lyrics Mode (24 Songs)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'all' ? 'active' : ''}" data-val="all">
                  All Curated Archives
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'custom' ? 'active' : ''}" data-val="custom">
                  Custom Passage...
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="solo-custom-text-wrapper" class="setting-row ${selectedCategory === 'custom' ? '' : 'hidden'}" style="margin-top: 4px;">
          <label class="setting-label">CUSTOM DUEL PASSAGE</label>
          <textarea id="input-solo-custom-text" class="input-cyber" rows="2" placeholder="Type or paste custom duel passage..."></textarea>
        </div>

        <div id="solo-lyrics-selector-wrapper" class="${selectedCategory === 'lyrics' ? '' : 'hidden'}" style="margin-top: 4px;"></div>
      </div>

      <button id="btn-start-solo-match" type="button" class="btn-cyber-primary btn-launch">
        ${ICONS.zap(16)} ENGAGE 1-PLAYER BATTLE
      </button>
    </div>
  `;
}

export function renderZenPanel(
  selectedErrorMode: ErrorMode,
  selectedCategory: string,
  categoryLabel: string,
  isActive: boolean
): string {
  return `
    <div id="panel-zen-mode" class="tab-panel ${isActive ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 14px;">
      <!-- Zen Protocol & Archive -->
      <div class="section-group">
        <div class="section-header">
          <span class="section-number">01</span>
          <span class="section-title">ZEN PRACTICE PROTOCOL & ARCHIVE</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0; line-height: 1.4;">
          Tranquil solo typing session. No opponent, no tug-of-war countdown pressure, no clash projectiles. Practice passages or flow along to song lyrics at your own rhythm.
        </p>

        <div class="config-grid-2col" style="margin-top: 4px;">
          <div class="setting-row">
            <label class="setting-label">ERROR TOLERANCE</label>
            <div class="mode-toggle-group">
              <button type="button" class="mode-btn zen-mode-btn ${selectedErrorMode === 'allow_errors' ? 'active' : ''}" data-mode="allow_errors">
                ALLOW ERRORS
              </button>
              <button type="button" class="mode-btn zen-mode-btn ${selectedErrorMode === 'strict_errors' ? 'active' : ''}" data-mode="strict_errors">
                STRICT MODE
              </button>
            </div>
          </div>

          <div class="setting-row">
            <label class="setting-label">PASSAGE ARCHIVE</label>
            <div class="cyber-dropdown" id="dropdown-zen">
              <button type="button" class="cyber-dropdown-trigger" id="dropdown-trigger-zen">
                <span id="dropdown-selected-zen">${categoryLabel}</span>
                <span class="cyber-dropdown-caret">${ICONS.chevronDown(14)}</span>
              </button>
              <div class="cyber-dropdown-menu hidden" id="dropdown-menu-zen">
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'cyberpunk' ? 'active' : ''}" data-val="cyberpunk">
                  Cyberpunk & Matrix
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'scifi' ? 'active' : ''}" data-val="scifi">
                  Sci-Fi Classics (Dune/Asimov)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'philosophy' ? 'active' : ''}" data-val="philosophy">
                  AI & Philosophy (Turing)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'lyrics' ? 'active' : ''}" data-val="lyrics">
                  Lyrics Mode (24 Songs)
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'all' ? 'active' : ''}" data-val="all">
                  All Curated Archives
                </button>
                <button type="button" class="cyber-dropdown-item ${selectedCategory === 'custom' ? 'active' : ''}" data-val="custom">
                  Custom Passage...
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="zen-custom-text-wrapper" class="setting-row ${selectedCategory === 'custom' ? '' : 'hidden'}" style="margin-top: 4px;">
          <label class="setting-label">CUSTOM PRACTICE PASSAGE</label>
          <textarea id="input-zen-custom-text" class="input-cyber" rows="2" placeholder="Type or paste custom practice passage..."></textarea>
        </div>

        <div id="zen-lyrics-selector-wrapper" class="${selectedCategory === 'lyrics' ? '' : 'hidden'}" style="margin-top: 4px;"></div>
      </div>

      <button id="btn-start-zen-match" type="button" class="btn-cyber-primary btn-launch btn-zen-launch">
        ${ICONS.zen(18)} ENTER ZEN FLOW
      </button>
    </div>
  `;
}

export function renderMultiPanel(isActive: boolean, initialRoomCode: string = ''): string {
  return `
    <div id="panel-multiplayer-mode" class="tab-panel ${isActive ? '' : 'hidden'}">
      <div class="lobby-grid">
        <!-- Subpanel 1: Host Room -->
        <div class="lobby-panel" style="justify-content: space-between;">
          <div>
            <div class="panel-title">
              HOST PRIVATE ROOM
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 10px 0 16px 0;">
              Initialize a private arena to duel head-to-head with a rival. Settings such as error tolerance and passage archive can be configured inside the room after creation.
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; background: rgba(0, 240, 255, 0.04); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 4px; font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-secondary);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--cyan-primary);">${ICONS.key(16)}</span>
                <span>Instant Room Code & 1-Click Link</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--cyan-primary);">${ICONS.settings(16)}</span>
                <span>In-Room Error Mode & Passage Selection</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--cyan-primary);">${ICONS.music(16)}</span>
                <span>Lyrics Mode & Custom Text Support</span>
              </div>
            </div>
          </div>

          <button id="btn-create-room" type="button" class="btn-cyber-primary" style="margin-top: 18px; padding: 13px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.12em; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
            ${ICONS.zap(16)} CREATE ROOM
          </button>
        </div>

        <!-- Subpanel 2: Join Room -->
        <div class="lobby-panel" style="justify-content: space-between;">
          <div>
            <div class="panel-title" style="display: flex; align-items: center; gap: 8px;">
              ${ICONS.link(16)} JOIN BY ROOM CODE
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 10px 0 16px 0;">
              Enter the room access code provided by your rival to synchronize conduits and engage in battle.
            </p>
            <div class="setting-row" style="margin-top: 6px;">
              <label class="setting-label">ROOM ACCESS CODE</label>
              <input id="input-join-room-code" type="text" class="input-cyber" value="${initialRoomCode}" placeholder="E.G. 7K9QM" maxlength="10" style="text-transform: uppercase; font-size: 1.15rem; letter-spacing: 0.18em; font-weight: 800; text-align: center;" />
            </div>
          </div>

          <div style="margin-top: 18px;">
            <button id="btn-join-room" type="button" class="btn-cyber-secondary" style="padding: 13px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.12em; width: 100%;">
              JOIN ROOM
            </button>
            <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); margin-top: 8px; text-align: center;">
              Or open a direct challenge link (e.g. <code>?room=CODE</code>).
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
