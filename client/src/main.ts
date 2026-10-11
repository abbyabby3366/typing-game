import * as THREE from 'three';
import { SceneManager } from './graphics/sceneManager';
import { BeamEffect } from './graphics/beamEffect';
import { ProjectileManager } from './graphics/projectileManager';
import { soundEngine } from './audio/soundEngine';
import { TypingEngine, ErrorMode } from './game/typingEngine';
import { NetworkClient, ServerMsg } from './game/networkClient';
import { SongTrack } from './game/songCatalog';
import { musicPlayer } from './audio/musicPlayer';
import { LobbyView } from './ui/lobbyView';
import { HudView } from './ui/hudView';
import { ModalView } from './ui/modalView';

class App {
  private canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private beamEffect: BeamEffect;
  private projectileManager: ProjectileManager;
  private typingEngine: TypingEngine;
  private network: NetworkClient;

  private lobbyView: LobbyView;
  private hudView: HudView;
  private modalView: ModalView;

  private mainViewEl: HTMLElement;
  private statusPillEl: HTMLElement;
  private statusTextEl: HTMLElement;
  private audioBtn: HTMLElement;
  private toastContainer: HTMLElement;

  private myRole: 'player1' | 'player2' = 'player1';
  private myName: string = 'PILOT-1';
  private opponentName: string = 'RIVAL-2';
  private currentRoomCode: string = '';
  private currentErrorMode: ErrorMode = 'allow_errors';
  private passageTitle: string = 'CYBER CLASH PROTOCOL';
  private isMatchActive: boolean = false;
  private lastTugPosition: number = 0;
  private activeSong: SongTrack | null = null;

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
    this.hudView = new HudView(this.mainViewEl);
    this.modalView = new ModalView(modalContainer);

    this.initAudioAndUI();
    this.initNetworkHandlers();
    this.initTypingHandlers();
    this.checkUrlParams();

    // Start 3D Render Loop
    this.startLoop();
  }

  private initAudioAndUI(): void {
    // Unlock Web Audio on first user interaction
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
      if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? 'Audio Synthesizer Muted' : 'Audio Synthesizer Online');
    });

    this.network.onStatusChange = (status) => {
      this.statusPillEl.className = `status-pill status-${status}`;
      this.statusTextEl.textContent = status.toUpperCase();
    };

    this.network.onError = (err) => {
      this.showToast(err, true);
    };

    // Connect to Rust Server
    this.network.connect();
  }

  private initNetworkHandlers(): void {
    this.network.onMessage = (msg: ServerMsg) => {
      switch (msg.type) {
        case 'RoomCreated':
          this.currentRoomCode = msg.payload.room_code;
          this.myRole = msg.payload.role;
          this.currentErrorMode = msg.payload.settings.error_mode as ErrorMode;
          this.hudView.renderWaiting(this.currentRoomCode, true);
          break;

        case 'RoomJoined':
          this.currentRoomCode = msg.payload.room_code;
          this.myRole = msg.payload.role;
          this.opponentName = msg.payload.opponent_name;
          this.currentErrorMode = msg.payload.settings.error_mode as ErrorMode;
          this.showToast(`Locked into Arena with ${this.opponentName}`);
          break;

        case 'OpponentJoined':
          this.opponentName = msg.payload.opponent_name;
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
        payload: {
          player_name: cfg.playerName,
          error_mode: cfg.errorMode,
          category: cfg.category,
          custom_text: cfg.customText,
        },
      });
    };

    this.lobbyView.onJoinRoom = (code, playerName) => {
      this.myName = playerName;
      this.network.send({
        type: 'JoinRoom',
        payload: {
          room_code: code,
          player_name: playerName,
        },
      });
    };

    this.lobbyView.onStartBot = (playerName, difficulty, errorMode, category, customText, selectedSong) => {
      this.myName = playerName;
      this.currentErrorMode = errorMode;
      this.activeSong = selectedSong || null;
      this.network.send({
        type: 'StartBotMatch',
        payload: {
          player_name: playerName,
          bot_difficulty: difficulty,
          error_mode: errorMode,
          category,
          custom_text: customText,
        },
      });
    };

    this.hudView.onExitMatch = () => {
      this.modalView.showConfirm(
        'SURRENDER DUEL',
        'Are you sure you want to forfeit the match and return to the battle lobby?',
        () => {
          this.isMatchActive = false;
          soundEngine.stopBeamHum();
          musicPlayer.stop();
          this.network.send({ type: 'LeaveRoom' });
          this.lobbyView.render();
        }
      );
    };
  }

  private initTypingHandlers(): void {
    window.addEventListener('keydown', (e) => {
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
        payload: {
          char_index: this.typingEngine.typedBuffer.length,
          word_index: this.typingEngine.currentWordIndex,
          wpm: stats.wpm,
          accuracy: stats.accuracy,
          combo: stats.combo,
        },
      });
    };

    this.typingEngine.onStateChanged = () => {
      if (!this.isMatchActive) return;
      this.hudView.updateTypingDisplay(this.typingEngine);
      this.hudView.updateStats(this.typingEngine.getStats());

      // Coalesce progress packets: send immediately if idle, otherwise one trailing send
      if (progressTimer !== null) return;
      const wait = PROGRESS_INTERVAL_MS - (performance.now() - lastProgressSent);
      if (wait <= 0) {
        sendProgress();
      } else {
        progressTimer = window.setTimeout(sendProgress, wait);
      }
    };

    this.typingEngine.onWordCompleted = (word, index, combo, wpm, accuracy) => {
      // Check for combo surge sound milestone (5x, 10x, 15x...)
      if (combo > 0 && combo % 5 === 0) {
        soundEngine.playComboSurge(combo);
        this.sceneManager.triggerShake(0.5);
      }

      // Fire word projectile immediately from player's cannon
      const isP1 = this.myRole === 'player1';
      const cannonPos = isP1 ? this.sceneManager.p1CannonPos : this.sceneManager.p2CannonPos;

      this.projectileManager.fireWord(
        word,
        isP1,
        cannonPos,
        this.beamEffect.currentClashX,
        combo,
        1.0 + combo * 0.1
      );

      // Send completed word to server
      this.network.send({
        type: 'WordCompleted',
        payload: {
          word_index: index,
          word,
          wpm,
          accuracy,
          combo,
          push_power: 1.0 + combo * 0.1,
        },
      });
    };

    this.typingEngine.onTypoPenalized = (comboLost) => {
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
    words: string[]
  ): void {
    this.passageTitle = this.activeSong
      ? `${this.activeSong.title} - ${this.activeSong.artist} (${this.activeSong.avgWpm} WPM)`
      : title;
    this.typingEngine.setWords(words, this.currentErrorMode);
    this.hudView.renderBattleHud(
      this.myName,
      this.opponentName,
      this.passageTitle,
      this.currentErrorMode,
      words,
      this.activeSong
    );
    this.hudView.updateTypingDisplay(this.typingEngine);

    // Reset beam to center
    this.beamEffect.setTugPosition(0);
    this.hudView.updateTugMeter(0);

    if (this.activeSong) {
      musicPlayer.loadTrack(this.activeSong.audioUrl, this.activeSong.title, this.activeSong.artist);
    }

    // Countdown timer
    let count = countdown;
    const interval = setInterval(() => {
      this.hudView.renderCountdown(count);
      soundEngine.playCountdownBeep(count === 0);
      if (count <= 0) {
        clearInterval(interval);
        this.isMatchActive = true;
        this.typingEngine.start();
        soundEngine.startBeamHum();
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

    // If opponent fired the word, render their flying word projectile
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
    this.isMatchActive = false;
    this.typingEngine.stop();
    musicPlayer.stop();

    const isWinner = payload.winner === this.myRole;
    const isDraw = payload.winner === null;

    if (isWinner) {
      soundEngine.playVictoryExplosion();
    } else if (isDraw) {
      soundEngine.stopBeamHum();
    } else {
      soundEngine.playDefeatSound();
    }

    this.modalView.showGameOver(
      {
        isWinner,
        isDraw,
        reason: payload.reason,
        p1Stats: payload.p1_stats,
        p2Stats: payload.p2_stats,
      },
      () => {
        musicPlayer.stop();
        this.network.send({ type: 'RequestRematch' });
      },
      () => {
        musicPlayer.stop();
        this.network.send({ type: 'LeaveRoom' });
        this.lobbyView.render();
      }
    );
  }

  private checkUrlParams(): void {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.lobbyView.render(roomParam.toUpperCase());
    } else {
      this.lobbyView.render();
    }
  }

  private showToast(message: string, isError: boolean = false): void {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      setTimeout(() => toast.remove(), 400);
    }, 3800);
  }

  private startLoop(): void {
    const clock = new THREE.Clock();
    let lastLobbyFrame = 0;

    const animate = () => {
      requestAnimationFrame(animate);

      // In lobby, throttle background 3D canvas to ~30 FPS to leave 100% GPU & CPU bandwidth free for instant UI clicks
      if (!this.isMatchActive) {
        const now = performance.now();
        if (now - lastLobbyFrame < 32) {
          return;
        }
        lastLobbyFrame = now;
      }

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Update 3D scene & clash beams
      this.beamEffect.update(time, delta);
      this.sceneManager.update(time, delta, this.beamEffect.currentClashX);

      // Only process word projectiles and momentum sync during active duel
      if (this.isMatchActive) {
        const currentTug = -this.beamEffect.currentClashX / 11.5;
        this.hudView.updateTugMeter(currentTug);

        this.projectileManager.update(delta, this.beamEffect.currentClashX, (isP1, power) => {
          this.beamEffect.triggerShockwave(isP1, power);
          this.sceneManager.triggerShake(power * 0.4);
        });
      }
    };

    animate();
  }
}

// Mount Cyber Clash Application
new App();
