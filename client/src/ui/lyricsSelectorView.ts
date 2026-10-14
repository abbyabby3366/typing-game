import { SONG_CATALOG, SongTrack } from '../game/songCatalog';
import { musicPlayer } from '../audio/musicPlayer';
import { soundEngine } from '../audio/soundEngine';
import { ICONS } from './icons';
import { escapeHtml } from './escapeHtml';

export class LyricsSelectorView {
  private container: HTMLElement | null;
  private selectedSong: SongTrack = SONG_CATALOG.find((s) => s.id === 'never_gonna_give_you_up') || SONG_CATALOG[0];
  private activeFilter: 'ALL' | 'CHILL' | 'MODERATE' | 'BRISK' | 'INTENSE' = 'ALL';
  private customSong: SongTrack | null = null;
  private confirmingRemoveCustom: boolean = false;
  private unsubscribeMusicState: (() => void) | null = null;
  public onSongSelected?: (song: SongTrack) => void;

  constructor(container: HTMLElement | null) {
    this.container = container;

    // Subscribe to audio player state changes and auto-dispose if container is detached
    this.unsubscribeMusicState = musicPlayer.subscribeStateChange((isPlaying, title) => {
      if (this.container && !this.container.isConnected) {
        this.unsubscribeMusicState?.();
        this.unsubscribeMusicState = null;
        return;
      }
      this.updatePreviewButtons(isPlaying, title);
    });
  }

  public getSelectedSong(): SongTrack {
    return this.selectedSong;
  }

  public setSelectedSong(songId: string): void {
    const found = SONG_CATALOG.find((s) => s.id === songId);
    if (found) {
      this.selectedSong = found;
      this.render();
      this.onSongSelected?.(found);
    }
  }

  public syncSongByLyrics(lyricsText?: string | null): SongTrack {
    if (lyricsText) {
      const trimmed = lyricsText.trim();
      const found = SONG_CATALOG.find((s) => s.lyrics.trim() === trimmed);
      if (found) {
        this.selectedSong = found;
      }
    }
    return this.selectedSong;
  }

  private filterSongs(): SongTrack[] {
    const all = this.customSong ? [this.customSong, ...SONG_CATALOG] : SONG_CATALOG;
    if (this.activeFilter === 'ALL') return all;
    return all.filter((s) => s.difficultyBadge === this.activeFilter);
  }

  public render(): void {
    if (!this.container) return;
    const filtered = this.filterSongs();
    const chillCount = SONG_CATALOG.filter((s) => s.difficultyBadge === 'CHILL').length;
    const modCount = SONG_CATALOG.filter((s) => s.difficultyBadge === 'MODERATE').length;
    const briskCount = SONG_CATALOG.filter((s) => s.difficultyBadge === 'BRISK').length;
    const intenseCount = SONG_CATALOG.filter((s) => s.difficultyBadge === 'INTENSE').length;
    const totalCount = SONG_CATALOG.length + (this.customSong ? 1 : 0);

    this.container.innerHTML = `
      <div class="lyrics-container">
        <!-- Header & Difficulty Filter Tabs -->
        <div class="lyrics-header-row">
          <div class="lyrics-title-tag">
            <span style="display: flex; align-items: center;">${ICONS.music(14)}</span>
            <span>SONG CATALOG (${totalCount} TRACKS)</span>
          </div>
          <div class="lyrics-wpm-filters">
            <button type="button" class="wpm-filter-btn ${this.activeFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">
              ALL (${totalCount})
            </button>
            <button type="button" class="wpm-filter-btn ${this.activeFilter === 'CHILL' ? 'active' : ''}" data-filter="CHILL">
              CHILL &lt;60 (${chillCount})
            </button>
            <button type="button" class="wpm-filter-btn ${this.activeFilter === 'MODERATE' ? 'active' : ''}" data-filter="MODERATE">
              MODERATE 60-79 (${modCount})
            </button>
            <button type="button" class="wpm-filter-btn ${this.activeFilter === 'BRISK' ? 'active' : ''}" data-filter="BRISK">
              BRISK 80-95 (${briskCount})
            </button>
            <button type="button" class="wpm-filter-btn ${this.activeFilter === 'INTENSE' ? 'active' : ''}" data-filter="INTENSE">
              INTENSE 96+ (${intenseCount})
            </button>
          </div>
        </div>

        <!-- Scrollable Song Cards Grid -->
        <div class="song-cards-grid">
          ${filtered
            .map((song) => {
              const isSelected = this.selectedSong.id === song.id;
              const isPreviewing = musicPlayer.isCurrentlyPreviewing(song.audioUrl);
              const badgeClass =
                song.difficultyBadge === 'CHILL'
                  ? 'badge-wpm-chill'
                  : song.difficultyBadge === 'MODERATE'
                  ? 'badge-wpm-moderate'
                  : song.difficultyBadge === 'BRISK'
                  ? 'badge-wpm-brisk'
                  : 'badge-wpm-intense';

              const safeTitle = escapeHtml(song.title);
              const safeArtist = escapeHtml(song.artist);
              const safeGenre = escapeHtml(song.genre);

              return `
              <div class="song-card ${isSelected ? 'selected' : ''}" data-song-id="${escapeHtml(song.id)}">
                <div class="song-card-header">
                  <div class="song-info">
                    <span class="song-name" title="${safeTitle}">${safeTitle}</span>
                    <span class="song-artist" title="${safeArtist}">${safeArtist} &bull; ${safeGenre}</span>
                  </div>
                  <button type="button" class="btn-preview-audio ${isPreviewing ? 'previewing' : ''}" data-preview-url="${escapeHtml(song.audioUrl)}" data-preview-title="${safeTitle}" data-preview-artist="${safeArtist}">
                    ${isPreviewing ? `${ICONS.stop(12)} STOP` : `${ICONS.play(12)} PREVIEW`}
                  </button>
                </div>
                <div class="song-card-footer">
                  <span class="song-wpm-badge ${badgeClass}">${song.avgWpm} WPM &bull; ${song.difficultyBadge}</span>
                  <span style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-muted);">
                    ${Math.floor(song.durationSec / 60)}:${(song.durationSec % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>

        <!-- Custom Audio Upload Option -->
        <div class="custom-song-box">
          <div class="custom-song-header">
            <label class="custom-file-label" for="input-custom-song-file">
              <span style="display: flex; align-items: center;">${ICONS.folder(14)}</span>
              <span>${this.customSong ? `Loaded: ${escapeHtml(this.customSong.title)}` : 'Upload Custom MP3 / Audio File'}</span>
            </label>
            <input type="file" id="input-custom-song-file" accept="audio/*" style="display: none;" />
            ${
              this.customSong && !this.confirmingRemoveCustom
                ? `<button type="button" id="btn-clear-custom-song" style="background: transparent; border: none; color: #ff0055; font-family: var(--font-mono); font-size: 0.68rem; cursor: pointer;">[REMOVE]</button>`
                : ''
            }
          </div>
          ${
            this.customSong && this.confirmingRemoveCustom
              ? `<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; background: rgba(255, 0, 85, 0.12); border: 1px solid rgba(255, 0, 85, 0.4); border-radius: 3px; font-family: var(--font-mono); font-size: 0.7rem;">
                   <span style="color: #ff80aa;">Remove custom track "${escapeHtml(this.customSong.title)}"?</span>
                   <div style="display: flex; gap: 6px;">
                     <button type="button" id="btn-cancel-remove-song" class="btn-cyber-secondary" style="padding: 2px 8px; font-size: 0.66rem;">CANCEL</button>
                     <button type="button" id="btn-confirm-remove-song" class="btn-cyber-danger" style="padding: 2px 8px; font-size: 0.66rem;">CONFIRM REMOVE</button>
                   </div>
                 </div>`
              : ''
          }
          ${
            this.customSong
              ? `<textarea id="input-custom-lyrics" class="custom-lyrics-input" rows="2" style="background: #02040a; border: 1px solid var(--border-subtle); color: #fff; font-family: var(--font-mono); font-size: 0.72rem; padding: 6px; border-radius: 3px; resize: none;" placeholder="Paste song lyrics here...">${escapeHtml(this.customSong.lyrics)}</textarea>`
              : ''
          }
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    if (!this.container) return;

    // Filter tabs
    const filterBtns = this.container.querySelectorAll('.wpm-filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        soundEngine.playUiClick();
        this.activeFilter = (btn.getAttribute('data-filter') || 'ALL') as any;
        this.render();
      });
      btn.addEventListener('click', (e) => e.preventDefault());
    });

    // Song card selection & preview
    const songCards = this.container.querySelectorAll('.song-card');
    songCards.forEach((card) => {
      const songId = card.getAttribute('data-song-id');
      if (!songId) return;

      card.addEventListener('pointerdown', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.btn-preview-audio')) return;

        soundEngine.playUiClick();
        const found =
          this.customSong && this.customSong.id === songId
            ? this.customSong
            : SONG_CATALOG.find((s) => s.id === songId);

        if (found) {
          this.selectedSong = found;
          songCards.forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
          this.onSongSelected?.(found);
        }
      });
    });

    // Preview audio buttons
    const previewBtns = this.container.querySelectorAll('.btn-preview-audio');
    previewBtns.forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        soundEngine.playUiClick();
        const url = btn.getAttribute('data-preview-url') || '';
        const title = btn.getAttribute('data-preview-title') || '';
        const artist = btn.getAttribute('data-preview-artist') || '';

        const isPlaying = musicPlayer.togglePreview(url, title, artist);
        this.updatePreviewButtons(isPlaying, title);
      });
      btn.addEventListener('click', (e) => e.preventDefault());
    });

    // Custom song file upload
    const fileInput = this.container.querySelector('#input-custom-song-file') as HTMLInputElement;
    fileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        const file = files[0];
        const audioUrl = musicPlayer.loadCustomFile(file, file.name);
        const customTrack: SongTrack = {
          id: 'custom_' + Date.now(),
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'User Upload',
          avgWpm: 75,
          durationSec: 180,
          audioUrl: audioUrl,
          genre: 'Custom Audio',
          difficultyBadge: 'MODERATE',
          lyrics: 'Type the lyrics of your uploaded track here or enjoy typing along to your custom soundtrack.',
        };
        this.customSong = customTrack;
        this.confirmingRemoveCustom = false;
        this.selectedSong = customTrack;
        this.render();
        this.onSongSelected?.(customTrack);
      }
    });

    // Request confirmation to remove custom song
    const clearBtn = this.container.querySelector('#btn-clear-custom-song');
    clearBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      soundEngine.playUiClick();
      this.confirmingRemoveCustom = true;
      this.render();
    });

    const cancelRemoveBtn = this.container.querySelector('#btn-cancel-remove-song');
    cancelRemoveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      soundEngine.playUiClick();
      this.confirmingRemoveCustom = false;
      this.render();
    });

    const confirmRemoveBtn = this.container.querySelector('#btn-confirm-remove-song');
    confirmRemoveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      soundEngine.playUiClick();
      musicPlayer.revokeCustomFile();
      this.customSong = null;
      this.confirmingRemoveCustom = false;
      this.selectedSong = SONG_CATALOG[0];
      this.render();
      this.onSongSelected?.(this.selectedSong);
    });

    // Custom lyrics edit
    const customLyricsArea = this.container.querySelector('#input-custom-lyrics') as HTMLTextAreaElement;
    customLyricsArea?.addEventListener('input', () => {
      if (this.customSong) {
        this.customSong.lyrics = customLyricsArea.value.trim();
        this.onSongSelected?.(this.customSong);
      }
    });
  }

  private updatePreviewButtons(isPlaying: boolean, currentTitle: string): void {
    if (!this.container) return;
    const previewBtns = this.container.querySelectorAll('.btn-preview-audio');
    previewBtns.forEach((btn) => {
      const title = btn.getAttribute('data-preview-title');
      if (isPlaying && title === currentTitle) {
        btn.classList.add('previewing');
        btn.innerHTML = `${ICONS.stop(12)} STOP`;
      } else {
        btn.classList.remove('previewing');
        btn.innerHTML = `${ICONS.play(12)} PREVIEW`;
      }
    });
  }
}
