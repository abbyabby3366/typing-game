export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  avgWpm: number;
  durationSec: number;
  audioUrl: string;
  genre: string;
  difficultyBadge: 'CHILL' | 'MODERATE' | 'BRISK' | 'INTENSE';
  lyrics: string;
}

export const SONG_CATALOG: SongTrack[] = [
  // --- CHILL & SLOW TIER (<60 WPM) ---
  {
    id: 'someone_like_you',
    title: 'Someone Like You',
    artist: 'Adele',
    avgWpm: 42,
    durationSec: 289,
    audioUrl: '/audio/songs/someone_like_you.mp3',
    genre: 'Soul Pop / Piano Ballad',
    difficultyBadge: 'CHILL',
    lyrics:
      "I heard that you're settled down, that you found a girl and you're married now. I heard that your dreams came true, guess she gave you things I didn't give to you. Old friend, why are you so shy? Ain't like you to hold back or hide from the light. Never mind, I'll find someone like you. I wish nothing but the best for you, too. Don't forget me, I beg, I'll remember you said, sometimes it lasts in love, but sometimes it hurts instead.",
  },
  {
    id: 'perfect',
    title: 'Perfect',
    artist: 'Ed Sheeran',
    avgWpm: 45,
    durationSec: 263,
    audioUrl: '/audio/songs/perfect.mp3',
    genre: 'Romantic Pop / Ballad',
    difficultyBadge: 'CHILL',
    lyrics:
      "I found a love for me. Oh, darling, just dive right in and follow my lead. Well, I found a girl, beautiful and sweet. Oh, I never knew you were the someone waiting for me. 'Cause we were just kids when we fell in love, not knowing what it was. I will not give you up this time. But darling, just kiss me slow, your heart is all I own, and in your eyes, you're holding mine.",
  },
  {
    id: 'ocean_eyes',
    title: 'Ocean Eyes',
    artist: 'Billie Eilish',
    avgWpm: 48,
    durationSec: 200,
    audioUrl: '/audio/songs/ocean_eyes.mp3',
    genre: 'Dream Pop / Chill',
    difficultyBadge: 'CHILL',
    lyrics:
      "I've been watchin' you for some time. Can't stop starin' at those ocean eyes. Burning cities and napalm skies, fifteen flares inside those ocean eyes. Your ocean eyes. No fair, you really know how to make me cry when you gimme those ocean eyes. I'm fallin' into your ocean eyes, those ocean eyes.",
  },
  {
    id: 'fly_me_to_the_moon',
    title: 'Fly Me to the Moon',
    artist: 'Frank Sinatra',
    avgWpm: 50,
    durationSec: 147,
    audioUrl: '/audio/songs/fly_me_to_the_moon.mp3',
    genre: 'Jazz / Big Band',
    difficultyBadge: 'CHILL',
    lyrics:
      "Fly me to the moon, let me play among the stars. Let me see what spring is like on a-Jupiter and Mars. In other words, hold my hand. In other words, baby, kiss me. Fill my heart with song and let me sing for ever more. You are all I long for, all I worship and adore. In other words, please be true. In other words, I love you.",
  },
  {
    id: 'stay_with_me',
    title: 'Stay With Me',
    artist: 'Sam Smith',
    avgWpm: 52,
    durationSec: 173,
    audioUrl: '/audio/songs/stay_with_me.mp3',
    genre: 'Soul / Gospel Pop',
    difficultyBadge: 'CHILL',
    lyrics:
      "Guess it's true, I'm not good at a one-night stand, but I still need love 'cause I'm just a man. These nights never seem to go to plan, I don't want you to leave, will you hold my hand? Oh, won't you stay with me? 'Cause you're all I need. This ain't love, it's clear to see, but darling, stay with me.",
  },
  {
    id: 'photograph',
    title: 'Photograph',
    artist: 'Ed Sheeran',
    avgWpm: 55,
    durationSec: 259,
    audioUrl: '/audio/songs/photograph.mp3',
    genre: 'Acoustic Pop',
    difficultyBadge: 'CHILL',
    lyrics:
      "Loving can hurt, loving can hurt sometimes, but it's the only thing that I know. When it gets hard, you know it can get hard sometimes, it is the only thing that makes us feel alive. We keep this love in a photograph, we made these memories for ourselves, where our eyes are never closing, hearts are never broken, and time's forever frozen, still.",
  },

  // --- MODERATE & POP TIER (60 - 79 WPM) ---
  {
    id: 'radioactive',
    title: 'Radioactive',
    artist: 'Imagine Dragons',
    avgWpm: 65,
    durationSec: 186,
    audioUrl: '/audio/songs/radioactive.mp3',
    genre: 'Electronic Rock',
    difficultyBadge: 'MODERATE',
    lyrics:
      "I'm waking up to ash and dust, I wipe my brow and I sweat my rust. I'm breathing in the chemicals. I'm breaking in, shaping up, then checking out on the prison bus. This is it, the apocalypse. Whoa, I'm waking up, I feel it in my bones, enough to make my systems blow. Welcome to the new age, to the new age. Welcome to the new age, to the new age. I'm radioactive, radioactive.",
  },
  {
    id: 'wake_me_up',
    title: 'Wake Me Up',
    artist: 'Avicii',
    avgWpm: 66,
    durationSec: 250,
    audioUrl: '/audio/songs/wake_me_up.mp3',
    genre: 'Folk Dance / EDM',
    difficultyBadge: 'MODERATE',
    lyrics:
      "Feeling my way through the darkness, guided by a beating heart. I can't tell where the journey will end, but I know where to start. They tell me I'm too young to understand, they say I'm caught up in a dream. Well life will pass me by if I don't open up my eyes, well that's fine by me. So wake me up when it's all over, when I'm wiser and I'm older. All this time I was finding myself, and I didn't know I was lost.",
  },
  {
    id: 'never_gonna_give_you_up',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    avgWpm: 68,
    durationSec: 213,
    audioUrl: '/audio/songs/never_gonna_give_you_up.mp3',
    genre: 'Classic Pop / 80s',
    difficultyBadge: 'MODERATE',
    lyrics:
      "We're no strangers to love. You know the rules and so do I. A full commitment's what I'm thinking of. You wouldn't get this from any other guy. I just wanna tell you how I'm feeling, gotta make you understand. Never gonna give you up, never gonna let you down, never gonna run around and desert you. Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you.",
  },
  {
    id: 'counting_stars',
    title: 'Counting Stars',
    artist: 'OneRepublic',
    avgWpm: 70,
    durationSec: 283,
    audioUrl: '/audio/songs/counting_stars.mp3',
    genre: 'Pop Rock',
    difficultyBadge: 'MODERATE',
    lyrics:
      "Lately, I've been, I've been losing sleep, dreaming about the things that we could be. But, baby, I've been, I've been praying hard, said no more counting dollars, we'll be counting stars. I see this life, like a swinging vine, swing my heart across the line, in my face is flashing signs, seek it out and ye shall find. Old, but I'm not that old. Young, but I'm not that bold.",
  },
  {
    id: 'take_on_me',
    title: 'Take On Me',
    artist: 'a-ha',
    avgWpm: 72,
    durationSec: 228,
    audioUrl: '/audio/songs/take_on_me.mp3',
    genre: '80s Synthpop',
    difficultyBadge: 'MODERATE',
    lyrics:
      "We're talking away, I don't know what I'm to say. I'll say it anyway, today's another day to find you shying away. I'll be coming for your love, okay? Take on me, take me on. I'll be gone in a day or two. So needless to say, I'm odds and ends, but I'll be stumbling away slowly learning that life is okay. Say after me, it's no better to be safe than sorry.",
  },
  {
    id: 'blinding_lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    avgWpm: 74,
    durationSec: 203,
    audioUrl: '/audio/songs/blinding_lights.mp3',
    genre: 'Synthwave / Pop',
    difficultyBadge: 'MODERATE',
    lyrics:
      "I've been trying to call. I've been on my own for long enough, maybe you can show me how to love, maybe. I'm going through withdrawals, you don't even have to do too much, you can turn me on with just a touch, baby. I look around and Sin City's cold and empty, no one's around to judge me. I can't see clearly when you're gone. I said, ooh, I'm blinded by the lights.",
  },
  {
    id: 'rolling_in_the_deep',
    title: 'Rolling in the Deep',
    artist: 'Adele',
    avgWpm: 76,
    durationSec: 227,
    audioUrl: '/audio/songs/rolling_in_the_deep.mp3',
    genre: 'Soul Rock / Pop',
    difficultyBadge: 'MODERATE',
    lyrics:
      "There's a fire starting in my heart, reaching a fever pitch and it's bringing me out the dark. Finally I can see you crystal clear, go ahead and sell me out and I'll lay your ship bare. See how I'll leave with every piece of you, don't underestimate the things that I will do. There's a fire starting in my heart, reaching a fever pitch and it's bringing me out the dark. The scars of your love remind me of us, they keep me thinking that we almost had it all.",
  },
  {
    id: 'bad_guy',
    title: 'Bad Guy',
    artist: 'Billie Eilish',
    avgWpm: 78,
    durationSec: 205,
    audioUrl: '/audio/songs/bad_guy.mp3',
    genre: 'Electropop / Bass Trap',
    difficultyBadge: 'MODERATE',
    lyrics:
      "White shirt now red, my bloody nose. Sleepin', you're on your tippy toes, creepin' around like no one knows. Think you're so criminal. Bruises on both my knees for you, don't say thank you or please. I do what I want when I'm wanting to, my soul so cynical. So you're a tough guy, like it really rough guy, just can't get enough guy, chest always so puffed guy. I'm that bad type, make your mama sad type, make your girlfriend mad tight, might seduce your dad type. I'm the bad guy, duh.",
  },

  // --- BRISK & ENERGETIC TIER (80 - 95 WPM) ---
  {
    id: 'harder_better_faster_stronger',
    title: 'Harder, Better, Faster, Stronger',
    artist: 'Daft Punk',
    avgWpm: 82,
    durationSec: 224,
    audioUrl: '/audio/songs/harder_better_faster_stronger.mp3',
    genre: 'Cyber Electronic',
    difficultyBadge: 'BRISK',
    lyrics:
      "Work it, make it, do it, makes us harder, better, faster, stronger. More than, hour, hour, never, ever, after, work is, over. Work it harder, make it better, do it faster, makes us stronger. More than ever, hour after hour, work is never over. Work it harder, make it better, do it faster, makes us stronger.",
  },
  {
    id: 'cant_stop_the_feeling',
    title: "Can't Stop the Feeling!",
    artist: 'Justin Timberlake',
    avgWpm: 84,
    durationSec: 236,
    audioUrl: '/audio/songs/cant_stop_the_feeling.mp3',
    genre: 'Disco Funk / Pop',
    difficultyBadge: 'BRISK',
    lyrics:
      "I got this feeling inside my bones, it goes electric, wavy when I turn it on. All through my city, all through my home, we're flying up, no ceiling, when we in our zone. I got that sunshine in my pocket, got that good soul in my feet. I feel that hot blood in my body when it drops, I can't take my eyes up off it, moving so phenomenally. Room on lock the way we rock it, so don't stop. Under the lights when everything goes, nowhere to hide when I'm getting you close.",
  },
  {
    id: 'viva_la_vida',
    title: 'Viva La Vida',
    artist: 'Coldplay',
    avgWpm: 86,
    durationSec: 241,
    audioUrl: '/audio/songs/viva_la_vida.mp3',
    genre: 'Baroque Pop / Rock',
    difficultyBadge: 'BRISK',
    lyrics:
      "I used to rule the world, seas would rise when I gave the word. Now in the morning I sleep alone, sweep the streets I used to own. I used to roll the dice, feel the fear in my enemy's eyes. Listen as the crowd would sing, now the old king is dead, long live the king. One minute I held the key, next the walls were closed on me, and I discovered that my castles stand upon pillars of salt and pillars of sand.",
  },
  {
    id: 'shape_of_you',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    avgWpm: 88,
    durationSec: 235,
    audioUrl: '/audio/songs/shape_of_you.mp3',
    genre: 'Tropical House / Pop',
    difficultyBadge: 'BRISK',
    lyrics:
      "The club isn't the best place to find a lover so the bar is where I go. Me and my friends at the table doing shots, drinking fast and then we talk slow. Come over and start up a conversation with just me, and trust me I'll give it a chance now. Took my hand, stop, put Van the Man on the jukebox, and then we start to dance. And now I'm singing like, girl, you know I want your love, your love was handmade for somebody like me.",
  },
  {
    id: 'believer',
    title: 'Believer',
    artist: 'Imagine Dragons',
    avgWpm: 90,
    durationSec: 217,
    audioUrl: '/audio/songs/believer.mp3',
    genre: 'Arena Rock',
    difficultyBadge: 'BRISK',
    lyrics:
      "First things first, I'ma say all the words inside my head. I'm fired up and tired of the way that things have been, oh-ooh. The way that things have been, oh-ooh. Second things second, don't you tell me what you think that I can be. I'm the one at the sail, I'm the master of my sea, oh-ooh. The master of my sea, oh-ooh. Pain! You make me a, you make me a believer, believer!",
  },
  {
    id: 'all_star',
    title: 'All Star',
    artist: 'Smash Mouth',
    avgWpm: 92,
    durationSec: 200,
    audioUrl: '/audio/songs/all_star.mp3',
    genre: 'Alt Rock / Pop',
    difficultyBadge: 'BRISK',
    lyrics:
      "Somebody once told me the world is gonna roll me, I ain't the sharpest tool in the shed. She was looking kind of dumb with her finger and her thumb in the shape of an L on her forehead. Well, the years start coming and they don't stop coming, fed to the rules and I hit the ground running. Didn't make sense not to live for fun, your brain gets smart but your head gets dumb. So much to do, so much to see, so what's wrong with taking the back streets?",
  },
  {
    id: 'uptown_funk',
    title: 'Uptown Funk',
    artist: 'Mark Ronson ft. Bruno Mars',
    avgWpm: 94,
    durationSec: 270,
    audioUrl: '/audio/songs/uptown_funk.mp3',
    genre: 'Funk Pop',
    difficultyBadge: 'BRISK',
    lyrics:
      "This hit, that ice cold, Michelle Pfeiffer, that white gold. This one for them hood girls, them good girls straight masterpieces. Stylin', wilin', livin' it up in the city, got Chucks on with Saint Laurent, gotta kiss myself, I'm so pretty. I'm too hot, hot damn, call the police and the fireman. I'm too hot, hot damn, make a dragon wanna retire man. I'm too hot, hot damn, say my name you know who I am. Girls hit your hallelujah, 'cause uptown funk gon' give it to you!",
  },

  // --- INTENSE TIER (96+ WPM) ---
  {
    id: 'dont_stop_me_now',
    title: "Don't Stop Me Now",
    artist: 'Queen',
    avgWpm: 98,
    durationSec: 205,
    audioUrl: '/audio/songs/dont_stop_me_now.mp3',
    genre: 'Classic Rock',
    difficultyBadge: 'INTENSE',
    lyrics:
      "Tonight, I'm gonna have myself a real good time. I feel alive and the world, I'll turn it inside out, yeah. I'm floating around in ecstasy, so don't stop me now, don't stop me, 'cause I'm having a good time, having a good time. I'm a shooting star, leaping through the sky like a tiger defying the laws of gravity. I'm a racing car passing by, like Lady Godiva, I'm gonna go, go, go, there's no stopping me.",
  },
  {
    id: 'lose_yourself',
    title: 'Lose Yourself',
    artist: 'Eminem',
    avgWpm: 105,
    durationSec: 319,
    audioUrl: '/audio/songs/lose_yourself.mp3',
    genre: 'Hip Hop / Rap',
    difficultyBadge: 'INTENSE',
    lyrics:
      "Look, if you had one shot, or one opportunity to seize everything you ever wanted in one moment, would you capture it, or just let it slip? Yo, his palms are sweaty, knees weak, arms are heavy, there's vomit on his sweater already, mom's spaghetti. He's nervous, but on the surface he looks calm and ready to drop bombs, but he keeps on forgetting what he wrote down. The whole crowd goes so loud, he opens his mouth, but the words won't come out. He's chokin', how? Everybody's jokin' now, the clocks run out, times up, over, blaow!",
  },
  {
    id: 'technologic',
    title: 'Technologic',
    artist: 'Daft Punk',
    avgWpm: 112,
    durationSec: 284,
    audioUrl: '/audio/songs/technologic.mp3',
    genre: 'Cyber Electro / Vocoder',
    difficultyBadge: 'INTENSE',
    lyrics:
      "Buy it, use it, break it, fix it, trash it, change it, mail, upgrade it. Charge it, point it, zoom it, press it, snap it, work it, quick, erase it. Write it, cut it, paste it, save it, load it, check it, quit, rewrite it. Scroll it, surf it, browse it, pause it, cross it, click it, work it, update it. Name it, read it, tune it, print it, scan it, send it, fax, rename it. Touch it, bring it, pay it, watch it, turn it, leave it, start, format it.",
  },
];
