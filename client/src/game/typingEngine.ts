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

  public onWordCompleted?: (word: string, index: number, combo: number, wpm: number, accuracy: number) => void;
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

    // Handle Backspace
    if (e.key === 'Backspace') {
      if (this.errorMode === 'allow_errors' && this.typedBuffer.length > 0) {
        this.typedBuffer = this.typedBuffer.slice(0, -1);
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

    // Space advances to next word only if the current word is fully correct
    if (char === ' ') {
      if (this.typedBuffer === targetWord) {
        this.completeWord(targetWord);
      } else {
        this.registerWrongKey();
      }
      return true;
    }

    const nextCharIndex = this.typedBuffer.length;

    // Buffer can never grow past the word length (prevents display drift)
    if (nextCharIndex >= targetWord.length) {
      this.registerWrongKey();
      return true;
    }

    const expectedChar = targetWord[nextCharIndex];
    const isCorrect = char === expectedChar;

    if (this.errorMode === 'strict_errors') {
      if (isCorrect) {
        this.typedBuffer += char;
        this.correctKeystrokes++;
        soundEngine.playKeystroke(false);
        this.clearErrorFlash();
      } else {
        // Wrong key ignored: word progress is kept, must type the right char to advance
        this.registerWrongKey();
        return true;
      }
    } else {
      // Allow Errors: wrong char is kept in buffer (shown as red expected char), backspace to fix
      this.typedBuffer += char;
      if (isCorrect) {
        this.correctKeystrokes++;
        soundEngine.playKeystroke(false);
      } else {
        this.registerWrongKey(false);
      }
    }

    // Never auto-complete: the player must press space to advance to the next word
    this.onStateChanged?.();
    return true;
  }

  private completeWord(word: string): void {
    this.currentCombo++;
    if (this.currentCombo > this.maxCombo) {
      this.maxCombo = this.currentCombo;
    }

    const stats = this.getStats();
    this.onWordCompleted?.(word, this.currentWordIndex, this.currentCombo, stats.wpm, stats.accuracy);

    this.currentWordIndex++;
    this.typedBuffer = '';
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
