/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'auxiliar' | 'jogador';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  playerId: string;
  athlete_id: string;
}

export type PlayerCategory = 'mensalista' | 'reserva';

export type PlayerStatus = 'disponivel' | 'indisponivel' | 'lesionado' | 'afastado';

export type PlayerPosition = 'goleiro' | 'zagueiro' | 'volante' | 'meio_campo' | 'atacante';

export interface Player {
  id: string;
  name: string;
  email?: string;
  phone: string;
  photoOriginal: string;
  playerCardUrl: string;
  favoriteTeamId: string;
  category: PlayerCategory;
  status: PlayerStatus;
  statusStartDate?: string; // ISO date YYYY-MM-DD
  statusEndDate?: string;   // ISO date YYYY-MM-DD
  primaryPosition: PlayerPosition;
  secondaryPositions: PlayerPosition[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete
  currentStreak?: number;
  maxStreak?: number;
  adminNotes?: string;
  
  // Custom Avatar and FUT card properties
  timeDoCoracao?: string;
  numeroFavorito?: number;
  peDominante?: string;
  avatarOriginal?: string;
  avatarEsportivo?: string;
  avatarCard?: string;
  avatarStatus?: 'PENDENTE' | 'PROCESSANDO' | 'CONCLUÍDO' | 'ERRO';
  avatarVersion?: number;
}

export interface PlayerEvaluation {
  id: string;
  evaluatorUserId: string;
  targetPlayerId: string;
  date: string; // ISO Date YYYY-MM-DD
  ratings: Record<string, number>; // defesa, passe, finalizacao, etc.
}

export interface PlayerHistoryEntry {
  playerId: string;
  date: string; // YYYY-MM-DD
  overall: number;
}

// Weights configurations as requested
export const LINE_ATTRIBUTES = [
  { id: 'defesa', label: 'Defesa', weight: 0.15 },
  { id: 'passe', label: 'Passe', weight: 0.15 },
  { id: 'finalizacao', label: 'Finalização', weight: 0.15 },
  { id: 'velocidade', label: 'Velocidade', weight: 0.15 },
  { id: 'posicionamento', label: 'Posicionamento', weight: 0.15 },
  { id: 'drible', label: 'Drible', weight: 0.10 },
  { id: 'marcacao', label: 'Marcação', weight: 0.10 },
  { id: 'fisico', label: 'Físico', weight: 0.05 }
];

export const GOALKEEPER_ATTRIBUTES = [
  { id: 'reflexo', label: 'Reflexo', weight: 0.35 },
  { id: 'posicionamento', label: 'Posicionamento', weight: 0.25 },
  { id: 'saida_gol', label: 'Saída do Gol', weight: 0.20 },
  { id: 'reposicao', label: 'Reposição', weight: 0.20 }
];

export interface FavoriteTeam {
  id: string;
  name: string;
  shieldUrl?: string;
  colorHex?: string;
}

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

// --- DATA TYPES FOR MATCHES, SEASONS, PRESENCE & RESERVES ---

export interface Season {
  id: string;
  name: string;
  year: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  active: boolean;
}

export type MatchStatus = 'agendada' | 'confirmando' | 'aguardando_reservas' | 'fechada' | 'sorteada' | 'encerrada' | 'cancelada';

export type MatchLifecycleState = 'SCHEDULED' | 'CHECKIN_OPEN' | 'CHECKIN_CLOSED' | 'DRAW_COMPLETED' | 'MATCH_FINISHED' | 'ARCHIVED';

export interface Match {
  id: string;
  seasonId: string;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  durationMinutes: number;
  status: MatchStatus;
  lifecycleState?: MatchLifecycleState;
  confirmationDeadlineDaysBefore?: number;
  reservesReleased?: boolean;
  reservesReleasedAt?: string;
  evaluationsReleased?: boolean;
  maxPlayers?: number;
}

export type PresenceStatus = 'confirmado' | 'nao_confirmado' | 'cancelado';

export interface Presence {
  id: string;
  matchId: string;
  playerId: string;
  status: PresenceStatus;
  confirmedAt?: string; // ISO date timestamp
  manuallyApproved?: boolean;
}

export interface RecurrentConfig {
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  time: string; // HH:MM
  location: string;
  durationMinutes: number;
  confirmationDeadlineDaysBefore: number; // e.g. 2 days before racha
  active: boolean;
  monthlyFee?: number; // Legacy - use FinanceConfig instead
  chargeDateRule?: 'primeiro_jogo' | 'ultimo_jogo'; // Legacy - use FinanceConfig instead
  maxMensalistas?: number; // max quota limit for mensualistas
}

export interface FinanceHistoryEntry {
  date: string; // YYYY-MM-DD (vigência)
  amount: number;
}

export interface FinanceConfig {
  monthlyFee: number;
  chargeDateRule: 'primeiro_jogo' | 'ultimo_jogo';
  history: FinanceHistoryEntry[];
  maxMensalistas?: number;
}

export interface CategoryTransition {
  id: string;
  playerId: string;
  playerName: string;
  previousCategory: PlayerCategory;
  newCategory: PlayerCategory;
  date: string; // ISO format Timestamp
  responsibleName: string;
}

export interface Bill {
  id: string;
  playerId: string;
  competence: string; // e.g. "06/2026"
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pendente' | 'pago';
  paidAt?: string; // ISO date timestamp
}

export interface PaymentRecord {
  id: string;
  playerId: string;
  billId: string;
  amount: number;
  paidAt: string; // ISO date timestamp
}

export interface CompetenceConfig {
  competence: string; // e.g. "06/2026"
  monthlyFee: number;
  chargeDateRule: 'primeiro_jogo' | 'ultimo_jogo';
  generated: boolean;
  generatedDate?: string;
}

export interface ReserveQueueAlert {
  id: string;
  matchId: string;
  cancelledPlayerId?: string;
  suggestedReservePlayerId?: string;
  playerId?: string;
  status?: string;
  createdAt: string;
  cleared: boolean;
}

export interface DuoAffinity {
  playerAId: string;
  playerBId: string;
  count: number;
  winsCount: number;
}

export interface TrioAffinity {
  playerAId: string;
  playerBId: string;
  playerCId: string;
  count: number;
  winsCount: number;
}

export interface DrawTeam {
  name: 'Azul' | 'Vermelho' | 'Verde';
  captainPlayerId?: string;
  playerIds: string[];
}

export interface TeamDraw {
  id: string;
  matchId: string;
  date: string; // ISO date timestamp
  teams: DrawTeam[];
  overallBlue: number;
  overallRed: number;
  overallGreen: number;
  maxDifference: number;
  isSharedGoalkeepers: boolean;
  captainsConfigured: boolean;
  affinitiesRecorded?: boolean;
  winsRecorded?: boolean;
  redrawCount?: number;
}

export interface MatchResult {
  id: string;
  matchId: string;
  seasonId: string;
  date: string; // ISO format YYYY-MM-DD
  winsBlue: number;
  winsRed: number;
  winsGreen: number;
  champions: ('Azul' | 'Vermelho' | 'Verde')[];
  teams: DrawTeam[]; // snapshotted teams used in the match
  isSharedGoalkeepers: boolean;
}

export interface PlayerStats {
  playerId: string;
  presences: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  aproveitamento: number; // percentage (vitorias / presences * 100)
  currentStreak: number;
  maxStreak: number;
  ovr?: number;
  createdAt?: string;
}

export type GrupalEventType = 'churrasco' | 'confraternizacao' | 'festa' | 'viagem' | 'personalizado';
export type GrupalEventStatus = 'agendado' | 'confirmando' | 'encerrado' | 'cancelado';

export interface GrupalEvent {
  id: string;
  name: string;
  description: string;
  type: GrupalEventType;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  adultPrice: number;
  childPrice: number;
  status: GrupalEventStatus;
  createdAt: string;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  playerId: string;
  adultsCount: number;
  childrenCount: number;
  confirmedAt: string;
}

export interface EventBill {
  id: string;
  eventId: string;
  playerId: string;
  amount: number;
  status: 'pendente' | 'pago';
  paidAt?: string;
}

// --- MURAL DO RACHA TYPES ---

export interface MuralPost {
  id: string;
  title: string;
  description: string;
  mediaUrl: string; // AWS S3 URL or Base64 / Local preview
  mediaType: 'image' | 'video';
  fileSize: number; // in bytes
  category: 'partida' | 'evento' | 'resenha' | 'livre' | 'regra' | 'aviso' | 'comunicado';
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
  matchId?: string; // Optional match association (also used as 'Rodada' for comunicados)
  eventId?: string; // Optional event association
  isHighlighted?: boolean; // Highlight of the week
  highlightedAt?: string;
  allowPublicView?: boolean; // Approved for public page
  showOnLanding?: boolean; // Exibir na Página Inicial
  thumbnailUrl?: string; // Cache/Miniatura da imagem
  mediumUrl?: string; // Versão média otimizada
  eventDate?: string; // Date of the event/photo (YYYY-MM-DD)
  origin?: 'manual' | 'automatic'; // Origem da Publicação
  
  // Custom communication center fields
  order?: number; // Manual ordering for rules
  startDate?: string; // YYYY-MM-DD (Avisos)
  expirationDate?: string; // YYYY-MM-DD (Avisos)
  priority?: 'alta' | 'media' | 'baixa'; // Avisos priority
  isArchived?: boolean; // Archived flag (manually or automatically)
  isDeleted?: boolean; // Soft delete flag
}

export interface MuralCategory {
  id: 'partida' | 'evento' | 'resenha' | 'livre' | 'regra' | 'aviso' | 'comunicado';
  name: string;
}

export interface MuralHighlight {
  id: string;
  postId: string;
  highlightedBy: string;
  highlightedAt: string;
}

export interface MuralFile {
  id: string;
  postId: string;
  s3Url: string;
  mediaType: 'image' | 'video';
  size: number;
  originalName: string;
  mimeType: string;
  uploadedAt: string;
}

// --- NOTIFICATION TYPES ---

export type NotificationCategory = 'sistema' | 'partida' | 'sorteio' | 'financeiro' | 'evento' | 'jogador';

export interface Notification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  status: 'lida' | 'nao_lida';
  createdAt: string;
  targetUserId: string; // 'all' (system-wide) or specific userId
  actionUrl?: string; // e.g. path or tab name, or a custom event/action detail
  matchId?: string;
  eventId?: string;
}

export interface NotificationPreferences {
  userId: string;
  all: boolean;
  partidas: boolean;
  eventos: boolean;
  financeiro: boolean;
  sistema: boolean;
}

