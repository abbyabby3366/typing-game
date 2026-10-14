export interface CaretStop {
  x: number;
  y: number;
  h: number;
}

export interface WordCaretMeta {
  container: HTMLElement;
  charSpans: HTMLElement[];
  expectedWord: string;
  extraSpans?: HTMLElement[];
}

/**
 * Ultra-smooth, zero-reflow Caret Tracker.
 * - Pre-computes line scroll offsets on initialization (O(1) lookups during typing).
 * - Caches and lookahead-pre-measures character stops per word.
 * - Freezes caret blink into a solid glow during active typing for responsive visual feedback.
 */
export class CaretTracker {
  private caretEl: HTMLElement | null = null;
  private oppCaretEl: HTMLElement | null = null;
  private streamEl: HTMLElement | null = null;
  private stopsCache: Map<number, CaretStop[]> = new Map();
  private wordMetas: WordCaretMeta[] = [];
  private wordLineScrolls: number[] = [];
  private typingTimer: number | null = null;
  private lastOppWordIdx: number = -1;
  private lastOppCharIdx: number = 0;

  public init(
    caretEl: HTMLElement,
    streamEl: HTMLElement,
    wordMetas: WordCaretMeta[],
    oppCaretEl: HTMLElement | null = null
  ): void {
    this.caretEl = caretEl;
    this.oppCaretEl = oppCaretEl;
    this.streamEl = streamEl;
    this.wordMetas = wordMetas;
    this.stopsCache.clear();
    this.wordLineScrolls = [];
    this.lastOppWordIdx = -1;
    this.lastOppCharIdx = 0;

    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    this.caretEl.classList.remove('caret-typing');
    if (this.oppCaretEl) {
      this.oppCaretEl.style.opacity = '0';
    }

    this.precomputeLineScrolls();

    // Warm up the first two words so the start of match has 0ms measurement overhead
    if (wordMetas.length > 0) {
      this.measureWordStops(0);
      if (wordMetas.length > 1) {
        this.measureWordStops(1);
      }
    }
  }

  public invalidateCache(): void {
    this.stopsCache.clear();
    this.precomputeLineScrolls();
    if (this.lastOppWordIdx >= 0) {
      this.updateOpponent(this.lastOppWordIdx, this.lastOppCharIdx);
    }
  }

  private precomputeLineScrolls(): void {
    if (!this.streamEl || this.wordMetas.length === 0) {
      this.wordLineScrolls = [];
      return;
    }

    const firstTop = this.wordMetas[0].container.offsetTop;
    const lineHeight = this.wordMetas[0].container.offsetHeight || 35;

    this.wordLineScrolls = this.wordMetas.map((wm) => {
      const lineDiff = wm.container.offsetTop - firstTop;
      const lineIndex = Math.round(lineDiff / lineHeight);
      return lineIndex >= 2 ? Math.round((lineIndex - 1) * lineHeight) : 0;
    });
  }

  /**
   * Measures caret stops for a specific word once using vectorized getBoundingClientRect.
   * Coordinates are stored relative to the stream container's scroll content.
   */
  private measureWordStops(wordIdx: number): CaretStop[] {
    if (!this.streamEl || wordIdx >= this.wordMetas.length) return [];
    const meta = this.wordMetas[wordIdx];
    const charCount = meta.charSpans.length;
    if (charCount === 0) return [];

    const streamRect = this.streamEl.getBoundingClientRect();
    const scrollTop = this.streamEl.scrollTop;
    const scrollLeft = this.streamEl.scrollLeft;

    const stops: CaretStop[] = new Array(charCount + 1);

    for (let i = 0; i < charCount; i++) {
      const spanRect = meta.charSpans[i].getBoundingClientRect();
      stops[i] = {
        x: spanRect.left - streamRect.left + scrollLeft,
        y: spanRect.top - streamRect.top + scrollTop + 4,
        h: Math.max(18, spanRect.height - 8),
      };
    }

    // Trailing stop right after the last character of the word
    const lastRect = meta.charSpans[charCount - 1].getBoundingClientRect();
    stops[charCount] = {
      x: lastRect.right - streamRect.left + scrollLeft,
      y: lastRect.top - streamRect.top + scrollTop + 4,
      h: Math.max(18, lastRect.height - 8),
    };

    this.stopsCache.set(wordIdx, stops);
    return stops;
  }

  /**
   * O(1) integer line scroll lookup - zero DOM layout reads.
   */
  public getLineScrollOffset(wordIdx: number): { targetScroll: number } {
    if (wordIdx < this.wordLineScrolls.length) {
      return { targetScroll: this.wordLineScrolls[wordIdx] };
    }
    return { targetScroll: 0 };
  }

  /**
   * Repositions floating smooth caret with zero DOM reads on warm stops.
   */
  public update(wordIdx: number, bufferLength: number, errorFlash: boolean): void {
    if (!this.caretEl || this.wordMetas.length === 0) return;

    if (wordIdx >= this.wordMetas.length) {
      this.caretEl.style.opacity = '0';
      return;
    }

    // Maintain solid illuminated caret while actively typing (pauses blink)
    this.caretEl.classList.add('caret-typing');
    if (this.typingTimer !== null) clearTimeout(this.typingTimer);
    this.typingTimer = window.setTimeout(() => {
      this.caretEl?.classList.remove('caret-typing');
      this.typingTimer = null;
    }, 450);

    let stops = this.stopsCache.get(wordIdx);
    if (!stops) {
      stops = this.measureWordStops(wordIdx);
    }

    // Lookahead pre-caching: measure next word so spacebar transition is 100% cache hit
    if (wordIdx + 1 < this.wordMetas.length && !this.stopsCache.has(wordIdx + 1)) {
      this.measureWordStops(wordIdx + 1);
    }

    const charCount = this.wordMetas[wordIdx].charSpans.length;
    if (bufferLength <= charCount) {
      const stopIndex = Math.min(bufferLength, charCount);
      const stop = stops[stopIndex];
      if (!stop) return;

      this.caretEl.style.transform = `translate3d(${stop.x}px, ${stop.y}px, 0)`;
      this.caretEl.style.height = `${stop.h}px`;
      this.caretEl.style.opacity = '1';
    } else {
      const meta = this.wordMetas[wordIdx];
      const extra = meta.extraSpans;
      if (extra && extra.length > 0 && this.streamEl) {
        const lastExtra = extra[extra.length - 1];
        const spanRect = lastExtra.getBoundingClientRect();
        const streamRect = this.streamEl.getBoundingClientRect();
        const scrollTop = this.streamEl.scrollTop;
        const scrollLeft = this.streamEl.scrollLeft;
        const x = spanRect.right - streamRect.left + scrollLeft;
        const y = spanRect.top - streamRect.top + scrollTop + 4;
        const h = Math.max(18, spanRect.height - 8);
        this.caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        this.caretEl.style.height = `${h}px`;
        this.caretEl.style.opacity = '1';
      } else {
        const stop = stops[charCount];
        if (stop) {
          this.caretEl.style.transform = `translate3d(${stop.x}px, ${stop.y}px, 0)`;
          this.caretEl.style.height = `${stop.h}px`;
          this.caretEl.style.opacity = '1';
        }
      }
    }

    if (errorFlash) {
      this.caretEl.classList.add('caret-flash');
    } else {
      this.caretEl.classList.remove('caret-flash');
    }
  }

  /**
   * Repositions the rival/AI ghost caret at the opponent's live word and character index.
   */
  public updateOpponent(wordIdx: number, charIdx: number): void {
    if (!this.oppCaretEl || this.wordMetas.length === 0) return;

    if (this.lastOppWordIdx !== wordIdx) {
      if (this.lastOppWordIdx >= 0 && this.lastOppWordIdx < this.wordMetas.length) {
        this.wordMetas[this.lastOppWordIdx].container.classList.remove('opp-current-word');
      }
      this.lastOppWordIdx = wordIdx;
      if (wordIdx >= 0 && wordIdx < this.wordMetas.length) {
        this.wordMetas[wordIdx].container.classList.add('opp-current-word');
      }
    }
    this.lastOppCharIdx = charIdx;

    if (wordIdx < 0 || wordIdx >= this.wordMetas.length) {
      this.oppCaretEl.style.opacity = '0';
      return;
    }

    let stops = this.stopsCache.get(wordIdx);
    if (!stops) {
      stops = this.measureWordStops(wordIdx);
    }

    const charCount = this.wordMetas[wordIdx].charSpans.length;
    const clampedChar = Math.max(0, Math.min(charIdx, charCount));
    const stop = stops[clampedChar];
    if (!stop) return;

    this.oppCaretEl.style.transform = `translate3d(${stop.x}px, ${stop.y}px, 0)`;
    this.oppCaretEl.style.height = `${stop.h}px`;
    this.oppCaretEl.style.opacity = '0.88';
  }

  public hide(): void {
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    if (this.caretEl) {
      this.caretEl.classList.remove('caret-typing');
      this.caretEl.style.opacity = '0';
    }
    if (this.oppCaretEl) {
      this.oppCaretEl.style.opacity = '0';
    }
  }
}

