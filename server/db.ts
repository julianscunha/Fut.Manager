import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { Player, User, PlayerEvaluation, PlayerHistoryEntry, Season, Match, Presence, RecurrentConfig, ReserveQueueAlert, DuoAffinity, TrioAffinity, TeamDraw, MatchResult, Bill, PaymentRecord, CompetenceConfig, CategoryTransition, GrupalEvent, EventParticipant, EventBill, MuralPost, MuralCategory, Notification, NotificationPreferences, FinanceConfig, Expense } from '../src/types/domain';

interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> hash bcrypt (nunca texto puro)
  passwordResetTokens?: Record<string, { token: string; expiresAt: string }>;
  players: Player[];
  evaluations: PlayerEvaluation[];
  evaluationHistory: PlayerHistoryEntry[];
  seasons: Season[];
  matches: Match[];
  presences: Presence[];
  reservesOrder: string[];
  recurrentConfig: RecurrentConfig;
  financeConfig?: FinanceConfig;
  reserveAlerts: ReserveQueueAlert[];
  draws: TeamDraw[];
  duoAffinities: DuoAffinity[];
  trioAffinities: TrioAffinity[];
  results: MatchResult[];
  bills: Bill[];
  payments: PaymentRecord[];
  expenses: Expense[];
  competences: CompetenceConfig[];
  categoryTransitions: CategoryTransition[];
  events: GrupalEvent[];
  eventParticipants: EventParticipant[];
  eventBills: EventBill[];
  muralPosts: MuralPost[];
  muralCategories: MuralCategory[];
  notifications: Notification[];
  notificationPreferences: NotificationPreferences[];
  userAudits: any[];
  deadlineAudits: any[];
}

// --- Supabase client ---

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (ver .env.example).');
    }
    // Node < 22 (ex.: runtime padrão do Render) não expõe WebSocket nativo global,
    // e o realtime-js do supabase-js falha ao construir o client mesmo sem usar
    // Realtime. Injeta o `ws` explicitamente para evitar o erro
    // "Node.js detected but native WebSocket not found.".
    supabaseClient = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as any }
    });
  }
  return supabaseClient;
}

// Exposto para uso em uploads (Supabase Storage) fora da camada de dados genérica.
export function getSupabaseClient(): SupabaseClient {
  return getSupabase();
}

// --- snake_case <-> camelCase ---
// "all" -> "all_enabled" e "order" -> "display_order" são as únicas exceções: ambas
// palavras reservadas do Postgres, então as colunas reais têm nomes diferentes do campo TS.

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (l) => '_' + l.toLowerCase());
}

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function rowToObj(row: Record<string, any>, overrides: Record<string, string> = {}): any {
  const reverseOverrides: Record<string, string> = {};
  for (const [camel, snake] of Object.entries(overrides)) reverseOverrides[snake] = camel;

  const obj: any = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) continue; // omite campos ausentes, igual ao comportamento do JSON antigo
    const camelKey = reverseOverrides[k] || toCamel(k);
    obj[camelKey] = v;
  }
  return obj;
}

function objToRow(obj: Record<string, any>, overrides: Record<string, string> = {}): any {
  const row: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const snakeKey = overrides[k] || toSnake(k);
    row[snakeKey] = v;
  }
  return row;
}

// --- registro genérico de tabelas (id único ou chave composta, sem lógica especial) ---

interface TableConfig {
  table: string;
  dbKey: keyof DatabaseSchema;
  pk: string[];
  overrides?: Record<string, string>;
}

const GENERIC_TABLES: TableConfig[] = [
  // athlete_id é propositalmente snake_case no tipo `User` (src/types.ts), não athleteId.
  { table: 'users', dbKey: 'users', pk: ['id'], overrides: { athlete_id: 'athlete_id' } },
  { table: 'players', dbKey: 'players', pk: ['id'] },
  { table: 'seasons', dbKey: 'seasons', pk: ['id'] },
  { table: 'matches', dbKey: 'matches', pk: ['id'] },
  { table: 'presences', dbKey: 'presences', pk: ['id'] },
  { table: 'category_transitions', dbKey: 'categoryTransitions', pk: ['id'] },
  { table: 'draws', dbKey: 'draws', pk: ['id'] },
  { table: 'duo_affinities', dbKey: 'duoAffinities', pk: ['player_a_id', 'player_b_id'] },
  { table: 'trio_affinities', dbKey: 'trioAffinities', pk: ['player_a_id', 'player_b_id', 'player_c_id'] },
  { table: 'results', dbKey: 'results', pk: ['id'] },
  { table: 'player_evaluations', dbKey: 'evaluations', pk: ['id'] },
  { table: 'player_history', dbKey: 'evaluationHistory', pk: ['id'] },
  { table: 'reserve_queue_alerts', dbKey: 'reserveAlerts', pk: ['id'] },
  { table: 'bills', dbKey: 'bills', pk: ['id'] },
  { table: 'payments', dbKey: 'payments', pk: ['id'] },
  { table: 'expenses', dbKey: 'expenses', pk: ['id'] },
  { table: 'competences', dbKey: 'competences', pk: ['competence'] },
  { table: 'eventos', dbKey: 'events', pk: ['id'] },
  { table: 'event_participants', dbKey: 'eventParticipants', pk: ['id'] },
  { table: 'event_bills', dbKey: 'eventBills', pk: ['id'] },
  { table: 'mural_posts', dbKey: 'muralPosts', pk: ['id'], overrides: { order: 'display_order' } },
  { table: 'mural_categories', dbKey: 'muralCategories', pk: ['id'] },
  { table: 'notifications', dbKey: 'notifications', pk: ['id'] },
  { table: 'notification_preferences', dbKey: 'notificationPreferences', pk: ['user_id'], overrides: { all: 'all_enabled' } },
];

async function readGenericTable(cfg: TableConfig): Promise<any[]> {
  const { data, error } = await getSupabase().from(cfg.table).select('*');
  if (error) {
    console.error(`[DB] Erro ao ler ${cfg.table}:`, error.message);
    return [];
  }
  return (data || []).map((row) => rowToObj(row, cfg.overrides));
}

async function writeGenericTable(cfg: TableConfig, items: any[]): Promise<void> {
  const supabase = getSupabase();
  const rows = items.map((item) => objToRow(item, cfg.overrides));

  const { data: existing, error: fetchErr } = await supabase.from(cfg.table).select(cfg.pk.join(','));
  if (fetchErr) {
    console.error(`[DB] Erro ao verificar ${cfg.table} para exclusão:`, fetchErr.message);
  } else {
    const keyOf = (r: any) => cfg.pk.map((k) => String(r[k])).join('|');
    const currentKeySet = new Set(rows.map(keyOf));
    const toDelete = (existing || []).filter((e: any) => !currentKeySet.has(keyOf(e)));

    if (toDelete.length > 0) {
      if (cfg.pk.length === 1) {
        const col = cfg.pk[0];
        const { error } = await supabase.from(cfg.table).delete().in(col, toDelete.map((d: any) => d[col]));
        if (error) console.error(`[DB] Erro ao deletar linhas de ${cfg.table}:`, error.message);
      } else {
        for (const del of toDelete) {
          let q = supabase.from(cfg.table).delete();
          for (const k of cfg.pk) q = q.eq(k, del[k]);
          const { error } = await q;
          if (error) console.error(`[DB] Erro ao deletar linha de ${cfg.table}:`, error.message);
        }
      }
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from(cfg.table).upsert(rows, { onConflict: cfg.pk.join(',') });
    if (error) console.error(`[DB] Erro ao salvar ${cfg.table}:`, error.message);
  }
}

// --- tabelas com tratamento especial ---

async function readPasswordsTable(): Promise<{ passwords: Record<string, string>; passwordResetTokens: Record<string, { token: string; expiresAt: string }> }> {
  const { data, error } = await getSupabase().from('passwords').select('*');
  const passwords: Record<string, string> = {};
  const passwordResetTokens: Record<string, { token: string; expiresAt: string }> = {};
  if (error) {
    console.error('[DB] Erro ao ler passwords:', error.message);
    return { passwords, passwordResetTokens };
  }
  for (const row of data || []) {
    passwords[row.user_id] = row.password_hash;
    if (row.reset_token && row.reset_token_expires_at) {
      passwordResetTokens[row.user_id] = { token: row.reset_token, expiresAt: row.reset_token_expires_at };
    }
  }
  return { passwords, passwordResetTokens };
}

async function writePasswordsTable(passwords: Record<string, string>, passwordResetTokens: Record<string, { token: string; expiresAt: string }>): Promise<void> {
  const userIds = Object.keys(passwords);
  if (userIds.length === 0) return;
  const rows = userIds.map((userId) => ({
    user_id: userId,
    password_hash: passwords[userId],
    reset_token: passwordResetTokens[userId]?.token || null,
    reset_token_expires_at: passwordResetTokens[userId]?.expiresAt || null
  }));
  const { error } = await getSupabase().from('passwords').upsert(rows, { onConflict: 'user_id' });
  if (error) console.error('[DB] Erro ao salvar passwords:', error.message);
}

async function readReservesOrder(): Promise<string[]> {
  const { data, error } = await getSupabase().from('reserves_order').select('*').order('position', { ascending: true });
  if (error) {
    console.error('[DB] Erro ao ler reserves_order:', error.message);
    return [];
  }
  return (data || []).map((r: any) => r.player_id);
}

async function writeReservesOrder(order: string[]): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('reserves_order').select('player_id');
  const existingIds = (existing || []).map((r: any) => r.player_id);
  if (existingIds.length > 0) {
    await supabase.from('reserves_order').delete().in('player_id', existingIds);
  }
  if (order.length > 0) {
    const rows = order.map((playerId, idx) => ({ player_id: playerId, position: idx }));
    const { error } = await supabase.from('reserves_order').upsert(rows, { onConflict: 'player_id' });
    if (error) console.error('[DB] Erro ao salvar reserves_order:', error.message);
  }
}

async function readSingleton(table: string, fixedId: string): Promise<any | null> {
  const { data, error } = await getSupabase().from(table).select('*').eq('id', fixedId).maybeSingle();
  if (error || !data) return null;
  const obj = rowToObj(data);
  delete obj.id;
  return obj;
}

async function writeSingleton(table: string, fixedId: string, obj: any): Promise<void> {
  const row = { id: fixedId, ...objToRow(obj || {}) };
  const { error } = await getSupabase().from(table).upsert(row, { onConflict: 'id' });
  if (error) {
    console.error(`[DB] Erro ao salvar ${table}:`, error.message);
    // Antes esse erro só ia pro console e o writeDb()/rota seguiam como se tivesse
    // salvado - o cliente recebia 200 mesmo com a escrita falhando de verdade no banco.
    throw new Error(`Erro ao salvar ${table}: ${error.message}`);
  }
}

async function readBlobTable(table: string): Promise<any[]> {
  const { data, error } = await getSupabase().from(table).select('*');
  if (error) {
    console.error(`[DB] Erro ao ler ${table}:`, error.message);
    return [];
  }
  return (data || []).map((row: any) => ({ ...row.data, id: row.id }));
}

async function writeBlobTable(table: string, items: any[]): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from(table).select('id');
  const currentIds = new Set(items.map((i) => i.id));
  const toDeleteIds = (existing || []).map((e: any) => e.id).filter((id: string) => !currentIds.has(id));
  if (toDeleteIds.length > 0) {
    await supabase.from(table).delete().in('id', toDeleteIds);
  }
  if (items.length > 0) {
    const rows = items.map((item) => ({ id: item.id, data: item }));
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) console.error(`[DB] Erro ao salvar ${table}:`, error.message);
  }
}

// --- dirty tracking: evita reescrever tabelas que não mudaram desde o último readDb() ---

const ALL_DB_KEYS: (keyof DatabaseSchema)[] = [
  'users', 'passwords', 'passwordResetTokens', 'players', 'evaluations', 'evaluationHistory',
  'seasons', 'matches', 'presences', 'reservesOrder', 'recurrentConfig', 'financeConfig',
  'reserveAlerts', 'draws', 'duoAffinities', 'trioAffinities', 'results', 'bills', 'payments', 'expenses',
  'competences', 'categoryTransitions', 'events', 'eventParticipants', 'eventBills',
  'muralPosts', 'muralCategories', 'notifications',
  'notificationPreferences', 'userAudits', 'deadlineAudits'
];

const snapshotMap = new WeakMap<object, Record<string, string>>();

function captureSnapshot(db: DatabaseSchema): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const key of ALL_DB_KEYS) {
    snap[key] = JSON.stringify((db as any)[key]);
  }
  return snap;
}

// --- Cache de leitura (readDb) ---
// readDb() é chamado ~1x por rota da API (dezenas de vezes por carregamento de tela),
// e cada chamada buscava as ~24 tabelas inteiras do Postgres do zero. As duas otimizações
// abaixo não mudam nenhum comportamento visível: apenas evitam refazer a mesma busca
// completa quando várias chamadas acontecem quase juntas.
let inFlightRead: Promise<DatabaseSchema> | null = null;
let cachedRead: { db: DatabaseSchema; snapshot: Record<string, string>; expiresAt: number } | null = null;
let cacheGeneration = 0;
// 5s em vez de uma janela curta: toda escrita real (writeDb) já invalida o cache na hora
// via cacheGeneration++, então um TTL maior não arrisca servir dado desatualizado após uma
// mudança — só evita reler as tabelas inteiras (inclusive os avatares base64 de players,
// que dominam o tempo de query) a cada poucas centenas de ms em picos de leitura.
const READ_CACHE_TTL_MS = 5000;

// Nunca devolve o objeto compartilhado do cache — cada chamador recebe seu próprio clone,
// livre pra mutar em memória antes de chamar writeDb(), como o resto do código já faz.
// Propaga o snapshot pro clone (em vez de recapturar) pra preservar o diff por tabela que
// writeDb() já faz (ver captureSnapshot acima) — sem isso, todo writeDb() reescreveria as
// 24 tabelas, mesmo as que não mudaram.
function cloneDbForCaller(db: DatabaseSchema, snapshot: Record<string, string>): DatabaseSchema {
  const clone = structuredClone(db);
  snapshotMap.set(clone, snapshot);
  return clone;
}

// --- lógica de negócio contínua (portada do db.ts baseado em arquivo, sem as migrações
//     de compatibilidade retroativa que só existiam para corrigir JSON antigo) ---

function getMonthlyFeeForDate(db: DatabaseSchema, dateStr: string): number {
  if (!db.financeConfig) return 100;
  const sortedHistory = [...(db.financeConfig.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  let activeFee = db.financeConfig.monthlyFee;
  for (const entry of sortedHistory) {
    if (entry.date <= dateStr) {
      activeFee = entry.amount;
    } else {
      break;
    }
  }
  return activeFee;
}

function generateMonthlyBillingsIfNeeded(db: DatabaseSchema): boolean {
  if (!db.recurrentConfig || !db.recurrentConfig.active) return false;
  if (!db.financeConfig) return false;

  const { chargeDateRule } = db.financeConfig;
  const currentFee = db.financeConfig.monthlyFee;
  if (currentFee === undefined || currentFee <= 0 || !chargeDateRule) return false;

  const validMatches = db.matches.filter((m) => m.status !== 'cancelada');
  if (validMatches.length === 0) return false;

  const matchesByMonth: Record<string, typeof db.matches> = {};
  for (const m of validMatches) {
    const parts = m.date.split('-');
    if (parts.length >= 2) {
      const monthKey = `${parts[0]}-${parts[1]}`;
      if (!matchesByMonth[monthKey]) matchesByMonth[monthKey] = [];
      matchesByMonth[monthKey].push(m);
    }
  }

  let updated = false;
  let todayStr = '';
  try {
    todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      .split('/').map((x) => x.padStart(2, '0')).reverse().join('-');
  } catch {
    const d = new Date();
    todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  for (const monthKey of Object.keys(matchesByMonth)) {
    const monthMatches = matchesByMonth[monthKey];
    monthMatches.sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time)));

    const targetMatch = chargeDateRule === 'primeiro_jogo' ? monthMatches[0] : monthMatches[monthMatches.length - 1];
    if (!targetMatch) continue;

    const chargeMatchDate = targetMatch.date;
    const parts = chargeMatchDate.split('-');
    const compKey = `${parts[1]}/${parts[0]}`;

    if (todayStr >= chargeMatchDate) {
      // Independente de a mensalidade já ter sido gerada antes (ex: admin configurou o
      // aluguel depois do dia de cobrança do mês), garante que a despesa do aluguel exista
      // para esta competência assim que houver um valor configurado.
      const rentAmount = db.financeConfig.courtRentAmount;
      if (rentAmount && rentAmount > 0) {
        db.expenses = db.expenses || [];
        const rentAlreadyLaunched = db.expenses.some((e) => e.category === 'aluguel' && e.competence === compKey);
        if (!rentAlreadyLaunched) {
          db.expenses.push({
            id: 'expense-aluguel-' + compKey.replace('/', '-'),
            category: 'aluguel',
            description: 'Aluguel da quadra',
            amount: rentAmount,
            competence: compKey,
            date: chargeMatchDate,
            createdAt: new Date().toISOString()
          });
          updated = true;
        }
      }

      const alreadyGenerated = db.competences.some((c) => c.competence === compKey && c.generated);
      if (!alreadyGenerated) {
        let eligiblePlayers = db.players.filter((p) => !p.deletedAt && p.category === 'mensalista' && p.primaryPosition !== 'goleiro');

        eligiblePlayers = eligiblePlayers.filter((p) => {
          const transitions = (db.categoryTransitions || [])
            .filter((t) => t.playerId === p.id && t.newCategory === 'mensalista')
            .sort((a, b) => a.date.localeCompare(b.date));
          if (transitions.length > 0) {
            const firstPromotionDateStr = transitions[0].date.split('T')[0];
            if (chargeMatchDate < firstPromotionDateStr) return false;
          }
          return true;
        });

        const applicableFee = getMonthlyFeeForDate(db, chargeMatchDate);

        for (const p of eligiblePlayers) {
          const exists = db.bills.some((b) => b.playerId === p.id && b.competence === compKey);
          if (!exists) {
            db.bills.push({
              id: 'bill-' + p.id + '-' + compKey.replace('/', '-'),
              playerId: p.id,
              competence: compKey,
              amount: applicableFee,
              dueDate: chargeMatchDate,
              status: 'pendente'
            });
            updated = true;
          }
        }

        const compIndex = db.competences.findIndex((c) => c.competence === compKey);
        const compData: CompetenceConfig = {
          competence: compKey,
          monthlyFee: applicableFee,
          chargeDateRule,
          generated: true,
          generatedDate: new Date().toISOString()
        };
        if (compIndex >= 0) db.competences[compIndex] = compData;
        else db.competences.push(compData);
        updated = true;
      }
    }
  }

  return updated;
}

function getMatchDeadlineInfoInternal(match: any, deadlineDays: number) {
  if (!match.date) return { isDeadlineExpired: false };
  const [year, month, day] = match.date.split('-').map(Number);
  let hours = 21;
  let minutes = 30;
  if (match.time && match.time.includes(':')) {
    const [h, m] = match.time.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) { hours = h; minutes = m; }
  }
  const matchDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const deadlineDateTime = new Date(matchDateTime.getTime() - deadlineDays * 24 * 60 * 60 * 1000);
  return { isDeadlineExpired: new Date() >= deadlineDateTime };
}

function isMatchStartingSoonInternal(match: any, minutesBefore: number): boolean {
  if (!match.date) return false;
  const [year, month, day] = match.date.split('-').map(Number);
  let hours = 21;
  let minutes = 30;
  if (match.time && match.time.includes(':')) {
    const [h, m] = match.time.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) { hours = h; minutes = m; }
  }
  const matchDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return new Date() >= new Date(matchDateTime.getTime() - minutesBefore * 60 * 1000);
}

function getComputedPresencesSimplified(db: any, matchId: string) {
  const match = db.matches.find((m: any) => m.id === matchId);
  if (!match) return [];

  const matchPresences = db.presences.filter((p: any) => p.matchId === matchId);
  const activePlayers = db.players.filter((p: any) => !p.deletedAt);
  const activePlayerIds = activePlayers.map((p: any) => p.id);
  const validPresences = matchPresences.filter((p: any) => activePlayerIds.includes(p.playerId));

  const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
  const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
  const { isDeadlineExpired } = getMatchDeadlineInfoInternal(match, matchDeadlineDays);

  const presenceMap = new Map();
  for (const pr of validPresences) presenceMap.set(pr.playerId, pr);

  const mensalistas = activePlayers.filter((p: any) => p.category !== 'reserva');
  const reserves = activePlayers.filter((p: any) => p.category === 'reserva');

  const confirmedMensalistas = mensalistas.filter((p: any) => {
    const pr = presenceMap.get(p.id);
    return pr && pr.status === 'confirmado';
  });

  const manuallyApprovedReserves = reserves.filter((p: any) => {
    const pr = presenceMap.get(p.id);
    return pr && pr.status === 'confirmado' && pr.manuallyApproved === true;
  });

  const count = confirmedMensalistas.length + manuallyApprovedReserves.length;
  const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
  const remainingSpots = Math.max(0, limit - count);

  const pendingReserves = reserves.filter((p: any) => {
    const pr = presenceMap.get(p.id);
    return pr && pr.status === 'confirmado' && !pr.manuallyApproved;
  });

  const reservesOrder = db.reservesOrder || [];
  pendingReserves.sort((a: any, b: any) => {
    const idxA = reservesOrder.indexOf(a.id);
    const idxB = reservesOrder.indexOf(b.id);
    const orderA = idxA !== -1 ? idxA : 999999;
    const orderB = idxB !== -1 ? idxB : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const autoApprovedReserveIds = new Set<string>();
  if (isDeadlineExpired && remainingSpots > 0) {
    for (const r of pendingReserves.slice(0, remainingSpots)) autoApprovedReserveIds.add(r.id);
  }

  return activePlayers.map((player: any) => {
    const pr = presenceMap.get(player.id);
    const originalStatus = pr ? pr.status : 'nao_confirmado';
    let computedStatus: string = originalStatus;

    if (player.category === 'reserva' && originalStatus === 'confirmado') {
      const isManuallyApproved = pr && pr.manuallyApproved === true;
      const isAutoPromoted = autoApprovedReserveIds.has(player.id);
      computedStatus = (isManuallyApproved || isAutoPromoted) ? 'confirmado' : 'nao_confirmado';
    }

    return {
      playerId: player.id,
      category: player.category,
      presenceStatus: computedStatus,
      declaredPresence: pr ? pr.status === 'confirmado' : false
    };
  });
}

function syncMatchStatuses(db: any) {
  if (!db.matches) return;

  for (const m of db.matches) {
    if (m.status === 'cancelada') continue;

    const hasResults = (db.results || []).some((r: any) => r.matchId === m.id);
    if (hasResults || m.status === 'encerrada') {
      m.status = 'encerrada';
      continue;
    }

    const matchDraw = (db.draws || []).find((d: any) => d.matchId === m.id);
    const isDrawLocked = matchDraw && matchDraw.affinitiesRecorded === true;
    if (isDrawLocked || m.status === 'sorteada') {
      m.status = 'sorteada';
      continue;
    }

    const computedList = getComputedPresencesSimplified(db, m.id);
    const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;
    const limit = m.maxPlayers !== undefined && m.maxPlayers !== null ? m.maxPlayers : 15;

    // Closes automatically once the list fills up, or unconditionally 5 minutes before
    // kickoff (whoever is confirmed by then plays) - either way the draw needs 'fechada'
    // to unlock, so the list must always reach it before the match starts.
    const isStartingSoon = isMatchStartingSoonInternal(m, 5);

    if (confirmedCount >= limit || isStartingSoon) {
      m.status = 'fechada';
      continue;
    }

    const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
    const matchDeadlineDays = m.confirmationDeadlineDaysBefore !== undefined ? m.confirmationDeadlineDaysBefore : deadlineDays;
    const { isDeadlineExpired } = getMatchDeadlineInfoInternal(m, matchDeadlineDays);

    if (isDeadlineExpired && !m.reservesReleased) {
      m.reservesReleased = true;
      m.reservesReleasedAt = new Date().toISOString();
    }

    if (m.status === 'confirmando' || m.status === 'fechada') {
      m.status = 'confirmando';
      continue;
    }

    m.status = 'agendada';
  }
}

function autoArchiveMuralPosts(db: any): boolean {
  if (!db.muralPosts) return false;
  let updated = false;

  let todayStr = '';
  try {
    todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      .split('/').map((x) => x.padStart(2, '0')).reverse().join('-');
  } catch {
    const d = new Date();
    todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const finalizedMatchIds = new Set<string>();
  for (const m of db.matches || []) {
    if (m.status === 'encerrada') finalizedMatchIds.add(m.id);
  }
  for (const r of db.results || []) {
    finalizedMatchIds.add(r.matchId);
  }

  for (const p of db.muralPosts) {
    if (p.category === 'aviso' && p.expirationDate && todayStr > p.expirationDate && !p.isArchived) {
      p.isArchived = true;
      p.updatedAt = new Date().toISOString();
      updated = true;
    }
    if (p.category === 'comunicado' && p.matchId && finalizedMatchIds.has(p.matchId) && !p.isArchived) {
      p.isArchived = true;
      p.updatedAt = new Date().toISOString();
      updated = true;
    }
  }

  return updated;
}

function syncReservesOrderAndPlayerLinks(db: DatabaseSchema): void {
  // Mantém reservesOrder sincronizado com os reservas ativos
  const activeReservesIds = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt).map((p) => p.id);
  const currentOrder = db.reservesOrder.filter((id) => activeReservesIds.includes(id));
  const missingReserves = activeReservesIds.filter((id) => !currentOrder.includes(id));
  db.reservesOrder = [...currentOrder, ...missingReserves];

  // Vincula usuários sem playerId a um atleta (por e-mail ou cria um novo registro)
  for (const u of db.users as any[]) {
    if (u.athlete_id && !u.playerId) u.playerId = u.athlete_id;
    if (u.playerId && !u.athlete_id) u.athlete_id = u.playerId;

    if (!u.playerId) {
      let matchPl = db.players.find((p: any) => p.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim());
      if (!matchPl && u.id === 'user-admin') {
        matchPl = db.players.find((p: any) => p.id === 'player-admin');
      }
      if (!matchPl) {
        const newPlId = u.id === 'user-admin' ? 'player-admin' : ('player-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
        matchPl = {
          id: newPlId,
          name: u.name,
          phone: '(85) 99999-9999',
          email: u.email,
          photoOriginal: '',
          playerCardUrl: '',
          favoriteTeamId: 'out',
          category: u.role === 'admin' ? 'mensalista' : 'reserva',
          status: 'disponivel',
          primaryPosition: 'meio_campo',
          secondaryPositions: [],
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.players.push(matchPl as Player);
      }
      u.playerId = matchPl!.id;
      u.athlete_id = matchPl!.id;
    } else if (u.athlete_id !== u.playerId) {
      u.athlete_id = u.playerId;
    }
  }

  // Auto-correção de status de jogadores machucados/indisponíveis com prazo expirado
  const nowStr = new Date().toISOString().split('T')[0];
  for (const p of db.players as any[]) {
    if ((p.status === 'lesionado' || p.status === 'indisponivel') && p.statusEndDate) {
      if (p.statusEndDate < nowStr) {
        p.status = 'disponivel';
        p.statusStartDate = undefined;
        p.statusEndDate = undefined;
        p.updatedAt = new Date().toISOString();
      }
    }
  }
}

// --- API pública (mesma assinatura usada em server.ts) ---

export async function ensureDbExists(): Promise<void> {
  const { error } = await getSupabase().from('users').select('id').limit(1);
  if (error) {
    console.error('[DB] Falha ao conectar ao Supabase:', error.message);
    throw error;
  }
  console.log('[DB] Supabase conectado com sucesso.');
}

async function fetchAndSyncDb(): Promise<DatabaseSchema> {
  const [
    generic,
    reservesOrder,
    recurrentConfigRaw,
    financeConfigRaw,
    userAudits,
    deadlineAudits,
    passwordsData
  ] = await Promise.all([
    Promise.all(GENERIC_TABLES.map((cfg) => readGenericTable(cfg))),
    readReservesOrder(),
    readSingleton('recurrent_config', 'config-default'),
    readSingleton('finance_config', 'finance-default'),
    readBlobTable('user_audits'),
    readBlobTable('deadline_audits'),
    readPasswordsTable()
  ]);

  const db = {} as DatabaseSchema;
  GENERIC_TABLES.forEach((cfg, i) => {
    (db as any)[cfg.dbKey] = generic[i];
  });

  db.passwords = passwordsData.passwords;
  db.passwordResetTokens = passwordsData.passwordResetTokens;
  db.reservesOrder = reservesOrder;
  db.recurrentConfig = recurrentConfigRaw || {
    dayOfWeek: 6,
    time: '21:30',
    location: 'Arena Furacão',
    durationMinutes: 60,
    confirmationDeadlineDaysBefore: 2,
    active: true,
    maxMensalistas: 12
  };
  db.financeConfig = financeConfigRaw || {
    monthlyFee: 100,
    chargeDateRule: 'primeiro_jogo',
    history: [{ date: '2026-01-01', amount: 100 }]
  };
  db.userAudits = userAudits;
  db.deadlineAudits = deadlineAudits;

  // Snapshot capturado ANTES da lógica de negócio mutar o objeto, para que writeDb()
  // detecte exatamente o que essa lógica mudou (evita reescrever tabelas intocadas).
  snapshotMap.set(db, captureSnapshot(db));

  try {
    syncReservesOrderAndPlayerLinks(db);
  } catch (err) {
    console.error('[DB] Erro ao sincronizar reservas/vínculos de usuário:', err);
  }
  try {
    generateMonthlyBillingsIfNeeded(db);
  } catch (err) {
    console.error('[DB] Erro no gerador automático de faturas:', err);
  }
  try {
    syncMatchStatuses(db);
  } catch (err) {
    console.error('[DB] Erro ao sincronizar status de partidas:', err);
  }
  try {
    autoArchiveMuralPosts(db);
  } catch (err) {
    console.error('[DB] Erro ao auto-arquivar posts do mural:', err);
  }

  // Persiste efeitos colaterais da própria busca (bilhetes gerados automaticamente,
  // sincronização de status etc.) — não é uma escrita "externa", então não deve
  // invalidar o cache de leitura que está prestes a ser preenchido com este resultado.
  await writeDb(db, { skipCacheInvalidation: true });

  return db;
}

export async function readDb(): Promise<DatabaseSchema> {
  const now = Date.now();
  if (cachedRead && cachedRead.expiresAt > now) {
    return cloneDbForCaller(cachedRead.db, cachedRead.snapshot);
  }
  if (inFlightRead) {
    const db = await inFlightRead;
    return cloneDbForCaller(db, snapshotMap.get(db) || captureSnapshot(db));
  }

  const generationBefore = cacheGeneration;
  const fetchPromise = fetchAndSyncDb();
  inFlightRead = fetchPromise;
  try {
    const db = await fetchPromise;
    const snapshot = snapshotMap.get(db) || captureSnapshot(db);
    if (cacheGeneration === generationBefore) {
      cachedRead = { db, snapshot, expiresAt: Date.now() + READ_CACHE_TTL_MS };
    }
    return cloneDbForCaller(db, snapshot);
  } finally {
    inFlightRead = null;
  }
}

export async function writeDb(db: DatabaseSchema, opts?: { skipCacheInvalidation?: boolean }): Promise<void> {
  if (!opts?.skipCacheInvalidation) {
    cacheGeneration++;
    cachedRead = null;
  }

  syncMatchStatuses(db);

  const prevSnapshot = snapshotMap.get(db) || {};
  const newSnapshot = captureSnapshot(db);

  const writes: Promise<void>[] = [];

  for (const cfg of GENERIC_TABLES) {
    if (newSnapshot[cfg.dbKey] !== prevSnapshot[cfg.dbKey]) {
      writes.push(writeGenericTable(cfg, (db as any)[cfg.dbKey] || []));
    }
  }
  if (newSnapshot.reservesOrder !== prevSnapshot.reservesOrder) {
    writes.push(writeReservesOrder(db.reservesOrder || []));
  }
  if (newSnapshot.recurrentConfig !== prevSnapshot.recurrentConfig) {
    writes.push(writeSingleton('recurrent_config', 'config-default', db.recurrentConfig));
  }
  if (newSnapshot.financeConfig !== prevSnapshot.financeConfig) {
    writes.push(writeSingleton('finance_config', 'finance-default', db.financeConfig));
  }
  if (newSnapshot.userAudits !== prevSnapshot.userAudits) {
    writes.push(writeBlobTable('user_audits', db.userAudits || []));
  }
  if (newSnapshot.deadlineAudits !== prevSnapshot.deadlineAudits) {
    writes.push(writeBlobTable('deadline_audits', db.deadlineAudits || []));
  }
  if (newSnapshot.passwords !== prevSnapshot.passwords || newSnapshot.passwordResetTokens !== prevSnapshot.passwordResetTokens) {
    writes.push(writePasswordsTable(db.passwords || {}, db.passwordResetTokens || {}));
  }

  await Promise.all(writes);

  snapshotMap.set(db, newSnapshot);
}

export { generateMonthlyBillingsIfNeeded };
