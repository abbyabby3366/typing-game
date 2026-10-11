import { ErrorMode } from '../game/typingEngine';
import { soundEngine } from '../audio/soundEngine';
import { SongTrack } from '../game/songCatalog';
import { LyricsSelectorView } from './lyricsSelectorView';

export interface LobbyConfig {
  playerName: string;
  errorMode: ErrorMode;
  category: string;
  customText: string | null;
  selectedSong?: SongTrack | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  cyberpunk: '⚡ Cyberpunk & Matrix',
  scifi: '🪐 Sci-Fi Classics (Dune/Asimov)',
  philosophy: '🧠 AI & Philosophy (Turing)',
  lyrics: '🎵 Lyrics Mode (24 Songs)',
  all: '🌐 All Curated Archives',
  custom: '✍️ Custom Passage...',
};

export class LobbyView {
  private container: HTMLElement;
  public onCreateRoom?: (config: LobbyConfig) => void;
  public onJoinRoom?: (roomCode: string, playerName: string) => void;
  public onStartBot?: (
    playerName: string,
    difficulty: string,
    errorMode: ErrorMode,
    category: string,
    customText: string | null,
    selectedSong?: SongTrack | null
  ) => void;

  private activeTab: 'solo' | 'multiplayer' = 'solo';
  private selectedErrorMode: ErrorMode = 'allow_errors';
  private selectedCategory: string = 'cyberpunk';
  private selectedBotDiff: string = 'medium';
  private docListenerBound: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(initialRoomCode: string = ''): void {
    const savedName = localStorage.getItem('cyber_pilot_name') || `PILOT-${Math.floor(100 + Math.random() * 900)}`;

    if (initialRoomCode) {
      this.activeTab = 'multiplayer';
    }

    const categoryLabel = CATEGORY_LABELS[this.selectedCategory] || '⚡ Cyberpunk & Matrix';

    this.container.innerHTML = `
      <div class="lobby-card">
        <!-- GROUP 1: HEADER & PILOT IDENTITY -->
        <div class="lobby-header-row">
          <div class="lobby-title-group">
            <h2 class="brand-title" style="font-size: 1.8rem; margin: 0;">BATTLE <span class="text-cyan">LOBBY</span></h2>
            <p class="lobby-subtitle">High-velocity 3D push-and-pull typing combat arena</p>
          </div>
          <div class="pilot-capsule" title="Click to edit call-sign">
            <span class="pilot-capsule-tag">PILOT</span>
            <input id="input-pilot-name" type="text" class="pilot-capsule-input" value="${savedName}" maxlength="16" placeholder="CALL-SIGN" />
          </div>
        </div>

        <!-- GROUP 2: PRIMARY GAME MODE SELECTOR -->
        <div class="mode-segmented-control">
          <button id="tab-btn-solo" type="button" class="segment-btn ${this.activeTab === 'solo' ? 'active' : ''}">
            <span class="btn-icon">🤖</span>
            <div class="btn-text-group">
              <span class="btn-title">1-PLAYER MODE</span>
              <span class="btn-desc">Solo Battle vs AI Drone</span>
            </div>
          </button>
          <button id="tab-btn-multiplayer" type="button" class="segment-btn ${this.activeTab === 'multiplayer' ? 'active' : ''}">
            <span class="btn-icon">🌐</span>
            <div class="btn-text-group">
              <span class="btn-title">2-PLAYER DUEL</span>
              <span class="btn-desc">Online Room Challenge</span>
            </div>
          </button>
        </div>

        <!-- GROUP 3A: 1-PLAYER SOLO MODE CONFIGURATION -->
        <div id="panel-solo-mode" class="tab-panel ${this.activeTab === 'solo' ? '' : 'hidden'}" style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Section 01: AI Challenger -->
          <div class="section-group">
            <div class="section-header">
              <span class="section-number">01</span>
              <span class="section-title">SELECT AI OPPONENT</span>
            </div>
            <div class="bot-difficulty-grid">
              <button type="button" class="bot-diff-card ${this.selectedBotDiff === 'easy' ? 'active' : ''}" data-diff="easy">
                <span class="diff-badge badge-easy">EASY</span>
                <span class="diff-name">DRONE-ALPHA</span>
                <span class="diff-speed">~38 WPM</span>
              </button>
              <button type="button" class="bot-diff-card ${this.selectedBotDiff === 'medium' ? 'active' : ''}" data-diff="medium">
                <span class="diff-badge badge-medium">NORMAL</span>
                <span class="diff-name">NEXUS-V2</span>
                <span class="diff-speed">~68 WPM</span>
              </button>
              <button type="button" class="bot-diff-card ${this.selectedBotDiff === 'hard' ? 'active' : ''}" data-diff="hard">
                <span class="diff-badge badge-hard">EXPERT</span>
                <span class="diff-name">CYBER-VIPER</span>
                <span class="diff-speed">~98 WPM</span>
              </button>
              <button type="button" class="bot-diff-card ${this.selectedBotDiff === 'cybergod' ? 'active' : ''}" data-diff="cybergod">
                <span class="diff-badge badge-god">CYBERGOD</span>
                <span class="diff-name">QUANTUM-CORE</span>
                <span class="diff-speed">~135 WPM</span>
              </button>
            </div>
          </div>

          <!-- Section 02: Match Rules & Archive -->
          <div class="section-group">
            <div class="section-header">
              <span class="section-number">02</span>
              <span class="section-title">MATCH PROTOCOL & ARCHIVE</span>
            </div>
            <div class="config-grid-2col">
              <!-- Error Tolerance Toggle -->
              <div class="setting-row">
                <label class="setting-label">ERROR TOLERANCE</label>
                <div class="mode-toggle-group">
                  <button type="button" class="mode-btn solo-mode-btn ${this.selectedErrorMode === 'allow_errors' ? 'active' : ''}" data-mode="allow_errors">
                    ALLOW ERRORS
                  </button>
                  <button type="button" class="mode-btn solo-mode-btn ${this.selectedErrorMode === 'strict_errors' ? 'active' : ''}" data-mode="strict_errors">
                    STRICT MODE
                  </button>
                </div>
              </div>

              <!-- Fast Custom Dropdown (0ms Latency) -->
              <div class="setting-row">
                <label class="setting-label">PASSAGE ARCHIVE</label>
                <div class="cyber-dropdown" id="dropdown-solo">
                  <button type="button" class="cyber-dropdown-trigger" id="dropdown-trigger-solo">
                    <span id="dropdown-selected-solo">${categoryLabel}</span>
                    <span class="cyber-dropdown-caret">▼</span>
                  </button>
                  <div class="cyber-dropdown-menu hidden" id="dropdown-menu-solo">
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'cyberpunk' ? 'active' : ''}" data-val="cyberpunk">
                      <span>⚡</span> Cyberpunk & Matrix
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'scifi' ? 'active' : ''}" data-val="scifi">
                      <span>🪐</span> Sci-Fi Classics (Dune/Asimov)
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'philosophy' ? 'active' : ''}" data-val="philosophy">
                      <span>🧠</span> AI & Philosophy (Turing)
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'lyrics' ? 'active' : ''}" data-val="lyrics">
                      <span>🎵</span> Lyrics Mode (24 Songs)
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'all' ? 'active' : ''}" data-val="all">
                      <span>🌐</span> All Curated Archives
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'custom' ? 'active' : ''}" data-val="custom">
                      <span>✍️</span> Custom Passage...
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div id="solo-custom-text-wrapper" class="setting-row ${this.selectedCategory === 'custom' ? '' : 'hidden'}" style="margin-top: 4px;">
              <label class="setting-label">CUSTOM DUEL PASSAGE</label>
              <textarea id="input-solo-custom-text" class="input-cyber" rows="2" placeholder="Type or paste custom duel passage..."></textarea>
            </div>

            <div id="solo-lyrics-selector-wrapper" class="${this.selectedCategory === 'lyrics' ? '' : 'hidden'}" style="margin-top: 4px;"></div>
          </div>

          <button id="btn-start-solo-match" type="button" class="btn-cyber-primary btn-launch">
            ⚡ ENGAGE 1-PLAYER BATTLE
          </button>
        </div>

        <!-- GROUP 3B: 2-PLAYER MULTIPLAYER DUEL -->
        <div id="panel-multiplayer-mode" class="tab-panel ${this.activeTab === 'multiplayer' ? '' : 'hidden'}">
          <div class="lobby-grid">
            <!-- Subpanel 1: Create Room -->
            <div class="lobby-panel">
              <div class="panel-title">
                <span>⚡</span> HOST PRIVATE ROOM
              </div>

              <div class="setting-row">
                <label class="setting-label">ERROR TOLERANCE</label>
                <div class="mode-toggle-group">
                  <button type="button" class="mode-btn multi-mode-btn ${this.selectedErrorMode === 'allow_errors' ? 'active' : ''}" data-mode="allow_errors">
                    ALLOW
                  </button>
                  <button type="button" class="mode-btn multi-mode-btn ${this.selectedErrorMode === 'strict_errors' ? 'active' : ''}" data-mode="strict_errors">
                    STRICT
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <label class="setting-label">PASSAGE ARCHIVE</label>
                <div class="cyber-dropdown" id="dropdown-multi">
                  <button type="button" class="cyber-dropdown-trigger" id="dropdown-trigger-multi">
                    <span id="dropdown-selected-multi">${categoryLabel}</span>
                    <span class="cyber-dropdown-caret">▼</span>
                  </button>
                  <div class="cyber-dropdown-menu hidden" id="dropdown-menu-multi">
                    <button type="button" class="cyber-dropdown-item active" data-val="cyberpunk">
                      <span>⚡</span> Cyberpunk & Matrix
                    </button>
                    <button type="button" class="cyber-dropdown-item" data-val="scifi">
                      <span>🪐</span> Sci-Fi Classics
                    </button>
                    <button type="button" class="cyber-dropdown-item" data-val="philosophy">
                      <span>🧠</span> AI & Philosophy
                    </button>
                    <button type="button" class="cyber-dropdown-item ${this.selectedCategory === 'lyrics' ? 'active' : ''}" data-val="lyrics">
                      <span>🎵</span> Lyrics Mode (24 Songs)
                    </button>
                    <button type="button" class="cyber-dropdown-item" data-val="all">
                      <span>🌐</span> All Archives
                    </button>
                    <button type="button" class="cyber-dropdown-item" data-val="custom">
                      <span>✍️</span> Custom Passage...
                    </button>
                  </div>
                </div>
              </div>

              <div id="multi-custom-text-wrapper" class="setting-row ${this.selectedCategory === 'custom' ? '' : 'hidden'}">
                <label class="setting-label">CUSTOM TEXT</label>
                <textarea id="input-multi-custom-text" class="input-cyber" rows="2" placeholder="Paste custom passage..."></textarea>
              </div>

              <div id="multi-lyrics-selector-wrapper" class="${this.selectedCategory === 'lyrics' ? '' : 'hidden'}" style="margin-top: 4px;"></div>

              <button id="btn-create-room" type="button" class="btn-cyber-primary" style="margin-top: 4px;">
                CREATE ROOM
              </button>
            </div>

            <!-- Subpanel 2: Join Room -->
            <div class="lobby-panel">
              <div class="panel-title">
                <span>🔗</span> JOIN BY ROOM CODE
              </div>

              <div class="setting-row">
                <label class="setting-label">ROOM ACCESS CODE</label>
                <input id="input-join-code" type="text" class="input-cyber" value="${initialRoomCode}" placeholder="E.G. 7K9QM" maxlength="8" style="text-transform: uppercase; font-weight: bold; letter-spacing: 0.15em;" />
              </div>

              <button id="btn-join-room" type="button" class="btn-cyber-secondary" style="margin-top: 4px;">
                JOIN ROOM
              </button>

              <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-muted); margin-top: 12px; line-height: 1.5;">
                Or open a direct challenge link sent by your rival (e.g. <code>?room=CODE</code>).
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const nameInput = this.container.querySelector('#input-pilot-name') as HTMLInputElement;

    // Save name on edit with light debounce to prevent synchronous storage I/O stalls
    let nameSaveTimer: number | null = null;
    nameInput?.addEventListener('input', () => {
      if (nameSaveTimer !== null) clearTimeout(nameSaveTimer);
      nameSaveTimer = window.setTimeout(() => {
        localStorage.setItem('cyber_pilot_name', nameInput.value.trim());
        nameSaveTimer = null;
      }, 250);
    });
    nameInput?.addEventListener('change', () => {
      localStorage.setItem('cyber_pilot_name', nameInput.value.trim());
    });

    // Mode tab switcher (Instant 0ms response on pointerdown)
    const tabSolo = this.container.querySelector('#tab-btn-solo');
    const tabMulti = this.container.querySelector('#tab-btn-multiplayer');
    const panelSolo = this.container.querySelector('#panel-solo-mode') as HTMLElement;
    const panelMulti = this.container.querySelector('#panel-multiplayer-mode') as HTMLElement;

    const switchTab = (tab: 'solo' | 'multiplayer') => {
      if (this.activeTab === tab) return;
      soundEngine.playUiClick();
      this.activeTab = tab;
      if (tab === 'solo') {
        tabSolo?.classList.add('active');
        tabMulti?.classList.remove('active');
        panelSolo?.classList.remove('hidden');
        panelMulti?.classList.add('hidden');
      } else {
        tabMulti?.classList.add('active');
        tabSolo?.classList.remove('active');
        panelMulti?.classList.remove('hidden');
        panelSolo?.classList.add('hidden');
      }
    };

    tabSolo?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchTab('solo');
    });
    tabSolo?.addEventListener('click', (e) => e.preventDefault());

    tabMulti?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchTab('multiplayer');
    });
    tabMulti?.addEventListener('click', (e) => e.preventDefault());

    // Bot difficulty cards (Instant 0ms pointerdown)
    const diffCards = this.container.querySelectorAll('.bot-diff-card');
    diffCards.forEach((card) => {
      const selectDiff = (e: Event) => {
        e.preventDefault();
        soundEngine.playUiClick();
        diffCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedBotDiff = card.getAttribute('data-diff') || 'medium';
      };
      card.addEventListener('pointerdown', selectDiff);
      card.addEventListener('click', (e) => e.preventDefault());
    });

    // Error mode toggle buttons (Instant 0ms tactile response)
    const setupErrorToggles = (selector: string) => {
      const btns = this.container.querySelectorAll(selector);
      btns.forEach((btn) => {
        const selectMode = (e: Event) => {
          e.preventDefault();
          soundEngine.playUiClick();
          btns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedErrorMode = (btn.getAttribute('data-mode') || 'allow_errors') as ErrorMode;
        };
        btn.addEventListener('pointerdown', selectMode);
        btn.addEventListener('click', (e) => e.preventDefault());
      });
    };
    setupErrorToggles('.solo-mode-btn');
    setupErrorToggles('.multi-mode-btn');

    // Initialize Lyrics Selector Views
    const soloLyricsWrap = this.container.querySelector('#solo-lyrics-selector-wrapper') as HTMLElement;
    const multiLyricsWrap = this.container.querySelector('#multi-lyrics-selector-wrapper') as HTMLElement;

    const soloLyricsSelector = new LyricsSelectorView(soloLyricsWrap);
    const multiLyricsSelector = new LyricsSelectorView(multiLyricsWrap);

    if (this.selectedCategory === 'lyrics') {
      if (this.activeTab === 'solo') {
        soloLyricsSelector.render();
      } else {
        multiLyricsSelector.render();
      }
    }

    // Fast Custom Cyber Dropdown (0ms Latency on pointerdown)
    const setupCustomDropdown = (
      triggerId: string,
      menuId: string,
      selectedLabelId: string,
      customWrapId: string,
      lyricsWrapId: string,
      lyricsSelector: LyricsSelectorView
    ) => {
      const trigger = this.container.querySelector(triggerId) as HTMLButtonElement;
      const menu = this.container.querySelector(menuId) as HTMLElement;
      const selectedLabel = this.container.querySelector(selectedLabelId) as HTMLElement;
      const customWrap = this.container.querySelector(customWrapId) as HTMLElement;
      const lyricsWrap = this.container.querySelector(lyricsWrapId) as HTMLElement;

      if (!trigger || !menu) return;

      trigger.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        soundEngine.playUiClick();
        const isOpen = !menu.classList.contains('hidden');
        document.querySelectorAll('.cyber-dropdown-menu').forEach((m) => m.classList.add('hidden'));
        document.querySelectorAll('.cyber-dropdown-trigger').forEach((t) => t.classList.remove('open'));

        if (!isOpen) {
          menu.classList.remove('hidden');
          trigger.classList.add('open');
          const activeItem = menu.querySelector('.cyber-dropdown-item.active') as HTMLElement;
          if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
          }
        }
      });
      trigger.addEventListener('click', (e) => e.preventDefault());

      menu.querySelectorAll('.cyber-dropdown-item').forEach((item) => {
        const selectItem = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          soundEngine.playUiClick();
          const val = item.getAttribute('data-val') || 'cyberpunk';
          this.selectedCategory = val;

          // Update active item
          menu.querySelectorAll('.cyber-dropdown-item').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');

          // Update trigger display
          if (selectedLabel) {
            selectedLabel.textContent = CATEGORY_LABELS[val] || val;
          }

          // Toggle custom text wrapper & lyrics wrapper
          if (val === 'custom') {
            customWrap.classList.remove('hidden');
            lyricsWrap.classList.add('hidden');
          } else if (val === 'lyrics') {
            customWrap.classList.add('hidden');
            lyricsWrap.classList.remove('hidden');
            lyricsSelector.render();
          } else {
            customWrap.classList.add('hidden');
            lyricsWrap.classList.add('hidden');
          }

          // Close menu
          menu.classList.add('hidden');
          trigger.classList.remove('open');
        };

        item.addEventListener('pointerdown', selectItem);
        item.addEventListener('click', (e) => e.preventDefault());
      });
    };

    setupCustomDropdown(
      '#dropdown-trigger-solo',
      '#dropdown-menu-solo',
      '#dropdown-selected-solo',
      '#solo-custom-text-wrapper',
      '#solo-lyrics-selector-wrapper',
      soloLyricsSelector
    );
    setupCustomDropdown(
      '#dropdown-trigger-multi',
      '#dropdown-menu-multi',
      '#dropdown-selected-multi',
      '#multi-custom-text-wrapper',
      '#multi-lyrics-selector-wrapper',
      multiLyricsSelector
    );

    // Global listener to close dropdowns when clicking outside (bound once)
    if (!this.docListenerBound) {
      this.docListenerBound = true;
      document.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.cyber-dropdown')) {
          document.querySelectorAll('.cyber-dropdown-menu').forEach((m) => m.classList.add('hidden'));
          document.querySelectorAll('.cyber-dropdown-trigger').forEach((t) => t.classList.remove('open'));
        }
      });
    }

    // Start 1-Player Solo Match button
    const soloBtn = this.container.querySelector('#btn-start-solo-match');
    const soloCustomText = this.container.querySelector('#input-solo-custom-text') as HTMLTextAreaElement;
    soloBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      localStorage.setItem('cyber_pilot_name', pilotName);
      let custom = this.selectedCategory === 'custom' ? soloCustomText.value.trim() || null : null;
      let activeSong: SongTrack | null = null;
      if (this.selectedCategory === 'lyrics') {
        activeSong = soloLyricsSelector.getSelectedSong();
        custom = activeSong ? activeSong.lyrics : null;
      }
      this.onStartBot?.(pilotName, this.selectedBotDiff, this.selectedErrorMode, this.selectedCategory, custom, activeSong);
    });

    // Create Multiplayer room
    const createBtn = this.container.querySelector('#btn-create-room');
    const multiCustomText = this.container.querySelector('#input-multi-custom-text') as HTMLTextAreaElement;
    createBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      localStorage.setItem('cyber_pilot_name', pilotName);
      let custom = this.selectedCategory === 'custom' ? multiCustomText.value.trim() || null : null;
      let activeSong: SongTrack | null = null;
      if (this.selectedCategory === 'lyrics') {
        activeSong = multiLyricsSelector.getSelectedSong();
        custom = activeSong ? activeSong.lyrics : null;
      }
      this.onCreateRoom?.({
        playerName: pilotName,
        errorMode: this.selectedErrorMode,
        category: this.selectedCategory,
        customText: custom,
        selectedSong: activeSong,
      });
    });

    // Join Multiplayer room
    const joinBtn = this.container.querySelector('#btn-join-room');
    const joinInput = this.container.querySelector('#input-join-code') as HTMLInputElement;
    joinBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      const code = joinInput.value.trim().toUpperCase();
      if (!code) {
        joinInput.focus();
        return;
      }
      localStorage.setItem('cyber_pilot_name', pilotName);
      this.onJoinRoom?.(code, pilotName);
    });
  }
}
