import { soundEngine } from '../audio/soundEngine';

export type ErrorMode = 'allow_errors' | 'strict_errors';

export interface TypingStats {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  combo: number;
  maxCombo: number;
  wordsCompleted: number;
  totalWords: number;
  charsTyped: number;
  typoCount: number;
}

export class TypingEngine {
  public words: string[] = [];
  public currentWordIndex: number = 0;
  public typedBuffer: string = '';
  public errorMode: ErrorMode = 'allow_errors';
  public isOverheated: boolean = false;
  // True briefly after a wrong keypress so the HUD can flash the expected char red
  public errorFlash: boolean = false;
  private errorFlashTimer: number | null = null;

  public wordHistory: string[] = [];
  public wordScored: boolean[] = [];
  public requireHalfScoredToFinish: boolean = true;

  private correctKeystrokes: number = 0;
  private totalKeystrokes: number = 0;
  private typoCount: number = 0;
  private startTime: number | null = null;
  public currentCombo: number = 0;
  public maxCombo: number = 0;
  public isActive: boolean = false;

  public onWordCompleted?: (word: string, index: number, combo: number, wpm: number, accuracy: number, isCorrect: boolean) => void;
  public onTypoPenalized?: (comboLost: number) => void;
  public onStateChanged?: () => void;

  constructor(errorMode: ErrorMode = 'allow_errors') {
    this.errorMode = errorMode;
  }

  public setWords(
    words: VecOrArray<string>,
    errorMode: ErrorMode,
    requireHalfScoredToFinish: boolean = true
  ): void {
    this.words = words;
    this.errorMode = errorMode;
    this.requireHalfScoredToFinish = requireHalfScoredToFinish;
    this.currentWordIndex = 0;
    this.typedBuffer = '';
    this.wordHistory = new Array(words.length).fill('');
    this.wordScored = new Array(words.length).fill(false);
    this.correctKeystrokes = 0;
    this.totalKeystrokes = 0;
    this.typoCount = 0;
    this.startTime = null;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.isOverheated = false;
    this.clearErrorFlash();
    this.isActive = false;
  }

  public getScoredWordCount(): number {
    let count = 0;
    for (let i = 0; i < this.wordScored.length; i++) {
      if (this.wordScored[i]) count++;
    }
    return count;
  }

  private findPreviousUnscoredWordIndex(fromIndex: number): number {
    const start = Math.min(fromIndex - 1, this.words.length - 1);
    for (let i = start; i >= 0; i--) {
      if (!this.wordScored[i]) {
        return i;
      }
    }
    return -1;
  }

  public start(): void {
    this.isActive = true;
    this.startTime = performance.now();
  }

  public stop(): void {
    this.isActive = false;
  }

  private cachedStats: TypingStats = {
    wpm: 0,
    rawWpm: 0,
    accuracy: 100,
    combo: 0,
    maxCombo: 0,
    wordsCompleted: 0,
    totalWords: 0,
    charsTyped: 0,
    typoCount: 0,
  };

  public getStats(): TypingStats {
    const elapsedMinutes = this.startTime ? Math.max((performance.now() - this.startTime) / 60000, 0.01) : 0.01;
    const wpm = Math.round((this.correctKeystrokes / 5) / elapsedMinutes);
    const rawWpm = Math.round((this.totalKeystrokes / 5) / elapsedMinutes);
    const accuracy = this.totalKeystrokes > 0
      ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
      : 100;

    this.cachedStats.wpm = Math.max(wpm, 0);
    this.cachedStats.rawWpm = Math.max(rawWpm, this.cachedStats.wpm);
    this.cachedStats.accuracy = Math.min(Math.max(accuracy, 0), 100);
    this.cachedStats.combo = this.currentCombo;
    this.cachedStats.maxCombo = this.maxCombo;
    this.cachedStats.wordsCompleted = this.getScoredWordCount();
    this.cachedStats.totalWords = this.words.length;
    this.cachedStats.charsTyped = this.correctKeystrokes;
    this.cachedStats.typoCount = this.typoCount;

    return this.cachedStats;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isActive || this.isOverheated || this.words.length === 0) {
      return false;
    }

    if (this.currentWordIndex >= this.words.length && e.key !== 'Backspace') {
      return false;
    }

    if (!this.startTime) {
      this.startTime = performance.now();
    }

    const targetWord = this.words[this.currentWordIndex] ?? '';

    // Handle Backspace and Ctrl+Backspace (word delete for all modes)
    if (e.key === 'Backspace') {
      const isWordDelete = e.ctrlKey || e.altKey || e.metaKey;

      if (isWordDelete) {
        if (this.typedBuffer.length > 0 && this.currentWordIndex < this.words.length) {
          for (let i = 0; i < this.typedBuffer.length; i++) {
            if (i < targetWord.length && this.typedBuffer[i] === targetWord[i]) {
              this.correctKeystrokes = Math.max(0, this.correctKeystrokes - 1);
            }
          }
          this.typedBuffer = '';
          this.wordHistory[this.currentWordIndex] = '';
          this.clearErrorFlash();
          this.onStateChanged?.();
          return true;
        } else {
          const prevIdx = this.findPreviousUnscoredWordIndex(this.currentWordIndex);
          if (prevIdx >= 0) {
            this.currentWordIndex = prevIdx;
            const prevTarget = this.words[this.currentWordIndex];
            const prevTyped = this.wordHistory[this.currentWordIndex] || '';
            for (let i = 0; i < prevTyped.length; i++) {
              if (i < prevTarget.length && prevTyped[i] === prevTarget[i]) {
                this.correctKeystrokes = Math.max(0, this.correctKeystrokes - 1);
              }
            }
            this.typedBuffer = '';
            this.wordHistory[this.currentWordIndex] = '';
            this.clearErrorFlash();
            this.onStateChanged?.();
            return true;
          }
        }
        return false;
      }

      if (this.typedBuffer.length > 0 && this.currentWordIndex < this.words.length) {
        const charIdx = this.typedBuffer.length - 1;
        const removedChar = this.typedBuffer[charIdx];
        if (charIdx < targetWord.length && removedChar === targetWord[charIdx]) {
          this.correctKeystrokes = Math.max(0, this.correctKeystrokes - 1);
        }
        this.typedBuffer = this.typedBuffer.slice(0, -1);
        this.wordHistory[this.currentWordIndex] = this.typedBuffer;
        this.clearErrorFlash();
        this.onStateChanged?.();
        return true;
      } else {
        const prevIdx = this.findPreviousUnscoredWordIndex(this.currentWordIndex);
        if (prevIdx >= 0) {
          // Step back into the most recent mistyped/unscored word (never un-typing an already scored word)
          this.currentWordIndex = prevIdx;
          this.typedBuffer = this.wordHistory[this.currentWordIndex] || '';
          this.clearErrorFlash();
          this.onStateChanged?.();
          return true;
        }
      }
      return false;
    }

    // Ignore non-printable keys
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return false;
    }

    const char = e.key;
    this.totalKeystrokes++;

    // Space key: advances to next word
    if (char === ' ') {
      // Correct word completion in both modes
      if (this.typedBuffer === targetWord) {
        this.correctKeystrokes++; // Count word-completing space
        soundEngine.playKeystroke(false);
        this.completeWord(targetWord, true);
        return true;
      }

      // Strict mode: cannot advance past a wrong word; must backspace or ctrl+backspace to fix
      if (this.errorMode === 'strict_errors') {
        this.registerWrongKey();
        return true;
      } else {
        // Allow Errors mode: allow users to continue to type without locking
        if (this.typedBuffer.length > 0) {
          this.typoCount++;
          soundEngine.playKeystroke(true);
          this.completeWord(targetWord, false);
          return true;
        } else {
          this.registerWrongKey();
          return true;
        }
      }
    }

    const nextCharIndex = this.typedBuffer.length;

    if (nextCharIndex < targetWord.length) {
      const expectedChar = targetWord[nextCharIndex];
      const isCorrect = char === expectedChar;

      this.typedBuffer += char;
      this.wordHistory[this.currentWordIndex] = this.typedBuffer;

      if (isCorrect) {
        this.correctKeystrokes++;
        soundEngine.playKeystroke(false);
        this.clearErrorFlash();

        // Auto-complete the final word (or final remaining unscored word) when its last char is typed
        if (this.typedBuffer === targetWord) {
          const newScoredCount = this.getScoredWordCount() + (this.wordScored[this.currentWordIndex] ? 0 : 1);
          const isLastWord = this.currentWordIndex === this.words.length - 1;
          const allOthersScored = newScoredCount === this.words.length;
          const meetsHalfThreshold = !this.requireHalfScoredToFinish || newScoredCount * 2 >= this.words.length;
          if ((isLastWord && meetsHalfThreshold) || allOthersScored) {
            this.completeWord(targetWord, true);
            return true;
          }
        }
      } else {
        this.registerWrongKey(false);
      }
    } else {
      // Allow extra overflow characters (up to 25 extra chars) so typing never locks up
      if (this.typedBuffer.length < targetWord.length + 25) {
        this.typedBuffer += char;
        this.wordHistory[this.currentWordIndex] = this.typedBuffer;
        this.registerWrongKey(false);
      }
    }

    this.onStateChanged?.();
    return true;
  }

  private completeWord(word: string, isCorrect: boolean = true): void {
    const completedIndex = this.currentWordIndex;
    this.wordHistory[completedIndex] = this.typedBuffer;
    const alreadyScored = this.wordScored[completedIndex];

    if (isCorrect) {
      if (!alreadyScored) {
        this.wordScored[completedIndex] = true;
        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
          this.maxCombo = this.currentCombo;
        }
      }
    } else {
      this.currentCombo = 0;
    }

    let nextIdx = completedIndex + 1;
    while (nextIdx < this.words.length && this.wordScored[nextIdx]) {
      nextIdx++;
    }

    // In competitive modes, if the player reaches the end of the passage with <50% words scored,
    // wrap back to the first unscored word so the keyboard never locks and they can finish scoring.
    if (
      nextIdx >= this.words.length &&
      this.requireHalfScoredToFinish &&
      this.getScoredWordCount() * 2 < this.words.length
    ) {
      const firstUnscored = this.wordScored.indexOf(false);
      if (firstUnscored >= 0) {
        nextIdx = firstUnscored;
        this.wordHistory[nextIdx] = '';
      }
    }

    this.currentWordIndex = nextIdx;
    this.typedBuffer = this.wordHistory[this.currentWordIndex] || '';
    this.clearErrorFlash();
    this.onStateChanged?.();

    const stats = this.getStats();
    this.onWordCompleted?.(word, completedIndex, this.currentCombo, stats.wpm, stats.accuracy, isCorrect && !alreadyScored);
  }

  private clearErrorFlash(): void {
    if (this.errorFlashTimer !== null) {
      clearTimeout(this.errorFlashTimer);
      this.errorFlashTimer = null;
    }
    this.errorFlash = false;
  }

  // Wrong keypress: drop combo and flash red. Never resets or locks the word.
  private registerWrongKey(notify: boolean = true): void {
    this.typoCount++;
    const lost = this.currentCombo;
    this.currentCombo = 0;
    soundEngine.playKeystroke(true);
    if (lost > 0) this.onTypoPenalized?.(lost);

    this.errorFlash = true;
    if (this.errorFlashTimer !== null) clearTimeout(this.errorFlashTimer);
    this.errorFlashTimer = window.setTimeout(() => {
      this.errorFlash = false;
      this.errorFlashTimer = null;
      this.onStateChanged?.();
    }, 220);

    if (notify) this.onStateChanged?.();
  }
}

type VecOrArray<T> = T[];
