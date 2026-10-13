import { soundEngine } from '../audio/soundEngine';

export type ErrorMode = 'allow_errors' | 'strict_errors';

export interface TypingStats {
  wpm: number;
  accuracy: number;
  combo: number;
  maxCombo: number;
  wordsCompleted: number;
  totalWords: number;
  charsTyped: number;
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

  private correctKeystrokes: number = 0;
  private totalKeystrokes: number = 0;
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

  public setWords(words: VecOrArray<string>, errorMode: ErrorMode): void {
    this.words = words;
    this.errorMode = errorMode;
    this.currentWordIndex = 0;
    this.typedBuffer = '';
    this.wordHistory = new Array(words.length).fill('');
    this.wordScored = new Array(words.length).fill(false);
    this.correctKeystrokes = 0;
    this.totalKeystrokes = 0;
    this.startTime = null;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.isOverheated = false;
    this.clearErrorFlash();
    this.isActive = false;
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
    accuracy: 100,
    combo: 0,
    maxCombo: 0,
    wordsCompleted: 0,
    totalWords: 0,
    charsTyped: 0,
  };

  public getStats(): TypingStats {
    const elapsedMinutes = this.startTime ? Math.max((performance.now() - this.startTime) / 60000, 0.01) : 0.01;
    const wpm = Math.round((this.correctKeystrokes / 5) / elapsedMinutes);
    const accuracy = this.totalKeystrokes > 0
      ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
      : 100;

    this.cachedStats.wpm = Math.max(wpm, 0);
    this.cachedStats.accuracy = Math.min(Math.max(accuracy, 0), 100);
    this.cachedStats.combo = this.currentCombo;
    this.cachedStats.maxCombo = this.maxCombo;
    this.cachedStats.wordsCompleted = this.currentWordIndex;
    this.cachedStats.totalWords = this.words.length;
    this.cachedStats.charsTyped = this.correctKeystrokes;

    return this.cachedStats;
  }

  public handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.isActive || this.isOverheated || this.currentWordIndex >= this.words.length) {
      return false;
    }

    if (!this.startTime) {
      this.startTime = performance.now();
    }

    const targetWord = this.words[this.currentWordIndex];

    // Handle Backspace and Ctrl+Backspace (word delete for all modes)
    if (e.key === 'Backspace') {
      const isWordDelete = e.ctrlKey || e.altKey || e.metaKey;

      if (isWordDelete) {
        if (this.typedBuffer.length > 0) {
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
        } else if (this.currentWordIndex > 0) {
          // Empty buffer with word-delete: go back to previous word and clear it
          this.currentWordIndex--;
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
        return false;
      }

      if (this.typedBuffer.length > 0) {
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
      } else if (this.currentWordIndex > 0) {
        // Continuous backspace all the way back across words
        this.currentWordIndex--;
        this.typedBuffer = this.wordHistory[this.currentWordIndex] || '';
        this.clearErrorFlash();
        this.onStateChanged?.();
        return true;
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
    this.wordHistory[this.currentWordIndex] = this.typedBuffer;
    const alreadyScored = this.wordScored[this.currentWordIndex];

    if (isCorrect) {
      if (!alreadyScored) {
        this.wordScored[this.currentWordIndex] = true;
        this.currentCombo++;
        if (this.currentCombo > this.maxCombo) {
          this.maxCombo = this.currentCombo;
        }
      }
    } else {
      this.currentCombo = 0;
    }

    const stats = this.getStats();
    this.onWordCompleted?.(word, this.currentWordIndex, this.currentCombo, stats.wpm, stats.accuracy, isCorrect && !alreadyScored);

    this.currentWordIndex++;
    this.typedBuffer = this.wordHistory[this.currentWordIndex] || '';
    this.clearErrorFlash();
    this.onStateChanged?.();
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
