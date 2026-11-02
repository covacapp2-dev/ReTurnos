// Deportes soportados por el modo "Complejo deportivo"
export interface SportDef {
  emoji: string;
  label: string;
  description: string;
}

export const SPORTS: SportDef[] = [
  { emoji: '⚽', label: 'Fútbol', description: 'Canchas de fútbol 5, 7 y 11' },
  { emoji: '🏓', label: 'Pádel', description: 'Canchas de pádel' },
  { emoji: '🎾', label: 'Tenis', description: 'Canchas de tenis' },
  { emoji: '🏐', label: 'Vóley', description: 'Canchas de vóley' },
  { emoji: '🏀', label: 'Básquet', description: 'Canchas de básquet' },
  { emoji: '🏑', label: 'Hockey', description: 'Canchas de hockey' },
];

export const sportEmoji = (label: string): string =>
  SPORTS.find((s) => s.label === label)?.emoji ?? '🏟️';
