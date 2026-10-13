import { ErrorMode } from '../game/typingEngine';
import { soundEngine } from '../audio/soundEngine';
import { musicPlayer } from '../audio/musicPlayer';
import { SongTrack } from '../game/songCatalog';
import { LyricsSelectorView } from './lyricsSelectorView';
import { CATEGORY_LABELS, ERROR_TOLERANCE_TOOLTIP_HTML } from './lobbyPanels';
import { ICONS } from './icons';
import { escapeHtml } from './escapeHtml';

export interface RoomSettingsConfig {
  errorMode: ErrorMode;
  category: string;
  customText: string | null;
  selectedSong?: SongTrack | null;
}

export class WaitingRoomView {
  private container: HTMLElement;
  public onUpdateSettings?: (config: RoomSettingsConfig) => void;
  public onCancelRoom?: () => void;
  public onStartDuel?: () => void;

  private roomCode: string = '';
  private isHost: boolean = true;
  private selectedErrorMode: ErrorMode = 'allow_errors';
  private selectedCategory: string = 'cyberpunk';
  private customText: string | null = null;
  private selectedSong: SongTrack | null = null;
  private lyricsSelector: LyricsSelectorView | null = null;
  private opponentName: string | null = null;
  private textDebounceTimer: number | null = null;
  private docListenerBound: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(roomCode: string, isHost: boolean = true, initialSettings?: any, opponentName?: string): void {
    this.roomCode = roomCode;
    this.isHost = isHost;
    this.opponentName = opponentName || null;

    if (initialSettings) {
      if (initialSettings.error_mode) {
        this.selectedErrorMode = initialSettings.error_mode as ErrorMode;
      }
      if (initialSettings.category) {
        this.selectedCategory = initialSettings.category;
      }
      if (initialSettings.custom_text) {
        this.customText = initialSettings.custom_text;
      }
    }

    const savedName = localStorage.getItem('cyber_pilot_name') || 'HOST';
    const categoryLabel = CATEGORY_LABELS[this.selectedCategory] || 'Cyberpunk & Matrix';
    const fullUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;

    this.container.innerHTML = `
      <div class="lobby-card" style="max-width: 760px; margin: auto 0;">
        <!-- Header -->
        <div class="lobby-header-row">
          <div class="lobby-title-group">
            <h2 class="brand-title" style="font-size: 1.7rem; margin: 0;">
              ARENA LINK <span class="text-cyan">INITIALIZED</span>
            </h2>
            <p class="lobby-subtitle">Private Duel Arena // Challenge conduit ready for rival</p>
          </div>
          <div class="pilot-capsule">
            <span class="pilot-capsule-tag">${this.isHost ? 'HOST' : 'CHALLENGER'}</span>
            <span style="color: #ffffff; font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700;">${escapeHtml(savedName)}</span>
          </div>
        </div>

        <!-- Room Code & Link Invite Box -->
        <div style="background: rgba(0, 240, 255, 0.05); border: 2px dashed var(--border-cyan); border-radius: 6px; padding: 20px 24px; text-align: center; position: relative;">
          <div style="font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-muted); letter-spacing: 0.15em;">
            ROOM ACCESS CODE
          </div>
          <div style="font-family: var(--font-display); font-size: 3.2rem; font-weight: 900; letter-spacing: 0.22em; color: var(--cyan-primary); text-shadow: 0 0 20px var(--cyan-glow); margin: 4px 0 10px 0;">
            ${this.roomCode}
          </div>

          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <button id="btn-copy-link" type="button" class="btn-cyber-secondary" style="font-size: 0.78rem; padding: 9px 18px; display: inline-flex; align-items: center; gap: 6px;">
              ${ICONS.copy(15)} COPY INVITE LINK
            </button>
          </div>

          <div id="room-challenger-status" style="margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.82rem;">
            ${
              !this.isHost
                ? `<span class="status-dot" style="background: #00ffaa; box-shadow: 0 0 10px #00ffaa;"></span>
                   <span style="color: #00ffaa; font-weight: 700;">CONNECTED TO HOST ${escapeHtml((this.opponentName || 'HOST').toUpperCase())}! WAITING FOR HOST TO START...</span>`
                : this.opponentName
                ? `<span class="status-dot" style="background: #00ffaa; box-shadow: 0 0 10px #00ffaa;"></span>
                   <span style="color: #00ffaa; font-weight: 700;">CHALLENGER ${escapeHtml(this.opponentName.toUpperCase())} ENGAGED! READY TO START.</span>`
                : `<span class="status-dot" style="background: var(--cyan-primary); animation: blink-caret 1s infinite;"></span>
                   <span>WAITING FOR CHALLENGER TO LOCK IN...</span>`
            }
          </div>
        </div>

        <!-- Match Rules & Passage Configuration (Host Only) -->
        <div class="section-group" style="padding: 16px 18px; background: rgba(5, 10, 22, 0.85); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 6px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--cyan-primary); display: flex; align-items: center;">${ICONS.settings(16)}</span>
              <span style="font-family: var(--font-display); font-size: 0.84rem; font-weight: 700; letter-spacing: 0.12em; color: var(--text-primary);">
                DUEL CONFIGURATION
              </span>
              <span style="font-family: var(--font-mono); font-size: 0.65rem; color: var(--cyan-primary); background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 2px; padding: 2px 6px;">
                ${this.isHost ? 'HOST CONTROLS' : 'HOST CONTROLLED'}
              </span>
            </div>
            <div id="room-sync-badge" style="font-family: var(--font-mono); font-size: 0.72rem; color: #00ffaa; display: flex; align-items: center; gap: 6px;">
              <span>${ICONS.check(14)}</span>
              <span>RULES APPLIED</span>
            </div>
          </div>

          <div class="config-grid-2col">
            <!-- Error Tolerance -->
            <div class="setting-row">
              ${ERROR_TOLERANCE_TOOLTIP_HTML}
              <div class="mode-toggle-group">
                <button type="button" class="mode-btn room-mode-btn ${this.selectedErrorMode === 'allow_errors' ? 'active' : ''}" data-mode="allow_errors">
                  ALLOW ERRORS
                </button>
                <button type="button" class="mode-btn room-mode-btn ${this.selectedErrorMode === 'strict_errors' ? 'active' : ''}" data-mode="strict_errors">
                  STRICT MODE
                </button>
              </div>
            </div>

            <!-- Passage Archive -->
            <div class="setting-row">
              <label class="setting-label">PASSAGE ARCHIVE</label>
              <div class="cyber-dropdown" id="dropdown-room">
                <button type="button" class="cyber-dropdown-trigger" id="dropdown-trigger-room">
                  <span id="dropdown-selected-room">${categoryLabel}</span>
                  <span class="cyber-dropdown-caret">${ICONS.chevronDown(14)}</span>
                </button>
                <div class="cyber-dropdown-menu hidden" id="dropdown-menu-room">
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'cyberpunk' ? 'active' : ''}" data-val="cyberpunk">
                    Cyberpunk & Matrix
                  </button>
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'scifi' ? 'active' : ''}" data-val="scifi">
                    Sci-Fi Classics (Dune/Asimov)
                  </button>
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'philosophy' ? 'active' : ''}" data-val="philosophy">
                    AI & Philosophy (Turing)
                  </button>
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'lyrics' ? 'active' : ''}" data-val="lyrics">
                    Lyrics Mode (24 Songs)
                  </button>
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'all' ? 'active' : ''}" data-val="all">
                    All Curated Archives
                  </button>
                  <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'custom' ? 'active' : ''}" data-val="custom">
                    Custom Passage...
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Passage Textarea -->
          <div id="room-custom-text-wrapper" class="setting-row ${this.selectedCategory === 'custom' ? '' : 'hidden'}" style="margin-top: 4px;">
            <label class="setting-label">CUSTOM DUEL PASSAGE</label>
            <textarea id="input-room-custom-text" class="input-cyber" rows="2" placeholder="Type or paste custom duel passage...">${this.customText || ''}</textarea>
          </div>

          <!-- Lyrics Selector Container -->
          <div id="room-lyrics-selector-wrapper" class="${this.selectedCategory === 'lyrics' ? '' : 'hidden'}" style="margin-top: 4px;"></div>
        </div>

        <!-- Footer Actions -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 16px; flex-wrap: wrap;">
          <button id="btn-cancel-room" type="button" class="btn-cyber-danger" style="padding: 11px 22px; font-size: 0.85rem;">
            ${this.isHost ? 'CANCEL DUEL' : 'LEAVE DUEL'}
          </button>
          ${
            this.isHost
              ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                   <button id="btn-start-duel" type="button" class="btn-cyber-primary ${this.opponentName ? 'glow-pulse' : ''}" ${this.opponentName ? '' : 'disabled'} style="padding: 12px 34px; font-size: 0.95rem; font-weight: 800; letter-spacing: 0.12em; display: inline-flex; align-items: center; gap: 8px;">
                     ${ICONS.play(16)} START DUEL
                   </button>
                   <span id="start-duel-hint" style="font-family: var(--font-mono); font-size: 0.72rem; color: ${this.opponentName ? '#00ffaa' : 'var(--text-muted)'};">
                     ${this.opponentName ? 'Challenger ready! Click Start Duel when ready.' : 'Waiting for challenger to connect...'}
                   </span>
                 </div>`
              : `<div style="display: inline-flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 0.82rem; color: var(--cyan-primary); background: rgba(0, 240, 255, 0.08); border: 1px solid var(--border-cyan); border-radius: 4px; padding: 10px 20px;">
                   <span class="status-dot" style="background: var(--cyan-primary); animation: blink-caret 1s infinite;"></span>
                   <span>AWAITING HOST TO START DUEL...</span>
                 </div>`
          }
        </div>
      </div>
    `;

    this.setupListeners(fullUrl);
  }

  public setOpponentJoined(opponentName: string): void {
    this.opponentName = opponentName;
    soundEngine.playUiClick();
    const statusEl = this.container.querySelector('#room-challenger-status');
    if (statusEl) {
      statusEl.innerHTML = `
        <span class="status-dot" style="background: #00ffaa; box-shadow: 0 0 10px #00ffaa;"></span>
        <span style="color: #00ffaa; font-weight: 700;">CHALLENGER ${escapeHtml(opponentName.toUpperCase())} ENGAGED! READY TO START.</span>
      `;
    }
    const startBtn = this.container.querySelector('#btn-start-duel') as HTMLButtonElement | null;
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.classList.add('glow-pulse');
    }
    const hint = this.container.querySelector('#start-duel-hint');
    if (hint) {
      hint.textContent = 'Challenger ready! Click Start Duel when ready.';
      hint.setAttribute('style', 'font-family: var(--font-mono); font-size: 0.72rem; color: #00ffaa;');
    }
  }

  public setOpponentLeft(): void {
    this.opponentName = null;
    const statusEl = this.container.querySelector('#room-challenger-status');
    if (statusEl) {
      statusEl.innerHTML = `
        <span class="status-dot" style="background: var(--cyan-primary); animation: blink-caret 1s infinite;"></span>
        <span>WAITING FOR CHALLENGER TO LOCK IN...</span>
      `;
    }
    const startBtn = this.container.querySelector('#btn-start-duel') as HTMLButtonElement | null;
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.classList.remove('glow-pulse');
    }
    const hint = this.container.querySelector('#start-duel-hint');
    if (hint) {
      hint.textContent = 'Waiting for challenger to connect...';
      hint.setAttribute('style', 'font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);');
    }
  }

  private setupListeners(fullUrl: string): void {
    // Copy invite link
    const copyBtn = this.container.querySelector('#btn-copy-link');
    copyBtn?.addEventListener('click', () => {
      soundEngine.playUiClick();
      navigator.clipboard.writeText(fullUrl);
      if (copyBtn) copyBtn.innerHTML = `${ICONS.check(15)} LINK COPIED!`;
      setTimeout(() => {
        if (copyBtn) copyBtn.innerHTML = `${ICONS.copy(15)} COPY INVITE LINK`;
      }, 2000);
    });

    // Start duel button (Host only)
    const startBtn = this.container.querySelector('#btn-start-duel') as HTMLButtonElement | null;
    startBtn?.addEventListener('click', () => {
      soundEngine.playUiClick();
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = `${ICONS.zap(16)} LAUNCHING...`;
      }
      this.onStartDuel?.();
    });

    if (!this.isHost) {
      const modeGroup = this.container.querySelector('.mode-toggle-group') as HTMLElement;
      if (modeGroup) modeGroup.style.pointerEvents = 'none';
      const dropdownTrigger = this.container.querySelector('#dropdown-trigger-room') as HTMLElement;
      if (dropdownTrigger) dropdownTrigger.style.pointerEvents = 'none';
      const customTextarea = this.container.querySelector('#input-room-custom-text') as HTMLTextAreaElement;
      if (customTextarea) customTextarea.readOnly = true;
    }

    // Cancel / Leave room
    const cancelBtn = this.container.querySelector('#btn-cancel-room');
    cancelBtn?.addEventListener('click', () => {
      soundEngine.playUiClick();
      musicPlayer.stopPreview();
      this.onCancelRoom?.();
    });

    // Error mode toggle
    const errorBtns = this.container.querySelectorAll('.room-mode-btn');
    errorBtns.forEach((btn) => {
      const selectMode = (e: Event) => {
        e.preventDefault();
        soundEngine.playUiClick();
        errorBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedErrorMode = (btn.getAttribute('data-mode') || 'allow_errors') as ErrorMode;
        this.notifySettingsChanged();
      };
      btn.addEventListener('pointerdown', selectMode);
      btn.addEventListener('click', (e) => e.preventDefault());
    });

    // Lyrics selector setup
    const lyricsWrap = this.container.querySelector('#room-lyrics-selector-wrapper') as HTMLElement;
    this.lyricsSelector = new LyricsSelectorView(lyricsWrap);
    this.lyricsSelector.onSongSelected = (song) => {
      this.selectedSong = song;
      this.notifySettingsChanged();
    };

    if (this.selectedCategory === 'lyrics') {
      this.lyricsSelector.render();
      this.selectedSong = this.lyricsSelector.getSelectedSong();
    }

    // Dropdown handling
    const trigger = this.container.querySelector('#dropdown-trigger-room') as HTMLButtonElement;
    const menu = this.container.querySelector('#dropdown-menu-room') as HTMLElement;
    const selectedLabel = this.container.querySelector('#dropdown-selected-room') as HTMLElement;
    const customWrap = this.container.querySelector('#room-custom-text-wrapper') as HTMLElement;

    if (trigger && menu) {
      trigger.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        soundEngine.playUiClick();
        const isOpen = !menu.classList.contains('hidden');
        menu.classList.toggle('hidden', isOpen);
        trigger.classList.toggle('open', !isOpen);
      });
      trigger.addEventListener('click', (e) => e.preventDefault());

      menu.querySelectorAll('.cyber-dropdown-item').forEach((item) => {
        const selectItem = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          soundEngine.playUiClick();
          const val = item.getAttribute('data-val') || 'cyberpunk';
          this.selectedCategory = val;

          menu.querySelectorAll('.cyber-dropdown-item').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');

          if (selectedLabel) {
            selectedLabel.textContent = CATEGORY_LABELS[val] || val;
          }

          if (val === 'custom') {
            customWrap.classList.remove('hidden');
            lyricsWrap.classList.add('hidden');
          } else if (val === 'lyrics') {
            customWrap.classList.add('hidden');
            lyricsWrap.classList.remove('hidden');
            this.lyricsSelector?.render();
            this.selectedSong = this.lyricsSelector?.getSelectedSong() || null;
          } else {
            customWrap.classList.add('hidden');
            lyricsWrap.classList.add('hidden');
          }

          menu.classList.add('hidden');
          trigger.classList.remove('open');
          this.notifySettingsChanged();
        };

        item.addEventListener('pointerdown', selectItem);
        item.addEventListener('click', (e) => e.preventDefault());
      });
    }

    // Custom text input
    const customInput = this.container.querySelector('#input-room-custom-text') as HTMLTextAreaElement;
    customInput?.addEventListener('input', () => {
      this.customText = customInput.value.trim() || null;
      if (this.textDebounceTimer) {
        clearTimeout(this.textDebounceTimer);
      }
      this.textDebounceTimer = window.setTimeout(() => {
        this.notifySettingsChanged();
      }, 350);
    });

    // Close dropdown on outside click
    if (!this.docListenerBound) {
      this.docListenerBound = true;
      document.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('#dropdown-room')) {
          menu?.classList.add('hidden');
          trigger?.classList.remove('open');
        }
      });
    }
  }

  private notifySettingsChanged(): void {
    let custom = this.selectedCategory === 'custom' ? this.customText : null;
    let activeSong = this.selectedCategory === 'lyrics' ? this.selectedSong : null;
    if (this.selectedCategory === 'lyrics' && activeSong) {
      custom = activeSong.lyrics;
    }

    this.onUpdateSettings?.({
      errorMode: this.selectedErrorMode,
      category: this.selectedCategory,
      customText: custom,
      selectedSong: activeSong,
    });

    this.flashSyncBadge();
  }

  private flashSyncBadge(): void {
    const badge = this.container.querySelector('#room-sync-badge') as HTMLElement;
    if (badge) {
      badge.style.transform = 'scale(1.1)';
      badge.style.color = '#00f0ff';
      badge.innerHTML = `<span>${ICONS.check(14)}</span> <span>SYNCED</span>`;
      setTimeout(() => {
        badge.style.transform = 'scale(1)';
        badge.style.color = '#00ffaa';
        badge.innerHTML = `<span>${ICONS.check(14)}</span> <span>RULES APPLIED</span>`;
      }, 600);
    }
  }
}
