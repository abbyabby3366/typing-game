mod bot;
mod passages;
mod protocol;
mod room;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use protocol::*;
use room::*;
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::{mpsc, RwLock};
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub rooms: RoomMap,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "typing_clash_server=info,tower_http=info".into()),
        )
        .init();

    let state = AppState {
        rooms: Arc::new(RwLock::new(HashMap::new())),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/passages", get(get_passages))
        .route("/ws", get(ws_handler))
        .layer(cors)
        .with_state(state);

    let port: u16 = 4000;
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!(">>> Cyber Typist Rust Backend listening on ws://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind port 4000");

    // TCP_NODELAY disables Nagle's algorithm so small frames are sent immediately
    axum::serve(listener, app)
        .tcp_nodelay(true)
        .await
        .expect("Axum server crashed");
}

async fn health_check() -> &'static str {
    "CYBER_TYPIST_CORE_ONLINE"
}

async fn get_passages() -> impl IntoResponse {
    Json(passages::PASSAGES)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    let player_id = Uuid::new_v4().to_string();
    let mut current_room_code: Option<String> = None;
    let mut current_room_arc: Option<Arc<RwLock<Room>>> = None;
    let mut player_role: Option<PlayerRole> = None;

    // Task to forward outgoing server messages to WebSocket client.
    // Queued messages are drained and written with `feed`, then flushed once,
    // so bursts cost a single syscall instead of one per message.
    let send_task = tokio::spawn(async move {
        while let Some(first) = rx.recv().await {
            let mut next = Some(first);
            while let Some(msg) = next.take() {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if ws_sender.feed(Message::Text(json)).await.is_err() {
                        return;
                    }
                }
                next = rx.try_recv().ok();
            }
            if ws_sender.flush().await.is_err() {
                return;
            }
        }
    });

    // Handle incoming client messages
    while let Some(Ok(raw_msg)) = ws_receiver.next().await {
        let text = match raw_msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let client_msg: ClientMsg = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let _ = tx.send(ServerMsg::ErrorAlert {
                    message: format!("Malformed message protocol: {}", e),
                });
                continue;
            }
        };

        match client_msg {
            ClientMsg::CreateRoom {
                player_name,
                error_mode,
                category,
                custom_text,
            } => {
                let room_code = generate_room_code();
                let settings = GameSettings {
                    error_mode,
                    category,
                    custom_text,
                    max_push_distance: 1.0,
                };

                let session = PlayerSession {
                    id: player_id.clone(),
                    name: player_name,
                    role: PlayerRole::Player1,
                    tx: tx.clone(),
                };

                let room = Room::new(room_code.clone(), settings.clone(), session, false, None, None);
                let room_arc = Arc::new(RwLock::new(room));

                {
                    let mut rooms = state.rooms.write().await;
                    rooms.insert(room_code.clone(), room_arc.clone());
                }

                current_room_code = Some(room_code.clone());
                current_room_arc = Some(room_arc);
                player_role = Some(PlayerRole::Player1);

                let _ = tx.send(ServerMsg::RoomCreated {
                    room_code,
                    player_id: player_id.clone(),
                    role: PlayerRole::Player1,
                    settings,
                });
            }

            ClientMsg::UpdateRoomSettings {
                error_mode,
                category,
                custom_text,
            } => {
                if let (Some(ref room_arc), Some(PlayerRole::Player1)) = (&current_room_arc, player_role) {
                    let mut room = room_arc.write().await;
                    if room.state == RoomState::WaitingForOpponent {
                        room.settings.error_mode = error_mode;
                        room.settings.category = category.clone();
                        room.settings.custom_text = custom_text.clone();
                        let (title, text, words) = passages::get_passage_by_category(&category, custom_text.as_deref());
                        room.passage_title = title;
                        room.passage_text = text;
                        room.words = words;

                        let _ = tx.send(ServerMsg::RoomSettingsUpdated {
                            settings: room.settings.clone(),
                        });
                    }
                }
            }

            ClientMsg::StartBotMatch {
                player_name,
                bot_difficulty,
                custom_bot_wpm,
                error_mode,
                category,
                custom_text,
            } => {
                let room_code = format!("BOT-{}", generate_room_code());
                let settings = GameSettings {
                    error_mode,
                    category,
                    custom_text,
                    max_push_distance: 1.0,
                };

                let session = PlayerSession {
                    id: player_id.clone(),
                    name: player_name,
                    role: PlayerRole::Player1,
                    tx: tx.clone(),
                };

                let mut room = Room::new(
                    room_code.clone(),
                    settings.clone(),
                    session,
                    true,
                    Some(bot_difficulty),
                    custom_bot_wpm,
                );
                room.state = RoomState::Active;

                let title = room.passage_title.clone();
                let p_text = room.passage_text.clone();
                let words = room.words.clone();

                let room_arc = Arc::new(RwLock::new(room));
                let bot_handle = bot::spawn_bot_task(room_arc.clone(), bot_difficulty, custom_bot_wpm);
                {
                    let mut r = room_arc.write().await;
                    r.bot_abort_handle = Some(bot_handle);
                }

                {
                    let mut rooms = state.rooms.write().await;
                    rooms.insert(room_code.clone(), room_arc.clone());
                }

                current_room_code = Some(room_code.clone());
                current_room_arc = Some(room_arc);
                player_role = Some(PlayerRole::Player1);

                let _ = tx.send(ServerMsg::RoomCreated {
                    room_code,
                    player_id: player_id.clone(),
                    role: PlayerRole::Player1,
                    settings,
                });

                let _ = tx.send(ServerMsg::GameStarting {
                    countdown_seconds: 3,
                    passage_title: title,
                    passage_text: p_text,
                    words,
                });
            }

            ClientMsg::JoinRoom {
                room_code,
                player_name,
            } => {
                let code_upper = room_code.to_uppercase();
                let room_opt = {
                    let rooms = state.rooms.read().await;
                    rooms.get(&code_upper).cloned()
                };

                if let Some(room_arc) = room_opt {
                    let mut room = room_arc.write().await;
                    if room.p2.is_some() || room.state != RoomState::WaitingForOpponent {
                        let _ = tx.send(ServerMsg::ErrorAlert {
                            message: "Room is already full or battle in progress.".to_string(),
                        });
                        continue;
                    }

                    let p1_name = room
                        .p1
                        .as_ref()
                        .map(|p| p.name.clone())
                        .unwrap_or_else(|| "Player 1".to_string());

                    let session = PlayerSession {
                        id: player_id.clone(),
                        name: player_name.clone(),
                        role: PlayerRole::Player2,
                        tx: tx.clone(),
                    };

                    room.p2 = Some(session);
                    room.p2_stats.name = player_name.clone();
                    room.state = RoomState::Active;

                    current_room_code = Some(code_upper.clone());
                    current_room_arc = Some(room_arc.clone());
                    player_role = Some(PlayerRole::Player2);

                    let _ = tx.send(ServerMsg::RoomJoined {
                        room_code: code_upper.clone(),
                        player_id: player_id.clone(),
                        role: PlayerRole::Player2,
                        opponent_name: p1_name,
                        settings: room.settings.clone(),
                    });

                    // Notify Player 1 that opponent joined
                    if let Some(ref p1) = room.p1 {
                        let _ = p1.tx.send(ServerMsg::OpponentJoined {
                            opponent_name: player_name,
                        });
                    }

                    // Start match countdown
                    room.broadcast(ServerMsg::GameStarting {
                        countdown_seconds: 3,
                        passage_title: room.passage_title.clone(),
                        passage_text: room.passage_text.clone(),
                        words: room.words.clone(),
                    });
                } else {
                    let _ = tx.send(ServerMsg::ErrorAlert {
                        message: format!("Room code '{}' not found.", code_upper),
                    });
                }
            }

            ClientMsg::WordCompleted {
                word,
                combo,
                wpm,
                accuracy,
                ..
            } => {
                if let (Some(ref room_arc), Some(role)) = (&current_room_arc, player_role) {
                    let mut room = room_arc.write().await;
                    if let Some(game_over) = room.handle_word_completed(role, word, combo, wpm, accuracy) {
                        room.broadcast(game_over);
                    }
                }
            }

            ClientMsg::TypingProgress {
                char_index,
                word_index,
                wpm,
                accuracy,
                combo,
            } => {
                if let (Some(ref room_arc), Some(role)) = (&current_room_arc, player_role) {
                    let room = room_arc.read().await;
                    room.send_to_opponent(
                        role,
                        ServerMsg::OpponentProgressUpdate {
                            player_role: role,
                            char_index,
                            word_index,
                            wpm,
                            accuracy,
                            combo,
                        },
                    );
                }
            }

            ClientMsg::TypoPenalized { combo_lost } => {
                tracing::debug!("Player {:?} lost combo streak of {}", player_role, combo_lost);
            }

            ClientMsg::RequestRematch => {
                if let (Some(ref room_arc), Some(role)) = (&current_room_arc, player_role) {
                    let mut room = room_arc.write().await;
                    match role {
                        PlayerRole::Player1 => room.p1_rematch = true,
                        PlayerRole::Player2 => room.p2_rematch = true,
                    }

                    if room.is_bot_match || (room.p1_rematch && room.p2_rematch) {
                        // Reset state for new round
                        let (title, text, words) = passages::get_passage_by_category(
                            &room.settings.category,
                            room.settings.custom_text.as_deref(),
                        );
                        room.passage_title = title.clone();
                        room.passage_text = text.clone();
                        room.words = words.clone();
                        room.tug_position = 0.0;
                        room.state = RoomState::Active;
                        room.p1_rematch = false;
                        room.p2_rematch = false;
                        room.p1_stats.words_completed = 0;
                        room.p1_stats.chars_typed = 0;
                        room.p2_stats.words_completed = 0;
                        room.p2_stats.chars_typed = 0;

                        if room.is_bot_match {
                            if let Some(diff) = room.bot_difficulty {
                                let bot_handle = bot::spawn_bot_task(room_arc.clone(), diff, room.custom_bot_wpm);
                                room.bot_abort_handle = Some(bot_handle);
                            }
                        }

                        room.broadcast(ServerMsg::RematchAgreed {
                            countdown_seconds: 3,
                            passage_title: title,
                            passage_text: text,
                            words,
                        });
                    }
                }
            }

            ClientMsg::LeaveRoom => {
                break;
            }
        }
    }

    // Clean up room on player disconnect
    if let (Some(ref code), Some(ref room_arc), Some(role)) = (&current_room_code, &current_room_arc, player_role) {
        let mut should_remove = false;
        {
            let mut room = room_arc.write().await;
            if let Some(h) = room.bot_abort_handle.take() {
                h.abort();
            }
            match role {
                PlayerRole::Player1 => {
                    room.p1 = None;
                    room.broadcast(ServerMsg::OpponentLeft);
                }
                PlayerRole::Player2 => {
                    room.p2 = None;
                    room.broadcast(ServerMsg::OpponentLeft);
                }
            }
            if room.p1.is_none() && room.p2.is_none() {
                should_remove = true;
            }
        }

        if should_remove {
            let mut rooms = state.rooms.write().await;
            rooms.remove(code);
        }
    }

    let _ = send_task.await;
}
