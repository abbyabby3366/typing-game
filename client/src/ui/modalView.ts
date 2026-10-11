import confetti from 'canvas-confetti';

export interface GameOverData {
  isWinner: boolean;
  isDraw: boolean;
  reason: string;
  p1Stats: { name: string; wpm: number; accuracy: number; max_combo: number; words_completed: number };
  p2Stats: { name: string; wpm: number; accuracy: number; max_combo: number; words_completed: number };
}

export class ModalView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  // Format date and time according to strict GMT+8 DD-MM-YY standards
  private getFormattedDateTime(): { dateStr: string; timeStr: string } {
    const now = new Date();
    // Adjust to GMT+8 (Malaysia Time)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const gmt8 = new Date(utc + 3600000 * 8);

    const dd = String(gmt8.getDate()).padStart(2, '0');
    const mm = String(gmt8.getMonth() + 1).padStart(2, '0');
    const yy = String(gmt8.getFullYear()).slice(-2);
    const dateStr = `${dd}-${mm}-${yy}`;

    const hh = String(gmt8.getHours()).padStart(2, '0');
    const min = String(gmt8.getMinutes()).padStart(2, '0');
    const ss = String(gmt8.getSeconds()).padStart(2, '0');
    const timeStr = `${hh}:${min}:${ss}`;

    return { dateStr, timeStr };
  }

  // Mandatory confirmation dialog for destructive actions / quitting match
  public showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): void {
    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <h3 class="modal-title" style="color: #ff3366; font-size: 1.4rem;">${title}</h3>
        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">${message}</p>
        <div class="modal-actions">
          <button id="btn-modal-cancel" class="btn-cyber-secondary">
            CANCEL
          </button>
          <button id="btn-modal-confirm" class="btn-cyber-danger">
            CONFIRM EXIT
          </button>
        </div>
      </div>
    `;

    const cancelBtn = this.container.querySelector('#btn-modal-cancel');
    const confirmBtn = this.container.querySelector('#btn-modal-confirm');

    cancelBtn?.addEventListener('click', () => {
      this.hide();
      onCancel?.();
    });

    confirmBtn?.addEventListener('click', () => {
      this.hide();
      onConfirm();
    });
  }

  public showGameOver(
    data: GameOverData,
    onRematch: () => void,
    onExit: () => void
  ): void {
    if (data.isWinner) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00f0ff', '#ffd700', '#00ffaa'],
      });
    }

    const { dateStr, timeStr } = this.getFormattedDateTime();

    const titleText = data.isDraw
      ? 'NEURAL DRAW // STALEMATE'
      : data.isWinner
      ? 'OVERLOAD // VICTORY ACHIEVED'
      : 'CONTAINMENT BREACH // DEFEAT';

    const titleColor = data.isDraw
      ? 'var(--amber-gold)'
      : data.isWinner
      ? 'var(--cyan-primary)'
      : 'var(--magenta-primary)';

    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content">
        <h2 class="modal-title" style="color: ${titleColor};">${titleText}</h2>
        <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">
          ${data.reason.toUpperCase().replace(/_/g, ' ')}
        </div>

        <!-- Telemetry Data Grid -->
        <div style="background: rgba(4, 7, 16, 0.75); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 18px; margin: 8px 0;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--font-mono); font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 0.75rem;">
                <th style="padding: 8px;">METRIC</th>
                <th style="padding: 8px; color: var(--cyan-primary);">${data.p1Stats.name}</th>
                <th style="padding: 8px; color: var(--magenta-primary);">${data.p2Stats.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">FINAL WPM</td>
                <td style="padding: 10px 8px; font-weight: bold; color: var(--cyan-primary);">${Math.round(data.p1Stats.wpm)}</td>
                <td style="padding: 10px 8px; font-weight: bold; color: var(--magenta-primary);">${Math.round(data.p2Stats.wpm)}</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">ACCURACY</td>
                <td style="padding: 10px 8px; font-weight: bold;">${Math.round(data.p1Stats.accuracy)}%</td>
                <td style="padding: 10px 8px; font-weight: bold;">${Math.round(data.p2Stats.accuracy)}%</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">PEAK COMBO</td>
                <td style="padding: 10px 8px; font-weight: bold; color: var(--amber-gold);">${data.p1Stats.max_combo}X</td>
                <td style="padding: 10px 8px; font-weight: bold; color: var(--amber-gold);">${data.p2Stats.max_combo}X</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                <td style="padding: 10px 8px; color: var(--text-secondary);">WORDS TYPED</td>
                <td style="padding: 10px 8px;">${data.p1Stats.words_completed}</td>
                <td style="padding: 10px 8px;">${data.p2Stats.words_completed}</td>
              </tr>
              <!-- Stacked 2-row DateTime Cell complying strictly with user rule -->
              <tr>
                <td style="padding: 10px 8px; color: var(--text-secondary);">TIMESTAMP</td>
                <td colspan="2" style="padding: 10px 8px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: bold; color: var(--text-primary); font-size: 0.85rem;">${dateStr}</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">${timeStr}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          <button id="btn-results-lobby" class="btn-cyber-secondary">
            RETURN TO LOBBY
          </button>
          <button id="btn-results-rematch" class="btn-cyber-primary">
            REQUEST REMATCH ⚡
          </button>
        </div>
      </div>
    `;

    const rematchBtn = this.container.querySelector('#btn-results-rematch') as HTMLButtonElement;
    const lobbyBtn = this.container.querySelector('#btn-results-lobby');

    rematchBtn?.addEventListener('click', () => {
      rematchBtn.textContent = 'WAITING FOR OPPONENT...';
      rematchBtn.disabled = true;
      onRematch();
    });

    lobbyBtn?.addEventListener('click', () => {
      this.showConfirm(
        'LEAVE MATCH RESULTS',
        'Are you sure you want to return to the battle lobby?',
        () => {
          this.hide();
          onExit();
        }
      );
    });
  }

  public hide(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }
}
