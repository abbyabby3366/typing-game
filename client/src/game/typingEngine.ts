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

  public getStats(): TypingStats {
    const elapsedMinutes = this.startTime ? Math.max((performance.now() - this.startTime) / 60000, 0.01) : 0.01;
    const wpm = Math.round((this.correctKeystrokes / 5) / elapsedMinutes);
    const accuracy = this.totalKeystrokes > 0
      ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
      : 100;

    return {
      wpm: Math.max(wpm, 0),
      accuracy: Math.min(Math.max(accuracy, 0), 100),
      combo: this.currentCombo,
      maxCombo: this.maxCombo,
      wordsCompleted: this.currentWordIndex,
      totalWords: this.words.length,
      charsTyped: this.correctKeystrokes,
    };
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
          this.typedBuffer = '';
          this.clearErrorFlash();
          soundEngine.playKeystroke(false);
          this.onStateChanged?.();
          return true;
        }
        return false;
      }

      if (this.typedBuffer.length > 0) {
        this.typedBuffer = this.typedBuffer.slice(0, -1);
        this.clearErrorFlash();
        soundEngine.playKeystroke(false);
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
        // Allow Errors mode: allow users to continue to type!
        // The wrong word won't send any damage, only correct words send damage
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

    // Buffer can never grow past the word length (prevents display drift)
    if (nextCharIndex >= targetWord.length) {
      this.registerWrongKey();
      return true;
    }

    const expectedChar = targetWord[nextCharIndex];
    const isCorrect = char === expectedChar;

    // In BOTH modes: allow typing characters into buffer so typos are highlighted in red
    this.typedBuffer += char;
    if (isCorrect) {
      this.correctKeystrokes++;
      soundEngine.playKeystroke(false);
      this.clearErrorFlash();
    } else {
      this.registerWrongKey(false);
    }

    // Never auto-complete: the player must press space to advance to the next word
    this.onStateChanged?.();
    return true;
  }

  private completeWord(word: string, isCorrect: boolean = true): void {
    if (isCorrect) {
      this.currentCombo++;
      if (this.currentCombo > this.maxCombo) {
        this.maxCombo = this.currentCombo;
      }
    } else {
      this.currentCombo = 0;
    }

    const stats = this.getStats();
    this.onWordCompleted?.(word, this.currentWordIndex, this.currentCombo, stats.wpm, stats.accuracy, isCorrect);

    this.currentWordIndex++;
    this.typedBuffer = '';
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
