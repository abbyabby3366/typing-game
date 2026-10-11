import { ErrorMode } from '../game/typingEngine';
import { soundEngine } from '../audio/soundEngine';
import { SongTrack } from '../game/songCatalog';
import { LyricsSelectorView } from './lyricsSelectorView';
import {
  CATEGORY_LABELS,
  renderSoloPanel,
  renderZenPanel,
  renderMultiPanel,
} from './lobbyPanels';
import { ICONS } from './icons';

export interface LobbyConfig {
  playerName: string;
  errorMode: ErrorMode;
  category: string;
  customText: string | null;
  selectedSong?: SongTrack | null;
}

export class LobbyView {
  private container: HTMLElement;
  public onCreateRoom?: (config: LobbyConfig) => void;
  public onJoinRoom?: (roomCode: string, playerName: string) => void;
  public onStartBot?: (
    playerName: string,
    difficulty: string,
    customWpm: number,
    errorMode: ErrorMode,
    category: string,
    customText: string | null,
    selectedSong?: SongTrack | null
  ) => void;
  public onStartZen?: (
    playerName: string,
    errorMode: ErrorMode,
    category: string,
    customText: string | null,
    selectedSong?: SongTrack | null
  ) => void;

  private activeTab: 'solo' | 'zen' | 'multiplayer' = 'solo';
  private selectedErrorMode: ErrorMode = 'allow_errors';
  private selectedCategory: string = 'cyberpunk';
  private selectedBotDiff: string = 'medium';
  private customBotWpm: number = 75;
  private docListenerBound: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public render(initialRoomCode: string = ''): void {
    let savedName = localStorage.getItem('cyber_pilot_name');
    if (!savedName || savedName.startsWith('PILOT-')) {
      savedName = `PLAYER-${Math.floor(100 + Math.random() * 900)}`;
      localStorage.setItem('cyber_pilot_name', savedName);
    }

    const savedCustomWpm = parseInt(localStorage.getItem('cyber_custom_bot_wpm') || '75', 10);
    this.customBotWpm = isNaN(savedCustomWpm) ? 75 : Math.max(15, Math.min(250, savedCustomWpm));

    if (initialRoomCode) {
      this.activeTab = 'multiplayer';
    }

    const categoryLabel =
      CATEGORY_LABELS[this.selectedCategory] || 'Cyberpunk & Matrix';

    this.container.innerHTML = `
      <div class="lobby-card">
        <!-- GROUP 1: HEADER & PILOT IDENTITY -->
        <div class="lobby-header-row">
          <div class="lobby-title-group">
            <h2 class="brand-title" style="font-size: 1.8rem; margin: 0;">BATTLE <span class="text-cyan">LOBBY</span></h2>
          </div>
          <div class="pilot-capsule" title="Click to edit name">
            <span class="pilot-capsule-tag">NAME</span>
            <input id="input-pilot-name" type="text" class="pilot-capsule-input" value="${savedName}" maxlength="16" placeholder="NAME" />
          </div>
        </div>

        <!-- GROUP 2: PRIMARY GAME MODE SELECTOR -->
        <div class="mode-segmented-control">
          <button id="tab-btn-solo" type="button" class="segment-btn ${this.activeTab === 'solo' ? 'active' : ''}">
            <span class="btn-icon">${ICONS.bot(22)}</span>
            <div class="btn-text-group">
              <span class="btn-title">1-PLAYER BATTLE</span>
              <span class="btn-desc">Solo Battle vs AI Drone</span>
            </div>
          </button>
          <button id="tab-btn-zen" type="button" class="segment-btn ${this.activeTab === 'zen' ? 'active' : ''}">
            <span class="btn-icon">${ICONS.zen(22)}</span>
            <div class="btn-text-group">
              <span class="btn-title">ZEN MODE</span>
              <span class="btn-desc">Pure Practice, No Duel</span>
            </div>
          </button>
          <button id="tab-btn-multiplayer" type="button" class="segment-btn ${this.activeTab === 'multiplayer' ? 'active' : ''}">
            <span class="btn-icon">${ICONS.globe(22)}</span>
            <div class="btn-text-group">
              <span class="btn-title">2-PLAYER DUEL</span>
              <span class="btn-desc">Online Room Challenge</span>
            </div>
          </button>
        </div>

        <!-- GROUP 3: MODE PANELS -->
        ${renderSoloPanel(
          this.selectedBotDiff,
          this.customBotWpm,
          this.selectedErrorMode,
          this.selectedCategory,
          categoryLabel,
          this.activeTab === 'solo'
        )}
        ${renderZenPanel(
          this.selectedErrorMode,
          this.selectedCategory,
          categoryLabel,
          this.activeTab === 'zen'
        )}
        ${renderMultiPanel(this.activeTab === 'multiplayer', initialRoomCode)}
      </div>
    `;

    this.setupListeners();
  }

  private setupListeners(): void {
    const nameInput = this.container.querySelector('#input-pilot-name') as HTMLInputElement;

    // Segmented Mode Switching
    const tabSolo = this.container.querySelector('#tab-btn-solo');
    const tabZen = this.container.querySelector('#tab-btn-zen');
    const tabMulti = this.container.querySelector('#tab-btn-multiplayer');

    const panelSolo = this.container.querySelector('#panel-solo-mode');
    const panelZen = this.container.querySelector('#panel-zen-mode');
    const panelMulti = this.container.querySelector('#panel-multiplayer-mode');

    const switchTab = (tab: 'solo' | 'zen' | 'multiplayer') => {
      this.activeTab = tab;
      soundEngine.playUiClick();

      tabSolo?.classList.toggle('active', tab === 'solo');
      tabZen?.classList.toggle('active', tab === 'zen');
      tabMulti?.classList.toggle('active', tab === 'multiplayer');

      panelSolo?.classList.toggle('hidden', tab !== 'solo');
      panelZen?.classList.toggle('hidden', tab !== 'zen');
      panelMulti?.classList.toggle('hidden', tab !== 'multiplayer');

      // Re-render lyrics selector for newly active tab if lyrics selected
      if (this.selectedCategory === 'lyrics') {
        if (tab === 'solo') soloLyricsSelector.render();
        else if (tab === 'zen') zenLyricsSelector.render();
      }
    };

    tabSolo?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchTab('solo');
    });
    tabSolo?.addEventListener('click', (e) => e.preventDefault());

    tabZen?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchTab('zen');
    });
    tabZen?.addEventListener('click', (e) => e.preventDefault());

    tabMulti?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchTab('multiplayer');
    });
    tabMulti?.addEventListener('click', (e) => e.preventDefault());

    // Bot difficulty cards
    const diffCards = this.container.querySelectorAll('.bot-diff-card');
    diffCards.forEach((card) => {
      const selectDiff = (e: Event) => {
        e.preventDefault();
        soundEngine.playUiClick();
        diffCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const diff = card.getAttribute('data-diff') || 'medium';
        this.selectedBotDiff = diff;
        const customWrap = this.container.querySelector('#bot-custom-wpm-wrapper');
        customWrap?.classList.toggle('hidden', diff !== 'custom');
      };
      card.addEventListener('pointerdown', selectDiff);
      card.addEventListener('click', (e) => e.preventDefault());
    });

    // Error mode toggle buttons
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
    setupErrorToggles('.zen-mode-btn');
    setupErrorToggles('.multi-mode-btn');

    // Custom Bot Speed Slider & Input sync
    const botWpmInput = this.container.querySelector('#input-custom-bot-wpm') as HTMLInputElement;
    const botWpmSlider = this.container.querySelector('#slider-custom-bot-wpm') as HTMLInputElement;
    const botWpmCardLabel = this.container.querySelector('#card-custom-wpm-label');

    const updateBotWpm = (val: number) => {
      const clamped = Math.max(15, Math.min(250, Math.round(val)));
      this.customBotWpm = clamped;
      localStorage.setItem('cyber_custom_bot_wpm', String(clamped));
      if (botWpmInput && parseInt(botWpmInput.value, 10) !== clamped) botWpmInput.value = String(clamped);
      if (botWpmSlider && parseInt(botWpmSlider.value, 10) !== clamped) botWpmSlider.value = String(clamped);
      if (botWpmCardLabel) botWpmCardLabel.textContent = `~${clamped} WPM`;
    };

    botWpmInput?.addEventListener('input', () => {
      const parsed = parseInt(botWpmInput.value, 10);
      if (!isNaN(parsed)) updateBotWpm(parsed);
    });

    botWpmSlider?.addEventListener('input', () => {
      const parsed = parseInt(botWpmSlider.value, 10);
      if (!isNaN(parsed)) updateBotWpm(parsed);
    });

    // Initialize Lyrics Selector Views
    const soloLyricsWrap = this.container.querySelector('#solo-lyrics-selector-wrapper') as HTMLElement;
    const zenLyricsWrap = this.container.querySelector('#zen-lyrics-selector-wrapper') as HTMLElement;
    const multiLyricsWrap = this.container.querySelector('#multi-lyrics-selector-wrapper') as HTMLElement;

    const soloLyricsSelector = new LyricsSelectorView(soloLyricsWrap);
    const zenLyricsSelector = new LyricsSelectorView(zenLyricsWrap);
    const multiLyricsSelector = new LyricsSelectorView(multiLyricsWrap);

    if (this.selectedCategory === 'lyrics') {
      if (this.activeTab === 'solo') soloLyricsSelector.render();
      else if (this.activeTab === 'zen') zenLyricsSelector.render();
      else multiLyricsSelector.render();
    }

    // Custom Cyber Dropdown helper
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
            lyricsSelector.render();
          } else {
            customWrap.classList.add('hidden');
            lyricsWrap.classList.add('hidden');
          }

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
      '#dropdown-trigger-zen',
      '#dropdown-menu-zen',
      '#dropdown-selected-zen',
      '#zen-custom-text-wrapper',
      '#zen-lyrics-selector-wrapper',
      zenLyricsSelector
    );
    setupCustomDropdown(
      '#dropdown-trigger-multi',
      '#dropdown-menu-multi',
      '#dropdown-selected-multi',
      '#multi-custom-text-wrapper',
      '#multi-lyrics-selector-wrapper',
      multiLyricsSelector
    );

    // Global listener to close dropdowns when clicking outside
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
      this.onStartBot?.(
        pilotName,
        this.selectedBotDiff,
        this.customBotWpm,
        this.selectedErrorMode,
        this.selectedCategory,
        custom,
        activeSong
      );
    });

    // Start Zen Mode button
    const zenBtn = this.container.querySelector('#btn-start-zen-match');
    const zenCustomText = this.container.querySelector('#input-zen-custom-text') as HTMLTextAreaElement;
    zenBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      localStorage.setItem('cyber_pilot_name', pilotName);
      let custom = this.selectedCategory === 'custom' ? zenCustomText?.value.trim() || null : null;
      let activeSong: SongTrack | null = null;
      if (this.selectedCategory === 'lyrics') {
        activeSong = zenLyricsSelector.getSelectedSong();
        custom = activeSong ? activeSong.lyrics : null;
      }
      this.onStartZen?.(pilotName, this.selectedErrorMode, this.selectedCategory, custom, activeSong);
    });

    // Create Multiplayer room
    const createBtn = this.container.querySelector('#btn-create-room');
    const multiCustomText = this.container.querySelector('#input-multi-custom-text') as HTMLTextAreaElement;
    createBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      localStorage.setItem('cyber_pilot_name', pilotName);
      soundEngine.playUiClick();
      let custom = this.selectedCategory === 'custom' ? multiCustomText?.value.trim() || null : null;
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
    const joinInput = this.container.querySelector('#input-join-room-code') as HTMLInputElement;
    joinBtn?.addEventListener('click', () => {
      const pilotName = nameInput.value.trim() || 'ANONYMOUS';
      const code = joinInput?.value.trim().toUpperCase();
      if (!code) {
        joinInput?.focus();
        return;
      }
      localStorage.setItem('cyber_pilot_name', pilotName);
      this.onJoinRoom?.(code, pilotName);
    });
  }
}
