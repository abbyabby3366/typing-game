export type ServerMsg =
  | { type: 'RoomCreated'; payload: { room_code: string; player_id: string; role: 'player1' | 'player2'; settings: any } }
  | { type: 'RoomSettingsUpdated'; payload: { settings: any } }
  | { type: 'RoomJoined'; payload: { room_code: string; player_id: string; role: 'player1' | 'player2'; opponent_name: string; settings: any } }
  | { type: 'OpponentJoined'; payload: { opponent_name: string } }
  | { type: 'GameStarting'; payload: { countdown_seconds: number; passage_title: string; passage_text: string; words: string[] } }
  | { type: 'GameStarted' }
  | { type: 'WordFired'; payload: { player_role: 'player1' | 'player2'; word: string; combo: number; push_power: number; new_tug_position: number } }
  | { type: 'OpponentProgressUpdate'; payload: { player_role: 'player1' | 'player2'; char_index: number; word_index: number; wpm: number; accuracy: number; combo: number } }
  | { type: 'TugSync'; payload: { tug_position: number } }
  | { type: 'GameOver'; payload: { winner: 'player1' | 'player2' | null; reason: string; final_tug_position: number; p1_stats: any; p2_stats: any } }
  | { type: 'RematchAgreed'; payload: { countdown_seconds: number; passage_title: string; passage_text: string; words: string[] } }
  | { type: 'OpponentRequestedRematch'; payload: { player_role: 'player1' | 'player2' } }
  | { type: 'OpponentLeft' }
  | { type: 'ErrorAlert'; payload: { message: string } };

export type ClientMsg =
  | { type: 'CreateRoom'; payload: { player_name: string; error_mode: string; category: string; custom_text: string | null } }
  | { type: 'UpdateRoomSettings'; payload: { error_mode: string; category: string; custom_text: string | null } }
  | { type: 'JoinRoom'; payload: { room_code: string; player_name: string } }
  | { type: 'StartBotMatch'; payload: { player_name: string; bot_difficulty: string; custom_bot_wpm?: number; error_mode: string; category: string; custom_text: string | null } }
  | { type: 'WordCompleted'; payload: { word_index: number; word: string; wpm: number; accuracy: number; combo: number; push_power: number; is_correct?: boolean } }
  | { type: 'TypoPenalized'; payload: { combo_lost: number } }
  | { type: 'TypingProgress'; payload: { char_index: number; word_index: number; wpm: number; accuracy: number; combo: number } }
  | { type: 'RequestRematch' }
  | { type: 'StartDuel' }
  | { type: 'LeaveRoom' };

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url: string;
  public status: ConnectionStatus = 'disconnected';
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  // Errors are surfaced once per outage rather than on every failed send or retry
  private outageReported = false;

  public onMessage?: (msg: ServerMsg) => void;
  public onStatusChange?: (status: ConnectionStatus) => void;
  public onError?: (errorText: string) => void;

  constructor() {
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.hostname || '127.0.0.1';
    // If Vite dev server on port 5173, point to backend on 4000; otherwise connect to current host:port
    const defaultWsPort = window.location.port === '5173' ? ':4000' : (window.location.port ? `:${window.location.port}` : '');
    const wsHost = (import.meta as any).env?.VITE_WS_URL || `${isHttps ? 'wss' : 'ws'}://${host}${defaultWsPort}/ws`;
    this.url = wsHost;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.outageReported = false;
        this.setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMsg;
          this.onMessage?.(msg);
        } catch (e) {
          this.onError?.('Received corrupted server packet');
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.reportOutage();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('disconnected');
        this.reportOutage();
      };
    } catch (e) {
      this.setStatus('disconnected');
      this.reportOutage();
      this.scheduleReconnect();
    }
  }

  private reportOutage(): void {
    if (this.outageReported) return;
    this.outageReported = true;
    this.onError?.('Lost connection to the arena server. Reconnecting...');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(300 * 2 ** this.reconnectAttempts, 3000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }

  public send(msg: ClientMsg): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    } else {
      if (!this.outageReported) {
        this.outageReported = true;
        this.onError?.('Not connected to the arena server yet. Reconnecting...');
      }
      return false;
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}
