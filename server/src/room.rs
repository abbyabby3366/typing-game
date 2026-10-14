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
    pub p1_word_index: usize,
    pub p2_word_index: usize,
    pub p1_scored_words: Vec<bool>,
    pub p2_scored_words: Vec<bool>,
    pub p1_rematch: bool,
    pub p2_rematch: bool,
    pub bot_abort_handle: Option<tokio::task::JoinHandle<()>>,
}

impl Room {
    pub fn format_bot_name(bot_difficulty: Option<BotDifficulty>, custom_bot_wpm: Option<u32>) -> String {
        match bot_difficulty {
            Some(BotDifficulty::Easy) => "DRONE-ALPHA (40 WPM)".to_string(),
            Some(BotDifficulty::Medium) | None => "NEXUS-V2 (70 WPM)".to_string(),
            Some(BotDifficulty::Hard) => "CYBER-VIPER (100 WPM)".to_string(),
            Some(BotDifficulty::CyberGod) => "QUANTUM-GOD (135 WPM)".to_string(),
            Some(BotDifficulty::Custom) => {
                let w = custom_bot_wpm.unwrap_or(75).clamp(15, 250);
                format!("CUSTOM-AI ({} WPM)", w)
            }
        }
    }

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
        let words_len = words.len();
        let bot_label = if is_bot_match {
            Some(Self::format_bot_name(bot_difficulty, custom_bot_wpm))
        } else {
            None
        };

        Self {
            code,
            settings,
            state: if is_bot_match {
                RoomState::Starting
            } else {
                RoomState::WaitingForOpponent
            },
            p1: Some(p1),
            p2: bot_label.as_ref().map(|b_name| {
                let (dummy_tx, _) = mpsc::unbounded_channel();
                PlayerSession {
                    id: "ai-bot".to_string(),
                    name: b_name.clone(),
                    role: PlayerRole::Player2,
                    tx: dummy_tx,
                }
            }),
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
                name: bot_label.unwrap_or_else(|| "Opponent".to_string()),
                wpm: 0.0,
                accuracy: 100.0,
                max_combo: 0,
                words_completed: 0,
                chars_typed: 0,
            },
            p1_word_index: 0,
            p2_word_index: 0,
            p1_scored_words: vec![false; words_len],
            p2_scored_words: vec![false; words_len],
            p1_rematch: false,
            p2_rematch: false,
            bot_abort_handle: None,
        }
    }

    pub fn broadcast(&self, msg: ServerMsg) {
        if self.is_bot_match || self.p2.is_none() {
            if let Some(ref p1) = self.p1 {
                let _ = p1.tx.send(msg);
            }
        } else {
            if let Some(ref p1) = self.p1 {
                let _ = p1.tx.send(msg.clone());
            }
            if let Some(ref p2) = self.p2 {
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

    pub fn handle_typing_progress(
        &mut self,
        role: PlayerRole,
        wpm: f32,
        accuracy: f32,
        combo: u32,
    ) -> (f32, f32, u32) {
        let clean_wpm = if wpm.is_finite() { wpm.clamp(0.0, 400.0) } else { 0.0 };
        let clean_acc = if accuracy.is_finite() { accuracy.clamp(0.0, 100.0) } else { 100.0 };
        let clean_combo = combo.min((self.words.len() as u32).saturating_add(1));

        if self.state == RoomState::Active {
            let stats = match role {
                PlayerRole::Player1 => &mut self.p1_stats,
                PlayerRole::Player2 => &mut self.p2_stats,
            };
            stats.wpm = clean_wpm;
            stats.accuracy = clean_acc;
            if clean_combo > stats.max_combo {
                stats.max_combo = clean_combo;
            }
        }

        (clean_wpm, clean_acc, clean_combo)
    }

    pub fn handle_word_completed(
        &mut self,
        role: PlayerRole,
        word_index: usize,
        word: String,
        combo: u32,
        wpm: f32,
        accuracy: f32,
        is_correct: bool,
    ) -> Option<ServerMsg> {
        if self.state != RoomState::Active {
            return None;
        }

        if word_index >= self.words.len() {
            return None;
        }

        let (current_player_idx, already_scored) = match role {
            PlayerRole::Player1 => (
                self.p1_word_index,
                self.p1_scored_words.get(word_index).copied().unwrap_or(true),
            ),
            PlayerRole::Player2 => (
                self.p2_word_index,
                self.p2_scored_words.get(word_index).copied().unwrap_or(true),
            ),
        };
        if word_index > current_player_idx || already_scored {
            return None;
        }

        let expected_word = &self.words[word_index];
        let verified_correct = is_correct && word == *expected_word;

        // If re-submitting a previously skipped word (word_index < current_player_idx), only accept if now corrected
        if word_index < current_player_idx && !verified_correct {
            return None;
        }

        let clean_wpm = if wpm.is_finite() { wpm.clamp(0.0, 400.0) } else { 0.0 };
        let clean_acc = if accuracy.is_finite() { accuracy.clamp(0.0, 100.0) } else { 100.0 };
        let clean_combo = combo.min((self.words.len() as u32).saturating_add(1));

        let push_power = if verified_correct {
            let total_words = self.words.len().max(20) as f32;
            let base_divisor = (total_words * 3.2).clamp(160.0, 260.0);
            let word_len = expected_word.chars().count().max(3) as f32;
            let combo_mult = 1.0 + (clean_combo as f32 * 0.08).min(1.8);
            (word_len / base_divisor) * combo_mult
        } else {
            0.0
        };

        // Skipping a mistyped word in AllowErrors mode applies a recoil penalty
        // so spamming Spacebar pushes the beam against the skipper rather than freezing it.
        let skip_recoil = if verified_correct { 0.0 } else { 0.035 };

        let (stats, current_idx, scored_words) = match role {
            PlayerRole::Player1 => {
                self.tug_position -= push_power;
                self.tug_position += skip_recoil;
                (&mut self.p1_stats, &mut self.p1_word_index, &mut self.p1_scored_words)
            }
            PlayerRole::Player2 => {
                self.tug_position += push_power;
                self.tug_position -= skip_recoil;
                (&mut self.p2_stats, &mut self.p2_word_index, &mut self.p2_scored_words)
            }
        };

        let next_idx = word_index.saturating_add(1);
        if next_idx > *current_idx {
            *current_idx = next_idx;
        }

        if verified_correct && stats.words_completed < self.words.len() {
            if let Some(slot) = scored_words.get_mut(word_index) {
                *slot = true;
            }
            stats.words_completed += 1;
            stats.chars_typed += expected_word.chars().count();
            if clean_combo > stats.max_combo {
                stats.max_combo = clean_combo;
            }
        }
        stats.wpm = clean_wpm;
        stats.accuracy = clean_acc;

        // Clamp tug position
        self.tug_position = self.tug_position.clamp(-1.0, 1.0);

        let word_fired_msg = ServerMsg::WordFired {
            player_role: role,
            word,
            combo: if verified_correct { clean_combo } else { 0 },
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

        // Check victory by passage completion.
        // Require that a single player ending the match early has legitimately typed at least
        // half of the passage words correctly; or if both players have exhausted the passage,
        // terminate so the room can never deadlock.
        let total_words = self.words.len();
        let p1_finished = self.p1_word_index >= total_words
            && self.p1_stats.words_completed * 2 >= total_words;
        let p2_finished = self.p2_word_index >= total_words
            && self.p2_stats.words_completed * 2 >= total_words;
        let both_exhausted = self.p1_word_index >= total_words && self.p2_word_index >= total_words;

        if p1_finished || p2_finished || both_exhausted {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_active_room(custom_text: Option<&str>) -> Room {
        let (tx, _rx) = mpsc::unbounded_channel();
        let p1 = PlayerSession {
            id: "p1".to_string(),
            name: "ALICE".to_string(),
            role: PlayerRole::Player1,
            tx,
        };
        let settings = GameSettings {
            error_mode: ErrorMode::AllowErrors,
            category: "cyberpunk".to_string(),
            custom_text: custom_text.map(|s| s.to_string()),
            max_push_distance: 1.0,
        };
        let mut room = Room::new(
            "TEST1".to_string(),
            settings,
            p1,
            true,
            Some(BotDifficulty::Hard),
            None,
        );
        room.state = RoomState::Active;
        room
    }

    #[test]
    fn test_bot_name_populated_in_p2_stats() {
        let room = make_active_room(None);
        assert_eq!(room.p2_stats.name, "CYBER-VIPER (100 WPM)");
    }

    #[test]
    fn test_spacebar_spam_does_not_win_match() {
        let mut room = make_active_room(Some("one two three four five six"));
        // P1 completes word 0 legitimately
        let res = room.handle_word_completed(PlayerRole::Player1, 0, "one".to_string(), 1, 80.0, 100.0, true);
        assert!(res.is_none());
        assert!(room.tug_position < 0.0);

        // Now P1 spams 5 incorrect words to the end of the passage
        for idx in 1..6 {
            let msg = room.handle_word_completed(PlayerRole::Player1, idx, "xxx".to_string(), 0, 80.0, 20.0, false);
            assert!(msg.is_none(), "Spamming wrong words should not trigger early victory at idx {}", idx);
        }
        // Only 1 correct word should be recorded, and tug_position should have recoiled toward P2
        assert_eq!(room.p1_stats.words_completed, 1);
        assert!(room.tug_position > 0.0, "Skipping 5 words with errors should recoil tug toward P2");
    }

    #[test]
    fn test_legitimate_passage_completion_triggers_game_over() {
        let mut room = make_active_room(Some("alpha beta gamma delta"));
        let words = room.words.clone();
        let mut final_msg = None;
        for (i, w) in words.iter().enumerate() {
            final_msg = room.handle_word_completed(PlayerRole::Player1, i, w.clone(), (i + 1) as u32, 95.0, 100.0, true);
        }
        match final_msg {
            Some(ServerMsg::GameOver { winner, reason, p1_stats, .. }) => {
                assert_eq!(winner, Some(PlayerRole::Player1));
                assert_eq!(reason, GameOverReason::PassageCompleted);
                assert_eq!(p1_stats.words_completed, 4);
                assert_eq!(p1_stats.max_combo, 4);
            }
            other => panic!("Expected GameOver, got {:?}", other),
        }
    }

    #[test]
    fn test_nan_telemetry_sanitized() {
        let mut room = make_active_room(Some("alpha beta"));
        room.handle_word_completed(PlayerRole::Player1, 0, "alpha".to_string(), 1, f32::NAN, f32::INFINITY, true);
        assert_eq!(room.p1_stats.wpm, 0.0);
        assert_eq!(room.p1_stats.accuracy, 100.0);
    }

    #[test]
    fn test_forged_packets_and_skip_to_last_word_rejected() {
        let mut room = make_active_room(Some("one two three four five six"));
        // Out-of-order jump ahead (word_index = 5 when current is 0) must be ignored
        let jump = room.handle_word_completed(PlayerRole::Player1, 5, "six".to_string(), 1, 90.0, 100.0, true);
        assert!(jump.is_none());
        assert_eq!(room.p1_word_index, 0);

        // Forged is_correct=true with wrong text must be treated as incorrect
        room.handle_word_completed(PlayerRole::Player1, 0, "forged".to_string(), 50, 90.0, 100.0, true);
        assert_eq!(room.p1_stats.words_completed, 0);
        assert!(room.tug_position > 0.0);

        // Skipping words 1..4 and typing only final word 5 correctly still has <50% words_completed (1/6)
        for idx in 1..5 {
            room.handle_word_completed(PlayerRole::Player1, idx, "x".to_string(), 0, 50.0, 10.0, false);
        }
        let last = room.handle_word_completed(PlayerRole::Player1, 5, "six".to_string(), 1, 80.0, 50.0, true);
        assert!(last.is_none(), "Completing only 1 of 6 words must not end the match by PassageCompleted");

        // Going back and fixing skipped words (idx 1 and idx 2) reaches 3/6 (>= 50%) and completes the passage
        let fix1 = room.handle_word_completed(PlayerRole::Player1, 1, "two".to_string(), 2, 82.0, 65.0, true);
        assert!(fix1.is_none());
        let fix2 = room.handle_word_completed(PlayerRole::Player1, 2, "three".to_string(), 3, 85.0, 75.0, true);
        match fix2 {
            Some(ServerMsg::GameOver { reason, p1_stats, .. }) => {
                assert_eq!(reason, GameOverReason::PassageCompleted);
                assert_eq!(p1_stats.words_completed, 3);
            }
            other => panic!("Expected GameOver after fixing skipped words to reach 50%, got {:?}", other),
        }
    }

    #[test]
    fn test_mutual_exhaustion_prevents_room_deadlock() {
        let mut room = make_active_room(Some("one two three four"));
        for idx in 0..4 {
            assert!(room.handle_word_completed(PlayerRole::Player1, idx, "x".to_string(), 0, 40.0, 10.0, false).is_none());
        }
        for idx in 0..3 {
            assert!(room.handle_word_completed(PlayerRole::Player2, idx, "x".to_string(), 0, 40.0, 10.0, false).is_none());
        }
        let end = room.handle_word_completed(PlayerRole::Player2, 3, "x".to_string(), 0, 40.0, 10.0, false);
        assert!(matches!(end, Some(ServerMsg::GameOver { reason: GameOverReason::PassageCompleted, .. })));
    }

    #[test]
    fn test_handle_typing_progress_updates_live_stats() {
        let mut room = make_active_room(Some("alpha beta"));
        let (wpm, acc, combo) = room.handle_typing_progress(PlayerRole::Player1, 112.5, 88.0, 3);
        assert_eq!(wpm, 112.5);
        assert_eq!(acc, 88.0);
        assert_eq!(combo, 3);
        assert_eq!(room.p1_stats.wpm, 112.5);
        assert_eq!(room.p1_stats.accuracy, 88.0);
        assert_eq!(room.p1_stats.max_combo, 3);
    }
}

