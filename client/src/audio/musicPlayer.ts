// Dedicated Music Player Engine for Lyrics Mode
// Handles track loading, previewing, live match playback, and volume control

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private currentTrackTitle: string = '';
  private currentTrackArtist: string = '';
  private volume: number = 0.65;
  private isPreviewing: boolean = false;
  private previewTimeout: number | null = null;
  private customObjectUrl: string | null = null;
  private stateListeners: Set<(isPlaying: boolean, trackTitle: string) => void> = new Set();

  public onTimeUpdate?: (currentTime: number, duration: number) => void;
  public onStateChange?: (isPlaying: boolean, trackTitle: string) => void;
  public onTrackEnded?: () => void;
  public onError?: (message: string) => void;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = this.volume;

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio) {
        this.onTimeUpdate?.(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isPreviewing = false;
      this.onTrackEnded?.();
      this.emitStateChange(false, this.currentTrackTitle);
    });

    this.audio.addEventListener('play', () => {
      this.emitStateChange(true, this.currentTrackTitle);
    });

    this.audio.addEventListener('pause', () => {
      this.emitStateChange(false, this.currentTrackTitle);
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('Audio playback error:', e);
      this.emitStateChange(false, this.currentTrackTitle);
      if (this.currentUrl) {
        this.onError?.(`Unable to load audio track "${this.currentTrackTitle || 'Selected Track'}"`);
      }
    });
  }

  private emitStateChange(isPlaying: boolean, trackTitle: string): void {
    this.onStateChange?.(isPlaying, trackTitle);
    this.stateListeners.forEach((cb) => cb(isPlaying, trackTitle));
  }

  public subscribeStateChange(cb: (isPlaying: boolean, trackTitle: string) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public loadTrack(url: string, title: string = '', artist: string = ''): void {
    if (this.currentUrl === url && this.audio) {
      return;
    }
    this.stop();
    this.currentUrl = url;
    this.currentTrackTitle = title;
    this.currentTrackArtist = artist;

    if (this.audio) {
      this.audio.src = url;
      this.audio.currentTime = 0;
      this.audio.load();
    }
  }

  public loadCustomFile(file: File, title: string = file.name): string {
    this.revokeCustomFile();
    const objectUrl = URL.createObjectURL(file);
    this.customObjectUrl = objectUrl;
    this.loadTrack(objectUrl, title, 'Custom Upload');
    return objectUrl;
  }

  public revokeCustomFile(): void {
    if (this.customObjectUrl) {
      if (this.currentUrl === this.customObjectUrl) {
        this.stop();
        this.currentUrl = null;
      }
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }
  }

  public play(fromStart: boolean = false): void {
    if (!this.audio || !this.currentUrl) return;

    if (fromStart) {
      this.audio.currentTime = 0;
    }

    this.audio.play().catch((err) => {
      console.warn('Audio play prevented or interrupted:', err);
    });
  }

  public pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  public stop(): void {
    if (this.previewTimeout !== null) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
    this.isPreviewing = false;
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.emitStateChange(false, this.currentTrackTitle);
  }

  public stopPreview(): void {
    if (this.isPreviewing) {
      this.stop();
    }
  }

  public togglePreview(url: string, title: string, artist: string = ''): boolean {
    if (this.isPreviewing && this.currentUrl === url) {
      this.stop();
      return false;
    }

    this.loadTrack(url, title, artist);
    this.isPreviewing = true;
    this.play(true);

    if (this.previewTimeout !== null) {
      clearTimeout(this.previewTimeout);
    }
    // Auto-stop preview after 15 seconds
    this.previewTimeout = window.setTimeout(() => {
      if (this.isPreviewing) {
        this.stop();
      }
    }, 15000);

    return true;
  }

  public isCurrentlyPreviewing(url: string): boolean {
    return this.isPreviewing && this.currentUrl === url;
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public isPlaying(): boolean {
    return !!(this.audio && !this.audio.paused && !this.audio.ended && this.audio.readyState > 2);
  }

  public getCurrentTime(): number {
    return this.audio ? this.audio.currentTime : 0;
  }

  public getDuration(): number {
    return this.audio ? this.audio.duration || 0 : 0;
  }

  public getTrackInfo(): { title: string; artist: string; url: string | null } {
    return {
      title: this.currentTrackTitle,
      artist: this.currentTrackArtist,
      url: this.currentUrl,
    };
  }
}

export const musicPlayer = new MusicPlayer();
