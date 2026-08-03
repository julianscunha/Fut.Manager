import dotenv from 'dotenv';
// Carrega .env.local primeiro (prioridade em dev), depois .env como fallback.
// Em produção (Render), as variáveis já vêm injetadas pela plataforma; dotenv.config()
// é inofensivo quando o arquivo não existe.
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';
import { readDb, writeDb, generateMonthlyBillingsIfNeeded, getSupabaseClient } from './server/db';
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken } from './server/auth';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import compression from 'compression';
import { runSmartDraw, recordAffinities } from './server/drawEngine';
import { computeStatsForSeason } from './server/statsEngine';
import { Player, User, UserRole, UserStatus, Season, Match, PresenceStatus, MatchResult, PlayerCategory, PlayerPosition, FAVORITE_TEAMS } from './src/types';
import { GoogleGenAI } from '@google/genai';
import { AvatarProviderFactory } from './server/avatarProvider';
import {
  isEmailConfigured,
  sendEmail,
} from './server/email';
import {
  passwordResetTemplate,
  registrationApprovedTemplate,
  registrationPendingTemplate,
  registrationRejectedTemplate,
  notificationTemplate,
  welcomeTemplate,
  reengageInactiveTemplate,
  reserveConvocationTemplate,
} from './server/email-templates';

// Nome do sistema exibido na interface e usado em mensagens (WhatsApp, notificações, etc.).
// Cada instalação define o seu via APP_NAME no .env — nunca hardcode o nome de um grupo específico.
const APP_NAME = process.env.APP_NAME || 'Meu Racha';

// Rede de segurança: uma promise rejeitada sem catch (ex.: erro de configuração como
// JWT_SECRET ausente) derrubaria o processo inteiro em produção sem nenhuma resposta
// chegar ao cliente (o que aparece no browser como "Unexpected end of JSON input").
// Aqui só logamos, para o processo seguir vivo e o erro aparecer nos logs do Render.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

async function startServer() {
  const app = express();
  
  // Necessário para o Render/Proxies capturarem o IP real do usuário para o rate-limit
  app.set('trust proxy', 1);

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

  async function getAuthenticatedUser(req: express.Request, dbInstance?: any): Promise<User | null> {
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const payload = verifySessionToken(token);
    if (!payload) {
      return null;
    }
    const db = dbInstance || await readDb();
    const user = db.users.find((u: any) => u.id === payload.userId);
    if (!user) {
      return null;
    }
    return user;
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

  async function getComputedPresences(db: any, matchId: string) {
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
      await writeDb(db);
    }

    // Build a map of player to their DB presence record
    const presenceMap = new Map();
    for (const pr of validPresences) {
      presenceMap.set(pr.playerId, pr);
    }

    // Find all mensalistas and reserves
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

    // Remaining spots to reach match limit
    const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
    const remainingSpots = Math.max(0, limit - count);

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
        const pendingConvocacao = (db.reserveAlerts || []).find(
          (a: any) => a.matchId === matchId && (a.suggestedReservePlayerId === player.id || a.playerId === player.id) && !a.cleared && a.status === 'aguardando_resposta'
        );
        if (pendingConvocacao) {
          computedStatus = 'aguardando_resposta';
        } else if (originalStatus === 'confirmado') {
          const isManuallyApproved = pr && pr.manuallyApproved === true;
          const isAutoPromoted = autoApprovedReserveIds.has(player.id);
          const isSelfConfirmedAfterRelease = pr && pr.status === 'confirmado' && pr.confirmedAt && match.reservesReleased === true;
          if (isManuallyApproved || isAutoPromoted || isSelfConfirmedAfterRelease) {
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
        declaredPresence: pr ? pr.status === 'confirmado' : false,
        confirmedAt: pr ? pr.confirmedAt : undefined,
        manuallyApproved: pr ? pr.manuallyApproved || false : false,
        isAutoPromoted: autoApprovedReserveIds.has(player.id)
      };
    });

    // Sort: mensalistas first, reserves second!
    mergedList.sort((a: any, b: any) => {
      const catOrder: Record<string, number> = { mensalista: 1, reserva: 2 };
      const catDiff = (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    return mergedList;
  }

  async function summonReservesForMatch(db: any, matchId: string, count: number): Promise<any[]> {
    const match = db.matches.find((m: any) => m.id === matchId);
    if (!match) return [];

    const reserves = db.players.filter((p: any) => p.category === 'reserva' && !p.deletedAt && p.status === 'disponivel');
    const computedList = await getComputedPresences(db, matchId);
    const matchAlerts = (db.reserveAlerts || []).filter((a: any) => a.matchId === matchId);
    const currentReservesOrder = db.reservesOrder || [];

    const queue = reserves.filter((p: any) => {
      const isConfirmed = computedList.some((c: any) => c.playerId === p.id && c.presenceStatus === 'confirmado');
      if (isConfirmed) return false;

      const hasHistoryState = matchAlerts.some((a: any) =>
        (a.suggestedReservePlayerId === p.id || a.playerId === p.id) &&
        (a.status === 'recusado' || a.status === 'dispensado') &&
        a.cleared
      );
      if (hasHistoryState) return false;

      return true;
    });

    queue.sort((a: any, b: any) => {
      const idxA = currentReservesOrder.indexOf(a.id);
      const idxB = currentReservesOrder.indexOf(b.id);
      const orderA = idxA !== -1 ? idxA : 999999;
      const orderB = idxB !== -1 ? idxB : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    const regularGksCount = db.players.filter((p: any) => p.category === 'mensalista' && !p.deletedAt && p.primaryPosition === 'goleiro').length;
    const cancelledGkCount = db.presences.filter((p: any) => p.matchId === matchId && p.status === 'cancelado' && db.players.find((pl: any) => pl.id === p.playerId)?.primaryPosition === 'goleiro').length;
    const activeGkCount = db.presences.filter((p: any) => p.matchId === matchId && p.status === 'confirmado' && db.players.find((pl: any) => pl.id === p.playerId)?.primaryPosition === 'goleiro').length +
      (db.reserveAlerts || []).filter((a: any) => a.matchId === matchId && a.status === 'aguardando_resposta' && !a.cleared && db.players.find((pl: any) => pl.id === (a.suggestedReservePlayerId || a.playerId))?.primaryPosition === 'goleiro').length;

    const isGoleiroMissing = cancelledGkCount > 0 && activeGkCount < regularGksCount;
    let finalQueue = [...queue];
    if (isGoleiroMissing) {
      const gkReserves = queue.filter((p: any) => p.primaryPosition === 'goleiro');
      const otherReserves = queue.filter((p: any) => p.primaryPosition !== 'goleiro');
      finalQueue = [...gkReserves, ...otherReserves];
    }

    const summoned: any[] = [];
    const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
    const currentConfirmed = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;
    const remainingSpots = Math.max(0, limit - currentConfirmed);
    const toSummon = Math.min(count, remainingSpots, finalQueue.length);

    for (let i = 0; i < toSummon; i++) {
      const nextPlayer = finalQueue[i];
      if (!db.reserveAlerts) db.reserveAlerts = [];
      const alertObj = {
        id: 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        matchId,
        suggestedReservePlayerId: nextPlayer.id,
        playerId: nextPlayer.id,
        status: 'aguardando_resposta',
        createdAt: new Date().toISOString(),
        cleared: false
      };
      db.reserveAlerts.push(alertObj);
      summoned.push(nextPlayer);

      notify(db, {
        category: 'partida',
        title: 'Vaga de Reserva Convocada!',
        message: `Você foi convocado da lista de prioridades para preencher uma vaga no racha de ${match.date.split('-').reverse().join('/')}. Responda na plataforma!`,
        targetUserId: nextPlayer.id,
        actionUrl: 'calendar',
        matchId
      });

      notify(db, {
        category: 'partida',
        title: 'Convocação de Reserva',
        message: `Uma vaga livre foi acionada para o reserva ${nextPlayer.name}. Aguardando confirmação...`,
        targetUserId: 'all',
        actionUrl: 'calendar',
        matchId
      });

      if (!db.deadlineAudits) db.deadlineAudits = [];
      db.deadlineAudits.push({
        id: 'da-' + Date.now() + '-' + i,
        matchId,
        matchDate: match.date,
        matchTime: match.time,
        releasedAt: new Date().toISOString(),
        auditType: 'manual_reserves_release',
        createdAt: new Date().toISOString(),
        details: `O jogador reserva ${nextPlayer.name} foi oficialmente convocado devido a vagas em aberto.`
      });

      if (isEmailConfigured() && nextPlayer.email) {
        const loginUrl = process.env.APP_URL || 'https://rachadofofim.com.br';
        try {
          const template = reserveConvocationTemplate({
            playerName: nextPlayer.name,
            matchDate: match.date.split('-').reverse().join('/'),
            matchTime: match.time,
            appName: APP_NAME,
            loginUrl
          });
          await sendEmail(nextPlayer.email, template.subject, template.html);
        } catch (emailErr) {
          console.error('[sendEmail] Falha ao enviar e-mail de convocação:', emailErr);
        }
      }
    }

    return summoned;
  }

  async function syncMatchStatuses(db: any) {
    if (!db.matches) return;
    let mutated = false;

    for (const m of db.matches) {
      const oldStatus = m.status;
      const oldLifecycle = m.lifecycleState;

      // Determine computed state
      let computedLifecycle = oldLifecycle || 'SCHEDULED';
      
      // Se o status for alterado para um estado ativo, removemos o ciclo de vida terminal para reavaliar
      if (['agendada', 'confirmando', 'aguardando_reservas', 'fechada'].includes(oldStatus)) {
        if (computedLifecycle === 'ARCHIVED' || computedLifecycle === 'MATCH_FINISHED') {
          computedLifecycle = 'SCHEDULED';
        }
      }

      // If it was already archived or if it was marked as cancelled, it's ARCHIVED
      if (computedLifecycle === 'ARCHIVED' || oldStatus === 'cancelada') {
        computedLifecycle = 'ARCHIVED';
      } else if (computedLifecycle === 'MATCH_FINISHED' || oldStatus === 'encerrada') {
        computedLifecycle = 'MATCH_FINISHED';
      } else {
        const hasResults = (db.results || []).some((r: any) => r.matchId === m.id);
        if (hasResults) {
          computedLifecycle = 'MATCH_FINISHED';
        } else {
          const matchDraw = (db.draws || []).find((d: any) => d.matchId === m.id);
          if (matchDraw || oldStatus === 'sorteada') {
            computedLifecycle = 'DRAW_COMPLETED';
          } else {
            const computedList = await getComputedPresences(db, m.id);
            const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;
            const limit = m.maxPlayers !== undefined && m.maxPlayers !== null ? m.maxPlayers : 15;

            // Debug logger for match status decisions
            const debugLog = {
              vagasNecessarias: limit,
              confirmados: confirmedCount,
              naoVai: computedList.filter((p: any) => p.presenceStatus === 'cancelado').length,
              pendentes: computedList.filter((p: any) => p.presenceStatus === 'nao_confirmado' && p.category !== 'reserva').length,
              reservasConvocados: computedList.filter((p: any) => p.presenceStatus === 'aguardando_resposta').length,
              reservasConfirmados: computedList.filter((p: any) => p.presenceStatus === 'confirmado' && p.category === 'reserva').length,
              statusAtual: oldStatus
            };
            console.log(`[DEBUG_MATCH_STATUS] Match ID: ${m.id}`, JSON.stringify(debugLog, null, 2));

            if (confirmedCount >= limit) {
              computedLifecycle = 'CHECKIN_CLOSED';
            } else {
              const hasAnyDeclarations = computedList.some((p: any) => p.presenceStatus === 'confirmado' || (p.presenceStatus === 'cancelado' && p.category !== 'reserva'));
              if (oldStatus === 'agendada' && !hasAnyDeclarations) {
                computedLifecycle = 'SCHEDULED';
              } else {
                computedLifecycle = 'CHECKIN_OPEN';
              }
            }
          }
        }
      }

      // Check if deadline is expired to trigger automatic reserves release
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = m.confirmationDeadlineDaysBefore !== undefined ? m.confirmationDeadlineDaysBefore : deadlineDays;
      const { isDeadlineExpired } = getMatchDeadlineInfo(m, matchDeadlineDays);

      if (isDeadlineExpired && !m.reservesReleased) {
        m.reservesReleased = true;
        m.reservesReleasedAt = new Date().toISOString();
        mutated = true;
        await summonReservesForMatch(db, m.id, 99);
      }

      // Sync the old text status with computedLifecycle to guarantee backward-compatibility
      let targetStatus = m.status;
      if (computedLifecycle === 'ARCHIVED') {
        targetStatus = oldStatus === 'cancelada' ? 'cancelada' : 'encerrada';
      } else if (computedLifecycle === 'MATCH_FINISHED') {
        targetStatus = 'encerrada';
      } else if (computedLifecycle === 'DRAW_COMPLETED') {
        targetStatus = 'sorteada';
      } else if (computedLifecycle === 'CHECKIN_CLOSED') {
        targetStatus = 'fechada';
      } else if (computedLifecycle === 'CHECKIN_OPEN') {
        const computedList = await getComputedPresences(db, m.id);
        const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;
        const limit = m.maxPlayers !== undefined && m.maxPlayers !== null ? m.maxPlayers : 15;
        if (m.reservesReleased === true && confirmedCount < limit) {
          targetStatus = 'aguardando_reservas';
        } else {
          targetStatus = 'confirmando';
        }
      } else if (computedLifecycle === 'SCHEDULED') {
        targetStatus = 'agendada';
      }

      if (m.status !== targetStatus) {
        m.status = targetStatus;
        mutated = true;
      }

      if (m.lifecycleState !== computedLifecycle) {
        m.lifecycleState = computedLifecycle;
        mutated = true;
      }
    }

    if (mutated) {
      await writeDb(db);
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
      if (!n) return false;
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
        return titleLower.includes('cancelad') || titleLower.includes('excluído');
      }

      // 4. Delete obsolete event notifications of cancelled events (keeping only the final cancellation/exclusion notice)
      if (n.eventId && canceledEventIds.has(n.eventId)) {
        const titleLower = (n.title || '').toLowerCase();
        return titleLower.includes('cancelad') || titleLower.includes('excluído');
      }

      return true;
    });

    // 1. Sync bills (created and overdue)
    (db.bills || []).forEach((bill: any) => {
      if (!bill) return;
      const player = (db.players || []).find((p: any) => p && p.id === bill.playerId);
      const pName = player ? player.name : 'Jogador';

      // Bill created
      const createdKey = `notif-bill-created-${bill.id}`;
      if (!db.notifications.some((n: any) => n && n.id === createdKey)) {
        db.notifications.push({
          id: createdKey,
          category: 'financeiro',
          title: 'ðŸ’° Nova Cobrança Gerada',
          message: `Foi gerada uma cobrança de mensalidade de R$ ${bill.amount.toFixed(2)} referente à competência ${bill.competence} para o jogador ${pName}.`,
          status: 'nao_lida',
          createdAt: new Date().toISOString(),
          targetUserId: bill.playerId,
          actionUrl: 'finance'
        });
      }

      // Bill overdue
      const overdueKey = `notif-bill-overdue-${bill.id}`;
      if (bill.status === 'pendente' && bill.dueDate && typeof bill.dueDate === 'string' && bill.dueDate < todayStr) {
        if (!db.notifications.some((n: any) => n && n.id === overdueKey)) {
          db.notifications.push({
            id: overdueKey,
            category: 'financeiro',
            title: 'ðŸš¨ Cobrança Vencida',
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
            if (!db.notifications.some((n: any) => n && n.id === key24h)) {
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
            if (!db.notifications.some((n: any) => n && n.id === key2h)) {
              db.notifications.push({
                id: key2h,
                category: 'partida',
                title: 'ðŸš¨ Últimas Horas de Confirmação',
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
            if (!db.notifications.some((n: any) => n && n.id === keyGeneral)) {
              db.notifications.push({
                id: keyGeneral,
                category: 'partida',
                title: '⚠️ Prazo de Confirmação Próximo',
                message: `O prazo para confirmar sua presença na rodada de ${match.date && typeof match.date === 'string' ? match.date.split('-').reverse().join('/') : ''} se encerra em breve.`,
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

  // --- Security Middleware ---
  app.use(helmet({
    contentSecurityPolicy: false // Vite dev/inline scripts precisam de CSP customizado; revisitar em produção
  }));

  // Comprime respostas (JSON de API + bundle JS/CSS estático) com gzip/brotli — sem isso,
  // o bundle de produção (~2MB) e os payloads JSON trafegam sem nenhuma compactação.
  app.use(compression());

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins,
    credentials: true
  }));

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
  });

  // Middleware for parsing JSON requests with 250MB limit for base64 uploads
  app.use(express.json({ limit: '250mb' }));
  app.use(express.urlencoded({ limit: '250mb', extended: true }));

  // --- Global authentication gate for /api/* ---
  // Auditoria pré-produção encontrou dezenas de rotas de negócio (partidas, financeiro, sorteio,
  // presenças) sem NENHUMA checagem de autenticação — qualquer visitante anonimo da internet
  // conseguia criar/editar/excluir dados. Em vez de tocar rota por rota (~80 rotas), um gate
  // global exige login válido para tudo em /api/*, com uma lista explícita e pequena do que
  // realmente precisa ser público (login/registro/recuperação de senha e as duas telas públicas
  // pré-login: mural público e próxima partida — confirmado via teste real de navegação).
  // Nota: middleware montado via app.use('/api', ...) recebe req.path já SEM o prefixo /api
  // (relativo ao ponto de montagem) — por isso as regex abaixo não incluem "/api".
  const PUBLIC_API_ROUTES: { method: string; path: RegExp }[] = [
    { method: 'POST', path: /^\/auth\/register$/ },
    { method: 'POST', path: /^\/auth\/login$/ },
    { method: 'POST', path: /^\/auth\/forgot-password$/ },
    { method: 'POST', path: /^\/auth\/reset-password$/ },
    { method: 'GET', path: /^\/mural\/public-posts$/ },
    { method: 'GET', path: /^\/public\/next-match$/ },
    { method: 'GET', path: /^\/public\/app-config$/ },
    { method: 'GET', path: /^\/public\/health$/ },
  ];

  app.use('/api', async (req, res, next) => {
    const isPublic = PUBLIC_API_ROUTES.some((r) => r.method === req.method && r.path.test(req.path));
    if (isPublic) return next();

    const requestingUser = await getAuthenticatedUser(req);
    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }
    next();
  });

  // --- API Routes ---

  // Upload: S3 image upload simulation
  app.post('/api/upload-s3', async (req, res) => {
    try {
      const requestingUser = await getAuthenticatedUser(req);
      if (!requestingUser) {
        return res.status(401).json({ error: 'Não autenticado.' });
      }

      const { filename, fileType, fileData } = req.body;

      if (!filename || !fileType || !fileData) {
        return res.status(400).json({ error: 'Os campos filename, fileType e fileData são obrigatórios.' });
      }

      const base64Data = fileData.replace(/^data:([A-Za-z0-9-+\/]+);base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Valida o tipo real do arquivo pelos magic bytes, não pelo mimetype/extensão declarado pelo cliente.
      const detectedType = await fileTypeFromBuffer(buffer);
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!detectedType || !allowedMimes.includes(detectedType.mime)) {
        return res.status(400).json({ error: 'Formato de imagem inválido. Use JPG, JPEG, PNG ou WEBP.' });
      }

      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'A imagem excede o limite permitido de 5 MB.' });
      }

      // Foto de perfil não precisa de resolução maior que isso — recomprime pra WEBP
      // (bem menor que o JPEG/PNG original) e evita fotos de vários MB pesando no roster.
      const compressedBuffer = await sharp(buffer)
        .rotate() // aplica a orientção EXIF antes de descartá-la, senão fotos de celular saem giradas
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-').replace(/\.[^.]+$/, '');
      const uniqueFilename = `${Date.now()}-${sanitizedFilename}.webp`;

      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from('Uploads')
        .upload(uniqueFilename, compressedBuffer, { contentType: 'image/webp' });

      if (uploadError) {
        console.error('[Upload Supabase Storage]', uploadError);
        return res.status(500).json({ error: 'Falha ao enviar imagem para o armazenamento.' });
      }

      const { data: publicUrlData } = supabase.storage.from('Uploads').getPublicUrl(uniqueFilename);

      return res.json({
        message: 'Upload concluído com sucesso!',
        url: publicUrlData.publicUrl
      });
    } catch (err) {
      console.error('[API POST upload-s3]', err);
      return res.status(500).json({ error: 'Falha interna ao processar upload.' });
    }
  });

  // Auth: Registrar Usuário
  app.post('/api/auth/register', authRateLimiter, async (req, res) => {
    try {
      const { name, email, password, confirmPassword } = req.body;

      if (!name || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'As senhas não coincidem.' });
      }

      const db = await readDb();
      const normalizedEmail = email.toLowerCase().trim();

      const existingUser = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
      }

      // Automatically seek matching athlete folder or create a new one
      let matchingPlayer = db.players.find((p: any) => p.email && p.email.toLowerCase().trim() === normalizedEmail);
      if (!matchingPlayer) {
        const newPlayerId = 'player-' + Date.now();
        matchingPlayer = {
          id: newPlayerId,
          name: name.trim(),
          phone: '(85) 99999-9999',
          email: normalizedEmail,
          photoOriginal: '',
          playerCardUrl: '',
          favoriteTeamId: 'out',
          category: 'reserva',
          status: 'disponivel',
          primaryPosition: 'meio_campo',
          secondaryPositions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.players.push(matchingPlayer);
      }

      const newUserId = 'user-' + Date.now();
      const newUser: User = {
        id: newUserId,
        name: name.trim(),
        email: normalizedEmail,
        role: 'jogador', // default role
        status: 'pending', // Waiting admin approval
        createdAt: new Date().toISOString(),
        playerId: matchingPlayer.id,
        athlete_id: matchingPlayer.id
      };

      db.users.push(newUser);
      db.passwords[newUserId] = await hashPassword(password);

      await writeDb(db);

      // Send pending registration email to the new user
      if (isEmailConfigured()) {
        try {
          const appUrl = process.env.APP_URL || 'http://localhost:3000';
          const { subject, html } = registrationPendingTemplate({
            userName: newUser.name,
            appName: APP_NAME,
            estimatedWaitDays: 2,
          });
          await sendEmail(newUser.email, subject, html);
        } catch (emailErr) {
          console.error('[API POST /api/auth/register] Falha ao enviar e-mail de cadastro pendente:', emailErr);
        }
      }

      return res.status(201).json({
        message: 'Cadastro realizado com sucesso! Aguardando aprovação do administrador para acesso.',
        user: newUser
      });
    } catch (err) {
      console.error('[API POST /api/auth/register]', err);
      return res.status(500).json({ error: 'Erro ao efetuar cadastro. Tente novamente em instantes.' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    try {
      const { email, password, turnstileToken } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      // Validção do Cloudflare Turnstile se a secret key estiver configurada
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || process.env.SUPABASE_TURNSTILE_SECRET_KEY;
      if (turnstileSecret) {
        if (!turnstileToken) {
          return res.status(400).json({ error: 'Por favor, complete a verificção de segurança do Turnstile.' });
        }

        try {
          const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              remoteip: req.ip
            })
          });
          const verifyData: any = await verifyRes.json();
          if (!verifyData.success) {
            return res.status(400).json({ error: 'Falha na verificção de segurança do Turnstile. Tente novamente.' });
          }
        } catch (verifyErr) {
          console.error('[Turnstile Verify Error]', verifyErr);
        }
      }

      const db = await readDb();
      const normalizedEmail = email.toLowerCase().trim();

      const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      const storedHash = db.passwords[user.id];
      if (!storedHash || !(await verifyPassword(password, storedHash))) {
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

      const token = signSessionToken(user.id);

      return res.json({
        message: 'Login realizado com sucesso!',
        user,
        token
      });
    } catch (err) {
      console.error('[API POST /api/auth/login]', err);
      return res.status(500).json({ error: 'Erro ao efetuar login. Tente novamente em instantes.' });
    }
  });

  // Auth: Redefinição de senha (Esqueci minha senha)
  app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'O e-mail é obrigatório.' });
      }

      const db = await readDb();
      const user = db.users.find((u) => u.email.toLowerCase().trim() === email.toLowerCase().trim());

      // Resposta idêntica exista ou não o usuário/SMTP configurado — não revela se o e-mail está cadastrado.
      const sentResponse = { message: 'Se o e-mail estiver cadastrado, um link de redefinição foi enviado.' };
      const unavailableResponse = { message: 'A recuperação automática de senha está temporariamente indisponível. Entre em contato com um administrador do grupo para redefinir sua senha.' };

      if (!isEmailConfigured()) {
        return res.json(unavailableResponse);
      }

      if (!user) {
        return res.json(sentResponse);
      }

      // Generate a recovery token with expiration and persist it for validation on reset
      const token = 'recovery-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

      if (!db.passwordResetTokens) db.passwordResetTokens = {};
      db.passwordResetTokens[user.id] = { token, expiresAt };
      await writeDb(db);

      const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/?resetToken=${encodeURIComponent(token)}&resetUserId=${encodeURIComponent(user.id)}`;
      try {
        const { subject, html } = passwordResetTemplate({
          userName: user.name,
          resetUrl,
          appName: APP_NAME,
          expiresInMinutes: 15,
        });
        await sendEmail(user.email, subject, html);
      } catch (emailErr) {
        console.error('[API POST /api/auth/forgot-password] Falha ao enviar e-mail:', emailErr);
        delete db.passwordResetTokens[user.id];
        await writeDb(db);
        return res.status(500).json({ error: 'Falha ao enviar e-mail de redefinição. Tente novamente em instantes.' });
      }

      return res.json(sentResponse);
    } catch (err) {
      console.error('[API POST /api/auth/forgot-password]', err);
      return res.status(500).json({ error: 'Erro ao processar solicitação. Tente novamente em instantes.' });
    }
  });

  // Auth: Resetar Senha
  app.post('/api/auth/reset-password', authRateLimiter, async (req, res) => {
    try {
      const { userId, token, newPassword } = req.body;

      if (!userId || !token || !newPassword) {
        return res.status(400).json({ error: 'Informações inválidas para redefinição.' });
      }

      const db = await readDb();
      if (!db.passwords[userId]) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const storedToken = db.passwordResetTokens?.[userId];
      if (!storedToken || storedToken.token !== token) {
        return res.status(401).json({ error: 'Token de redefinição inválido.' });
      }

      if (new Date(storedToken.expiresAt).getTime() < Date.now()) {
        delete db.passwordResetTokens![userId];
        await writeDb(db);
        return res.status(401).json({ error: 'Token de redefinição expirado. Solicite uma nova recuperação.' });
      }

      db.passwords[userId] = await hashPassword(newPassword);
      delete db.passwordResetTokens![userId];
      await writeDb(db);

      return res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
    } catch (err) {
      console.error('[API POST /api/auth/reset-password]', err);
      return res.status(500).json({ error: 'Erro ao redefinir senha. Tente novamente em instantes.' });
    }
  });

  // Usuários: Listar usuários para aprovação (Apenas Admin/Auxiliar)
  app.get('/api/users', async (req, res) => {
    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'auxiliar')) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    return res.json(db.users);
  });

  // Usuários: Listar auditoria de alterções (Apenas Admin/Auxiliar)
  app.get('/api/users/audits', async (req, res) => {
    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'auxiliar')) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    return res.json(db.userAudits || []);
  });

  // Auditoria de prazos e liberção de reservas (Apenas Admin/Auxiliar)
  app.get('/api/deadline-audits', async (req, res) => {
    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser || (requestingUser.role !== 'admin' && requestingUser.role !== 'auxiliar')) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    return res.json(db.deadlineAudits || []);
  });

  // Usuários: Aprovar / Rejeitar / Mudar Permissão (Admin apenas)
  app.post('/api/users/action', async (req, res) => {
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

    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(401).json({ error: 'Não autorizado. Apenas administradores podem gerenciar permissões.' });
    }

    const userIndex = db.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (userId === 'user-admin') {
      if (action === 'reject') {
        return res.status(400).json({ error: 'Erro de Segurança: O Administrador raiz não pode ser excluído, rejeitado ou inativado.' });
      }
      if (action === 'update_role') {
        if (role && role !== 'admin') {
          return res.status(400).json({ error: 'Erro de Segurança: O papel de ADMIN não pode ser removido do Administrador raiz.' });
        }
        if (selectedPlayerId !== undefined && !selectedPlayerId) {
          return res.status(400).json({ error: 'Erro de Segurança: O Administrador raiz não pode ser desvinculado de uma ficha de atleta.' });
        }
      }
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

        if (initialCategory === 'mensalista' && initialPosition !== 'goleiro') {
          const activeMonthlyLimit = db.financeConfig?.maxMensalistas ?? db.recurrentConfig?.maxMensalistas ?? 12;
          const currentActiveMonthly = db.players.filter(p => !p.deletedAt && p.category === 'mensalista' && p.primaryPosition !== 'goleiro').length;
          if (currentActiveMonthly >= activeMonthlyLimit) {
            return res.status(400).json({
              error: `Não foi possível concluir a operação. O grupo já atingiu o limite configurado de mensalistas (${activeMonthlyLimit}/${activeMonthlyLimit}). Libere uma vaga ou altere o limite em Financeiro → Parâmetros.`
            });
          }
        }

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

        // Auditoria: Crição de atleta
        db.userAudits.push({
          id: 'audit-pcreate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          userId,
          userName: db.users[userIndex].name,
          userEmail: db.users[userIndex].email,
          action: 'Crição de Atleta',
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
        title: 'ðŸŽ‰ Cadastro Aprovado!',
        message: `Seu cadastro no ${APP_NAME} foi aprovado como ${chosenRole === 'admin' ? 'Administrador' : chosenRole === 'auxiliar' ? 'Auxiliar' : 'Jogador'}. Seja bem-vindo ao grupo!`,
        targetUserId: userId,
        actionUrl: 'players'
      });

      notify(db, {
        category: 'jogador',
        title: '🏃 Novo Jogador no Grupo',
        message: `O cadastro de ${db.users[userIndex].name} foi aprovado pela administrção como ${chosenRole === 'admin' ? 'Administrador' : chosenRole === 'auxiliar' ? 'Auxiliar' : 'Jogador'}.`,
        targetUserId: 'all',
        actionUrl: 'players'
      });

      // Send approval email to the user
      if (isEmailConfigured()) {
        try {
          const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}`;
          const { subject, html } = registrationApprovedTemplate({
            userName: db.users[userIndex].name,
            userRole: chosenRole,
            appName: APP_NAME,
            loginUrl,
          });
          await sendEmail(db.users[userIndex].email, subject, html);
        } catch (emailErr) {
          console.error('[API POST /api/users/action] Falha ao enviar e-mail de aprovação:', emailErr);
        }
      }

      // Send welcome email to the newly approved user
      if (isEmailConfigured()) {
        try {
          const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}`;
          const { subject, html } = welcomeTemplate({
            userName: db.users[userIndex].name,
            appName: APP_NAME,
            loginUrl,
          });
          await sendEmail(db.users[userIndex].email, subject, html);
        } catch (emailErr) {
          console.error('[API POST /api/users/action] Falha ao enviar e-mail de boas-vindas:', emailErr);
        }
      }
    } else if (action === 'reject') {
      db.users[userIndex].status = 'rejected';
      auditActionText = 'Cadastro Rejeitado';

      // Send rejection email to the user
      if (isEmailConfigured()) {
        try {
          const reason = 'Sua solicitação de cadastro foi analisada e não foi aprovada desta vez.';
          const { subject, html } = registrationRejectedTemplate({
            userName: db.users[userIndex].name,
            appName: APP_NAME,
            rejectionReason: reason,
          });
          await sendEmail(db.users[userIndex].email, subject, html);
        } catch (emailErr) {
          console.error('[API POST /api/users/action] Falha ao enviar e-mail de rejeição:', emailErr);
        }
      }
    } else if (action === 'update_role' && role) {
      db.users[userIndex].role = role;
      auditActionText = `Alteração de Perfil de ${previousRole} para ${role}`;

      // Update link action if provided
      if (selectedPlayerId !== undefined) {
        const oldPlayerId = db.users[userIndex].playerId;
        db.users[userIndex].playerId = selectedPlayerId || undefined;
        const matchingPlayer = selectedPlayerId ? db.players.find(p => p.id === selectedPlayerId) : null;
        const prevPlayer = oldPlayerId ? db.players.find(p => p.id === oldPlayerId) : null;
        
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
          details: selectedPlayerId 
            ? `Vínculo de atleta alterado para ${matchingPlayer ? matchingPlayer.name : 'Desconhecido'} (${selectedPlayerId}) (Anterior: ${prevPlayer ? prevPlayer.name : 'Nenhum'})`
            : `Vínculo de atleta removido (Anterior: ${prevPlayer ? prevPlayer.name : 'Nenhum'})`
        });
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

    await writeDb(db);
    return res.json({ message: 'Ção realizada com sucesso!', user: db.users[userIndex] });
  });

  // Remove do bucket 'Uploads' o arquivo referenciado por uma URL pública do Supabase Storage.
  // photoOriginal/avatarEsportivo/avatarCard chegam direto do body de PUT /api/players — um
  // cliente mal-intencionado poderia setar esses campos com a URL do arquivo de outro jogador
  // e, numa edição seguinte, forçar a exclusão dele. Por isso, antes de apagar: (1) só aceita
  // caminhos no formato exato gerado pelos nossos próprios uploads (sem barras/traversal fora
  // do esperado) e (2) confirma que nenhum outro registro de jogador ainda referencia essa
  // mesma URL em qualquer um dos 4 campos de foto/avatar.
  async function deleteStorageFileByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;
    const marker = '/storage/v1/object/public/Uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return;

    const path = decodeURIComponent(url.slice(idx + marker.length));

    const looksLikeOwnUpload = /^\d+-[a-z0-9.-]+\.webp$/.test(path) || /^avatars\/[^/]+-esportivo-\d+\.webp$/.test(path);
    if (!looksLikeOwnUpload) {
      console.warn('[Storage] Ignorando exclusão de caminho fora do padrão esperado:', path);
      return;
    }

    const db = await readDb();
    const stillInUse = db.players.some(p =>
      p.photoOriginal === url || p.avatarOriginal === url || p.avatarEsportivo === url || p.avatarCard === url
    );
    if (stillInUse) {
      console.warn('[Storage] Arquivo ainda referenciado por um jogador, exclusão cancelada:', path);
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from('Uploads').remove([path]);
    if (error) {
      console.error('[Storage] Falha ao remover arquivo órfão:', path, error.message);
    }
  }

  async function deleteStorageFile(path: string | null | undefined): Promise<void> {
    if (!path) return;
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from('Uploads').remove([path]);
    if (error) {
      console.error('[Storage] Falha ao remover arquivo:', path, error.message);
    }
  }

  function extractStoragePath(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = '/storage/v1/object/public/Uploads/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  // Providers de avatar retornam a imagem gerada como data URL base64 inline. Salvar isso direto
  // na coluna do Postgres (em vez de só a URL) faz o payload de GET /api/players carregar todo
  // esse base64 (várias centenas de KB a poucos MB por jogador) a cada leitura da listagem — da
  // o upload pro Storage aqui, igual ao que /api/upload-s3 já faz pra foto original.
  async function uploadAvatarDataUrlToStorage(dataUrl: string, pathPrefix: string): Promise<string> {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return dataUrl; // já não é base64 inline (ex.: URL retornada por engano) — nada a fazer

    const rawBuffer = Buffer.from(match[2], 'base64');

    // Providers de IA retornam PNG em alta resolução (2-3MB) — recomprime pra WEBP, já que
    // o avatar só é exibido em cards/miniaturas, nunca em tela cheia de alta resolução.
    const compressedBuffer = await sharp(rawBuffer)
      .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const filename = `${pathPrefix}-${Date.now()}.webp`;

    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from('Uploads').upload(filename, compressedBuffer, { contentType: 'image/webp' });
    if (error) {
      console.error('[Avatar Inteligente] Falha ao enviar avatar gerado para o Storage:', error.message);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from('Uploads').getPublicUrl(filename);
    return publicUrlData.publicUrl;
  }

  // Gerar Avatar Esportivo Inteligente usando o AvatarProviderFactory desacoplado
  async function gerarAvatarEsportivo(player: Player, forceRegenerate = false): Promise<Player> {
    const team = FAVORITE_TEAMS.find(t => t.id === player.favoriteTeamId);
    const timeDoCoracao = team ? team.name : (player.timeDoCoracao || 'São Paulo');
    player.timeDoCoracao = timeDoCoracao;

    if (!player.numeroFavorito) {
      player.numeroFavorito = player.numeroFavorito || 10;
    }
    if (!player.peDominante) {
      player.peDominante = player.peDominante || 'Direito';
    }

    // Set avatarOriginal separately to never lose it
    if (player.photoOriginal && !player.avatarOriginal) {
      player.avatarOriginal = player.photoOriginal;
    }

    const hasAvatar = !!player.avatarEsportivo;
    const isEditingButSame = !forceRegenerate && hasAvatar;

    if (isEditingButSame) {
      return player;
    }

    if (!player.photoOriginal) {
      player.avatarEsportivo = undefined;
      return player;
    }

    if (process.env.ENABLE_AVATAR_AI !== 'true') {
      throw new Error('Gerção de avatar desativada temporariamente via feature flag.');
    }

    try {
      console.log(`[Avatar Inteligente] Iniciando gerção com AvatarProviderFactory para o atleta: ${player.name} (${timeDoCoracao})`);
      const provider = AvatarProviderFactory.getProvider();
      const generatedUrl = await provider.generateAvatar({
        photoOriginal: player.photoOriginal,
        club: timeDoCoracao,
        playerName: player.name,
      });

      player.avatarEsportivo = generatedUrl;
      player.avatarVersion = (player.avatarVersion || 0) + 1;
      console.log(`[Avatar Inteligente] Sucesso na gerção do avatar de ${player.name}`);
      return player;
    } catch (err: any) {
      console.warn(`[Avatar Inteligente] Erro durante a gerção: ${err.message || err}`);
      throw err;
    }
  }

  // Processamento síncrono ou assíncrono em segundo plano para avatares gamer do atleta
  async function processarAvatarGamerBackground(playerId: string) {
    console.log(`[Avatar Inteligente] Fluxo de background iniciado para o jogador ID: ${playerId}`);

    const AVATAR_TIMEOUT_MS = 5 * 60 * 1000;

    const finishWithError = async (db: any, playerIndex: number, reason: string) => {
      if (playerIndex === -1) return;
      const player = db.players[playerIndex];
      const [oldCard, oldEsportivo] = [player.avatarCard, player.avatarEsportivo];
      player.avatarStatus = 'ERRO';
      player.avatarCard = null;
      player.avatarEsportivo = null;
      await writeDb(db);
      await Promise.all([deleteStorageFileByUrl(oldCard), deleteStorageFileByUrl(oldEsportivo)]);
      console.error(`[Avatar Inteligente] Falha para ${player.name}: ${reason}`);
    };

    const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
      let timeoutHandle: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Avatar generation timed out')), ms);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutHandle);
      }
    };

    try {
      await withTimeout(
        (async () => {
          let db = await readDb();
          let playerIndex = db.players.findIndex(p => p.id === playerId);
          if (playerIndex === -1) {
            console.error(`[Avatar Inteligente] Atleta não encontrado para processamento.`);
            return;
          }

          let player = db.players[playerIndex];
          if (!player.photoOriginal) {
            console.log(`[Avatar Inteligente] Sem foto original válida. Encerrando.`);
            await finishWithError(db, playerIndex, 'Sem foto original');
            return;
          }

          if (process.env.ENABLE_AVATAR_AI !== 'true') {
            console.log(`[Avatar Inteligente] Geração suspensa via feature flag ENABLE_AVATAR_AI para ${player.name}.`);
            await finishWithError(db, playerIndex, 'Feature flag desativada');
            return;
          }

          player.avatarStatus = 'PROCESSANDO';
          await writeDb(db);

          try {
            const generatedPlayer = await gerarAvatarEsportivo(player, true);

            db = await readDb();
            playerIndex = db.players.findIndex(p => p.id === playerId);
            if (playerIndex === -1) return;

            player = db.players[playerIndex];
            const [oldCard, oldEsportivo] = [player.avatarCard, player.avatarEsportivo];
            player.avatarOriginal = generatedPlayer.avatarOriginal;

            const isFallback = !generatedPlayer.avatarEsportivo || generatedPlayer.avatarEsportivo === generatedPlayer.photoOriginal;
            if (isFallback) {
              player.avatarStatus = 'ERRO';
              player.avatarCard = null;
              player.avatarEsportivo = null;
            } else {
              const avatarUrl = await uploadAvatarDataUrlToStorage(generatedPlayer.avatarEsportivo!, `avatars/${playerId}-esportivo`);
              player.avatarCard = avatarUrl;
              player.avatarEsportivo = avatarUrl;
              player.avatarStatus = 'CONCLUÍDO';
            }

            await writeDb(db);
            console.log(`[Avatar Inteligente] Salvo com sucesso para ${player.name} com status: ${player.avatarStatus}`);

            if (oldCard !== player.avatarCard) await deleteStorageFileByUrl(oldCard);
            if (oldEsportivo !== oldCard && oldEsportivo !== player.avatarEsportivo) await deleteStorageFileByUrl(oldEsportivo);
          } catch (err) {
            console.error(`[Avatar Inteligente] Falha no background:`, err);
            db = await readDb();
            playerIndex = db.players.findIndex(p => p.id === playerId);
            await finishWithError(db, playerIndex, (err as any)?.message || 'Erro desconhecido');
          }
        })(),
        AVATAR_TIMEOUT_MS
      );
    } catch (err) {
      console.error(`[Avatar Inteligente] Timeout ou falha geral no processamento:`, err);
      try {
        const db = await readDb();
        const playerIndex = db.players.findIndex(p => p.id === playerId);
        await finishWithError(db, playerIndex, 'Timeout ou falha geral');
      } catch (finalErr) {
        console.error(`[Avatar Inteligente] Falha ao recuperar estado após erro:`, finalErr);
      }
    }
  }

  // Jogadores: Listar (Retorna ativos se sem parâmetro, ou todos se admin para gerenciamento)
  app.get('/api/players', async (req, res) => {
    const db = await readDb();
    const includeDeleted = req.query.includeDeleted === 'true';

    let result = db.players;
    if (!includeDeleted) {
      result = db.players.filter((p) => !p.deletedAt);
    }

    return res.json(result);
  });

  // Jogadores: Criar Jogador
  app.post('/api/players', async (req, res) => {
    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso Proibido: Apenas administradores podem cadastrar novos atletas manualmente.' });
    }

    const { responsibleName, ...playerData } = req.body as Omit<Player, 'id' | 'createdAt' | 'updatedAt'> & { responsibleName?: string };

    if (!playerData.name || !playerData.category || !playerData.status || !playerData.primaryPosition) {
      return res.status(400).json({ error: 'Nome, categoria, status e posição principal são obrigatórios.' });
    }

    if (playerData.category === 'mensalista' && playerData.primaryPosition !== 'goleiro') {
      const activeMonthlyLimit = db.financeConfig?.maxMensalistas ?? db.recurrentConfig?.maxMensalistas ?? 12;
      const currentActiveMonthly = db.players.filter(p => !p.deletedAt && p.category === 'mensalista' && p.primaryPosition !== 'goleiro').length;
      if (currentActiveMonthly >= activeMonthlyLimit) {
        return res.status(400).json({
          error: `Não foi possível concluir a operação. O grupo já atingiu o limite configurado de mensalistas (${activeMonthlyLimit}/${activeMonthlyLimit}). Libere uma vaga ou altere o limite em Financeiro → Parâmetros.`
        });
      }
    }

    const formattedPhone = playerData.phone || '(85) 99999-9999';
    // Postgres trata '' como valor real (diferente de NULL) na coluna UNIQUE email — normaliza para
    // undefined quando vazio, senão o 2º jogador sem e-mail colidiria com o 1º na constraint.
    if (!playerData.email || !playerData.email.trim()) {
      delete (playerData as any).email;
    }

    const newPlayer: Player = {
      ...playerData,
      phone: formattedPhone,
      id: 'player-' + Date.now(),
      secondaryPositions: playerData.secondaryPositions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStreak: 0,
      maxStreak: 0,
      
      // Soccer Avatar fields
      timeDoCoracao: playerData.timeDoCoracao || '',
      numeroFavorito: Number(playerData.numeroFavorito) || 10,
      peDominante: playerData.peDominante || 'Direito',
      avatarOriginal: playerData.photoOriginal || '',
      avatarEsportivo: '',
      avatarCard: '',
      avatarStatus: playerData.photoOriginal ? 'PENDENTE' : 'CONCLUÍDO',
      avatarVersion: 1
    };

    db.players.push(newPlayer);

    // Auditoria: Crição de atleta
    if (!db.userAudits) db.userAudits = [];
    db.userAudits.push({
      id: 'audit-pcreate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId: 'system',
      userName: newPlayer.name,
      userEmail: playerData.email || 'atleta@sistema.local',
      action: 'Crição de Atleta',
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
      userEmail: playerData.email || 'atleta@sistema.local',
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
      userEmail: playerData.email || 'atleta@sistema.local',
      action: 'Alteração de telefone',
      previousRole: '',
      newRole: '',
      previousStatus: '',
      newStatus: '',
      performedBy: responsibleName || 'Atleta',
      details: `Telefone definido como: ${formattedPhone}`
    });

    await writeDb(db);

    // Trigger background generation only after the player is guaranteed persisted —
    // processarAvatarGamerBackground does its own readDb() and would otherwise race with writeDb() above.
    if (newPlayer.photoOriginal) {
      setImmediate(() => {
        processarAvatarGamerBackground(newPlayer.id).catch(err => {
          console.error('[Avatar Background Post] Fail:', err);
        });
      });
    }

    return res.status(201).json({ message: 'Jogador cadastrado com sucesso!', player: newPlayer });
  });

  // Jogadores: Gerar 10 Jogadores Aleatórios
  app.post('/api/players/generate-random-10', async (req, res) => {
    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (requestingUser.role !== 'admin' && requestingUser.role !== 'auxiliar') {
      return res.status(403).json({ error: 'Acesso Proibido: Apenas administradores e auxiliares podem gerar atletas aleatórios.' });
    }

    const firstNames = [
      "Gabriel", "Lucas", "Mateus", "Guilherme", "Felipe", "Thiago", "Arthur", "Matheus", "Gustavo", "Vinicius", 
      "Rodrigo", "Daniel", "Rafael", "Bruno", "Eduardo", "Diego", "Vitor", "Leonardo", "Marcelo", "Alexandre",
      "Carlos", "Marcos", "João", "André", "Renato", "Enzo", "Pedro", "Caio", "Luiz", "Ricardo"
    ];
    const lastNames = [
      "Silva", "Santos", "Souza", "Oliveira", "Pereira", "Lima", "Carvalho", "Ferreira", "Ribeiro", "Almeida", 
      "Costa", "Gomes", "Martins", "Araújo", "Rodrigues", "Nascimento", "Barbosa", "Cardoso", "Melo", "Teixeira",
      "Cavalcante", "Nunes", "Mendes", "Pinheiro", "Pinto", "Guedes", "Rocha", "Fonseca", "Alves", "Vieira"
    ];

    const unsplashPhotos = [
      "https://images.unsplash.com/photo-1544698310-74ea9d1c8258?w=150",
      "https://picsum.photos/seed/football2/150",
      "https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=150",
      "https://images.unsplash.com/photo-1526232761682-d7100d14fc6e?w=150",
      "https://images.unsplash.com/photo-1504305754058-2f08ccd89a0a?w=150",
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=150",
      "https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=150",
      "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150"
    ];

    const teams = ["fla", "pal", "spa", "cor", "flu", "vas", "gre", "int", "cam", "cru", "san", "bot"];

    const categories: PlayerCategory[] = [
      "mensalista",
      "mensalista",
      "mensalista",
      "mensalista",
      "mensalista",
      "mensalista",
      "reserva",
      "reserva",
      "reserva",
      "reserva"
    ];

    const positions: PlayerPosition[] = [
      "goleiro",
      "zagueiro",
      "volante",
      "volante",
      "meio_campo",
      "atacante",
      "meio_campo",
      "atacante",
      "zagueiro",
      "meio_campo"
    ];

    const newlyCreated: Player[] = [];

    for (let i = 0; i < 10; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      let ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      // Prevent duplicate full names if possible
      let fullName = `${fn} ${ln}`;
      let attempt = 0;
      while (db.players.some(p => p.name.toLowerCase() === fullName.toLowerCase()) && attempt < 10) {
        ln = lastNames[Math.floor(Math.random() * lastNames.length)];
        fullName = `${fn} ${ln}`;
        attempt++;
      }

      const cleanEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}@sistema.local`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cleanPhone = `(85) 9${Math.floor(8000 + Math.random() * 1999)}-${Math.floor(1000 + Math.random() * 8999)}`;
      const photo = unsplashPhotos[i % unsplashPhotos.length];
      const team = teams[Math.floor(Math.random() * teams.length)];
      const cat = categories[i];
      const pos = positions[i];

      let secPos: PlayerPosition[] = [];
      if (pos === "zagueiro") secPos = ["volante"];
      else if (pos === "volante") secPos = ["zagueiro", "meio_campo"];
      else if (pos === "meio_campo") secPos = ["atacante"];
      else if (pos === "atacante") secPos = ["meio_campo"];

      const pid = 'player-gen-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

      const randomizedPlayer: Player = {
        id: pid,
        name: fullName,
        email: cleanEmail,
        phone: cleanPhone,
        photoOriginal: photo,
        playerCardUrl: '',
        favoriteTeamId: team,
        category: cat,
        status: 'disponivel',
        primaryPosition: pos,
        secondaryPositions: secPos,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStreak: 0,
        maxStreak: 0,
        adminNotes: 'Atleta simulado de demonstrção gerado automaticamente.'
      };

      db.players.push(randomizedPlayer);
      newlyCreated.push(randomizedPlayer);

      // Audit logs
      if (!db.userAudits) db.userAudits = [];
      db.userAudits.push({
        id: 'audit-pgen-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        userId: 'system',
        userName: fullName,
        userEmail: cleanEmail,
        action: 'Crição de Atleta',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: requestingUser.name,
        details: `Atleta ${fullName} gerado automaticamente por simulção.`
      });
    }

    await writeDb(db);

    return res.status(201).json({
      message: '10 atletas gerados com sucesso!',
      players: newlyCreated
    });
  });

  // Jogadores: Atualizar Jogador
  app.put('/api/players/:id', async (req, res) => {
    const { id } = req.params;
    const { responsibleName, ...updateData } = req.body as Partial<Player> & { responsibleName?: string };
    // Postgres trata '' como valor real (diferente de NULL) na coluna UNIQUE email — normaliza para
    // undefined quando vazio, senão dois jogadores sem e-mail colidiriam na constraint.
    if (updateData.email !== undefined && !updateData.email.trim()) {
      delete updateData.email;
    }

    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const isRequestingAdmin = requestingUser.role === 'admin';

    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    const existingPlayer = db.players[index];

    // 1. Permission Check: Admin can edit any, non-admin can only edit their own profile
    if (!isRequestingAdmin) {
      const isEditingSelf = requestingUser.playerId === id || requestingUser.athlete_id === id;
      if (!isEditingSelf) {
        return res.status(403).json({ error: 'Acesso Proibido: Você só tem permissão para editar sua própria ficha de atleta.' });
      }

    }

    const categoryChanged = updateData.category && updateData.category !== existingPlayer.category;

    const targetCategory = updateData.category !== undefined ? updateData.category : existingPlayer.category;
    const targetPrimaryPosition = updateData.primaryPosition !== undefined ? updateData.primaryPosition : existingPlayer.primaryPosition;

    const isTargetPayingMensalista = targetCategory === 'mensalista' && targetPrimaryPosition !== 'goleiro';
    const wasPayingMensalista = existingPlayer.category === 'mensalista' && existingPlayer.primaryPosition !== 'goleiro';

    const becamePayingMensalista = !wasPayingMensalista && isTargetPayingMensalista;

    if (becamePayingMensalista) {
      const activeMonthlyLimit = db.financeConfig?.maxMensalistas ?? db.recurrentConfig?.maxMensalistas ?? 12;
      const otherActivePayingMensalistas = db.players.filter(p => p.id !== existingPlayer.id && !p.deletedAt && p.category === 'mensalista' && p.primaryPosition !== 'goleiro').length;
      if (otherActivePayingMensalistas >= activeMonthlyLimit) {
        return res.status(400).json({
          error: `Não foi possível concluir a operação. O grupo já atingiu o limite configurado de mensalistas (${activeMonthlyLimit}/${activeMonthlyLimit}). Libere uma vaga ou altere o limite em Financeiro → Parâmetros.`
        });
      }
    }

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
        userEmail: existingPlayer.email || 'atleta@sistema.local',
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
        userEmail: existingPlayer.email || 'atleta@sistema.local',
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

    // Check if photo, team or dominant foot/number properties changed
    const photoChanged = updateData.photoOriginal !== undefined && updateData.photoOriginal !== existingPlayer.photoOriginal;
    const teamChanged = updateData.favoriteTeamId !== undefined && updateData.favoriteTeamId !== existingPlayer.favoriteTeamId;
    const numChanged = updateData.numeroFavorito !== undefined && updateData.numeroFavorito !== existingPlayer.numeroFavorito;
    const footChanged = updateData.peDominante !== undefined && updateData.peDominante !== existingPlayer.peDominante;
    const forceRegenerate = photoChanged || teamChanged || numChanged || footChanged || !existingPlayer.avatarCard;

    if (forceRegenerate) {
      updatedPlayer.avatarStatus = updatedPlayer.photoOriginal ? 'PENDENTE' : 'CONCLUÍDO';
      // Sem foto original não há como gerar/manter o avatar de IA — limpa para não continuar
      // exibindo um avatar antigo (a foto que o originou já não existe mais).
      if (!updatedPlayer.photoOriginal) {
        updatedPlayer.avatarEsportivo = null;
        updatedPlayer.avatarCard = null;
        updatedPlayer.avatarOriginal = null;
      } else if (photoChanged) {
        updatedPlayer.avatarOriginal = updatedPlayer.photoOriginal;
      }
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
          title: 'ðŸ’ª Lesão Encerrada!',
          message: `Ótimas notícias! O jogador ${existingPlayer.name} encerrou sua lesão e está novamente à disposição do grupo!`,
          targetUserId: 'all',
          actionUrl: 'players'
        });
      }
    }

    if (categoryChanged && updateData.category === 'mensalista') {
      notify(db, {
        category: 'jogador',
        title: '⭐ Promoção para Mensalista!',
        message: `O jogador ${existingPlayer.name} foi oficialmente promovido ao grupo de Mensalistas. Parabéns!`,
        targetUserId: existingPlayer.id,
        actionUrl: 'players'
      });
      notify(db, {
        category: 'jogador',
        title: '⭐ Novo Mensalista no Racha',
        message: `O jogador ${existingPlayer.name} agora é um Mensalista oficial do racha!`,
        targetUserId: 'all',
        actionUrl: 'players'
      });
    }

    db.players[index] = updatedPlayer;
    await writeDb(db);

    // Foto trocada/removida: a antiga não é mais referenciada por ninguém, apaga do Storage.
    // (Se a foto só mudou mas o avatar de IA vai ser regenerado, o background cuida do avatar antigo.)
    if (photoChanged && existingPlayer.photoOriginal && existingPlayer.photoOriginal !== updatedPlayer.photoOriginal) {
      deleteStorageFileByUrl(existingPlayer.photoOriginal).catch(err => {
        console.error('[Storage] Falha ao remover foto antiga:', err);
      });
    }
    // Foto removida por completo: também apaga o avatar de IA vinculado a ela, já zerado acima.
    if (!updatedPlayer.photoOriginal && existingPlayer.photoOriginal) {
      const oldCard = existingPlayer.avatarCard;
      const oldEsportivo = existingPlayer.avatarEsportivo;
      Promise.all([deleteStorageFileByUrl(oldCard), deleteStorageFileByUrl(oldEsportivo)]).catch(err => {
        console.error('[Storage] Falha ao remover avatar antigo:', err);
      });
    }

    // Trigger background generation asynchronously if forced
    if (forceRegenerate && updatedPlayer.photoOriginal) {
      setImmediate(() => {
        processarAvatarGamerBackground(updatedPlayer.id).catch(err => {
          console.error('[Avatar Background PUT] Fail:', err);
        });
      });
    }

    return res.json({ message: 'Jogador atualizado com sucesso!', player: updatedPlayer });
  });

  // Jogadores: Regenerar Avatar Inteligente avulso
  app.post('/api/players/:id/generate-avatar', async (req, res) => {
    const { id } = req.params;
    const db = await readDb();
    const index = db.players.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }
    const player = db.players[index];
    player.avatarStatus = 'PENDENTE';
    db.players[index] = player;
    await writeDb(db);
    
    setImmediate(() => {
      processarAvatarGamerBackground(player.id).catch(err => {
        console.error('[Avatar Background Manual] Fail:', err);
      });
    });

    return res.json({ 
      message: 'Gerção do Avatar Gamer iniciada em background!', 
      player
    });
  });

  app.post('/api/players/:id/restore-original-avatar', async (req, res) => {
    const requestingUser = await getAuthenticatedUser(req);
    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { id } = req.params;

    setImmediate(async () => {
      try {
        const db = await readDb();
        const index = db.players.findIndex((p) => p.id === id);
        if (index !== -1) {
          const player = db.players[index];
          const oldCard = player.avatarCard;
          const oldEsportivo = player.avatarEsportivo;

          player.avatarStatus = 'ERRO';
          player.avatarCard = null;
          player.avatarEsportivo = null;
          player.avatarOriginal = player.photoOriginal || player.avatarOriginal;
          await writeDb(db);

          await Promise.all([deleteStorageFileByUrl(oldCard), deleteStorageFileByUrl(oldEsportivo)]);
        }
      } catch (err) {
        console.error('[Restore Avatar] Falha na restauração em background:', err);
      }
    });

    return res.status(202).json({ message: 'Restauração iniciada. A foto original voltará a ser exibida em instantes.' });
  });

  // Jogadores: Soft Delete (Inativar/Excluir Logicamente)
  app.delete('/api/players/:id', async (req, res) => {
    const { id } = req.params;

    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso Proibido: Apenas administradores podem inativar ou remover atletas.' });
    }

    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = new Date().toISOString();
    db.players[index].updatedAt = new Date().toISOString();
    await writeDb(db);

    return res.json({ message: 'Jogador inativado com sucesso!', player: db.players[index] });
  });

  // Jogadores: Restaurar (Desfazer inativção)
  app.post('/api/players/:id/restore', async (req, res) => {
    const { id } = req.params;

    const db = await readDb();
    const requestingUser = await getAuthenticatedUser(req, db);

    if (!requestingUser) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso Proibido: Apenas administradores podem reativar atletas.' });
    }

    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = undefined;
    db.players[index].updatedAt = new Date().toISOString();
    await writeDb(db);

    return res.json({ message: 'Jogador reativado com sucesso!', player: db.players[index] });
  });

  // Buscar histórico de transição de categoria de um jogador
  app.get('/api/players/:id/transitions', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const transitions = (db.categoryTransitions || []).filter(t => t.playerId === id);
      return res.json(transitions.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar histórico de mudanças.' });
    }
  });

  // Alertas e recomendações de promoção para mensalistas
  app.get('/api/mensalista-alerts', async (req, res) => {
    try {
      const db = await readDb();
      const maxMensalistas = db.financeConfig?.maxMensalistas ?? db.recurrentConfig?.maxMensalistas ?? 12;
      
      // Active mensalistas are those who are not soft-deleted, whose category is 'mensalista', and whose primaryPosition is not 'goleiro'
      const activeMensalistas = db.players.filter(p => !p.deletedAt && p.category === 'mensalista' && p.primaryPosition !== 'goleiro');
      const activeCount = activeMensalistas.length;
      
      const isBelowLimit = activeCount < maxMensalistas;
      const availableVacancies = Math.max(0, maxMensalistas - activeCount);

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

  // Jogadores: Preparção do fluxograma futuro de Card IA
  app.post('/api/players/:id/generate-card', async (req, res) => {
    const { id } = req.params;

    const db = await readDb();
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
      message: 'Funcionalidade planejada para a próxima versão. Integrção com IA em andamento.',
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
  app.get('/api/evaluations/summary', async (req, res) => {
    try {
      const db = await readDb();
      const summaries = db.players.map(p => {
        return computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
      });
      return res.json(summaries);
    } catch (err) {
      console.error('[Error Summary Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao processar resumo de avalições.' });
    }
  });

  // players/:id/evaluations: specific ratings history, and current active evaluator's vote details
  app.get('/api/players/:id/evaluations', async (req, res) => {
    try {
      const { id } = req.params;
      const evaluatorUserId = req.query.evaluatorUserId as string;

      const db = await readDb();
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

      // Sort matches of these presences by date ascending to compute consecutive presences
      const confirmedMatches = playerPresences
        .map(p => {
          const matchObj = db.matches.find(m => m.id === p.matchId);
          return { status: p.status, date: matchObj ? matchObj.date : '' };
        })
        .filter(x => x.date !== '')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentConsecutive = 0;
      let maxConsecutive = 0;
      confirmedMatches.forEach(cm => {
        if (cm.status === 'confirmado') {
          currentConsecutive++;
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
          }
        } else {
          currentConsecutive = 0;
        }
      });
      const consecutivePresencesCount = maxConsecutive;

      const earlyConfirmationsCount = playerPresences.filter(p => {
        if (p.status !== 'confirmado') return false;
        if (!p.confirmedAt) return true; // default to true for legacy data
        const matchObj = db.matches.find(m => m.id === p.matchId);
        if (!matchObj) return true;
        const matchTime = matchObj.time || '21:30';
        const matchDateTimeStr = `${matchObj.date}T${matchTime}:00`;
        const deadlineDays = matchObj.confirmationDeadlineDaysBefore ?? 2;
        const deadlineTime = new Date(matchDateTimeStr).getTime() - (deadlineDays * 24 * 60 * 60 * 1000);
        return new Date(p.confirmedAt).getTime() <= deadlineTime;
      }).length;

      const completedMinimumVacanciesCount = playerPresences.filter(p => {
        if (p.status !== 'confirmado') return false;
        return p.manuallyApproved || p.confirmedAt !== undefined;
      }).length;

      const metricsEnriched = {
        ...metrics,
        presencesCount,
        absencesCount,
        lastParticipations,
        earlyConfirmationsCount,
        consecutivePresencesCount,
        completedMinimumVacanciesCount
      };

      return res.json({
        metrics: metricsEnriched,
        myEvaluation
      });
    } catch (err) {
      console.error('[Error Get Player Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao buscar faturamento ou avalições do jogador.' });
    }
  });

  // players/:id/evaluate: evaluates a player
  app.post('/api/players/:id/evaluate', async (req, res) => {
    try {
      const { id } = req.params;
      const { evaluatorUserId, ratings } = req.body;

      if (!evaluatorUserId || !ratings) {
        return res.status(400).json({ error: 'Identificção do avaliador e notas são obrigatórios.' });
      }

      const db = await readDb();
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

      let messageStr = 'Avalição registrada com sucesso de forma anônima!';

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

      await writeDb(db);
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

  app.get('/api/seasons', async (req, res) => {
    try {
      const db = await readDb();
      return res.json(db.seasons || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao listar temporadas.' });
    }
  });

  app.post('/api/seasons', async (req, res) => {
    try {
      const { name, year, startDate, endDate, active } = req.body;
      if (!name || !year || !startDate || !endDate) {
        return res.status(400).json({ error: 'Campos Nome, Ano, Data início e Fim são obrigatórios.' });
      }

      const db = await readDb();
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
      await writeDb(db);
      return res.status(201).json(newSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar temporada.' });
    }
  });

  app.put('/api/seasons/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, year, startDate, endDate, active } = req.body;

      const db = await readDb();
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
      await writeDb(db);
      return res.json(updatedSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar temporada.' });
    }
  });

  // ==========================================
  // --- MATCHES (PARTIDAS) API ENDPOINTS ---
  // ==========================================

  app.get('/api/matches', async (req, res) => {
    try {
      const db = await readDb();
      await syncMatchStatuses(db);
      const activeSeason = db.seasons.find((s) => s.active);
      
      const activePlayerIds = db.players.filter((p) => !p.deletedAt).map((p) => p.id);
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;

      const enrichedMatches = await Promise.all(db.matches.map(async (m) => {
        const computedList = await getComputedPresences(db, m.id);
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
      }));

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

  app.post('/api/matches', async (req, res) => {
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

      const db = await readDb();
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
        location: location || 'Arena Furacão',
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
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

      await writeDb(db);
      return res.status(201).json(newMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao criar partida.' });
    }
  });

  app.put('/api/matches/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { date, time, location, durationMinutes, status, confirmationDeadlineDaysBefore, clearPresences, responsibleId, responsibleName, responsibleEmail } = req.body;

      const db = await readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const previousStatus = db.matches[index].status;
      if (previousStatus === 'sorteada' && status && status !== 'sorteada' && status !== 'encerrada' && status !== 'cancelada') {
        return res.status(400).json({ error: 'Após o sorteio ser realizado, não é permitido reabrir confirmações (exceto para cancelamento).' });
      }

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

        // 1. Invalidar/remover o sorteio associado automatically upon match cancellation
        const drawExists = (db.draws || []).some((d: any) => d.matchId === id);
        if (drawExists) {
          db.draws = (db.draws || []).filter((d: any) => d.matchId !== id);
          
          if (!db.userAudits) db.userAudits = [];
          db.userAudits.push({
            id: 'audit-draw-invalidate-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString(),
            userId: responsibleId || 'system',
            userName: responsibleName || 'Administrador',
            userEmail: responsibleEmail || 'admin@sistema.local',
            action: 'Sorteio Invalidado',
            previousRole: '',
            newRole: '',
            previousStatus: '',
            newStatus: '',
            performedBy: responsibleName || 'Administrador',
            details: `Sorteio invalidado automaticamente em função do cancelamento da rodada do dia ${updatedMatch.date.split('-').reverse().join('/')}.`
          });
        }

        if (clearPresences) {
          const presencesToClear = (db.presences || []).filter((p: any) => p.matchId === id && (p.status === 'confirmado' || p.status === 'cancelado'));
          const numPresencesRemoved = presencesToClear.length;
          db.presences = (db.presences || []).filter((p: any) => p.matchId !== id);

          const alertsToClear = (db.reserveAlerts || []).filter((a: any) => a.matchId === id);
          const numAlertsRemoved = alertsToClear.length;
          db.reserveAlerts = (db.reserveAlerts || []).filter((a: any) => a.matchId !== id);

          if (!db.userAudits) db.userAudits = [];
          db.userAudits.push({
            id: 'audit-massclear-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString(),
            userId: responsibleId || 'system',
            userName: responsibleName || 'Atleta',
            userEmail: responsibleEmail || 'atleta@sistema.local',
            action: 'Limpeza em Massa de Confirmações',
            previousRole: '',
            newRole: '',
            previousStatus: '',
            newStatus: '',
            performedBy: responsibleName || 'Atleta',
            details: `Cancelamento de presença em massa efetuado juntamente com o cancelamento da partida do dia ${updatedMatch.date.split('-').reverse().join('/')} (${updatedMatch.location}). ${numPresencesRemoved} confirmações/respostas removidas e ${numAlertsRemoved} convocções de reservas revertidas.`
          });
        }
      }

      // RESUMPTION POLICY: Se o administrador confirma ou agenda a partida manualmente, reativamos a recorrência
      if ((updatedMatch.status === 'agendada' || updatedMatch.status === 'confirmando') && previousStatus === 'cancelada') {
        if (db.recurrentConfig) {
          db.recurrentConfig.active = true; // Retomar a recorrência normal
        }
        notify(db, {
          category: 'partida',
          title: 'ðŸ”„ Partida Reaberta',
          message: `A partida do dia ${updatedMatch.date.split('-').reverse().join('/')} foi reaberta por um administrador.`,
          actionUrl: 'calendar',
          matchId: updatedMatch.id
        });
      }

      await writeDb(db);
      return res.json(updatedMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar partida.' });
    }
  });

  app.post('/api/matches/:id/clear-presences', async (req, res) => {
    try {
      const { id } = req.params;
      const { responsibleId, responsibleName, responsibleEmail } = req.body;

      const db = await readDb();
      const matchIndex = db.matches.findIndex((m: any) => m.id === id);
      if (matchIndex === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const match = db.matches[matchIndex];
      if (match.status === 'sorteada' || match.status === 'encerrada') {
        return res.status(400).json({ error: 'Após o sorteio ser realizado, as presenças não podem ser limpas.' });
      }

      const presencesToClear = (db.presences || []).filter((p: any) => p.matchId === id && (p.status === 'confirmado' || p.status === 'cancelado'));
      const numPresencesRemoved = presencesToClear.length;
      db.presences = (db.presences || []).filter((p: any) => p.matchId !== id);

      const alertsToClear = (db.reserveAlerts || []).filter((a: any) => a.matchId === id);
      const numAlertsRemoved = alertsToClear.length;
      db.reserveAlerts = (db.reserveAlerts || []).filter((a: any) => a.matchId !== id);

      // Invalidate and delete any associated draw
      const hadDraw = (db.draws || []).some((d: any) => d.matchId === id);
      db.draws = (db.draws || []).filter((d: any) => d.matchId !== id);

      if (!db.userAudits) db.userAudits = [];
      db.userAudits.push({
        id: 'audit-massclear-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        userId: responsibleId || 'system',
        userName: responsibleName || 'Administrador',
        userEmail: responsibleEmail || 'admin@sistema.local',
        action: 'Limpeza em Massa de Confirmações',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: responsibleName || 'Atleta',
        details: `Limpeza em massa de confirmações efetuada para a partida do dia ${match.date.split('-').reverse().join('/')} (${match.location}). ${numPresencesRemoved} confirmações/respostas removidas e ${numAlertsRemoved} convocções de reservas revertidas.${hadDraw ? ' Sorteio associado invalidado automaticamente.' : ''}`
      });

      await writeDb(db);
      return res.json({ 
        message: 'Confirmações e convocções limpas de forma definitiva!', 
        numPresencesRemoved, 
        numAlertsRemoved,
        match: db.matches[matchIndex]
      });
    } catch (err) {
      console.error('[Clear Presences Error]', err);
      return res.status(500).json({ error: 'Erro ao limpar confirmações.' });
    }
  });

  app.post('/api/matches/:id/release-reserves', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const match = db.matches[index];
      if (match.status === 'sorteada' || match.status === 'encerrada') {
        return res.status(400).json({ error: 'Após o sorteio ser realizado, as reservas não podem ser liberadas.' });
      }
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
        details: `Convocção de reservas iniciada manualmente pelo administrador.`
      });

      await summonReservesForMatch(db, id, 99);
      await syncMatchStatuses(db);
      await writeDb(db);

      return res.json({ success: true, match });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao liberar reservas.' });
    }
  });

  app.post('/api/matches/:id/cancel-reserves', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const match = db.matches[index];
      if (match.status === 'sorteada' || match.status === 'encerrada') {
        return res.status(400).json({ error: 'Após o sorteio ser realizado, as reservas não podem ser ajustadas.' });
      }

      match.reservesReleased = false;
      match.reservesReleasedAt = undefined;

      if (match.status === 'aguardando_reservas') {
        match.status = 'confirmando';
      }

      if (db.reserveAlerts) {
        db.reserveAlerts = db.reserveAlerts.map((a: any) =>
          a.matchId === id && a.status === 'aguardando_resposta'
            ? { ...a, cleared: true }
            : a
        );
      }

      if (!db.deadlineAudits) db.deadlineAudits = [];
      db.deadlineAudits.push({
        id: 'da-' + match.id + '-cancel-' + Date.now(),
        matchId: match.id,
        matchDate: match.date,
        matchTime: match.time,
        releasedAt: new Date().toISOString(),
        auditType: 'manual_reserves_cancel',
        createdAt: new Date().toISOString(),
        details: `Convocção de reservas cancelada manualmente pelo administrador.`
      });

      await syncMatchStatuses(db);
      await writeDb(db);

      return res.json({ success: true, match });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erro ao cancelar convocação de reservas.' });
    }
  });

  app.post('/api/matches/bulk-delete', async (req, res) => {
    try {
      const { matchIds } = req.body;
      if (!Array.isArray(matchIds)) {
        return res.status(400).json({ error: 'matchIds deve ser um array.' });
      }

      const db = await readDb();
      const undeletable: string[] = [];
      const toDelete: string[] = [];

      for (const id of matchIds) {
        const hasDraws = (db.draws || []).some((d) => d.matchId === id);
        const hasResults = (db.results || []).some((r) => r.matchId === id);

        if (hasDraws || hasResults) {
          undeletable.push(id);
        } else {
          toDelete.push(id);
        }
      }

      if (toDelete.length === 0) {
        return res.status(400).json({ error: 'Nenhuma das partidas selecionadas pode ser excluídoa, pois possuem sorteio realizado ou resultados registrados.' });
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

      await writeDb(db);

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

  app.delete('/api/matches/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();

      const hasDraws = (db.draws || []).some((d) => d.matchId === id);
      const hasResults = (db.results || []).some((r) => r.matchId === id);

      if (hasDraws || hasResults) {
        const reasons = [];
        if (hasDraws) reasons.push('times sorteados/parciais');
        if (hasResults) reasons.push('placar/resultados registrados');
        return res.status(400).json({ 
          error: `Esta partida possui sorteio realizado ou resultados registrados (${reasons.join(', ')}) e não pode ser excluídoa.` 
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

      await writeDb(db);
      return res.json({ message: 'Partida excluídoa com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover partida.' });
    }
  });

  // ==========================================
  // --- RECURRENCE API ENDPOINTS & GENERATOR -
  // ==========================================

  app.get('/api/recurrent-config', async (req, res) => {
    try {
      const db = await readDb();
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao ler config de recorrência.' });
    }
  });

  app.post('/api/recurrent-config', async (req, res) => {
    try {
      const { dayOfWeek, time, location, durationMinutes, confirmationDeadlineDaysBefore, active, maxMensalistas } = req.body;

      const db = await readDb();
      db.recurrentConfig = {
        dayOfWeek: parseInt(dayOfWeek),
        time,
        location: location || 'Arena Furacão',
        durationMinutes: parseInt(durationMinutes),
        confirmationDeadlineDaysBefore: parseInt(confirmationDeadlineDaysBefore),
        active: active !== undefined ? !!active : true,
        maxMensalistas: maxMensalistas !== undefined ? parseInt(maxMensalistas) : (db.recurrentConfig?.maxMensalistas || 12)
      };

      await writeDb(db);
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar config de recorrência.' });
    }
  });

  app.post('/api/matches/generate-recurrent', async (req, res) => {
    try {
      const db = await readDb();
      const activeSeason = db.seasons.find((s) => s.active);

      if (!activeSeason) {
        return res.status(400).json({ error: 'Não há nenhuma temporada ativa para calcular recorrências.' });
      }

      const config = db.recurrentConfig;
      if (!config) {
        return res.status(400).json({ error: 'Configurção de recorrência inválida ou não configurada.' });
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

      await writeDb(db);
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

  app.get('/api/events', async (req, res) => {
    try {
      const { playerId } = req.query;
      const db = await readDb();
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

  app.post('/api/events', async (req, res) => {
    try {
      const { name, description, type, date, time, location, adultPrice, childPrice } = req.body;
      if (!name || !type || !date) {
        return res.status(400).json({ error: 'Nome, tipo e data são campos obrigatórios.' });
      }

      const db = await readDb();
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
        title: 'ðŸŽ‰ Novo Evento Criado',
        message: `O evento "${newEvent.name}" foi agendado para o dia ${newEvent.date.split('-').reverse().join('/')} às ${newEvent.time} na localidade ${newEvent.location}.`,
        actionUrl: 'mural',
        eventId: newEvent.id
      });

      await writeDb(db);

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
      const isGoalkeeper = player.primaryPosition === 'goleiro';
      const isMensalista = player.category === 'mensalista';

      let billAmount = 0;
      if (isChurrasco && (isGoalkeeper || isMensalista)) {
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

  app.put('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, type, date, time, location, adultPrice, childPrice, status } = req.body;

      const db = await readDb();
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

      await writeDb(db);
      return res.json(db.events[eventIndex]);
    } catch (err) {
      console.error('[Update Event]', err);
      return res.status(500).json({ error: 'Erro ao salvar alterções do evento.' });
    }
  });

  app.post('/api/events/:id/cancel', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      db.events[eventIndex].status = 'cancelado';
      // Mantenha cobranças que já foram pagas (histórico/movimentção), remova apenas as pendentes
      db.eventBills = (db.eventBills || []).filter((b: any) => b.eventId !== id || b.status === 'pago');

      notify(db, {
        category: 'evento',
        title: '❌ Evento Cancelado',
        message: `O evento "${db.events[eventIndex].name}" do dia ${db.events[eventIndex].date.split('-').reverse().join('/')} foi cancelado.`,
        actionUrl: 'mural',
        eventId: id
      });

      await writeDb(db);
      return res.json({ message: 'Evento cancelado e cobranças pendentes suspensas.', event: db.events[eventIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao cancelar o evento.' });
    }
  });

  app.delete('/api/events/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      const event = db.events[eventIndex];
      if (event.status !== 'cancelado') {
        return res.status(400).json({ error: 'Apenas eventos cancelados podem ser excluídos.' });
      }

      // Verifica se houve movimentção financeira (algum débito pago deste evento)
      const hasPaidBills = (db.eventBills || []).some((b: any) => b.eventId === id && b.status === 'pago');
      if (hasPaidBills) {
        return res.status(400).json({ error: 'Este evento possui movimentção financeira (débitos pagos) e não pode ser excluído.' });
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

      await writeDb(db);
      return res.json({ message: 'Evento excluído com sucesso.' });
    } catch (err) {
      console.error('[Delete Event]', err);
      return res.status(500).json({ error: 'Erro ao excluir o evento.' });
    }
  });

  app.post('/api/events/:id/end', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const eventIndex = (db.events || []).findIndex(e => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }

      db.events[eventIndex].status = 'encerrado';
      await writeDb(db);
      return res.json({ message: 'Evento encerrado com sucesso.', event: db.events[eventIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao encerrar o evento.' });
    }
  });

  app.get('/api/events/:id/participants', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);
      const userRole = requestingUser?.role;

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
          avatarEsportivo: player ? player.avatarEsportivo : '',
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

  app.post('/api/events/:id/confirm', async (req, res) => {
    try {
      const { id } = req.params;
      let { playerId, adultsCount, childrenCount } = req.body;

      if (!playerId || adultsCount === undefined || childrenCount === undefined) {
        return res.status(400).json({ error: 'playerId, adultsCount e childrenCount são obrigatórios.' });
      }

      const db = await readDb();
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
          await writeDb(db);

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
        await writeDb(db);
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
      const isGoalkeeper = player.primaryPosition === 'goleiro';
      const isMensalista = player.category === 'mensalista';

      let billAmount = 0;
      if (isChurrasco && (isGoalkeeper || isMensalista)) {
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

      await writeDb(db);
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

  app.post('/api/events/:id/pay', async (req, res) => {
    try {
      const { id } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({ error: 'playerId é obrigatório.' });
      }

      const db = await readDb();
      if (!db.eventBills) db.eventBills = [];

      const billIndex = db.eventBills.findIndex(b => b.eventId === id && b.playerId === playerId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Nenhuma cobrança registrada para este evento.' });
      }

      db.eventBills[billIndex].status = 'pago';
      db.eventBills[billIndex].paidAt = new Date().toISOString();

      await writeDb(db);
      return res.json({ message: 'Pagamento registrado com sucesso!', bill: db.eventBills[billIndex] });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao registrar pagamento.' });
    }
  });

  // ==========================================
  // --- PRESENCES (CONFIRMA‡ÕES DE RACHA) ---
  // ==========================================

  app.get('/api/matches/:matchId/presences', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();

      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const mergedList = await getComputedPresences(db, matchId);

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

  app.post('/api/matches/:matchId/presences/toggle', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerId, status, manuallyApproved } = req.body; // status: 'confirmado' | 'nao_confirmado' | 'cancelado'

      if (!playerId || !status) {
        return res.status(400).json({ error: 'playerId e status são obrigatórios.' });
      }

      const db = await readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não existe.' });
      }

      if (match.status === 'sorteada' || match.status === 'encerrada') {
        return res.status(400).json({ error: 'Após o sorteio estar completo, a lista de atletas confirmados está travada.' });
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
          await writeDb(db);

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

      if (status === 'confirmado' && player.category !== 'reserva' && isDeadlineExpired && !['confirmando', 'aguardando_reservas'].includes(match.status)) {
        return res.status(400).json({ error: 'Prazo limite para confirmação expirado. Mensalistas não podem mais confirmar.' });
      }

      if (status === 'confirmado') {
        const computedListBefore = await getComputedPresences(db, matchId);
        const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
        
        // Find if this player is already computed as confirmed
        const comp = computedListBefore.find((p) => p.playerId === effectivePlayerId);
        const isCurrentConfirmed = comp && comp.presenceStatus === 'confirmado';

        if (!isCurrentConfirmed) {
          const confirmedCount = computedListBefore.filter((p) => p.presenceStatus === 'confirmado').length;
          if (confirmedCount >= limit) {
            return res.status(400).json({ error: `Limite de ${limit} atletas atingido. O racha foi fechado automaticamente.` });
          }
        }
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

      // If returning to confirmed or pending, clear any active reserve alert for them
      if (status === 'confirmado' || status === 'nao_confirmado') {
        db.reserveAlerts = (db.reserveAlerts || []).map((a) => {
          if (a.matchId === matchId && a.cancelledPlayerId === effectivePlayerId) {
            return { ...a, cleared: true };
          }
          return a;
        });
      }

      // LOGIC: Se o jogador que cancelou a presença já estava CONFIRMADO
      if (previousStatus === 'confirmado' && status === 'cancelado') {
        notify(db, {
          category: 'partida',
          title: '👥 Vaga Aberta no Racha',
          message: `O cancelamento da presença de ${player.name} liberou uma vaga. Acompanhe a lista de reservas!`,
          targetUserId: 'all',
          actionUrl: 'calendar',
          matchId
        });
      }

      await syncMatchStatuses(db);
      await writeDb(db);
      return res.json({
        message: 'Presença updated with success!',
        alertCreated: null
      });
    } catch (err) {
      console.error('[Toggle Presence Error]', err);
      return res.status(500).json({ error: 'Erro ao atualizar confirmação de presença.' });
    }
  });

  app.post('/api/matches/:matchId/presences/bulk-toggle', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerIds, status } = req.body; // status: 'confirmado' | 'nao_confirmado' | 'cancelado'

      if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0 || !status) {
        return res.status(400).json({ error: 'playerIds (array) e status são obrigatórios.' });
      }

      const db = await readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não existe.' });
      }

      if (match.status === 'sorteada' || match.status === 'encerrada') {
        return res.status(400).json({ error: 'Após o sorteio estar completo, a lista de atletas confirmados está travada.' });
      }

      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;
      const matchDeadlineDays = match.confirmationDeadlineDaysBefore !== undefined ? match.confirmationDeadlineDaysBefore : deadlineDays;
      const { isDeadlineExpired } = getMatchDeadlineInfo(match, matchDeadlineDays);

      let count = 0;
      let alertsCreatedCount = 0;

      let playerIdsToProcess = playerIds;

      if (status === 'confirmado') {
        const computedListBefore = await getComputedPresences(db, matchId);
        const confirmedBeforeCount = computedListBefore.filter((p: any) => p.presenceStatus === 'confirmado').length;
        const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
        const vacanciesAvailable = Math.max(0, limit - confirmedBeforeCount);

        // Find which of the requested playerIds are not currently computed as confirmed
        const playersToConfirm = playerIds.filter(pid => {
          let resolvedPid = pid;
          let player = db.players.find((p) => p.id === pid);
          if (!player) {
            const mappedId = getPlayerIdForUser(db, pid);
            if (mappedId) {
              resolvedPid = mappedId;
            }
          }
          const comp = computedListBefore.find(c => c.playerId === resolvedPid);
          return !comp || comp.presenceStatus !== 'confirmado';
        });

        const amountToConfirm = Math.min(playersToConfirm.length, vacanciesAvailable);
        const playerIdsToActuallyConfirm = playersToConfirm.slice(0, amountToConfirm);

        // Keep any playerIds that are already confirmed
        const alreadyConfirmedIds = playerIds.filter(pid => {
          let resolvedPid = pid;
          let player = db.players.find((p) => p.id === pid);
          if (!player) {
            const mappedId = getPlayerIdForUser(db, pid);
            if (mappedId) {
              resolvedPid = mappedId;
            }
          }
          const comp = computedListBefore.find(c => c.playerId === resolvedPid);
          return comp && comp.presenceStatus === 'confirmado';
        });

        playerIdsToProcess = [...alreadyConfirmedIds, ...playerIdsToActuallyConfirm];
      }

      for (const idToToggle of playerIdsToProcess) {
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

        if (status === 'confirmado' && player.category !== 'reserva' && isDeadlineExpired && !['confirmando', 'aguardando_reservas'].includes(match.status)) {
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

        // If returning to confirmed or pending, clear any active reserve alert for them
        if (status === 'confirmado' || status === 'nao_confirmado') {
          db.reserveAlerts = (db.reserveAlerts || []).map((a) => {
            if (a.matchId === matchId && a.cancelledPlayerId === effectivePlayerId) {
              return { ...a, cleared: true };
            }
            return a;
          });
        }

        if (previousStatus === 'confirmado' && status === 'cancelado') {
          notify(db, {
            category: 'partida',
            title: '👥 Vaga Aberta no Racha',
            message: `O cancelamento da presença de ${player.name} liberou uma vaga. Acompanhe a lista de reservas!`,
            targetUserId: 'all',
            actionUrl: 'calendar',
            matchId
          });
        }
      }

      await syncMatchStatuses(db);
      await writeDb(db);
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
  app.get('/api/draws/history', async (req, res) => {
    try {
      const db = await readDb();
      return res.json(db.draws || []);
    } catch (err) {
      console.error('[Error getting draws history]:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico de sorteios.' });
    }
  });

  // Get active draw for a specific match
  app.get('/api/matches/:matchId/draw', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const draw = (db.draws || []).find((d) => d.matchId === matchId);
      if (!draw) {
        return res.json({ message: 'Nenhum sorteio registrado para esta partida.' });
      }
      return res.json(draw);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter sorteio.' });
    }
  });

   // Trigger a new smart draw for a specific match
   app.post('/api/matches/:matchId/draw', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { captainsConfigured, captains, isSharedGoalkeepers, responsibleName } = req.body;

      const db = await readDb();
      const match = db.matches.find(m => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      if (match.status === 'encerrada') {
        return res.status(400).json({ error: 'A partida está encerrada e não é permitido gerar novo sorteio ou executar novo re-sorteio.' });
      }
      if (match.status === 'cancelada') {
        return res.status(400).json({ error: 'A partida foi cancelada e não é permitido gerar novo sorteio ou executar novo re-sorteio.' });
      }

      // Check current redraw count limit
      const previousDraw = (db.draws || []).find(d => d.matchId === matchId);
      const redrawCount = previousDraw ? (previousDraw.redrawCount || 0) + 1 : 0;

      if (previousDraw && (previousDraw.redrawCount || 0) >= 2) {
        return res.status(400).json({ error: 'Limite de re-sorteios atingido (máximo de 2 re-sorteios por partida).' });
      }

      // Validate captain uniqueness if configured
      if (captainsConfigured && captains) {
        const capitaes = [
          captains.Azul,
          captains.Vermelho,
          captains.Verde
        ].filter(Boolean);

        if (new Set(capitaes).size !== capitaes.length) {
          return res.status(400).json({ error: "Um mesmo atleta não pode ser definido como capitão de mais de um time." });
        }
      }

      // Filter confirmed players (using getComputedPresences to accurately include only promoted reserves)
      const computedPresences = await getComputedPresences(db, matchId);
      const confirmedPlayerIds = computedPresences
        .filter(cp => cp.presenceStatus === 'confirmado')
        .map(cp => cp.playerId);
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
        captainsConfigured: !!captainsConfigured,
        redrawCount
      };

      // Write audit log entry for re-sort after previous generation
      if (redrawCount > 0) {
        db.userAudits = db.userAudits || [];
        db.userAudits.push({
          id: 'audit-redraw-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          userId: 'system',
          userName: 'Sistema de Sorteio',
          userEmail: 'sistema@sistema.local',
          action: `Re-sorteio de Times (Sequência: #${redrawCount} / 2)`,
          previousRole: '',
          newRole: '',
          previousStatus: '',
          newStatus: '',
          performedBy: responsibleName || 'Administrador',
          details: `Re-sorteio de times efetuado para a partida do dia ${match.date.split('-').reverse().join('/')} (${match.location}). Sequência do re-sorteio: ${redrawCount}/2.`
        });
      }

      // Remove previous draw for the same match if any
      db.draws = (db.draws || []).filter(d => d.matchId !== matchId);
      db.draws.push(newDraw);

      // Force instant match status sync to transition status to 'sorteada'
      await syncMatchStatuses(db);

      notify(db, {
        category: 'sorteio',
        title: 'ðŸŽ² Times Sorteados!',
        message: `O sorteio dos times da rodada do dia ${match.date.split('-').reverse().join('/')} foi realizado. Venha ver se ficou equilibrado!`,
        actionUrl: 'calendar',
        matchId
      });

      if (captainsConfigured) {
        notify(db, {
          category: 'sorteio',
          title: 'ðŸ‘‘ Capitães Definidos',
          message: `Os capitães da rodada do dia ${match.date.split('-').reverse().join('/')} foram eixos e escalados nos times.`,
          actionUrl: 'calendar',
          matchId
        });
      }

      await writeDb(db);
      return res.json(newDraw);
    } catch (err) {
      console.error('[Draw Generation Error]', err);
      return res.status(500).json({ error: 'Erro ao processar sorteio automático.' });
    }
  });

  // Manually update teams and recalculate overalls/metrics
  app.post('/api/draws/:drawId/update-manual', async (req, res) => {
    try {
      const { drawId } = req.params;
      const { teams } = req.body; // updated groups configurations: DrawTeam[]

      if (!teams || !Array.isArray(teams)) {
        return res.status(400).json({ error: 'Lista de times formatada é obrigatória.' });
      }

      const db = await readDb();
      const drawIndex = (db.draws || []).findIndex(d => d.id === drawId);
      if (drawIndex === -1) {
        return res.status(404).json({ error: 'Sorteio referenciado não foi encontrado.' });
      }

      const drawObj = db.draws[drawIndex];

      // Validate captains
      const capitaes = teams.map(t => t.captainPlayerId).filter(Boolean);
      if (new Set(capitaes).size !== capitaes.length) {
        return res.status(400).json({ error: "Um mesmo atleta não pode ser definido como capitão de mais de um time." });
      }

      if (drawObj.captainsConfigured) {
        // Ensure that each captain (if non-empty) is STILL inside their respective team's playerIds
        const captainsMatch = teams.every(t => {
          if (!t.captainPlayerId) return true;
          return t.playerIds.includes(t.captainPlayerId);
        });
        if (!captainsMatch) {
          return res.status(400).json({ error: "Um atleta marcado como capitão não pode ser movido para outro time enquanto mantiver a função de capitão." });
        }
      }

      // Recompute overalls for the modified groups
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      // Find goalkeepers
      const goalkeepers = db.players.filter(p => p.primaryPosition === 'goleiro' && !p.deletedAt);

      const sharedComputedPres = (drawObj.isSharedGoalkeepers && goalkeepers.length > 0)
        ? await getComputedPresences(db, drawObj.matchId)
        : null;

      const computedAllOveralls = teams.map(t => {
        let count = t.playerIds.length;
        if (count === 0) return 3.5;
        let sum = t.playerIds.reduce((s, pid) => s + (playerOveralls[pid] || 3.5), 0);

        if (drawObj.isSharedGoalkeepers && goalkeepers.length > 0 && sharedComputedPres) {
          // If shared, average gk rating is added to rating computation too
          const confGkIds = sharedComputedPres
            .filter(cp => cp.presenceStatus === 'confirmado')
            .map(cp => cp.playerId);
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

      await writeDb(db);

      return res.json(drawObj);
    } catch (err) {
      console.error('[Manual Draw Update Error]', err);
      return res.status(500).json({ error: 'Erro ao recalcular ajuste de times.' });
    }
  });

  // Lock and Record historical partner affinity stats on final approval/lock
  app.post('/api/draws/:drawId/confirm-lock', async (req, res) => {
    try {
      const { drawId } = req.params;
      const db = await readDb();

      const drawObj = (db.draws || []).find(d => d.id === drawId);
      if (!drawObj) {
        return res.status(404).json({ error: 'Sorteio não encontrado.' });
      }

      // Validate that captains configured in the draw do not have duplicates
      const drawCaptains = drawObj.teams.map(t => t.captainPlayerId).filter(Boolean);
      if (new Set(drawCaptains).size !== drawCaptains.length) {
        return res.status(400).json({ error: "Não foi possível consolidar o sorteio. Um mesmo atleta não pode ser definido como capitão de mais de um time. Ajuste a seleção de capitães e tente novamente." });
      }

      // Check that each captain belongs to their respective team
      const captainBelongsProblems = drawObj.teams.some(t => {
        return t.captainPlayerId && !t.playerIds.includes(t.captainPlayerId);
      });
      if (captainBelongsProblems) {
        return res.status(400).json({ error: "Não foi possível consolidar o sorteio. Cada capitão deve pertencer ao respectivo time no sorteio. Ajuste a seleção de capitães e tente novamente." });
      }

      // Mathematical consistency check for overalls (Rule 4)
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      const goalkeepers = db.players.filter(p => p.primaryPosition === 'goleiro' && !p.deletedAt);

      const sharedComputedPresCheck = (drawObj.isSharedGoalkeepers && goalkeepers.length > 0)
        ? await getComputedPresences(db, drawObj.matchId)
        : null;

      const computedAllOveralls = drawObj.teams.map(t => {
        let count = t.playerIds.length;
        if (count === 0) return 3.5;
        let sum = t.playerIds.reduce((s, pid) => s + (playerOveralls[pid] || 3.5), 0);

        if (drawObj.isSharedGoalkeepers && goalkeepers.length > 0 && sharedComputedPresCheck) {
          const confGkIds = sharedComputedPresCheck
            .filter(cp => cp.presenceStatus === 'confirmado')
            .map(cp => cp.playerId);
          const activeGks = goalkeepers.filter(g => confGkIds.includes(g.id));
          if (activeGks.length > 0) {
            const avgGkRating = activeGks.reduce((s, g) => s + (playerOveralls[g.id] || 3.5), 0) / activeGks.length;
            sum += avgGkRating;
            count += 1;
          }
        }

        return Math.round((sum / count) * 10) / 10;
      });

      const bOverallCalc = computedAllOveralls[0] || 3.5;
      const rOverallCalc = computedAllOveralls[1] || 3.5;
      const gOverallCalc = computedAllOveralls[2] || 3.5;

      const diffBlue = Math.abs(drawObj.overallBlue - bOverallCalc);
      const diffRed = Math.abs(drawObj.overallRed - rOverallCalc);
      const diffGreen = Math.abs(drawObj.overallGreen - gOverallCalc);

      if (diffBlue > 0.01 || diffRed > 0.01 || diffGreen > 0.01) {
        console.error('[Consolidation Error - Overalls Mismatch]', {
          stored: { blue: drawObj.overallBlue, red: drawObj.overallRed, green: drawObj.overallGreen },
          calculated: { blue: bOverallCalc, red: rOverallCalc, green: gOverallCalc }
        });
        return res.status(400).json({
          error: `Divergência técnica detectada! As médias calculadas para os times não condizem com os dados atuais dos atletas. Por favor realoque ou recalcule o sorteio para atualizar os ­índices técnicos antes da consolidação.`
        });
      }

      // Initialize collections if they don't exist
      db.duoAffinities = db.duoAffinities || [];
      db.trioAffinities = db.trioAffinities || [];

      // Check for duplicate recording protection
      if (drawObj.affinitiesRecorded === true) {
        return res.json({ 
          message: 'Relções de afinidades já haviam sido consolidadas anteriormente para esta partida.', 
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
        userEmail: 'sistema@sistema.local',
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
          loggedMessage: `Consolidção de Afinidades: ${totalDuosCount} duplas e ${totalTriosCount} trios registrados para a partida.`
        }
      });

      await writeDb(db);
      return res.json({ 
        message: 'Sorteio consolidado com sucesso! Afinidade de duplas e trios atualizada para novas partidas.',
        alreadyRecorded: false,
        duosCount: totalDuosCount,
        triosCount: totalTriosCount
      });
    } catch (err) {
      console.error('[Error Locking Draw]', err);
      return res.status(500).json({ error: 'Falha ao consolidar relções de afinidades.' });
    }
  });

  // ==========================================
  // --- MATCH RESULTS & STATISTICS ENDPONES ---
  // ==========================================

  // List all historic match results
  app.get('/api/results', async (req, res) => {
    try {
      const db = await readDb();
      return res.json(db.results || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultados.' });
    }
  });

  // Get a single result by matchId
  app.get('/api/results/:matchId', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const result = (db.results || []).find((r) => r.matchId === matchId);
      if (!result) {
        return res.status(404).json({ error: 'Nenhum resultado para esta partida.' });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultado.' });
    }
  });

  app.post('/api/admin/reengage-inactive', async (req, res) => {
    try {
      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ção.' });
      }

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const threshold = sixMonthsAgo.toISOString();

      const inactivePlayers = db.players.filter((p: any) => {
        if (p.status !== 'indisponivel' || !p.statusStartDate || !p.email) return false;
        return p.statusStartDate <= threshold;
      });

      const sent: string[] = [];
      const failed: string[] = [];

      for (const player of inactivePlayers) {
        try {
          const start = new Date(player.statusStartDate as string);
          const now = new Date();
          const diffMs = now.getTime() - start.getTime();
          const monthsInactive = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30)));

          const { subject, html } = reengageInactiveTemplate({
            userName: player.name,
            appName: APP_NAME,
            loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}`,
            monthsInactive,
          });

          await sendEmail(player.email, subject, html);
          sent.push(player.name);
        } catch (err) {
          console.error(`[Reengage] Falha ao enviar para ${player.name}:`, err);
          failed.push(player.name);
        }
      }

      return res.json({
        message: 'Reengajamento concluído.',
        totalInactive: inactivePlayers.length,
        sent: sent.length,
        failed: failed.length,
        sentNames: sent,
        failedNames: failed,
      });
    } catch (err) {
      console.error('[API POST /api/admin/reengage-inactive]', err);
      return res.status(500).json({ error: 'Erro ao executar reengajamento.' });
    }
  });

  app.post('/api/admin/send-welcome', async (req, res) => {
    try {
      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);
      if (!requestingUser || requestingUser.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ção.' });
      }

      const { userId } = req.body as { userId?: string };
      const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}`;

      const targets = userId
        ? db.users.filter(u => u.id === userId && u.status === 'approved')
        : db.users.filter(u => u.status === 'approved');

      const sent: string[] = [];
      const failed: string[] = [];

      for (const user of targets) {
        try {
          const matchedPlayer = (db.players || []).find((p: any) => p.athlete_id === user.id);
          const name = matchedPlayer?.name || user.name;
          const { subject, html } = welcomeTemplate({
            userName: name,
            appName: APP_NAME,
            loginUrl,
          });

          await sendEmail(user.email, subject, html);
          sent.push(name);
        } catch (err) {
          console.error(`[Welcome] Falha ao enviar para ${user.name}:`, err);
          failed.push(user.name);
        }
      }

      return res.json({
        message: userId ? 'E-mail de boas-vindas enviado para o usuário selecionado.' : 'E-mails de boas-vindas enviados para todos os usuários aprovados.',
        total: targets.length,
        sent: sent.length,
        failed: failed.length,
        sentNames: sent,
        failedNames: failed,
      });
    } catch (err) {
      console.error('[API POST /api/admin/send-welcome]', err);
      return res.status(500).json({ error: 'Erro ao enviar e-mails de boas-vindas.' });
    }
  });

  // Get computed tournament statistics and rankings
  app.get('/api/stats', async (req, res) => {
    try {
      const { seasonId } = req.query;
      const db = await readDb();
      
      const stats = computeStatsForSeason({
        players: db.players,
        matches: db.matches,
        presences: db.presences,
        results: db.results || [],
        seasonId: seasonId as string || null,
        evaluations: db.evaluations,
        evaluationHistory: db.evaluationHistory
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
  app.post('/api/matches/:matchId/release-evaluations', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const match = db.matches.find((m: any) => m.id === matchId);
      if (!match) return res.status(404).json({ error: 'Partida não encontrada.' });
      
      match.evaluationsReleased = true;
      await writeDb(db);
      
      return res.json({ message: 'Avalições liberadas com sucesso!', match });
    } catch (err) {
      console.error('[Error releasing evaluations]', err);
      return res.status(500).json({ error: 'Erro ao liberar avalições.' });
    }
  });

  app.post('/api/matches/:matchId/results', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { winsBlue, winsRed, winsGreen } = req.body;

      if (winsBlue === undefined || winsRed === undefined || winsGreen === undefined) {
        return res.status(400).json({ error: 'É necessário preencher as vitórias de todas as equipes.' });
      }

      const db = await readDb();
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

      // Transition match state to MATCH_FINISHED
      match.lifecycleState = 'MATCH_FINISHED';
      match.status = 'encerrada';
      match.evaluationsReleased = true;

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
          userEmail: 'sistema@sistema.local',
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
            loggedMessage: `Consolidção de Afinidades: ${totalDuosCount} duplas e ${totalTriosCount} trios registrados para a partida.`
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
          seasonId: match.seasonId,
          evaluations: db.evaluations,
          evaluationHistory: db.evaluationHistory
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
- **ðŸ”µ Time Azul:** ${winsBlue} vitórias
- **ðŸ”´ Time Vermelho:** ${winsRed} vitórias
- **ðŸŸ¢ Time Verde:** ${winsGreen} vitórias

### 🏆 Campeões da Rodada
- ${champions.length > 0 ? champions.map(c => `Time ${c}`).join(' & ') : 'Empate'}

### 👥 Escalação das Equipes
- **ðŸ”µ Time Azul:** ${blueTeamPlayers}
- **ðŸ”´ Time Vermelho:** ${redTeamPlayers}
- **ðŸŸ¢ Time Verde:** ${greenTeamPlayers}

### ðŸ“Š Estat­sticas do Momento
- **Melhor Dupla Atual:** ${melhorDupla}
- **Melhor Trio Atual:** ${melhorTrio}
- **L­der de Vitórias:** ${liderVitorias}
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
    ${APP_NAME.toUpperCase()} '¢ REGISTRO AUTOMÁTICO
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
          authorName: `${APP_NAME} Bot`,
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
        
        // --- ATOMIC TRANSITION SEQUENCE ---
        
        

        

        // Remove the automatic promotion to ARCHIVED here so the admin has to click the button
      } catch (autoErr) {
        console.error('[Error generating automatic mural post]', autoErr);
      }

      await writeDb(db);
      return res.json({ message: 'Resultado do racha gravado com sucesso!', result: newResult });
    } catch (err) {
      console.error('[Error posting match results]', err);
      return res.status(500).json({ error: 'Erro ao registrar resultado.' });
    }
  });

  // ==========================================
  // --- CONTROL OF RESERVES ALERTS & PRIO ---
  // ==========================================

  app.post('/api/matches/:matchId/archive', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const match = db.matches.find((m) => m.id === matchId);
      
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }
      
      match.lifecycleState = 'ARCHIVED';
      match.status = 'encerrada';

      // Clear the transient draw/operational states for this match
      db.draws = (db.draws || []).filter(d => d.matchId !== matchId);
      
      await writeDb(db);
      
      return res.json({ message: 'Rodada arquivada com sucesso!', match });
    } catch (err) {
      console.error('[Error archiving match]', err);
      return res.status(500).json({ error: 'Erro interno ao arquivar a rodada.' });
    }
  });

  app.get('/api/reserves/order', async (req, res) => {
    try {
      const db = await readDb();
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

  app.post('/api/reserves/order', async (req, res) => {
    try {
      const { reorderedIds } = req.body;
      if (!reorderedIds || !Array.isArray(reorderedIds)) {
        return res.status(400).json({ error: 'Lista de IDs reordenada é obrigatória.' });
      }

      const db = await readDb();
      db.reservesOrder = reorderedIds;
      await writeDb(db);

      return res.json({ message: 'Ordem da lista de reservas salva com sucesso!', order: db.reservesOrder });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar prioridade de reservas.' });
    }
  });

  app.get('/api/reserve-alerts', async (req, res) => {
    try {
      const db = await readDb();
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
          suggestedReservePlayerName: suggestedReserve ? suggestedReserve.name : 'Nenhum reserva dispon­vel'
        };
      });

      return res.json(enrichedAlerts);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter alertas de reservas.' });
    }
  });

  app.get('/api/matches/:matchId/reserve-queue', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      // 1. Get all active players of category 'reserva'
      const reserves = db.players.filter((p: any) => p.category === 'reserva' && !p.deletedAt && p.status === 'disponivel');

      // 2. Count "vagas abertas" (open spots)
      const computedList = await getComputedPresences(db, matchId);
      const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
      const confirmedCount = computedList.filter((p: any) => p.presenceStatus === 'confirmado').length;
      const vagasAbertas = Math.max(0, limit - confirmedCount);

      // 3. Get all active/uncleared alerts for this match
      const alerts = db.reserveAlerts || [];
      const matchAlerts = alerts.filter((a: any) => a.matchId === matchId);

      // Check if there is an active convocation (aguardando_resposta)
      const activeConvocationObj = matchAlerts.find((a: any) => a.status === 'aguardando_resposta' && !a.cleared);
      let activeConvocation = null;
      if (activeConvocationObj) {
        const pObj = db.players.find((p: any) => p.id === (activeConvocationObj.suggestedReservePlayerId || activeConvocationObj.playerId));
        activeConvocation = {
          id: activeConvocationObj.id,
          playerId: pObj ? pObj.id : (activeConvocationObj.suggestedReservePlayerId || activeConvocationObj.playerId),
          playerName: pObj ? pObj.name : 'Jogador Desconhecido',
          status: 'aguardando_resposta',
          createdAt: activeConvocationObj.createdAt
        };
      }

      // 4. Compute unique, sequential Waitlist (Fila de reservas)
      const currentReservesOrder = db.reservesOrder || [];
      const queue = reserves.filter((p: any) => {
        // Must not be confirmed
        const isConfirmed = computedList.some((c: any) => c.playerId === p.id && c.presenceStatus === 'confirmado');
        if (isConfirmed) return false;

        // Must not be currently under active convocacao
        if (activeConvocation && activeConvocation.playerId === p.id) return false;

        // Must not be recusado or dispensado for this match
        const hasHistoryState = matchAlerts.some((a: any) => 
          (a.suggestedReservePlayerId === p.id || a.playerId === p.id) && 
          (a.status === 'recusado' || a.status === 'dispensado') &&
          a.cleared
        );
        if (hasHistoryState) return false;

        return true;
      });

      // Sort the queue by priority order
      queue.sort((a: any, b: any) => {
        const idxA = currentReservesOrder.indexOf(a.id);
        const idxB = currentReservesOrder.indexOf(b.id);
        const orderA = idxA !== -1 ? idxA : 999999;
        const orderB = idxB !== -1 ? idxB : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

      const regularGksCount = db.players.filter((p: any) => p.category === 'mensalista' && !p.deletedAt && p.primaryPosition === 'goleiro').length;
      const cancelledGkCount = db.presences.filter((p: any) => p.matchId === matchId && p.status === 'cancelado' && db.players.find((pl: any) => pl.id === p.playerId)?.primaryPosition === 'goleiro').length;
      const activeGkCount = db.presences.filter((p: any) => p.matchId === matchId && p.status === 'confirmado' && db.players.find((pl: any) => pl.id === p.playerId)?.primaryPosition === 'goleiro').length +
        (db.reserveAlerts || []).filter((a: any) => a.matchId === matchId && a.status === 'aguardando_resposta' && !a.cleared && db.players.find((pl: any) => pl.id === (a.suggestedReservePlayerId || a.playerId))?.primaryPosition === 'goleiro').length;

      const isGoleiroMissing = cancelledGkCount > 0 && activeGkCount < regularGksCount;
      let finalQueue = [...queue];
      let noGkReservesAvailable = false;
      if (isGoleiroMissing) {
        const gkReserves = queue.filter((p: any) => p.primaryPosition === 'goleiro');
        const otherReserves = queue.filter((p: any) => p.primaryPosition !== 'goleiro');
        finalQueue = [...gkReserves, ...otherReserves];
        if (gkReserves.length === 0) {
          noGkReservesAvailable = true;
        }
      }

      // 5. Gather history of reserves for this match
      const history = matchAlerts.filter((a: any) => a.status === 'confirmado' || a.status === 'recusado' || a.status === 'dispensado').map((a: any) => {
        const pObj = db.players.find((p: any) => p.id === (a.suggestedReservePlayerId || a.playerId));
        return {
          id: a.id,
          playerId: pObj ? pObj.id : (a.suggestedReservePlayerId || a.playerId),
          playerName: pObj ? pObj.name : 'Jogador Desconhecido',
          status: a.status,
          updatedAt: a.createdAt || new Date().toISOString()
        };
      });

      return res.json({
        vagasAbertas,
        queue: finalQueue.map((p: any, index: number) => ({
          id: p.id,
          name: p.name,
          priority: index + 1,
          primaryPosition: p.primaryPosition,
          secondaryPositions: p.secondaryPositions || []
        })),
        activeConvocation,
        history,
        isGoleiroMissing,
        noGkReservesAvailable
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao processar fila de reservas.' });
    }
  });

  app.post('/api/matches/:matchId/reserve-queue/ignore-player', async (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerId } = req.body;
      if (!playerId) {
        return res.status(400).json({ error: 'ID do jogador é obrigatório.' });
      }

      const db = await readDb();
      if (!db.reserveAlerts) db.reserveAlerts = [];

      db.reserveAlerts.push({
        id: 'alert-ignore-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        matchId,
        suggestedReservePlayerId: playerId,
        playerId,
        status: 'dispensado',
        createdAt: new Date().toISOString(),
        cleared: true
      });

      await writeDb(db);
      return res.json({ message: 'Jogador ignorado com sucesso.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao ignorar jogador.' });
    }
  });

  app.post('/api/matches/:matchId/reserve-queue/summon-next', async (req, res) => {
    try {
      const { matchId } = req.params;
      const db = await readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const summoned = await summonReservesForMatch(db, matchId, 1);
      await writeDb(db);

      if (summoned.length === 0) {
        return res.status(400).json({ error: 'Não há reservas dispon­veis na fila.' });
      }

      return res.json({ message: `Convocção enviada com sucesso para ${summoned[0].name}!`, alert: summoned[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao realizar summons.' });
    }
  });

  app.post('/api/reserve-alerts/:id/respond', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'confirmado' | 'recusado' | 'dispensado'
      if (!status || !['confirmado', 'recusado', 'dispensado'].includes(status)) {
        return res.status(400).json({ error: 'Status de resposta inválido.' });
      }

      const db = await readDb();
      const alertIndex = db.reserveAlerts.findIndex((a: any) => a.id === id);
      if (alertIndex === -1) {
        return res.status(404).json({ error: 'Alerta não encontrado.' });
      }

      const alert = db.reserveAlerts[alertIndex];
      const matchId = alert.matchId;
      const pId = alert.suggestedReservePlayerId || alert.playerId;
      const player = db.players.find((p: any) => p.id === pId);

      // Mark alert solved
      db.reserveAlerts[alertIndex].status = status;
      db.reserveAlerts[alertIndex].cleared = true;

      // Update physical presence inside db.presences
      if (status === 'confirmado') {
        let presenceIndex = db.presences.findIndex((p: any) => p.matchId === matchId && p.playerId === pId);
        if (presenceIndex !== -1) {
          db.presences[presenceIndex].status = 'confirmado';
          db.presences[presenceIndex].confirmedAt = new Date().toISOString();
          db.presences[presenceIndex].manuallyApproved = true;
        } else {
          db.presences.push({
            id: 'pres-' + Date.now(),
            matchId,
            playerId: pId,
            status: 'confirmado',
            confirmedAt: new Date().toISOString(),
            manuallyApproved: true
          });
        }

        // Notify
        notify(db, {
          category: 'partida',
          title: 'âœ… Convocção Aceita',
          message: `O reserva ${player ? player.name : 'Jogador'} aceitou a convocação e confirmou presença!`,
          targetUserId: 'all',
          actionUrl: 'calendar',
          matchId
        });
      } else if (status === 'recusado') {
        let presenceIndex = db.presences.findIndex((p: any) => p.matchId === matchId && p.playerId === pId);
        if (presenceIndex !== -1) {
          db.presences[presenceIndex].status = 'cancelado';
          db.presences[presenceIndex].confirmedAt = undefined;
          db.presences[presenceIndex].manuallyApproved = false;
        } else {
          db.presences.push({
            id: 'pres-' + Date.now(),
            matchId,
            playerId: pId,
            status: 'cancelado',
            manuallyApproved: false
          });
        }

        // Notify
        notify(db, {
          category: 'partida',
          title: '❌ Convocção Recusada',
          message: `O reserva ${player ? player.name : 'Jogador'} recusou ou cancelou sua convocação para a partida.`,
          targetUserId: 'all',
          actionUrl: 'calendar',
          matchId
        });
      } else if (status === 'dispensado') {
        // Just audit/dispense
        notify(db, {
          category: 'partida',
          title: 'â„¹ï¸ Convocção Dispensada',
          message: `A convocação pendente para o reserva ${player ? player.name : 'Jogador'} foi dispensada pela administrção.`,
          targetUserId: 'all',
          actionUrl: 'calendar',
          matchId
        });
      }

      await syncMatchStatuses(db);
      await writeDb(db);

      if (status === 'recusado' || status === 'confirmado') {
        const matchForSummon = db.matches.find((m) => m.id === matchId);
        if (matchForSummon && matchForSummon.reservesReleased === true) {
          const computedAfter = await getComputedPresences(db, matchId);
          const limitAfter = matchForSummon.maxPlayers !== undefined && matchForSummon.maxPlayers !== null ? matchForSummon.maxPlayers : 15;
          const confirmedAfter = computedAfter.filter((p: any) => p.presenceStatus === 'confirmado').length;
          if (confirmedAfter < limitAfter) {
            await summonReservesForMatch(db, matchId, 1);
          }
        }
      }

      return res.json({ message: 'Resposta registrada com sucesso!', alert: db.reserveAlerts[alertIndex] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erro ao registrar resposta.' });
    }
  });

  app.post('/api/reserve-alerts/:id/clear', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();

      const alertIndex = db.reserveAlerts.findIndex((a) => a.id === id);
      if (alertIndex !== -1) {
        db.reserveAlerts[alertIndex].cleared = true;
        db.reserveAlerts[alertIndex].status = 'dispensado';
      }

      await writeDb(db);
      return res.json({ message: 'Alerta removido.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover alerta.' });
    }
  });

  app.post('/api/reserve-alerts/:id/summon', async (req, res) => {
    try {
      const { id } = req.params;
      const db = await readDb();

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

      const match = db.matches.find(m => m.id === matchId);
      if (match) {
        const computedListBefore = await getComputedPresences(db, matchId);
        const limit = match.maxPlayers !== undefined && match.maxPlayers !== null ? match.maxPlayers : 15;
        
        // Find if this player is already computed as confirmed
        const comp = computedListBefore.find((p) => p.playerId === reserveId);
        const isCurrentConfirmed = comp && comp.presenceStatus === 'confirmado';

        if (!isCurrentConfirmed) {
          const confirmedCount = computedListBefore.filter((p) => p.presenceStatus === 'confirmado').length;
          if (confirmedCount >= limit) {
             return res.status(400).json({ error: `Limite de ${limit} atletas já foi atingido.` });
          }
        }
      }

      let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === reserveId);
      if (presenceIndex !== -1) {
        db.presences[presenceIndex].status = 'confirmado';
        db.presences[presenceIndex].confirmedAt = new Date().toISOString();
        db.presences[presenceIndex].manuallyApproved = true;
      } else {
        db.presences.push({
          id: 'pres-' + Date.now(),
          matchId,
          playerId: reserveId,
          status: 'confirmado',
          confirmedAt: new Date().toISOString(),
          manuallyApproved: true
        });
      }

      // Marcar alerta como limpo
      db.reserveAlerts[alertIndex].cleared = true;
      db.reserveAlerts[alertIndex].status = 'confirmado';

      await syncMatchStatuses(db);
      await writeDb(db);
      return res.json({ message: 'Reserva convocado com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao processar convocação.' });
    }
  });

  // ==========================================
  // --- FINANCES (FINANCEIRO API ENDPOINTS) --
  // ==========================================

  app.get('/api/finances', async (req, res) => {
    try {
      const db = await readDb(); // readDb triggers automatic monthly billing generation!
      const user = await getAuthenticatedUser(req, db);

      const email = user ? user.email.toLowerCase().trim() : (req.query.email as string || '').toLowerCase().trim();
      // Sem usuário autenticado, o role nunca é elevado a partir de query params do cliente.
      const role = user ? user.role : 'jogador';

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
        const player = (db.players || []).find(p => p && p.email && typeof p.email === 'string' && p.email.toLowerCase().trim() === email);
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

  app.get('/api/finances/config', async (req, res) => {
    try {
      const db = await readDb();
      const financeConfig = db.financeConfig || {
        monthlyFee: 100,
        chargeDateRule: 'primeiro_jogo',
        history: [{ date: '2026-01-01', amount: 100 }],
        effectiveDate: '2026-01-01'
      };

      if (!financeConfig.effectiveDate) {
        const history = Array.isArray(financeConfig.history) ? [...financeConfig.history] : [];
        history.sort((a, b) => a.date.localeCompare(b.date));
        financeConfig.effectiveDate = history[history.length - 1]?.date || new Date().toISOString().split('T')[0];
      }

      return res.json(financeConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter configuração financeira.' });
    }
  });

  app.post('/api/finances/config', async (req, res) => {
    try {
      const { monthlyFee, chargeDateRule, effectiveDate, maxMensalistas } = req.body;
      const db = await readDb();

      if (!db.financeConfig) {
        db.financeConfig = {
          monthlyFee: 100,
          chargeDateRule: 'primeiro_jogo',
          history: [{ date: '2026-01-01', amount: 100 }],
          maxMensalistas: 12
        };
      }

      const prevFee = db.financeConfig.monthlyFee;
      const newFee = parseFloat(monthlyFee);

      if (isNaN(newFee) || newFee <= 0) {
        return res.status(400).json({ error: 'Valor da mensalidade inválido.' });
      }

      if (chargeDateRule !== 'primeiro_jogo' && chargeDateRule !== 'ultimo_jogo') {
        return res.status(400).json({ error: 'Forma de gerção inválida. Escolha entre Primeiro Jogo ou Último Jogo.' });
      }

      const parsedMax = parseInt(maxMensalistas);
      if (isNaN(parsedMax) || parsedMax <= 0) {
        return res.status(400).json({ error: 'A quantidade máxima de mensalistas deve ser um número inteiro maior que zero.' });
      }

      const targetEffectiveDate = effectiveDate || new Date().toISOString().split('T')[0];

      db.financeConfig.maxMensalistas = parsedMax;
      db.financeConfig.monthlyFee = newFee;
      db.financeConfig.chargeDateRule = chargeDateRule;
      db.financeConfig.effectiveDate = targetEffectiveDate;

      // Sempre garante que o histórico reflita a data de vigência correta com o valor atual
      const existingIdx = db.financeConfig.history.findIndex(h => h.date === targetEffectiveDate);
      if (existingIdx >= 0) {
        db.financeConfig.history[existingIdx].amount = newFee;
      } else {
        db.financeConfig.history.push({ date: targetEffectiveDate, amount: newFee });
      }

      if (!db.recurrentConfig) {
        db.recurrentConfig = {
          dayOfWeek: 6,
          time: '21:30',
          location: 'Arena Furacão',
          durationMinutes: 60,
          confirmationDeadlineDaysBefore: 2,
          active: true,
          maxMensalistas: parsedMax
        };
      } else {
        db.recurrentConfig.maxMensalistas = parsedMax;
      }

      db.userAudits = db.userAudits || [];
      db.userAudits.push({
        id: 'audit-fin-change-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        userId: 'admin',
        userName: 'Administrador',
        userEmail: '[EMAIL]',
        action: 'Alteração de Par¢metros Financeiros',
        previousRole: '',
        newRole: '',
        previousStatus: '',
        newStatus: '',
        performedBy: 'Administrador',
        details: `Par¢metros financeiros alterados pelo administrador. Nova mensalidade: R$ ${newFee} (Vigência: ${targetEffectiveDate}). Nova regra de gerção: ${chargeDateRule === 'primeiro_jogo' ? 'Primeiro Jogo do Mês' : 'Último Jogo do Mês'}. Limite de mensalistas: ${parsedMax}.`
      });

      await writeDb(db);
      return res.json(db.financeConfig);
    } catch (err) {
      console.error('[API POST /api/finances/config]', err);
      return res.status(500).json({ error: 'Erro ao salvar configuração financeira.' });
    }
  });

  app.post('/api/finances/pay', async (req, res) => {
    try {
      const { billId, email, role } = req.body;
      if (!billId) {
        return res.status(400).json({ error: 'Código da cobrança é obrigatório.' });
      }

      const db = await readDb();
      const billIndex = db.bills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      const bill = db.bills[billIndex];

      // If not admin, check if the bill belongs to this player (by email)
      const player = db.players.find(p => p.id === bill.playerId);
      const isMyBill = player && player.email && typeof player.email === 'string' && player.email.toLowerCase().trim() === (email || '').toLowerCase().trim();

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
        title: 'âœ… Pagamento Confirmado',
        message: `O pagamento da mensalidade de R$ ${bill.amount.toFixed(2)} (${bill.competence}) para o jogador ${targetPlayerName} foi confirmado.`,
        targetUserId: bill.playerId,
        actionUrl: 'finance'
      });

      await writeDb(db);
      return res.json({ message: 'Pagamento confirmado com sucesso!', bill: db.bills[billIndex] });
    } catch (err) {
      console.error('[API POST pay]', err);
      return res.status(500).json({ error: 'Erro ao processar confirmação de pagamento.' });
    }
  });

  app.post('/api/finances/toggle', async (req, res) => {
    try {
      const { billId, email, role } = req.body;
      if (!billId) {
        return res.status(400).json({ error: 'Código da cobrança é obrigatório.' });
      }

      const db = await readDb();
      const billIndex = db.bills.findIndex(b => b.id === billId);
      if (billIndex === -1) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      const bill = db.bills[billIndex];
      const player = db.players.find(p => p.id === bill.playerId);
      const isMyBill = player && player.email && typeof player.email === 'string' && player.email.toLowerCase().trim() === (email || '').toLowerCase().trim();
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
          title: 'âœ… Pagamento Confirmado',
          message: `O pagamento da mensalidade de R$ ${bill.amount.toFixed(2)} (${bill.competence}) para o jogador ${targetPlayerName} foi confirmado.`,
          targetUserId: bill.playerId,
          actionUrl: 'finance'
        });
      }

      await writeDb(db);
      return res.json({ message: 'Status de cobrança alterado com sucesso!', bill: db.bills[billIndex] });
    } catch (err) {
      console.error('[API POST Toggle Bill]', err);
      return res.status(500).json({ error: 'Erro ao alterar status da cobrança.' });
    }
  });

  app.post('/api/finances/bills', async (req, res) => {
    try {
      const { playerId, competence, amount, dueDate, status } = req.body;
      if (!playerId || !competence || !amount || !dueDate) {
        return res.status(400).json({ error: 'Todos os campos (Jogador, Competência, Valor e Vencimento) são obrigatórios.' });
      }

      const db = await readDb();
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
        title: 'ðŸ’° Nova Cobrança Gerada',
        message: `Foi gerada uma cobrança manual no valor de R$ ${newBill.amount.toFixed(2)} (${newBill.competence}) para o jogador ${targetPlayerName}.`,
        targetUserId: newBill.playerId,
        actionUrl: 'finance'
      });

      await writeDb(db);
      return res.status(201).json({ message: 'Cobrança manual criada com sucesso!', bill: newBill });
    } catch (err) {
      console.error('[API POST bill manual]', err);
      return res.status(500).json({ error: 'Erro ao criar cobrança manual.' });
    }
  });

  app.delete('/api/finances/bills/:billId', async (req, res) => {
    try {
      const { billId } = req.params;
      const db = await readDb();
      const exists = db.bills.some(b => b.id === billId);
      if (!exists) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      db.bills = db.bills.filter(b => b.id !== billId);
      // Clean payments
      db.payments = db.payments.filter(p => p.billId !== billId);

      await writeDb(db);
      return res.json({ message: 'Cobrança removida com sucesso.' });
    } catch (err) {
      console.error('[API DELETE bill]', err);
      return res.status(500).json({ error: 'Erro ao remover cobrança.' });
    }
  });

  app.post('/api/finances/trigger-sync', async (req, res) => {
    try {
      const db = await readDb();
      const beforeCount = db.bills.length;
      generateMonthlyBillingsIfNeeded(db);
      await writeDb(db);
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
  app.get('/api/mural/categories', async (req, res) => {
    try {
      const db = await readDb();
      res.json(db.muralCategories || []);
    } catch (err) {
      console.error('[API GET Categories]', err);
      res.status(500).json({ error: 'Erro ao listar categorias.' });
    }
  });

  // Get association options (matches and events)
  app.get('/api/mural/associations', async (req, res) => {
    try {
      const db = await readDb();
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
      res.status(500).json({ error: 'Erro ao carregar associções.' });
    }
  });

  // Get mural statistics
  app.get('/api/mural/stats', async (req, res) => {
    try {
      const db = await readDb();
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
  app.get('/api/mural/posts', async (req, res) => {
    try {
      const db = await readDb();
      const posts = [...(db.muralPosts || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(posts);
    } catch (err) {
      console.error('[API GET Mural Posts]', err);
      res.status(500).json({ error: 'Erro ao carregar publicções.' });
    }
  });

  // Get public mural posts (Página Pública Simplificada)
  app.get('/api/mural/public-posts', async (req, res) => {
    try {
      const db = await readDb();
      const posts = (db.muralPosts || [])
        .filter(p => p.showOnLanding === true)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(posts);
    } catch (err) {
      console.error('[API GET Public Mural Posts]', err);
      res.status(500).json({ error: 'Erro ao carregar mural público.' });
    }
  });

  // Get public app config (nome do sistema, configurável por instalação via APP_NAME)
  app.get('/api/public/app-config', (req, res) => {
    res.json({ appName: APP_NAME });
  });

  // Health check: usado pelo Render (Health Check Path) para reiniciar o serviço
  // automaticamente se a conexão com o Supabase cair, não só se o processo Node está de pé.
  app.get('/api/public/health', async (req, res) => {
    try {
      const { error } = await getSupabaseClient().from('users').select('id').limit(1);
      if (error) throw error;
      return res.json({ status: 'ok' });
    } catch (err) {
      console.error('[API GET /api/public/health]', err);
      return res.status(503).json({ status: 'error', error: 'Falha ao conectar ao banco de dados.' });
    }
  });

  // Get public Next Match status
  app.get('/api/public/next-match', async (req, res) => {
    try {
      const db = await readDb();
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
      res.status(500).json({ error: 'Erro ao obter informções do próximo racha.' });
    }
  });

  // Upload endpoint with validation
  app.post('/api/mural/upload', async (req, res) => {
    try {
      const requestingUser = await getAuthenticatedUser(req);
      if (!requestingUser) {
        return res.status(401).json({ error: 'Não autenticado.' });
      }

      const { filename, fileData, size } = req.body;

      if (!filename || !fileData) {
        return res.status(400).json({ error: 'Os campos filename e fileData são obrigatórios.' });
      }

      const base64Data = fileData.replace(/^data:([A-Za-z0-9-+\/]+);base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Valida o tipo real do arquivo pelos magic bytes, não pela extensão/mimetype declarado pelo cliente.
      const detectedType = await fileTypeFromBuffer(buffer);
      const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const allowedVideoMimes = ['video/mp4', 'video/quicktime'];

      const isImage = !!detectedType && allowedImageMimes.includes(detectedType.mime);
      const isVideo = !!detectedType && allowedVideoMimes.includes(detectedType.mime);

      if (!isImage && !isVideo) {
        return res.status(400).json({ error: 'Formato de arquivo inválido. Use JPG, JPEG, PNG, WEBP para fotos ou MP4, MOV para v­deos.' });
      }

      // Tamanho real do buffer decodificado, não o valor que o próprio cliente informou.
      const fileSize = buffer.length;
      if (isImage && fileSize > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'A foto excede o limite permitido de 10 MB.' });
      }
      if (isVideo && fileSize > 200 * 1024 * 1024) {
        return res.status(400).json({ error: 'O v­deo excede o limite permitido de 200 MB.' });
      }

      const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-');
      const uniqueFilename = `${Date.now()}-${sanitizedFilename}`;

      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from('Uploads')
        .upload(uniqueFilename, buffer, { contentType: detectedType!.mime });

      if (uploadError) {
        console.error('[Upload Supabase Storage - Mural]', uploadError);
        return res.status(500).json({ error: 'Falha ao enviar arquivo para o armazenamento.' });
      }

      const { data: publicUrlData } = supabase.storage.from('Uploads').getPublicUrl(uniqueFilename);

      return res.json({
        url: publicUrlData.publicUrl,
        filename: uniqueFilename,
        mediaType: isImage ? 'image' : 'video'
      });
    } catch (err) {
      console.error('[API POST Mural Upload]', err);
      res.status(500).json({ error: 'Falha interna ao processar upload.' });
    }
  });

  // Add a new post
  app.post('/api/mural/posts', async (req, res) => {
    try {
      const { 
        title, 
        description, 
        mediaUrl, 
        mediaType, 
        fileSize, 
        category, 
        matchId, 
        eventId, 
        authorId, 
        authorName, 
        authorRole, 
        eventDate, 
        thumbnailUrl, 
        mediumUrl, 
        showOnLanding, 
        isHighlighted,
        order,
        startDate,
        expirationDate,
        priority,
        isArchived,
        isDeleted
      } = req.body;

      const isComm = ['regra', 'aviso', 'comunicado'].includes(category);
      if (!title || (!isComm && !mediaUrl) || !category || !authorId) {
        return res.status(400).json({ error: 'T­tulo, categoria e autor são obrigatórios.' });
      }

      const db = await readDb();
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
        mediaUrl: mediaUrl || '',
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
        thumbnailUrl: thumbnailUrl || mediaUrl || '',
        mediumUrl: mediumUrl || mediaUrl || '',
        eventDate: defaultEventDate,
        origin: 'manual' as const,
        
        // Communication Center parameters
        order: order !== undefined ? Number(order) : undefined,
        startDate: startDate || undefined,
        expirationDate: expirationDate || undefined,
        priority: priority || undefined,
        isArchived: isArchived === true,
        isDeleted: isDeleted === true
      };

      if (!db.muralPosts) db.muralPosts = [];
db.muralPosts.push(newPost);

      await writeDb(db);
      res.status(201).json(newPost);
    } catch (err) {
      console.error('[API POST Mural Post]', err);
      res.status(500).json({ error: 'Erro ao criar publicção.' });
    }
  });

  // Edit title/description
  app.put('/api/mural/posts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        eventDate,
        showOnLanding,
        isHighlighted,
        category,
        order,
        startDate,
        expirationDate,
        priority,
        isArchived,
        isDeleted,
        matchId
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'O t­tulo é obrigatório.' });
      }

      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicção não encontrada.' });
      }

      const post = db.muralPosts[postIndex];

      const isAdmin = requestingUser?.role === 'admin';
      const isAuthor = requestingUser != null && post.authorId === requestingUser.id;

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Apenas o autor ou o administrador pode editar esta publicção.' });
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
        eventDate: eventDate || post.eventDate || post.createdAt.split('T')[0],
        category: category || post.category,
        matchId: matchId !== undefined ? matchId : post.matchId,
        order: order !== undefined ? Number(order) : post.order,
        startDate: startDate !== undefined ? startDate : post.startDate,
        expirationDate: expirationDate !== undefined ? expirationDate : post.expirationDate,
        priority: priority !== undefined ? priority : post.priority,
        isArchived: isArchived !== undefined ? isArchived === true : post.isArchived,
        isDeleted: isDeleted !== undefined ? isDeleted === true : post.isDeleted
      };

      await writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API PUT Mural Post]', err);
      res.status(500).json({ error: 'Erro ao editar publicção.' });
    }
  });

  // Delete publication (Admin only) - Performs soft delete
  app.delete('/api/mural/posts/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);
      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicção não encontrada.' });
      }

      const post = db.muralPosts[postIndex];

      // Exclusão is strictly administrative as outlined in specifications
      const isAdmin = requestingUser?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem excluir publicções do Mural.' });
      }

      // Perform soft delete
      post.isDeleted = true;
      post.updatedAt = new Date().toISOString();

      await writeDb(db);

      const pathsToDelete = [
        extractStoragePath(post.mediaUrl),
        extractStoragePath(post.thumbnailUrl),
        extractStoragePath(post.mediumUrl)
      ].filter((p): p is string => p !== null);

      if (pathsToDelete.length > 0) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.storage.from('Uploads').remove(pathsToDelete);
        if (error) {
          console.error('[Storage] Falha ao remover arquivos do post excluído:', error.message);
        }
      }

      res.json({ message: 'Publicção excluídoa com sucesso (Soft Delete).' });
    } catch (err) {
      console.error('[API DELETE Mural Post]', err);
      res.status(500).json({ error: 'Erro ao excluir publicção.' });
    }
  });

  // Highlight/toggle Destacar no Mural (Admin only - Max 3 automatic rollover)
  app.post('/api/mural/posts/:id/highlight', async (req, res) => {
    try {
      const { id } = req.params;

      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);

      const isAdmin = requestingUser?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem gerenciar os destaques do mural.' });
      }

      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicção não encontrada.' });
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

      await writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API POST Highlight Mural]', err);
      res.status(500).json({ error: 'Erro ao gerenciar destaque do mural.' });
    }
  });

  // Highlight/toggle Destacar na Tela Inicial (Admin only - No Limit)
  app.post('/api/mural/posts/:id/toggle-landing', async (req, res) => {
    try {
      const { id } = req.params;

      const db = await readDb();
      const requestingUser = await getAuthenticatedUser(req, db);

      const isAdmin = requestingUser?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas Administradores podem gerenciar destaque na tela inicial.' });
      }

      if (!db.muralPosts) db.muralPosts = [];

      const postIndex = db.muralPosts.findIndex(p => p.id === id);
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Publicção não encontrada.' });
      }

      const post = db.muralPosts[postIndex];
      const newShowOnLanding = !post.showOnLanding;

      db.muralPosts[postIndex] = {
        ...post,
        showOnLanding: newShowOnLanding,
        updatedAt: new Date().toISOString()
      };

      await writeDb(db);
      res.json(db.muralPosts[postIndex]);
    } catch (err) {
      console.error('[API POST Toggle Landing]', err);
      res.status(500).json({ error: 'Erro ao gerenciar destaque da tela inicial.' });
    }
  });

  // ==========================================
  // --- UNIFIED NOTIFICATION CENTER APIs -----
  // ==========================================

  app.get('/api/notifications', async (req, res) => {
    try {
      const { userId, email } = req.query as { userId?: string; email?: string };
      const db = await readDb();

      // Ensure data syncing happens in real time (such as upcoming match deadlines)
      syncDynamicNotifications(db);
      await writeDb(db);

      let targetUserId = userId;
      // If only email is provided, we can resolve the playerId
      if (!targetUserId && email) {
        const resolvedPlayer = (db.players || []).find(p => p && p.email && typeof p.email === 'string' && p.email.toLowerCase().trim() === email.toLowerCase().trim());
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

  app.post('/api/notifications/mark-read', async (req, res) => {
    try {
      const { id, ids } = req.body as { id?: string; ids?: string[] };
      const db = await readDb();

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

      await writeDb(db);
      return res.json({ message: `${updatedCount} notificações marcadas como lidas com sucesso.` });
    } catch (err) {
      console.error('[API POST mark-read]', err);
      return res.status(500).json({ error: 'Erro ao marcar notificações como lidas.' });
    }
  });

  app.post('/api/notifications/mark-all-read', async (req, res) => {
    try {
      const { userId, email } = req.body as { userId?: string; email?: string };
      const db = await readDb();

      if (!db.notifications) db.notifications = [];

      let targetUserId = userId;
      if (!targetUserId && email) {
        const resolvedPlayer = (db.players || []).find(p => p && p.email && typeof p.email === 'string' && p.email.toLowerCase().trim() === email.toLowerCase().trim());
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

      await writeDb(db);
      return res.json({ message: `Todas as ${count} notificações pendentes foram marcadas como lidas.` });
    } catch (err) {
      console.error('[API POST mark-all-read]', err);
      return res.status(500).json({ error: 'Erro ao marcar todas as notificações como lidas.' });
    }
  });

  app.get('/api/notifications/preferences', async (req, res) => {
    try {
      const { userId } = req.query as { userId?: string };
      const db = await readDb();

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
      return res.status(500).json({ error: 'Erro ao obter configurções de notificção.' });
    }
  });

  app.post('/api/notifications/preferences', async (req, res) => {
    try {
      const { userId, preferences } = req.body as { userId: string; preferences: any };
      if (!userId || !preferences) {
        return res.status(400).json({ error: 'Id do usuário e configurções são obrigatórios.' });
      }

      const db = await readDb();
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

      await writeDb(db);
      return res.json({ message: 'Configurções de notificção atualizadas com sucesso.', preferences: updatedPref });
    } catch (err) {
      console.error('[API POST preferences]', err);
      return res.status(500).json({ error: 'Erro ao salvar preferências de notificção.' });
    }
  });

  // Watchdog: libera avatares presos em PROCESSANDO há mais de 10 minutos
  const AVATAR_STUCK_THRESHOLD_MS = 10 * 60 * 1000;
  setInterval(async () => {
    try {
      const db = await readDb();
      const now = Date.now();
      let changed = false;
      for (const player of db.players) {
        if (player.avatarStatus === 'PROCESSANDO' && player.updatedAt) {
          const updatedAt = new Date(player.updatedAt).getTime();
          if (!Number.isFinite(updatedAt)) continue;
          if (now - updatedAt > AVATAR_STUCK_THRESHOLD_MS) {
            const [oldCard, oldEsportivo] = [player.avatarCard, player.avatarEsportivo];
            player.avatarStatus = 'ERRO';
            player.avatarCard = null;
            player.avatarEsportivo = null;
            changed = true;
            console.warn(`[Avatar Watchdog] ${player.name} estava preso em PROCESSANDO. Liberando para ERRO e limpando arquivos.`);
            await Promise.all([deleteStorageFileByUrl(oldCard), deleteStorageFileByUrl(oldEsportivo)]);
          }
        }
      }
      if (changed) await writeDb(db);
    } catch (err) {
      console.error('[Avatar Watchdog] Falha ao verificar avatares presos:', err);
    }
  }, 60 * 1000);

  // --- Vite Dev Server Middleware / Static Client serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      // Os arquivos em assets/ têm hash de conteúdo no nome (Vite) — seguro cachear por 1 ano.
      // O index.html não tem hash e referencia esses arquivos, então precisa ficar sempre fresco.
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.get('*', async (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });

    }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ${APP_NAME} running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
