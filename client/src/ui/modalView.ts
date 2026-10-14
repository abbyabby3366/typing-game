import confetti from 'canvas-confetti';
import { escapeHtml } from './escapeHtml';
import { formatGmt8DateTime, telemetryStore } from '../game/telemetryStore';
import { ICONS } from './icons';

export interface GameOverData {
  isWinner: boolean;
  isDraw: boolean;
  reason: string;
  myRole?: 'player1' | 'player2';
  isNewPersonalBest?: boolean;
  rawWpm?: number;
  typoCount?: number;
  timestampIso?: string;
  p1Stats: { name: string; wpm: number; accuracy: number; max_combo: number; words_completed: number };
  p2Stats: { name: string; wpm: number; accuracy: number; max_combo: number; words_completed: number };
}

export class ModalView {
  private container: HTMLElement;
  private opponentHasLeft: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public isGameOverOpen(): boolean {
    return (
      !this.container.classList.contains('hidden') &&
      this.container.querySelector('#btn-results-rematch') !== null
    );
  }

  // Mandatory confirmation dialog for destructive actions / quitting match
  public showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmLabel: string = 'CONFIRM EXIT'
  ): void {
    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content" style="max-width: 480px;">
        <h3 class="modal-title" style="color: #ff3366; font-size: 1.4rem;">${escapeHtml(title)}</h3>
        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button id="btn-modal-cancel" class="btn-cyber-secondary">
            CANCEL
          </button>
          <button id="btn-modal-confirm" class="btn-cyber-danger">
            ${escapeHtml(confirmLabel)}
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
    onExit: () => void,
    skipConfetti: boolean = false
  ): void {
    if (!skipConfetti) {
      this.opponentHasLeft = data.reason === 'opponent_resigned';
    }
    if (data.isWinner && !skipConfetti) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#00f0ff', '#ffd700', '#00ffaa'],
      });
    }

    const { dateStr, timeStr } = formatGmt8DateTime(data.timestampIso);

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

    const p1Header =
      data.myRole === 'player1'
        ? `${escapeHtml(data.p1Stats.name)} (YOU)`
        : escapeHtml(data.p1Stats.name);
    const p2Header =
      data.myRole === 'player2'
        ? `${escapeHtml(data.p2Stats.name)} (YOU)`
        : escapeHtml(data.p2Stats.name);

    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content">
        <h2 class="modal-title" style="color: ${titleColor};">${titleText}</h2>
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">
            ${escapeHtml(data.reason.toUpperCase().replace(/_/g, ' '))}
          </span>
          ${
            data.isNewPersonalBest
              ? `<span style="display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 800; color: var(--amber-gold); background: rgba(255, 215, 0, 0.14); border: 1px solid rgba(255, 215, 0, 0.5); padding: 2px 8px; border-radius: 3px;">
                   ${ICONS.trophy(13)} NEW PERSONAL BEST WPM!
                 </span>`
              : ''
          }
        </div>

        <!-- Telemetry Data Grid -->
        <div style="background: rgba(4, 7, 16, 0.75); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 18px; margin: 8px 0;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-family: var(--font-mono); font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 0.75rem;">
                <th style="padding: 8px;">METRIC</th>
                <th style="padding: 8px; color: var(--cyan-primary);">${p1Header}</th>
                <th style="padding: 8px; color: var(--magenta-primary);">${p2Header}</th>
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
              ${
                data.rawWpm !== undefined
                  ? `<tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                       <td style="padding: 10px 8px; color: var(--text-secondary);">YOUR RAW / TYPOS</td>
                       <td colspan="2" style="padding: 10px 8px; color: var(--text-primary);">
                         ${data.rawWpm} RAW WPM &bull; ${data.typoCount ?? 0} TYPOS
                       </td>
                     </tr>`
                  : ''
              }
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
          <button id="btn-results-rematch" class="btn-cyber-primary" ${this.opponentHasLeft ? 'disabled' : ''}>
            ${this.opponentHasLeft ? 'OPPONENT LEFT ARENA' : 'REQUEST REMATCH'}
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
        },
        () => {
          this.showGameOver(data, onRematch, onExit, true);
        }
      );
    });
  }

  public notifyOpponentRematch(): void {
    const rematchBtn = this.container.querySelector('#btn-results-rematch') as HTMLButtonElement | null;
    if (rematchBtn && !rematchBtn.disabled) {
      rematchBtn.textContent = 'ACCEPT REMATCH (RIVAL READY!)';
      rematchBtn.classList.add('glow-pulse');
    }
  }

  public notifyOpponentLeft(): void {
    this.opponentHasLeft = true;
    const rematchBtn = this.container.querySelector('#btn-results-rematch') as HTMLButtonElement | null;
    if (rematchBtn) {
      rematchBtn.textContent = 'OPPONENT LEFT ARENA';
      rematchBtn.disabled = true;
      rematchBtn.classList.remove('glow-pulse');
    }
  }

  public showZenComplete(
    stats: {
      wpm: number;
      rawWpm?: number;
      accuracy: number;
      maxCombo: number;
      wordsCompleted: number;
      charsTyped: number;
      typoCount?: number;
      elapsedSec: number;
      isNewPersonalBest?: boolean;
      timestampIso?: string;
    },
    passageTitle: string,
    onRestart: () => void,
    onExit: () => void,
    skipConfetti: boolean = false
  ): void {
    if (!skipConfetti) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ffaa', '#00b4d8', '#ffffff'],
      });
    }

    const { dateStr, timeStr } = formatGmt8DateTime(stats.timestampIso);

    const mins = Math.floor(stats.elapsedSec / 60);
    const secs = Math.floor(stats.elapsedSec % 60);
    const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;

    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content" style="max-width: 540px;">
        <div>
          <h3 class="modal-title" style="color: #00ffaa; font-size: 1.6rem; letter-spacing: 0.12em;">
            ZEN FLOW COMPLETE
          </h3>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
            ${escapeHtml(passageTitle)}
          </p>
          ${
            stats.isNewPersonalBest
              ? `<div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 0.72rem; font-weight: 800; color: var(--amber-gold); background: rgba(255, 215, 0, 0.14); border: 1px solid rgba(255, 215, 0, 0.5); padding: 3px 9px; border-radius: 3px;">
                   ${ICONS.trophy(13)} NEW PERSONAL BEST WPM!
                 </div>`
              : ''
          }
        </div>

        <div style="background: rgba(4, 9, 20, 0.95); border: 1px solid rgba(0, 255, 170, 0.3); border-radius: 6px; padding: 14px;">
          <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.84rem;">
            <tbody>
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">NET SPEED</td>
                <td style="padding: 9px 8px; font-weight: bold; color: var(--cyan-primary); text-align: right; font-size: 1.1rem;">${stats.wpm} WPM ${stats.rawWpm !== undefined ? `<span style="font-size: 0.74rem; color: var(--text-muted);">(${stats.rawWpm} RAW)</span>` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">ACCURACY</td>
                <td style="padding: 9px 8px; font-weight: bold; color: #00ffaa; text-align: right;">${stats.accuracy}% ${stats.typoCount !== undefined ? `<span style="font-size: 0.74rem; color: var(--text-muted);">(${stats.typoCount} typos)</span>` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">PEAK COMBO</td>
                <td style="padding: 9px 8px; font-weight: bold; color: var(--amber-gold); text-align: right;">${stats.maxCombo}x</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">WORDS & CHARACTERS</td>
                <td style="padding: 9px 8px; text-align: right; color: var(--text-primary);">${stats.wordsCompleted} words / ${stats.charsTyped} chars</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">SESSION TIME</td>
                <td style="padding: 9px 8px; text-align: right; color: var(--text-primary);">${timeFormatted}</td>
              </tr>
              <!-- Stacked 2-row DateTime Cell complying strictly with user rule -->
              <tr>
                <td style="padding: 9px 8px; color: var(--text-secondary); text-align: left;">TIMESTAMP</td>
                <td style="padding: 9px 8px; text-align: right;">
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <span style="font-weight: bold; color: var(--text-primary); font-size: 0.85rem;">${dateStr}</span>
                    <span style="font-size: 0.7rem; color: var(--text-muted);">${timeStr}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-actions">
          <button id="btn-zen-lobby" class="btn-cyber-secondary">
            RETURN TO LOBBY
          </button>
          <button id="btn-zen-replay" class="btn-cyber-primary" style="background: linear-gradient(135deg, #00ffaa, #00b4d8); color: #020712;">
            PRACTICE AGAIN
          </button>
        </div>
      </div>
    `;

    const replayBtn = this.container.querySelector('#btn-zen-replay');
    const lobbyBtn = this.container.querySelector('#btn-zen-lobby');

    replayBtn?.addEventListener('click', () => {
      this.hide();
      onRestart();
    });

    lobbyBtn?.addEventListener('click', () => {
      this.showConfirm(
        'LEAVE ZEN PRACTICE',
        'Are you sure you want to exit Zen Practice and return to the battle lobby?',
        () => {
          this.hide();
          onExit();
        },
        () => {
          this.showZenComplete(stats, passageTitle, onRestart, onExit, true);
        }
      );
    });
  }

  public showTelemetryModal(onLogsChanged?: () => void): void {
    const summary = telemetryStore.getSummary();
    const records = telemetryStore.getRecords();
    const duelCount = summary.wins + summary.losses + summary.draws;
    const winRate = duelCount > 0 ? Math.round((summary.wins / duelCount) * 100) : 0;

    this.container.classList.remove('hidden');
    this.container.innerHTML = `
      <div class="modal-content" style="max-width: 740px; width: 95%; text-align: left;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--cyan-primary); display: flex;">${ICONS.chart(20)}</span>
            <div>
              <h3 class="modal-title" style="color: var(--cyan-primary); font-size: 1.35rem; margin: 0;">
                PILOT CAREER TELEMETRY
              </h3>
              <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">
                LOCAL NEURAL ARCHIVE // GMT+8 TIMESTAMPS
              </div>
            </div>
          </div>
          <button id="btn-close-telemetry-top" type="button" class="btn-cyber-secondary" style="padding: 6px 14px; font-size: 0.75rem;">
            CLOSE
          </button>
        </div>

        <!-- KPI Summary Strip -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
          <div style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 4px; padding: 10px;">
            <div style="font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-muted);">PEAK WPM</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: var(--cyan-primary);">${summary.bestWpm}</div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 4px; padding: 10px;">
            <div style="font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-muted);">AVG WPM</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: #ffffff;">${summary.avgWpm}</div>
          </div>
          <div style="background: rgba(0, 255, 170, 0.04); border: 1px solid rgba(0, 255, 170, 0.2); border-radius: 4px; padding: 10px;">
            <div style="font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-muted);">AVG ACCURACY</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: #00ffaa;">${summary.avgAccuracy}%</div>
          </div>
          <div style="background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.22); border-radius: 4px; padding: 10px;">
            <div style="font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-muted);">DUEL WIN RATE</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: var(--amber-gold);">${winRate}% <span style="font-size: 0.7rem; font-family: var(--font-mono);">(${summary.wins}W/${summary.losses}L)</span></div>
          </div>
          <div style="background: rgba(217, 70, 239, 0.05); border: 1px solid rgba(217, 70, 239, 0.22); border-radius: 4px; padding: 10px;">
            <div style="font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-muted);">WIN STREAK</div>
            <div style="font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: #d946ef;">${summary.currentWinStreak} <span style="font-size: 0.7rem; font-family: var(--font-mono);">BEST ${summary.bestWinStreak}</span></div>
          </div>
        </div>

        <!-- Match History Table -->
        <div style="background: rgba(4, 7, 16, 0.85); border: 1px solid var(--border-subtle); border-radius: 4px; max-height: 290px; overflow-y: auto;">
          ${
            records.length === 0
              ? `<div style="padding: 36px 20px; text-align: center; font-family: var(--font-mono); font-size: 0.82rem; color: var(--text-muted);">
                   NO MATCH TELEMETRY RECORDED YET. COMPLETE A DUEL OR ZEN SESSION TO LOG DATA.
                 </div>`
              : `<table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.78rem; text-align: left;">
                   <thead style="position: sticky; top: 0; background: #070d1f; z-index: 2;">
                     <tr style="border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: 0.68rem;">
                       <th style="padding: 9px 10px;">TIMESTAMP</th>
                       <th style="padding: 9px 10px;">MODE &amp; RIVAL</th>
                       <th style="padding: 9px 10px;">OUTCOME</th>
                       <th style="padding: 9px 10px;">SPEED (NET / RAW)</th>
                       <th style="padding: 9px 10px;">ACC / COMBO</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${records
                       .map((rec) => {
                         const { dateStr, timeStr } = formatGmt8DateTime(rec.timestampIso);
                         const outcomeBadge =
                           rec.outcome === 'victory'
                             ? `<span style="color: var(--cyan-primary); font-weight: 700;">VICTORY</span>`
                             : rec.outcome === 'defeat'
                             ? `<span style="color: var(--magenta-primary); font-weight: 700;">DEFEAT</span>`
                             : rec.outcome === 'draw'
                             ? `<span style="color: var(--amber-gold); font-weight: 700;">DRAW</span>`
                             : `<span style="color: #00ffaa; font-weight: 700;">ZEN COMPLETE</span>`;
                         const modeLabel =
                           rec.mode === 'solo'
                             ? `SOLO vs ${escapeHtml(rec.opponentName)}`
                             : rec.mode === 'duel'
                             ? `PVP vs ${escapeHtml(rec.opponentName)}`
                             : `ZEN (${escapeHtml(rec.passageTitle)})`;
                         return `
                           <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                             <!-- Strictly two stacked rows inside table cell (DD-MM-YY primary on top, secondary time smaller & greyed out below) -->
                             <td style="padding: 8px 10px;">
                               <div style="display: flex; flex-direction: column; gap: 2px;">
                                 <span style="font-weight: 700; color: var(--text-primary); font-size: 0.78rem;">${dateStr}</span>
                                 <span style="font-size: 0.66rem; color: var(--text-muted);">${timeStr}</span>
                               </div>
                             </td>
                             <td style="padding: 8px 10px; color: var(--text-primary);">${modeLabel}</td>
                             <td style="padding: 8px 10px;">${outcomeBadge}</td>
                             <td style="padding: 8px 10px;">
                               <span style="font-weight: 700; color: var(--cyan-primary);">${rec.wpm} WPM</span>
                               <span style="font-size: 0.68rem; color: var(--text-muted);"> / ${rec.rawWpm} RAW</span>
                             </td>
                             <td style="padding: 8px 10px; color: var(--text-secondary);">
                               ${rec.accuracy}% &bull; <span style="color: var(--amber-gold);">${rec.maxCombo}X</span>
                             </td>
                           </tr>
                         `;
                       })
                       .join('')}
                   </tbody>
                 </table>`
          }
        </div>

        <div class="modal-actions" style="justify-content: space-between; margin-top: 4px;">
          ${
            records.length > 0
              ? `<button id="btn-clear-telemetry" type="button" class="btn-cyber-danger" style="padding: 8px 16px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 6px;">
                   ${ICONS.trash(14)} CLEAR TELEMETRY LOGS
                 </button>`
              : `<div></div>`
          }
          <button id="btn-close-telemetry" type="button" class="btn-cyber-primary" style="padding: 8px 22px; font-size: 0.8rem;">
            DONE
          </button>
        </div>
      </div>
    `;

    const closeTop = this.container.querySelector('#btn-close-telemetry-top');
    const closeBottom = this.container.querySelector('#btn-close-telemetry');
    const clearBtn = this.container.querySelector('#btn-clear-telemetry');

    closeTop?.addEventListener('click', () => this.hide());
    closeBottom?.addEventListener('click', () => this.hide());

    clearBtn?.addEventListener('click', () => {
      this.showConfirm(
        'CLEAR TELEMETRY LOGS',
        'Are you sure you want to permanently delete all saved career telemetry and match history records? This action cannot be undone.',
        () => {
          telemetryStore.clearAllRecords();
          onLogsChanged?.();
          this.showTelemetryModal(onLogsChanged);
        },
        () => {
          this.showTelemetryModal(onLogsChanged);
        },
        'CONFIRM DELETE LOGS'
      );
    });
  }

  public hide(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
  }
}
