export type MatchMode = 'solo' | 'duel' | 'zen';
export type MatchOutcome = 'victory' | 'defeat' | 'draw' | 'completed';

export interface MatchTelemetryRecord {
  id: string;
  timestampIso: string; // Full ISO 8601 datetime persisted per global rule
  mode: MatchMode;
  outcome: MatchOutcome;
  opponentName: string;
  passageTitle: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  maxCombo: number;
  wordsCompleted: number;
  errorMode: 'allow_errors' | 'strict_errors';
}

export interface CareerTelemetrySummary {
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  zenSessions: number;
  currentWinStreak: number;
  bestWinStreak: number;
  totalWordsTyped: number;
}

const STORAGE_KEY = 'cyber_clash_telemetry_v1';
const MAX_STORED_RECORDS = 50;

/**
 * Formats an ISO 8601 datetime string into GMT+8 (Malaysia Time / Asia/Kuala_Lumpur)
 * strictly as DD-MM-YY and HH:MM:SS.
 */
export function formatGmt8DateTime(isoDatetime?: string): { dateStr: string; timeStr: string; iso: string } {
  const parsed = isoDatetime ? new Date(isoDatetime) : new Date();
  const baseDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  // Shift UTC epoch by +8 hours and read UTC fields directly (immune to host OS timezone/DST)
  const gmt8 = new Date(baseDate.getTime() + 8 * 3600000);

  const dd = String(gmt8.getUTCDate()).padStart(2, '0');
  const mm = String(gmt8.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(gmt8.getUTCFullYear()).slice(-2);
  const dateStr = `${dd}-${mm}-${yy}`;

  const hh = String(gmt8.getUTCHours()).padStart(2, '0');
  const min = String(gmt8.getUTCMinutes()).padStart(2, '0');
  const ss = String(gmt8.getUTCSeconds()).padStart(2, '0');
  const timeStr = `${hh}:${min}:${ss} GMT+8`;

  return {
    dateStr,
    timeStr,
    iso: baseDate.toISOString(),
  };
}

class TelemetryStore {
  private records: MatchTelemetryRecord[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.records = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        console.warn('[TelemetryStore] Corrupted telemetry array in storage, resetting.');
        this.records = [];
        return;
      }
      this.records = parsed.filter(
        (item): item is MatchTelemetryRecord =>
          item &&
          typeof item.id === 'string' &&
          typeof item.timestampIso === 'string' &&
          typeof item.wpm === 'number' &&
          typeof item.accuracy === 'number'
      );
    } catch (err) {
      console.warn('[TelemetryStore] Failed to parse stored telemetry:', err);
      this.records = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (err) {
      console.warn('[TelemetryStore] Failed to persist telemetry:', err);
    }
    this.listeners.forEach((cb) => cb());
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getRecords(): ReadonlyArray<MatchTelemetryRecord> {
    return this.records;
  }

  public recordMatch(input: Omit<MatchTelemetryRecord, 'id' | 'timestampIso'>): {
    record: MatchTelemetryRecord;
    isNewPersonalBest: boolean;
  } {
    const previousBest = this.records.reduce((max, r) => (r.wpm > max ? r.wpm : max), 0);
    const roundedWpm = Math.round(input.wpm);
    const isNewPersonalBest = roundedWpm > 0 && roundedWpm > previousBest;

    const record: MatchTelemetryRecord = {
      ...input,
      wpm: roundedWpm,
      rawWpm: Math.round(input.rawWpm),
      accuracy: Math.round(input.accuracy),
      id: `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestampIso: new Date().toISOString(),
    };

    this.records.unshift(record);
    if (this.records.length > MAX_STORED_RECORDS) {
      this.records.length = MAX_STORED_RECORDS;
    }
    this.save();

    return { record, isNewPersonalBest };
  }

  public clearAllRecords(): void {
    this.records = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[TelemetryStore] Failed to clear storage:', err);
    }
    this.listeners.forEach((cb) => cb());
  }

  public getSummary(): CareerTelemetrySummary {
    const totalMatches = this.records.length;
    if (totalMatches === 0) {
      return {
        bestWpm: 0,
        avgWpm: 0,
        avgAccuracy: 100,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        zenSessions: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
        totalWordsTyped: 0,
      };
    }

    let bestWpm = 0;
    let sumWpm = 0;
    let sumAcc = 0;
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let zenSessions = 0;
    let totalWordsTyped = 0;

    for (const r of this.records) {
      if (r.wpm > bestWpm) bestWpm = r.wpm;
      sumWpm += r.wpm;
      sumAcc += r.accuracy;
      totalWordsTyped += r.wordsCompleted;

      if (r.outcome === 'victory') wins++;
      else if (r.outcome === 'defeat') losses++;
      else if (r.outcome === 'draw') draws++;
      else if (r.outcome === 'completed') zenSessions++;
    }

    // Calculate win streaks across competitive matches (oldest to newest)
    let currentWinStreak = 0;
    let bestWinStreak = 0;
    for (let i = this.records.length - 1; i >= 0; i--) {
      const r = this.records[i];
      if (r.mode === 'zen') continue;
      if (r.outcome === 'victory') {
        currentWinStreak++;
        if (currentWinStreak > bestWinStreak) bestWinStreak = currentWinStreak;
      } else {
        currentWinStreak = 0;
      }
    }

    return {
      bestWpm,
      avgWpm: Math.round(sumWpm / totalMatches),
      avgAccuracy: Math.round(sumAcc / totalMatches),
      totalMatches,
      wins,
      losses,
      draws,
      zenSessions,
      currentWinStreak,
      bestWinStreak,
      totalWordsTyped,
    };
  }
}

export const telemetryStore = new TelemetryStore();
