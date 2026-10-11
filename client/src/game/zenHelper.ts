import { SongTrack } from './songCatalog';
import { getPassageByCategory } from './passages';

export interface ZenPassageData {
  title: string;
  text: string;
  words: string[];
}

export function buildZenPassage(
  category: string,
  customText: string | null,
  selectedSong?: SongTrack | null
): ZenPassageData {
  if (selectedSong) {
    return {
      title: `${selectedSong.title} - ${selectedSong.artist} (${selectedSong.avgWpm} WPM)`,
      text: selectedSong.lyrics,
      words: selectedSong.lyrics.split(/\s+/).filter(Boolean),
    };
  }

  if (customText && customText.trim()) {
    const trimmed = customText.trim();
    return {
      title: 'Custom Practice Passage',
      text: trimmed,
      words: trimmed.split(/\s+/).filter(Boolean),
    };
  }

  const p = getPassageByCategory(category);
  return {
    title: p.title,
    text: p.text,
    words: p.words,
  };
}
