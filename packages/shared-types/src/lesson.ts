import type { LanguageCode, Level } from './language.js';

export type ActivityType = 'story' | 'word_game' | 'talk_to_bobo' | 'grammar_quest' | 'reward';

export interface StoryActivity {
  type: 'story';
  durationSeconds: number;
  scenes: StoryScene[];
}

export interface StoryScene {
  imageUrl: string;
  text: string;
  audioUrl: string;
}

export interface WordGameActivity {
  type: 'word_game';
  durationSeconds: number;
  rounds: WordGameRound[];
}

export interface WordGameRound {
  imageUrl: string;
  correctWord: string;
  options: string[];
}

export interface TalkToBoboActivity {
  type: 'talk_to_bobo';
  durationSeconds: number;
  systemPrompt: string;
  topics: string[];
  targetPhrases: string[];
}

export interface GrammarQuestActivity {
  type: 'grammar_quest';
  durationSeconds: number;
  exercises: GrammarExercise[];
}

export interface GrammarExercise {
  kind: 'order_words' | 'pick_image' | 'fill_blank';
  prompt: string;
  options: string[];
  correctAnswer: string | string[];
}

export interface RewardActivity {
  type: 'reward';
  stars: number;
  collectibleId?: string;
  message: string;
}

export type Activity =
  | StoryActivity
  | WordGameActivity
  | TalkToBoboActivity
  | GrammarQuestActivity
  | RewardActivity;

export interface Lesson {
  id: string;
  language: LanguageCode;
  level: Level;
  day: number;
  theme: string;
  vocabulary: string[];
  activities: Activity[];
}
