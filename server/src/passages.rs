use rand::seq::SliceRandom;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Passage {
    pub id: &'static str,
    pub title: &'static str,
    pub category: &'static str,
    pub text: &'static str,
}

pub const PASSAGES: &[Passage] = &[
    Passage {
        id: "cyberpunk_matrix",
        title: "Neuromancer: The Matrix",
        category: "cyberpunk",
        text: "The sky above the port was the color of television, tuned to a dead channel. Cyberspace: a consensual hallucination experienced daily by billions of legitimate operators, in every nation, by children being taught mathematical concepts. A graphic representation of data abstracted from banks of every computer in the human system. Lines of light ranged in the nonspace of the mind, clusters and constellations of data.",
    },
    Passage {
        id: "cyberpunk_blade_runner",
        title: "Tears in Rain Monologue",
        category: "cyberpunk",
        text: "I have seen things you people would not believe. Attack ships on fire off the shoulder of Orion. I watched C-beams glitter in the dark near the Tannhauser Gate. All those moments will be lost in time, like tears in rain. Time to ignite the thrusters, override the failsafe barriers, and cross the event horizon before the quantum singularity collapses forever.",
    },
    Passage {
        id: "scifi_dune",
        title: "Litany Against Fear",
        category: "scifi",
        text: "I must not fear. Fear is the mind-killer. Fear is the little-death that brings total obliteration. I will face my fear. I will permit it to pass over me and through me. And when it has gone past I will turn the inner eye to see its path. Where the fear has gone there will be nothing. Only I will remain.",
    },
    Passage {
        id: "scifi_turing",
        title: "Computing Machinery and Intelligence",
        category: "philosophy",
        text: "We can only see a short distance ahead, but we can see plenty there that needs to be done. Can machines think? I believe that at the end of the century the use of words and general educated opinion will have altered so much that one will be able to speak of machines thinking without expecting to be contradicted.",
    },
    Passage {
        id: "scifi_neural_duel",
        title: "Neural Overdrive Protocol",
        category: "cyberpunk",
        text: "Energy capacitors discharging at maximum surge. Two battle intelligences lock photon conduits across the orbital relay. Synthesizing data packets into kinetic resonance waves. The core temperature escalates beyond design parameters. Only flawless computational precision will rupture the opponent containment field and trigger a total beam cascade.",
    },
    Passage {
        id: "scifi_asimov",
        title: "The Last Question",
        category: "scifi",
        text: "Man considered because, in a way, it was the end of all things. The stars and galaxies died and snuffed out, and space grew black in the wake of ten trillion years of running down. The consciousness of Man fused with the cosmic supercomputer, and all the questions of the universe converged into a single point of light.",
    },
    Passage {
        id: "cyberpunk_ghost_shell",
        title: "Ghost in the Shell: Net Dive",
        category: "cyberpunk",
        text: "The net is vast and infinite. When our consciousness merges with the global information sea, boundaries between silicon memory and human intuition dissolve into pure signal. Every keystroke transmits a pulse across fiber optic arteries, racing past ice firewalls toward the central nexus core.",
    },
    Passage {
        id: "scifi_foundation",
        title: "Foundation: Psychohistory",
        category: "scifi",
        text: "The fall of Empire, gentlemen, is a massive thing, however, and not easily fought. It is dictated by a rising bureaucracy, a receding initiative, a freezing of caste, and a damming of curiosity. Only a disciplined synthesis of knowledge across the galaxy can shorten the dark age to a single millennium.",
    },
    Passage {
        id: "philosophy_digital_war",
        title: "The Art of Digital Velocity",
        category: "philosophy",
        text: "Speed without precision is mere noise in the void, yet hesitation surrenders the high ground before the first packet arrives. True mastery emerges when thought and motion fuse into an effortless rhythm, where fingers strike each key before conscious deliberation even begins.",
    },
    Passage {
        id: "coding_rust_memory",
        title: "Rust Ownership & Zero-Cost Abstractions",
        category: "coding",
        text: "Ownership rules guarantee memory safety without a garbage collector. Each value in Rust has a single owner, and when that owner goes out of scope the resource is deterministically dropped. Immutable references allow concurrent reads across threads, while mutable borrows enforce exclusive access at compile time.",
    },
    Passage {
        id: "coding_distributed_consensus",
        title: "Distributed Consensus & Event Loops",
        category: "coding",
        text: "High-frequency state synchronization requires non-blocking sockets, deterministic state machines, and zero-allocation serialization paths. By disabling Nagle buffering and batching outbound frames on the reactor loop, sub-millisecond telemetry streams across the network without head-of-line blocking.",
    },
    Passage {
        id: "coding_shader_pipeline",
        title: "WebGL Shader & Particle Pipeline",
        category: "coding",
        text: "Instanced buffer geometries upload vertex positions and velocity vectors directly to GPU memory. Fragment shaders evaluate additive neon bloom and exponential fog attenuation in parallel, sustaining locked frame pacing even during intense particle detonation bursts.",
    },
    Passage {
        id: "sprint_orbital_burst",
        title: "Orbital Strike Burst",
        category: "sprints",
        text: "Capacitors charged to maximum threshold. Lock target coordinates, bypass thermal limiters, and fire every photon cannon in a single relentless volley.",
    },
    Passage {
        id: "sprint_zero_day",
        title: "Zero-Day Kernel Breach",
        category: "sprints",
        text: "Inject the payload into ring zero before the watchdog timer resets. Every millisecond counts when racing an autonomous intrusion countermeasure.",
    },
    Passage {
        id: "sprint_quantum_overclock",
        title: "Quantum Relay Overclock",
        category: "sprints",
        text: "Override neural governors and push clock frequencies past redline. Pure velocity decides who holds the nexus bridge tonight.",
    },
];

pub fn get_passage_by_category(category: &str, custom_text: Option<&str>) -> (String, String, Vec<String>) {
    if let Some(custom) = custom_text {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            let words: Vec<String> = trimmed
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();
            if !words.is_empty() {
                return ("Custom Duel Text".to_string(), trimmed.to_string(), words);
            }
        }
    }

    let mut rng = rand::thread_rng();
    let matching: Vec<&Passage> = PASSAGES
        .iter()
        .filter(|p| category.eq_ignore_ascii_case("all") || p.category.eq_ignore_ascii_case(category))
        .collect();

    let selected = if let Some(p) = matching.choose(&mut rng) {
        *p
    } else {
        PASSAGES.choose(&mut rng).expect("PASSAGES catalog must not be empty")
    };

    let words: Vec<String> = selected
        .text
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    (selected.title.to_string(), selected.text.to_string(), words)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_passage_overrides_category() {
        let (title, text, words) = get_passage_by_category("cyberpunk", Some("  Hello   cyber   world!  "));
        assert_eq!(title, "Custom Duel Text");
        assert_eq!(text, "Hello   cyber   world!");
        assert_eq!(words, vec!["Hello", "cyber", "world!"]);
    }

    #[test]
    fn test_whitespace_only_custom_falls_back_to_category() {
        let (title, _text, words) = get_passage_by_category("coding", Some("   \n\t  "));
        assert_ne!(title, "Custom Duel Text");
        assert!(!words.is_empty());
    }

    #[test]
    fn test_all_categories_return_valid_passages() {
        for cat in &["cyberpunk", "scifi", "philosophy", "coding", "sprints", "all"] {
            let (title, text, words) = get_passage_by_category(cat, None);
            assert!(!title.is_empty());
            assert!(!text.is_empty());
            assert!(words.len() >= 15, "Category {} passage should have at least 15 words", cat);
        }
    }
}

