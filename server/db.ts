import fs from 'fs';
import path from 'path';
import { Player, User, PlayerEvaluation, PlayerHistoryEntry, Season, Match, Presence, RecurrentConfig, ReserveQueueAlert, DuoAffinity, TrioAffinity, TeamDraw, MatchResult, Bill, PaymentRecord, CompetenceConfig, CategoryTransition } from '../src/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> password string (for local simplicity, we store raw plain password since it's local, or simple hash)
  players: Player[];
  evaluations: PlayerEvaluation[];
  evaluationHistory: PlayerHistoryEntry[];
  seasons: Season[];
  matches: Match[];
  presences: Presence[];
  reservesOrder: string[]; // Order of player IDs for category 'reserva'
  recurrentConfig: RecurrentConfig;
  reserveAlerts: ReserveQueueAlert[];
  draws: TeamDraw[];
  duoAffinities: DuoAffinity[];
  trioAffinities: TrioAffinity[];
  results: MatchResult[];
  bills: Bill[];
  payments: PaymentRecord[];
  competences: CompetenceConfig[];
  categoryTransitions?: CategoryTransition[];
}

const DEFAULT_ADMINS = {
  id: 'user-admin',
  name: 'Administrador do Fofim',
  email: 'admin@racha.com',
  role: 'admin' as const,
  status: 'approved' as const,
  createdAt: new Date().toISOString()
};

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDb: DatabaseSchema = {
      users: [DEFAULT_ADMINS],
      passwords: {
        'user-admin': 'admin' // password for admin
      },
      seasons: [
        { id: 'season-2026', name: 'Temporada 2026', year: 2026, startDate: '2026-01-01', endDate: '2026-12-31', active: true }
      ],
      matches: [
        {
          id: 'match-1',
          seasonId: 'season-2026',
          date: '2026-06-06',
          time: '20:00',
          location: 'Arena Green Society (Quadra Principal)',
          durationMinutes: 120,
          status: 'confirmando'
        }
      ],
      presences: [
        { id: 'pres-1', matchId: 'match-1', playerId: 'player-1', status: 'confirmado', confirmedAt: new Date().toISOString() },
        { id: 'pres-2', matchId: 'match-1', playerId: 'player-2', status: 'nao_confirmado' }
      ],
      reservesOrder: ['player-4'],
      recurrentConfig: {
        dayOfWeek: 6, // Sábado
        time: '20:00',
        location: 'Arena Green Society (Quadra Principal)',
        durationMinutes: 120,
        confirmationDeadlineDaysBefore: 2,
        active: true,
        monthlyFee: 100,
        chargeDateRule: 'primeiro_jogo'
      },
      reserveAlerts: [],
      players: [
        {
          id: 'player-1',
          name: 'Fofim Magalhães',
          email: 'fofim@racha.com',
          photoOriginal: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150',
          playerCardUrl: '',
          favoriteTeamId: 'fla',
          category: 'mensalista',
          status: 'disponivel',
          primaryPosition: 'atacante',
          secondaryPositions: ['meio_campo'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'player-2',
          name: 'João Silva',
          email: 'sistema@auditoria.local',
          photoOriginal: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
          playerCardUrl: '',
          favoriteTeamId: 'pal',
          category: 'mensalista',
          status: 'disponivel',
          primaryPosition: 'meio_campo',
          secondaryPositions: ['volante', 'lateral'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'player-3',
          name: 'Goleiro Paredão',
          email: 'parede@racha.com',
          photoOriginal: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
          playerCardUrl: '',
          favoriteTeamId: 'spa',
          category: 'mensalista_goleiro',
          status: 'disponivel',
          primaryPosition: 'goleiro',
          secondaryPositions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'player-4',
          name: 'Zeco Canela',
          email: 'zeco@racha.com',
          photoOriginal: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
          playerCardUrl: '',
          favoriteTeamId: 'cor',
          category: 'reserva',
          status: 'lesionado',
          statusStartDate: '1970-01-01',
          statusEndDate: '2026-05-01', // Expired lesionado date (for auto-resolution testing)
          primaryPosition: 'zagueiro',
          secondaryPositions: ['volante'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      evaluations: [
        {
          id: 'eval-1',
          evaluatorUserId: 'user-admin',
          targetPlayerId: 'player-1',
          date: '2026-05-10',
          ratings: { defesa: 3.5, passe: 4.0, finalizacao: 4.5, velocidade: 4.5, posicionamento: 4.0, drible: 4.5, marcacao: 3.0, fisico: 4.0 }
        },
        {
          id: 'eval-2',
          evaluatorUserId: 'user-sim-1',
          targetPlayerId: 'player-1',
          date: '2026-05-15',
          ratings: { defesa: 3.0, passe: 4.5, finalizacao: 5.0, velocidade: 4.5, posicionamento: 4.5, drible: 4.5, marcacao: 3.5, fisico: 4.5 }
        },
        {
          id: 'eval-3',
          evaluatorUserId: 'user-admin',
          targetPlayerId: 'player-2',
          date: '2026-05-02',
          ratings: { defesa: 4.0, passe: 4.5, finalizacao: 4.0, velocidade: 3.5, posicionamento: 4.5, drible: 4.0, marcacao: 4.0, fisico: 3.5 }
        },
        {
          id: 'eval-4',
          evaluatorUserId: 'user-admin',
          targetPlayerId: 'player-3',
          date: '2026-05-12',
          ratings: { reflexo: 4.5, posicionamento: 4.5, saida_gol: 4.0, reposicao: 4.0 }
        }
      ],
      evaluationHistory: [
        { playerId: 'player-1', date: '2026-03-01', overall: 3.8 },
        { playerId: 'player-1', date: '2026-04-01', overall: 4.1 },
        { playerId: 'player-1', date: '2026-05-01', overall: 4.2 },
        { playerId: 'player-1', date: '2026-06-01', overall: 4.3 },
        { playerId: 'player-2', date: '2026-04-01', overall: 3.9 },
        { playerId: 'player-2', date: '2026-05-01', overall: 4.0 },
        { playerId: 'player-2', date: '2026-06-01', overall: 4.1 },
        { playerId: 'player-3', date: '2026-05-01', overall: 4.2 },
        { playerId: 'player-3', date: '2026-06-01', overall: 4.3 }
      ],
      draws: [],
      duoAffinities: [],
      trioAffinities: [],
      results: [],
      bills: [],
      payments: [],
      competences: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
}

export function readDb(): DatabaseSchema {
  ensureDbExists();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const db = JSON.parse(raw) as DatabaseSchema;

  let updated = false;

  if (!db.results) {
    db.results = [];
    updated = true;
  }

  if (!db.draws) {
    db.draws = [];
    updated = true;
  }
  if (!db.duoAffinities) {
    db.duoAffinities = [];
    updated = true;
  }
  if (!db.trioAffinities) {
    db.trioAffinities = [];
    updated = true;
  }

  if (!db.evaluations) {
    db.evaluations = [];
    updated = true;
  }
  if (!db.evaluationHistory) {
    db.evaluationHistory = [];
    updated = true;
  }
  if (!db.seasons) {
    db.seasons = [
      { id: 'season-2026', name: 'Temporada 2026', year: 2026, startDate: '2026-01-01', endDate: '2026-12-31', active: true }
    ];
    updated = true;
  }
  if (!db.matches) {
    db.matches = [
      {
        id: 'match-1',
        seasonId: 'season-2026',
        date: '2026-06-06',
        time: '20:00',
        location: 'Arena Green Society (Quadra Principal)',
        durationMinutes: 120,
        status: 'confirmando'
      }
    ];
    updated = true;
  }
  if (!db.presences) {
    db.presences = [
      { id: 'pres-1', matchId: 'match-1', playerId: 'player-1', status: 'confirmado', confirmedAt: new Date().toISOString() },
      { id: 'pres-2', matchId: 'match-1', playerId: 'player-2', status: 'nao_confirmado' }
    ];
    updated = true;
  }
  if (!db.recurrentConfig) {
    db.recurrentConfig = {
      dayOfWeek: 6, // Sábado
      time: '20:00',
      location: 'Arena Green Society (Quadra Principal)',
      durationMinutes: 120,
      confirmationDeadlineDaysBefore: 2,
      active: true,
      monthlyFee: 100,
      chargeDateRule: 'primeiro_jogo',
      maxMensalistas: 12
    };
    updated = true;
  } else {
    if (db.recurrentConfig.monthlyFee === undefined) {
      db.recurrentConfig.monthlyFee = 100;
      updated = true;
    }
    if (db.recurrentConfig.chargeDateRule === undefined) {
      db.recurrentConfig.chargeDateRule = 'primeiro_jogo';
      updated = true;
    }
    if (db.recurrentConfig.maxMensalistas === undefined) {
      db.recurrentConfig.maxMensalistas = 12;
      updated = true;
    }
  }
  if (!db.bills) {
    db.bills = [];
    updated = true;
  }
  if (!db.payments) {
    db.payments = [];
    updated = true;
  }
  if (!db.competences) {
    db.competences = [];
    updated = true;
  }
  if (!db.categoryTransitions) {
    db.categoryTransitions = [];
    updated = true;
  }
  if (!db.reserveAlerts) {
    db.reserveAlerts = [];
    updated = true;
  }
  if (!db.reservesOrder) {
    db.reservesOrder = [];
    updated = true;
  }

  // Auto-sync reserves priorities based on existing active reserves
  const activeReservesIds = db.players
    .filter((p) => p.category === 'reserva' && !p.deletedAt)
    .map((p) => p.id);
  const currentOrder = db.reservesOrder.filter((id) => activeReservesIds.includes(id));
  const missingReserves = activeReservesIds.filter((id) => !currentOrder.includes(id));
  const synchronizedOrder = [...currentOrder, ...missingReserves];

  if (JSON.stringify(db.reservesOrder) !== JSON.stringify(synchronizedOrder)) {
    db.reservesOrder = synchronizedOrder;
    updated = true;
  }

  // Perform automatic status correction on read & migrating old players structure
  const nowStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  db.players = db.players.map((p: any) => {
    let mutated = false;

    // Backward compatibility migration for photoOriginal and playerCardUrl
    if (p.photoUrl && !p.photoOriginal) {
      p.photoOriginal = p.photoUrl;
      mutated = true;
    }
    if (p.playerCardUrl === undefined) {
      p.playerCardUrl = '';
      mutated = true;
    }
    if (p.currentStreak === undefined) {
      p.currentStreak = 0;
      mutated = true;
    }
    if (p.maxStreak === undefined) {
      p.maxStreak = 0;
      mutated = true;
    }

    if ((p.status === 'lesionado' || p.status === 'indisponivel') && p.statusEndDate) {
      if (p.statusEndDate < nowStr) {
        // Expiration date is in the past, auto-return to disponivel
        mutated = true;
        return {
          ...p,
          photoOriginal: p.photoOriginal || '',
          playerCardUrl: p.playerCardUrl || '',
          status: 'disponivel',
          statusStartDate: undefined,
          statusEndDate: undefined,
          updatedAt: new Date().toISOString()
        };
      }
    }

    if (mutated) {
      updated = true;
      return {
        ...p,
        photoOriginal: p.photoOriginal || '',
        playerCardUrl: p.playerCardUrl || '',
        updatedAt: new Date().toISOString()
      };
    }

    return p;
  });

  // Automatic monthly billing generation
  try {
    const billingUpdated = generateMonthlyBillingsIfNeeded(db);
    if (billingUpdated) {
      updated = true;
    }
  } catch (err) {
    console.error('Error in automatic billing generator:', err);
  }

  if (updated) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  }

  return db;
}

export function generateMonthlyBillingsIfNeeded(db: DatabaseSchema): boolean {
  if (!db.recurrentConfig || !db.recurrentConfig.active) {
    return false;
  }

  const { monthlyFee, chargeDateRule } = db.recurrentConfig;
  if (monthlyFee === undefined || monthlyFee <= 0 || !chargeDateRule) {
    return false;
  }

  // Get all non-cancelled matches
  const validMatches = db.matches.filter(m => m.status !== 'cancelada');
  if (validMatches.length === 0) {
    return false;
  }

  // Group matches by "YYYY-MM"
  const matchesByMonth: Record<string, typeof db.matches> = {};
  for (const m of validMatches) {
    const parts = m.date.split('-');
    if (parts.length >= 2) {
      const monthKey = `${parts[0]}-${parts[1]}`; // e.g. "2026-06"
      if (!matchesByMonth[monthKey]) {
        matchesByMonth[monthKey] = [];
      }
      matchesByMonth[monthKey].push(m);
    }
  }

  let updated = false;

  // For today calculation
  let todayStr = '';
  try {
    todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      .split('/')
      .map(x => x.padStart(2, '0'))
      .reverse()
      .join('-');
  } catch (e) {
    const d = new Date();
    todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  for (const monthKey of Object.keys(matchesByMonth)) {
    const monthMatches = matchesByMonth[monthKey];
    // Sort matches by date and time
    monthMatches.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.time.localeCompare(b.time);
    });

    const targetMatch = chargeDateRule === 'primeiro_jogo' 
      ? monthMatches[0] 
      : monthMatches[monthMatches.length - 1];

    if (!targetMatch) continue;

    const chargeMatchDate = targetMatch.date;
    const parts = chargeMatchDate.split('-');
    const compKey = `${parts[1]}/${parts[0]}`; // "06/2026"

    // Only generate if today is on or after the target match date
    if (todayStr >= chargeMatchDate) {
      // Check if we already generated for this competence
      const alreadyGenerated = db.competences.some(c => c.competence === compKey && c.generated);
      if (!alreadyGenerated) {
        // Find active mensalistas (category === 'mensalista' and not deleted)
        let eligiblePlayers = db.players.filter(p => !p.deletedAt && p.category === 'mensalista');

        // Prevent retroactive charges for newly-promoted players (i.e. if the charge date is before their promotion date)
        eligiblePlayers = eligiblePlayers.filter(p => {
          const transitions = (db.categoryTransitions || [])
            .filter(t => t.playerId === p.id && t.newCategory === 'mensalista')
            .sort((a, b) => a.date.localeCompare(b.date));
          if (transitions.length > 0) {
            const firstPromotionDateStr = transitions[0].date.split('T')[0];
            if (chargeMatchDate < firstPromotionDateStr) {
              return false;
            }
          }
          return true;
        });

        for (const p of eligiblePlayers) {
          const exists = db.bills.some(b => b.playerId === p.id && b.competence === compKey);
          if (!exists) {
            db.bills.push({
              id: 'bill-' + p.id + '-' + compKey.replace('/', '-'),
              playerId: p.id,
              competence: compKey,
              amount: monthlyFee,
              dueDate: chargeMatchDate,
              status: 'pendente'
            });
            updated = true;
          }
        }

        // Register competence as generated
        const compIndex = db.competences.findIndex(c => c.competence === compKey);
        const compData: CompetenceConfig = {
          competence: compKey,
          monthlyFee,
          chargeDateRule,
          generated: true,
          generatedDate: new Date().toISOString()
        };

        if (compIndex >= 0) {
          db.competences[compIndex] = compData;
        } else {
          db.competences.push(compData);
        }
        updated = true;
      }
    }
  }

  return updated;
}

export function writeDb(db: DatabaseSchema) {
  ensureDbExists();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
