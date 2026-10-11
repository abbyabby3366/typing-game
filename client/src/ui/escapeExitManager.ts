import { soundEngine } from '../audio/soundEngine';

export type GameModeType = 'zen' | 'solo' | 'duel';

export interface EscapeExitManagerOptions {
  isSessionActive: () => boolean;
  getMode: () => GameModeType;
  onExit: () => void;
}

export class EscapeExitManager {
  private options: EscapeExitManagerOptions;
  private overlayEl: HTMLElement | null = null;
  private ringCircleEl: SVGCircleElement | null = null;
  private timeoutFillEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private percentEl: HTMLElement | null = null;

  private isHolding = false;
  private holdStartTimestamp = 0;
  private holdAnimFrame: number | null = null;
  private doubleTapTimer: number | null = null;
  private hasFirstTap = false;
  private firstTapTimestamp = 0;
  private isExiting = false;

  private readonly HOLD_DURATION_MS = 1200; // 1.2s continuous hold to exit
  private readonly DOUBLE_TAP_WINDOW_MS = 2200; // 2.2s window to tap Escape again
  private readonly CIRCUMFERENCE = 2 * Math.PI * 18; // ~113.1 for r=18

  constructor(options: EscapeExitManagerOptions) {
    this.options = options;
    this.createDom();
    this.bindEvents();
  }

  private createDom(): void {
    const existing = document.getElementById('cyber-escape-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cyber-escape-overlay';
    overlay.className = 'cyber-escape-overlay hidden';
    overlay.setAttribute('role', 'alert');
    overlay.setAttribute('aria-live', 'assertive');

    overlay.innerHTML = `
      <div class="escape-overlay-card">
        <div class="escape-ring-container">
          <svg class="escape-progress-svg" viewBox="0 0 44 44">
            <circle class="escape-ring-bg" cx="22" cy="22" r="18" />
            <circle class="escape-ring-fill" cx="22" cy="22" r="18" />
          </svg>
          <div class="escape-key-badge">
            <span class="escape-key-label">ESC</span>
          </div>
        </div>
        <div class="escape-text-block">
          <div class="escape-title" id="escape-overlay-title">TAP ESC AGAIN TO EXIT</div>
          <div class="escape-hint" id="escape-overlay-hint">HOLD 1.2S OR PRESS AGAIN TO CONFIRM</div>
        </div>
        <div class="escape-percent-badge" id="escape-overlay-percent">0%</div>
        <div class="escape-timeout-bar-track">
          <div class="escape-timeout-bar-fill" id="escape-overlay-timeout-fill"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.ringCircleEl = overlay.querySelector('.escape-ring-fill');
    this.timeoutFillEl = overlay.querySelector('#escape-overlay-timeout-fill');
    this.titleEl = overlay.querySelector('#escape-overlay-title');
    this.hintEl = overlay.querySelector('#escape-overlay-hint');
    this.percentEl = overlay.querySelector('#escape-overlay-percent');

    if (this.ringCircleEl) {
      this.ringCircleEl.style.strokeDasharray = `${this.CIRCUMFERENCE}`;
      this.ringCircleEl.style.strokeDashoffset = `${this.CIRCUMFERENCE}`;
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.options.isSessionActive()) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.isExiting) return;

      // Double-press detection on second non-repeated keydown
      if (this.hasFirstTap && !e.repeat && !this.isHolding) {
        this.triggerExitConfirmed();
        return;
      }

      // First Escape press
      if (!this.isHolding && !e.repeat) {
        this.hasFirstTap = true;
        this.firstTapTimestamp = performance.now();
        soundEngine.playEscapeBeep?.(false);
        this.startHoldTracker();
        this.startDoubleTapTimer();
      }
      return;
    }

    // If user is actively typing printable letters while prompt is open, cancel it to avoid distraction
    if (this.hasFirstTap && !this.isHolding && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.cancelAndHide();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (this.isExiting) return;

    if (this.isHolding) {
      this.stopHoldTracker();
      // Revert UI to tap prompt state if still within double tap window
      if (this.hasFirstTap && this.overlayEl) {
        this.updateCardUiForTap();
      }
    }
  };

  private startHoldTracker(): void {
    this.isHolding = true;
    this.holdStartTimestamp = performance.now();
    this.showOverlay();
    this.updateCardUiForHold(0);

    const tick = () => {
      if (!this.isHolding || this.isExiting) return;

      const elapsed = performance.now() - this.holdStartTimestamp;
      const progress = Math.min(1, elapsed / this.HOLD_DURATION_MS);

      this.updateProgressRing(progress);
      this.updateCardUiForHold(progress);

      if (progress >= 1) {
        this.triggerExitConfirmed();
        return;
      }

      this.holdAnimFrame = requestAnimationFrame(tick);
    };

    if (this.holdAnimFrame !== null) {
      cancelAnimationFrame(this.holdAnimFrame);
    }
    this.holdAnimFrame = requestAnimationFrame(tick);
  }

  private stopHoldTracker(): void {
    this.isHolding = false;
    if (this.holdAnimFrame !== null) {
      cancelAnimationFrame(this.holdAnimFrame);
      this.holdAnimFrame = null;
    }
    this.updateProgressRing(0);
  }

  private startDoubleTapTimer(): void {
    if (this.doubleTapTimer !== null) {
      clearTimeout(this.doubleTapTimer);
    }

    const start = performance.now();
    const updateTimeoutBar = () => {
      if (!this.hasFirstTap || this.isExiting) return;
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, 1 - elapsed / this.DOUBLE_TAP_WINDOW_MS);
      if (this.timeoutFillEl) {
        this.timeoutFillEl.style.width = `${(remaining * 100).toFixed(1)}%`;
      }
      if (remaining > 0 && !this.isHolding) {
        requestAnimationFrame(updateTimeoutBar);
      }
    };
    requestAnimationFrame(updateTimeoutBar);

    this.doubleTapTimer = window.setTimeout(() => {
      if (!this.isHolding && !this.isExiting) {
        this.cancelAndHide();
      }
    }, this.DOUBLE_TAP_WINDOW_MS);
  }

  private updateProgressRing(progress: number): void {
    if (!this.ringCircleEl) return;
    const offset = this.CIRCUMFERENCE * (1 - progress);
    this.ringCircleEl.style.strokeDashoffset = `${offset.toFixed(2)}`;
    if (this.percentEl) {
      this.percentEl.textContent = `${Math.floor(progress * 100)}%`;
      this.percentEl.style.opacity = progress > 0.05 ? '1' : '0';
    }
  }

  private showOverlay(): void {
    if (!this.overlayEl) return;
    const mode = this.options.getMode();
    this.overlayEl.className = `cyber-escape-overlay visible mode-${mode}`;
  }

  private updateCardUiForHold(progress: number): void {
    if (!this.titleEl || !this.hintEl) return;
    const mode = this.options.getMode();
    const action = mode === 'zen' ? 'EXIT ZEN' : mode === 'solo' ? 'FORFEIT MATCH' : 'FORFEIT DUEL';
    const pct = Math.floor(progress * 100);
    this.titleEl.textContent = `HOLDING ESC TO ${action} (${pct}%)`;
    this.hintEl.textContent = 'RELEASE TO CANCEL // HOLD TO CONFIRM';
  }

  private updateCardUiForTap(): void {
    if (!this.titleEl || !this.hintEl) return;
    const mode = this.options.getMode();
    const action = mode === 'zen' ? 'EXIT ZEN' : mode === 'solo' ? 'FORFEIT MATCH' : 'FORFEIT DUEL';
    this.titleEl.textContent = `PRESS ESC AGAIN TO ${action}`;
    this.hintEl.textContent = 'HOLD 1.2S OR TAP AGAIN TO CONFIRM';
    if (this.percentEl) {
      this.percentEl.style.opacity = '0';
    }
  }

  private triggerExitConfirmed(): void {
    this.isExiting = true;
    this.stopHoldTracker();
    if (this.doubleTapTimer !== null) {
      clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = null;
    }

    soundEngine.playEscapeBeep?.(true);

    if (this.titleEl && this.hintEl) {
      const mode = this.options.getMode();
      this.titleEl.textContent = mode === 'zen' ? 'EXITING ZEN FLOW...' : 'MATCH FORFEITED...';
      this.hintEl.textContent = 'RETURNING TO BATTLE LOBBY';
    }
    this.updateProgressRing(1);

    if (this.overlayEl) {
      this.overlayEl.classList.add('confirmed');
    }

    setTimeout(() => {
      this.cancelAndHide();
      this.options.onExit();
    }, 280);
  }

  public cancelAndHide(): void {
    this.stopHoldTracker();
    if (this.doubleTapTimer !== null) {
      clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = null;
    }
    this.hasFirstTap = false;
    this.isExiting = false;
    if (this.overlayEl) {
      this.overlayEl.className = 'cyber-escape-overlay hidden';
    }
    this.updateProgressRing(0);
  }

  public reset(): void {
    this.cancelAndHide();
  }

  public destroy(): void {
    this.cancelAndHide();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }
}
