use crate::protocol::*;
use crate::room::Room;
use rand::Rng;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

pub fn spawn_bot_task(
    room_arc: Arc<RwLock<Room>>,
    difficulty: BotDifficulty,
    custom_wpm: Option<u32>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Wait out the 3s client countdown (3 → 2 → 1 → ENGAGE)
        tokio::time::sleep(Duration::from_millis(3000)).await;

        let (target_wpm, error_rate) = match difficulty {
            BotDifficulty::Easy => (38.0, 0.08),
            BotDifficulty::Medium => (68.0, 0.04),
            BotDifficulty::Hard => (98.0, 0.015),
            BotDifficulty::CyberGod => (135.0, 0.00),
            BotDifficulty::Custom => {
                let w = (custom_wpm.unwrap_or(75) as f32).clamp(15.0, 250.0);
                let err = if w < 50.0 {
                    0.06
                } else if w < 90.0 {
                    0.03
                } else {
                    0.01
                };
                (w, err)
            }
        };

        let words = {
            let r = room_arc.read().await;
            if r.state != crate::room::RoomState::Active {
                return;
            }
            r.words.clone()
        };

        let mut combo = 0;
        let mut total_chars_typed: usize = 0;
        let mut total_typos: usize = 0;

        for (idx, word) in words.iter().enumerate() {
            // Check if game is still active
            {
                let r = room_arc.read().await;
                if r.state != crate::room::RoomState::Active {
                    break;
                }
            }

            // Word length in standard 5-char units
            let char_count = word.chars().count() + 1; // plus space
            let base_secs = (char_count as f32 / 5.0) / (target_wpm / 60.0);
            
            // Generate jitter without holding rng across await
            let (jitter, has_typo) = {
                let mut rng = rand::thread_rng();
                let j: f32 = rng.gen_range(0.85..1.18);
                let typo: bool = rng.gen_bool(error_rate);
                (j, typo)
            };

            let delay_ms = ((base_secs * jitter * 1000.0) as u64).max(250);
            let word_chars = word.chars().count().max(1);
            let char_step_ms = (delay_ms / (word_chars as u64 + 1)).max(30);

            total_chars_typed += char_count;
            if has_typo {
                total_typos += 1;
            }
            let live_accuracy = (((total_chars_typed.saturating_sub(total_typos)) as f32
                / (total_chars_typed.max(1) as f32))
                * 100.0)
                .clamp(50.0, 100.0);

            // Stream incremental character progress
            let mut aborted = false;
            for c_idx in 1..=word_chars {
                tokio::time::sleep(Duration::from_millis(char_step_ms)).await;
                let r = room_arc.read().await;
                if r.state != crate::room::RoomState::Active {
                    aborted = true;
                    break;
                }
                r.broadcast(ServerMsg::OpponentProgressUpdate {
                    player_role: PlayerRole::Player2,
                    char_index: c_idx,
                    word_index: idx,
                    wpm: target_wpm * jitter,
                    accuracy: live_accuracy,
                    combo,
                });
            }

            if aborted {
                break;
            }

            // Trailing space delay
            tokio::time::sleep(Duration::from_millis(char_step_ms)).await;

            if has_typo {
                combo = 0;
                // Simulate backspacing and fixing the typo before completing the word
                tokio::time::sleep(Duration::from_millis(200)).await;
            } else {
                combo += 1;
            }

            // Progress update and word completion
            let mut room = room_arc.write().await;
            if room.state != crate::room::RoomState::Active {
                break;
            }

            let word_copy = word.clone();
            let game_over_msg = room.handle_word_completed(
                PlayerRole::Player2,
                idx,
                word_copy,
                combo,
                target_wpm * jitter,
                live_accuracy,
                true,
            );

            if let Some(msg) = game_over_msg {
                room.broadcast(msg);
                break;
            }

            // Broadcast final word progress update
            room.broadcast(ServerMsg::OpponentProgressUpdate {
                player_role: PlayerRole::Player2,
                char_index: 0,
                word_index: idx + 1,
                wpm: target_wpm * jitter,
                accuracy: live_accuracy,
                combo,
            });
        }
    })
}
