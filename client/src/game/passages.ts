interface Passage {
  id: string;
  title: string;
  category: string;
  text: string;
  words: string[];
}

const CURATED_PASSAGES: Omit<Passage, 'words'>[] = [
  {
    id: 'cyberpunk_matrix',
    title: 'Neuromancer: The Matrix',
    category: 'cyberpunk',
    text: 'The sky above the port was the color of television, tuned to a dead channel. Cyberspace: a consensual hallucination experienced daily by billions of legitimate operators, in every nation, by children being taught mathematical concepts. A graphic representation of data abstracted from banks of every computer in the human system. Lines of light ranged in the nonspace of the mind, clusters and constellations of data.',
  },
  {
    id: 'cyberpunk_blade_runner',
    title: 'Tears in Rain Monologue',
    category: 'cyberpunk',
    text: 'I have seen things you people would not believe. Attack ships on fire off the shoulder of Orion. I watched C-beams glitter in the dark near the Tannhauser Gate. All those moments will be lost in time, like tears in rain. Time to ignite the thrusters, override the failsafe barriers, and cross the event horizon before the quantum singularity collapses forever.',
  },
  {
    id: 'scifi_dune',
    title: 'Litany Against Fear',
    category: 'scifi',
    text: 'I must not fear. Fear is the mind-killer. Fear is the little-death that brings total obliteration. I will face my fear. I will permit it to pass over me and through me. And when it has gone past I will turn the inner eye to see its path. Where the fear has gone there will be nothing. Only I will remain.',
  },
  {
    id: 'scifi_turing',
    title: 'Computing Machinery and Intelligence',
    category: 'philosophy',
    text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done. Can machines think? I believe that at the end of the century the use of words and general educated opinion will have altered so much that one will be able to speak of machines thinking without expecting to be contradicted.',
  },
  {
    id: 'scifi_neural_duel',
    title: 'Neural Overdrive Protocol',
    category: 'cyberpunk',
    text: 'Energy capacitors discharging at maximum surge. Two battle intelligences lock photon conduits across the orbital relay. Synthesizing data packets into kinetic resonance waves. The core temperature escalates beyond design parameters. Only flawless computational precision will rupture the opponent containment field and trigger a total beam cascade.',
  },
  {
    id: 'scifi_asimov',
    title: 'The Last Question',
    category: 'scifi',
    text: 'Man considered because, in a way, it was the end of all things. The stars and galaxies died and snuffed out, and space grew black in the wake of ten trillion years of running down. The consciousness of Man fused with the cosmic supercomputer, and all the questions of the universe converged into a single point of light.',
  },
  {
    id: 'cyberpunk_ghost_shell',
    title: 'Ghost in the Shell: Net Dive',
    category: 'cyberpunk',
    text: 'The net is vast and infinite. When our consciousness merges with the global information sea, boundaries between silicon memory and human intuition dissolve into pure signal. Every keystroke transmits a pulse across fiber optic arteries, racing past ice firewalls toward the central nexus core.',
  },
  {
    id: 'scifi_foundation',
    title: 'Foundation: Psychohistory',
    category: 'scifi',
    text: 'The fall of Empire, gentlemen, is a massive thing, however, and not easily fought. It is dictated by a rising bureaucracy, a receding initiative, a freezing of caste, and a damming of curiosity. Only a disciplined synthesis of knowledge across the galaxy can shorten the dark age to a single millennium.',
  },
  {
    id: 'philosophy_digital_war',
    title: 'The Art of Digital Velocity',
    category: 'philosophy',
    text: 'Speed without precision is mere noise in the void, yet hesitation surrenders the high ground before the first packet arrives. True mastery emerges when thought and motion fuse into an effortless rhythm, where fingers strike each key before conscious deliberation even begins.',
  },
  {
    id: 'coding_rust_memory',
    title: 'Rust Ownership & Zero-Cost Abstractions',
    category: 'coding',
    text: 'Ownership rules guarantee memory safety without a garbage collector. Each value in Rust has a single owner, and when that owner goes out of scope the resource is deterministically dropped. Immutable references allow concurrent reads across threads, while mutable borrows enforce exclusive access at compile time.',
  },
  {
    id: 'coding_distributed_consensus',
    title: 'Distributed Consensus & Event Loops',
    category: 'coding',
    text: 'High-frequency state synchronization requires non-blocking sockets, deterministic state machines, and zero-allocation serialization paths. By disabling Nagle buffering and batching outbound frames on the reactor loop, sub-millisecond telemetry streams across the network without head-of-line blocking.',
  },
  {
    id: 'coding_shader_pipeline',
    title: 'WebGL Shader & Particle Pipeline',
    category: 'coding',
    text: 'Instanced buffer geometries upload vertex positions and velocity vectors directly to GPU memory. Fragment shaders evaluate additive neon bloom and exponential fog attenuation in parallel, sustaining locked frame pacing even during intense particle detonation bursts.',
  },
  {
    id: 'sprint_orbital_burst',
    title: 'Orbital Strike Burst',
    category: 'sprints',
    text: 'Capacitors charged to maximum threshold. Lock target coordinates, bypass thermal limiters, and fire every photon cannon in a single relentless volley.',
  },
  {
    id: 'sprint_zero_day',
    title: 'Zero-Day Kernel Breach',
    category: 'sprints',
    text: 'Inject the payload into ring zero before the watchdog timer resets. Every millisecond counts when racing an autonomous intrusion countermeasure.',
  },
  {
    id: 'sprint_quantum_overclock',
    title: 'Quantum Relay Overclock',
    category: 'sprints',
    text: 'Override neural governors and push clock frequencies past redline. Pure velocity decides who holds the nexus bridge tonight.',
  },
];

export function getPassageByCategory(
  category: string,
  customText?: string | null
): { title: string; text: string; words: string[] } {
  if (customText) {
    const trimmed = customText.trim();
    if (trimmed.length > 0) {
      const words = trimmed.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        return { title: 'Custom Duel Text', text: trimmed, words };
      }
    }
  }

  const matching = CURATED_PASSAGES.filter(
    (p) => category.toLowerCase() === 'all' || p.category.toLowerCase() === category.toLowerCase()
  );

  const pool = matching.length > 0 ? matching : CURATED_PASSAGES;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const words = picked.text.split(/\s+/).filter(Boolean);

  return { title: picked.title, text: picked.text, words };
}
