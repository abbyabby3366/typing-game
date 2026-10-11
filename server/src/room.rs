use crate::protocol::*;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

pub type Tx = mpsc::UnboundedSender<ServerMsg>;

#[derive(Clone)]
pub struct PlayerSession {
    pub id: String,
    pub name: String,
    pub role: PlayerRole,
    pub tx: Tx,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RoomState {
    WaitingForOpponent,
    Starting,
    Active,
    Finished,
}

pub struct Room {
    pub code: String,
    pub settings: GameSettings,
    pub state: RoomState,
    pub p1: Option<PlayerSession>,
    pub p2: Option<PlayerSession>,
    pub is_bot_match: bool,
    pub bot_difficulty: Option<BotDifficulty>,
    pub custom_bot_wpm: Option<u32>,
    pub passage_title: String,
    pub passage_text: String,
    pub words: Vec<String>,
    pub tug_position: f32, // -1.0 (P1 win) to +1.0 (P2 win)
    pub p1_stats: PlayerStats,
    pub p2_stats: PlayerStats,
    pub p1_rematch: bool,
    pub p2_rematch: bool,
    pub bot_abort_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Room {
    pub fn new(
        code: String,
        settings: GameSettings,
        p1: PlayerSession,
        is_bot_match: bool,
        bot_difficulty: Option<BotDifficulty>,
        custom_bot_wpm: Option<u32>,
    ) -> Self {
        let p1_name = p1.name.clone();
        let (title, text, words) = crate::passages::get_passage_by_category(
            &settings.category,
            settings.custom_text.as_deref(),
        );

        Self {
            code,
            settings,
            state: if is_bot_match {
                RoomState::Starting
            } else {
                RoomState::WaitingForOpponent
            },
            p1: Some(p1),
            p2: if is_bot_match {
                let bot_name = match bot_difficulty.unwrap_or(BotDifficulty::Medium) {
                    BotDifficulty::Easy => "DRONE-ALPHA (40 WPM)".to_string(),
                    BotDifficulty::Medium => "NEXUS-V2 (70 WPM)".to_string(),
                    BotDifficulty::Hard => "CYBER-VIPER (100 WPM)".to_string(),
                    BotDifficulty::CyberGod => "QUANTUM-GOD (135 WPM)".to_string(),
                    BotDifficulty::Custom => {
                        let w = custom_bot_wpm.unwrap_or(75);
                        format!("CUSTOM-AI ({} WPM)", w)
                    }
                };
                let (dummy_tx, _) = mpsc::unbounded_channel();
                Some(PlayerSession {
                    id: "ai-bot".to_string(),
                    name: bot_name,
                    role: PlayerRole::Player2,
                    tx: dummy_tx,
                })
            } else {
                None
            },
            is_bot_match,
            bot_difficulty,
            custom_bot_wpm,
            passage_title: title,
            passage_text: text,
            words,
            tug_position: 0.0,
            p1_stats: PlayerStats {
                name: p1_name,
                wpm: 0.0,
                accuracy: 100.0,
                max_combo: 0,
                words_completed: 0,
                chars_typed: 0,
            },
            p2_stats: PlayerStats {
                name: if is_bot_match {
                    "AI CONSTRUCT".to_string()
                } else {
                    "Opponent".to_string()
                },
                wpm: 0.0,
                accuracy: 100.0,
                max_combo: 0,
                words_completed: 0,
                chars_typed: 0,
            },
            p1_rematch: false,
            p2_rematch: false,
            bot_abort_handle: None,
        }
    }

    pub fn broadcast(&self, msg: ServerMsg) {
        if let Some(ref p1) = self.p1 {
            let _ = p1.tx.send(msg.clone());
        }
        if let Some(ref p2) = self.p2 {
            if !self.is_bot_match {
                let _ = p2.tx.send(msg);
            }
        }
    }

    /// Relay a message only to the other human player (never echoed to the sender,
    /// and skipped for bot matches where there is no human opponent).
    pub fn send_to_opponent(&self, from: PlayerRole, msg: ServerMsg) {
        if self.is_bot_match {
            return;
        }
        let target = match from {
            PlayerRole::Player1 => self.p2.as_ref(),
            PlayerRole::Player2 => self.p1.as_ref(),
        };
        if let Some(p) = target {
            let _ = p.tx.send(msg);
        }
    }

    pub fn handle_word_completed(
        &mut self,
        role: PlayerRole,
        word: String,
        combo: u32,
        wpm: f32,
        accuracy: f32,
        is_correct: bool,
    ) -> Option<ServerMsg> {
        if self.state != RoomState::Active {
            return None;
        }

        let push_power = if is_correct {
            let total_words = self.words.len().max(20) as f32;
            let base_divisor = (total_words * 3.2).clamp(160.0, 260.0);
            let word_len = word.chars().count().max(3) as f32;
            let combo_mult = 1.0 + (combo as f32 * 0.08).min(1.8);
            (word_len / base_divisor) * combo_mult
        } else {
            0.0
        };

        let stats = match role {
            PlayerRole::Player1 => {
                self.tug_position -= push_power;
                &mut self.p1_stats
            }
            PlayerRole::Player2 => {
                self.tug_position += push_power;
                &mut self.p2_stats
            }
        };

        stats.words_completed += 1;
        stats.chars_typed += word.chars().count();
        stats.wpm = wpm;
        stats.accuracy = accuracy;
        if combo > stats.max_combo {
            stats.max_combo = combo;
        }

        // Clamp tug position
        self.tug_position = self.tug_position.clamp(-1.0, 1.0);

        let word_fired_msg = ServerMsg::WordFired {
            player_role: role,
            word,
            combo,
            push_power,
            new_tug_position: self.tug_position,
        };
        self.broadcast(word_fired_msg);

        // Check victory by overload pushout
        if self.tug_position <= -1.0 {
            self.state = RoomState::Finished;
            if let Some(h) = self.bot_abort_handle.take() {
                h.abort();
            }
            return Some(ServerMsg::GameOver {
                winner: Some(PlayerRole::Player1),
                reason: GameOverReason::PushoutOverload,
                final_tug_position: self.tug_position,
                p1_stats: self.p1_stats.clone(),
                p2_stats: self.p2_stats.clone(),
            });
        } else if self.tug_position >= 1.0 {
            self.state = RoomState::Finished;
            if let Some(h) = self.bot_abort_handle.take() {
                h.abort();
            }
            return Some(ServerMsg::GameOver {
                winner: Some(PlayerRole::Player2),
                reason: GameOverReason::PushoutOverload,
                final_tug_position: self.tug_position,
                p1_stats: self.p1_stats.clone(),
                p2_stats: self.p2_stats.clone(),
            });
        }

        // Check victory by passage completion
        let total_words = self.words.len();
        if self.p1_stats.words_completed >= total_words || self.p2_stats.words_completed >= total_words {
            self.state = RoomState::Finished;
            if let Some(h) = self.bot_abort_handle.take() {
                h.abort();
            }
            let winner = if self.tug_position < -0.01 {
                Some(PlayerRole::Player1)
            } else if self.tug_position > 0.01 {
                Some(PlayerRole::Player2)
            } else {
                None // Draw
            };

            return Some(ServerMsg::GameOver {
                winner,
                reason: GameOverReason::PassageCompleted,
                final_tug_position: self.tug_position,
                p1_stats: self.p1_stats.clone(),
                p2_stats: self.p2_stats.clone(),
            });
        }

        None
    }
}

pub type RoomMap = Arc<RwLock<std::collections::HashMap<String, Arc<RwLock<Room>>>>>;

pub fn generate_room_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    (0..5)
        .map(|_| {
            let idx = rng.gen_range(0..chars.len());
            chars[idx] as char
        })
        .collect()
}
