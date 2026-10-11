import { TypingEngine, TypingStats } from '../game/typingEngine';

export interface OpponentStats {
  name: string;
  wpm: number;
  accuracy: number;
  wordsCompleted: number;
  totalWords: number;
  combo: number;
}

interface WordMeta {
  container: HTMLElement;
  expectedWord: string;
  charSpans: HTMLElement[];
  endCaretSpan: HTMLElement;
}

export class HudView {
  private container: HTMLElement;
  public onExitMatch?: () => void;

  // Cached DOM references
  private streamEl: HTMLElement | null = null;
  private typingBoxEl: HTMLElement | null = null;
  private wpmEl: HTMLElement | null = null;
  private accEl: HTMLElement | null = null;
  private comboWrapEl: HTMLElement | null = null;
  private comboEl: HTMLElement | null = null;
  private oppWpmEl: HTMLElement | null = null;
  private oppWordsEl: HTMLElement | null = null;
  private tugP1Bar: HTMLElement | null = null;
  private tugP2Bar: HTMLElement | null = null;
  private tugIndicator: HTMLElement | null = null;
  private tugLabel: HTMLElement | null = null;

  // Incremental word tracking
  private wordMetas: WordMeta[] = [];
  private activeWordIndex: number = -1;
  private lastScrollTop: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public renderWaiting(roomCode: string, _isHost: boolean): void {
    const fullUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

    this.container.innerHTML = `
      <div class="lobby-card" style="text-align: center; max-width: 540px;">
        <h2 class="brand-title" style="font-size: 1.6rem;">ARENA LINK <span class="text-cyan">INITIALIZED</span></h2>
        <p class="lobby-subtitle">Share room access code with your rival</p>

        <div style="background: rgba(0, 240, 255, 0.08); border: 2px dashed var(--border-cyan); border-radius: 6px; padding: 24px; margin: 12px 0;">
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); letter-spacing: 0.15em;">ROOM ACCESS CODE</div>
          <div style="font-family: var(--font-display); font-size: 3.2rem; font-weight: 900; letter-spacing: 0.2em; color: var(--cyan-primary); text-shadow: 0 0 20px var(--cyan-glow); margin: 6px 0;">
            ${roomCode}
          </div>
          <button id="btn-copy-link" class="btn-cyber-secondary" style="font-size: 0.75rem; padding: 8px 16px;">
            📋 COPY INVITE LINK
          </button>
        </div>

        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem;">
          <span class="status-dot" style="background: var(--cyan-primary); animation: blink-caret 1s infinite;"></span>
          WAITING FOR CHALLENGER TO LOCK IN...
        </div>

        <div style="margin-top: 10px;">
          <button id="btn-cancel-room" class="btn-cyber-danger">
            CANCEL DUEL
          </button>
        </div>
      </div>
    `;

    const copyBtn = this.container.querySelector('#btn-copy-link');
    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(fullUrl);
      copyBtn.textContent = '✓ LINK COPIED!';
      setTimeout(() => {
        if (copyBtn) copyBtn.textContent = '📋 COPY INVITE LINK';
      }, 2000);
    });

    const cancelBtn = this.container.querySelector('#btn-cancel-room');
    cancelBtn?.addEventListener('click', () => {
      this.onExitMatch?.();
    });
  }

  public renderCountdown(seconds: number): void {
    const existing = document.querySelector('.countdown-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.innerHTML = `
      <div class="countdown-number">${seconds > 0 ? seconds : 'ENGAGE!'}</div>
    `;
    document.body.appendChild(overlay);

    if (seconds <= 0) {
      setTimeout(() => overlay.remove(), 700);
    }
  }

  public renderBattleHud(
    p1Name: string,
    p2Name: string,
    passageTitle: string,
    errorMode: string,
    words: string[]
  ): void {
    const isStrict = errorMode === 'strict_errors';

    this.container.innerHTML = `
      <div class="hud-container">
        <!-- TUG OF WAR MOMENTUM BAR -->
        <div class="tug-meter-wrapper">
          <div class="tug-label-row">
            <span class="text-cyan">${p1Name} (YOU)</span>
            <span style="color: var(--amber-gold); font-size: 0.85rem;" id="tug-territory-text">50% // 50%</span>
            <span class="text-magenta">${p2Name} (RIVAL)</span>
          </div>
          <div class="tug-bar-track">
            <div id="tug-p1-bar" class="tug-bar-p1"></div>
            <div id="tug-p2-bar" class="tug-bar-p2"></div>
            <div class="tug-center-pin"></div>
            <div id="tug-indicator" class="tug-clash-indicator"></div>
          </div>
        </div>

        <!-- TYPING PASSAGE CONTAINER -->
        <div id="typing-box" class="typing-box">
          <div class="passage-meta-header">
            <span class="passage-title">${passageTitle}</span>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="error-mode-badge ${isStrict ? 'badge-strict' : 'badge-allow'}">
                ${isStrict ? 'STRICT: ZERO TOLERANCE' : 'ALLOW ERRORS'}
              </span>
              <button id="btn-leave-match" class="btn-cyber-danger" style="padding: 4px 10px; font-size: 0.7rem;">
                SURRENDER
              </button>
            </div>
          </div>

          <!-- DYNAMIC STREAM OF TEXT CHARACTERS -->
          <div id="passage-stream" class="passage-text-flow" tabindex="0"></div>

          <!-- INSTRUMENTATION & TELEMETRY -->
          <div class="stats-bar">
            <!-- P1 STATS -->
            <div class="player-stats-cluster">
              <div class="stat-unit">
                <span class="stat-label">WPM</span>
                <span id="stat-wpm" class="stat-val text-cyan">0</span>
              </div>
              <div class="stat-unit">
                <span class="stat-label">ACCURACY</span>
                <span id="stat-acc" class="stat-val" style="color: #00ffaa;">100%</span>
              </div>
              <div id="stat-combo-wrapper" class="combo-pill hidden">
                <span>🔥</span>
                <span id="stat-combo">0X</span>
              </div>
            </div>

            <div style="text-align: center; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
              PRESS KEYS TO FIRE WORDS // SPACE ADVANCES
            </div>

            <!-- OPPONENT STATS -->
            <div class="player-stats-cluster" style="justify-content: flex-end;">
              <div class="stat-unit" style="align-items: flex-end;">
                <span class="stat-label">OPPONENT WPM</span>
                <span id="stat-opp-wpm" class="stat-val text-magenta">0</span>
              </div>
              <div class="stat-unit" style="align-items: flex-end;">
                <span class="stat-label">PROGRESS</span>
                <span id="stat-opp-words" class="stat-val" style="color: var(--text-secondary);">0/${words.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cache elements for zero-lookup runtime performance
    this.streamEl = this.container.querySelector('#passage-stream');
    this.typingBoxEl = this.container.querySelector('#typing-box');
    this.wpmEl = this.container.querySelector('#stat-wpm');
    this.accEl = this.container.querySelector('#stat-acc');
    this.comboWrapEl = this.container.querySelector('#stat-combo-wrapper');
    this.comboEl = this.container.querySelector('#stat-combo');
    this.oppWpmEl = this.container.querySelector('#stat-opp-wpm');
    this.oppWordsEl = this.container.querySelector('#stat-opp-words');
    this.tugP1Bar = this.container.querySelector('#tug-p1-bar');
    this.tugP2Bar = this.container.querySelector('#tug-p2-bar');
    this.tugIndicator = this.container.querySelector('#tug-indicator');
    this.tugLabel = this.container.querySelector('#tug-territory-text');

    const leaveBtn = this.container.querySelector('#btn-leave-match');
    leaveBtn?.addEventListener('click', () => {
      this.onExitMatch?.();
    });

    // Single-pass DocumentFragment mount for the entire passage
    if (this.streamEl) {
      const fragment = document.createDocumentFragment();
      this.wordMetas = words.map((word) => {
        const wordContainer = document.createElement('span');
        wordContainer.className = 'passage-word';

        const charSpans: HTMLElement[] = [];
        for (let i = 0; i < word.length; i++) {
          const charSpan = document.createElement('span');
          charSpan.className = 'char char-pending';
          charSpan.textContent = word[i];
          wordContainer.appendChild(charSpan);
          charSpans.push(charSpan);
        }

        const endCaret = document.createElement('span');
        endCaret.className = 'char char-current hidden';
        endCaret.innerHTML = '<span class="cursor-caret"></span>&nbsp;';
        wordContainer.appendChild(endCaret);

        fragment.appendChild(wordContainer);
        return {
          container: wordContainer,
          expectedWord: word,
          charSpans,
          endCaretSpan: endCaret,
        };
      });

      this.streamEl.innerHTML = '';
      this.streamEl.appendChild(fragment);
      this.activeWordIndex = -1;
      this.lastScrollTop = 0;
    }
  }

  public updateTugMeter(tugPosition: number): void {
    const p1Percent = Math.max(0, Math.min(100, (1 - (tugPosition + 1) / 2) * 100));
    const p2Percent = 100 - p1Percent;

    if (this.tugP1Bar) {
      this.tugP1Bar.style.transform = `scaleX(${p1Percent / 100})`;
    }
    if (this.tugP2Bar) {
      this.tugP2Bar.style.transform = `scaleX(${p2Percent / 100})`;
    }
    if (this.tugIndicator) {
      this.tugIndicator.style.transform = `translate3d(calc(${p1Percent}% - 5px), 0, 0)`;
    }
    if (this.tugLabel) {
      this.tugLabel.textContent = `${Math.round(p1Percent)}% // ${Math.round(p2Percent)}%`;
    }
  }

  // Highly optimized incremental DOM update: updates only active word and caret
  public updateTypingDisplay(engine: TypingEngine): void {
    if (!this.streamEl || this.wordMetas.length === 0) return;

    const currentWordIdx = engine.currentWordIndex;
    const buffer = engine.typedBuffer;

    // Transition word container when active word changes
    if (currentWordIdx !== this.activeWordIndex) {
      if (this.activeWordIndex >= 0 && this.activeWordIndex < this.wordMetas.length) {
        const prev = this.wordMetas[this.activeWordIndex];
        prev.container.className = 'passage-word word-completed';
        prev.endCaretSpan.classList.add('hidden');
        for (const cs of prev.charSpans) {
          cs.className = 'char char-correct';
        }
      }

      this.activeWordIndex = currentWordIdx;

      if (currentWordIdx < this.wordMetas.length) {
        const activeMeta = this.wordMetas[currentWordIdx];
        activeMeta.container.className = 'passage-word current-word-wrapper';

        // Check if active word is on a new line and smooth-scroll the stream
        const containerTop = activeMeta.container.offsetTop;
        if (containerTop - this.streamEl.scrollTop > 56 || containerTop < this.streamEl.scrollTop) {
          const target = Math.max(0, containerTop - 18);
          if (target !== this.lastScrollTop) {
            this.lastScrollTop = target;
            this.streamEl.scrollTo({ top: target, behavior: 'smooth' });
          }
        }
      }
    }

    // Incremental character update strictly inside the active word
    if (currentWordIdx < this.wordMetas.length) {
      const meta = this.wordMetas[currentWordIdx];
      const word = meta.expectedWord;
      const charCount = meta.charSpans.length;

      for (let i = 0; i < charCount; i++) {
        const span = meta.charSpans[i];
        if (i < buffer.length) {
          const isCorrect = buffer[i] === word[i];
          span.className = `char ${isCorrect ? 'char-correct' : 'char-error'}`;
          span.textContent = word[i];
        } else if (i === buffer.length) {
          const flash = engine.errorFlash ? ' char-error' : '';
          span.className = `char char-current${flash}`;
          span.innerHTML = `<span class="cursor-caret"></span>${word[i]}`;
        } else {
          span.className = 'char char-pending';
          span.textContent = word[i];
        }
      }

      // Word fully typed: show trailing caret waiting for space
      if (buffer.length >= word.length) {
        const flash = engine.errorFlash ? ' char-error' : '';
        meta.endCaretSpan.className = `char char-current${flash}`;
        meta.endCaretSpan.classList.remove('hidden');
      } else {
        meta.endCaretSpan.classList.add('hidden');
      }
    }

    // Overheat shake
    if (this.typingBoxEl) {
      if (engine.isOverheated) {
        this.typingBoxEl.classList.add('overheat-flash');
      } else {
        this.typingBoxEl.classList.remove('overheat-flash');
      }
    }
  }

  public updateStats(p1Stats: TypingStats, oppStats?: OpponentStats): void {
    if (this.wpmEl) this.wpmEl.textContent = `${p1Stats.wpm}`;
    if (this.accEl) this.accEl.textContent = `${p1Stats.accuracy}%`;

    if (this.comboWrapEl && this.comboEl) {
      if (p1Stats.combo > 1) {
        this.comboWrapEl.classList.remove('hidden');
        this.comboEl.textContent = `${p1Stats.combo}X`;
      } else {
        this.comboWrapEl.classList.add('hidden');
      }
    }

    if (oppStats) {
      if (this.oppWpmEl) this.oppWpmEl.textContent = `${Math.round(oppStats.wpm)}`;
      if (this.oppWordsEl) this.oppWordsEl.textContent = `${oppStats.wordsCompleted}/${oppStats.totalWords}`;
    }
  }
}
