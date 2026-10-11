use crate::protocol::*;
use crate::room::Room;
use rand::Rng;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

pub fn spawn_bot_task(room_arc: Arc<RwLock<Room>>, difficulty: BotDifficulty) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Initial match countdown wait (3.5s)
        tokio::time::sleep(Duration::from_millis(3500)).await;

        let (target_wpm, error_rate) = match difficulty {
            BotDifficulty::Easy => (38.0, 0.08),
            BotDifficulty::Medium => (68.0, 0.04),
            BotDifficulty::Hard => (98.0, 0.015),
            BotDifficulty::CyberGod => (135.0, 0.00),
        };

        let words = {
            let r = room_arc.read().await;
            if r.state != crate::room::RoomState::Active {
                return;
            }
            r.words.clone()
        };

        let mut combo = 0;

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
            let char_count = word.chars().count().max(1);
            let char_step_ms = (delay_ms / (char_count as u64 + 1)).max(30);

            // Stream incremental character progress
            let mut aborted = false;
            for c_idx in 1..=char_count {
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
                    accuracy: if has_typo { 94.0 } else { 99.0 },
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
                word_copy,
                combo,
                target_wpm * jitter,
                if has_typo { 94.0 } else { 99.0 },
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
                accuracy: if has_typo { 94.0 } else { 99.0 },
                combo,
            });
        }
    })
}
