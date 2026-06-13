import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { readDb, writeDb, generateMonthlyBillingsIfNeeded } from './server/db';
import { runSmartDraw, recordAffinities } from './server/drawEngine';
import { computeStatsForSeason } from './server/statsEngine';
import { Player, User, UserRole, UserStatus, Season, Match, PresenceStatus, MatchResult, PlayerCategory, PlayerPosition } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // --- NOTIFICATION HELPERS & STRUCTURES ---

  function notify(db: any, params: {
    category: 'sistema' | 'partida' | 'sorteio' | 'financeiro' | 'evento' | 'jogador',
    title: string,
    message: string,
    targetUserId?: string,
    actionUrl?: string,
    matchId?: string,
    eventId?: string
  }) {
    if (!db.notifications) {
      db.notifications = [];
    }
    const id = 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const newNotif = {
      id,
      category: params.category,
      title: params.title,
      message: params.message,
      status: 'nao_lida',
      createdAt: new Date().toISOString(),
      targetUserId: params.targetUserId || 'all',
      actionUrl: params.actionUrl,
      matchId: params.matchId,
      eventId: params.eventId
    };
    db.notifications.push(newNotif);

    console.log(`[Notification Created] Category: ${params.category}, Title: "${params.title}"`);

    // --- FUTURE OUTBOUND CHANNELS INTEGRATION PROFILES (ARCHITECTURE PREPARATION) ---
    // 1. Web Push PWA simulation hook
    console.log(`[PWA PUSH ARCHITECTURE PREP] Target: ${newNotif.targetUserId}. payload: { title: "${newNotif.title}", body: "${newNotif.message}" }`);
    
    // 2. WhatsApp simulator hook
    console.log(`[WHATSAPP INTEGRATION PREP] Target: ${newNotif.targetUserId}. template_message: "*${newNotif.title}*\n${newNotif.message}"`);

    return newNotif;
  }

  function getPlayerIdForUser(db: any, userId?: string, email?: string): string | null {
    if (userId) {
      const user = db.users.find((u: any) => u.id === userId);
      if (user) {
        if (user.playerId) {
          return user.playerId;
        }
        if (user.email) {
          const normalized = user.email.toLowerCase().trim();
          const player = db.players.find((p: any) => p.email && p.email.toLowerCase().trim() === normalized);
          if (player) {
            return player.id;
          }
        }
      }
    }
    if (email) {
      const normalized = email.toLowerCase().trim();
      const user = db.users.find((u: any) => u.email.toLowerCase().trim() === normalized);
      if (user && user.playerId) {
        return user.playerId;
      }
      const player = db.players.find((p: any) => p.email && p.email.toLowerCase().trim() === normalized);
      if (player) {
        return player.id;
      }
    }
    return null;
  }

  function getMatchDeadlineInfo(match: any, deadlineDays: number) {
    if (!match.date) {
      return {
        matchDateTime: new Date(),
        deadlineDateTime: new Date(),
        isDeadlineExpired: false,
        deadlineDateStr: '',
        hoursRemaining: 0
      };
    }
    const [year, month, day] = match.date.split('-').map(Number);
    let hours = 21;
    let minutes = 30;
    if (match.time && match.time.includes(':')) {
      const [h, m] = match.time.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        hours = h;
        minutes = m;
      }
    }
    const matchDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const deadlineDateTime = new Date(matchDateTime.getTime() - deadlineDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const isDeadlineExpired = now >= deadlineDateTime;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formattedDate = `${pad(deadlineDateTime.getDate())}/${pad(deadlineDateTime.getMonth() + 1)}/${deadlineDateTime.getFullYear()}`;
    const formattedTime = `${pad(deadlineDateTime.getHours())}:${pad(deadlineDateTime.getMinutes())}`;
    const deadlineDateStr = `${formattedDate} às ${formattedTime}`;

    const diffMs = deadlineDateTime.getTime() - now.getTime();
    const hoursRemaining = diffMs / (1000 * 60 * 60);

    return {
      matchDateTime,
      deadlineDateTime,
      isDeadlineExpired,
      deadlineDateStr,
      hoursRemaining
    };
  }

  function getComputedPresences(db: any, matchId: string) {
    const match = db.matches.find((m: any) => m.id === matchId);
    if (!match) return [];

    const matchPresences = db.presences.filter((p: any) => p.matchId === matchId);
    const activePlayers = db.players.filter((p: any) => !p.deletedAt);
    const activePlayerIds = activePlayers.map((p: any) => p.id);

    // Filter out presences of players who are deleted
    const validPresences = matchPresences.filter((p: any) => activePlayerIds.includes(p.playerId));

    // Determine deadline expired
    const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
    const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
    const { deadlineDateTime, isDeadlineExpired, deadlineDateStr, hoursRemaining } = getMatchDeadlineInfo(match, matchDeadlineDays);

    if (isDeadlineExpired && !match.reservesReleased) {
      match.reservesReleased = true;
      match.reservesReleasedAt = new Date().toISOString();
      if (!db.deadlineAudits) db.deadlineAudits = [];
      db.deadlineAudits.push({
        id: 'da-' + match.id + '-' + Date.now(),
        matchId: match.id,
        matchDate: match.date,
        matchTime: match.time,
        matchDeadlineDays,
        calculatedDeadline: deadlineDateTime.toISOString(),
        releasedAt: new Date().toISOString(),
        auditType: 'deadline_and_reserves_release',
        createdAt: new Date().toISOString(),
        details: `Prazo de confirmação encerrado para racha de ${match.date} às ${match.time} (limite calculado: ${deadlineDateStr}). Reservas liberados e promovidos automaticamente às vagas restantes.`
      });
      writeDb(db);
    }

    // Build a map of player to their DB presence record
    const presenceMap = new Map();
    for (const pr of validPresences) {
      presenceMap.set(pr.playerId, pr);
    }

    // Find all mensalistas & mensalista_goleiros and reserves
    const mensalistas = activePlayers.filter((p: any) => p.category !== 'reserva');
    const reserves = activePlayers.filter((p: any) => p.category === 'reserva');

    // Confirmed Mensalistas
    const confirmedMensalistas = mensalistas.filter((p: any) => {
      const pr = presenceMap.get(p.id);
      return pr && pr.status === 'confirmado';
    });

    // Manually Approved Reserves (always confirmed)
    const manuallyApprovedReserves = reserves.filter((p: any) => {
      const pr = presenceMap.get(p.id);
      return pr && pr.status === 'confirmado' && pr.manuallyApproved === true;
    });

    // Count how many spots are already occupied by mensalistas and manually approved reserves
    let count = confirmedMensalistas.length + manuallyApprovedReserves.length;

    // Remaining spots to reach 15
    const remainingSpots = Math.max(0, 15 - count);

    // Eligible reserves for automatic promotion:
    // Reserves who have status === 'confirmado' in DB but are not manually approved
    const pendingReserves = reserves.filter((p: any) => {
      const pr = presenceMap.get(p.id);
      return pr && pr.status === 'confirmado' && !pr.manuallyApproved;
    });

    // Sort pendingReserves by reservesOrder priority from the DB
    const reservesOrder = db.reservesOrder || [];
    pendingReserves.sort((a: any, b: any) => {
      const idxA = reservesOrder.indexOf(a.id);
      const idxB = reservesOrder.indexOf(b.id);
      const orderA = idxA !== -1 ? idxA : 999999;
      const orderB = idxB !== -1 ? idxB : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    // If deadline is expired, we automatically promote them up to the remaining spots
    const autoApprovedReserveIds = new Set<string>();
    if (isDeadlineExpired && remainingSpots > 0) {
      const promoted = pendingReserves.slice(0, remainingSpots);
      for (const r of promoted) {
        autoApprovedReserveIds.add(r.id);
      }
    }

    // Merged player and matches list
    const mergedList = activePlayers.map((player: any) => {
      const pr = presenceMap.get(player.id);
      let originalStatus = pr ? pr.status : 'nao_confirmado';
      
      // Calculate computed presenceStatus
      let computedStatus: string = originalStatus;

      if (player.category === 'reserva') {
        if (originalStatus === 'confirmado') {
          const isManuallyApproved = pr && pr.manuallyApproved === true;
          const isAutoPromoted = autoApprovedReserveIds.has(player.id);
          if (isManuallyApproved || isAutoPromoted) {
            computedStatus = 'confirmado';
          } else {
            computedStatus = 'nao_confirmado'; // Becomes "Fila" / Pending in waitlist
          }
        }
      }

      return {
        playerId: player.id,
        name: player.name,
        email: player.email,
        category: player.category,
        status: player.status,
        presenceStatus: computedStatus,
        confirmedAt: pr ? pr.confirmedAt : undefined,
        manuallyApproved: pr ? pr.manuallyApproved || false : false,
        isAutoPromoted: autoApprovedReserveIds.has(player.id)
      };
    });

    // Sort: mensalistas first, reserves second!
    mergedList.sort((a: any, b: any) => {
      const catOrder: Record<string, number> = { mensalista_goleiro: 1, mensalista: 2, reserva: 3 };
      const catDiff = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    return mergedList;
  }

  function syncMatchStatuses(db: any) {
    if (!db.matches) return;
    let mutated = false;

    db.matches.forEach((m: any) => {
      // If cancelled, state is CANCELADA
      if (m.status === 'cancelada') {
        return;
      }

      // If results are recorded, state is FINALIZADA ('encerrada')
      const hasResults = (db.results || []).some((r: any) => r.matchId === m.id);
      if (hasResults || m.status === 'encerrada') {
        if (m.status !== 'encerrada') {
          m.status = 'encerrada';
          mutated = true;
        }
        return;
      }

      // If draw exists and is locked ('affinitiesRecorded' or lock confirmed), state is SORTEADA
      const matchDraw = (db.draws || []).find((d: any) => d.matchId === m.id);
      const isDrawLocked = matchDraw && (matchDraw.affinitiesRecorded === true);
      if (isDrawLocked || m.status === 'sorteada') {
        if (m.status !== 'sorteada') {
          m.status = 'sorteada';
          mutated = true;
        }
        return;
      }

      // Count confirmed presences
      const computedList = getComputedPresences(db, m.id);
      const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;

      // If 15 confirmados, state is FECHADA
      if (confirmedCount >= 15) {
        if (m.status !== 'fechada') {
          m.status = 'fechada';
          mutated = true;
        }
        return;
      }

      // Check if deadline is expired to trigger automatic reserves release
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = m.confirmationDeadlineDaysBefore !== undefined ? m.confirmationDeadlineDaysBefore : deadlineDays;
      const { isDeadlineExpired } = getMatchDeadlineInfo(m, matchDeadlineDays);

      if (isDeadlineExpired && !m.reservesReleased) {
        m.reservesReleased = true;
        m.reservesReleasedAt = new Date().toISOString();
        mutated = true;
      }

      if (m.status !== 'agendada') {
        // Only set to aguardando_reservas if reserves are actually released and we need more athletes
        if (m.reservesReleased === true && confirmedCount < 15) {
          if (m.status !== 'aguardando_reservas') {
            m.status = 'aguardando_reservas';
            mutated = true;
          }
        } else {
          // Otherwise keep status as confirmando (CONFIRMACOES_ABERTAS)
          if (m.status !== 'confirmando') {
            m.status = 'confirmando';
            mutated = true;
          }
        }
      }
    });

    if (mutated) {
      writeDb(db);
    }
  }

  function syncDynamicNotifications(db: any) {
    if (!db.notifications) db.notifications = [];
    
    const todayStr = new Date().toISOString().split('T')[0];

    // --- SELF-HEALING & FILTERING OF STALE/CANCELLED/DELETED MATCHES/EVENTS ---
    const existingMatchIds = new Set((db.matches || []).map((m: any) => m.id));
    const existingEventIds = new Set((db.events || []).map((e: any) => e.id));
    
    const canceledMatchIds = new Set((db.matches || []).filter((m: any) => m.status === 'cancelada').map((m: any) => m.id));
    const canceledEventIds = new Set((db.events || []).filter((e: any) => e.status === 'cancelado').map((e: any) => e.id));

    // For deadline warnings, they should only exist for matches that are 'confirmando' or 'aguardando_reservas'
    const activeDeadlineIds = new Set<string>();
    (db.matches || []).forEach((match: any) => {
      if (match.status === 'confirmando' || match.status === 'aguardando_reservas') {
        activeDeadlineIds.add(`notif-match-deadline-24h-${match.id}`);
        activeDeadlineIds.add(`notif-match-deadline-2h-${match.id}`);
        activeDeadlineIds.add(`notif-match-deadline-general-${match.id}`);
      }
    });

    db.notifications = db.notifications.filter((n: any) => {
      // 1. Delete if match or event no longer exists
      if (n.matchId && !existingMatchIds.has(n.matchId)) {
        return false;
      }
      if (n.eventId && !existingEventIds.has(n.eventId)) {
        return false;
      }

      // 2. Delete if it's a deadline alert but the match is not active for confirmations
      if (n.id && n.id.startsWith('notif-match-deadline-')) {
        return activeDeadlineIds.has(n.id);
      }

      // 3. Delete obsolete match notifications of cancelled matches (keeping only the final cancellation/exclusion notice)
      if (n.matchId && canceledMatchIds.has(n.matchId)) {
        const titleLower = (n.title || '').toLowerCase();
        return titleLower.includes('cancelad') || titleLower.includes('excluíd');
      }

      // 4. Delete obsolete event notifications of cancelled events (keeping only the final cancellation/exclusion notice)
      if (n.eventId && canceledEventIds.has(n.eventId)) {
        const titleLower = (n.title || '').toLowerCase();
        return titleLower.includes('cancelad') || titleLower.includes('excluíd');
      }

      return true;
    });

    // 1. Sync bills (created and overdue)
    (db.bills || []).forEach((bill: any) => {
      const player = db.players.find((p: any) => p.id === bill.playerId);
      const pName = player ? player.name : 'Jogador';

      // Bill created
      const createdKey = `notif-bill-created-${bill.id}`;
      if (!db.notifications.some((n: any) => n.id === createdKey)) {
        db.notifications.push({
          id: createdKey,
          category: 'financeiro',
          title: '💰 Nova Cobrança Gerada',
          message: `Foi gerada uma cobrança de mensalidade de R$ ${bill.amount.toFixed(2)} referente à competência ${bill.competence} para o jogador ${pName}.`,
          status: 'nao_lida',
          createdAt: new Date().toISOString(),
          targetUserId: bill.playerId,
          actionUrl: 'finance'
        });
      }

      // Bill overdue
      const overdueKey = `notif-bill-overdue-${bill.id}`;
      if (bill.status === 'pendente' && bill.dueDate < todayStr) {
        if (!db.notifications.some((n: any) => n.id === overdueKey)) {
          db.notifications.push({
            id: overdueKey,
            category: 'financeiro',
            title: '🚨 Cobrança Vencida',
            message: `Sua mensalidade de R$ ${bill.amount.toFixed(2)} (${bill.competence}) venceu em ${bill.dueDate.split('-').reverse().join('/')}.`,
            status: 'nao_lida',
            createdAt: new Date().toISOString(),
            targetUserId: bill.playerId,
            actionUrl: 'finance'
          });
        }
      }
    });

    // 2. Scan matches for upcoming deadline warns
    const defaultDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
    (db.matches || []).forEach((match: any) => {
      if (match.status === 'confirmando') {
        try {
          const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : defaultDays;
          const { deadlineDateTime } = getMatchDeadlineInfo(match, matchDeadlineDays);
          const now = new Date();
          
          // Time diff in ms
          const diffMs = deadlineDateTime.getTime() - now.getTime();
          const hoursRemaining = diffMs / (1000 * 60 * 60);

          let deadlineTimeStr = "21:30";
          if (match.time) {
            deadlineTimeStr = match.time;
          }

          // 24 hours before alert (when hoursRemaining is between 0 and 24 hours)
          if (hoursRemaining > 0 && hoursRemaining <= 24) {
            const key24h = `notif-match-deadline-24h-${match.id}`;
            if (!db.notifications.some((n: any) => n.id === key24h)) {
              db.notifications.push({
                id: key24h,
                category: 'partida',
                title: '⏳ Confirmações Encerram Amanhã',
                message: `Lembrete: confirmações encerram amanhã às ${deadlineTimeStr}.`,
                status: 'nao_lida',
                createdAt: new Date().toISOString(),
                targetUserId: 'all',
                actionUrl: 'calendar',
                matchId: match.id
              });
            }
          }

          // 2 hours before alert (when hoursRemaining is between 0 and 2 hours)
          if (hoursRemaining > 0 && hoursRemaining <= 2) {
            const key2h = `notif-match-deadline-2h-${match.id}`;
            if (!db.notifications.some((n: any) => n.id === key2h)) {
              db.notifications.push({
                id: key2h,
                category: 'partida',
                title: '🚨 Últimas Horas de Confirmação',
                message: 'Últimas horas para confirmação.',
                status: 'nao_lida',
                createdAt: new Date().toISOString(),
                targetUserId: 'all',
                actionUrl: 'calendar',
                matchId: match.id
              });
            }
          }

          // Legacy / general warning (when hoursRemaining <= matchDeadlineDays * 24)
          const legacyLimitHours = matchDeadlineDays * 24;
          if (hoursRemaining > 0 && hoursRemaining <= legacyLimitHours) {
            const keyGeneral = `notif-match-deadline-general-${match.id}`;
            if (!db.notifications.some((n: any) => n.id === keyGeneral)) {
              db.notifications.push({
                id: keyGeneral,
                category: 'partida',
                title: '⚠️ Prazo de Confirmação Próximo',
                message: `O prazo para confirmar sua presença na rodada de ${match.date.split('-').reverse().join('/')} se encerra em breve.`,
                status: 'nao_lida',
                createdAt: new Date().toISOString(),
                targetUserId: 'all',
                actionUrl: 'calendar',
                matchId: match.id
              });
            }
          }
        } catch (err) {
          console.error('[sync] Error parsing match/deadline', err);
        }
      }
    });
  }

  // Middleware for parsing JSON requests with 250MB limit for base64 uploads
  app.use(express.json({ limit: '250mb' }));
  app.use(express.urlencoded({ limit: '250mb', extended: true }));

  // --- API Routes ---

  // Upload: S3 image upload simulation
  app.post('/api/upload-s3', (req, res) => {
    const { filename, fileType, fileData } = req.body;

    if (!filename || !fileType || !fileData) {
      return res.status(400).json({ error: 'Os campos filename, fileType e fileData são obrigatórios.' });
    }

    // Validate image format
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return res.status(400).json({ error: 'Formato de imagem inválido. Use JPG, JPEG, PNG ou WEBP.' });
    }

    // Capture potential AWS S3 config
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || 'sa-east-1';
    const awsBucket = process.env.AWS_S3_BUCKET || 'racha-do-fofim';

    const timestamp = Date.now();
    const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-');
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`;
    const simulatedS3Url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/uploads/${uniqueFilename}`;

    console.log(`[Upload S3] S3 Upload completed. Filename: ${uniqueFilename}, simulated S3 URL: ${simulatedS3Url}`);

    // Return mock S3 URL structure and the actual data URI for instant sandbox preview
    return res.json({
      message: 'Upload concluído com sucesso (Estrutura S3 ativa)!',
      s3Url: simulatedS3Url, 
      previewData: fileData 
    });
  });

  // Auth: Registrar Usuário
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    const db = readDb();
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const newUserId = 'user-' + Date.now();
    const newUser: User = {
      id: newUserId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'jogador', // default role
      status: 'pending', // Waiting admin approval
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[newUserId] = password;

    writeDb(db);

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso! Aguardando aprovação do administrador para acesso.',
      user: newUser
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const db = readDb();
    const normalizedEmail = email.toLowerCase().trim();

    const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const storedPassword = db.passwords[user.id];
    if (storedPassword !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Check Approval Status
    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Sua conta está aguardando aprovação administrativa. Entre em contato com o organizador.',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Sua solicitação de cadastro foi negada pelo administrador.',
        status: 'rejected'
      });
    }

    return res.json({
      message: 'Login realizado com sucesso!',
      user
    });
  });

  // Auth: Redefinição de senha (Esqueci minha senha)
  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'O e-mail é obrigatório.' });
    }

    const db = readDb();
    const user = db.users.find((u) => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (!user) {
      // For security, don't reveal if user exists or not, but return success
      return res.json({
        message: 'Se o e-mail estiver cadastrado, um link de redefinição foi enviado.',
        simulatedToken: null
      });
    }

    // Generate a simulated recovery token
    const token = 'recovery-' + Math.random().toString(36).substr(2, 9);
    
    // In a real application, we would send this via mail. For our sandbox applet,
    // we return the simulated token to easily complete the flow in the frontend!
    return res.json({
      message: 'E-mail de redefinição enviado com sucesso!',
      simulatedToken: token,
      userId: user.id
    });
  });

  // Auth: Resetar Senha
  app.post('/api/auth/reset-password', (req, res) => {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Informações inválidas para redefinição.' });
    }

    const db = readDb();
    if (!db.passwords[userId]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    db.passwords[userId] = newPassword;
    writeDb(db);

    return res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
  });

  // Usuários: Listar usuários para aprovação (Apenas Admin/Auxiliar)
  app.get('/api/users', (req, res) => {
    const db = readDb();
    // Return all users
    return res.json(db.users);
  });

  // Usuários: Listar auditoria de alterações (Apenas Admin/Auxiliar)
  app.get('/api/users/audits', (req, res) => {
    const db = readDb();
    return res.json(db.userAudits || []);
  });

  // Auditoria de prazos e liberação de reservas
  app.get('/api/deadline-audits', (req, res) => {
    const db = readDb();
    return res.json(db.deadlineAudits || []);
  });

  // Usuários: Aprovar / Rejeitar / Mudar Permissão (Admin apenas)
  app.post('/api/users/action', (req, res) => {
    const { 
      userId, 
      action, 
      role, 
      adminName,
      linkOption,
      selectedPlayerId,
      phone,
      playerCategory,
      primaryPosition,
      secondaryPositions,
      favoriteTeamId
    } = req.body as { 
      userId: string; 
      action: 'approve' | 'reject' | 'update_role'; 
      role?: UserRole; 
      adminName?: string;
      linkOption?: 'existing' | 'create';
      selectedPlayerId?: string;
      phone?: string;
      playerCategory?: PlayerCategory;
      primaryPosition?: PlayerPosition;
      secondaryPositions?: PlayerPosition[];
      favoriteTeamId?: string;
    };

    if (!userId || !action) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const db = readDb();
    const userIndex = db.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (userId === 'user-admin') {
      return res.status(400).json({ error: 'Incapaz de modificar o Administrador raiz.' });
    }

    // Safety check: Prevent removing/demoting the last active administrator
    const approvedAdmins = db.users.filter(u => u.role === 'admin' && u.status === 'approved');
    const isTargetAdmin = db.users[userIndex].role === 'admin' && db.users[userIndex].status === 'approved';
    if (isTargetAdmin) {
      const isDemotingOrRejecting = 
        (action === 'reject') || 
        (action === 'update_role' && role && role !== 'admin');
      if (isDemotingOrRejecting && approvedAdmins.length <= 1) {
        return res.status(400).json({ error: 'Erro de Segurança: Não faz sentido e é proibido remover ou rebaixar o único Administrador ativo no sistema.' });
      }
    }

    const previousRole = db.users[userIndex].role;
    const previousStatus = db.users[userIndex].status;

    let auditActionText = '';
    let chosenRole = role;

    if (!db.userAudits) {
      db.userAudits = [];
    }

    if (action === 'approve') {
      chosenRole = role || 'jogador';
      db.users[userIndex].status = 'approved';
      db.users[userIndex].role = chosenRole;
      auditActionText = `Aprovação de Cadastro (Perfil Inicial: ${chosenRole})`;
      
      // DECOUPLING LINKING OR CREATING OF ATHLETE DURING APPROVAL
      if (linkOption === 'existing' && selectedPlayerId) {
        db.users[userIndex].playerId = selectedPlayerId;
        const matchingPlayer = db.players.find(p => p.id === selectedPlayerId);
        if (matchingPlayer) {
          matchingPlayer.updatedAt = new Date().toISOString();
          
          db.userAudits.push({
            id: 'audit-link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString(),
            userId,
            userName: db.users[userIndex].name,
            userEmail: db.users[userIndex].email,
            action: 'Alteração de Vínculo',
            previousRole: '',
            newRole: '',
            previousStatus: '',
            newStatus: '',
            performedBy: adminName || 'Administrador do Sistema',
            details: `Vínculo com atleta existente estabelecido: ${matchingPlayer.name} (${matchingPlayer.id})`
          });
        }
      } else {
        // Create new player athlete
        const newPlId = 'player-' + Date.now();
        const formattedPhone = phone || '(85) 99999-9999';
        const initialCategory = playerCategory || 'reserva';
        const initialPosition = primaryPosition || 'atacante';

        const newPlayer: Player = {
          id: newPlId,
          name: db.users[userIndex].name,
          phone: formattedPhone,
          photoOriginal: '',
          playerCardUrl: '',
          favoriteTeamId: favoriteTeamId || 'out',
          category: initialCategory,
          status: 'disponivel',
          primaryPosition: initialPosition,
          secondaryPositions: secondaryPositions || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentStreak: 0,
          maxStreak: 0
        };

        db.players.push(newPlayer);
        db.users[userIndex].playerId = newPlId;

        // Auditoria: Criação de atleta
        db.userAudits.push({
          id: 'audit-pcreate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          userId,
          userName: db.users[userIndex].name,
          userEmail: db.users[userIndex].email,
          action: 'Criação de Atleta',
          previousRole: '',
          newRole: '',
          previousStatus: '',
          newStatus: '',
          performedBy: adminName || 'Administrador do Sistema',
          details: `Atleta ${newPlayer.name} criado e vinculado automaticamente durante aprovação. Posição principal: ${newPlayer.primaryPosition}.`
        });

        // Auditoria: Troca de categoria
        db.userAudits.push({
          id: 'audit-pcat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          userId,
          userName: db.users[userIndex].name,
          userEmail: db.users[userIndex].email,
          action: 'Troca de categoria',
          previousRole: '',
          newRole: '',
          previousStatus: '',
          newStatus: '',
          performedBy: adminName || 'Administrador do Sistema',
          details: `Categoria inicial definida como: ${initialCategory}`
        });

        // Auditoria: Alteração de telefone
        db.userAudits.push({
          id: 'audit-pphone-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          userId,
          userName: db.users[userIndex].name,
          userEmail: db.users[userIndex].email,
          action: 'Alteração de telefone',
          previousRole: '',
          newRole: '',
          previousStatus: '',
          newStatus: '',
          performedBy: adminName || 'Administrador do Sistema',
          details: `Telefone definido como: ${formattedPhone}`
        });
      }

      notify(db, {
        category: 'jogador',
        title: '🎉 Cadastro Aprovado!',
        message: `Seu cadastro no Racha do Fofim foi aprovado como ${chosenRole === 'admin' ? 'Administrador' : chosenRole === 'auxiliar' ? 'Auxiliar' : 'Jogador'}. Seja bem-vindo ao grupo!`,
        targetUserId: userId,
        actionUrl: 'players'
      });

      notify(db, {
        category: 'jogador',
        title: '🏃 Novo Jogador no Grupo',
        message: `O cadastro de ${db.users[userIndex].name} foi aprovado pela administração como ${chosenRole === 'admin' ? 'Administrador' : chosenRole === 'auxiliar' ? 'Auxiliar' : 'Jogador'}.`,
        targetUserId: 'all',
        actionUrl: 'players'
      });
    } else if (action === 'reject') {
      db.users[userIndex].status = 'rejected';
      auditActionText = 'Cadastro Rejeitado';
    } else if (action === 'update_role' && role) {
      db.users[userIndex].role = role;
      auditActionText = `Alteração de Perfil de ${previousRole} para ${role}`;

      // Update link action if provided
      if (selectedPlayerId) {
        const oldPlayerId = db.users[userIndex].playerId;
        db.users[userIndex].playerId = selectedPlayerId;
        const matchingPlayer = db.players.find(p => p.id === selectedPlayerId);
        const prevPlayer = oldPlayerId ? db.players.find(p => p.id === oldPlayerId) : null;
        if (matchingPlayer) {
          db.userAudits.push({
            id: 'audit-link-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString(),
            userId,
            userName: db.users[userIndex].name,
            userEmail: db.users[userIndex].email,
            action: 'Alteração de Vínculo',
            previousRole: '',
            newRole: '',
            previousStatus: '',
            newStatus: '',
            performedBy: adminName || 'Administrador do Sistema',
            details: `Vínculo de atleta alterado para ${matchingPlayer.name} (${matchingPlayer.id}) (Anterior: ${prevPlayer ? prevPlayer.name : 'Nenhum'})`
          });
        }
      }
    }

    // Write audit log entry
    db.userAudits.push({
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId,
      userName: db.users[userIndex].name,
      userEmail: db.users[userIndex].email,
      action: auditActionText,
      previousRole,
      newRole: chosenRole || previousRole,
      previousStatus,
      newStatus: db.users[userIndex].status,
      performedBy: adminName || 'Administrador do Sistema'
    });

    writeDb(db);
    return res.json({ message: 'Ação realizada com sucesso!', user: db.users[userIndex] });
  });

  // Jogadores: Listar (Retorna ativos se sem parâmetro, ou todos se admin para gerenciamento)
  app.get('/api/players', (req, res) => {
    const db = readDb();
    const includeDeleted = req.query.includeDeleted === 'true';

    let result = db.players;
    if (!includeDeleted) {
      result = db.players.filter((p) => !p.deletedAt);
    }

    return res.json(result);
  });

  // Jogadores: Criar Jogador
  app.post('/api/players', (req, res) => {
    const playerData = req.body as Omit<Player, 'id' | 'createdAt' | 'updatedAt'>;
    const { responsibleName } = req.body as { responsibleName?: string };

    if (!playerData.name || !playerData.category || !playerData.status || !playerData.primaryPosition) {
      return res.status(400).json({ error: 'Nome, categoria, status e posição principal são obrigatórios.' });
    }

    const db = readDb();
    const formattedPhone = playerData.phone || '(85) 99999-9999';

    const newPlayer: Player = {
      ...playerData,
      phone: formattedPhone,
      id: 'player-' + Date.now(),
      secondaryPositions: playerData.secondaryPositions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStreak: 0,
      maxStreak: 0
    };

    db.players.push(newPlayer);

    // Auditoria: Criação de atleta
    if (!db.userAudits) db.userAudits = [];
    db.userAudits.push({
      id: 'audit-pcreate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: newPlayer.name,
      userEmail: playerData.email || 'atleta@racha.fofim',
      action: 'Criação de Atleta',
      previousRole: '',
      newRole: '',
      previousStatus: '',
      newStatus: '',
      performedBy: responsibleName || 'Administrador',
      details: `Atleta ${newPlayer.name} cadastrado manualmente no gerenciamento esportivo.`
    });

    // Auditoria: Troca de categoria
    db.userAudits.push({
      id: 'audit-pcat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: newPlayer.name,
      userEmail: playerData.email || 'atleta@racha.fofim',
      action: 'Troca de categoria',
      previousRole: '',
      newRole: '',
      previousStatus: '',
      newStatus: '',
      performedBy: responsibleName || 'Administrador',
      details: `Categoria inicial definida como: ${newPlayer.category}`
    });

    // Auditoria: Alteração de telefone
    db.userAudits.push({
      id: 'audit-pphone-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: newPlayer.name,
      userEmail: playerData.email || 'atleta@racha.fofim',
      action: 'Alteração de telefone',
      previousRole: '',
      newRole: '',
      previousStatus: '',
      newStatus: '',
      performedBy: responsibleName || 'Atleta',
      details: `Telefone definido como: ${formattedPhone}`
    });

    writeDb(db);

    return res.status(201).json({ message: 'Jogador cadastrado com sucesso!', player: newPlayer });
  });

  // Jogadores: Atualizar Jogador
  app.put('/api/players/:id', (req, res) => {
    const { id } = req.params;
    const updateData = req.body as Partial<Player>;
    const { responsibleName } = req.body as any;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    const existingPlayer = db.players[index];

    const categoryChanged = updateData.category && updateData.category !== existingPlayer.category;
    if (categoryChanged) {
      const transition = {
        id: 'category-transition-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        playerId: existingPlayer.id,
        playerName: existingPlayer.name,
        previousCategory: existingPlayer.category,
        newCategory: updateData.category,
        date: new Date().toISOString(),
        responsibleName: responsibleName || 'Administrador'
      };
      if (!db.categoryTransitions) {
        db.categoryTransitions = [];
      }
      db.categoryTransitions.push(transition);
    }

    // Register precise audit logs
    if (!db.userAudits) db.userAudits = [];

    if (categoryChanged) {
      db.userAudits.push({
        id: 'audit-pcat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: existingPlayer.name,
        userEmail: existingPlayer.email || 'atleta@racha.fofim',
        action: 'Troca de categoria',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: responsibleName || 'Administrador',
        details: `Categoria de ${existingPlayer.name} alterada de ${existingPlayer.category} para ${updateData.category}`
      });
    }

    const phoneChanged = updateData.phone && updateData.phone !== existingPlayer.phone;
    if (phoneChanged) {
      db.userAudits.push({
        id: 'audit-pphone-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: existingPlayer.name,
        userEmail: existingPlayer.email || 'atleta@racha.fofim',
        action: 'Alteração de telefone',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: responsibleName || 'Administrador',
        details: `Telefone de ${existingPlayer.name} alterado de ${existingPlayer.phone} para ${updateData.phone}`
      });
    }

    // Merge updates
    const updatedPlayer: Player = {
      ...existingPlayer,
      ...updateData,
      secondaryPositions: updateData.secondaryPositions || existingPlayer.secondaryPositions,
      updatedAt: new Date().toISOString()
    };

    // If change status to disponivel or afastado, wipe the limits
    if (updatedPlayer.status === 'disponivel' || updatedPlayer.status === 'afastado') {
      updatedPlayer.statusStartDate = undefined;
      updatedPlayer.statusEndDate = undefined;
    }

    const statusChanged = updateData.status && updateData.status !== existingPlayer.status;
    if (statusChanged) {
      const statusLabels: Record<string, string> = {
        disponivel: 'Disponível',
        indisponivel: 'Indisponível',
        lesionado: 'Lesionado',
        afastado: 'Afastado'
      };
      notify(db, {
        category: 'jogador',
        title: '🏃 Status Alterado',
        message: `O jogador ${existingPlayer.name} teve seu status alterado para "${statusLabels[updateData.status!] || updateData.status}".`,
        targetUserId: 'all',
        actionUrl: 'players'
      });

      if (existingPlayer.status === 'lesionado' && updateData.status === 'disponivel') {
        notify(db, {
          category: 'jogador',
          title: '💪 Lesão Encerrada!',
          message: `Ótimas notícias! O jogador ${existingPlayer.name} encerrou sua lesão e está novamente à disposição do grupo!`,
          targetUserId: 'all',
          actionUrl: 'players'
        });
      }
    }

    if (categoryChanged && updateData.category === 'mensalista') {
      notify(db, {
        category: 'jogador',
        title: '⭐️ Promoção para Mensalista!',
        message: `O jogador ${existingPlayer.name} foi oficialmente promovido ao grupo de Mensalistas. Parabéns!`,
        targetUserId: existingPlayer.id,
        actionUrl: 'players'
      });
      notify(db, {
        category: 'jogador',
        title: '⭐️ Novo Mensalista no Racha',
        message: `O jogador ${existingPlayer.name} agora é um Mensalista oficial do racha!`,
        targetUserId: 'all',
        actionUrl: 'players'
      });
    }

    db.players[index] = updatedPlayer;
    writeDb(db);

    return res.json({ message: 'Jogador atualizado com sucesso!', player: updatedPlayer });
  });

  // Jogadores: Soft Delete (Inativar/Excluir Logicamente)
  app.delete('/api/players/:id', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = new Date().toISOString();
    db.players[index].updatedAt = new Date().toISOString();
    writeDb(db);

    return res.json({ message: 'Jogador inativado com sucesso!', player: db.players[index] });
  });

  // Jogadores: Restaurar (Desfazer inativação)
  app.post('/api/players/:id/restore', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = undefined;
    db.players[index].updatedAt = new Date().toISOString();
    writeDb(db);

    return res.json({ message: 'Jogador reativado com sucesso!', player: db.players[index] });
  });

  // Buscar histórico de transição de categoria de um jogador
  app.get('/api/players/:id/transitions', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const transitions = (db.categoryTransitions || []).filter(t => t.playerId === id);
      return res.json(transitions.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar histórico de mudanças.' });
    }
  });

  // Alertas e recomendações de promoção para mensalistas
  app.get('/api/mensalista-alerts', (req, res) => {
    try {
      const db = readDb();
      const maxMensalistas = db.recurrentConfig?.maxMensalistas || 12;
      
      // Active mensalistas are those who are not soft-deleted and whose categories are 'mensalista' or 'mensalista_goleiro'
      const activeMensalistas = db.players.filter(p => !p.deletedAt && (p.category === 'mensalista' || p.category === 'mensalista_goleiro'));
      const activeCount = activeMensalistas.length;
      
      const isBelowLimit = activeCount < maxMensalistas;
      const availableVacancies = maxMensalistas - activeCount;

      // Filter non-deleted reserves
      const reserves = db.players.filter(p => !p.deletedAt && p.category === 'reserva');

      const suggestedReserves = reserves.map(p => {
        // Confirmed presences count
        const presencesCount = (db.presences || []).filter(pr => pr.playerId === p.id && pr.status === 'confirmado').length;
        
        // Days in the group
        const dateCreated = p.createdAt ? new Date(p.createdAt) : new Date();
        const diffTime = Math.abs(new Date().getTime() - dateCreated.getTime());
        const daysInGroup = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: p.id,
          name: p.name,
          presences: presencesCount,
          daysInGroup,
          status: p.status,
          createdAt: p.createdAt
        };
      }).sort((a, b) => {
        // Sort by highest presences first, then by days in group (longer time in group)
        if (b.presences !== a.presences) {
          return b.presences - a.presences;
        }
        return b.daysInGroup - a.daysInGroup;
      });

      return res.json({
        maxMensalistas,
        activeCount,
        isBelowLimit,
        availableVacancies,
        suggestedReserves
      });
    } catch (err) {
      console.error('[Error fetching mensalista alerts]:', err);
      return res.status(500).json({ error: 'Erro ao buscar alertas de mensalistas.' });
    }
  });

  // Jogadores: Preparação do fluxograma futuro de Card IA
  app.post('/api/players/:id/generate-card', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const player = db.players.find((p) => p.id === id);

    if (!player) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    if (!player.photoOriginal) {
      return res.status(400).json({ 
        error: 'missing_photo', 
        message: 'O atleta necessita de uma Foto Original cadastrada no S3 para que o Card IA possa ser gerado.' 
      });
    }

    // Estrutura planejada para a futura versão com serviço de IA integrado:
    // Passo 1: Obter "photoOriginal" do S3.
    // Passo 2: Enviar imagem para o modelo de Visão do Gemini (ou outro gerador generativo).
    // Passo 3: O prompt solicita e segmenta o rosto original do atleta e substitui o corpo com uniforme customizado nas cores do clube (FAVORITE_TEAMS).
    // Passo 4: O card gerado em formato buffer é salvo no S3.
    // Passo 5: A URL resultante é persistida no banco do respectivo Jogador (player.playerCardUrl = resS3Url).
    
    return res.status(200).json({
      success: false,
      error: 'planned_feature',
      message: 'Funcionalidade planejada para a próxima versão. Integração com IA em andamento.',
      details: {
        playerId: player.id,
        photoOriginal: player.photoOriginal,
        favoriteTeamId: player.favoriteTeamId,
        futureSteps: [
          'Download original image from S3',
          'Send to AI generation model with face preservation',
          'Color jersey design using favorite team color palettes',
          'Upload output to S3 bucket /cards',
          'Save persistent card image path back to player database object'
        ]
      }
    });
  });

  // --- Evaluation Helper Function ---
  function computePlayerMetrics(playerId: string, playerPosition: string, evaluations: any[], history: any[]) {
    // Filter evaluations for this player
    const playerEvals = evaluations.filter(e => e.targetPlayerId === playerId);
    const evalCount = playerEvals.length;
    
    // Weights and attributes based on position
    const isGk = playerPosition === 'goleiro';
    const attribs = isGk 
      ? ['reflexo', 'posicionamento', 'saida_gol', 'reposicao']
      : ['defesa', 'passe', 'finalizacao', 'velocidade', 'posicionamento', 'drible', 'marcacao', 'fisico'];
      
    const weights: Record<string, number> = isGk
      ? { reflexo: 0.35, posicionamento: 0.25, saida_gol: 0.20, reposicao: 0.20 }
      : { defesa: 0.15, passe: 0.15, finalizacao: 0.15, velocidade: 0.15, posicionamento: 0.15, drible: 0.10, marcacao: 0.10, fisico: 0.05 };

    // Anti-manipulation constants (Média Ponderada/Suavizada com base neutra)
    const BASE_RATING = 3.5; // Start with a realistic competitive baseline of 3.5
    const BASE_WEIGHT = 4.0; // Acts as 4 initial pre-votes

    const computedAttributes: Record<string, { average: number, rawCount: number }> = {};
    let weightedOverallSum = 0;

    attribs.forEach(attr => {
      // Get all user votes for this attribute
      const votes = playerEvals.map(e => e.ratings[attr]).filter(v => v !== undefined && v !== null);
      const votesSum = votes.reduce((acc, v) => acc + (v as number), 0);
      const votesCount = votes.length;

      // Weighted average formula to prevent sudden mutations
      const weightedAvg = ((BASE_RATING * BASE_WEIGHT) + votesSum) / (BASE_WEIGHT + votesCount);
      
      // Round to 1 decimal place
      const roundedAvg = Math.round(weightedAvg * 10) / 10;

      computedAttributes[attr] = {
        average: roundedAvg,
        rawCount: votesCount
      };

      // Overall contribution
      const weight = weights[attr] || 0;
      weightedOverallSum += roundedAvg * weight;
    });

    const overall = Math.round(weightedOverallSum * 10) / 10;

    // History filtering
    const playerHistory = history
      .filter(h => h.playerId === playerId)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      playerId,
      overall,
      evalCount,
      computedAttributes,
      history: playerHistory
    };
  }

  // evaluations/summary: list metrics and overall rating for all players
  app.get('/api/evaluations/summary', (req, res) => {
    try {
      const db = readDb();
      const summaries = db.players.map(p => {
        return computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
      });
      return res.json(summaries);
    } catch (err) {
      console.error('[Error Summary Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao processar resumo de avaliações.' });
    }
  });

  // players/:id/evaluations: specific ratings history, and current active evaluator's vote details
  app.get('/api/players/:id/evaluations', (req, res) => {
    try {
      const { id } = req.params;
      const evaluatorUserId = req.query.evaluatorUserId as string;

      const db = readDb();
      const player = db.players.find(p => p.id === id);

      if (!player) {
        return res.status(404).json({ error: 'Jogador não encontrado.' });
      }

      const metrics = computePlayerMetrics(id, player.primaryPosition, db.evaluations, db.evaluationHistory);
      
      // Find my evaluation (if evaluatorUserId is passed)
      let myEvaluation = null;
      if (evaluatorUserId) {
        myEvaluation = db.evaluations.find(e => e.evaluatorUserId === evaluatorUserId && e.targetPlayerId === id) || null;
      }

      // Calculate attendance statistics dynamically from database
      const playerPresences = db.presences.filter(p => p.playerId === id);
      const presencesCount = playerPresences.filter(p => p.status === 'confirmado').length;
      const absencesCount = playerPresences.filter(p => p.status === 'cancelado').length;

      const participationsList = playerPresences.map(p => {
        const matchObj = db.matches.find(m => m.id === p.matchId);
        return {
          matchId: p.matchId,
          date: matchObj ? matchObj.date : '',
          location: matchObj ? matchObj.location : '',
          status: p.status, // 'confirmado' | 'cancelado' | 'nao_confirmado'
          matchStatus: matchObj ? matchObj.status : ''
        };
      }).filter(item => item.date !== '');

      // Sort by date descending
      participationsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastParticipations = participationsList.slice(0, 5);

      const metricsEnriched = {
        ...metrics,
        presencesCount,
        absencesCount,
        lastParticipations
      };

      return res.json({
        metrics: metricsEnriched,
        myEvaluation
      });
    } catch (err) {
      console.error('[Error Get Player Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao buscar faturamento ou avaliações do jogador.' });
    }
  });

  // players/:id/evaluate: evaluates a player
  app.post('/api/players/:id/evaluate', (req, res) => {
    try {
      const { id } = req.params;
      const { evaluatorUserId, ratings } = req.body;

      if (!evaluatorUserId || !ratings) {
        return res.status(400).json({ error: 'Identificação do avaliador e notas são obrigatórios.' });
      }

      const db = readDb();
      const player = db.players.find(p => p.id === id);

      if (!player) {
        return res.status(404).json({ error: 'Jogador sendo avaliado não existe.' });
      }

      // Validate increments of 0.5 & range 0.0 to 5.0
      const keys = Object.keys(ratings);
      for (const key of keys) {
        const val = parseFloat(ratings[key]);
        if (isNaN(val) || val < 0.0 || val > 5.0 || (val * 10) % 5 !== 0) {
          return res.status(400).json({ error: 'Valores técnicos devem ser escalas de 0.0 até 5.0 com incrementos de 0.5.' });
        }
      }

      // Get current period (Year-Month) matching the single evaluation per month rule
      const currentPeriod = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      const previousEval = db.evaluations.find(e => e.evaluatorUserId === evaluatorUserId && e.targetPlayerId === id);

      let messageStr = 'Avaliação registrada com sucesso de forma anônima!';

      if (previousEval) {
        const wasSamePeriod = previousEval.date.startsWith(currentPeriod);
        if (wasSamePeriod) {
          messageStr = 'Sua avaliação anterior para este período foi atualizada com sucesso!';
        } else {
          messageStr = 'Sua nova avaliação substituiu a avaliação do período anterior com sucesso!';
        }

        // Overwrite the existing evaluation to prevent duplication
        previousEval.ratings = ratings;
        previousEval.date = new Date().toISOString().split('T')[0];
      } else {
        db.evaluations.push({
          id: 'eval-' + Date.now(),
          evaluatorUserId,
          targetPlayerId: id,
          date: new Date().toISOString().split('T')[0],
          ratings
        });
      }

      // Trigger metrics recalculation to safely save history entries dynamically on update!
      const newMetrics = computePlayerMetrics(id, player.primaryPosition, db.evaluations, db.evaluationHistory);
      
      // Save/update overall history entry for today YYYY-MM-DD
      const todayStr = new Date().toISOString().split('T')[0];
      const historyIndex = db.evaluationHistory.findIndex(h => h.playerId === id && h.date === todayStr);
      if (historyIndex !== -1) {
        db.evaluationHistory[historyIndex].overall = newMetrics.overall;
      } else {
        db.evaluationHistory.push({
          playerId: id,
          date: todayStr,
          overall: newMetrics.overall
        });
      }

      writeDb(db);
      return res.json({ 
        message: messageStr,
        metrics: newMetrics
      });
    } catch (err) {
      console.error('[Error Post Player Evaluate]', err);
      return res.status(500).json({ error: 'Não foi possível salvar a avaliação.' });
    }
  });

  // ==========================================
  // --- SEASONS (TEMPORADAS) API ENDPOINTS ---
  // ==========================================

  app.get('/api/seasons', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.seasons || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao listar temporadas.' });
    }
  });

  app.post('/api/seasons', (req, res) => {
    try {
      const { name, year, startDate, endDate, active } = req.body;
      if (!name || !year || !startDate || !endDate) {
        return res.status(400).json({ error: 'Campos Nome, Ano, Data início e Fim são obrigatórios.' });
      }

      const db = readDb();
      const newSeason: Season = {
        id: 'season-' + Date.now(),
        name,
        year: parseInt(year),
        startDate,
        endDate,
        active: !!active
      };

      if (newSeason.active) {
        // Deactivate all other seasons
        db.seasons = db.seasons.map((s) => ({ ...s, active: false }));
      }

      db.seasons.push(newSeason);
      writeDb(db);
      return res.status(201).json(newSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar temporada.' });
    }
  });

  app.put('/api/seasons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, year, startDate, endDate, active } = req.body;

      const db = readDb();
      const seasonIndex = db.seasons.findIndex((s) => s.id === id);

      if (seasonIndex === -1) {
        return res.status(404).json({ error: 'Temporada não encontrada.' });
      }

      const updatedSeason = {
        ...db.seasons[seasonIndex],
        name: name || db.seasons[seasonIndex].name,
        year: year ? parseInt(year) : db.seasons[seasonIndex].year,
        startDate: startDate || db.seasons[seasonIndex].startDate,
        endDate: endDate || db.seasons[seasonIndex].endDate,
        active: active !== undefined ? !!active : db.seasons[seasonIndex].active
      };

      if (updatedSeason.active) {
        // Deactivate all other seasons
        db.seasons = db.seasons.map((s) => (s.id === id ? s : { ...s, active: false }));
      }

      db.seasons[seasonIndex] = updatedSeason;
      writeDb(db);
      return res.json(updatedSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar temporada.' });
    }
  });

  // ==========================================
  // --- MATCHES (PARTIDAS) API ENDPOINTS ---
  // ==========================================

  app.get('/api/matches', (req, res) => {
    try {
      const db = readDb();
      syncMatchStatuses(db);
      const activeSeason = db.seasons.find((s) => s.active);
      
      const activePlayerIds = db.players.filter((p) => !p.deletedAt).map((p) => p.id);
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;

      const enrichedMatches = db.matches.map((m) => {
        const computedList = getComputedPresences(db, m.id);
        const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;

        // Calculations
        const vacancies = Math.max(0, 15 - confirmedCount);
        const hasMinimumPlayers = confirmedCount >= 15;
        const missingPlayersCount = Math.max(0, 15 - confirmedCount);

        // Deadline check
        const matchDeadlineDays = m.confirmationDeadlineDaysBefore !== undefined ? m.confirmationDeadlineDaysBefore : deadlineDays;
        const { deadlineDateTime, isDeadlineExpired, deadlineDateStr, hoursRemaining } = getMatchDeadlineInfo(m, matchDeadlineDays);

        const hasPresences = computedList.some((p: any) => p.presenceStatus === 'confirmado');
        const hasDraws = (db.draws || []).some((d) => d.matchId === m.id);
        const hasResults = (db.results || []).some((r) => r.matchId === m.id);

        return {
          ...m,
          confirmedCount,
          vacancies,
          hasMinimumPlayers,
          missingPlayersCount,
          isDeadlineExpired,
          deadlineDateStr,
          hoursRemaining,
          deadlineDateISO: deadlineDateTime.toISOString(),
          hasPresences,
          hasDraws,
          hasResults
        };
      });

      // Filter matches by current season if requested
      const { seasonId } = req.query;
      let filtered = enrichedMatches;
      if (seasonId) {
        filtered = enrichedMatches.filter((m) => m.seasonId === seasonId);
      } else if (activeSeason) {
        filtered = enrichedMatches.filter((m) => m.seasonId === activeSeason.id);
      }

      // Sort matches by date ascending
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return res.json(filtered);
    } catch (err) {
      console.error('[Error GET Matches]', err);
      return res.status(500).json({ error: 'Erro ao carregar partidas.' });
    }
  });

  app.post('/api/matches', (req, res) => {
    try {
      const { date, time, location, durationMinutes, status, seasonId, confirmationDeadlineDaysBefore } = req.body;
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e Horário são obrigatórios.' });
      }

      // Check if match date is in the past relative to today (America/Sao_Paulo timezone or fallback)
      let todayStr = '';
      try {
        todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          .split('/')
          .map(x => x.padStart(2, '0'))
          .reverse()
          .join('-');
      } catch (e) {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const r = String(d.getDate()).padStart(2, '0');
        todayStr = `${y}-${m}-${r}`;
      }

      if (date < todayStr) {
        return res.status(400).json({ error: 'Não é permitido agendar uma rodada com data anterior ao dia atual.' });
      }

      const db = readDb();
      const activeSeason = db.seasons.find((s) => s.active);
      const targetSeasonId = seasonId || (activeSeason ? activeSeason.id : null);

      if (!targetSeasonId) {
        return res.status(400).json({ error: 'Você precisa criar/ativar uma Temporada antes de agendar partidas.' });
      }

      // Check if match already exists on this date
      const exists = db.matches.some((m) => m.date === date && m.seasonId === targetSeasonId);
      if (exists) {
        return res.status(400).json({ error: `Já existe uma partida agendada para o dia ${date}.` });
      }

      const newMatch: Match = {
        id: 'match-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        seasonId: targetSeasonId,
        date,
        time,
        location: location || 'Arena Green Society (Quadra Principal)',
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 120,
        status: status || 'agendada',
        confirmationDeadlineDaysBefore: confirmationDeadlineDaysBefore !== undefined && confirmationDeadlineDaysBefore !== null ? parseInt(confirmationDeadlineDaysBefore) : undefined
      };

      db.matches.push(newMatch);

      notify(db, {
        category: 'partida',
        title: '⚽ Nova Partida Agendada',
        message: `Uma nova partida foi agendada para o dia ${newMatch.date.split('-').reverse().join('/')} às ${newMatch.time} na localidade ${newMatch.location}.`,
        actionUrl: 'calendar',
        matchId: newMatch.id
      });

      // Manual schedule acts as confirmation of occurrence, so we resume recurrent Config if active
      if (db.recurrentConfig && !db.recurrentConfig.active) {
        db.recurrentConfig.active = true;
      }

      writeDb(db);
      return res.status(201).json(newMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao criar partida.' });
    }
  });

  app.put('/api/matches/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { date, time, location, durationMinutes, status, confirmationDeadlineDaysBefore } = req.body;

      const db = readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const previousStatus = db.matches[index].status;
      const dateChanged = date && date !== db.matches[index].date;
      const timeChanged = time && time !== db.matches[index].time;
      const deadlineDaysChanged = confirmationDeadlineDaysBefore !== undefined && parseInt(confirmationDeadlineDaysBefore) !== db.matches[index].confirmationDeadlineDaysBefore;

      const updatedMatch = {
        ...db.matches[index],
        date: date || db.matches[index].date,
        time: time || db.matches[index].time,
        location: location || db.matches[index].location,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : db.matches[index].durationMinutes,
        status: status || db.matches[index].status,
        confirmationDeadlineDaysBefore: confirmationDeadlineDaysBefore !== undefined && confirmationDeadlineDaysBefore !== null ? parseInt(confirmationDeadlineDaysBefore) : db.matches[index].confirmationDeadlineDaysBefore,
        reservesReleased: (dateChanged || timeChanged || deadlineDaysChanged) ? false : db.matches[index].reservesReleased,
        reservesReleasedAt: (dateChanged || timeChanged || deadlineDaysChanged) ? undefined : db.matches[index].reservesReleasedAt
      };

      // Reschedule audit log
      if (dateChanged || timeChanged || deadlineDaysChanged) {
        const deadlineDays = updatedMatch.confirmationDeadlineDaysBefore !== undefined ? updatedMatch.confirmationDeadlineDaysBefore : (db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2);
        const { deadlineDateTime, deadlineDateStr } = getMatchDeadlineInfo(updatedMatch, deadlineDays);
        if (!db.deadlineAudits) db.deadlineAudits = [];
        db.deadlineAudits.push({
          id: 'da-' + updatedMatch.id + '-resched-' + Date.now(),
          matchId: updatedMatch.id,
          matchDate: updatedMatch.date,
          matchTime: updatedMatch.time,
          calculatedDeadline: deadlineDateTime.toISOString(),
          auditType: 'deadline_recalculation_by_admin',
          createdAt: new Date().toISOString(),
          details: `Partida/Prazos atualizados pelo admin. Novo limite de confirmação calculado: ${deadlineDateStr}.`
        });
      }

      db.matches[index] = updatedMatch;

      // INTERRUPTION POLICY: Caso uma partida seja cancelada, a recorrência automática deve ser interrompida.
      if (updatedMatch.status === 'cancelada' && previousStatus !== 'cancelada') {
        if (db.recurrentConfig) {
          db.recurrentConfig.active = false; // Parar a recorrência
        }
        notify(db, {
          category: 'partida',
          title: '❌ Partida Cancelada',
          message: `A partida do dia ${updatedMatch.date.split('-').reverse().join('/')} foi cancelada.`,
          actionUrl: 'calendar',
          matchId: updatedMatch.id
        });
      }

      // RESUMPTION POLICY: Se o administrador confirma ou agenda a partida manualmente, reativamos a recorrência
      if ((updatedMatch.status === 'agendada' || updatedMatch.status === 'confirmando') && previousStatus === 'cancelada') {
        if (db.recurrentConfig) {
          db.recurrentConfig.active = true; // Retomar a recorrência normal
        }
        notify(db, {
          category: 'partida',
          title: '🔄 Partida Reaberta',
          message: `A partida do dia ${updatedMatch.date.split('-').reverse().join('/')} foi reaberta por um administrador.`,
          actionUrl: 'calendar',
          matchId: updatedMatch.id
        });
      }

      writeDb(db);
      return res.json(updatedMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar partida.' });
    }
  });

  app.post('/api/matches/:id/release-reserves', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const match = db.matches[index];
      match.reservesReleased = true;
      match.reservesReleasedAt = new Date().toISOString();
      
      if (['agendada', 'confirmando'].includes(match.status)) {
        match.status = 'aguardando_reservas';
      }

      if (!db.deadlineAudits) db.deadlineAudits = [];
      db.deadlineAudits.push({
        id: 'da-' + match.id + '-manual-' + Date.now(),
        matchId: match.id,
        matchDate: match.date,
        matchTime: match.time,
        releasedAt: new Date().toISOString(),
        auditType: 'manual_reserves_release',
        createdAt: new Date().toISOString(),
        details: `Convocação de reservas iniciada manualmente pelo administrador.`
      });

      syncMatchStatuses(db);
      writeDb(db);

      return res.json({ success: true, match });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao liberar reservas.' });
    }
  });

  app.post('/api/matches/bulk-delete', (req, res) => {
    try {
      const { matchIds } = req.body;
      if (!Array.isArray(matchIds)) {
        return res.status(400).json({ error: 'matchIds deve ser um array.' });
      }

      const db = readDb();
      const undeletable: string[] = [];
      const toDelete: string[] = [];

      for (const id of matchIds) {
        const hasPresences = (db.presences || []).some((p) => p.matchId === id && p.status === 'confirmado');
        const hasDraws = (db.draws || []).some((d) => d.matchId === id);
        const hasResults = (db.results || []).some((r) => r.matchId === id);

        if (hasPresences || hasDraws || hasResults) {
          undeletable.push(id);
        } else {
          toDelete.push(id);
        }
      }

      if (toDelete.length === 0) {
        return res.status(400).json({ error: 'Nenhuma das partidas selecionadas pode ser excluída, pois possuem histórico ou são inválidas.' });
      }

      db.matches = (db.matches || []).filter((m) => !toDelete.includes(m.id));
      db.presences = (db.presences || []).filter((p) => !toDelete.includes(p.matchId));
      db.reserveAlerts = (db.reserveAlerts || []).filter((a) => !toDelete.includes(a.matchId));

      // Remove any related notifications
      if (db.notifications) {
        db.notifications = db.notifications.filter(
          (n: any) => 
            !(n.matchId && toDelete.includes(n.matchId)) &&
            !(n.id && toDelete.some((dId: string) => n.id.includes(dId))) &&
            !(n.actionUrl && n.actionUrl.includes('calendar') && toDelete.some((dId: string) => n.message && n.message.includes(dId)))
        );
      }

      writeDb(db);

      return res.json({
        success: true,
        deletedCount: toDelete.length,
        undeletableCount: undeletable.length,
        deletedIds: toDelete
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao realizar exclusão em massa.' });
    }
  });

  app.delete('/api/matches/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();

      const hasPresences = (db.presences || []).some((p) => p.matchId === id && p.status === 'confirmado');
      const hasDraws = (db.draws || []).some((d) => d.matchId === id);
      const hasResults = (db.results || []).some((r) => r.matchId === id);

      if (hasPresences || hasDraws || hasResults) {
        const reasons = [];
        if (hasPresences) reasons.push('presenças confirmadas/recusadas/talvez');
        if (hasDraws) reasons.push('times sorteados/parciais');
        if (hasResults) reasons.push('placar/resultados registrados');
        return res.status(400).json({ 
          error: `Esta partida possui movimentação histórica (${reasons.join(', ')}) e não pode ser excluída. Apenas a opção de 'Cancelar Partida' é permitida para preservar o histórico.` 
        });
      }

      db.matches = db.matches.filter((m) => m.id !== id);
      db.presences = db.presences.filter((p) => p.matchId !== id);
      db.reserveAlerts = db.reserveAlerts.filter((a) => a.matchId !== id);

      // Remove any related notifications
      if (db.notifications) {
        db.notifications = db.notifications.filter(
          (n: any) => 
            n.matchId !== id && 
            !(n.id && n.id.includes(id)) &&
            !(n.actionUrl && n.actionUrl.includes('calendar') && n.message && n.message.includes(id))
        );
      }

      writeDb(db);
      return res.json({ message: 'Partida excluída com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover partida.' });
    }
  });

  // ==========================================
  // --- RECURRENCE API ENDPOINTS & GENERATOR -
  // ==========================================

  app.get('/api/recurrent-config', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao ler config de recorrência.' });
    }
  });

  app.post('/api/recurrent-config', (req, res) => {
    try {
      const { dayOfWeek, time, location, durationMinutes, confirmationDeadlineDaysBefore, active, maxMensalistas } = req.body;

      const db = readDb();
      db.recurrentConfig = {
        dayOfWeek: parseInt(dayOfWeek),
        time,
        location: location || 'Arena Green Society (Quadra Principal)',
        durationMinutes: parseInt(durationMinutes),
        confirmationDeadlineDaysBefore: parseInt(confirmationDeadlineDaysBefore),
        active: active !== undefined ? !!active : true,
        maxMensalistas: maxMensalistas !== undefined ? parseInt(maxMensalistas) : (db.recurrentConfig?.maxMensalistas || 12)
      };

      writeDb(db);
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar config de recorrência.' });
    }
  });

  app.post('/api/matches/generate-recurrent', (req, res) => {
    try {
      const db = readDb();
      const activeSeason = db.seasons.find((s) => s.active);

      if (!activeSeason) {
        return res.status(400).json({ error: 'Não há nenhuma temporada ativa para calcular recorrências.' });
      }

      const config = db.recurrentConfig;
      if (!config) {
        return res.status(400).json({ error: 'Configuração de recorrência inválida ou não configurada.' });
      }

      // Check current dates inside activeSeason dates
      const start = new Date(); // de hoje em diante
      const end = new Date(activeSeason.endDate);
      let createdCount = 0;

      // Iteramos dia por dia até o final da temporada
      let current = new Date(start);
      current.setHours(12, 0, 0, 0); // Evitar shifts de fuso horário

      while (current <= end) {
        if (current.getDay() === config.dayOfWeek) {
          const dateStr = current.toISOString().split('T')[0];
          const exists = db.matches.some((m) => m.date === dateStr);

          if (!exists) {
            db.matches.push({
              id: 'match-' + Date.now() + '-' + createdCount + '-' + Math.random().toString(36).substring(2, 9),
              seasonId: activeSeason.id,
              date: dateStr,
              time: config.time,
              location: config.location,
              durationMinutes: config.durationMinutes,
              status: 'agendada'
            });
            createdCount++;
          }
        }
        current.setDate(current.getDate() + 1);
      }

      // Quando o administrador gera / confirma a recorrência de forma expressa, garantimos que ela esteja ativa
      db.recurrentConfig.active = true;

      writeDb(db);
      return res.json({
        message: `Partidas recorrentes geradas com sucesso. Foram inseridos ${createdCount} rachas no calendário até ${activeSeason.endDate}.`,
        createdCount
      });
    } catch (err) {
      console.error('[Generate Recurrent]', err);
      return res.status(500).json({ error: 'Falha ao processar recorrência.' });
    }
  });

  // ==========================================
  // --- GRUPAL EVENTS (EVENTOS DO GRUPO) -----
  // ==========================================

  app.get('/api/events', (req, res) => {
    try {
      const { playerId } = req.query;
      const db = readDb();
      const events = db.events || [];
      const participants = db.eventParticipants || [];
      const bills = db.eventBills || [];

      const result = events.map(evt => {
        const eventParts = participants.filter(p => p.eventId === evt.id);
        const totalAdults = eventParts.reduce((sum, p) => sum + p.adultsCount, 0);
        const totalChildren = eventParts.reduce((sum, p) => sum + p.childrenCount, 0);
        const totalParticipants = totalAdults + totalChildren;

        let myParticipant = null;
        let myBill = null;

        let targetPlayerId = playerId as string;
        if (playerId) {
          const mappedId = getPlayerIdForUser(db, playerId as string);
          if (mappedId) {
            targetPlayerId = mappedId;
          }
        }

        if (playerId) {
          myParticipant = eventParts.find(p => p.playerId === targetPlayerId) || null;
          myBill = bills.find(b => b.eventId === evt.id && b.playerId === targetPlayerId) || null;
        }

        const eventBillsOfEvt = bills.filter(b => b.eventId === evt.id);
        const hasPaidBills = eventBillsOfEvt.some(b => b.status === 'pago');

        return {
          ...evt,
          totalAdults,
          totalChildren,
          totalParticipants,
          myParticipant,
          myBill,
          hasPaidBills
        };
      });

      result.sort((a, b) => b.date.localeCompare(a.date));
      return res.json(result);
    } catch (err) {
      console.error('[Get Events]', err);
      return res.status(500).json({ error: 'Erro ao buscar eventos.' });
    }
  });

  app.post('/api/events', (req, res) => {
    try {
      const { name, description, type, date, time, location, adultPrice, childPrice } = req.body;
      if (!name || !type || !date) {
        return res.status(400).json({ error: 'Nome, tipo e data são campos obrigatórios.' });
      }

      const db = readDb();
      const newEvent = {
        id: 'event-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name,
        description: description || '',
        type,
        date,
        time: time || '12:00',
        location: location || '',
        adultPrice: parseFloat(adultPrice || '0'),
        childPrice: parseFloat(childPrice || '0'),
        status: 'agendado' as const,
        createdAt: new Date().toISOString()
      };

      if (!db.events) db.events = [];
      db.events.push(newEvent);

      notify(db, {
        category: 'evento',
        title: '🎉 Novo Evento Criado',
        message: `O evento "${newEvent.name}" foi agendado para o dia ${newEvent.date.split('-').reverse().join('/')} às ${newEvent.time} na localidade ${newEvent.location}.`,
        actionUrl: 'mural',
        eventId: newEvent.id
      });

      writeDb(db);

      return res.status(201).json(newEvent);
    } catch (err) {
      console.error('[Create Event]', err);
      return res.status(500).json({ error: 'Erro ao criar evento.' });
    }
  });

  const recalculateEventBills = (db: any, eventId: string) => {
    const event = db.events.find((e: any) => e.id === eventId);
    if (!event) return;

    const participants = (db.eventParticipants || []).filter((p: any) => p.eventId === eventId);
    const bills = db.eventBills || [];

    participants.forEach((pt: any) => {
      const player = db.players.find((p: any) => p.id === pt.playerId);
      if (!player) return;

      const isChurrasco = event.type === 'churrasco';
      const isMensalista = player.category === 'mensalista' || player.category === 'mensalista_goleiro';

      let billAmount = 0;
      if (isChurrasco && isMensalista) {
        const paidAdults = Math.max(0, pt.adultsCount - 1);
        billAmount = (paidAdults * event.adultPrice) + (pt.childrenCount * event.childPrice);
      } else {
        billAmount = (pt.adultsCount * event.adultPrice) + (pt.childrenCount * event.childPrice);
      }

      const billIndex = bills.findIndex((b: any) => b.eventId === eventId && b.playerId === pt.playerId);
      if (billIndex !== -1) {
        bills[billIndex].amount = billAmount;
      } else if (pt.adultsCount > 0 || pt.childrenCount > 0) {
        bills.push({
          id: 'evbill-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          eventId,
          playerId: pt.playerId,
          amount: billAmount,
          status: 'pendente'
        });
      }
    });
  };

  app.put('/api/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, type, date, time, location, adultPrice, childPrice, status } = req.body;

      const db = readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const previousStatus = db.events[eventIndex].status;

      db.events[eventIndex] = {
        ...db.events[eventIndex],
        name: name || db.events[eventIndex].name,
        description: description !== undefined ? description : db.events[eventIndex].description,
        type: type || db.events[eventIndex].type,
        date: date || db.events[eventIndex].date,
        time: time || db.events[eventIndex].time,
        location: location !== undefined ? location : db.events[eventIndex].location,
        adultPrice: adultPrice !== undefined ? parseFloat(adultPrice) : db.events[eventIndex].adultPrice,
        childPrice: childPrice !== undefined ? parseFloat(childPrice) : db.events[eventIndex].childPrice,
        status: status || db.events[eventIndex].status
      };

      if (status === 'cancelado' && previousStatus !== 'cancelado') {
        db.eventBills = (db.eventBills || []).filter((b: any) => b.eventId !== id);
        notify(db, {
          category: 'evento',
          title: '❌ Evento Cancelado',
          message: `O evento "${db.events[eventIndex].name}" marcado para o dia ${db.events[eventIndex].date.split('-').reverse().join('/')} foi cancelado.`,
          actionUrl: 'mural',
          eventId: id
        });
      } else {
        recalculateEventBills(db, id);
        notify(db, {
          category: 'evento',
          title: '✏️ Detalhes do Evento Alterados',
          message: `O evento "${db.events[eventIndex].name}" foi editado. Confira o cronograma ou local na aba de eventos.`,
          actionUrl: 'mural',
          eventId: id
        });
      }

      writeDb(db);
      return res.json(db.events[eventIndex]);
    } catch (err) {
      console.error('[Update Event]', err);
      return res.status(500).json({ error: 'Erro ao salvar alterações do evento.' });
    }
  });

  app.post('/api/events/:id/cancel', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      db.events[eventIndex].status = 'cancelado';
      // Mantenha cobranças que já foram pagas (histórico/movimentação), remova apenas as pendentes
      db.eventBills = (db.eventBills || []).filter((b: any) => b.eventId !== id || b.status === 'pago');

      notify(db, {
        category: 'evento',
        title: '❌ Evento Cancelado',
        message: `O evento "${db.events[eventIndex].name}" do dia ${db.events[eventIndex].date.split('-').reverse().join('/')} foi cancelado.`,
        actionUrl: 'mural',
        eventId: id
      });

      writeDb(db);
      return res.json({ message: 'Evento cancelado e cobranças pendentes suspensas.', event: db.events[eventIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao cancelar o evento.' });
    }
  });

  app.delete('/api/events/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const event = db.events[eventIndex];
      if (event.status !== 'cancelado') {
        return res.status(400).json({ error: 'Apenas eventos cancelados podem ser excluídos.' });
      }

      // Verifica se houve movimentação financeira (algum débito pago deste evento)
      const hasPaidBills = (db.eventBills || []).some((b: any) => b.eventId === id && b.status === 'pago');
      if (hasPaidBills) {
        return res.status(400).json({ error: 'Este evento possui movimentação financeira (débitos pagos) e não pode ser excluído.' });
      }

      // Remover evento do array principal
      db.events = db.events.filter((e: any) => e.id !== id);
      // Remover os registros de participantes
      db.eventParticipants = (db.eventParticipants || []).filter((p: any) => p.eventId !== id);
      // Remover as cobranças não pagas que sobraram
      db.eventBills = (db.eventBills || []).filter((b: any) => b.eventId !== id);

      // Remover notificações associadas ao evento
      if (db.notifications) {
        db.notifications = db.notifications.filter(
          (n: any) => 
            n.eventId !== id && 
            !(n.id && n.id.includes(id)) &&
            !(n.actionUrl && n.actionUrl.includes('mural') && n.message && n.message.includes(id))
        );
      }

      writeDb(db);
      return res.json({ message: 'Evento excluído com sucesso.' });
    } catch (err) {
      console.error('[Delete Event]', err);
      return res.status(500).json({ error: 'Erro ao excluir o evento.' });
    }
  });

  app.post('/api/events/:id/end', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      db.events[eventIndex].status = 'encerrado';
      writeDb(db);
      return res.json({ message: 'Evento encerrado com sucesso.', event: db.events[eventIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao encerrar o evento.' });
    }
  });

  app.get('/api/events/:id/participants', (req, res) => {
    try {
      const { id } = req.params;
      const { userRole } = req.query;
      const db = readDb();

      const event = (db.events || []).find((e) => e.id === id);
      if (!event) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const participants = (db.eventParticipants || []).filter((p) => p.eventId === id);
      const bills = db.eventBills || [];

      const result = participants.map(part => {
        const player = db.players.find(p => p.id === part.playerId);
        const bill = bills.find(b => b.eventId === id && b.playerId === part.playerId);

        const baseInfo = {
          id: part.id,
          playerId: part.playerId,
          playerName: player ? player.name : 'Jogador Desconhecido',
          category: player ? player.category : 'reserva',
          photoOriginal: player ? player.photoOriginal : '',
          adultsCount: part.adultsCount,
          childrenCount: part.childrenCount,
          confirmedAt: part.confirmedAt,
        };

        if (userRole === 'admin' || userRole === 'auxiliar') {
          return {
            ...baseInfo,
            amount: bill ? bill.amount : 0,
            status: bill ? bill.status : 'pendente'
          };
        } else {
          return {
            ...baseInfo,
            amount: 0,
            status: 'oculto'
          };
        }
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar participantes do evento.' });
    }
  });

  app.post('/api/events/:id/confirm', (req, res) => {
    try {
      const { id } = req.params;
      let { playerId, adultsCount, childrenCount } = req.body;

      if (!playerId || adultsCount === undefined || childrenCount === undefined) {
        return res.status(400).json({ error: 'playerId, adultsCount e childrenCount são obrigatórios.' });
      }

      const db = readDb();
      const event = (db.events || []).find((e) => e.id === id);
      if (!event) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      if (event.status === 'encerrado' || event.status === 'cancelado') {
        return res.status(400).json({ error: 'Este evento já está encerrado ou cancelado.' });
      }

      let player = db.players.find(p => p.id === playerId);
      if (!player) {
        const mappedId = getPlayerIdForUser(db, playerId);
        if (mappedId) {
          playerId = mappedId;
          player = db.players.find((p) => p.id === playerId);
        }
      }

      if (!player) {
        const user = db.users.find((u: any) => u.id === playerId);
        if (user) {
          const newPlId = 'player-' + Date.now();
          const newPlayer: any = {
            id: newPlId,
            name: user.name,
            email: user.email,
            phone: '(85) 99999-9999',
            photoOriginal: '',
            playerCardUrl: '',
            favoriteTeamId: 'out',
            category: 'reserva',
            status: 'disponivel',
            primaryPosition: 'meio_campo',
            secondaryPositions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentStreak: 0,
            maxStreak: 0
          };
          db.players.push(newPlayer);
          user.playerId = newPlId;
          writeDb(db);

          playerId = newPlId;
          player = newPlayer;
        } else {
          return res.status(404).json({ error: 'Atleta não encontrado.' });
        }
      }

      if (!db.eventParticipants) db.eventParticipants = [];
      let partIndex = db.eventParticipants.findIndex(p => p.eventId === id && p.playerId === playerId);

      const adults = parseInt(adultsCount || '0');
      const children = parseInt(childrenCount || '0');

      if (adults === 0 && children === 0) {
        if (partIndex !== -1) {
          db.eventParticipants.splice(partIndex, 1);
        }
        db.eventBills = (db.eventBills || []).filter(b => !(b.eventId === id && b.playerId === playerId));
        writeDb(db);
        return res.json({ message: 'Confirmação removida.', participant: null, bill: null });
      }

      const participantRecord = {
        id: partIndex !== -1 ? db.eventParticipants[partIndex].id : 'part-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        eventId: id,
        playerId,
        adultsCount: adults,
        childrenCount: children,
        confirmedAt: partIndex !== -1 ? db.eventParticipants[partIndex].confirmedAt : new Date().toISOString()
      };

      if (partIndex !== -1) {
        db.eventParticipants[partIndex] = participantRecord;
      } else {
        db.eventParticipants.push(participantRecord);
      }

      const isChurrasco = event.type === 'churrasco';
      const isMensalista = player.category === 'mensalista' || player.category === 'mensalista_goleiro';

      let billAmount = 0;
      if (isChurrasco && isMensalista) {
        const paidAdults = Math.max(0, adults - 1);
        billAmount = (paidAdults * event.adultPrice) + (children * event.childPrice);
      } else {
        billAmount = (adults * event.adultPrice) + (children * event.childPrice);
      }

      if (!db.eventBills) db.eventBills = [];
      let billIndex = db.eventBills.findIndex(b => b.eventId === id && b.playerId === playerId);

      let billRecord;
      if (billIndex !== -1) {
        const existingBill = db.eventBills[billIndex];
        const status = (existingBill.amount !== billAmount) ? 'pendente' : existingBill.status;
        billRecord = {
          ...existingBill,
          amount: billAmount,
          status: billAmount === 0 ? 'pago' : status
        };
        db.eventBills[billIndex] = billRecord;
      } else {
        billRecord = {
          id: 'evbill-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          eventId: id,
          playerId,
          amount: billAmount,
          status: billAmount === 0 ? 'pago' : 'pendente'
        };
        db.eventBills.push(billRecord);
      }

      writeDb(db);
      return res.json({
        message: 'Presença confirmada com sucesso!',
        participant: participantRecord,
        bill: billRecord
      });
    } catch (err) {
      console.error('[Confirm Event RSVP]', err);
      return res.status(500).json({ error: 'Erro ao confirmar presença no evento.' });
    }
  });

  app.post('/api/events/:id/pay', (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({ error: 'playerId é obrigatório.' });
      }

      const db = readDb();
      if (!db.eventBills) db.eventBills = [];

      const billIndex = db.eventBills.findIndex(b => b.eventId === id && b.playerId === playerId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Nenhuma cobrança registrada para este evento.' });
      }

      db.eventBills[billIndex].status = 'pago';
      db.eventBills[billIndex].paidAt = new Date().toISOString();

      writeDb(db);
      return res.json({ message: 'Pagamento registrado com sucesso!', bill: db.eventBills[billIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao registrar pagamento.' });
    }
  });

  // ==========================================
  // --- PRESENCES (CONFIRMAÇÕES DE RACHA) ---
  // ==========================================

  app.get('/api/matches/:matchId/presences', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();

      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const mergedList = getComputedPresences(db, matchId);

      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
      const { deadlineDateTime, isDeadlineExpired, deadlineDateStr, hoursRemaining } = getMatchDeadlineInfo(match, matchDeadlineDays);
      const enrichedMatch = {
        ...match,
        isDeadlineExpired,
        deadlineDateStr,
        hoursRemaining,
        deadlineDateISO: deadlineDateTime.toISOString()
      };

      return res.json({
        match: enrichedMatch,
        presences: mergedList
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar presenças.' });
    }
  });

  app.post('/api/matches/:matchId/presences/toggle', (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerId, status, manuallyApproved } = req.body; // status: 'confirmado' | 'nao_confirmado' | 'cancelado'

      if (!playerId || !status) {
        return res.status(400).json({ error: 'playerId e status são obrigatórios.' });
      }

      const db = readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não existe.' });
      }

      let resolvedPlayerId = playerId;
      let player = db.players.find((p) => p.id === playerId);
      if (!player) {
        const mappedId = getPlayerIdForUser(db, playerId);
        if (mappedId) {
          resolvedPlayerId = mappedId;
          player = db.players.find((p) => p.id === resolvedPlayerId);
        }
      }

      if (!player) {
        // Let's check if playerId is actually a userId in db.users
        const user = db.users.find((u: any) => u.id === playerId);
        if (user) {
          // Auto-create a player for this user
          const newPlId = 'player-' + Date.now();
          const newPlayer: any = {
            id: newPlId,
            name: user.name,
            email: user.email,
            phone: '(85) 99999-9999',
            photoOriginal: '',
            playerCardUrl: '',
            favoriteTeamId: 'out',
            category: 'reserva',
            status: 'disponivel',
            primaryPosition: 'meio_campo',
            secondaryPositions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            currentStreak: 0,
            maxStreak: 0
          };
          db.players.push(newPlayer);
          user.playerId = newPlId;
          writeDb(db);

          resolvedPlayerId = newPlId;
          player = newPlayer;
        } else {
          return res.status(404).json({ error: 'Jogador não encontrado.' });
        }
      }

      // Ensure we use the resolved Player ID from now on
      const effectivePlayerId = resolvedPlayerId;

      // Check deadline for mensalistas (non-reserves)
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
      const { isDeadlineExpired } = getMatchDeadlineInfo(match, matchDeadlineDays);

      if (status === 'confirmado' && player.category !== 'reserva' && isDeadlineExpired) {
        return res.status(400).json({ error: 'Prazo limite para confirmação expirado. Mensalistas não podem mais confirmar.' });
      }

      let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === effectivePlayerId);
      let previousStatus: PresenceStatus = 'nao_confirmado';

      if (presenceIndex !== -1) {
        previousStatus = db.presences[presenceIndex].status;
        db.presences[presenceIndex].status = status;
        db.presences[presenceIndex].confirmedAt = status === 'confirmado' ? new Date().toISOString() : undefined;
        if (manuallyApproved !== undefined) {
          db.presences[presenceIndex].manuallyApproved = manuallyApproved;
        } else if (status === 'cancelado') {
          db.presences[presenceIndex].manuallyApproved = false;
        }
      } else {
        db.presences.push({
          id: 'pres-' + Date.now(),
          matchId,
          playerId: effectivePlayerId,
          status,
          confirmedAt: status === 'confirmado' ? new Date().toISOString() : undefined,
          manuallyApproved: manuallyApproved || false
        });
      }

      // LOGIC: Se o jogador que cancelou a presença já estava CONFIRMADO
      let alertCreated = null;
      if (previousStatus === 'confirmado' && status === 'cancelado') {
        // Encontrar primeiro reserva elegível (não confirmado ainda para este racha) por ordem do reservesOrder
        const activeReserves = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt && p.status === 'disponivel');
        const activeReserveIds = activeReserves.map((p) => p.id);

        const unconfirmedReserves = activeReserves.filter((p) => {
          const pres = db.presences.find((pr) => pr.matchId === matchId && pr.playerId === p.id);
          return !pres || pres.status !== 'confirmado';
        });

        // Encontrar o topo da lista de prioridade (reservesOrder)
        let suggestedReservePlayerId: string | undefined = undefined;
        const currentReservesOrder = db.reservesOrder || [];

        for (const orderId of currentReservesOrder) {
          const isEligible = unconfirmedReserves.some((r) => r.id === orderId);
          if (isEligible) {
            suggestedReservePlayerId = orderId;
            break;
          }
        }

        // Se a ordem de prioridades estiver vazia, pegamos o primeiro reserva elegível
        if (!suggestedReservePlayerId && unconfirmedReserves.length > 0) {
          suggestedReservePlayerId = unconfirmedReserves[0].id;
        }

        const alertObj = {
          id: 'alert-' + Date.now(),
          matchId,
          cancelledPlayerId: effectivePlayerId,
          suggestedReservePlayerId,
          createdAt: new Date().toISOString(),
          cleared: false
        };

        db.reserveAlerts.push(alertObj);
        alertCreated = alertObj;

        if (suggestedReservePlayerId) {
          const reservePlayer = db.players.find(p => p.id === suggestedReservePlayerId);
          if (reservePlayer) {
            // Personal alert
            notify(db, {
              category: 'partida',
              title: '🏃 vaga de Reserva Convocada!',
              message: `Você foi convocado da lista de espera para o racha do dia ${match.date.split('-').reverse().join('/')} devido ao cancelamento de ${player.name}.`,
              targetUserId: suggestedReservePlayerId,
              actionUrl: 'calendar',
              matchId
            });
            // Public alert
            notify(db, {
              category: 'partida',
              title: '👥 Vaga Aberta e Convocação',
              message: `O cancelamento da presença de ${player.name} liberou uma vaga. O reserva ${reservePlayer.name} foi acionado.`,
              targetUserId: 'all',
              actionUrl: 'calendar',
              matchId
            });
          }
        }
      }

      writeDb(db);
      return res.json({
        message: 'Presença updated with success!',
        alertCreated
      });
    } catch (err) {
      console.error('[Toggle Presence Error]', err);
      return res.status(500).json({ error: 'Erro ao atualizar confirmação de presença.' });
    }
  });

  app.post('/api/matches/:matchId/presences/bulk-toggle', (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerIds, status } = req.body; // status: 'confirmado' | 'nao_confirmado' | 'cancelado'

      if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0 || !status) {
        return res.status(400).json({ error: 'playerIds (array) e status são obrigatórios.' });
      }

      const db = readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não existe.' });
      }

      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
      const { isDeadlineExpired } = getMatchDeadlineInfo(match, matchDeadlineDays);

      let count = 0;
      let alertsCreatedCount = 0;

      for (const idToToggle of playerIds) {
        let resolvedPlayerId = idToToggle;
        let player = db.players.find((p) => p.id === idToToggle);
        if (!player) {
          const mappedId = getPlayerIdForUser(db, idToToggle);
          if (mappedId) {
            resolvedPlayerId = mappedId;
            player = db.players.find((p) => p.id === resolvedPlayerId);
          }
        }

        if (!player) {
          continue;
        }

        if (status === 'confirmado' && player.category !== 'reserva' && isDeadlineExpired) {
          continue; // Skip mensalistas after deadline
        }

        const effectivePlayerId = resolvedPlayerId;
        let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === effectivePlayerId);
        let previousStatus: PresenceStatus = 'nao_confirmado';

        if (presenceIndex !== -1) {
          previousStatus = db.presences[presenceIndex].status;
          db.presences[presenceIndex].status = status;
          db.presences[presenceIndex].confirmedAt = status === 'confirmado' ? new Date().toISOString() : undefined;
          if (status === 'confirmado') {
            db.presences[presenceIndex].manuallyApproved = true;
          } else if (status === 'cancelado') {
            db.presences[presenceIndex].manuallyApproved = false;
          }
        } else {
          db.presences.push({
            id: 'pres-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            matchId,
            playerId: effectivePlayerId,
            status,
            confirmedAt: status === 'confirmado' ? new Date().toISOString() : undefined,
            manuallyApproved: status === 'confirmado'
          });
        }

        count++;

        if (previousStatus === 'confirmado' && status === 'cancelado') {
          const activeReserves = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt && p.status === 'disponivel');
          const unconfirmedReserves = activeReserves.filter((p) => {
            const pres = db.presences.find((pr) => pr.matchId === matchId && pr.playerId === p.id);
            return !pres || pres.status !== 'confirmado';
          });

          let suggestedReservePlayerId: string | undefined = undefined;
          const currentReservesOrder = db.reservesOrder || [];

          for (const orderId of currentReservesOrder) {
            const isEligible = unconfirmedReserves.some((r) => r.id === orderId);
            if (isEligible) {
              suggestedReservePlayerId = orderId;
              break;
            }
          }

          if (!suggestedReservePlayerId && unconfirmedReserves.length > 0) {
            suggestedReservePlayerId = unconfirmedReserves[0].id;
          }

          const alertObj = {
            id: 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            matchId,
            cancelledPlayerId: effectivePlayerId,
            suggestedReservePlayerId,
            createdAt: new Date().toISOString(),
            cleared: false
          };

          db.reserveAlerts.push(alertObj);
          alertsCreatedCount++;

          if (suggestedReservePlayerId) {
            const reservePlayer = db.players.find(p => p.id === suggestedReservePlayerId);
            if (reservePlayer) {
              notify(db, {
                category: 'partida',
                title: '🏃 vaga de Reserva Convocada!',
                message: `Você foi convocado da lista de espera para o racha do dia ${match.date.split('-').reverse().join('/')} devido ao cancelamento de ${player.name}.`,
                targetUserId: suggestedReservePlayerId,
                actionUrl: 'calendar',
                matchId
              });
              notify(db, {
                category: 'partida',
                title: '👥 Vaga Aberta e Convocação',
                message: `O cancelamento da presença de ${player.name} liberou uma vaga. O reserva ${reservePlayer.name} foi acionado.`,
                targetUserId: 'all',
                actionUrl: 'calendar',
                matchId
              });
            }
          }
        }
      }

      writeDb(db);
      return res.json({
        message: `${count} presenças atualizadas com sucesso.`,
        alertsCreatedCount
      });
    } catch (err) {
      console.error('[Bulk Toggle Presence Error]', err);
      return res.status(500).json({ error: 'Erro ao atualizar presenças em massa.' });
    }
  });

  // ==========================================
  // --- DRAW BALANCING ENGINE ENDPOINTS -----
  // ==========================================

  // List all historic draws
  app.get('/api/draws/history', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.draws || []);
    } catch (err) {
      console.error('[Error getting draws history]:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico de sorteios.' });
    }
  });

  // Get active draw for a specific match
  app.get('/api/matches/:matchId/draw', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();
      const draw = (db.draws || []).find((d) => d.matchId === matchId);
      if (!draw) {
        return res.status(404).json({ error: 'Nenhum sorteio registrado para esta partida.' });
      }
      return res.json(draw);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter sorteio.' });
    }
  });

  // Trigger a new smart draw for a specific match
  app.post('/api/matches/:matchId/draw', (req, res) => {
    try {
      const { matchId } = req.params;
      const { captainsConfigured, captains, isSharedGoalkeepers } = req.body;

      const db = readDb();
      const match = db.matches.find(m => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      // Filter confirmed players
      const confirmedPresences = db.presences.filter(p => p.matchId === matchId && p.status === 'confirmado');
      const confirmedPlayerIds = confirmedPresences.map(p => p.playerId);
      const confirmedPlayers = db.players.filter(p => confirmedPlayerIds.includes(p.id) && !p.deletedAt);

      if (confirmedPlayers.length === 0) {
        return res.status(400).json({ error: 'Não há jogadores confirmados nesta partida para realizar o sorteio.' });
      }

      // Precalculate overall rating for each player using the existing helper
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      // Run smart draw balancing
      const drawResult = runSmartDraw({
        confirmedPlayers,
        playerOveralls,
        duoAffinities: db.duoAffinities || [],
        trioAffinities: db.trioAffinities || [],
        captains: captainsConfigured ? captains : {},
        isSharedGoalkeepers: !!isSharedGoalkeepers
      });

      // Assemble final Draw object
      const newDraw = {
        id: 'draw-' + Date.now(),
        matchId,
        date: new Date().toISOString(),
        teams: drawResult.teams,
        overallBlue: drawResult.overallBlue,
        overallRed: drawResult.overallRed,
        overallGreen: drawResult.overallGreen,
        maxDifference: drawResult.maxDifference,
        isSharedGoalkeepers: !!isSharedGoalkeepers,
        captainsConfigured: !!captainsConfigured
      };

      // Remove previous draw for the same match if any
      db.draws = (db.draws || []).filter(d => d.matchId !== matchId);
      db.draws.push(newDraw);

      notify(db, {
        category: 'sorteio',
        title: '🎲 Times Sorteados!',
        message: `O sorteio dos times da rodada do dia ${match.date.split('-').reverse().join('/')} foi realizado. Venha ver se ficou equilibrado!`,
        actionUrl: 'calendar',
        matchId
      });

      if (captainsConfigured) {
        notify(db, {
          category: 'sorteio',
          title: '👑 Capitães Definidos',
          message: `Os capitães da rodada do dia ${match.date.split('-').reverse().join('/')} foram eixos e escalados nos times.`,
          actionUrl: 'calendar',
          matchId
        });
      }

      writeDb(db);
      return res.json(newDraw);
    } catch (err) {
      console.error('[Draw Generation Error]', err);
      return res.status(500).json({ error: 'Erro ao processar sorteio automático.' });
    }
  });

  // Manually update teams and recalculate overalls/metrics
  app.post('/api/draws/:drawId/update-manual', (req, res) => {
    try {
      const { drawId } = req.params;
      const { teams } = req.body; // updated groups configurations: DrawTeam[]

      if (!teams || !Array.isArray(teams)) {
        return res.status(400).json({ error: 'Lista de times formatada é obrigatória.' });
      }

      const db = readDb();
      const drawIndex = (db.draws || []).findIndex(d => d.id === drawId);
      if (drawIndex === -1) {
        return res.status(404).json({ error: 'Sorteio referenciado não foi encontrado.' });
      }

      const drawObj = db.draws[drawIndex];

      // Recompute overalls for the modified groups
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      // Find goalkeepers
      const goalkeepers = db.players.filter(p => p.primaryPosition === 'goleiro' && !p.deletedAt);

      const computedAllOveralls = teams.map(t => {
        let count = t.playerIds.length;
        if (count === 0) return 3.5;
        let sum = t.playerIds.reduce((s, pid) => s + (playerOveralls[pid] || 3.5), 0);
        
        if (drawObj.isSharedGoalkeepers && goalkeepers.length > 0) {
          // If shared, average gk rating is added to rating computation too
          const confGkIds = db.presences
            .filter(p => p.matchId === drawObj.matchId && p.status === 'confirmado')
            .map(p => p.playerId);
          const activeGks = goalkeepers.filter(g => confGkIds.includes(g.id));
          if (activeGks.length > 0) {
            const avgGkRating = activeGks.reduce((s, g) => s + (playerOveralls[g.id] || 3.5), 0) / activeGks.length;
            sum += avgGkRating;
            count += 1;
          }
        }
        
        return Math.round((sum / count) * 10) / 10;
      });

      const bOverall = computedAllOveralls[0] || 3.5;
      const rOverall = computedAllOveralls[1] || 3.5;
      const gOverall = computedAllOveralls[2] || 3.5;

      const maxRating = Math.max(bOverall, rOverall, gOverall);
      const minRating = Math.min(bOverall, rOverall, gOverall);
      const diff = Math.round((maxRating - minRating) * 10) / 10;

      // Update values
      drawObj.teams = teams;
      drawObj.overallBlue = bOverall;
      drawObj.overallRed = rOverall;
      drawObj.overallGreen = gOverall;
      drawObj.maxDifference = diff;

      // Update in db
      db.draws[drawIndex] = drawObj;

      notify(db, {
        category: 'sorteio',
        title: '✏️ Sorteio Alterado Manualmente',
        message: `A divisão de times do racha foi modificada manualmente por um organizador para melhor equilíbrio.`,
        actionUrl: 'calendar',
        matchId: drawObj.matchId
      });

      writeDb(db);

      return res.json(drawObj);
    } catch (err) {
      console.error('[Manual Draw Update Error]', err);
      return res.status(500).json({ error: 'Erro ao recalcular ajuste de times.' });
    }
  });

  // Lock and Record historical partner affinity stats on final approval/lock
  app.post('/api/draws/:drawId/confirm-lock', (req, res) => {
    try {
      const { drawId } = req.params;
      const db = readDb();

      const drawObj = (db.draws || []).find(d => d.id === drawId);
      if (!drawObj) {
        return res.status(404).json({ error: 'Sorteio não encontrado.' });
      }

      // Initialize collections if they don't exist
      db.duoAffinities = db.duoAffinities || [];
      db.trioAffinities = db.trioAffinities || [];

      // Check for duplicate recording protection
      if (drawObj.affinitiesRecorded === true) {
        return res.json({ 
          message: 'Relações de afinidades já haviam sido consolidadas anteriormente para esta partida.', 
          alreadyRecorded: true 
        });
      }

      // Record affinity increments for each team's players
      drawObj.teams.forEach(t => {
        const teamPlayers = t.playerIds;
        recordAffinities(teamPlayers, db.duoAffinities, db.trioAffinities);
      });

      // Set idempotency protection flag
      drawObj.affinitiesRecorded = true;

      // Logger details for auditing
      const totalDuosCount = drawObj.teams.reduce((acc, t) => {
        const n = t.playerIds.length;
        return acc + (n >= 2 ? (n * (n - 1)) / 2 : 0);
      }, 0);
      const totalTriosCount = drawObj.teams.reduce((acc, t) => {
        const n = t.playerIds.length;
        return acc + (n >= 3 ? (n * (n - 1) * (n - 2)) / 6 : 0);
      }, 0);

      // Audit Log Registration
      db.userAudits = db.userAudits || [];
      const matchObj = db.matches.find(m => m.id === drawObj.matchId);
      const matchName = matchObj ? `Racha de ${matchObj.date} em ${matchObj.location}` : `Partida ID ${drawObj.matchId}`;

      db.userAudits.push({
        id: 'audit-affinity-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        action: 'Registro de Afinidades de Time',
        userName: 'Coordenador',
        userEmail: 'sistema@racha.fofim',
        userId: 'system',
        previousRole: 'system',
        newRole: 'system',
        performedBy: 'Bloqueio do Sorteio (Idempotente)',
        details: {
          matchId: drawObj.matchId,
          matchDate: matchObj ? matchObj.date : drawObj.date,
          matchName: matchName,
          duosCount: totalDuosCount,
          triosCount: totalTriosCount,
          loggedMessage: `Consolidação de Afinidades: ${totalDuosCount} duplas e ${totalTriosCount} trios registrados para a partida.`
        }
      });

      writeDb(db);
      return res.json({ 
        message: 'Sorteio consolidado com sucesso! Afinidade de duplas e trios atualizada para novas partidas.',
        alreadyRecorded: false,
        duosCount: totalDuosCount,
        triosCount: totalTriosCount
      });
    } catch (err) {
      console.error('[Error Locking Draw]', err);
      return res.status(500).json({ error: 'Falha ao consolidar relações de afinidades.' });
    }
  });

  // ==========================================
  // --- MATCH RESULTS & STATISTICS ENDPONES ---
  // ==========================================

  // List all historic match results
  app.get('/api/results', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.results || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultados.' });
    }
  });

  // Get a single result by matchId
  app.get('/api/results/:matchId', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();
      const result = (db.results || []).find((r) => r.matchId === matchId);
      if (!result) {
        return res.status(404).json({ error: 'Nenhum resultado para esta partida.' });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultado.' });
    }
  });

  // Get computed tournament statistics and rankings
  app.get('/api/stats', (req, res) => {
    try {
      const { seasonId } = req.query;
      const db = readDb();
      
      const stats = computeStatsForSeason({
        players: db.players,
        matches: db.matches,
        presences: db.presences,
        results: db.results || [],
        seasonId: seasonId as string || null
      });

      // Compute group events attendance (completed/encerrado events only)
      const completedEvents = (db.events || []).filter(e => e.status === 'encerrado');
      const playerEventCount: Record<string, number> = {};
      
      db.players.forEach(p => {
        playerEventCount[p.id] = 0;
      });

      completedEvents.forEach(evt => {
        const parts = (db.eventParticipants || []).filter(p => p.eventId === evt.id);
        parts.forEach(pt => {
          if (pt.adultsCount > 0 || pt.childrenCount > 0) {
            playerEventCount[pt.playerId] = (playerEventCount[pt.playerId] || 0) + 1;
          }
        });
      });

      if (stats && stats.individual) {
        stats.individual = stats.individual.map(ind => ({
          ...ind,
          eventsCount: playerEventCount[ind.playerId] || 0
        }));
      }

      return res.json(stats);
    } catch (err) {
      console.error('[Error generating stats]:', err);
      return res.status(500).json({ error: 'Erro ao processar estatísticas de jogo.' });
    }
  });

  // Post/register results for a match
  app.post('/api/matches/:matchId/results', (req, res) => {
    try {
      const { matchId } = req.params;
      const { winsBlue, winsRed, winsGreen } = req.body;

      if (winsBlue === undefined || winsRed === undefined || winsGreen === undefined) {
        return res.status(400).json({ error: 'É necessário preencher as vitórias de todas as equipes.' });
      }

      const db = readDb();
      const match = db.matches.find(m => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      // Check for matching team draw configurations
      const draw = (db.draws || []).find(d => d.matchId === matchId);
      if (!draw) {
        return res.status(400).json({ error: 'É necessário realizar o sorteio de times antes de registrar o resultado da partida.' });
      }

      // Determine who won this match
      const maxWins = Math.max(winsBlue, winsRed, winsGreen);
      const champions: ('Azul' | 'Vermelho' | 'Verde')[] = [];
      if (winsBlue === maxWins) champions.push('Azul');
      if (winsRed === maxWins) champions.push('Vermelho');
      if (winsGreen === maxWins) champions.push('Verde');

      // Build the match result object
      const newResult: MatchResult = {
        id: 'result-' + Date.now(),
        matchId,
        seasonId: match.seasonId,
        date: match.date,
        winsBlue: parseInt(winsBlue),
        winsRed: parseInt(winsRed),
        winsGreen: parseInt(winsGreen),
        champions,
        teams: draw.teams,
        isSharedGoalkeepers: draw.isSharedGoalkeepers
      };

      // Transition match state to encerrada
      match.status = 'encerrada';

      // Safe initialization of collections
      db.results = db.results || [];
      db.results = db.results.filter(r => r.matchId !== matchId); // remove any old duplicate result
      db.results.push(newResult);

      db.duoAffinities = db.duoAffinities || [];
      db.trioAffinities = db.trioAffinities || [];

      const filterRecorded = draw.affinitiesRecorded === true;
      const winsAlreadyRecorded = draw.winsRecorded === true;

      // Record played and wins count directly for teams
      draw.teams.forEach(t => {
        const teamPlayers = t.playerIds;
        const isChamp = champions.includes(t.name);

        // Record general partnership count played together first (only if not already recorded)
        if (!filterRecorded) {
          recordAffinities(teamPlayers, db.duoAffinities, db.trioAffinities);
        }

        // Record won together (increment winsCount) only if not already recorded
        if (isChamp && !winsAlreadyRecorded) {
          // Duo partners wins count
          for (let i = 0; i < teamPlayers.length; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              const first = teamPlayers[i] < teamPlayers[j] ? teamPlayers[i] : teamPlayers[j];
              const second = teamPlayers[i] < teamPlayers[j] ? teamPlayers[j] : teamPlayers[i];
              const recIdx = db.duoAffinities.findIndex(a => a.playerAId === first && a.playerBId === second);
              if (recIdx >= 0) {
                db.duoAffinities[recIdx].winsCount = (db.duoAffinities[recIdx].winsCount || 0) + 1;
              }
            }
          }

          // Trio partners wins count
          for (let i = 0; i < teamPlayers.length; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              for (let k = j + 1; k < teamPlayers.length; k++) {
                const sorted = [teamPlayers[i], teamPlayers[j], teamPlayers[k]].sort();
                const recIdx = db.trioAffinities.findIndex(a => 
                  a.playerAId === sorted[0] && 
                  a.playerBId === sorted[1] && 
                  a.playerCId === sorted[2]
                );
                if (recIdx >= 0) {
                  db.trioAffinities[recIdx].winsCount = (db.trioAffinities[recIdx].winsCount || 0) + 1;
                }
              }
            }
          }
        }
      });

      const newlyRecordedAffinities = !filterRecorded;
      draw.affinitiesRecorded = true;
      draw.winsRecorded = true;

      // Log to audit if we newly registered affinities
      if (newlyRecordedAffinities) {
        const totalDuosCount = draw.teams.reduce((acc, t) => {
          const n = t.playerIds.length;
          return acc + (n >= 2 ? (n * (n - 1)) / 2 : 0);
        }, 0);
        const totalTriosCount = draw.teams.reduce((acc, t) => {
          const n = t.playerIds.length;
          return acc + (n >= 3 ? (n * (n - 1) * (n - 2)) / 6 : 0);
        }, 0);

        db.userAudits = db.userAudits || [];
        const matchName = match ? `Racha de ${match.date} em ${match.location}` : `Partida ID ${matchId}`;

        db.userAudits.push({
          id: 'audit-affinity-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          action: 'Registro de Afinidades de Time',
          userName: 'Coordenador',
          userEmail: 'sistema@racha.fofim',
          userId: 'system',
          previousRole: 'system',
          newRole: 'system',
          performedBy: 'Registro de Resultados (Idempotente)',
          details: {
            matchId: matchId,
            matchDate: match ? match.date : draw.date,
            matchName: matchName,
            duosCount: totalDuosCount,
            triosCount: totalTriosCount,
            loggedMessage: `Consolidação de Afinidades: ${totalDuosCount} duplas e ${totalTriosCount} trios registrados para a partida.`
          }
        });
      }

      // --- STREAK UPDATE FOR PLAYERS ---
      const blueTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Azul')?.playerIds || []);
      const redTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Vermelho')?.playerIds || []);
      const greenTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Verde')?.playerIds || []);

      const activePlayersForStreaks = db.players.filter(p => !p.deletedAt);
      const confPlayerIds = new Set(
        (db.presences || [])
          .filter(p => p.matchId === matchId && p.status === 'confirmado')
          .map(p => p.playerId)
      );

      activePlayersForStreaks.forEach((player) => {
        // Did they play? Or are they in the team lists?
        const isPresent = confPlayerIds.has(player.id) || 
                          blueTeamPlayerIds.has(player.id) || 
                          redTeamPlayerIds.has(player.id) || 
                          greenTeamPlayerIds.has(player.id);

        if (!isPresent) return; // If they did not play, their streak remains unchanged

        // Did they win?
        let won = false;
        const isGoalkeeper = player.primaryPosition === 'goleiro';

        if (draw.isSharedGoalkeepers && isGoalkeeper) {
          // Shared GKs win if any team wins (unless all got 0 wins)
          won = champions.length > 0;
        } else {
          // They win if their team name is in champions list
          const teamNameOfPlayer = blueTeamPlayerIds.has(player.id) ? 'Azul' : 
                                   redTeamPlayerIds.has(player.id) ? 'Vermelho' : 
                                   greenTeamPlayerIds.has(player.id) ? 'Verde' : null;
          if (teamNameOfPlayer && champions.includes(teamNameOfPlayer)) {
            won = true;
          }
        }

        // Initialize values safely
        if (player.currentStreak === undefined) player.currentStreak = 0;
        if (player.maxStreak === undefined) player.maxStreak = 0;

        if (won) {
          player.currentStreak++;
          if (player.currentStreak > player.maxStreak) {
            player.maxStreak = player.currentStreak;
          }
        } else {
          player.currentStreak = 0; // Reset streak
        }
      });

      // --- GENERATE AUTOMATIC MURAL POST FOR CLOSED MATCH ---
      try {
        const currentStats = computeStatsForSeason({
          players: db.players,
          matches: db.matches,
          presences: db.presences,
          results: db.results || [],
          seasonId: match.seasonId
        });

        // Format Best Duo
        let melhorDupla = 'Nenhuma registrada';
        if (currentStats.duos && currentStats.duos.length > 0) {
          const topDuo = currentStats.duos[0];
          melhorDupla = `${topDuo.playerAName} e ${topDuo.playerBName} (${topDuo.wonTogether} vitórias, ${topDuo.aproveitamento}% de aproveitamento)`;
        }

        // Format Best Trio
        let melhorTrio = 'Nenhum registrado';
        if (currentStats.trios && currentStats.trios.length > 0) {
          const topTrio = currentStats.trios[0];
          melhorTrio = `${topTrio.playerAName}, ${topTrio.playerBName} e ${topTrio.playerCName} (${topTrio.wonTogether} vitórias, ${topTrio.aproveitamento}% de aproveitamento)`;
        }

        // Format Leader/Wins
        let liderVitorias = 'Nenhum';
        if (currentStats.individual && currentStats.individual.length > 0) {
          const leader = currentStats.individual[0];
          liderVitorias = `${leader.name} (${leader.vitorias} vitórias)`;
        }

        // Format Best Current Streak
        let seqAtual = 'Nenhuma';
        if (currentStats.individual && currentStats.individual.length > 0) {
          let maxCurrent = -1;
          let pBest = null;
          currentStats.individual.forEach(ind => {
            if (ind.currentStreak > maxCurrent) {
              maxCurrent = ind.currentStreak;
              pBest = ind;
            }
          });
          if (pBest && maxCurrent > 0) {
            seqAtual = `${pBest.name} (${maxCurrent} partidas seguidas vencendo)`;
          }
        }

        // Format Best Historical Streak
        let seqHistorica = 'Nenhuma';
        if (currentStats.individual && currentStats.individual.length > 0) {
          let maxMax = -1;
          let pBest = null;
          currentStats.individual.forEach(ind => {
            if (ind.maxStreak > maxMax) {
              maxMax = ind.maxStreak;
              pBest = ind;
            }
          });
          if (pBest && maxMax > 0) {
            seqHistorica = `${pBest.name} (${maxMax} partidas)`;
          }
        }

        const formattedDate = match.date.split('-').reverse().join('/');
        const seasonObj = (db.seasons || []).find(s => s.id === match.seasonId);
        const seasonName = seasonObj ? seasonObj.name : 'Temporada Atual';

        const participantPlayerIds = new Set<string>();
        draw.teams.forEach(t => t.playerIds.forEach(pid => participantPlayerIds.add(pid)));
        const participantsCount = participantPlayerIds.size;

        const playerMap = new Map<string, string>();
        db.players.forEach(p => playerMap.set(p.id, p.name));

        const blueTeamPlayers = draw.teams.find(t => t.name === 'Azul')?.playerIds.map(pid => playerMap.get(pid) || pid).join(', ') || 'Nenhum';
        const redTeamPlayers = draw.teams.find(t => t.name === 'Vermelho')?.playerIds.map(pid => playerMap.get(pid) || pid).join(', ') || 'Nenhum';
        const greenTeamPlayers = draw.teams.find(t => t.name === 'Verde')?.playerIds.map(pid => playerMap.get(pid) || pid).join(', ') || 'Nenhum';

        const automaticPostText = `### 📅 Informações Gerais
- **Data:** ${formattedDate}
- **Horário:** ${match.time}
- **Temporada:** ${seasonName}
- **Participantes:** ${participantsCount} jogadores

### ⚽ Placar Geral
- **🔵 Time Azul:** ${winsBlue} vitórias
- **🔴 Time Vermelho:** ${winsRed} vitórias
- **🟢 Time Verde:** ${winsGreen} vitórias

### 🏆 Campeões da Rodada
- ${champions.length > 0 ? champions.map(c => `Time ${c}`).join(' & ') : 'Empate'}

### 👥 Escalação das Equipes
- **🔵 Time Azul:** ${blueTeamPlayers}
- **🔴 Time Vermelho:** ${redTeamPlayers}
- **🟢 Time Verde:** ${greenTeamPlayers}

### 📊 Estatísticas do Momento
- **Melhor Dupla Atual:** ${melhorDupla}
- **Melhor Trio Atual:** ${melhorTrio}
- **Líder de Vitórias:** ${liderVitorias}
- **Maior Sequência Atual:** ${seqAtual}
- **Maior Sequência Histórica:** ${seqHistorica}`;

        const generateMatchSvg = (dateStr: string, champs: string[], wB: number, wR: number, wG: number) => {
          const width = 800;
          const height = 450;
          const champText = champs.length > 0 ? `Campeão: ${champs.join(' & ')}` : 'Empate!';
          const svgText = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#040a08"/>
      <stop offset="50%" stop-color="#0b1712"/>
      <stop offset="100%" stop-color="#050c09"/>
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="redGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  
  <g opacity="0.12">
    <rect x="30" y="30" width="740" height="390" fill="none" stroke="#22c55e" stroke-width="2"/>
    <line x1="400" y1="30" x2="400" y2="420" stroke="#22c55e" stroke-width="2"/>
    <circle cx="400" cy="225" r="70" fill="none" stroke="#22c55e" stroke-width="2"/>
    <rect x="30" y="145" width="120" height="160" fill="none" stroke="#22c55e" stroke-width="2"/>
    <rect x="650" y="145" width="120" height="160" fill="none" stroke="#22c55e" stroke-width="2"/>
  </g>

  <text x="400" y="55" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="14" fill="#22c55e" letter-spacing="3" text-anchor="middle" opacity="0.8">
    RACHA DO FOFIM • REGISTRO AUTOMÁTICO
  </text>
  
  <text x="400" y="90" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" filter="url(#shadow)">
    DADOS DA RODADA
  </text>
  
  <text x="400" y="125" font-family="'JetBrains Mono', monospace" font-size="16" fill="#86efac" font-weight="bold" text-anchor="middle">
    ${dateStr}
  </text>

  <g transform="translate(110, 160)" filter="url(#shadow)">
    <rect width="160" height="140" rx="16" fill="#0c1311" stroke="#1d302a" stroke-width="2"/>
    <text x="80" y="40" font-family="'Inter', sans-serif" font-weight="900" font-size="16" fill="#38bdf8" text-anchor="middle">TIME AZUL</text>
    <text x="80" y="105" font-family="'Inter', sans-serif" font-weight="900" font-size="56" fill="url(#blueGrad)" text-anchor="middle">${wB}</text>
  </g>

  <g transform="translate(320, 160)" filter="url(#shadow)">
    <rect width="160" height="140" rx="16" fill="#0c1311" stroke="#1d302a" stroke-width="2"/>
    <text x="80" y="40" font-family="'Inter', sans-serif" font-weight="900" font-size="16" fill="#f87171" text-anchor="middle">TIME VERMELHO</text>
    <text x="80" y="105" font-family="'Inter', sans-serif" font-weight="900" font-size="56" fill="url(#redGrad)" text-anchor="middle">${wR}</text>
  </g>

  <g transform="translate(530, 160)" filter="url(#shadow)">
    <rect width="160" height="140" rx="16" fill="#0c1311" stroke="#1d302a" stroke-width="2"/>
    <text x="80" y="40" font-family="'Inter', sans-serif" font-weight="900" font-size="16" fill="#4ade80" text-anchor="middle">TIME VERDE</text>
    <text x="80" y="105" font-family="'Inter', sans-serif" font-weight="900" font-size="56" fill="url(#greenGrad)" text-anchor="middle">${wG}</text>
  </g>

  <g transform="translate(150, 340)" filter="url(#shadow)">
    <rect width="500" height="55" rx="27.5" fill="#142c22" stroke="#22c55e" stroke-width="2" opacity="0.95"/>
    <text x="250" y="34" font-family="'Inter', sans-serif" font-weight="bold" font-size="18" fill="#ffffff" text-anchor="middle">
      🏆 ${champText.toUpperCase()}
    </text>
  </g>
</svg>
`;
          return 'data:image/svg+xml;base64,' + Buffer.from(svgText.trim()).toString('base64');
        };

        const nowIso = new Date().toISOString();
        const autoPostMediaUrl = generateMatchSvg(formattedDate, champions, parseInt(winsBlue), parseInt(winsRed), parseInt(winsGreen));

        const automaticPost = {
          id: 'post-auto-' + Date.now(),
          title: `🏆 Resultado do Racha - ${formattedDate}`,
          description: automaticPostText,
          mediaUrl: autoPostMediaUrl,
          mediaType: 'image' as const,
          fileSize: autoPostMediaUrl.length,
          category: 'partida' as const,
          authorId: 'system',
          authorName: 'Racha do Fofim Bot',
          authorRole: 'admin',
          createdAt: nowIso,
          updatedAt: nowIso,
          matchId: matchId,
          isHighlighted: false,
          allowPublicView: true,
          eventDate: match.date,
          origin: ('automatic' as const)
        };

        db.muralPosts = db.muralPosts || [];
        // Clean previous auto post for this match if it exists
        db.muralPosts = db.muralPosts.filter(p => !(p.matchId === matchId && p.origin === 'automatic'));
        db.muralPosts.push(automaticPost);
      } catch (autoErr) {
        console.error('[Error generating automatic mural post]', autoErr);
      }

      writeDb(db);
      return res.json({ message: 'Resultado do racha gravado com sucesso!', result: newResult });
    } catch (err) {
      console.error('[Error posting match results]', err);
      return res.status(500).json({ error: 'Erro ao registrar resultado.' });
    }
  });

  // ==========================================
  // --- CONTROL OF RESERVES ALERTS & PRIO ---
  // ==========================================

  app.get('/api/reserves/order', (req, res) => {
    try {
      const db = readDb();
      const activeReserves = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt);

      // Sort by reservesOrder
      const order = db.reservesOrder || [];
      const sorted = [...activeReserves].sort((a, b) => {
        let idxA = order.indexOf(a.id);
        let idxB = order.indexOf(b.id);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      return res.json({
        reserves: sorted,
        order
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar prioridade de reservas.' });
    }
  });

  app.post('/api/reserves/order', (req, res) => {
    try {
      const { reorderedIds } = req.body;
      if (!reorderedIds || !Array.isArray(reorderedIds)) {
        return res.status(400).json({ error: 'Lista de IDs reordenada é obrigatória.' });
      }

      const db = readDb();
      db.reservesOrder = reorderedIds;
      writeDb(db);

      return res.json({ message: 'Ordem da lista de reservas salva com sucesso!', order: db.reservesOrder });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar prioridade de reservas.' });
    }
  });

  app.get('/api/reserve-alerts', (req, res) => {
    try {
      const db = readDb();
      const uncleared = db.reserveAlerts.filter((a) => !a.cleared);

      const enrichedAlerts = uncleared.map((a) => {
        const matchObj = db.matches.find((m) => m.id === a.matchId);
        const cancelledPlayer = db.players.find((p) => p.id === a.cancelledPlayerId);
        const suggestedReserve = a.suggestedReservePlayerId
          ? db.players.find((p) => p.id === a.suggestedReservePlayerId)
          : null;

        return {
          ...a,
          matchDate: matchObj ? matchObj.date : '',
          matchTime: matchObj ? matchObj.time : '',
          cancelledPlayerName: cancelledPlayer ? cancelledPlayer.name : 'Jogador Desconhecido',
          suggestedReservePlayerName: suggestedReserve ? suggestedReserve.name : 'Nenhum reserva disponível'
        };
      });

      return res.json(enrichedAlerts);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter alertas de reservas.' });
    }
  });

  app.post('/api/reserve-alerts/:id/clear', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();

      const alertIndex = db.reserveAlerts.findIndex((a) => a.id === id);
      if (alertIndex !== -1) {
        db.reserveAlerts[alertIndex].cleared = true;
      }

      writeDb(db);
      return res.json({ message: 'Alerta removido.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover alerta.' });
    }
  });

  app.post('/api/reserve-alerts/:id/summon', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();

      const alertIndex = db.reserveAlerts.findIndex((a) => a.id === id);
      if (alertIndex === -1) {
        return res.status(404).json({ error: 'Alerta não encontrado.' });
      }

      const alert = db.reserveAlerts[alertIndex];
      if (!alert.suggestedReservePlayerId) {
        return res.status(400).json({ error: 'Não há reserva indicado para efetivar a convocação.' });
      }

      // Encontrar ou atualizar presença do reserva indicado para "confirmado"!
      const matchId = alert.matchId;
      const reserveId = alert.suggestedReservePlayerId;

      let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === reserveId);
      if (presenceIndex !== -1) {
        db.presences[presenceIndex].status = 'confirmado';
        db.presences[presenceIndex].confirmedAt = new Date().toISOString();
      } else {
        db.presences.push({
          id: 'pres-' + Date.now(),
          matchId,
          playerId: reserveId,
          status: 'confirmado',
          confirmedAt: new Date().toISOString()
        });
      }

      // Marcar alerta como limpo
      db.reserveAlerts[alertIndex].cleared = true;

      writeDb(db);
      return res.json({ message: 'Reserva convocado com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao processar convocação.' });
    }
  });

  // ==========================================
  // --- FINANCES (FINANCEIRO API ENDPOINTS) --
  // ==========================================

  app.get('/api/finances', (req, res) => {
    try {
      const email = (req.query.email as string || '').toLowerCase().trim();
      const role = req.query.role as string || 'jogador';

      const db = readDb(); // readDb triggers automatic monthly billing generation!

      // Compute general financial health stats (Totals - anonymous)
      const totalExpected = db.bills.reduce((sum, b) => sum + b.amount, 0);
      const totalReceived = db.bills.filter(b => b.status === 'pago').reduce((sum, b) => sum + b.amount, 0);
      const totalPending = db.bills.filter(b => b.status === 'pendente').reduce((sum, b) => sum + b.amount, 0);

      const health = {
        totalExpected,
        totalReceived,
        totalPending
      };

      // Find players for lookup & filter inactive ones
      const allPlayers = db.players.filter(p => !p.deletedAt);

      const isAdminMode = role === 'admin' || role === 'auxiliar';

      if (isAdminMode) {
        // Admins see all bills, payments, competences, and players
        return res.json({
          bills: db.bills,
          payments: db.payments,
          competences: db.competences,
          recurrentConfig: db.recurrentConfig,
          financeConfig: db.financeConfig,
          health,
          players: allPlayers
        });
      } else {
        // Non-admins (normal players) can only read their own bills and payments!
        const player = db.players.find(p => p.email.toLowerCase().trim() === email);
        if (!player) {
          return res.json({
            bills: [],
            payments: [],
            competences: [],
            recurrentConfig: db.recurrentConfig,
            financeConfig: db.financeConfig,
            health,
            players: []
          });
        }

        // Filter bills and payments to only include this player
        const myBills = db.bills.filter(b => b.playerId === player.id);
        const myPayments = db.payments.filter(p => p.playerId === player.id);

        return res.json({
          bills: myBills,
          payments: myPayments,
          competences: [], // Hide competences structure due to privacy
          recurrentConfig: db.recurrentConfig,
          financeConfig: db.financeConfig,
          health,
          players: [player] // Only return themselves
        });
      }
    } catch (err) {
      console.error('[API GET Finances]', err);
      return res.status(500).json({ error: 'Erro ao buscar dados financeiros.' });
    }
  });

  app.get('/api/finances/config', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.financeConfig || {
        monthlyFee: 100,
        chargeDateRule: 'primeiro_jogo',
        history: [{ date: '2026-01-01', amount: 100 }]
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter configuração financeira.' });
    }
  });

  app.post('/api/finances/config', (req, res) => {
    try {
      const { monthlyFee, chargeDateRule, effectiveDate } = req.body;
      const db = readDb();

      if (!db.financeConfig) {
        db.financeConfig = {
          monthlyFee: 100,
          chargeDateRule: 'primeiro_jogo',
          history: [{ date: '2026-01-01', amount: 100 }]
        };
      }

      const prevFee = db.financeConfig.monthlyFee;
      const newFee = parseFloat(monthlyFee);

      if (isNaN(newFee) || newFee <= 0) {
        return res.status(400).json({ error: 'Valor da mensalidade inválido.' });
      }

      if (chargeDateRule !== 'primeiro_jogo' && chargeDateRule !== 'ultimo_jogo') {
        return res.status(400).json({ error: 'Forma de geração inválida. Escolha entre Primeiro Jogo ou Último Jogo.' });
      }

      const targetEffectiveDate = effectiveDate || new Date().toISOString().split('T')[0];
      if (prevFee !== newFee) {
        const existingIdx = db.financeConfig.history.findIndex(h => h.date === targetEffectiveDate);
        if (existingIdx >= 0) {
          db.financeConfig.history[existingIdx].amount = newFee;
        } else {
          db.financeConfig.history.push({
            date: targetEffectiveDate,
            amount: newFee
          });
        }
        db.financeConfig.monthlyFee = newFee;
      }

      db.financeConfig.chargeDateRule = chargeDateRule;

      db.userAudits = db.userAudits || [];
      db.userAudits.push({
        id: 'audit-fin-change-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        userId: 'admin',
        userName: 'Administrador',
        userEmail: 'admin@racha.com',
        action: 'Alteração de Parâmetros Financeiros',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: 'Administrador',
        details: `Parâmetros financeiros alterados pelo administrador. Nova mensalidade: R$ ${newFee} (Vigência: ${targetEffectiveDate}). Nova regra de geração: ${chargeDateRule === 'primeiro_jogo' ? 'Primeiro Jogo do Mês' : 'Último Jogo do Mês'}.`
      });

      writeDb(db);
      return res.json(db.financeConfig);
    } catch (err) {
      console.error('[API POST /api/finances/config]', err);
      return res.status(500).json({ error: 'Erro ao salvar configuração financeira.' });
    }
  });

  app.post('/api/finances/pay', (req, res) => {
    try {
      const { billId, email, role } = req.body;
      if (!billId) {
        return res.status(400).json({ error: 'Código da cobrança é obrigatório.' });
      }

      const db = readDb();
      const billIndex = db.bills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      const bill = db.bills[billIndex];

      // If not admin, check if the bill belongs to this player (by email)
      const player = db.players.find(p => p.id === bill.playerId);
      const isMyBill = player && player.email.toLowerCase().trim() === (email || '').toLowerCase().trim();

      if (role !== 'admin' && role !== 'auxiliar') {
        if (!isMyBill) {
          return res.status(403).json({ error: 'Você só pode confirmar pagamentos das suas próprias cobranças.' });
        }
      }

      if (bill.status === 'pago') {
        return res.status(400).json({ error: 'Esta cobrança já está paga.' });
      }

      const nowStr = new Date().toISOString();
      db.bills[billIndex].status = 'pago';
      db.bills[billIndex].paidAt = nowStr;

      // Add payment log
      const payment = {
        id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        playerId: bill.playerId,
        billId: bill.id,
        amount: bill.amount,
        paidAt: nowStr
      };
      
      db.payments.push(payment);

      const targetPlayer = db.players.find(p => p.id === bill.playerId);
      const targetPlayerName = targetPlayer ? targetPlayer.name : 'Jogador';
      notify(db, {
        category: 'financeiro',
        title: '✅ Pagamento Confirmado',
        message: `O pagamento da mensalidade de R$ ${bill.amount.toFixed(2)} (${bill.competence}) para o jogador ${targetPlayerName} foi confirmado.`,
        targetUserId: bill.playerId,
        actionUrl: 'finance'
      });

      writeDb(db);
      return res.json({ message: 'Pagamento confirmado com sucesso!', bill: db.bills[billIndex] });
    } catch (err) {
      console.error('[API POST pay]', err);
      return res.status(500).json({ error: 'Erro ao processar confirmação de pagamento.' });
    }
  });

  app.post('/api/finances/toggle', (req, res) => {
    try {
      const { billId, email, role } = req.body;
      if (!billId) {
        return res.status(400).json({ error: 'Código da cobrança é obrigatório.' });
      }

      const db = readDb();
      const billIndex = db.bills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      const bill = db.bills[billIndex];
      const player = db.players.find(p => p.id === bill.playerId);
      const isMyBill = player && player.email.toLowerCase().trim() === (email || '').toLowerCase().trim();
      const isAdmin = role === 'admin' || role === 'auxiliar';

      if (!isAdmin && !isMyBill) {
        return res.status(403).json({ error: 'Você só pode gerenciar os seus próprios débitos.' });
      }

      const newStatus = bill.status === 'pago' ? 'pendente' : 'pago';
      const nowStr = new Date().toISOString();

      db.bills[billIndex].status = newStatus;
      if (newStatus === 'pago') {
        db.bills[billIndex].paidAt = nowStr;
        // Insert payment log
        const payment = {
          id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
          playerId: bill.playerId,
          billId: bill.id,
          amount: bill.amount,
          paidAt: nowStr
        };
        db.payments.push(payment);
      } else {
        db.bills[billIndex].paidAt = undefined;
        // Remove payment log
        db.payments = db.payments.filter(p => p.billId !== bill.id);
      }

      if (newStatus === 'pago') {
        const targetPlayer = db.players.find(p => p.id === bill.playerId);
        const targetPlayerName = targetPlayer ? targetPlayer.name : 'Jogador';
        notify(db, {
          category: 'financeiro',
          title: '✅ Pagamento Confirmado',
          message: `O pagamento da mensalidade de R$ ${bill.amount.toFixed(2)} (${bill.competence}) para o jogador ${targetPlayerName} foi confirmado.`,
          targetUserId: bill.playerId,
          actionUrl: 'finance'
        });
      }

      writeDb(db);
      return res.json({ message: 'Status de cobrança alterado com sucesso!', bill: db.bills[billIndex] });
    } catch (err) {
      console.error('[API POST Toggle Bill]', err);
      return res.status(500).json({ error: 'Erro ao alterar status da cobrança.' });
    }
  });

  app.post('/api/finances/bills', (req, res) => {
    try {
      const { playerId, competence, amount, dueDate, status } = req.body;
      if (!playerId || !competence || !amount || !dueDate) {
        return res.status(400).json({ error: 'Todos os campos (Jogador, Competência, Valor e Vencimento) são obrigatórios.' });
      }

      const db = readDb();
      const newBill = {
        id: 'bill-manual-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
        playerId,
        competence,
        amount: parseFloat(amount),
        dueDate,
        status: status || 'pendente'
      };

      db.bills.push(newBill);

      const targetPlayer = db.players.find(p => p.id === newBill.playerId);
      const targetPlayerName = targetPlayer ? targetPlayer.name : 'Jogador';
      notify(db, {
        category: 'financeiro',
        title: '💰 Nova Cobrança Gerada',
        message: `Foi gerada uma cobrança manual no valor de R$ ${newBill.amount.toFixed(2)} (${newBill.competence}) para o jogador ${targetPlayerName}.`,
        targetUserId: newBill.playerId,
        actionUrl: 'finance'
      });

      writeDb(db);
      return res.status(201).json({ message: 'Cobrança manual criada com sucesso!', bill: newBill });
    } catch (err) {
      console.error('[API POST bill manual]', err);
      return res.status(500).json({ error: 'Erro ao criar cobrança manual.' });
    }
  });

  app.delete('/api/finances/bills/:billId', (req, res) => {
    try {
      const { billId } = req.params;
      const db = readDb();
      const exists = db.bills.some(b => b.id === billId);
      if (!exists) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      db.bills = db.bills.filter(b => b.id !== billId);
      // Clean payments
      db.payments = db.payments.filter(p => p.billId !== billId);

      writeDb(db);
      return res.json({ message: 'Cobrança removida com sucesso.' });
    } catch (err) {
      console.error('[API DELETE bill]', err);
      return res.status(500).json({ error: 'Erro ao remover cobrança.' });
    }
  });

  app.post('/api/finances/trigger-sync', (req, res) => {
    try {
      const db = readDb();
      const beforeCount = db.bills.length;
      generateMonthlyBillingsIfNeeded(db);
      writeDb(db);
      const afterCount = db.bills.length;
      return res.json({
        message: 'Varredura financeira completada.',
        generatedCount: afterCount - beforeCount
      });
    } catch (err) {
      console.error('[API POST trigger-sync]', err);
      return res.status(500).json({ error: 'Erro ao sincronizar cobranças.' });
    }
  });

  // --- MURAL DO RACHA API ENDPOINTS ---

  // Get all mural categories
  app.get('/api/mural/categories', (req, res) => {
    try {
      const db = readDb();
      res.json(db.muralCategories || []);
    } catch (err) {
      console.error('[API GET Categories]', err);
      res.status(500).json({ error: 'Erro ao listar categorias.' });
    }
  });

  // Get association options (matches and events)
  app.get('/api/mural/associations', (req, res) => {
    try {
      const db = readDb();
      const matches = db.matches
        // only show matches that have a season (or all for association)
        .map(m => ({
          id: m.id,
          date: m.date,
          location: m.location,
          label: `Partida - ${m.date.split('-').reverse().join('/')} (${m.location})`
        }));
      const events = (db.events || []).map(e => ({
        id: e.id,
        date: e.date,
        name: e.name,
        label: `Evento - ${e.name} (${e.date.split('-').reverse().join('/')})`
      }));
      res.json({ matches, events });
    } catch (err) {
      console.error('[API GET Associations]', err);
      res.status(500).json({ error: 'Erro ao carregar associações.' });
    }
  });

  // Get mural statistics
  app.get('/api/mural/stats', (req, res) => {
    try {
      const db = readDb();
      const posts = db.muralPosts || [];
      const photosCount = posts.filter(p => p.mediaType === 'image').length;
      const videosCount = posts.filter(p => p.mediaType === 'video').length;
      res.json({
        publicationsCount: posts.length,
        photosCount,
        videosCount
      });
    } catch (err) {
      console.error('[API GET Mural Stats]', err);
      res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
    }
  });

  // Get all categories, posts, highlights (Mural Principal)
  app.get('/api/mural/posts', (req, res) => {
    try {
      const db = readDb();
      const posts = [...(db.muralPosts || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(posts);
    } catch (err) {
      console.error('[API GET Mural Posts]', err);
      res.status(500).json({ error: 'Erro ao carregar publicações.' });
    }
  });

  // Get public mural posts (Página Pública Simplificada)
  app.get('/api/mural/public-posts', (req, res) => {
    try {
      const db = readDb();
      const posts = (db.muralPosts || [])
        .filter(p => p.showOnLanding === true)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(posts);
    } catch (err) {
      console.error('[API GET Public Mural Posts]', err);
      res.status(500).json({ error: 'Erro ao carregar mural público.' });
    }
  });

  // Get public Next Match status
  app.get('/api/public/next-match', (req, res) => {
    try {
      const db = readDb();
      const todayStr = new Date().toISOString().split('T')[0];
      // Filter matches that are scheduled or confirming starting from today
      const upcoming = db.matches
        .filter(m => (m.status === 'agendada' || m.status === 'confirmando') && m.date >= todayStr)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (upcoming.length > 0) {
        const next = upcoming[0];
        return res.json({
          date: next.date,
          time: next.time,
          location: next.location,
          status: next.status
        });
      }

      // Fallback: If no future matches exist, check any upcoming matches regardless of date
      const anyUpcoming = db.matches
        .filter(m => m.status === 'agendada' || m.status === 'confirmando')
        .sort((a, b) => a.date.localeCompare(b.date));

      if (anyUpcoming.length > 0) {
        const next = anyUpcoming[0];
        return res.json({
          date: next.date,
          time: next.time,
          location: next.location,
          status: next.status
        });
      }

      // Secondary Fallback: retrieve the most recent match overall to show as reference
      const sortedAll = [...db.matches].sort((a, b) => b.date.localeCompare(a.date));
      if (sortedAll.length > 0) {
        const last = sortedAll[0];
        return res.json({
          date: last.date,
          time: last.time,
          location: last.location,
          status: last.status
        });
      }

      return res.json({
        date: '---',
        time: '---',
        location: 'A definir'
      });
    } catch (err) {
      console.error('[API GET Public Next Match]', err);
      res.status(500).json({ error: 'Erro ao obter informações do próximo racha.' });
    }
  });

  // Upload endpoint with validation
  app.post('/api/mural/upload', (req, res) => {
    try {
      const { filename, fileType, fileData, size } = req.body;

      if (!filename || !fileType || !fileData) {
        return res.status(400).json({ error: 'Os campos filename, fileType e fileData são obrigatórios.' });
      }

      const isVideo = fileType.toLowerCase().startsWith('video/') || filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.mov');
      const isImage = fileType.toLowerCase().startsWith('image/') || filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg') || filename.toLowerCase().endsWith('.png') || filename.toLowerCase().endsWith('.webp');

      if (!isImage && !isVideo) {
        return res.status(400).json({ error: 'Formato de arquivo inválido. Use JPG, JPEG, PNG, WEBP para fotos ou MP4, MOV para vídeos.' });
      }

      const fileSize = parseInt(size) || 0;
      if (isImage) {
        if (fileSize > 10 * 1024 * 1024) {
          return res.status(400).json({ error: 'A foto excede o limite permitido de 10 MB.' });
        }
      } else if (isVideo) {
        if (fileSize > 200 * 1024 * 1024) {
          return res.status(400).json({ error: 'O vídeo excede o limite permitido de 200 MB.' });
        }
      }

      const timestamp = Date.now();
      const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-');
      const uniqueFilename = `${timestamp}-${sanitizedFilename}`;

      const uploadDir = path.join(process.cwd(), 'data', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      try {
        const base64Data = fileData.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(uploadDir, uniqueFilename), buffer);
      } catch (errWrite) {
        console.error('Falha ao gravar arquivo em disco:', errWrite);
      }

      const awsRegion = process.env.AWS_REGION || 'sa-east-1';
      const awsBucket = process.env.AWS_S3_BUCKET || 'racha-do-fofim';
      const simulatedS3Url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/uploads/${uniqueFilename}`;

      return res.json({
        s3Url: simulatedS3Url,
        localUrl: `/uploads/${uniqueFilename}`,
        filename: uniqueFilename,
        mediaType: isImage ? 'image' : 'video'
      });
    } catch (err) {
      console.error('[API POST Mural Upload]', err);
      res.status(500).json({ error: 'Falha interna ao processar upload.' });
    }
  });

  // Serve static uploads
  app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(process.cwd(), 'data', 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('Arquivo não encontrado.');
    }
  });

  // Add a new post
  app.post('/api/mural/posts', (req, res) => {
    try {
      const { title, description, mediaUrl, mediaType, fileSize, category, matchId, eventId, authorId, authorName, authorRole, eventDate, thumbnailUrl, mediumUrl, showOnLanding, isHighlighted } = req.body;

      if (!title || !mediaUrl || !category || !authorId) {
        return res.status(400).json({ error: 'Título, arquivo, categoria e autor são obrigatórios.' });
      }

      const db = readDb();
      const newPostId = 'post-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const nowIso = new Date().toISOString();
      const defaultEventDate = eventDate || nowIso.split('T')[0];

      const isPostHighlighted = isHighlighted === true;
      if (isPostHighlighted) {
        if (!db.muralPosts) db.muralPosts = [];
        const currentlyHighlighted = db.muralPosts.filter(p => p.isHighlighted === true);
        if (currentlyHighlighted.length >= 3) {
          currentlyHighlighted.sort((a, b) => {
            const dateA = a.highlightedAt || a.createdAt || '';
            const dateB = b.highlightedAt || b.createdAt || '';
            return dateA.localeCompare(dateB);
          });
          const oldest = currentlyHighlighted[0];
          const offIndex = db.muralPosts.findIndex(p => p.id === oldest.id);
          if (offIndex !== -1) {
            db.muralPosts[offIndex] = {
              ...db.muralPosts[offIndex],
              isHighlighted: false,
              highlightedAt: undefined,
              updatedAt: new Date().toISOString()
            };
          }
        }
      }

      const newPost = {
        id: newPostId,
        title: title.trim(),
        description: (description || '').trim(),
        mediaUrl,
        mediaType: mediaType || 'image',
        fileSize: fileSize || 0,
        category,
        authorId,
        authorName,
        authorRole,
        createdAt: nowIso,
        updatedAt: nowIso,
        matchId: matchId || undefined,
        eventId: eventId || undefined,
        isHighlighted: isPostHighlighted,
        highlightedAt: isPostHighlighted ? nowIso : undefined,
        showOnLanding: showOnLanding === true,
        thumbnailUrl: thumbnailUrl || mediaUrl,
        mediumUrl: mediumUrl || mediaUrl,
        eventDate: defaultEventDate,
        origin: 'manual' as const
      };

      if (!db.muralPosts) db.muralPosts = [];
      db.muralPosts.push(newPost);

      // Save file metadata separately in muralFiles
      if (!db.muralFiles) db.muralFiles = [];
      db.muralFiles.push({
        id: 'file-' + Date.now(),
        postId: newPostId,
        s3Url: mediaUrl,
        mediaType: mediaType || 'image',
        size: fileSize || 0,
        originalName: mediaUrl.split('/').pop() || 'uploaded-file',
        mimeType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
        uploadedAt: new Date().toISOString()
      });

      writeDb(db);
      res.status(201).json(newPost);
    } catch (err) {
      console.error('[API POST Mural Post]', err);
      res.status(500).json({ error: 'Erro ao criar publicação.' });
    }
  });

  // Edit title/description
  app.put('/api/mural/posts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, reqUserId, reqUserRole, eventDate, showOnLanding, isHighlighted } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'O título é obrigatório.' });
      }

      const db = readDb();
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
      }

      const post = db.muralPosts[postIndex];

      const isAdmin = reqUserRole === 'admin';
      const isAuthor = post.authorId === reqUserId;

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Apenas o autor ou o administrador pode editar esta publicação.' });
      }

      const isPostHighlighted = isHighlighted === true;
      let highlightedAt = post.highlightedAt;

      if (isPostHighlighted && !post.isHighlighted) {
        // Enforce max 3 highlighted posts
        const currentlyHighlighted = db.muralPosts.filter(p => p.isHighlighted === true);
        if (currentlyHighlighted.length >= 3) {
          currentlyHighlighted.sort((a, b) => {
            const dateA = a.highlightedAt || a.createdAt || '';
            const dateB = b.highlightedAt || b.createdAt || '';
            return dateA.localeCompare(dateB);
          });
          const oldest = currentlyHighlighted[0];
          const offIndex = db.muralPosts.findIndex(p => p.id === oldest.id);
          if (offIndex !== -1) {
            db.muralPosts[offIndex] = {
              ...db.muralPosts[offIndex],
              isHighlighted: false,
              highlightedAt: undefined,
              updatedAt: new Date().toISOString()
            };
          }
        }
        highlightedAt = new Date().toISOString();
      } else if (!isPostHighlighted) {
        highlightedAt = undefined;
      }

      db.muralPosts[postIndex] = {
        ...post,
        title: title.trim(),
        description: (description || '').trim(),
        showOnLanding: showOnLanding === true,
        isHighlighted: isPostHighlighted,
        highlightedAt,
        updatedAt: new Date().toISOString(),
        eventDate: eventDate || post.eventDate || post.createdAt.split('T')[0]
      };

      writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API PUT Mural Post]', err);
      res.status(500).json({ error: 'Erro ao editar publicação.' });
    }
  });

  // Delete publication (Admin only)
  app.delete('/api/mural/posts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { reqUserRole } = req.body;

      const db = readDb();
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
      }

      const post = db.muralPosts[postIndex];

      // Exclusão is strictly administrative as outlined in specifications
      const isAdmin = reqUserRole === 'admin' || req.query.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir publicações do Mural.' });
      }

      db.muralPosts = db.muralPosts.filter(p => p.id !== id);

      if (db.muralHighlights) {
        db.muralHighlights = db.muralHighlights.filter(h => h.postId !== id);
      }
      if (db.muralFiles) {
        db.muralFiles = db.muralFiles.filter(f => f.postId !== id);
      }

      writeDb(db);
      res.json({ message: 'Publicação excluída com sucesso.' });
    } catch (err) {
      console.error('[API DELETE Mural Post]', err);
      res.status(500).json({ error: 'Erro ao excluir publicação.' });
    }
  });

  // Highlight/toggle Destacar no Mural (Admin only - Max 3 automatic rollover)
  app.post('/api/mural/posts/:id/highlight', (req, res) => {
    try {
      const { id } = req.params;
      const { reqUserId, reqUserRole } = req.body;

      const isAdmin = reqUserRole === 'admin' || req.query.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem gerenciar os destaques do mural.' });
      }

      const db = readDb();
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
      }

      const post = db.muralPosts[postIndex];
      const newIsHighlighted = !post.isHighlighted;

      if (newIsHighlighted) {
        // Enforce max 3 highlighted posts on the mural
        const currentlyHighlighted = db.muralPosts.filter(p => p.isHighlighted === true);
        if (currentlyHighlighted.length >= 3) {
          // Sort currently highlighted by highlightedAt or createdAt (oldest first)
          currentlyHighlighted.sort((a, b) => {
            const dateA = a.highlightedAt || a.createdAt || '';
            const dateB = b.highlightedAt || b.createdAt || '';
            return dateA.localeCompare(dateB);
          });

          // Unhighlight the oldest one
          const oldest = currentlyHighlighted[0];
          const offIndex = db.muralPosts.findIndex(p => p.id === oldest.id);
          if (offIndex !== -1) {
            db.muralPosts[offIndex] = {
              ...db.muralPosts[offIndex],
              isHighlighted: false,
              highlightedAt: undefined,
              updatedAt: new Date().toISOString()
            };
          }
        }
      }

      db.muralPosts[postIndex] = {
        ...post,
        isHighlighted: newIsHighlighted,
        highlightedAt: newIsHighlighted ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString()
      };

      writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API POST Highlight Mural]', err);
      res.status(500).json({ error: 'Erro ao gerenciar destaque do mural.' });
    }
  });

  // Highlight/toggle Destacar na Tela Inicial (Admin only - No Limit)
  app.post('/api/mural/posts/:id/toggle-landing', (req, res) => {
    try {
      const { id } = req.params;
      const { reqUserId, reqUserRole } = req.body;

      const isAdmin = reqUserRole === 'admin' || req.query.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem gerenciar destaque na tela inicial.' });
      }

      const db = readDb();
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicação não encontrada.' });
      }

      const post = db.muralPosts[postIndex];
      const newShowOnLanding = !post.showOnLanding;

      db.muralPosts[postIndex] = {
        ...post,
        showOnLanding: newShowOnLanding,
        updatedAt: new Date().toISOString()
      };

      writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API POST Toggle Landing]', err);
      res.status(500).json({ error: 'Erro ao gerenciar destaque da tela inicial.' });
    }
  });

  // ==========================================
  // --- UNIFIED NOTIFICATION CENTER APIs -----
  // ==========================================

  app.get('/api/notifications', (req, res) => {
    try {
      const { userId, email } = req.query as { userId?: string; email?: string };
      const db = readDb();

      // Ensure data syncing happens in real time (such as upcoming match deadlines)
      syncDynamicNotifications(db);
      writeDb(db);

      let targetUserId = userId;
      // If only email is provided, we can resolve the playerId
      if (!targetUserId && email) {
        const resolvedPlayer = db.players.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (resolvedPlayer) {
          targetUserId = resolvedPlayer.id;
        }
      }

      const notifications = db.notifications || [];
      const preferencesList = db.notificationPreferences || [];

      // Load user preferences or set defaults
      const pref = preferencesList.find(p => p.userId === targetUserId) || {
        userId: targetUserId || 'all',
        all: true,
        partidas: true,
        eventos: true,
        financeiro: true,
        sistema: true
      };

      // Filter based on userId and preferences
      let userNotifications = notifications.filter((n: any) => {
        // Must belong to 'all' or this user
        const isBelong = n.targetUserId === 'all' || n.targetUserId === targetUserId;
        if (!isBelong) return false;

        // Apply preferences filtering
        if (pref.all) {
          return true; // receives everything
        }

        // Check categories toggle (system maps to sistema/jogador/sorteio)
        if (n.category === 'partida') {
          return pref.partidas;
        } else if (n.category === 'evento') {
          return pref.eventos;
        } else if (n.category === 'financeiro') {
          return pref.financeiro;
        } else if (n.category === 'sistema' || n.category === 'jogador' || n.category === 'sorteio') {
          return pref.sistema;
        }

        return true;
      });

      // Sort with latest first
      userNotifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const unreadCount = userNotifications.filter(n => n.status === 'nao_lida').length;

      return res.json({
        notifications: userNotifications,
        unreadCount
      });
    } catch (err) {
      console.error('[API GET notifications]', err);
      return res.status(500).json({ error: 'Erro ao listar as notificações.' });
    }
  });

  app.post('/api/notifications/mark-read', (req, res) => {
    try {
      const { id, ids } = req.body as { id?: string; ids?: string[] };
      const db = readDb();

      if (!db.notifications) db.notifications = [];

      let updatedCount = 0;
      if (id) {
        const idx = db.notifications.findIndex(n => n.id === id);
        if (idx !== -1) {
          db.notifications[idx].status = 'lida';
          updatedCount++;
        }
      } else if (ids && Array.isArray(ids)) {
        db.notifications.forEach((n, idx) => {
          if (ids.includes(n.id)) {
            db.notifications![idx].status = 'lida';
            updatedCount++;
          }
        });
      } else {
        return res.status(400).json({ error: 'Id ou lista de Ids de notificações são obrigatórios.' });
      }

      writeDb(db);
      return res.json({ message: `${updatedCount} notificações marcadas como lidas com sucesso.` });
    } catch (err) {
      console.error('[API POST mark-read]', err);
      return res.status(500).json({ error: 'Erro ao marcar notificações como lidas.' });
    }
  });

  app.post('/api/notifications/mark-all-read', (req, res) => {
    try {
      const { userId, email } = req.body as { userId?: string; email?: string };
      const db = readDb();

      if (!db.notifications) db.notifications = [];

      let targetUserId = userId;
      if (!targetUserId && email) {
        const resolvedPlayer = db.players.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
        if (resolvedPlayer) {
          targetUserId = resolvedPlayer.id;
        }
      }

      let count = 0;
      db.notifications.forEach((n, idx) => {
        const isBelong = n.targetUserId === 'all' || n.targetUserId === targetUserId;
        if (isBelong && n.status === 'nao_lida') {
          db.notifications![idx].status = 'lida';
          count++;
        }
      });

      writeDb(db);
      return res.json({ message: `Todas as ${count} notificações pendentes foram marcadas como lidas.` });
    } catch (err) {
      console.error('[API POST mark-all-read]', err);
      return res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas.' });
    }
  });

  app.get('/api/notifications/preferences', (req, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      const db = readDb();

      const preferencesList = db.notificationPreferences || [];
      const pref = preferencesList.find(p => p.userId === userId) || {
        userId: userId || 'anonymous',
        all: true,
        partidas: true,
        eventos: true,
        financeiro: true,
        sistema: true
      };

      return res.json(pref);
    } catch (err) {
      console.error('[API GET preferences]', err);
      return res.status(500).json({ error: 'Erro ao obter configurações de notificação.' });
    }
  });

  app.post('/api/notifications/preferences', (req, res) => {
    try {
      const { userId, preferences } = req.body as { userId: string; preferences: any };
      if (!userId || !preferences) {
        return res.status(400).json({ error: 'Id do usuário e configurações são obrigatórios.' });
      }

      const db = readDb();
      if (!db.notificationPreferences) db.notificationPreferences = [];

      const index = db.notificationPreferences.findIndex(p => p.userId === userId);
      const updatedPref = {
        userId,
        all: preferences.all !== undefined ? !!preferences.all : true,
        partidas: preferences.partidas !== undefined ? !!preferences.partidas : true,
        eventos: preferences.eventos !== undefined ? !!preferences.eventos : true,
        financeiro: preferences.financeiro !== undefined ? !!preferences.financeiro : true,
        sistema: preferences.sistema !== undefined ? !!preferences.sistema : true
      };

      if (index !== -1) {
        db.notificationPreferences[index] = updatedPref;
      } else {
        db.notificationPreferences.push(updatedPref);
      }

      writeDb(db);
      return res.json({ message: 'Configurações de notificação atualizadas com sucesso.', preferences: updatedPref });
    } catch (err) {
      console.error('[API POST preferences]', err);
      return res.status(500).json({ error: 'Erro ao salvar preferências de notificação.' });
    }
  });

  // --- Vite Dev Server Middleware / Static Client serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Racha do Fofim running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
