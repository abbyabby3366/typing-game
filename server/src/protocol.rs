use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorMode {
    AllowErrors,
    StrictErrors,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BotDifficulty {
    Easy,     // ~40 WPM
    Medium,   // ~70 WPM
    Hard,     // ~100 WPM
    CyberGod, // ~135 WPM
    Custom,   // User-specified custom WPM
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayerRole {
    Player1,
    Player2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSettings {
    pub error_mode: ErrorMode,
    pub category: String,
    pub custom_text: Option<String>,
    pub max_push_distance: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    pub name: String,
    pub wpm: f32,
    pub accuracy: f32,
    pub max_combo: u32,
    pub words_completed: usize,
    pub chars_typed: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GameOverReason {
    PushoutOverload,
    PassageCompleted,
    OpponentResigned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ClientMsg {
    CreateRoom {
        player_name: String,
        error_mode: ErrorMode,
        category: String,
        custom_text: Option<String>,
    },
    UpdateRoomSettings {
        error_mode: ErrorMode,
        category: String,
        custom_text: Option<String>,
    },
    JoinRoom {
        room_code: String,
        player_name: String,
    },
    StartBotMatch {
        player_name: String,
        bot_difficulty: BotDifficulty,
        #[serde(default)]
        custom_bot_wpm: Option<u32>,
        error_mode: ErrorMode,
        category: String,
        #[serde(default)]
        custom_text: Option<String>,
    },
    WordCompleted {
        word_index: usize,
        word: String,
        wpm: f32,
        accuracy: f32,
        combo: u32,
        push_power: f32,
    },
    TypoPenalized {
        combo_lost: u32,
    },
    TypingProgress {
        char_index: usize,
        word_index: usize,
        wpm: f32,
        accuracy: f32,
        combo: u32,
    },
    RequestRematch,
    LeaveRoom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum ServerMsg {
    RoomCreated {
        room_code: String,
        player_id: String,
        role: PlayerRole,
        settings: GameSettings,
    },
    RoomSettingsUpdated {
        settings: GameSettings,
    },
    RoomJoined {
        room_code: String,
        player_id: String,
        role: PlayerRole,
        opponent_name: String,
        settings: GameSettings,
    },
    OpponentJoined {
        opponent_name: String,
    },
    GameStarting {
        countdown_seconds: u32,
        passage_title: String,
        passage_text: String,
        words: Vec<String>,
    },
    GameStarted,
    WordFired {
        player_role: PlayerRole,
        word: String,
        combo: u32,
        push_power: f32,
        new_tug_position: f32,
    },
    OpponentProgressUpdate {
        player_role: PlayerRole,
        char_index: usize,
        word_index: usize,
        wpm: f32,
        accuracy: f32,
        combo: u32,
    },
    TugSync {
        tug_position: f32,
    },
    GameOver {
        winner: Option<PlayerRole>,
        reason: GameOverReason,
        final_tug_position: f32,
        p1_stats: PlayerStats,
        p2_stats: PlayerStats,
    },
    RematchAgreed {
        countdown_seconds: u32,
        passage_title: String,
        passage_text: String,
        words: Vec<String>,
    },
    OpponentLeft,
    ErrorAlert {
        message: String,
    },
}
