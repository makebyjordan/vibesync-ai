
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  ANALYZER = 'ANALYZER',
  HISTORY = 'HISTORY',
  NOTES = 'NOTES'
}

export type Language = 'en' | 'es';

export interface Recommendation {
  artist: string;
  title: string;
  reason: string;
  similarityScore: number; // 0-100
}

export interface AudioAnalysis {
  id: string;
  timestamp: number;
  detectedGenre: string;
  mood: string;
  tempo: string;
  keyElements: string[]; // e.g., "Syncopated bass", "Female vocals"
  vibeDescription: string;
  recommendations: Recommendation[];
}

export interface Note {
  id: string;
  timestamp: number;
  content: string;
  relatedAnalysisId?: string; // Optional link to a specific analysis
}

export interface AppState {
  history: AudioAnalysis[];
  notes: Note[];
}
