/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * UI configuration, labels, colors, and component props.
 * These are NOT domain types; they're presentation/styling concerns.
 */

import type {
  PlayerPosition,
  PlayerStatus,
  PlayerCategory,
  FavoriteTeam,
} from './domain';

// --- PLAYER ATTRIBUTES FOR EVALUATIONS ---

export interface AttributeConfig {
  id: string;
  label: string;
  weight: number;
}

export const LINE_ATTRIBUTES: AttributeConfig[] = [
  { id: 'defesa', label: 'Defesa', weight: 0.15 },
  { id: 'passe', label: 'Passe', weight: 0.15 },
  { id: 'finalizacao', label: 'Finalização', weight: 0.15 },
  { id: 'velocidade', label: 'Velocidade', weight: 0.15 },
  { id: 'posicionamento', label: 'Posicionamento', weight: 0.15 },
  { id: 'drible', label: 'Drible', weight: 0.10 },
  { id: 'marcacao', label: 'Marcação', weight: 0.10 },
  { id: 'fisico', label: 'Físico', weight: 0.05 }
];

export const GOALKEEPER_ATTRIBUTES: AttributeConfig[] = [
  { id: 'reflexo', label: 'Reflexo', weight: 0.35 },
  { id: 'posicionamento', label: 'Posicionamento', weight: 0.25 },
  { id: 'saida_gol', label: 'Saída do Gol', weight: 0.20 },
  { id: 'reposicao', label: 'Reposição', weight: 0.20 }
];

// --- UI LABELS & COLORS ---

export const POSITION_LABELS: Record<PlayerPosition, string> = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  volante: 'Volante',
  meio_campo: 'Meio Campo',
  atacante: 'Atacante'
};

export const CATEGORY_LABELS: Record<PlayerCategory, string> = {
  mensalista: 'Mensalista',
  reserva: 'Reserva'
};

export const STATUS_LABELS: Record<PlayerStatus, string> = {
  disponivel: 'Disponível',
  indisponivel: 'Indisponível',
  lesionado: 'Lesionado',
  afastado: 'Afastado'
};

export const STATUS_COLORS: Record<PlayerStatus, string> = {
  disponivel: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  indisponivel: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  lesionado: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  afastado: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
};

// --- FAVORITE TEAMS (Shared reference) ---

export const FAVORITE_TEAMS: FavoriteTeam[] = [
  { id: 'fla', name: 'Flamengo', colorHex: '#e11d48' },
  { id: 'pal', name: 'Palmeiras', colorHex: '#16a34a' },
  { id: 'spa', name: 'São Paulo', colorHex: '#dc2626' },
  { id: 'cor', name: 'Corinthians', colorHex: '#18181b' },
  { id: 'flu', name: 'Fluminense', colorHex: '#86198f' },
  { id: 'vas', name: 'Vasco da Gama', colorHex: '#3f3f46' },
  { id: 'gre', name: 'Grêmio', colorHex: '#0284c7' },
  { id: 'int', name: 'Internacional', colorHex: '#dc2626' },
  { id: 'cam', name: 'Atlético Mineiro', colorHex: '#27272a' },
  { id: 'cru', name: 'Cruzeiro', colorHex: '#2563eb' },
  { id: 'san', name: 'Santos', colorHex: '#52525b' },
  { id: 'bot', name: 'Botafogo', colorHex: '#09090b' },
  { id: 'bah', name: 'Bahia', colorHex: '#0284c7' },
  { id: 'for', name: 'Fortaleza', colorHex: '#dc2626' },
  { id: 'cap', name: 'Athletico Paranaense', colorHex: '#be123c' },
  { id: 'cori', name: 'Coritiba', colorHex: '#15803d' },
  { id: 'spt', name: 'Sport Recife', colorHex: '#b91c1c' },
  { id: 'vit', name: 'Vitória', colorHex: '#b91c1c' },
  { id: 'out', name: 'Outro', colorHex: '#64748b' }
];
