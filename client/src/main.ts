import * as THREE from 'three';
import { SceneManager } from './graphics/sceneManager';
import { BeamEffect } from './graphics/beamEffect';
import { ProjectileManager } from './graphics/projectileManager';
import { startRenderLoop } from './graphics/renderLoop';
import { soundEngine } from './audio/soundEngine';
import { TypingEngine, ErrorMode } from './game/typingEngine';
import { NetworkClient, ServerMsg } from './game/networkClient';
import { SongTrack, SONG_CATALOG } from './game/songCatalog';
import { musicPlayer } from './audio/musicPlayer';
import { buildZenPassage } from './game/zenHelper';
import { LobbyView } from './ui/lobbyView';
import { WaitingRoomView } from './ui/waitingRoomView';
import { HudView } from './ui/hudView';
import { ModalView } from './ui/modalView';
import { EscapeExitManager } from './ui/escapeExitManager';
import { showCyberToast } from './ui/toast';
import { ICONS } from './ui/icons';

class App {
  private canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private beamEffect: BeamEffect;
  private projectileManager: ProjectileManager;
  private typingEngine: TypingEngine;
  private network: NetworkClient;

  private lobbyView: LobbyView;
  private waitingRoomView: WaitingRoomView;
  private hudView: HudView;
  private modalView: ModalView;
  private escapeManager: EscapeExitManager;

  private mainViewEl: HTMLElement;
  private statusPillEl: HTMLElement;
  private statusTextEl: HTMLElement;
  private audioBtn: HTMLElement;
  private toastContainer: HTMLElement;

  private myRole: 'player1' | 'player2' = 'player1';
  private myName: string = 'PLAYER-1';
  private opponentName: string = 'RIVAL-2';
  private currentRoomCode: string = '';
  private currentErrorMode: ErrorMode = 'allow_errors';
  private passageTitle: string = 'CYBER CLASH PROTOCOL';
  private isMatchActive: boolean = false;
  private lastTugPosition: number = 0;
  private activeSong: SongTrack | null = null;
  private isZenMode: boolean = false;
  private zenStartTime: number = 0;
  private lastZenConfig: {
    errorMode: ErrorMode;
    category: string;
    customText: string | null;
    selectedSong?: SongTrack | null;
  } | null = null;
  private countdownTimer: number | null = null;

  constructor() {
    this.canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    this.mainViewEl = document.getElementById('main-view')!;
    this.statusPillEl = document.getElementById('connection-status')!;
    this.statusTextEl = this.statusPillEl.querySelector('.status-text')!;
    this.audioBtn = document.getElementById('audio-toggle-btn')!;
    this.toastContainer = document.getElementById('toast-container')!;
    const modalContainer = document.getElementById('modal-container')!;

    // Initialize 3D Engine
    this.sceneManager = new SceneManager(this.canvas);
    this.beamEffect = new BeamEffect(
      this.sceneManager.scene,
      this.sceneManager.p1CannonPos,
      this.sceneManager.p2CannonPos
    );
    this.projectileManager = new ProjectileManager(this.sceneManager.scene);

    // Initialize Game & Network
    this.typingEngine = new TypingEngine();
    this.network = new NetworkClient();

    // Initialize Views
    this.lobbyView = new LobbyView(this.mainViewEl);
    this.waitingRoomView = new WaitingRoomView(this.mainViewEl);
    this.hudView = new HudView(this.mainViewEl);
    this.modalView = new ModalView(modalContainer);

    this.escapeManager = new EscapeExitManager({
      isSessionActive: () => this.isMatchActive || this.countdownTimer !== null,
      getMode: () => (this.isZenMode ? 'zen' : this.currentRoomCode ? 'duel' : 'solo'),
      onExit: () => this.exitOrForfeitMatch(),
    });

    this.initAudioAndUI();
    this.initNetworkHandlers();
    this.initTypingHandlers();
    this.checkUrlParams();

    startRenderLoop({
      isMatchActive: () => this.isMatchActive,
      isZenMode: () => this.isZenMode,
      beamEffect: this.beamEffect,
      sceneManager: this.sceneManager,
      projectileManager: this.projectileManager,
      onTugUpdate: (tug) => this.hudView.updateTugMeter(tug),
    });
  }

  private initAudioAndUI(): void {
    const unlockAudio = () => {
      soundEngine.init();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    this.audioBtn.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      const icon = document.getElementById('audio-icon');
      if (icon) icon.innerHTML = isMuted ? ICONS.volumeMuted(18) : ICONS.volume(18);
      this.showToast(isMuted ? 'Audio Synthesizer Muted' : 'Audio Synthesizer Online');
    });

    this.network.onStatusChange = (status) => {
      this.statusPillEl.className = `status-pill status-${status}`;
      this.statusTextEl.textContent = status.toUpperCase();
    };

    this.network.onError = (err) => {
      this.showToast(err, true);
    };

    this.network.connect();
  }

  private initNetworkHandlers(): void {
    this.network.onMessage = (msg: ServerMsg) => {
      switch (msg.type) {
        case 'RoomCreated':
          this.currentRoomCode = msg.payload.room_code;
          this.myRole = msg.payload.role;
          this.currentErrorMode = msg.payload.settings.error_mode as ErrorMode;
          this.updateUrlRoomCode(this.currentRoomCode);
          this.waitingRoomView.render(this.currentRoomCode, true, msg.payload.settings);
          break;

        case 'RoomSettingsUpdated':
          this.currentErrorMode = msg.payload.settings.error_mode as ErrorMode;
          break;

        case 'RoomJoined':
          this.currentRoomCode = msg.payload.room_code;
          this.myRole = msg.payload.role;
          this.opponentName = msg.payload.opponent_name;
          this.currentErrorMode = msg.payload.settings.error_mode as ErrorMode;
          this.updateUrlRoomCode(this.currentRoomCode);
          this.showToast(`Locked into Arena with ${this.opponentName}`);
          break;

        case 'OpponentJoined':
          this.opponentName = msg.payload.opponent_name;
          this.waitingRoomView.setOpponentJoined(this.opponentName);
          this.showToast(`Challenger ${this.opponentName} engaged!`);
          break;

        case 'GameStarting':
          this.handleGameStarting(
            msg.payload.countdown_seconds,
            msg.payload.passage_title,
            msg.payload.passage_text,
            msg.payload.words
          );
          break;

        case 'WordFired':
          this.handleWordFired(msg.payload);
          break;

        case 'OpponentProgressUpdate':
          if (msg.payload.player_role !== this.myRole) {
            this.hudView.updateStats(this.typingEngine.getStats(), {
              name: this.opponentName,
              wpm: msg.payload.wpm,
              accuracy: msg.payload.accuracy,
              wordsCompleted: msg.payload.word_index,
              totalWords: this.typingEngine.words.length,
              combo: msg.payload.combo,
            });
          }
          break;

        case 'GameOver':
          this.handleGameOver(msg.payload);
          break;

        case 'RematchAgreed':
          this.modalView.hide();
          this.handleGameStarting(
            msg.payload.countdown_seconds,
            msg.payload.passage_title,
            msg.payload.passage_text,
            msg.payload.words
          );
          break;

        case 'OpponentLeft':
          this.showToast('Opponent disconnected from arena.', true);
          this.isMatchActive = false;
          soundEngine.stopBeamHum();
          this.lobbyView.render();
          break;

        case 'ErrorAlert':
          this.showToast(msg.payload.message, true);
          break;
      }
    };

    // Lobby action bindings
    this.lobbyView.onCreateRoom = (cfg) => {
      this.myName = cfg.playerName;
      this.currentErrorMode = cfg.errorMode;
      this.activeSong = cfg.selectedSong || null;
      this.network.send({
        type: 'CreateRoom',
        payload: { player_name: cfg.playerName, error_mode: cfg.errorMode, category: cfg.category, custom_text: cfg.customText },
      });
    };

    this.waitingRoomView.onUpdateSettings = (cfg) => {
      this.currentErrorMode = cfg.errorMode;
      this.activeSong = cfg.selectedSong || null;
      this.network.send({
        type: 'UpdateRoomSettings',
        payload: { error_mode: cfg.errorMode, category: cfg.category, custom_text: cfg.customText },
      });
    };

    this.waitingRoomView.onCancelRoom = () => {
      this.isMatchActive = false;
      this.activeSong = null;
      this.updateUrlRoomCode('');
      this.network.send({ type: 'LeaveRoom' });
      this.lobbyView.render();
    };

    this.lobbyView.onJoinRoom = (code, playerName) => {
      this.myName = playerName;
      this.network.send({ type: 'JoinRoom', payload: { room_code: code, player_name: playerName } });
    };

    this.lobbyView.onStartBot = (playerName, difficulty, customWpm, errorMode, category, customText, selectedSong) => {
      this.myName = playerName;
      this.currentErrorMode = errorMode;
      this.activeSong = selectedSong || null;
      this.network.send({
        type: 'StartBotMatch',
        payload: {
          player_name: playerName,
          bot_difficulty: difficulty,
          custom_bot_wpm: difficulty === 'custom' ? customWpm : undefined,
          error_mode: errorMode,
          category,
          custom_text: customText,
        },
      });
    };

    this.lobbyView.onStartZen = (playerName, errorMode, category, customText, selectedSong) => {
      this.myName = playerName;
      this.currentErrorMode = errorMode;
      this.activeSong = selectedSong || null;
      this.isZenMode = true;
      this.lastZenConfig = { errorMode, category, customText, selectedSong };
      const { title, text, words } = buildZenPassage(category, customText, selectedSong);
      this.handleGameStarting(3, title, text, words, true);
    };

    this.hudView.onExitMatch = () => {
      if (this.isZenMode) {
        this.exitOrForfeitMatch();
        return;
      }
      this.modalView.showConfirm(
        'SURRENDER DUEL',
        'Are you sure you want to forfeit the match and return to the battle lobby?',
        () => this.exitOrForfeitMatch()
      );
    };
  }

  private exitOrForfeitMatch(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      document.querySelector('.countdown-overlay')?.remove();
    }
    this.isMatchActive = false;
    this.typingEngine.stop();
    soundEngine.stopBeamHum();
    musicPlayer.stop();
    this.beamEffect.setVisible(true);

    if (this.isZenMode) {
      this.showToast('Exited Zen Flow session');
    } else {
      soundEngine.playDefeatSound();
      this.network.send({ type: 'LeaveRoom' });
      this.currentRoomCode = '';
      this.showToast('Match forfeited', true);
    }
    this.escapeManager.reset();
    this.lobbyView.render();
  }

  private initTypingHandlers(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return;
      if (!this.isMatchActive) return;
      if ([' ', 'Backspace', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
      this.typingEngine.handleKeyDown(e);
    });

    let lastProgressSent = 0;
    let progressTimer: number | null = null;
    const PROGRESS_INTERVAL_MS = 80;

    const sendProgress = () => {
      progressTimer = null;
      lastProgressSent = performance.now();
      const stats = this.typingEngine.getStats();
      this.network.send({
        type: 'TypingProgress',
        payload: { char_index: this.typingEngine.typedBuffer.length, word_index: this.typingEngine.currentWordIndex, wpm: stats.wpm, accuracy: stats.accuracy, combo: stats.combo },
      });
    };

    this.typingEngine.onStateChanged = () => {
      if (!this.isMatchActive) return;
      this.hudView.updateTypingDisplay(this.typingEngine);
      this.hudView.updateStats(this.typingEngine.getStats());

      if (this.isZenMode) {
        this.hudView.updateZenProgress(this.typingEngine.currentWordIndex, this.typingEngine.words.length);
        return;
      }

      // Coalesce progress packets: send immediately if idle, otherwise one trailing send
      if (progressTimer !== null) return;
      const wait = PROGRESS_INTERVAL_MS - (performance.now() - lastProgressSent);
      if (wait <= 0) sendProgress();
      else progressTimer = window.setTimeout(sendProgress, wait);
    };

    this.typingEngine.onWordCompleted = (word, index, combo, wpm, accuracy) => {
      // Check for combo surge sound milestone (5x, 10x, 15x...)
      if (combo > 0 && combo % 5 === 0) {
        soundEngine.playComboSurge(combo);
        this.sceneManager.triggerShake(this.isZenMode ? 0.2 : 0.5);
      }

      if (this.isZenMode) {
        this.projectileManager.fireWord(word, true, this.sceneManager.p1CannonPos, 10, combo, 1.0);
        if (index + 1 >= this.typingEngine.words.length) this.handleZenComplete();
        return;
      }

      // Fire word projectile immediately from player's cannon
      const isP1 = this.myRole === 'player1';
      const cannonPos = isP1 ? this.sceneManager.p1CannonPos : this.sceneManager.p2CannonPos;
      this.projectileManager.fireWord(word, isP1, cannonPos, this.beamEffect.currentClashX, combo, 1.0 + combo * 0.1);

      // Send completed word to server
      this.network.send({
        type: 'WordCompleted',
        payload: { word_index: index, word, wpm, accuracy, combo, push_power: 1.0 + combo * 0.1 },
      });
    };

    this.typingEngine.onTypoPenalized = (comboLost) => {
      if (this.isZenMode) return;
      this.network.send({
        type: 'TypoPenalized',
        payload: { combo_lost: comboLost },
      });
    };
  }

  private handleGameStarting(
    countdown: number,
    title: string,
    text: string,
    words: string[],
    isZen: boolean = false
  ): void {
    if (!this.activeSong && !isZen) {
      const trimmed = text.trim();
      const matched = SONG_CATALOG.find(
        (s) => s.lyrics.trim() === trimmed || s.title.toLowerCase() === title.toLowerCase()
      );
      if (matched) this.activeSong = matched;
    }
    this.isZenMode = isZen;
    this.passageTitle = this.activeSong
      ? `${this.activeSong.title} - ${this.activeSong.artist} (${this.activeSong.avgWpm} WPM)`
      : title;
    this.typingEngine.setWords(words, this.currentErrorMode);
    this.hudView.renderBattleHud(
      this.myName,
      isZen ? 'ZEN FLOW' : this.opponentName,
      this.passageTitle,
      this.currentErrorMode,
      words,
      this.activeSong,
      isZen
    );
    this.hudView.updateTypingDisplay(this.typingEngine);

    if (isZen) {
      this.beamEffect.setVisible(false);
      this.hudView.updateZenProgress(0, words.length);
    } else {
      this.beamEffect.setVisible(true);
      this.beamEffect.setTugPosition(0);
      this.hudView.updateTugMeter(0);
    }

    if (this.activeSong) {
      musicPlayer.loadTrack(this.activeSong.audioUrl, this.activeSong.title, this.activeSong.artist);
    }

    // Countdown timer
    let count = countdown;
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
    }
    this.countdownTimer = window.setInterval(() => {
      this.hudView.renderCountdown(count);
      soundEngine.playCountdownBeep(count === 0);
      if (count <= 0) {
        if (this.countdownTimer !== null) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.isMatchActive = true;
        this.zenStartTime = performance.now();
        this.typingEngine.start();
        if (!isZen) {
          soundEngine.startBeamHum();
        }
        if (this.activeSong) {
          musicPlayer.play(true);
        }
      }
      count--;
    }, 1000);
  }

  private handleWordFired(payload: {
    player_role: 'player1' | 'player2';
    word: string;
    combo: number;
    push_power: number;
    new_tug_position: number;
  }): void {
    const isP1 = payload.player_role === 'player1';
    this.lastTugPosition = payload.new_tug_position;
    this.beamEffect.setTugPosition(payload.new_tug_position);
    this.hudView.updateTugMeter(payload.new_tug_position);
    soundEngine.updateBeamHumTug(payload.new_tug_position);

    if (payload.player_role !== this.myRole) {
      const cannonPos = isP1 ? this.sceneManager.p1CannonPos : this.sceneManager.p2CannonPos;
      this.projectileManager.fireWord(
        payload.word,
        isP1,
        cannonPos,
        this.beamEffect.currentClashX,
        payload.combo,
        payload.push_power
      );
    }
  }

  private handleGameOver(payload: any): void {
    this.escapeManager.reset();
    this.isMatchActive = false;
    this.typingEngine.stop();
    musicPlayer.stop();

    const isWinner = payload.winner === this.myRole;
    const isDraw = payload.winner === null;
    if (isWinner) soundEngine.playVictoryExplosion();
    else if (isDraw) soundEngine.stopBeamHum();
    else soundEngine.playDefeatSound();

    this.modalView.showGameOver(
      { isWinner, isDraw, reason: payload.reason, p1Stats: payload.p1_stats, p2Stats: payload.p2_stats },
      () => { musicPlayer.stop(); this.network.send({ type: 'RequestRematch' }); },
      () => { musicPlayer.stop(); this.network.send({ type: 'LeaveRoom' }); this.lobbyView.render(); }
    );
  }

  private handleZenComplete(): void {
    this.escapeManager.reset();
    this.isMatchActive = false;
    this.typingEngine.stop();
    musicPlayer.stop();

    const stats = this.typingEngine.getStats();
    const elapsedSec = (performance.now() - this.zenStartTime) / 1000;
    soundEngine.playVictoryExplosion();

    this.modalView.showZenComplete(
      {
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        maxCombo: stats.maxCombo,
        wordsCompleted: stats.wordsCompleted + 1,
        charsTyped: stats.charsTyped,
        elapsedSec: Math.max(1, elapsedSec),
      },
      this.passageTitle,
      () => {
        if (this.lastZenConfig) {
          this.lobbyView.onStartZen?.(
            this.myName,
            this.lastZenConfig.errorMode,
            this.lastZenConfig.category,
            this.lastZenConfig.customText,
            this.lastZenConfig.selectedSong
          );
        }
      },
      () => {
        this.beamEffect.setVisible(true);
        this.lobbyView.render();
      }
    );
  }

  private checkUrlParams(): void {
    const roomParam = new URLSearchParams(window.location.search).get('room');
    this.lobbyView.render(roomParam ? roomParam.toUpperCase() : '');
  }

  private updateUrlRoomCode(code: string): void {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  }

  private showToast(message: string, isError: boolean = false): void {
    showCyberToast(this.toastContainer, message, isError);
  }
}

// Mount Cyber Clash Application
new App();
