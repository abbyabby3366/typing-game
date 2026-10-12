import { TypingEngine, TypingStats } from '../game/typingEngine';
import { SongTrack } from '../game/songCatalog';
import { musicPlayer } from '../audio/musicPlayer';
import { ICONS } from './icons';
import { escapeHtml } from './escapeHtml';

import { CaretTracker, WordCaretMeta } from './caretTracker';

export interface OpponentStats {
  name: string;
  wpm: number;
  accuracy: number;
  wordsCompleted: number;
  totalWords: number;
  combo: number;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export class HudView {
  private container: HTMLElement;
  public onExitMatch?: () => void;

  // Cached DOM references
  private streamEl: HTMLElement | null = null;
  private caretEl: HTMLElement | null = null;
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
  private zenFillEl: HTMLElement | null = null;
  private zenPctEl: HTMLElement | null = null;
  private zenWordsEl: HTMLElement | null = null;
  private zenStatEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;

  // Incremental word tracking and zero-reflow CaretTracker
  private wordMetas: WordCaretMeta[] = [];
  private activeWordIndex: number = -1;
  private lastScrollTop: number = 0;
  private lastEngine: TypingEngine | null = null;
  private caretTracker: CaretTracker = new CaretTracker();

  // Dirty-tracking cache for zero-redundancy DOM updates
  private lastTugP1Percent: number = -1;
  private lastTugRoundP1: number = -1;
  private lastWpm: number = -1;
  private lastAcc: number = -1;
  private lastCombo: number = -1;
  private lastOppWpm: number = -1;
  private lastOppWords: string = '';
  private lastZenPct: number = -1;
  private lastZenWords: string = '';

  constructor(container: HTMLElement) {
    this.container = container;

    // Window resize smoothly re-aligns floating caret with requestAnimationFrame debouncing
    let resizeRaf: number | null = null;
    const remeasureCaret = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        this.caretTracker.invalidateCache();
        if (this.lastEngine) {
          this.caretTracker.update(
            this.lastEngine.currentWordIndex,
            this.lastEngine.typedBuffer.length,
            this.lastEngine.errorFlash
          );
        }
      });
    };
    window.addEventListener('resize', remeasureCaret);
    // Late-loading web fonts change glyph widths, invalidating measured positions
    document.fonts?.addEventListener('loadingdone', remeasureCaret);
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
          <button id="btn-copy-link" class="btn-cyber-secondary" style="font-size: 0.75rem; padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px;">
            ${ICONS.copy(15)} COPY INVITE LINK
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
      copyBtn.innerHTML = `${ICONS.check(15)} LINK COPIED!`;
      setTimeout(() => {
        if (copyBtn) copyBtn.innerHTML = `${ICONS.copy(15)} COPY INVITE LINK`;
      }, 2000);
    });

    const cancelBtn = this.container.querySelector('#btn-cancel-room');
    cancelBtn?.addEventListener('click', () => {
      this.onExitMatch?.();
    });
  }

  public renderCountdown(seconds: number): void {
    if (!this.countdownEl || !this.countdownEl.isConnected) {
      this.countdownEl = document.createElement('div');
      this.countdownEl.className = 'countdown-overlay';
      document.body.appendChild(this.countdownEl);
    }

    // A fresh number node per tick restarts its zoom animation
    const num = document.createElement('div');
    num.className = 'countdown-number';
    num.textContent = seconds > 0 ? `${seconds}` : 'ENGAGE!';
    this.countdownEl.replaceChildren(num);

    if (seconds <= 0) {
      const overlay = this.countdownEl;
      this.countdownEl = null;
      setTimeout(() => overlay.remove(), 700);
    }
  }

  public renderBattleHud(
    p1Name: string,
    p2Name: string,
    passageTitle: string,
    errorMode: string,
    words: string[],
    activeSong: SongTrack | null = null,
    isZenMode: boolean = false
  ): void {
    const isStrict = errorMode === 'strict_errors';
    p1Name = escapeHtml(p1Name);
    p2Name = escapeHtml(p2Name);
    passageTitle = escapeHtml(passageTitle);
    const songTitle = activeSong ? escapeHtml(activeSong.title) : '';
    const songArtist = activeSong ? escapeHtml(activeSong.artist) : '';

    this.container.innerHTML = `
      <div class="hud-container">
        ${
          isZenMode
            ? `
        <!-- ZEN FLOW PROGRESS TRACKER -->
        <div class="zen-flow-wrapper">
          <div class="zen-flow-header">
            <div class="zen-mode-badge">
              <span style="display: flex; align-items: center;">${ICONS.zen(15)}</span>
              <span>ZEN FLOW MODE // NO DUEL</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span id="zen-progress-percent" style="color: #00ffaa; font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;">0%</span>
              <span id="zen-progress-words" style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.75rem;">0 / ${words.length} WORDS</span>
            </div>
          </div>
          <div class="zen-bar-track">
            <div id="zen-progress-fill" class="zen-bar-fill"></div>
          </div>
        </div>
        `
            : `
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
        `
        }

        ${
          activeSong
            ? `
        <!-- IN-GAME MUSIC CONTROLS FOR LYRICS MODE -->
        <div id="hud-music-bar" class="hud-music-player">
          <div class="hud-music-info">
            <span class="hud-music-icon" style="display: flex; align-items: center;">${ICONS.music(14)}</span>
            <div class="hud-music-meta">
              <span class="hud-music-title">${songTitle}</span>
              <span class="hud-music-artist">${songArtist} &bull; ${activeSong.avgWpm} WPM</span>
            </div>
          </div>
          <div class="hud-music-controls">
            <span id="hud-music-time" class="hud-music-time">0:00 / ${Math.floor(activeSong.durationSec / 60)}:${(activeSong.durationSec % 60).toString().padStart(2, '0')}</span>
            <button type="button" id="hud-music-toggle" class="hud-music-btn" title="Play/Pause Track" style="display: flex; align-items: center; justify-content: center;">
              ${ICONS.pause(14)}
            </button>
            <input type="range" id="hud-music-vol" class="hud-music-volume" min="0" max="1" step="0.05" value="${musicPlayer.getVolume()}" title="Music Volume" />
          </div>
        </div>
        `
            : ''
        }

        <!-- TYPING PASSAGE CONTAINER -->
        <div id="typing-box" class="typing-box">
          <div class="passage-meta-header">
            <span class="passage-title">${passageTitle}</span>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="error-mode-badge ${isStrict ? 'badge-strict' : 'badge-allow'}">
                ${isStrict ? 'STRICT: ZERO TOLERANCE' : 'ALLOW ERRORS'}
              </span>
              <button id="btn-leave-match" class="${isZenMode ? 'btn-cyber-secondary' : 'btn-cyber-danger'}" style="padding: 4px 12px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; ${isZenMode ? 'border-color: rgba(0, 255, 170, 0.4); color: #00ffaa;' : ''}">
                ${isZenMode ? `${ICONS.x(12)} EXIT ZEN` : 'SURRENDER'}
                <kbd style="margin-left: 4px; padding: 1px 4px; font-size: 0.62rem; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.18); border-radius: 3px; font-family: var(--font-mono); letter-spacing: 0.05em; color: var(--text-secondary);">ESC×2</kbd>
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
                <span style="display: flex; align-items: center;">${ICONS.flame(14)}</span>
                <span id="stat-combo">0X</span>
              </div>
            </div>

            <div style="text-align: center; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>${isZenMode ? 'FLOW WITH EACH WORD // PRESS SPACE TO ADVANCE' : 'PRESS KEYS TO FIRE WORDS // SPACE ADVANCES'}</span>
              <span style="opacity: 0.4;">&bull;</span>
              <span style="color: var(--text-secondary);"><kbd style="font-size: 0.65rem; padding: 1px 4px; background: rgba(255,255,255,0.08); border-radius: 3px; border: 1px solid rgba(255,255,255,0.15);">ESC×2</kbd> ${isZenMode ? 'EXIT' : 'FORFEIT'}</span>
            </div>

            <!-- RIGHT CLUSTER (OPPONENT OR ZEN PROGRESS) -->
            ${
              isZenMode
                ? `
            <div class="player-stats-cluster" style="justify-content: flex-end;">
              <div class="stat-unit" style="align-items: flex-end;">
                <span class="stat-label">WORDS COMPLETED</span>
                <span id="stat-zen-words" class="stat-val text-cyan">0 / ${words.length}</span>
              </div>
            </div>
            `
                : `
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
            `
            }
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
    this.zenFillEl = this.container.querySelector('#zen-progress-fill');
    this.zenPctEl = this.container.querySelector('#zen-progress-percent');
    this.zenWordsEl = this.container.querySelector('#zen-progress-words');
    this.zenStatEl = this.container.querySelector('#stat-zen-words');

    const leaveBtn = this.container.querySelector('#btn-leave-match');
    leaveBtn?.addEventListener('click', () => {
      this.onExitMatch?.();
    });

    if (activeSong) {
      const toggleBtn = this.container.querySelector('#hud-music-toggle') as HTMLButtonElement;
      const volInput = this.container.querySelector('#hud-music-vol') as HTMLInputElement;
      const timeEl = this.container.querySelector('#hud-music-time') as HTMLElement;

      toggleBtn?.addEventListener('click', () => {
        if (musicPlayer.isPlaying()) {
          musicPlayer.pause();
          toggleBtn.innerHTML = ICONS.play(14);
        } else {
          musicPlayer.play();
          toggleBtn.innerHTML = ICONS.pause(14);
        }
      });

      volInput?.addEventListener('input', () => {
        musicPlayer.setVolume(parseFloat(volInput.value));
      });

      musicPlayer.onTimeUpdate = (curr, dur) => {
        if (timeEl) {
          const currMin = Math.floor(curr / 60);
          const currSec = Math.floor(curr % 60).toString().padStart(2, '0');
          const durMin = Math.floor(dur / 60);
          const durSec = Math.floor(dur % 60).toString().padStart(2, '0');
          timeEl.textContent = `${currMin}:${currSec} / ${durMin}:${durSec}`;
        }
      };

      musicPlayer.onStateChange = (isPlaying) => {
        if (toggleBtn) {
          toggleBtn.innerHTML = isPlaying ? ICONS.pause(14) : ICONS.play(14);
        }
      };
    }

    // Single-pass DocumentFragment mount for the entire passage
    if (this.streamEl) {
      const fragment = document.createDocumentFragment();

      // Dedicated GPU-accelerated floating caret (zero DOM reflow / zero layout shifting)
      const caret = document.createElement('div');
      caret.id = 'passage-caret';
      caret.className = 'passage-caret';
      fragment.appendChild(caret);
      this.caretEl = caret;

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

        fragment.appendChild(wordContainer);
        return {
          container: wordContainer,
          expectedWord: word,
          charSpans,
        };
      });

      this.streamEl.innerHTML = '';
      this.streamEl.appendChild(fragment);
      this.activeWordIndex = -1;
      this.lastScrollTop = 0;
      this.streamEl.scrollTop = 0;
      this.caretTracker.init(caret, this.streamEl, this.wordMetas);

      // Reset dirty tracking caches for new match
      this.lastTugP1Percent = -1;
      this.lastTugRoundP1 = -1;
      this.lastWpm = -1;
      this.lastAcc = -1;
      this.lastCombo = -1;
      this.lastOppWpm = -1;
      this.lastOppWords = '';
      this.lastZenPct = -1;
      this.lastZenWords = '';
    }
  }

  public updateTugMeter(tugPosition: number): void {
    const p1Percent = Math.max(0, Math.min(100, (1 - (tugPosition + 1) / 2) * 100));
    const p2Percent = 100 - p1Percent;

    // Fast-path GPU layer transforms only when position changes perceptibly
    if (Math.abs(p1Percent - this.lastTugP1Percent) >= 0.05) {
      this.lastTugP1Percent = p1Percent;
      if (this.tugP1Bar) {
        this.tugP1Bar.style.transform = `scaleX(${p1Percent / 100})`;
      }
      if (this.tugP2Bar) {
        this.tugP2Bar.style.transform = `scaleX(${p2Percent / 100})`;
      }
      if (this.tugIndicator) {
        this.tugIndicator.style.transform = `translate3d(calc(${p1Percent}% - 5px), 0, 0)`;
      }
    }

    // Only modify DOM text node when integer percentage shifts
    const roundP1 = Math.round(p1Percent);
    if (roundP1 !== this.lastTugRoundP1) {
      this.lastTugRoundP1 = roundP1;
      if (this.tugLabel) {
        this.tugLabel.textContent = `${roundP1}% // ${100 - roundP1}%`;
      }
    }
  }

  // Rock-solid incremental typing update: zero layout shift, zero horizontal text jumping
  public updateTypingDisplay(engine: TypingEngine): void {
    if (!this.streamEl || this.wordMetas.length === 0) return;
    this.lastEngine = engine;

    const currentWordIdx = engine.currentWordIndex;
    const buffer = engine.typedBuffer;

    // Transition active word container
    if (currentWordIdx !== this.activeWordIndex) {
      if (this.activeWordIndex >= 0 && this.activeWordIndex < this.wordMetas.length) {
        const prev = this.wordMetas[this.activeWordIndex];
        const hasError = prev.charSpans.some(
          (cs) => cs.classList.contains('char-error') || cs.classList.contains('char-pending')
        );
        const compClass = hasError ? 'passage-word word-completed word-error' : 'passage-word word-completed';
        if (prev.container.className !== compClass) {
          prev.container.className = compClass;
        }
        for (const cs of prev.charSpans) {
          const targetCharClass = hasError && cs.classList.contains('char-pending')
            ? 'char char-error'
            : (hasError ? cs.className : 'char char-correct');
          if (cs.className !== targetCharClass) {
            cs.className = targetCharClass;
          }
        }
      }

      this.activeWordIndex = currentWordIdx;

      if (currentWordIdx < this.wordMetas.length) {
        const activeMeta = this.wordMetas[currentWordIdx];
        if (activeMeta.container.className !== 'passage-word current-word-wrapper') {
          activeMeta.container.className = 'passage-word current-word-wrapper';
        }

        // Consistent line-by-line scrolling without forced synchronous reflows
        const { targetScroll } = this.caretTracker.getLineScrollOffset(currentWordIdx);
        if (targetScroll !== this.lastScrollTop) {
          this.lastScrollTop = targetScroll;
          this.streamEl.scrollTo({ top: targetScroll, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        }
      }
    }

    // Incremental character styling strictly inside active word with dirty checking
    if (currentWordIdx < this.wordMetas.length) {
      const meta = this.wordMetas[currentWordIdx];
      const word = meta.expectedWord;
      const charCount = meta.charSpans.length;

      for (let i = 0; i < charCount; i++) {
        const span = meta.charSpans[i];
        let targetClass: string;
        if (i < buffer.length) {
          const isCorrect = buffer[i] === word[i];
          targetClass = `char ${isCorrect ? 'char-correct' : 'char-error'}`;
        } else if (i === buffer.length) {
          targetClass = engine.errorFlash ? 'char char-error-flash' : 'char char-target';
        } else {
          targetClass = 'char char-pending';
        }
        if (span.className !== targetClass) {
          span.className = targetClass;
        }
      }
    }

    // Reposition floating caret smoothly via zero-reflow CaretTracker
    this.caretTracker.update(currentWordIdx, buffer.length, engine.errorFlash);

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
    if (this.wpmEl && p1Stats.wpm !== this.lastWpm) {
      this.lastWpm = p1Stats.wpm;
      this.wpmEl.textContent = `${p1Stats.wpm}`;
    }
    if (this.accEl && p1Stats.accuracy !== this.lastAcc) {
      this.lastAcc = p1Stats.accuracy;
      this.accEl.textContent = `${p1Stats.accuracy}%`;
    }

    if (this.comboWrapEl && this.comboEl && p1Stats.combo !== this.lastCombo) {
      this.lastCombo = p1Stats.combo;
      if (p1Stats.combo > 1) {
        this.comboWrapEl.classList.remove('hidden');
        this.comboEl.textContent = `${p1Stats.combo}X`;
      } else {
        this.comboWrapEl.classList.add('hidden');
      }
    }

    if (oppStats) {
      const oppWpmRound = Math.round(oppStats.wpm);
      if (this.oppWpmEl && oppWpmRound !== this.lastOppWpm) {
        this.lastOppWpm = oppWpmRound;
        this.oppWpmEl.textContent = `${oppWpmRound}`;
      }
      const oppWordsStr = `${oppStats.wordsCompleted}/${oppStats.totalWords}`;
      if (this.oppWordsEl && oppWordsStr !== this.lastOppWords) {
        this.lastOppWords = oppWordsStr;
        this.oppWordsEl.textContent = oppWordsStr;
      }
    }
  }

  public updateZenProgress(wordsCompleted: number, totalWords: number): void {
    const pct = totalWords > 0 ? Math.min(100, Math.round((wordsCompleted / totalWords) * 100)) : 0;
    if (pct !== this.lastZenPct) {
      this.lastZenPct = pct;
      if (this.zenFillEl) this.zenFillEl.style.width = `${pct}%`;
      if (this.zenPctEl) this.zenPctEl.textContent = `${pct}%`;
    }

    const wordsStr = `${wordsCompleted} / ${totalWords}`;
    if (wordsStr !== this.lastZenWords) {
      this.lastZenWords = wordsStr;
      if (this.zenWordsEl) this.zenWordsEl.textContent = `${wordsStr} WORDS`;
      if (this.zenStatEl) this.zenStatEl.textContent = wordsStr;
    }
  }
}
