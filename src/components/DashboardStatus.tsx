import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, PresenceStatus, CATEGORY_LABELS, POSITION_LABELS, Player, FAVORITE_TEAMS } from '../types';
import { getAchievementsForPlayer, getMostRecentAchievement } from '../utils/achievements';
import { getRoundStatus } from '../utils/roundStatus';
import { 
  Calendar, MapPin, Clock, Trophy, AlertCircle, ArrowUpRight, Check, 
  Users, Users2, Shield, Sparkles, X, ChevronDown, ChevronUp, BellRing,
  CheckCircle2, AlertTriangle, ArrowDownAZ, VolumeX, Flame, Gift, Compass, Settings,
  Baby, User as UserIcon, Share2, Crown, PlusCircle, Lock, Play, Send, Archive, RefreshCw, Camera, XCircle,
  Eye, EyeOff, Star
} from 'lucide-react';
import { SportsCard, SportsButton, SportsBadge, SportsHeading, SportsContainer } from './UI';
import PlayerEvaluationModal from './PlayerEvaluationModal';

const getAbbreviation = (pos: string) => {
  switch (pos) {
    case 'goleiro': return 'GK';
    case 'zagueiro': return 'ZAG';
    case 'meio_campo': return 'MEI';
    case 'volante': return 'VOL';
    case 'atacante': return 'ATA';
    default: return pos.toUpperCase().slice(0, 3);
  }
};

function computeTacticalAssignments(playersList: Player[]): Record<string, { position: string; isAdapted: boolean }> {
  const positions = ['goleiro', 'zagueiro', 'meio_campo', 'volante', 'atacante'];
  const bestAssignment: Record<string, string> = {};
  let bestScore = -Infinity;

  function backtrack(playerIndex: number, currentAssigned: Record<string, string>, usedPositionsCount: Record<string, number>) {
    if (playerIndex === playersList.length) {
      let score = 0;
      const uniquePositions = new Set<string>();

      for (const p of playersList) {
        const assigned = currentAssigned[p.id];
        uniquePositions.add(assigned);

        if (assigned === p.primaryPosition) {
          score += 10;
        } else if (p.secondaryPositions && p.secondaryPositions.includes(assigned as any)) {
          score += 6;
        } else if (assigned === 'goleiro') {
          score -= 50;
        } else {
          score += 1;
        }
      }

      score += uniquePositions.size * 5;

      if (score > bestScore) {
        bestScore = score;
        for (const p of playersList) {
          bestAssignment[p.id] = currentAssigned[p.id];
        }
      }
      return;
    }

    const player = playersList[playerIndex];
    let candidatePositions = [...positions];
    if (player.primaryPosition !== 'goleiro' && (!player.secondaryPositions || !player.secondaryPositions.includes('goleiro'))) {
      candidatePositions = candidatePositions.filter(pos => pos !== 'goleiro');
    }

    for (const pos of candidatePositions) {
      currentAssigned[player.id] = pos;
      usedPositionsCount[pos] = (usedPositionsCount[pos] || 0) + 1;

      backtrack(playerIndex + 1, currentAssigned, usedPositionsCount);

      usedPositionsCount[pos]--;
      delete currentAssigned[player.id];
    }
  }

  if (playersList.length > 0) {
    backtrack(0, {}, {});
  }

  const result: Record<string, { position: string; isAdapted: boolean }> = {};
  for (const p of playersList) {
    const pos = bestAssignment[p.id] || p.primaryPosition;
    result[p.id] = {
      position: pos,
      isAdapted: pos !== p.primaryPosition
    };
  }
  return result;
}

interface DashboardStatusProps {
  currentUser: User;
  onNavigateToPlayers: () => void;
  onNavigateToApprovals?: () => void;
  onNavigateToFinances?: () => void;
  pendingApprovalsCount: number;
  simulatedState: number | null;
  setSimulatedState: (state: number | null) => void;
}

export default function DashboardStatus({
  currentUser,
  onNavigateToPlayers,
  onNavigateToApprovals,
  onNavigateToFinances,
  pendingApprovalsCount,
  simulatedState,
  setSimulatedState
}: DashboardStatusProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'auxiliar';
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [presences, setPresences] = useState<any[]>([]);
  const [reserveAlerts, setReserveAlerts] = useState<any[]>([]);
  const [reserveQueue, setReserveQueue] = useState<{
    vagasAbertas: number;
    queue: { id: string; name: string; priority: number; primaryPosition?: string }[];
    activeConvocation: {
      id: string;
      playerId: string;
      playerName: string;
      status: string;
      createdAt: string;
    } | null;
    history: { id: string; playerId: string; playerName: string; status: string; updatedAt: string }[];
    isGoleiroMissing?: boolean;
    noGkReservesAvailable?: boolean;
  } | null>(null);
  const [myPresence, setMyPresence] = useState<string>('nao_confirmado');
  const [resolvedPlayerId, setResolvedPlayerId] = useState<string | null>(currentUser.playerId || null);
  const [currentUserCategory, setCurrentUserCategory] = useState<string>('reserva');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isHoveredHighlight, setIsHoveredHighlight] = useState(false);
  const [showPresenceListDetail, setShowPresenceListDetail] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [rosterFilter, setRosterFilter] = useState<'todos' | 'confirmados' | 'pendentes' | 'cancelados'>('todos');
  const [isRosterBlockCollapsed, setIsRosterBlockCollapsed] = useState(false);

  // Journey Simulator (Sprint 6) states
  const [evaluatedRatings, setEvaluatedRatings] = useState<Record<string, number>>({});

  // Admin Operational states
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [matchDraw, setMatchDraw] = useState<any>(null);
  const [priorityReserves, setPriorityReserves] = useState<any[]>([]);
  const [loadingReserves, setLoadingReserves] = useState(false);
  const [showReserveSuggestions, setShowReserveSuggestions] = useState(false);

  // Assistente de Vinculação states
  const [unlinkedUserToResolve, setUnlinkedUserToResolve] = useState<any | null>(null);
  const [selectedManualPlayerId, setSelectedManualPlayerId] = useState<string>('');
  const [ignoredUserIds, setIgnoredUserIds] = useState<string[]>([]);
  
  // Results inputs for inline past match registrations
  const [winsBlueInput, setWinsBlueInput] = useState<string>('0');
  const [winsRedInput, setWinsRedInput] = useState<string>('0');
  const [winsGreenInput, setWinsGreenInput] = useState<string>('0');
  const [showDashboardPlacarModal, setShowDashboardPlacarModal] = useState(false);
  const [evaluatingPlayer, setEvaluatingPlayer] = useState<Player | null>(null);

  // Financial Stats
  const [finData, setFinData] = useState<any>(null);

  // Analytical Racha States
  const [stats, setStats] = useState<any>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [latestResult, setLatestResult] = useState<any>(null);
  const [nextMatchResult, setNextMatchResult] = useState<any>(null);

  // Active Events States
  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [tempEventAdults, setTempEventAdults] = useState<Record<string, number>>({});
  const [tempEventChildren, setTempEventChildren] = useState<Record<string, number>>({});
  const [isSavingEventRsvp, setIsSavingEventRsvp] = useState<Record<string, boolean>>({});
  const [highlightPost, setHighlightPost] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    onConfirm: () => {}
  });

  // Confirmed event participants details states
  const [eventParticipantsMap, setEventParticipantsMap] = useState<Record<string, any[]>>({});
  const [loadingParticipantsMap, setLoadingParticipantsMap] = useState<Record<string, boolean>>({});
  const [expandedParticipantsMap, setExpandedParticipantsMap] = useState<Record<string, boolean>>({});

  // Admin control center state variables
  const [evaluationsReleased, setEvaluationsReleased] = useState(false);
  const [showCreateRoundForm, setShowCreateRoundForm] = useState(false);
  const [newRoundDate, setNewRoundDate] = useState('');
  const [newRoundTime, setNewRoundTime] = useState('21:30');
  const [newRoundLocation, setNewRoundLocation] = useState('Arena Furacão');
  const [newRoundMaxPlayers, setNewRoundMaxPlayers] = useState('15');

  useEffect(() => {
    if (nextMatch?.id) {
      setEvaluationsReleased(nextMatch.evaluationsReleased === true || localStorage.getItem('evaluations_released_' + nextMatch.id) === 'true');
    } else {
      setEvaluationsReleased(false);
    }
  }, [nextMatch?.id, nextMatch?.evaluationsReleased]);

  const handleCloseConfirmations = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fechada' })
      });
      if (!res.ok) throw new Error('Falha ao fechar confirmações.');
      setSuccessMsg('Lista de presença fechada com sucesso!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fechar confirmações.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDraw = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainsConfigured: false,
          captains: {},
          isSharedGoalkeepers: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar sorteio automático.');
      setSuccessMsg('Times balanceados com inteligência!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar sorteio.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockDrawFromHome = async () => {
    if (!matchDraw) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/draws/${matchDraw.id}/confirm-lock`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao consolidar sorteio.');
      setSuccessMsg('Sorteio consolidado com sucesso! Afinidade de parcerias acumulada.');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consolidar sorteio.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoundDate) {
      setErrorMsg('Data é obrigatória.');
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newRoundDate,
          time: newRoundTime,
          location: newRoundLocation,
          maxPlayers: parseInt(newRoundMaxPlayers)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao criar rodada.');
      setSuccessMsg('Nova rodada criada com sucesso!');
      setShowCreateRoundForm(false);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar rodada.');
    } finally {
      setActionLoading(false);
    }
  };

  // Load next match, presences, and alerts
  const loadDashboardData = async () => {
    try {
      setErrorMsg('');
      
      // Fetch upcoming events
      try {
        const eventsRes = await fetch(`/api/events?playerId=${currentUser.id}`);
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          // Filter to only display 'agendado' or 'confirmando' (active) events
          const upcoming = eventsData.filter((evt: any) => evt.status === 'confirmando' || evt.status === 'agendado');
          setActiveEvents(upcoming);

          // Pre-populate interactive presence counters
          const eaMap: Record<string, number> = {};
          const ecMap: Record<string, number> = {};
          upcoming.forEach((evt: any) => {
            if (evt.myParticipant) {
              eaMap[evt.id] = evt.myParticipant.adultsCount;
              ecMap[evt.id] = evt.myParticipant.childrenCount;
            } else {
              eaMap[evt.id] = 0;
              ecMap[evt.id] = 0;
            }
          });
          setTempEventAdults(eaMap);
          setTempEventChildren(ecMap);
        }
      } catch (err) {
        console.error('Falha ao ler eventos no dashboard:', err);
      }

      const matchRes = await fetch('/api/matches');
      if (!matchRes.ok) throw new Error('Falha ao listar partidas.');
      const matches = await matchRes.json();
      setAllMatches(matches || []);

      if (matches && matches.length > 0) {
        // Find most recent scheduled or active match (closest to today)
        const dToday = new Date();
        const dOffset = dToday.getTimezoneOffset();
        const dLocalTodayStr = new Date(dToday.getTime() - (dOffset * 60 * 1000)).toISOString().split('T')[0];

        const activeMatches = matches.filter((m: any) => {
          if (m.lifecycleState === 'ARCHIVED' || m.lifecycleState === 'MATCH_FINISHED') return false;
          if (m.status === 'cancelada') {
            return m.date >= dLocalTodayStr;
          }
          return ['agendada', 'confirmando', 'aguardando_reservas', 'fechada', 'sorteada'].includes(m.status);
        });
        // Since matches is sorted by date ascending, the first active match is the closest to today chronologically
        let targetMatch = activeMatches.length > 0 ? activeMatches[0] : null;
        
        if (!targetMatch) {
          // Fallback to the latest match overall, if it is 'encerrada'
          const endedMatches = matches.filter((m: any) => m.status === 'encerrada');
          if (endedMatches.length > 0) {
            targetMatch = endedMatches[endedMatches.length - 1];
          }
        }
        
        setNextMatch(targetMatch);

        // Fetch draw details if match exists (unconditionally, to verify if there's any active draw)
        if (targetMatch) {
          try {
            const drawRes = await fetch(`/api/matches/${targetMatch.id}/draw`);
            if (drawRes.ok) {
              const drawDetails = await drawRes.json();
              setMatchDraw(drawDetails);
            } else {
              setMatchDraw(null);
            }
          } catch (err) {
            console.error('Falha ao ler sorteio no dashboard:', err);
            setMatchDraw(null);
          }

          // Fetch the results for this targetMatch specifically
          try {
            const resRes = await fetch('/api/results');
            if (resRes.ok) {
              const resData = await resRes.json();
              const found = resData.find((r: any) => r.matchId === targetMatch.id);
              setNextMatchResult(found || null);
            } else {
              setNextMatchResult(null);
            }
          } catch (resErr) {
            console.error('Falha ao ler resultados no dashboard:', resErr);
            setNextMatchResult(null);
          }
        } else {
          setMatchDraw(null);
          setNextMatchResult(null);
        }

        // Fetch presences and reserve queue for this match if there's an active targetMatch
        if (targetMatch) {
          try {
            const queueRes = await fetch(`/api/matches/${targetMatch.id}/reserve-queue`);
            if (queueRes.ok) {
              const qData = await queueRes.json();
              setReserveQueue(qData);
            } else {
              setReserveQueue(null);
            }
          } catch (qErr) {
            console.error('Falha ao ler fila de reservas:', qErr);
            setReserveQueue(null);
          }

          const presRes = await fetch(`/api/matches/${targetMatch.id}/presences`);
          if (presRes.ok) {
            const presData = await presRes.json();
            setPresences(presData.presences || []);
            
            // Audit athlete link 
            let linkedAthleteCategory = 'reserva';
            let linkedPlayerId = currentUser.playerId || null;
            try {
              const playersRes = await fetch('/api/players');
              if (playersRes.ok) {
                const playersList = await playersRes.json();
                setPlayers(playersList || []);
                const matchingPlayer = playersList.find((p: any) => {
                  if (currentUser.playerId && p.id === currentUser.playerId) return true;
                  if (p.email && currentUser.email && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) return true;
                  return false;
                });
                if (matchingPlayer) {
                  // If the user matches an active athlete profile
                  linkedAthleteCategory = matchingPlayer.category; // e.g. 'mensalista'
                  linkedPlayerId = matchingPlayer.id;
                } else {
                  // If they are an administrator with NO linked athlete profile, default to 'mensalista' to let them interact as non-reserva
                  if (currentUser.role === 'admin' || currentUser.role === 'auxiliar') {
                    linkedAthleteCategory = 'mensalista';
                  }
                }
              }
            } catch (pErr) {
              console.error('Erro ao verificar vinculo de atleta:', pErr);
            }

            setResolvedPlayerId(linkedPlayerId);
            setCurrentUserCategory(linkedAthleteCategory);

            // Find current user's presence
            const myPresRecord = (presData.presences || []).find((pr: any) => {
              if (linkedPlayerId && pr.playerId === linkedPlayerId) {
                return true;
              }
              if (pr.email && currentUser.email && pr.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
                return true;
              }
              if (pr.playerId === currentUser.id) {
                return true;
              }
              return false;
            });
            if (myPresRecord) {
              setMyPresence(myPresRecord.presenceStatus);
            } else {
              setMyPresence('nao_confirmado');
            }
          }
        } else {
          // No next match active - default state
          setPresences([]);
          setMyPresence('nao_confirmado');
          
          let linkedAthleteCategory = 'reserva';
          let linkedPlayerId = currentUser.playerId || null;
          try {
            const playersRes = await fetch('/api/players');
            if (playersRes.ok) {
              const playersList = await playersRes.json();
              setPlayers(playersList || []);
              const matchingPlayer = playersList.find((p: any) => {
                if (currentUser.playerId && p.id === currentUser.playerId) return true;
                if (p.email && currentUser.email && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) return true;
                return false;
              });
              if (matchingPlayer) {
                linkedAthleteCategory = matchingPlayer.category;
                linkedPlayerId = matchingPlayer.id;
              } else {
                if (currentUser.role === 'admin' || currentUser.role === 'auxiliar') {
                  linkedAthleteCategory = 'mensalista';
                }
              }
            }
          } catch (pErr) {
            console.error('Erro ao verificar vinculo de atleta:', pErr);
          }

          setResolvedPlayerId(linkedPlayerId);
          setCurrentUserCategory(linkedAthleteCategory);
        }
      } else {
        setNextMatch(null);
      }

      // Fetch pending reserve alerts for administrators
      if (currentUser.role === 'admin' || currentUser.role === 'auxiliar') {
        const alertsRes = await fetch('/api/reserve-alerts');
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          setReserveAlerts(alertsData || []);
        }

        try {
          const uRes = await fetch('/api/users');
          if (uRes.ok) {
            const allUsers = await uRes.json();
            setAllUsersList(allUsers || []);
            setPendingUsers(allUsers.filter((u: any) => u.status === 'pending') || []);
          }
        } catch (uErr) {
          console.error('Falha ao ler cadastros pendentes:', uErr);
        }
      }

      // Fetch stats
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch player summaries (OVR)
      try {
        const sumRes = await fetch('/api/evaluations/summary');
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setSummaries(sumData || []);
        }
      } catch (sumErr) {
        console.error('Falha ao ler resumos de avaliacoes:', sumErr);
      }

      // Fetch latest result
      const resultsRes = await fetch('/api/results');
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        if (resultsData && resultsData.length > 0) {
          // The last result is the most recent
          setLatestResult(resultsData[resultsData.length - 1]);
        }
      }

      // Fetch financial details
      try {
        const finRes = await fetch(`/api/finances?email=${encodeURIComponent(currentUser.email)}&role=${currentUser.role}`);
        if (finRes.ok) {
          const finData = await finRes.json();
          setFinData(finData);
        }
      } catch (err) {
        console.error('Falha ao ler financas no dashboard:', err);
      }

      // Fetch Mural Highlight
      try {
        const muralRes = await fetch('/api/mural/posts');
        if (muralRes.ok) {
          const muralPosts = await muralRes.json();
          const hl = muralPosts.find((p: any) => p.isHighlighted);
          setHighlightPost(hl || null);
        }
      } catch (err) {
        console.error('Falha ao ler destaque do mural:', err);
      }

      // Fetch Latest Notifications
      try {
        const notifRes = await fetch(`/api/notifications?userId=${currentUser.id}&email=${currentUser.email}`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifications(notifData.notifications || []);
        }
      } catch (err) {
        console.error('Falha ao sincronizar notificações no dashboard:', err);
      }
    } catch (err) {
      console.error('Erro ao ler racha:', err);
      setErrorMsg('Não foi possível carregar as informações do racha atual.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser.id]);

  useEffect(() => {
    if (nextMatch?.status === 'aguardando_reservas') {
      fetchReservesOrder();
    }
  }, [nextMatch?.id, nextMatch?.status]);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        setErrorMsg('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Helper to change event counter values on dashboard
  const changeEventRsvpCount = (eventId: string, isAdult: boolean, increment: boolean) => {
    if (isAdult) {
      const current = tempEventAdults[eventId] || 0;
      const next = increment ? current + 1 : Math.max(0, current - 1);
      setTempEventAdults(prev => ({ ...prev, [eventId]: next }));
    } else {
      const current = tempEventChildren[eventId] || 0;
      const next = increment ? current + 1 : Math.max(0, current - 1);
      setTempEventChildren(prev => ({ ...prev, [eventId]: next }));
    }
  };

  // Helper to save event RSVP from dashboard
  const handleSaveEventRsvp = async (eventId: string) => {
    setIsSavingEventRsvp(prev => ({ ...prev, [eventId]: true }));
    setErrorMsg('');
    setSuccessMsg('');

    const adults = tempEventAdults[eventId] || 0;
    const children = tempEventChildren[eventId] || 0;

    try {
      const res = await fetch(`/api/events/${eventId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentUser.id,
          adultsCount: adults,
          childrenCount: children
        })
      });

      if (res.ok) {
        setSuccessMsg('Presença no evento atualizada com sucesso!');
        await loadDashboardData();
        refreshParticipantsList(eventId);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao registrar sua presença no evento.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão.');
    } finally {
      setIsSavingEventRsvp(prev => ({ ...prev, [eventId]: false }));
    }
  };

  // Helper to cancel/remove event RSVP from dashboard
  const handleCancelEventRsvp = (eventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Presença',
      message: 'Tem certeza que deseja cancelar sua presença neste evento? Isso removerá seus acompanhantes e cobranças associadas.',
      confirmText: 'Confirmar Cancelamento',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSavingEventRsvp(prev => ({ ...prev, [eventId]: true }));
        setErrorMsg('');
        setSuccessMsg('');

        try {
          const res = await fetch(`/api/events/${eventId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: currentUser.id,
              adultsCount: 0,
              childrenCount: 0
            })
          });

          if (res.ok) {
            setSuccessMsg('Sua presença foi cancelada com sucesso!');
            await loadDashboardData();
            refreshParticipantsList(eventId);
          } else {
            const data = await res.json();
            setErrorMsg(data.error || 'Erro ao cancelar sua presença.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Erro de conexão.');
        } finally {
          setIsSavingEventRsvp(prev => ({ ...prev, [eventId]: false }));
        }
      }
    });
  };

  // Toggle participants list with lazy loading
  const toggleParticipantsList = async (eventId: string) => {
    const isExpanded = !!expandedParticipantsMap[eventId];
    setExpandedParticipantsMap(prev => ({ ...prev, [eventId]: !isExpanded }));

    if (!isExpanded && !eventParticipantsMap[eventId]) {
      setLoadingParticipantsMap(prev => ({ ...prev, [eventId]: true }));
      try {
        const res = await fetch(`/api/events/${eventId}/participants?userRole=${currentUser.role}`);
        if (res.ok) {
          const data = await res.json();
          setEventParticipantsMap(prev => ({ ...prev, [eventId]: data }));
        }
      } catch (err) {
        console.error('Erro ao buscar participantes do evento:', err);
      } finally {
        setLoadingParticipantsMap(prev => ({ ...prev, [eventId]: false }));
      }
    }
  };

  // Re-fetch list dynamically on RSVP updates
  const refreshParticipantsList = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/participants?userRole=${currentUser.role}`);
      if (res.ok) {
        const data = await res.json();
        setEventParticipantsMap(prev => ({ ...prev, [eventId]: data }));
      }
    } catch (err) {
      console.error('Erro ao atualizar participantes do evento:', err);
    }
  };

  // Share confirmed event participants list on WhatsApp
  const handleShareConfirmedList = async (evt: any) => {
    let list = eventParticipantsMap[evt.id];
    if (!list) {
      setLoadingParticipantsMap(prev => ({ ...prev, [evt.id]: true }));
      try {
        const res = await fetch(`/api/events/${evt.id}/participants?userRole=${currentUser.role}`);
        if (res.ok) {
          list = await res.json();
          setEventParticipantsMap(prev => ({ ...prev, [evt.id]: list }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingParticipantsMap(prev => ({ ...prev, [evt.id]: false }));
      }
    }

    if (!list || list.length === 0) {
      alert('Nenhum participante confirmado para gerar a lista de compartilhamento.');
      return;
    }

    // Sort: Alphabetically since everyone here has confirmed
    const sortedList = [...list].sort((a, b) => a.playerName.localeCompare(b.playerName));

    const totalPessoas = sortedList.reduce((sum, p) => sum + p.adultsCount + p.childrenCount, 0);

    const confirmedLines = sortedList.map(p => {
      const parts: string[] = [];
      const companionAdults = p.adultsCount - 1;
      if (companionAdults > 0) {
        parts.push(`+${companionAdults} adulto${companionAdults > 1 ? 's' : ''}`);
      }
      if (p.childrenCount > 0) {
        parts.push(`+${p.childrenCount} criança${p.childrenCount > 1 ? 's' : ''}`);
      }

      if (parts.length > 0) {
        return `${p.playerName} (${parts.join(', ')})`;
      } else {
        return `${p.playerName}`;
      }
    }).join('\n');

    const formattedDate = evt.date.split('-').reverse().join('/');

    const textMsg = `\uD83C\uDF89 Evento Racha do Fofim: *${evt.name}*\n\n\uD83D\uDC65 *Confirmados*\n\n${confirmedLines}\n\n*Total previsto:*\n${totalPessoas} pessoas\n\n\uD83D\uDCC5 *Data:* ${formattedDate} às ${evt.time}\n\uD83D\uDCCD *Local:* ${evt.location || 'Não especificado'}`;
    const escapedMsg = encodeURIComponent(textMsg);
    
    // Diagnostic logs for WhatsApp sharing (Request Pattern)
    console.log("textMsg:", textMsg);
    console.log("encodeURIComponent(textMsg):", escapedMsg);
    console.log("urlFinal:", `https://wa.me/?text=${escapedMsg}`);

    window.open(`https://wa.me/?text=${escapedMsg}`, '_blank');
  };

  // Handle RSVP status toggling
  const handleRsvpHolder = async (status: 'confirmado' | 'cancelado') => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (nextMatch.status === 'agendada') {
      setErrorMsg('As confirmações ainda não foram liberadas pelo administrador.');
      setActionLoading(false);
      return;
    }

    if (currentUserCategory === 'reserva' && !areReservesReleased) {
      setErrorMsg('A fila de confirmações para reservas ainda não foi liberada.');
      setActionLoading(false);
      return;
    }

    if (status === 'confirmado' && ['fechada', 'sorteada', 'encerrada', 'cancelada'].includes(nextMatch.status)) {
      setErrorMsg('O racha não está aberto para novas confirmações neste momento.');
      setActionLoading(false);
      return;
    }

    if (status === 'confirmado' && currentUserCategory !== 'reserva' && isDeadlineExpired && !['confirmando', 'aguardando_reservas'].includes(nextMatch.status)) {
      setErrorMsg('Prazo limite para confirmação expirado. Mensalistas não podem mais confirmar.');
      setActionLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/presences/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentUser.id, status })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao registrar sua presença.');
      }

      setMyPresence(status);

      if (status === 'confirmado') {
        setSuccessMsg('Presença confirmada no próximo racha com sucesso! Bom jogo!');
      } else {
        if (resData.alertCreated) {
          setSuccessMsg('Presença cancelada. Como você já estava confirmado, o administrador foi alertado com sugestão de reserva!');
        } else {
          setSuccessMsg('Presença cancelada. Vaga liberada no grupo.');
        }
      }

      // Refresh dynamic match, presence list, and alerts
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível salvar a sua presença.');
    } finally {
      setActionLoading(false);
    }
  };

  // Summon suggested reserve
  const handleSummonReserve = async (alertId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/reserve-alerts/${alertId}/summon`, { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível realizar a convocação.');
      
      setSuccessMsg('Reserva convocado e incluído na lista de confirmados com sucesso!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao convocar reserva.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clear reserve alert suggestion
  const handleClearAlert = async (alertId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/reserve-alerts/${alertId}/clear`, { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível dispensar o alerta.');
      
      setSuccessMsg('Alerta de substituição dispensado com sucesso.');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao dispensar alerta.');
    } finally {
      setActionLoading(false);
    }
  };

  // Summon the next reserve in the sequential waitlist
  const handleSummonNextReserve = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/reserve-queue/summon-next`, { method: 'POST' });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Erro ao realizar convocação.');

      setSuccessMsg(resData.message || 'Próximo reserva convocado com sucesso!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao convocar reserva.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIgnoreReservePlayer = async (playerId: string) => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/reserve-queue/ignore-player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Erro ao ignorar jogador.');

      setSuccessMsg('Jogador reserva ignorado. Sugerindo próximo da fila.');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ignorar jogador.');
    } finally {
      setActionLoading(false);
    }
  };

  // Respond to a pending convocacao (accept, refuse, or dispense)
  const handleRespondReserveConvocation = async (alertId: string, status: 'confirmado' | 'recusado' | 'dispensado') => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/reserve-alerts/${alertId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Erro ao responder convocação.');

      setSuccessMsg(resData.message || 'Resposta registrada com sucesso!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar resposta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminTogglePresence = async (playerId: string, status: 'confirmado' | 'cancelado') => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/presences/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, status, manuallyApproved: status === 'confirmado' })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao alterar a presença.');
      }
      setSuccessMsg(`Presença alterada com sucesso pelo administrador!`);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar presença do jogador.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickApproveUser = async (userId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'approve',
          linkOption: 'create',
          role: 'jogador',
          adminName: currentUser.name || 'Admin',
          playerCategory: 'reserva',
          primaryPosition: 'atacante'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar usuário.');
      setSuccessMsg('Usuário aprovado com sucesso e atleta correspondente criado!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aprovar usuário.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickRejectUser = async (userId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'reject',
          adminName: currentUser.name || 'Admin'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao rejeitar usuário.');
      setSuccessMsg('Solicitação de cadastro rejeitada com sucesso.');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar ação.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLinkUserToPlayer = async (user: any, playerId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'update_role',
          role: user.role,
          selectedPlayerId: playerId,
          adminName: currentUser.name || 'Admin'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao realizar vínculo do usuário.');
      
      setSuccessMsg(`Usuário ${user.name} foi separado e vinculado com sucesso.`);
      setUnlinkedUserToResolve(null);
      setSelectedManualPlayerId('');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao vincular usuário.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickSaveResult = async (matchId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${matchId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winsBlue: parseInt(winsBlueInput) || 0,
          winsRed: parseInt(winsRedInput) || 0,
          winsGreen: parseInt(winsGreenInput) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar resultado.');
      setSuccessMsg('Resultado da rodada gravado e estatísticas consolidadas com sucesso!');
      setWinsBlueInput('0');
      setWinsRedInput('0');
      setWinsGreenInput('0');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar resultado.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickConfirmPayment = async (billId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch('/api/finances/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId,
          email: currentUser.email,
          role: currentUser.role
        })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao confirmar pagamento.');
      }
      setSuccessMsg('Pagamento confirmado e registrado no histórico financeiro!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível confirmar o pagamento.');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchReservesOrder = async () => {
    setLoadingReserves(true);
    try {
      const res = await fetch('/api/reserves/order');
      if (res.ok) {
        const data = await res.json();
        const reservesList = Array.isArray(data) ? data : (data.reserves || []);
        setPriorityReserves(reservesList);
      }
    } catch (err) {
      console.error('Error fetching priority reserves:', err);
    } finally {
      setLoadingReserves(false);
    }
  };

  const handleOpenConfirmations = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmando' })
      });
      if (!res.ok) throw new Error('Falha ao abrir confirmações.');
      setSuccessMsg('Confirmações abertas e lista liberada para o grupo!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao abrir confirmações.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelada' })
      });
      if (!res.ok) throw new Error('Falha ao cancelar rodada.');
      setSuccessMsg('Rodada cancelada com sucesso!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cancelar rodada.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualReleaseReserves = async () => {
    if (!nextMatch) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}/release-reserves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Falha ao liberar reservas.');
      setSuccessMsg('Fila de reservas liberada e convocação iniciada!');
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao liberar reservas.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMassClearConfirmations = async () => {
    if (!nextMatch) return;
    if (!window.confirm('Tem certeza que deseja limpar de forma definitiva todas as confirmações e convocações desta rodada cancelada? Esta ação restaurará todos os atletas para o estado "sem resposta" nesta rodada.')) {
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/matches/${nextMatch.id}/clear-presences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsibleId: currentUser.id,
          responsibleName: currentUser.name,
          responsibleEmail: currentUser.email
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao limpar confirmações.');
      }
      const result = await res.json();
      setSuccessMsg(`Limpeza em massa efetuada com sucesso! ${result.numPresencesRemoved || 0} confirmações removidas e ${result.numAlertsRemoved || 0} convocações de reservas revertidas.`);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao efetuar limpeza.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareMatchOnWhatsApp = () => {
    if (!nextMatch) return;
    const formattedDate = nextMatch.date.split('-').reverse().join('/');
    const confirmedList = confirmedPlayers.map((p, idx) => `\uD83D\uDC49 ${idx + 1}. ${p.name}`).join('\n');
    const absentList = cancelPlayers.map(p => `\u274C ${p.name}`).join('\n');
    const maxPlayersLimit = nextMatch.maxPlayers !== undefined && nextMatch.maxPlayers !== null ? nextMatch.maxPlayers : 15;
    const vacanciesCount = Math.max(0, maxPlayersLimit - confirmedCount);
    
    const textMsg = `\u26BD *RACHA DO FOFIM - CONVOCADOS PARA O DIA ${formattedDate}!* \u26BD\n` +
      `\uD83D\uDCC5 *Data:* ${formattedDate} às ${nextMatch.time}\n` +
      `\uD83D\uDCCD *Local:* ${nextMatch.location}\n\n` +
      `\uD83D\uDC65 *Confirmados (${confirmedCount}/${maxPlayersLimit}):*\n${confirmedList || '_Nenhum jogador confirmado ainda_'}\n\n` +
      `\u274C *Não Vão (${cancelPlayers.length}):*\n${absentList || '_Nenhuma recusa registrada_'}\n\n` +
      `\u26A0\uFE0F *Vagas em aberto:* ${vacanciesCount} vagas disponíveis!\n\n` +
      `Por favor, atualizem seus status de presença no app oficial:\n` +
      `\uD83D\uDC49 Acesse e confirme: https://racha-do-fofim.com\n\n` +
      `Abraços e bom racha!`;
      
    const escapedMsg = encodeURIComponent(textMsg);
    
    // Diagnostic logs for WhatsApp sharing (Request Pattern)
    console.log("textMsg:", textMsg);
    console.log("encodeURIComponent(textMsg):", escapedMsg);
    console.log("urlFinal:", `https://wa.me/?text=${escapedMsg}`);

    window.open(`https://wa.me/?text=${escapedMsg}`, '_blank');
  };

  const handleToggleSelectPlayer = (pId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedPlayerIds.length === presences.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(presences.map(p => p.playerId));
    }
  };

  const handleConfirmMensalistasInBulk = async () => {
    if (!nextMatch) return;
    const pendingMensalistas = presences.filter(p => {
      const isMensalista = p.category === 'mensalista';
      return isMensalista && p.presenceStatus === 'nao_confirmado';
    });
    const maxPlayersLimit = nextMatch.maxPlayers !== undefined && nextMatch.maxPlayers !== null ? nextMatch.maxPlayers : 15;
    const vacancies = Math.max(0, maxPlayersLimit - confirmedCount);
    
    if (pendingMensalistas.length === 0) {
      setErrorMsg('Não há mensalistas pendentes para confirmar.');
      return;
    }
    if (vacancies <= 0) {
      setErrorMsg('Não há vagas disponíveis neste racha.');
      return;
    }

    const playerIdsToConfirm = pendingMensalistas.slice(0, vacancies).map(p => p.playerId);
    
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/presences/bulk-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: playerIdsToConfirm, status: 'confirmado' })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao confirmar mensalistas em lote.');
      }
      setSuccessMsg(`Foram confirmados ${playerIdsToConfirm.length} mensalistas pendentes com sucesso!`);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar confirmação coletiva de mensalistas.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReservesInBulk = async () => {
    if (!nextMatch) return;
    const pendingReservesToConfirm = presences.filter(p => {
      return p.category === 'reserva' && p.declaredPresence === true && p.presenceStatus === 'nao_confirmado';
    });
    
    const priorityIds = priorityReserves.map(r => r.id);
    const sortedPendingReserves = [...pendingReservesToConfirm].sort((a, b) => {
      const idxA = priorityIds.indexOf(a.playerId);
      const idxB = priorityIds.indexOf(b.playerId);
      const orderA = idxA !== -1 ? idxA : 999999;
      const orderB = idxB !== -1 ? idxB : 999999;
      return orderA - orderB;
    });

    const maxPlayersLimit = nextMatch.maxPlayers !== undefined && nextMatch.maxPlayers !== null ? nextMatch.maxPlayers : 15;
    const vacancies = Math.max(0, maxPlayersLimit - confirmedCount);

    if (sortedPendingReserves.length === 0) {
      setErrorMsg('Não há reservas da fila disponíveis e pendentes para confirmar.');
      return;
    }
    if (vacancies <= 0) {
      setErrorMsg('Não há vagas disponíveis neste racha.');
      return;
    }

    const playerIdsToConfirm = sortedPendingReserves.slice(0, vacancies).map(p => p.playerId);

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/presences/bulk-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: playerIdsToConfirm, status: 'confirmado' })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao confirmar reservas em lote.');
      }
      setSuccessMsg(`Foram confirmados ${playerIdsToConfirm.length} reservas com sucesso!`);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar confirmação coletiva de reservas.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkTogglePresence = async (status: 'confirmado' | 'cancelado') => {
    if (!nextMatch || selectedPlayerIds.length === 0) return;
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`/api/matches/${nextMatch.id}/presences/bulk-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: selectedPlayerIds, status })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao alterar as presenças.');
      }
      setSuccessMsg(`Presenças (${selectedPlayerIds.length}) alteradas com sucesso pelo administrador!`);
      setSelectedPlayerIds([]);
      await loadDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar presenças em massa.');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'auxiliar':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      default:
        return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'auxiliar':
        return 'Auxiliar Técnico';
      default:
        return 'Jogador';
    }
  };

  // Aggregate stats from matching list
  const POSITION_ORDER = ['goleiro', 'zagueiro', 'volante', 'meio_campo', 'atacante'];

  const sortPlayersByPositionAndName = (p1: any, p2: any) => {
    const pl1 = players.find((pl: any) => pl.id === p1.playerId);
    const pl2 = players.find((pl: any) => pl.id === p2.playerId);

    const pos1 = pl1 ? pl1.primaryPosition : (p1.primaryPosition || '');
    const pos2 = pl2 ? pl2.primaryPosition : (p2.primaryPosition || '');

    const idx1 = POSITION_ORDER.indexOf(pos1);
    const idx2 = POSITION_ORDER.indexOf(pos2);

    const val1 = idx1 !== -1 ? idx1 : 999;
    const val2 = idx2 !== -1 ? idx2 : 999;

    if (val1 !== val2) {
      return val1 - val2;
    }

    const name1 = (p1.name || '').toLowerCase().trim();
    const name2 = (p2.name || '').toLowerCase().trim();
    return name1.localeCompare(name2, 'pt-BR');
  };

  // Call the central helper function for the round status source of truth
  const roundStatus = getRoundStatus(nextMatch, presences, reserveQueue, players);

  const getAutoState = (): number => {
    if (!nextMatch) return 1;
    
    if (nextMatch.status === 'cancelada') return 10;

    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
    const isMatchDay = nextMatch.date === localToday;

    if (isMatchDay && nextMatch.status !== 'encerrada') {
      return 6; // Dia do Jogo
    }

    if (nextMatch.status === 'agendada') return 1;

    if (nextMatch.status === 'confirmando' || nextMatch.status === 'aguardando_reservas') {
      if (roundStatus.vacancies > 0 && roundStatus.vacancies <= 3) {
        return 3; // Lista Quase Completa
      }
      return 2; // Confirmações Abertas
    }

    if (nextMatch.status === 'fechada' || roundStatus.isClosed) {
      if (nextMatch.status !== 'sorteada' && nextMatch.status !== 'encerrada') {
        return 4; // Lista Fechada
      }
    }

    if (nextMatch.status === 'sorteada') {
      return 5; // Sorteio Realizado
    }

    if (nextMatch.status === 'encerrada') {
      if (nextMatch.lifecycleState === 'ARCHIVED') {
        return 10;
      }
      return 8; // Default to Avaliações Abertas for testing UX
    }

    return 1;
  };

  const activeStateNum = simulatedState !== null ? simulatedState : getAutoState();

  const simWinsBlue = latestResult?.winsBlue ?? 5;
  const simWinsRed = latestResult?.winsRed ?? 3;
  const simWinsGreen = latestResult?.winsGreen ?? 4;
  const simChampions = latestResult?.champions ?? ['Azul'];

  const confirmedPlayers = [...presences.filter(p => p.presenceStatus === 'confirmado')].sort(sortPlayersByPositionAndName);
  const cancelPlayers = [...presences.filter(p => p.presenceStatus === 'cancelado' && p.category !== 'reserva')].sort(sortPlayersByPositionAndName);
  const unconfirmedPlayers = [...presences.filter(p => p.presenceStatus === 'nao_confirmado' && p.category !== 'reserva')].sort(sortPlayersByPositionAndName);

  const sortedPresencesForList = [
    ...confirmedPlayers,
    ...unconfirmedPlayers,
    ...cancelPlayers
  ];

  const confirmedCount = roundStatus.confirmed;
  const maxPlayersLimit = roundStatus.totalSlots;
  const missingCount = roundStatus.vacancies;
  const isDeadlineExpired = nextMatch ? nextMatch.isDeadlineExpired : false;
  const areReservesReleased = nextMatch ? (nextMatch.reservesReleased === true) : false;

  // Find current record holder of the longest historical streak
  const getStreakRecordHolder = () => {
    if (!stats || !stats.individual || stats.individual.length === 0) return null;
    const sortedByStreak = [...stats.individual].sort((a: any, b: any) => b.maxStreak - a.maxStreak);
    return sortedByStreak[0];
  };
  const streakRecordHolder = getStreakRecordHolder();

  // Admin Operational calculations
  const ptToday = new Date();
  const ptOffset = ptToday.getTimezoneOffset();
  const localTodayStr = new Date(ptToday.getTime() - (ptOffset * 60 * 1000)).toISOString().split('T')[0];

  const pastMatchesWithoutResults = allMatches.filter((m: any) => {
    return m.date < localTodayStr && !['encerrada', 'cancelada', 'arquivada'].includes(m.status) && !m.hasResults;
  });

  const pendingBills = (finData?.bills || []).filter((b: any) => b.status === 'pendente');

  const getPlayerNameForBill = (playerId: string) => {
    const playerObj = (finData?.players || []).find((p: any) => p.id === playerId);
    return playerObj ? playerObj.name : 'Jogador';
  };

  const getSuggestedPlayer = (user: any, playersList: any[]) => {
    if (!user || !playersList) return null;
    if (user.email) {
      const matchByEmail = playersList.find(p => p.email && p.email.toLowerCase().trim() === user.email.toLowerCase().trim());
      if (matchByEmail) return matchByEmail;
    }
    const userNameLower = (user.name || '').toLowerCase().trim();
    const matchByName = playersList.find(p => {
      const playNameLower = (p.name || '').toLowerCase().trim();
      return playNameLower === userNameLower || playNameLower.includes(userNameLower) || userNameLower.includes(playNameLower);
    });
    return matchByName || null;
  };

  // Determine current operational state for the nextMatch representing the single logical next action
  const getAdminOperationalState = () => {
    if (pastMatchesWithoutResults.length > 0) {
      return 'pos_jogo';
    }
    if (!nextMatch) return null;

    if (nextMatch.status === 'agendada') {
      return 'agendada';
    }
    if (nextMatch.status === 'cancelada') {
      return 'cancelada';
    }
    
    switch (roundStatus.phase) {
      case 'FINISHED':
        if (nextMatch.lifecycleState === 'ARCHIVED') return 'arquivada';
        return 'encerrada';
      case 'DRAWN':
        return 'sorteada';
      case 'CLOSED':
        return 'racha_fechado';
      case 'CONFIRMING':
      default:
        if (nextMatch.status === 'aguardando_reservas') {
          return 'necessidade_reservas';
        }
        return 'confirmacoes_abertas';
    }
    return null;
  };

  const adminState = getAdminOperationalState();
  const hasPendingActions = isAdmin && adminState !== null;

  // Check if there are any administrative pendencies to display the block
  const unlinkedUsersCount = allUsersList.filter((u: any) => u.status === 'approved' && !u.playerId && !ignoredUserIds.includes(u.id)).length;
  
  // Build the list of active administrative pendencies
  const adminPendenciesList = [];

  // 1. Approved users not linked to an athlete card
  const filteredUnlinkedUsers = allUsersList.filter((u: any) => u.status === 'approved' && !u.playerId && !ignoredUserIds.includes(u.id));
  if (filteredUnlinkedUsers.length > 0) {
    adminPendenciesList.push({
      id: 'unlinked-users',
      text: `• ${filteredUnlinkedUsers.length} usuário(s) ativo(s) sem vínculo de atleta.`,
      actionText: 'Vincular',
      onClick: () => {
        setUnlinkedUserToResolve(filteredUnlinkedUsers[0]);
      }
    });
  }

  // 2. Pending user registrations
  if (pendingUsers.length > 0) {
    adminPendenciesList.push({
      id: 'pending-users',
      text: `• ${pendingUsers.length} cadastro(s) aguardando aprovação.`,
      actionText: 'Analisar',
      onClick: onNavigateToApprovals
    });
  }

  // 3. Pending or overdue bill payments
  if (pendingBills.length > 0) {
    adminPendenciesList.push({
      id: 'pending-bills',
      text: `• ${pendingBills.length} mensalidade(s) vencida(s)/pendente(s).`,
      actionText: 'Ver',
      onClick: onNavigateToFinances
    });
  }

  // 4. Past matches with results missing (Sorteio realizado sem placar registrado)
  if (pastMatchesWithoutResults.length > 0) {
    pastMatchesWithoutResults.forEach((m: any) => {
      adminPendenciesList.push({
        id: `missing-score-${m.id}`,
        text: `• Racha de ${m.date.split('-').reverse().join('/')} sem placar registrado.`,
        actionText: 'Gravar Placar',
        onClick: () => {
          window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'calendar' }));
        }
      });
    });
  }

  const hasAdminPendencies = adminPendenciesList.length > 0;

  const getAllStarTeam = () => {
    const individualStats = stats?.individual || [];
    if (individualStats.length === 0) return [];

    const selected: any[] = [];
    const usedIds = new Set<string>();

    const findBestFor = (posGroup: string[], label: string) => {
      const found = individualStats.find((p: any) => 
        !usedIds.has(p.playerId) && 
        posGroup.includes(p.primaryPosition || '') &&
        p.presences > 0
      );
      if (found) {
        usedIds.add(found.playerId);
        selected.push({ ...found, slotLabel: label });
        return true;
      }
      return false;
    };

    // 1. GK
    findBestFor(['goleiro'], 'GK');
    // 2. ZAG
    findBestFor(['zagueiro'], 'ZAG');
    // 3. VOL
    findBestFor(['volante'], 'VOL');
    // 4. MEI
    findBestFor(['meio_campo'], 'MEI');
    // 5. ATA
    findBestFor(['atacante'], 'ATA');

    // Fill remaining if needed
    const slots = ['GK', 'ZAG', 'VOL', 'MEI', 'ATA'];
    const filledSlots = selected.map(s => s.slotLabel);
    const missingSlots = slots.filter(s => !filledSlots.includes(s));

    for (const slot of missingSlots) {
      const leftover = individualStats.find((p: any) => !usedIds.has(p.playerId) && p.presences > 0);
      if (leftover) {
        usedIds.add(leftover.playerId);
        selected.push({ ...leftover, slotLabel: slot });
      }
    }

    // In case still under 5, load any available
    if (selected.length < 5) {
      for (const slot of slots) {
        if (!selected.some(s => s.slotLabel === slot)) {
          const anyLeftover = individualStats.find((p: any) => !usedIds.has(p.playerId));
          if (anyLeftover) {
            usedIds.add(anyLeftover.playerId);
            selected.push({ ...anyLeftover, slotLabel: slot });
          }
        }
      }
    }

    const order = { 'GK': 1, 'ZAG': 2, 'VOL': 3, 'MEI': 4, 'ATA': 5 };
    return selected.sort((a, b) => (order[a.slotLabel as keyof typeof order] || 99) - (order[b.slotLabel as keyof typeof order] || 99));
  };

  const allStarTeam = getAllStarTeam();

  const getBestKeeper = () => {
    const individualStats = stats?.individual || [];
    if (individualStats.length === 0) return null;
    const keepers = individualStats.filter((p: any) => p.primaryPosition === 'goleiro' && p.presences > 0);
    if (keepers.length === 0) return null;
    return [...keepers].sort((a: any, b: any) => {
      if (b.aproveitamento !== a.aproveitamento) {
        return b.aproveitamento - a.aproveitamento;
      }
      if (b.presences !== a.presences) {
        return b.presences - a.presences;
      }
      return b.maxStreak - a.maxStreak;
    })[0];
  };

  const bestKeeper = getBestKeeper();

  const getPositionEmoji = (pos: string) => {
    switch (pos) {
      case 'goleiro': return '🧤';
      case 'zagueiro': return '🛡️';
      case 'volante': return '🧠';
      case 'meio_campo': return '🧠';
      case 'atacante': return '⚡';
      default: return '🏃';
    }
  };

  const getMatchState = (): 'AGENDADO' | 'CONFIRMACOES_ABERTAS' | 'RACHA_FECHADO' | 'SORTEIO_REALIZADO' | 'PARTIDA_ENCERRADA' | null => {
    if (!nextMatch) return null;
    if (nextMatch.status === 'agendada') return 'AGENDADO';
    
    switch (roundStatus.phase) {
      case 'FINISHED': return 'PARTIDA_ENCERRADA';
      case 'DRAWN': return 'SORTEIO_REALIZADO';
      case 'CLOSED': return 'RACHA_FECHADO';
      case 'CONFIRMING':
      default:
        return 'CONFIRMACOES_ABERTAS';
    }
  };

  const matchState = getMatchState();

  const renderSportsHero = () => {
    // If no match is active at all and we are not simulating, show fallback
    if (!nextMatch && simulatedState === null) {
      return (
        <div className="sports-card border border-zinc-800/60 rounded-2xl p-10 text-center space-y-5 shadow-xl animate-fadeIn">
          <div className="w-16 h-16 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Calendar className="w-8 h-8 text-zinc-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-display font-black text-base uppercase tracking-wider">Nenhum racha ativo no momento</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Agende uma nova rodada para iniciar o próximo ciclo e mobilizar a galera.
            </p>
          </div>
          {(currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
            <div className="pt-4 border-t border-zinc-900 text-zinc-500 text-[11px] font-mono leading-relaxed max-w-md mx-auto">
              💡 <span className="text-zinc-400 font-bold">Dica do Professor:</span> Vá na aba <span className="text-emerald-400 font-bold hover:underline">"Calendário"</span> para configurar a recorrência e gerar rachas automaticamente para todo o ano de 2026!
            </div>
          )}
        </div>
      );
    }

    // Prepare variables (with safe fallbacks for simulation)
    const matchDateObj = nextMatch || { date: '2026-06-27', location: 'Arena Gol de Placa - Quadra A', time: '19:30' };
    const formattedDate = matchDateObj.date.split('-').reverse().join('/');
    
    // Simulate values based on simulatedState
    let simConfirmed = confirmedCount;
    let simLimit = maxPlayersLimit;
    
    if (simulatedState !== null) {
      if (simulatedState === 1) { simConfirmed = 0; }
      else if (simulatedState === 2) { simConfirmed = 8; }
      else if (simulatedState === 3) { simConfirmed = 13; }
      else if (simulatedState === 4) { simConfirmed = 15; }
      else if (simulatedState === 5) { simConfirmed = 15; }
      else if (simulatedState === 6) { simConfirmed = 15; }
      else if (simulatedState === 7) { simConfirmed = 15; }
      else if (simulatedState === 8) { simConfirmed = 15; }
      else if (simulatedState === 9) { simConfirmed = 15; }
      else if (simulatedState === 10) { simConfirmed = 15; }
    }

    const simVacancies = Math.max(0, simLimit - simConfirmed);

    // Get metadata for activeStateNum (1-10)
    const getHeroMetadata = () => {
      switch (activeStateNum) {
        case 1:
          return {
            badge: "Standby",
            badgeClass: "text-zinc-400 bg-zinc-900 border-zinc-800",
            title: "Nenhuma confirmação aberta.",
            subtitle: "Aguardando abertura de confirmações pelo professor.",
            glow: ""
          };
        case 2:
          return {
            badge: "Inscrições Abertas",
            badgeClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.06)] animate-pulse",
            title: "Confirmar Presença!",
            subtitle: "Garanta o seu lugar na escalação titular desta rodada.",
            glow: "shadow-[0_0_50px_rgba(16,185,129,0.05)] border-emerald-500/20"
          };
        case 3:
          return {
            badge: "Últimas Vagas Disponíveis",
            badgeClass: "text-amber-400 bg-amber-500/10 border-amber-500/25 animate-pulse",
            title: "🔥 ÚLTIMAS VAGAS DISPONÍVEIS!",
            subtitle: "O elenco está quase fechado. Restam apenas " + simVacancies + " vagas!",
            glow: "shadow-[0_0_50px_rgba(245,158,11,0.08)] border-amber-500/30 ring-1 ring-amber-500/20 animate-pulse"
          };
        case 4:
          return {
            badge: "Lista Fechada",
            badgeClass: "text-purple-400 bg-purple-500/10 border-purple-500/25",
            title: "🔒 Lista Fechada",
            subtitle: "Elenco 100% preenchido. Preparando sorteio técnico por Monte Carlo.",
            glow: "shadow-[0_0_50px_rgba(168,85,247,0.05)] border-purple-500/20"
          };
        case 5:
          return {
            badge: "Sorteio Realizado",
            badgeClass: "text-sky-400 bg-sky-500/10 border-sky-500/25",
            title: "🎲 Times Escalados!",
            subtitle: "O sorteio foi publicado. Confira sua equipe no campo tático abaixo.",
            glow: "shadow-[0_0_50px_rgba(14,165,233,0.05)] border-sky-500/20"
          };
        case 6:
          return {
            badge: "HOJE TEM RACHA!",
            badgeClass: "text-red-400 bg-red-500/10 border-red-500/25 animate-pulse font-black",
            title: "🏟️ HOJE É DIA DE RACHA DO FOFIM!",
            subtitle: "O apito inicial está próximo. Confira as informações da rodada!",
            glow: "shadow-[0_0_60px_rgba(239,68,68,0.08)] border-red-500/30 ring-2 ring-red-500/10"
          };
        case 7:
          return {
            badge: "Jogo Encerrado",
            badgeClass: "text-zinc-400 bg-zinc-900 border-zinc-800",
            title: "🏆 Rodada Finalizada!",
            subtitle: "Partida concluída na Arena. Veja os placares e o resumo da rodada.",
            glow: "shadow-[0_0_50px_rgba(251,191,36,0.04)]"
          };
        case 8:
          return {
            badge: "Avaliações Abertas",
            badgeClass: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 animate-pulse",
            title: "⭐ Avalie seus companheiros!",
            subtitle: "Submeta suas notas para atualizar o ranking técnico e calcular o novo OVR.",
            glow: "shadow-[0_0_50px_rgba(234,179,8,0.05)] border-yellow-500/20"
          };
        case 9:
          return {
            badge: "Resultado Consolidado",
            badgeClass: "text-teal-400 bg-teal-500/10 border-teal-500/25",
            title: "📈 OVR e Ranking Atualizados!",
            subtitle: "Notas processadas! Confira sua evolução e novas badges conquistadas.",
            glow: "shadow-[0_0_50px_rgba(20,184,166,0.05)] border-teal-500/20"
          };
        case 10:
          return {
            badge: "Museu Atualizado",
            badgeClass: "text-violet-400 bg-violet-500/10 border-violet-500/25",
            title: "📸 Mural & Museu do Racha",
            subtitle: "Novas fotos, vídeos e lances marcantes publicados pelo elenco.",
            glow: "shadow-[0_0_50px_rgba(139,92,246,0.05)] border-violet-500/20"
          };
        default:
          return {
            badge: "Partida Agendada",
            badgeClass: "text-zinc-400 bg-zinc-900 border-zinc-800",
            title: "Sábado de Racha",
            subtitle: "Convocação geral agendada.",
            glow: ""
          };
      }
    };

    const meta = getHeroMetadata();

    return (
      <motion.div 
        key={`hero-state-${activeStateNum}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/25 p-6 md:p-8 shadow-2xl turf-glow field-decor transition-all duration-500 ${meta.glow}`} 
        id="central-da-rodada-hero"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top bar with phase and status */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow shadow-emerald-400"></span>
            </div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">Central da Rodada</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono font-black px-3 py-1 rounded-lg border uppercase tracking-wide flex items-center gap-1.5 transition-all duration-300 ${meta.badgeClass}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {meta.badge}
            </span>
          </div>
        </div>

        {/* Scoreboard block */}
        <div className="pt-6 pb-2 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left info: Arena & Title */}
          <div className="md:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-mono font-bold uppercase tracking-widest">
              <span>Racha Oficial 2026</span>
              <span>•</span>
              <span className="text-emerald-500/90 font-black">Rodada Semanal</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white uppercase tracking-tight leading-none">
              {meta.title} <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 inline-block font-black font-display uppercase tracking-tight shadow-[0_0_15px_rgba(16,185,129,0.1)] mt-1 sm:mt-0">@ {matchDateObj.location?.split(' ')[0] || 'Arena'}</span>
            </h1>
            <p className="text-zinc-400 text-xs flex items-center gap-2 font-mono bg-zinc-900/30 py-1.5 px-2.5 rounded-lg border border-zinc-900/50 max-w-max">
              <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">{matchDateObj.location || 'Local do racha'}</span>
            </p>
          </div>

          {/* Right info: Scoreboard visual style metadata */}
          <div className="md:col-span-5 bg-zinc-950/80 border border-zinc-900/80 p-5 rounded-xl space-y-4 shadow-xl">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1.5">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Calendário</span>
                <span className="text-xs font-mono font-black text-white flex items-center justify-center gap-2 bg-zinc-900/60 py-2 px-2.5 rounded-lg border border-zinc-800/60 hover:border-emerald-500/20 transition-all duration-300">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  {formattedDate}
                </span>
              </div>
              <div className="space-y-1.5 font-mono">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block">Horário</span>
                <span className="text-xs font-black text-white flex items-center justify-center gap-2 bg-zinc-900/60 py-2 px-2.5 rounded-lg border border-zinc-800/60 hover:border-emerald-500/20 transition-all duration-300">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  {matchDateObj.time}
                </span>
              </div>
            </div>

            {/* Roster slots indicator progress bar */}
            {activeStateNum >= 2 && activeStateNum <= 4 && (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span className="font-bold">Vagas Disponíveis</span>
                  <span className="text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">{simConfirmed} / {simLimit} Confirmados</span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    style={{ width: `${Math.min((simConfirmed / simLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPrimaryCTA = () => {
    if (!nextMatch && simulatedState === null) return null;
    if (activeStateNum === 5) return null;

    const matchDateObj = nextMatch || { date: '2026-06-27', location: 'Arena Gol de Placa - Quadra A', time: '19:30' };
    const isConfirmed = myPresence === 'confirmado';
    const isCancelled = myPresence === 'cancelado';

    const renderRsvpStatusBadge = () => {
      if (isConfirmed) {
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-lg border border-emerald-500/30 uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Presença Confirmada
          </span>
        );
      }
      if (isCancelled) {
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black text-rose-400 bg-rose-500/10 px-3.5 py-1.5 rounded-lg border border-rose-500/30 uppercase tracking-wider">
            <X className="w-4 h-4 text-rose-400" /> Ausência Declarada
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-lg border border-amber-500/30 animate-pulse uppercase tracking-wider">
          <AlertCircle className="w-4 h-4 text-amber-400" /> Aguardando Sua Resposta
        </span>
      );
    };

    // Calculate simulated vacancies
    let simConfirmed = confirmedCount;
    let simLimit = maxPlayersLimit;
    if (simulatedState !== null) {
      if (simulatedState === 1) simConfirmed = 0;
      else if (simulatedState === 2) simConfirmed = 8;
      else if (simulatedState === 3) simConfirmed = 13;
      else if (simulatedState === 4) simConfirmed = 15;
    }
    const simVacancies = Math.max(0, simLimit - simConfirmed);

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={`cta-state-${activeStateNum}`}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-zinc-850 bg-gradient-to-r from-zinc-900/90 via-zinc-950/80 to-emerald-950/5 backdrop-blur-md p-6 space-y-5 shadow-2xl turf-glow"
          id="athlete-rsvp-focus-cta"
        >
          {/* STATE 1: Rodada Criada */}
          {activeStateNum === 1 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto text-zinc-500 animate-pulse">
                <Clock className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white font-display font-extrabold text-sm uppercase tracking-wider">Nenhuma Confirmação Aberta</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  A rodada está criada, mas a chamada para confirmação de mensalistas ainda não foi aberta pelo professor.
                </p>
              </div>
              <button
                disabled
                className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono font-black text-[11px] uppercase tracking-widest rounded-xl mx-auto flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-ping" />
                Aguardando Abertura...
              </button>
            </div>
          )}

          {/* STATE 2: Confirmações Abertas */}
          {activeStateNum === 2 && (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Meu Status Individual</span>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-white font-display font-black text-sm uppercase tracking-wide">
                      Ficha de <span className="text-emerald-400 font-extrabold">{currentUser.name || 'Atleta'}</span>
                    </h3>
                    <span className="text-[8.5px] font-mono font-black bg-zinc-900 border border-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {currentUserCategory === 'mensalista' ? '👤 MENSALISTA' : '⏳ RESERVA'}
                    </span>
                  </div>
                </div>
                <div>{renderRsvpStatusBadge()}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('confirmado')}
                  className={`flex items-center justify-center gap-2.5 h-13 rounded-xl border font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                    isConfirmed
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-500/40 text-white shadow-[0_4px_20px_-2px_rgba(16,185,129,0.3)]'
                      : 'bg-zinc-950 hover:bg-emerald-950/30 border-zinc-850 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-350'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  {actionLoading ? 'Gravando...' : isConfirmed ? 'Confirmado! (Alterar)' : 'Confirmar Presença (Vou Jogar)'}
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('cancelado')}
                  className={`flex items-center justify-center gap-2.5 h-13 rounded-xl border font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                    isCancelled
                      ? 'bg-gradient-to-r from-rose-950 to-rose-900/85 border-rose-500/40 text-rose-400 shadow-[0_4px_20px_-2px_rgba(244,63,94,0.15)]'
                      : 'bg-zinc-950 hover:bg-rose-950/10 border-zinc-850 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400'
                  }`}
                >
                  <X className="w-5 h-5" />
                  {actionLoading ? 'Gravando...' : isCancelled ? 'Ausente! (Alterar)' : 'Declarar Ausência (Não Vou)'}
                </button>
              </div>
            </>
          )}

          {/* STATE 3: Lista Quase Completa (Últimas Vagas!) */}
          {activeStateNum === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] font-mono font-black text-red-500 uppercase tracking-widest block animate-pulse">🔥 SINAL DE URGÊNCIA</span>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-white font-display font-black text-sm uppercase tracking-wide">
                      Apenas <span className="text-amber-400 font-extrabold">{simVacancies} vagas</span> restantes!
                    </h3>
                  </div>
                </div>
                <div>{renderRsvpStatusBadge()}</div>
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-left text-[11px] text-amber-400 flex items-center gap-2.5 font-sans leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce flex-shrink-0" />
                <span>O racha está quase cheio! Se você não confirmar agora, as vagas remanescentes serão liberadas para a lista de reservas.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('confirmado')}
                  className="flex items-center justify-center gap-2.5 h-13 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 border border-amber-400/40 text-black font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse"
                >
                  <Check className="w-5 h-5" />
                  {actionLoading ? 'Gravando...' : 'Confirmar Presença Agora! ⚡'}
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('cancelado')}
                  className="flex items-center justify-center gap-2.5 h-13 rounded-xl bg-zinc-950 hover:bg-rose-950/10 border-zinc-850 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                  Dispensar Convocação
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: Lista Fechada */}
          {activeStateNum === 4 && (
            <div className="space-y-4 text-center py-3">
              <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center mx-auto text-purple-400 shadow-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-white font-display font-extrabold text-sm uppercase tracking-wider">🔒 Racha 100% Preenchido</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Todas as 15 vagas de mensalistas e reservas imediatos foram preenchidas. O professor de educação física está preparando o sorteio.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-500/5 border border-purple-500/15 text-purple-400 font-mono text-[10px] uppercase font-black tracking-wide">
                <span>Aguardando Sorteio por Monte Carlo...</span>
              </div>
            </div>
          )}

          {/* STATE 6: Dia do Jogo (Prontidão Total) */}
          {activeStateNum === 6 && (
            <div className="space-y-4 text-center py-4 animate-fadeIn">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-400 animate-pulse">
                <Calendar className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-black text-red-500 uppercase tracking-widest block">🏟️ DIA DE RACHA</span>
                <h3 className="text-white font-display font-extrabold text-sm uppercase tracking-wider">HOJE TEM RACHA DO FOFIM!</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                  A rodada acontece hoje às <span className="text-white font-extrabold font-mono">{matchDateObj.time || '19:30'}</span> na <span className="text-emerald-400 font-extrabold">{matchDateObj.location || 'Quadra Principal'}</span>. Chegue no horário para garantir o início das partidas!
                </p>
              </div>
            </div>
          )}

          {/* STATE 7: Jogo Encerrado (Placar Oficial) */}
          {activeStateNum === 7 && (
            <div className="space-y-4">
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <div className="space-y-0.5 text-left">
                  <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Resumo do Racha</span>
                  <h3 className="text-white font-display font-black text-base uppercase tracking-tight">🏆 Placar de Vitórias</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  ✓ Encerrada
                </span>
              </div>

              {/* Trophies results list for 3 teams */}
              <div className="grid grid-cols-3 gap-3.5 text-center bg-zinc-950/80 p-4 rounded-xl border border-zinc-900">
                <div className="p-3 bg-sky-950/15 border border-sky-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute top-1 right-1 font-mono font-bold text-[8px] text-sky-400">Azul</div>
                  <span className="text-2xl font-display font-black text-white tracking-tight block">{simWinsBlue}</span>
                  <span className="text-[8px] text-zinc-500 font-mono font-bold block uppercase tracking-wider">Vitórias</span>
                </div>
                <div className="p-3 bg-rose-950/15 border border-rose-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute top-1 right-1 font-mono font-bold text-[8px] text-rose-400">Vermelho</div>
                  <span className="text-2xl font-display font-black text-white tracking-tight block">{simWinsRed}</span>
                  <span className="text-[8px] text-zinc-500 font-mono font-bold block uppercase tracking-wider">Vitórias</span>
                </div>
                <div className="p-3 bg-emerald-950/15 border border-emerald-500/20 rounded-xl relative overflow-hidden">
                  <div className="absolute top-1 right-1 font-mono font-bold text-[8px] text-emerald-400">Verde</div>
                  <span className="text-2xl font-display font-black text-white tracking-tight block">{simWinsGreen}</span>
                  <span className="text-[8px] text-zinc-500 font-mono font-bold block uppercase tracking-wider">Vitórias</span>
                </div>
              </div>

              <div className="text-center pt-1.5 space-y-2">
                <p className="text-xs text-zinc-400">
                  Excelente rodada! Campeão: <span className="font-extrabold text-white font-mono">{simChampions.map(c => `Time ${c}`).join(' & ')}</span>
                </p>
                <button
                  onClick={() => setSimulatedState(8)}
                  className="mt-1 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-black text-xs uppercase tracking-wider rounded-xl inline-flex items-center gap-1.5 shadow shadow-amber-500/10 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Ir para as Avaliações Técnicas
                </button>
              </div>
            </div>
          )}

          {/* STATE 8: Avaliações Abertas (Foco em Feedback) */}
          {activeStateNum === 8 && (
            <div className="space-y-4 text-left">
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-black text-yellow-500 uppercase tracking-widest block animate-pulse">⭐ CENTRAL DE AVALIAÇÃO</span>
                  <h3 className="text-white font-display font-black text-base uppercase tracking-tight">Avalie Seus Companheiros de Equipe</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  Feedback de Jogo
                </span>
              </div>

              <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-xs font-black uppercase tracking-wider font-display">💡 Como funciona?</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                  A avaliação técnica calibra as características individuais do atleta (<strong className="text-zinc-200">Força, Velocidade, Passe, Finalização, etc.</strong>). 
                  Suas notas são anônimas e influenciam diretamente no <strong className="text-zinc-200">OVR (Overall)</strong> de cada jogador, que o algoritmo utiliza para balancear perfeitamente os próximos sorteios de times.
                </p>
                <p className="text-zinc-500 text-[11px] leading-relaxed italic font-sans">
                  * Você só pode avaliar jogadores que estavam na mesma equipe que você durante este confronto.
                </p>
              </div>

              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 max-h-[300px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const curPlayer = players.find(p => p.id === currentUser?.playerId || (p.email && currentUser?.email && p.email.toLowerCase().trim() === currentUser?.email.toLowerCase().trim()));
                  const userTeam = matchDraw?.teams?.find((t: any) => t.playerIds.includes(curPlayer?.id));
                  
                  const teammates = userTeam 
                    ? players.filter(p => userTeam.playerIds.includes(p.id) && p.id !== curPlayer?.id)
                    : players.filter(p => (matchDraw?.teams?.flatMap((t: any) => t.playerIds) || []).includes(p.id) && p.id !== curPlayer?.id);

                  if (teammates.length === 0) {
                    return (
                      <div className="text-center py-6 text-zinc-500 text-xs italic font-mono">
                        Nenhum companheiro de equipe encontrado para avaliação.
                      </div>
                    );
                  }

                  return teammates.map((player) => {
                    const overallSum = summaries.find((s: any) => s.playerId === player.id);
                    const currentOvr = overallSum ? overallSum.overall.toFixed(1) : '3.5';

                    return (
                      <div key={player.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3.5 bg-zinc-900/40 border border-zinc-900/60 rounded-xl hover:border-zinc-800 transition duration-150">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-sans font-extrabold text-xs">{player.name}</span>
                            <span className="text-[9px] font-mono font-black px-1.5 py-0.5 bg-zinc-950/80 border border-zinc-850 rounded text-zinc-400">
                              OVR {currentOvr}
                            </span>
                          </div>
                          <span className="text-[8.5px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">
                            {POSITION_LABELS[player.primaryPosition as keyof typeof POSITION_LABELS] || player.primaryPosition}
                          </span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setEvaluatingPlayer(player)}
                          className="w-full sm:w-auto px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black font-mono font-bold text-[10.5px] uppercase tracking-wider rounded-lg border border-yellow-500/20 hover:border-yellow-500 transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                          Avaliar Ficha Técnica
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedState(9);
                  }}
                  className="flex-1 h-11.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-mono font-black text-xs uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  Concluir Minhas Avaliações
                </button>
              </div>
            </div>
          )}

          {/* Render real player evaluation modal */}
          {evaluatingPlayer && (
            <PlayerEvaluationModal
              player={evaluatingPlayer}
              currentUser={currentUser}
              onClose={() => setEvaluatingPlayer(null)}
              onEvaluationSaved={(msg) => {
                setSuccessMsg(msg || 'Avaliação técnica atualizada com sucesso!');
                setEvaluatingPlayer(null);
                loadDashboardData();
              }}
            />
          )}

          {/* STATE 9: Resultado Consolidado (Evolução Técnica) */}
          {activeStateNum === 9 && (
            <div className="space-y-4 text-left">
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-black text-teal-400 uppercase tracking-widest block">Notas Consolidadas</span>
                  <h3 className="text-white font-display font-black text-base uppercase tracking-tight">Seu Desempenho Técnico</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-teal-500/10 border border-teal-500/20 text-teal-400 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  OVR Atualizado
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                {/* OVR Display */}
                <div className="md:col-span-5 rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-950/10 via-zinc-950 to-teal-950/5 p-4 flex flex-col justify-center items-center text-center space-y-2 relative overflow-hidden">
                  <span className="text-[8.5px] font-mono font-black text-zinc-500 uppercase tracking-wider block">Nível de Habilidade (OVR)</span>
                  <div className="text-4xl sm:text-5xl font-display font-black text-teal-400 tracking-tight flex items-baseline gap-1 animate-fadeIn">
                    {(() => {
                      const curPlayer = players.find(p => p.id === currentUser.playerId || (p.email && currentUser.email && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()));
                      const curPlayerStats = stats?.individual?.find((s: any) => s.playerId === curPlayer?.id) || null;
                      const displayOvr = curPlayerStats?.ovr || 82.0;
                      return (
                        <>
                          <span>{displayOvr.toFixed(1)}</span>
                          <span className="text-xs font-mono text-emerald-400 font-extrabold flex items-center">
                            <ArrowUpRight className="w-3 h-3 inline animate-pulse" /> +1.2
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <span className="text-[9px] font-mono font-black text-zinc-400 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded">
                    Evolução calculada pelo professor
                  </span>
                </div>

                {/* Unlocked Badges */}
                <div className="md:col-span-7 bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 space-y-2.5">
                  <span className="text-[9px] text-zinc-500 font-mono font-black uppercase tracking-wider block">🏆 Suas Conquistas Ativas</span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {(() => {
                      const curPlayer = players.find(p => p.id === currentUser.playerId || (p.email && currentUser.email && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()));
                      const curPlayerStats = stats?.individual?.find((s: any) => s.playerId === curPlayer?.id) || null;
                      const allAch = curPlayer ? getAchievementsForPlayer(curPlayer, curPlayerStats, stats) : [];
                      
                      // Show up to 4 achievements, or safe beautiful fallbacks
                      const displayAch = allAch.length > 0 
                        ? allAch.slice(0, 4) 
                        : [
                            { title: 'Primeira Partida', icon: '⚽', earned: true },
                            { title: 'Primeira Vitória', icon: '🏆', earned: true },
                            { title: 'Embalado', icon: '🔥', earned: false },
                            { title: 'Campeão', icon: '🏅', earned: false }
                          ];

                      return displayAch.map((ach: any, idx: number) => (
                        <div 
                          key={idx} 
                          className={`p-2.5 rounded-lg border flex items-center gap-2.5 transition duration-150 ${
                            ach.earned 
                              ? 'bg-teal-500/5 border-teal-500/25 hover:border-teal-400/40' 
                              : 'bg-zinc-900/40 border-zinc-900 opacity-60'
                          }`}
                        >
                          <span className={`text-xl ${ach.earned ? 'animate-bounce' : 'grayscale'}`}>{ach.icon}</span>
                          <div className="space-y-0.5 text-left min-w-0">
                            <span className="text-[10px] text-white font-black block font-sans truncate">{ach.title}</span>
                            <span className="text-[8px] text-zinc-500 font-mono leading-none block truncate">
                              {ach.earned ? 'Conquistado ✨' : 'Bloqueado 🔒'}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              <div className="text-center pt-1 border-t border-zinc-900/60">
                <button
                  onClick={() => setSimulatedState(10)}
                  className="px-5 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-mono font-black text-[10px] uppercase tracking-wider rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                >
                  Ir para a Galeria de Fotos & Vídeos →
                </button>
              </div>
            </div>
          )}

          {/* STATE 10: Museu & Galeria (Memórias Eternas) */}
          {activeStateNum === 10 && (
            <div className="space-y-4 text-left">
              <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-black text-violet-400 uppercase tracking-widest block">Mural & Resenha</span>
                  <h3 className="text-white font-display font-black text-base uppercase tracking-tight">📸 Mural do Racha do Fofim</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-1 rounded-md uppercase tracking-wide">
                  Mural Ativo
                </span>
              </div>

              {highlightPost ? (
                <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] font-mono text-zinc-500 font-extrabold block uppercase tracking-wider">🌟 Destaque da Rodada</span>
                    <span className="text-[8.5px] font-mono text-violet-400 font-black uppercase tracking-wider">{highlightPost.authorName || 'Membro do Racha'}</span>
                  </div>
                  <p className="text-xs text-zinc-350 italic font-sans leading-relaxed">
                    "{highlightPost.text}"
                  </p>
                  {highlightPost.mediaUrl && (
                    <img 
                      src={highlightPost.mediaUrl} 
                      alt="Destaque da Rodada" 
                      referrerPolicy="no-referrer"
                      className="w-full h-32 object-cover rounded-lg border border-zinc-800"
                    />
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center space-y-2">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Nenhum post destacado no momento. O Racha do Fofim possui um Mural ativo para compartilhamento de lances marcantes, fotos e vídeos da resenha pós-racha!
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Acesse a aba "Mural" para interagir e eternizar momentos marcantes.
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  const getMyTeamInfo = () => {
    if (!matchDraw || !matchDraw.teams || !resolvedPlayerId) return null;
    const myTeamObj = matchDraw.teams.find((t: any) => t.playerIds.includes(resolvedPlayerId));
    if (!myTeamObj) return null;

    const playerObj = players.find(p => p.id === resolvedPlayerId);
    const position = playerObj ? playerObj.primaryPosition : 'Jogador';

    const teamOverall = myTeamObj.name === 'Azul'
      ? matchDraw.overallBlue
      : myTeamObj.name === 'Vermelho'
        ? matchDraw.overallRed
        : matchDraw.overallGreen;

    return {
      teamName: myTeamObj.name,
      position: position,
      teamOverall: teamOverall,
    };
  };

  const getMyTeamResultInfo = () => {
    if (!matchDraw || !matchDraw.teams || !resolvedPlayerId) return null;
    const myTeamObj = matchDraw.teams.find((t: any) => t.playerIds.includes(resolvedPlayerId));
    if (!myTeamObj) return null;

    const myTeamName = myTeamObj.name;
    const teamWins = [
      { name: 'Azul', wins: simWinsBlue },
      { name: 'Vermelho', wins: simWinsRed },
      { name: 'Verde', wins: simWinsGreen },
    ];
    const sortedTeams = [...teamWins].sort((a, b) => b.wins - a.wins);

    const myWins = teamWins.find(t => t.name === myTeamName)?.wins ?? 0;
    const myPlaceIndex = sortedTeams.findIndex(t => t.name === myTeamName);
    const myPlace = myPlaceIndex !== -1 ? myPlaceIndex + 1 : 1;

    return {
      teamName: myTeamName,
      wins: myWins,
      place: myPlace,
    };
  };

  const renderClosedMuseumScreen = () => {
    const isCancelled = nextMatch?.status === 'cancelada';
    return (
      <div className="space-y-6 text-center py-10 animate-fadeIn" id="closed-museum-screen">
        <div className={`w-16 h-16 bg-zinc-900/50 border border-zinc-850 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${isCancelled ? 'text-rose-400' : 'text-emerald-400'}`}>
          {isCancelled ? <XCircle className="w-8 h-8 animate-pulse" /> : <Archive className="w-8 h-8 animate-pulse" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-white font-display font-black text-xl uppercase tracking-wider">{isCancelled ? 'Rodada Cancelada' : 'Rodada encerrada'}</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed font-sans">
            {isCancelled ? 'Esta rodada foi cancelada pelo administrador. A próxima rodada ainda não foi criada no calendário.' : 'A rodada foi totalmente concluída e arquivada pelo professor. A próxima rodada ainda não foi criada no calendário.'}
          </p>
        </div>
        
        {/* Enquanto isso shortcuts */}
        <div className="pt-8 space-y-4 text-left max-w-2xl mx-auto border-t border-zinc-900">
          <h3 className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest text-center block">Enquanto isso, aproveite para conferir:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Últimas fotos */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'mural' }))}
              className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 hover:bg-zinc-900 hover:border-zinc-800 transition text-left space-y-2 cursor-pointer group w-full"
            >
              <Camera className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition duration-300" />
              <h4 className="text-xs font-black text-white uppercase group-hover:text-emerald-400 transition">Últimas Fotos</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Veja os registros, fotos e resenhas das últimas rodadas.</p>
            </button>
            {/* Último ranking */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'ranking' }))}
              className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 hover:bg-zinc-900 hover:border-zinc-800 transition text-left space-y-2 cursor-pointer group w-full"
            >
              <Trophy className="w-5 h-5 text-amber-400 group-hover:scale-110 transition duration-300" />
              <h4 className="text-xs font-black text-white uppercase group-hover:text-emerald-400 transition">Último Ranking</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Confira quem se destacou e lidera o OVR técnico do elenco.</p>
            </button>
            {/* Próximos eventos */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'events' }))}
              className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 hover:bg-zinc-900 hover:border-zinc-800 transition text-left space-y-2 cursor-pointer group w-full"
            >
              <Calendar className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition duration-300" />
              <h4 className="text-xs font-black text-white uppercase group-hover:text-emerald-400 transition">Próximos Eventos</h4>
              <p className="text-[10px] text-zinc-500 leading-tight">Acompanhe os churrascos, encontros e resenhas fora de quadra.</p>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPainelAdministrativo = () => {
    let completedMsg = "";
    let nextTitle = "";
    let nextDesc = "";
    let mainAction: React.ReactNode = null;

    // 1. Sem rodada aberta or Canceled or Archived
    if (!nextMatch || adminState === 'cancelada' || adminState === 'arquivada') {
      completedMsg = "Nenhuma rodada ativa no momento.";
      nextTitle = "Agendar Rodada";
      nextDesc = "Não há nenhuma rodada ativa ou agendada para a temporada atual. Inicie uma nova rodada para habilitar a confirmação de presença dos atletas.";
      mainAction = (
        <div className="space-y-3 w-full">
          <SportsButton 
            variant="primary" 
            onClick={() => setShowCreateRoundForm(!showCreateRoundForm)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            {showCreateRoundForm ? "Fechar Formulário" : "Agendar Partida Expressa"}
          </SportsButton>
        </div>
      );
    }
    // 2. Criada / Agendada
    else if (adminState === 'agendada') {
      completedMsg = "Rodada criada e agendada no calendário!";
      nextTitle = "Abrir Confirmações";
      nextDesc = "A rodada foi criada, mas a lista de presença ainda está fechada para o grupo. Libere o check-in para os atletas poderem confirmar presença.";
      mainAction = (
        <SportsButton 
          variant="confirm" 
          loading={actionLoading}
          onClick={handleOpenConfirmations}
          icon={<Play className="w-4 h-4" />}
        >
          Abrir Confirmações
        </SportsButton>
      );
    }
    // 3. Confirmando (Chamada aberta)
    else if (adminState === 'confirmacoes_abertas' || adminState === 'necessidade_reservas') {
      completedMsg = "Confirmações abertas e ativas!";
      nextTitle = "Acompanhar confirmações de presença";
      nextDesc = "O check-in dos atletas está aberto e ativo. Acompanhe a lista de confirmados e a fila de espera em tempo real.";
      
      const vacancies = Math.max(0, maxPlayersLimit - confirmedCount);

      mainAction = (
        <div className="flex flex-col gap-4 w-full">
          {/* Stats indicators */}
          <div className="grid grid-cols-3 gap-3 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-900 font-mono text-center">
            <div>
              <span className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider">Confirmados</span>
              <span className="text-sm font-extrabold text-white">{confirmedCount} / {maxPlayersLimit}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider">Na Fila</span>
              <span className="text-sm font-extrabold text-amber-400">{reserveQueue?.queue?.length || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider">Vagas Restantes</span>
              <span className="text-sm font-extrabold text-emerald-400">{vacancies}</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <SportsButton 
              variant="danger" 
              className="flex-1 bg-red-950/40 hover:bg-red-900/30 border-red-500/20 text-red-400"
              loading={actionLoading}
              onClick={handleCancelMatch}
              icon={<XCircle className="w-4 h-4" />}
            >
              Cancelar Racha
            </SportsButton>

            {isDeadlineExpired && (
              <SportsButton 
                variant="confirm" 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                loading={actionLoading}
                onClick={handleCloseConfirmations}
                icon={<Lock className="w-4 h-4" />}
              >
                Fechar Confirmações
              </SportsButton>
            )}
          </div>
        </div>
      );
    }
    // 4. Fechada (Lista fechada / completa)
    else if (adminState === 'racha_fechado') {
      completedMsg = "Lista de atletas fechada e completa!";
      nextTitle = "Sorteio técnico de equipes";
      nextDesc = "A lista de presença está fechada e completa. Prossiga para a montagem de equipes equilibradas utilizando o algoritmo de balanceamento por notas.";
      mainAction = (
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <SportsButton 
            variant="confirm" 
            className="flex-1"
            loading={actionLoading}
            onClick={handleExecuteDraw}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Executar Sorteio
          </SportsButton>
          <SportsButton 
            variant="secondary" 
            className="flex-1"
            onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }))}
            icon={<ArrowUpRight className="w-4 h-4" />}
          >
            Ajustar Manualmente
          </SportsButton>
        </div>
      );
    }
    // 5. Sorteio concluído / Dia do jogo
    else if (adminState === 'sorteada') {
      const isLocked = matchDraw?.affinitiesRecorded === true;
      if (!isLocked) {
        completedMsg = "Sorteio técnico de equipes realizado!";
        nextTitle = "Publicar escalações oficiais";
        nextDesc = "As equipes foram geradas e balanceadas. Publique a escalação oficial para liberar a visualização oficial na Home dos atletas.";
        mainAction = (
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <SportsButton 
              variant="confirm" 
              className="flex-1"
              loading={actionLoading}
              onClick={handleLockDrawFromHome}
              icon={<Check className="w-4 h-4" />}
            >
              Publicar Equipes
            </SportsButton>
            <SportsButton 
              variant="secondary" 
              className="flex-1"
              onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }))}
              icon={<Users className="w-4 h-4" />}
            >
              Ver Equipes
            </SportsButton>
          </div>
        );
      } else {
        completedMsg = "Escalações publicadas e prontas para o jogo!";
        nextTitle = "Gravar placar final do racha";
        nextDesc = "As escalações oficiais estão visíveis para todos os atletas. No dia do jogo, registre o placar final e as vitórias das equipes.";
        mainAction = (
          <SportsButton 
            variant="primary" 
            onClick={() => setShowDashboardPlacarModal(true)}
            icon={<Trophy className="w-4 h-4" />}
          >
            Registrar Placar Final
          </SportsButton>
        );
      }
    }
    // 6. Jogo encerrado
    else if (adminState === 'pos_jogo') {
      completedMsg = "Partida finalizada e jogada com sucesso!";
      nextTitle = "Registrar placar do racha";
      nextDesc = "A partida foi realizada! Lance o placar final e o número de vitórias de cada cor para atualizar o ranking técnico e as estatísticas históricas.";
      mainAction = (
        <div className="flex flex-col gap-4 w-full bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider mb-1.5 text-center font-mono">Vitórias Azul</label>
              <input 
                type="number" 
                min="0" 
                value={winsBlueInput}
                onChange={(e) => setWinsBlueInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg py-2 text-center text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider mb-1.5 text-center font-mono">Vitórias Vermelho</label>
              <input 
                type="number" 
                min="0" 
                value={winsRedInput}
                onChange={(e) => setWinsRedInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg py-2 text-center text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-black block uppercase tracking-wider mb-1.5 text-center font-mono">Vitórias Verde</label>
              <input 
                type="number" 
                min="0" 
                value={winsGreenInput}
                onChange={(e) => setWinsGreenInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded-lg py-2 text-center text-white font-mono font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <SportsButton 
            variant="confirm" 
            loading={actionLoading}
            onClick={() => handleQuickSaveResult(nextMatch?.id || (pastMatchesWithoutResults && pastMatchesWithoutResults.length > 0 ? pastMatchesWithoutResults[0].id : ""))}
            icon={<Check className="w-4 h-4" />}
          >
            Gravar Placar
          </SportsButton>
        </div>
      );
    }
    // 7. Resultado publicado / 8. Avaliações encerradas
    else if (adminState === 'encerrada') {
      completedMsg = "Placar e resultado consolidados com sucesso!";
      nextTitle = "Concluir e Encerrar Rodada";
      nextDesc = "A rodada está finalizada e as avaliações estão liberadas para todos os atletas. Encerre oficialmente a rodada para consolidar as médias técnicas atualizadas no banco de dados.";
      mainAction = (
        <SportsButton 
          variant="danger" 
          className="w-full"
          loading={actionLoading}
          onClick={async () => {
            setActionLoading(true);
            try {
              if (!nextMatch) throw new Error('Rodada não encontrada.');
              const response = await fetch(`/api/matches/${nextMatch.id}/archive`, {
                method: 'POST'
              });
              
              if (!response.ok) {
                const bodyErr = await response.json();
                throw new Error(bodyErr.error || 'Erro ao encerrar a rodada.');
              }
              
              setSuccessMsg('Rodada concluída oficialmente com sucesso e arquivada!');
              await loadDashboardData();
            } catch (err: any) {
              setErrorMsg(err.message || 'Erro ao encerrar rodada.');
            } finally {
              setActionLoading(false);
            }
          }}
          icon={<Archive className="w-4 h-4" />}
        >
          Concluir e Encerrar Rodada
        </SportsButton>
      );
    }

    return (
      <div className="sports-card border border-dashed border-emerald-500/25 bg-gradient-to-br from-zinc-950 via-zinc-950 to-emerald-950/5 p-6 space-y-5 shadow-2xl animate-fadeIn" id="quiet-admin-desk-panel">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-900/80">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Painel Administrativo</h3>
          <span className="ml-auto text-[9px] font-mono font-black bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
            ADM
          </span>
        </div>

        <div className="space-y-4 font-mono text-xs">
          {/* 1. FLUXO DA RODADA */}
          <div className="space-y-2">
            <span className="text-zinc-500 text-[9px] uppercase tracking-widest font-black block">Fluxo da Rodada</span>
            
            <div className="p-4 bg-zinc-950/90 rounded-xl border border-zinc-900 space-y-3 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-xs animate-pulse">●</span>
                <h4 className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">Ação Necessária: {nextTitle}</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">{nextDesc}</p>
              
              <div className="pt-2">
                {mainAction}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2 px-1">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-zinc-500 font-sans italic">Status Atual: {completedMsg}</p>
            </div>
          </div>

          {/* Compact Inline Create Match Form if needed */}
          {(!nextMatch || adminState === 'cancelada' || adminState === 'arquivada') && showCreateRoundForm && (
            <form onSubmit={handleCreateRound} className="bg-zinc-950/60 p-4 rounded-xl border border-zinc-900 space-y-4 mt-4 animate-fadeIn">
              <h4 className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">Nova Partida Expressa</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9.5px] text-zinc-500 font-mono font-black block uppercase">Data</label>
                  <input 
                    type="date" 
                    required
                    value={newRoundDate}
                    onChange={(e) => setNewRoundDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9.5px] text-zinc-500 font-mono font-black block uppercase">Horário</label>
                  <input 
                    type="text" 
                    required
                    value={newRoundTime}
                    onChange={(e) => setNewRoundTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9.5px] text-zinc-500 font-mono font-black block uppercase">Local</label>
                  <input 
                    type="text" 
                    required
                    value={newRoundLocation}
                    onChange={(e) => setNewRoundLocation(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-sans focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9.5px] text-zinc-500 font-mono font-black block uppercase">Limite Atletas</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={newRoundMaxPlayers}
                    onChange={(e) => setNewRoundMaxPlayers(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <SportsButton variant="ghost" size="sm" onClick={() => setShowCreateRoundForm(false)}>Cancelar</SportsButton>
                <SportsButton variant="primary" size="sm" type="submit" loading={actionLoading}>Confirmar Partida</SportsButton>
              </div>
            </form>
          )}

          {/* 2. Admin required actions / central list */}
          {hasAdminPendencies && (
            <div className="space-y-2.5 pt-3.5 border-t border-zinc-900/80">
              <span className="text-rose-400 text-[9px] uppercase tracking-widest font-black block animate-pulse">⚙️ Pendências da Rodada</span>
              <div className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-900/65 text-[11px]">
                {adminPendenciesList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-zinc-900/35 last:border-0 last:pb-0">
                    <span className="text-zinc-400 leading-relaxed font-sans font-medium truncate max-w-[150px]">{item.text}</span>
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="bg-zinc-900 hover:bg-zinc-850 text-white font-mono font-black px-3 py-1 rounded-lg text-[9px] uppercase border border-zinc-800 cursor-pointer transition"
                    >
                      {item.actionText}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Quick actions */}
          {matchState !== 'PARTIDA_ENCERRADA' && (
            <div className="space-y-2 pt-3.5 border-t border-zinc-900/80">
              <span className="text-zinc-500 text-[9px] uppercase tracking-widest font-black block">Ações Rápidas</span>
              
              {/* Share on WhatsApp */}
              <button
                type="button"
                onClick={() => handleShareMatchOnWhatsApp()}
                className="w-full flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-xl text-zinc-300 hover:text-white transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm"
              >
                <span className="font-sans font-bold text-xs">📣 Compartilhar Convocações</span>
                <Share2 className="w-4 h-4 text-emerald-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCoreGrid = () => {
    if (!nextMatch) return null;

    const matchResult = nextMatchResult || latestResult;

    const isWinner = (teamName: string) => {
      if (matchState !== 'PARTIDA_ENCERRADA') return false;
      return matchResult?.champions?.includes(teamName);
    };

    const getTeamWins = (teamName: string) => {
      if (teamName === 'Azul') return matchResult?.winsBlue;
      if (teamName === 'Vermelho') return matchResult?.winsRed;
      if (teamName === 'Verde') return matchResult?.winsGreen;
      return undefined;
    };

    // Filter roster list based on selected state
    const getFilteredPresences = () => {
      switch (rosterFilter) {
        case 'confirmados':
          return sortedPresencesForList.filter(p => p.presenceStatus === 'confirmado');
        case 'pendentes':
          return sortedPresencesForList.filter(p => p.presenceStatus === 'nao_confirmado');
        case 'cancelados':
          return sortedPresencesForList.filter(p => p.presenceStatus === 'cancelado');
        case 'todos':
        default:
          return sortedPresencesForList;
      }
    };

    const filteredList = getFilteredPresences();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="central-da-rodada-core-grid">
        {/* COLUNA ESQUERDA (Span 8): O Campo Tático, Placar ou Roster */}
        <div className="lg:col-span-8 space-y-6">
          {/* STATE 2: SORTEIO_REALIZADO ou PARTIDA_ENCERRADA - Times Escalados no Campo */}
          {(matchState === 'SORTEIO_REALIZADO' || matchState === 'PARTIDA_ENCERRADA') && matchDraw && matchDraw.teams && (
            <div className="space-y-6" id="tactical-teams-field-composer">
              <div className="flex items-center gap-2.5 pb-1 animate-fadeIn">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h2 className="font-display font-black text-lg text-white uppercase tracking-tight">
                  {matchState === 'PARTIDA_ENCERRADA' ? 'Resultado & Escalações Finais' : 'Escalações Oficiais do Confronto'}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {matchDraw.teams.map((team: any) => {
                  const teamPlayers = team.playerIds
                    .map((pid: string) => players.find(p => p.id === pid))
                    .filter(Boolean);

                  const teamOverall = team.name === 'Azul'
                    ? matchDraw.overallBlue
                    : team.name === 'Vermelho'
                      ? matchDraw.overallRed
                      : matchDraw.overallGreen;

                  const wins = getTeamWins(team.name);
                  const winner = isWinner(team.name);

                  const defaultColorConfig = team.name === 'Azul'
                    ? {
                        border: 'border-sky-500/25 shadow-[0_4px_30px_rgba(14,165,233,0.05)]',
                        header: 'bg-gradient-to-r from-sky-500/15 to-transparent text-sky-400 border-sky-500/20',
                        pitchBg: 'from-sky-950/20 via-zinc-950 to-sky-950/15',
                        pitchLines: 'border-sky-500/10',
                        badgeBg: 'bg-sky-600',
                        badgeBorder: 'border-sky-400'
                      }
                    : team.name === 'Vermelho'
                      ? {
                          border: 'border-rose-500/25 shadow-[0_4px_30px_rgba(244,63,94,0.05)]',
                          header: 'bg-gradient-to-r from-rose-500/15 to-transparent text-rose-400 border-rose-500/20',
                          pitchBg: 'from-rose-950/20 via-zinc-950 to-rose-950/15',
                          pitchLines: 'border-rose-500/10',
                          badgeBg: 'bg-rose-600',
                          badgeBorder: 'border-rose-400'
                        }
                      : {
                          border: 'border-emerald-500/25 shadow-[0_4px_30px_rgba(16,185,129,0.05)]',
                          header: 'bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-400 border-emerald-500/20',
                          pitchBg: 'from-emerald-950/20 via-zinc-950 to-emerald-950/15',
                          pitchLines: 'border-emerald-500/10',
                          badgeBg: 'bg-emerald-600',
                          badgeBorder: 'border-emerald-400'
                        };

                  const colorConfig = winner
                    ? {
                        ...defaultColorConfig,
                        border: 'border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.18)] ring-2 ring-amber-500/20',
                        header: 'bg-gradient-to-r from-amber-500/25 via-amber-500/5 to-transparent text-amber-400 border-amber-500/30'
                      }
                    : defaultColorConfig;

                  const assignments = computeTacticalAssignments(teamPlayers);
                  const gks = teamPlayers.filter(p => assignments[p.id]?.position === 'goleiro');
                  const defs = teamPlayers.filter(p => assignments[p.id]?.position === 'zagueiro');
                  const mids = teamPlayers.filter(p => ['volante', 'meio_campo'].includes(assignments[p.id]?.position));
                  const atts = teamPlayers.filter(p => assignments[p.id]?.position === 'atacante');

                  const renderPlayerToken = (p: any) => {
                    const isCap = team.captainPlayerId === p.id;
                    const assignment = assignments[p.id] || { position: p.primaryPosition, isAdapted: false };

                    return (
                      <div key={p.id} className="flex flex-col items-center text-center space-y-1 bg-zinc-950/90 p-1.5 rounded-lg border border-zinc-900 shadow-md hover:border-zinc-800 hover:scale-105 transition duration-300">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-[10px] text-white uppercase shadow-inner border-2 ${colorConfig.badgeBg} ${colorConfig.badgeBorder}`}>
                            {p.name.slice(0, 2)}
                          </div>
                          {isCap && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black border border-zinc-950 rounded-full p-0 flex items-center justify-center w-4 h-4 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                              <Crown className="w-2.5 h-2.5 text-black fill-black" />
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[9px] font-sans font-black text-zinc-100 block truncate max-w-[55px]" title={p.name}>{p.name.split(' ')[0]}</span>
                          <div className="flex items-center gap-0.5 justify-center">
                            <span className="text-[7px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                              {POSITION_LABELS[p.primaryPosition as keyof typeof POSITION_LABELS] || 'MC'}
                            </span>
                            {assignment.isAdapted && (
                              <span className="text-[7px] font-mono font-black text-amber-500" title="Improvisado nesta posição">⚠️</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={team.name} className={`rounded-2xl border ${colorConfig.border} bg-zinc-950/40 overflow-hidden shadow-2xl transition duration-300 hover:shadow-emerald-500/[0.03] field-decor`}>
                      {/* Team Header */}
                      <div className={`px-3.5 py-2.5 border-b border-zinc-900/80 flex justify-between items-center ${colorConfig.header}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-display font-black uppercase tracking-wider flex items-center gap-1.5">
                            {winner && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />}
                            Time {team.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[9px]">
                          {wins !== undefined && (
                            <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              {wins} {wins === 1 ? 'Vitória' : 'Vitórias'}
                            </span>
                          )}
                          <span className="font-mono font-black text-white bg-zinc-950/80 px-2 py-0.5 rounded-md border border-zinc-850">
                            {teamOverall ? teamOverall.toFixed(1) : '3.5'} OVR
                          </span>
                        </div>
                      </div>

                      {/* Field Pitch Layout */}
                      <div className={`relative px-3.5 py-4 bg-gradient-to-b ${colorConfig.pitchBg} min-h-[250px] flex flex-col justify-between items-stretch gap-3.5`}>
                        {/* Grass Grid Decor lines */}
                        <div className="absolute inset-0 border-y border-dashed border-zinc-900/30 flex flex-col justify-around pointer-events-none">
                          <div className={`border-b border-dashed ${colorConfig.pitchLines} w-full opacity-30`} />
                          <div className={`border-b ${colorConfig.pitchLines} w-full opacity-40`} />
                          <div className={`border-b border-dashed ${colorConfig.pitchLines} w-full opacity-30`} />
                        </div>

                        {/* TIER 4: ATTACKERS */}
                        <div className="flex justify-center gap-1.5 z-10 min-h-[48px] items-center">
                          {atts.length > 0 ? atts.map(renderPlayerToken) : <span className="text-[8.5px] text-zinc-650 font-mono italic">Sem atacantes</span>}
                        </div>

                        {/* TIER 3: MIDFIELDERS */}
                        <div className="flex justify-around gap-1.5 z-10 min-h-[48px] items-center">
                          {mids.length > 0 ? mids.map(renderPlayerToken) : <span className="text-[8.5px] text-zinc-650 font-mono italic">Sem meias</span>}
                        </div>

                        {/* TIER 2: DEFENDERS */}
                        <div className="flex justify-around gap-1.5 z-10 min-h-[48px] items-center">
                          {defs.length > 0 ? defs.map(renderPlayerToken) : <span className="text-[8.5px] text-zinc-650 font-mono italic">Sem defensores</span>}
                        </div>

                        {/* TIER 1: GOALKEEPER */}
                        <div className="flex justify-center z-10 min-h-[48px] items-center">
                          {gks.length > 0 ? gks.map(renderPlayerToken) : <span className="text-[8.5px] text-zinc-650 font-mono font-bold uppercase tracking-wider italic bg-zinc-950/40 px-2 py-1 rounded border border-zinc-900/50">Sem goleiro</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: ROSTER LIST (Lista de Presença / Chamada) */}
          {matchState !== 'PARTIDA_ENCERRADA' && (
            <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-2xl animate-fadeIn" id="match-roster-section">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900/60 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Lista de Chamada</span>
                    {nextMatch?.status === 'sorteada' && (
                      <button
                        type="button"
                        onClick={() => setIsRosterBlockCollapsed(!isRosterBlockCollapsed)}
                        className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        {isRosterBlockCollapsed ? (
                          <><Eye className="w-3 h-3" /> Mostrar</>
                        ) : (
                          <><EyeOff className="w-3 h-3" /> Ocultar</>
                        )}
                      </button>
                    )}
                  </div>
                  <h3 className="font-display font-black text-white text-base uppercase tracking-tight">Atletas Escala Geral</h3>
                </div>

                {/* Roster Counters badge */}
                <div className="flex items-center gap-2 text-[10px] font-mono font-black">
                  <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg uppercase tracking-wide">
                    ✓ {confirmedPlayers.length} Confirmados
                  </span>
                  <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-lg uppercase tracking-wide">
                    ✗ {cancelPlayers.length} Ausentes
                  </span>
                </div>
              </div>

              {(!isRosterBlockCollapsed || nextMatch?.status !== 'sorteada') && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Premium Filter Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-900/90">
                    {(['todos', 'confirmados', 'pendentes', 'cancelados'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setRosterFilter(tab)}
                        className={`py-2 rounded-lg font-mono font-black text-[9.5px] uppercase tracking-wider cursor-pointer transition-all duration-150 active:scale-[0.95] ${
                          rosterFilter === tab
                            ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/30'
                        }`}
                      >
                        {tab === 'todos' ? 'Geral' : tab === 'confirmados' ? 'Confirmados' : tab === 'pendentes' ? 'Pendentes' : 'Ausentes'}
                      </button>
                    ))}
                  </div>

                  {/* Grid display of roster players */}
                  <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    {filteredList.length > 0 ? (
                      filteredList.map((p: any) => {
                        const playerObj = players.find((pl: any) => pl.id === p.playerId);
                        const isCap = playerObj?.isCaptain === true;

                        const statusTheme = p.presenceStatus === 'confirmado'
                          ? { text: 'Confirmado', textClass: 'text-emerald-400', badge: 'bg-emerald-500/5 border-emerald-500/15' }
                          : p.presenceStatus === 'cancelado'
                            ? { text: 'Cancelado', textClass: 'text-rose-400', badge: 'bg-rose-500/5 border-rose-500/15' }
                            : { text: 'Pendente', textClass: 'text-amber-400', badge: 'bg-amber-500/5 border-amber-500/15' };

                        return (
                          <div 
                            key={p.playerId} 
                            className="flex items-center justify-between p-3 bg-zinc-950/70 border border-zinc-900/80 hover:border-zinc-800 rounded-xl transition duration-250 shadow-sm"
                          >
                            <div className="flex items-center gap-3.5 truncate max-w-[65%]">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 uppercase shrink-0`}>
                                {p.name.slice(0, 2)}
                              </div>
                              <div className="space-y-0.5 truncate">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-sans font-extrabold text-xs truncate block">{p.name}</span>
                                  {isCap && <span className="text-[10px] text-amber-500 shadow-sm" title="Capitão">⭐</span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-zinc-500 uppercase">
                                  <span className="text-zinc-400">
                                    {playerObj ? POSITION_LABELS[playerObj.primaryPosition as keyof typeof POSITION_LABELS] : 'Jogador'}
                                  </span>
                                  <span>•</span>
                                  <span className="bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-850">
                                    OVR {(() => {
                                      const sum = summaries.find((s: any) => s.playerId === playerObj?.id);
                                      return sum ? sum.overall.toFixed(1) : '3.5';
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Right actions: admin manually override, or standard user badge */}
                            <div className="flex items-center gap-2">
                              {isAdmin && matchState === 'CONFIRMACOES_ABERTAS' ? (
                                <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-black">
                                  <button
                                    type="button"
                                    onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                    className={`px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-[0.95] cursor-pointer ${
                                      p.presenceStatus === 'confirmado'
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                                        : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-750'
                                    }`}
                                  >
                                    Vou
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                    className={`px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-[0.95] cursor-pointer ${
                                      p.presenceStatus === 'cancelado'
                                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-black'
                                        : 'bg-zinc-950 border-zinc-850 text-zinc-500 hover:text-zinc-300 hover:border-zinc-750'
                                    }`}
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <span className={`text-[9px] font-mono font-black border uppercase px-3 py-1 rounded-lg ${statusTheme.badge} ${statusTheme.textClass}`}>
                                  {statusTheme.text}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-10 bg-zinc-950/20 rounded-xl border border-dashed border-zinc-900">
                        <p className="text-zinc-500 italic text-xs font-sans">
                          Nenhum atleta listado neste filtro da chamada.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (Span 4): Fila de Espera, Reservas e Administração */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. RESERVAS & FILA DE ESPERA (Only if reservations exist or active) */}
          {isDeadlineExpired && (
            <div className="sports-card border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-2xl animate-fadeIn" id="reserves-queue-panel">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900/75">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Fila de Reservas</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-lg border border-indigo-500/25">
                  Qtd: {(reserveQueue?.queue?.length || 0) + (reserveQueue?.activeConvocation ? 1 : 0)}
                </span>
              </div>

            <div className="space-y-3">
              {/* Active convocation (highest priority) */}
              {reserveQueue?.activeConvocation && (() => {
                const convPlayer = reserveQueue.activeConvocation;
                const playerObj = players.find(p => p.id === convPlayer.playerId);
                const isMyConvocation = resolvedPlayerId === convPlayer.playerId;

                return (
                  <div 
                    className="p-4 rounded-xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/15 via-zinc-950/90 to-indigo-950/5 font-mono text-xs space-y-3.5 shadow-[0_0_15px_rgba(99,102,241,0.05)] animate-pulse"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded uppercase tracking-wider block w-fit">
                          Convocação Ativa
                        </span>
                        <span className="text-white font-sans font-black text-xs block">{convPlayer.playerName}</span>
                      </div>
                      <span className="text-[9px] text-indigo-400 font-bold bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-900/50">
                        {playerObj ? POSITION_LABELS[playerObj.primaryPosition as keyof typeof POSITION_LABELS] : 'Jogador'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-indigo-400 font-bold">
                        <span className="flex items-center gap-1">⚡ Vaga Disponível:</span>
                        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[8.5px] font-black uppercase">Aguardando</span>
                      </div>

                      {/* Quick athlete RSVP in case it's them */}
                      {isMyConvocation && (
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRespondReserveConvocation(convPlayer.id, 'confirmado')}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-2 rounded-lg text-[10px] uppercase cursor-pointer shadow-lg shadow-indigo-500/10 transition-all active:scale-95"
                          >
                            Aceitar Vaga
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondReserveConvocation(convPlayer.id, 'recusado')}
                            className="flex-1 bg-zinc-950 hover:bg-zinc-900 text-rose-400 font-black py-2 rounded-lg text-[10px] uppercase border border-zinc-850 cursor-pointer transition-all active:scale-95"
                          >
                            Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Waiting list queue */}
              {reserveQueue?.queue && reserveQueue.queue.length > 0 ? (
                <>
                  {reserveQueue.queue.slice(0, 2).map((item: any, index: number) => {
                    const playerObj = players.find(p => p.id === item.id);

                    return (
                      <div 
                        key={item.id} 
                        className="p-3.5 rounded-xl border bg-zinc-950/85 border-zinc-900/90 hover:border-zinc-800 font-mono text-xs space-y-3 transition duration-200"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[10px] font-mono font-black bg-zinc-900 text-indigo-400 border border-indigo-500/10 px-2 py-0.5 rounded-md">
                              #{index + 1}
                            </span>
                            <span className="text-white font-sans font-extrabold text-xs">{item.name}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-bold uppercase">
                            {playerObj ? POSITION_LABELS[playerObj.primaryPosition as keyof typeof POSITION_LABELS] : 'Jogador'}
                          </span>
                        </div>

                        {/* Admin quick summon actions */}
                        {isAdmin && matchState === 'CONFIRMACOES_ABERTAS' && (
                          <div className="flex gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleSummonNextReserve()}
                              className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-emerald-400 border border-zinc-850 rounded-lg py-1.5 text-[9px] uppercase font-black cursor-pointer transition-all duration-200 active:scale-[0.96]"
                            >
                              Convocar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIgnoreReservePlayer(item.id)}
                              className="bg-zinc-900 hover:bg-zinc-850 text-rose-400 border border-zinc-850 rounded-lg px-3 py-1.5 text-[9px] uppercase font-black cursor-pointer transition-all duration-200 active:scale-[0.96]"
                            >
                              Pular
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {reserveQueue.queue.length > 2 && (
                    <div className="text-center py-2 px-3 bg-zinc-950/40 rounded-xl border border-dashed border-zinc-900/50">
                      <p className="text-zinc-500 text-[10px] font-mono">
                        + {reserveQueue.queue.length - 2} {reserveQueue.queue.length - 2 === 1 ? 'atleta ocultado' : 'atletas ocultados'} na fila...
                      </p>
                    </div>
                  )}
                </>
              ) : (
                !reserveQueue?.activeConvocation && (
                  <div className="text-center py-6 bg-zinc-950/20 rounded-xl border border-dashed border-zinc-900/60">
                    <p className="text-zinc-500 italic text-[11px] font-sans font-bold">
                      Nenhum atleta na fila de reservas.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
          )}

          {/* 2. ADMIN PORTAL */}
          {isAdmin && renderPainelAdministrativo()}
        </div>
      </div>
    );
  };

  const renderSocialBento = () => {
    return (
      <div className="space-y-6" id="central-da-rodada-social-bento">
        {/* LINE 1: Club Treasury & Upcoming Social Events */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TREASURY & USER BILLS Card */}
          <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col justify-between space-y-5" id="club-finance-bento">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-900/85">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Caixa do Clube</h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono tracking-wider font-extrabold uppercase">
                  Tesouraria Geral
                </span>
              </div>

              {/* User personal pending sum badge indicator */}
              <div className="flex justify-between items-center bg-zinc-950 p-4 rounded-xl border border-zinc-900 font-mono shadow-inner">
                <span className="text-zinc-400 text-xs uppercase font-black font-sans">Minhas Pendências:</span>
                {(() => {
                  const myUserBills = finData?.bills || [];
                  const userPendingTotal = myUserBills
                    .filter((b: any) => b.status === 'pendente')
                    .reduce((sum: number, b: any) => sum + b.amount, 0);

                  if (userPendingTotal > 0) {
                    return (
                      <span className="text-[10px] font-mono font-black text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/25 uppercase animate-pulse">
                        R$ {userPendingTotal.toFixed(2)} Em Aberto
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/25 uppercase">
                        Nenhuma Pendência 🎉
                      </span>
                    );
                  }
                })()}
              </div>

              {/* General Health statistics without showing debtor names */}
              <div className="space-y-3 bg-zinc-950/80 p-4 rounded-xl border border-zinc-900 font-mono shadow-inner">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-black block font-sans">
                  Saúde Financeira do Grupo
                </span>
                <div className="grid grid-cols-3 gap-3 text-center pt-1.5 text-zinc-400">
                  <div className="space-y-1 p-2 rounded-lg bg-zinc-900/35 border border-zinc-900/50">
                    <span className="text-[9px] text-zinc-500 uppercase block font-sans font-bold">Previsto</span>
                    <span className="text-white font-mono font-black text-[13px] block">R$ {Math.round(finData?.health?.totalExpected || 0)}</span>
                  </div>
                  <div className="space-y-1 p-2 rounded-lg bg-zinc-900/35 border border-zinc-900/50">
                    <span className="text-[9px] text-emerald-400 uppercase block font-sans font-bold">Recebido</span>
                    <span className="text-emerald-400 font-mono font-black text-[13px] block">R$ {Math.round(finData?.health?.totalReceived || 0)}</span>
                  </div>
                  <div className="space-y-1 p-2 rounded-lg bg-zinc-900/35 border border-zinc-900/50">
                    <span className="text-[9px] text-amber-500 uppercase block font-sans font-bold">Aberto</span>
                    <span className="text-amber-400 font-mono font-black text-[13px] block">R$ {Math.round(finData?.health?.totalPending || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-relaxed font-sans pt-2 border-t border-zinc-900/60">
              Contribua em dia para garantir a renovação do aluguel da quadra, coletes e bolas. A prestação de contas é pública e transparente.
            </p>
          </div>

          {/* EVENTOS E CHURRASCOS Card */}
          <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl space-y-5 flex flex-col justify-between" id="club-events-panel">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3.5 border-b border-zinc-900/80">
                <Gift className="w-5 h-5 text-rose-500" />
                <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">
                  Eventos & Confraternizações
                </h3>
              </div>

              <div className="space-y-3.5">
                {activeEvents.length > 0 ? (
                  activeEvents.slice(0, 2).map((evt) => (
                    <div key={evt.id} className="p-4 bg-zinc-950/70 border border-zinc-900 rounded-xl font-mono text-[11px] space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-white font-sans font-black text-xs truncate block">{evt.title}</span>
                        <span className="text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 rounded-md text-[9px] uppercase shrink-0 font-bold tracking-wider">
                          🎉 Social
                        </span>
                      </div>
                      <p className="text-zinc-400 leading-relaxed text-[11px] line-clamp-2 font-sans">{evt.description}</p>
                      
                      <div className="flex items-center justify-between text-[9px] pt-2 text-zinc-500 border-t border-zinc-900/50">
                        <span>Local: <strong className="text-zinc-300 font-bold">{evt.location}</strong></span>
                        <span>Confirmados: <strong className="text-emerald-400 font-black">{evt.attendeesCount || 0}</strong></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center italic text-zinc-600 font-sans py-8 text-xs">
                    Nenhum churrasco oficial agendado. Que tal sugerir um racha festivo?
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-mono leading-relaxed pt-2 border-t border-zinc-900/60">
              💡 Rateios e confirmações de churrasco direto com a tesouraria. Garanta sua carne contribuindo em dia!
            </p>
          </div>
        </div>

        {/* LINE 2: Highlight Post & Season Stats Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DESTAQUE DA SEMANA Card */}
          {highlightPost ? (
            <div 
              className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col justify-between space-y-5 hover:border-zinc-750 transition-all duration-300 relative overflow-hidden animate-fadeIn"
              onMouseEnter={() => setIsHoveredHighlight(true)}
              onMouseLeave={() => setIsHoveredHighlight(false)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Destaque da Semana</h3>
                  </div>
                  <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                    🔥 Em Destaque
                  </span>
                </div>

                {highlightPost.imageUrl && (
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 shadow-inner">
                    <img 
                      src={highlightPost.imageUrl} 
                      alt={highlightPost.title}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover transition-transform duration-700 ${isHoveredHighlight ? 'scale-105' : 'scale-100'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent flex items-end p-5">
                      <h4 className="text-white font-display font-black text-sm sm:text-base leading-tight uppercase tracking-tight line-clamp-2">
                        {highlightPost.title}
                      </h4>
                    </div>
                  </div>
                )}

                <p className="text-zinc-400 font-sans text-xs leading-relaxed line-clamp-3 pt-1">
                  {highlightPost.content}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3.5 text-[10px] text-zinc-500 font-mono border-t border-zinc-900/60">
                <span>Por: <strong className="text-emerald-400 font-black">{highlightPost.authorName}</strong></span>
                <span>{new Date(highlightPost.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ) : (
            <div className="sports-card border border-zinc-800 rounded-2xl p-8 text-center flex flex-col justify-center items-center space-y-3 shadow-2xl min-h-[320px]">
              <Sparkles className="w-10 h-10 text-zinc-700 animate-pulse" />
              <h4 className="text-zinc-400 font-display font-black text-xs uppercase tracking-wider">Sem Mural da Semana</h4>
              <p className="text-[11px] text-zinc-500 font-mono max-w-xs leading-relaxed">Tire uma foto no racha desta rodada e compartilhe para brilhar no destaque da semana!</p>
            </div>
          )}

          {/* SEASONAL ALL-STARS & STATS BENTO */}
          <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col justify-between space-y-5" id="club-stats-bento">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3.5 border-b border-zinc-900/80">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">
                  Destaques da Temporada
                </h3>
              </div>

              {/* SELEÇÃO DA TEMPORADA (All-Star Top 5) */}
              <div className="w-full bg-emerald-950/5 border border-emerald-500/10 rounded-xl p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                  <span className="text-[10px] text-amber-500 uppercase tracking-wider font-black flex items-center gap-1 font-mono">
                    ⭐ Seleção da Temporada
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono font-black">TOP 5 PERFORMANCE</span>
                </div>
                {allStarTeam.length > 0 ? (
                  <div className="space-y-2">
                    {allStarTeam.map((p: any) => (
                      <div key={p.playerId} className="flex justify-between items-center text-[11px] py-0.5 border-b border-zinc-900/35 last:border-0 pb-1.5 last:pb-0">
                        <div className="flex items-center gap-2.5 font-mono">
                          <span className="text-amber-400 font-black w-7 text-left bg-zinc-950 px-1 py-0.5 rounded-md text-[9px] text-center border border-zinc-850">
                            {p.slotLabel}
                          </span>
                          <span className="text-white font-sans font-bold truncate max-w-[130px]">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">
                          {p.vitorias}V ({p.aproveitamento}%)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center italic text-zinc-600 font-sans py-4 text-[10px]">
                    Partidas insuficientes para consolidar os destaques.
                  </div>
                )}
              </div>

              {/* Bento Grid: 4 micro-KPI cards */}
              <div className="grid grid-cols-2 gap-2.5 text-[10.5px] font-mono">
                {/* Duo KPI */}
                <div className="bg-zinc-950/70 border border-zinc-900/80 hover:border-zinc-700/60 hover:scale-[1.02] rounded-xl p-3 flex flex-col justify-between min-h-[95px] transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/5">
                  <div>
                    <span className="text-[9px] text-sky-400 uppercase tracking-wider font-black block">🤝 Duo Forte</span>
                    <h4 className="text-white text-[11px] font-black mt-1 truncate font-sans">
                      {stats && stats.duos && stats.duos.length > 0 
                        ? `${stats.duos[0].playerAName.split(' ')[0]} + ${stats.duos[0].playerBName.split(' ')[0]}` 
                        : 'Sem dados'}
                    </h4>
                  </div>
                  {stats && stats.duos && stats.duos.length > 0 ? (
                    <div className="text-zinc-500 text-[9px] font-bold">
                      💪 {stats.duos[0].wonTogether || stats.duos[0].winsCount || 0}V ({stats.duos[0].aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[8px]">Sem dados...</span>
                  )}
                </div>

                {/* Trio KPI */}
                <div className="bg-zinc-950/70 border border-zinc-900/80 hover:border-zinc-700/60 hover:scale-[1.02] rounded-xl p-3 flex flex-col justify-between min-h-[95px] transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5">
                  <div>
                    <span className="text-[9px] text-purple-400 uppercase tracking-wider font-black block">🚀 Trio Forte</span>
                    <div className="text-white text-[10px] font-black mt-1 truncate font-sans">
                      {stats && stats.trios && stats.trios.length > 0 ? (
                        <span>{stats.trios[0].playerAName.split(' ')[0]} + {stats.trios[0].playerBName.split(' ')[0]}</span>
                      ) : (
                        <span>Sem dados</span>
                      )}
                    </div>
                  </div>
                  {stats && stats.trios && stats.trios.length > 0 ? (
                    <div className="text-zinc-500 text-[9px] font-bold">
                      🔥 {stats.trios[0].wonTogether || stats.trios[0].winsCount || 0}V ({stats.trios[0].aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[8px]">Sem dados...</span>
                  )}
                </div>

                {/* Streak KPI */}
                <div className="bg-zinc-950/70 border border-zinc-900/80 hover:border-zinc-700/60 hover:scale-[1.02] rounded-xl p-3 flex flex-col justify-between min-h-[95px] transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5">
                  <div>
                    <span className="text-[9px] text-amber-500 uppercase tracking-wider font-black block">👑 Invencibilidade</span>
                    <h4 className="text-white text-[11px] font-black mt-1 truncate font-sans">
                      {streakRecordHolder && streakRecordHolder.maxStreak > 0 
                        ? streakRecordHolder.name.split(' ')[0] 
                        : 'Sem dados'}
                    </h4>
                  </div>
                  {streakRecordHolder && streakRecordHolder.maxStreak > 0 ? (
                    <div className="text-zinc-500 text-[9px] font-bold">
                      🔥 Recorde: {streakRecordHolder.maxStreak}V
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[8px]">Sem dados...</span>
                  )}
                </div>

                {/* Keeper KPI */}
                <div className="bg-zinc-950/70 border border-zinc-900/80 hover:border-zinc-700/60 hover:scale-[1.02] rounded-xl p-3 flex flex-col justify-between min-h-[95px] transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/5">
                  <div>
                    <span className="text-[9px] text-rose-400 uppercase tracking-wider font-black block">🧤 Muralha Goleiro</span>
                    <h4 className="text-white text-[11px] font-black mt-1 truncate font-sans">
                      {bestKeeper ? bestKeeper.name.split(' ')[0] : 'Sem dados'}
                    </h4>
                  </div>
                  {bestKeeper ? (
                    <div className="text-zinc-500 text-[9px] font-bold">
                      🧤 {bestKeeper.vitorias}V/{bestKeeper.presences}J ({bestKeeper.aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-[8px]">Falta dados</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPortalsAndModals = () => {
    return (
      <>
        {/* CUSTOM STATE-BASED CONFIRMATION MODAL */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative p-5 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h4 className="font-display font-bold text-sm uppercase tracking-wide text-white">
                  {confirmModal.title}
                </h4>
              </div>
              <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3 pt-2 font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white py-2 rounded-lg border border-zinc-800 transition cursor-pointer text-center uppercase text-[10px] tracking-wider"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="flex-1 bg-rose-950/45 hover:bg-rose-900 border border-rose-500/25 text-rose-400 hover:text-white py-2 rounded-lg transition cursor-pointer text-center uppercase text-[10px] tracking-wider"
                >
                  {confirmModal.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ASSISTENTE DE VINCULAÇÃO MODAL */}
        {unlinkedUserToResolve && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-5 space-y-4 font-mono text-xs text-zinc-300">
              <div className="flex items-center gap-2 text-emerald-400 pb-2 border-b border-zinc-850">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <h4 className="font-display font-black text-[13px] uppercase tracking-wide text-white">
                  Assistente de Vinculação de Atleta
                </h4>
              </div>

              <div className="space-y-1.5 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                <span className="text-zinc-500 text-[9px] uppercase tracking-wider block font-bold">Usuário Solicitante</span>
                <p className="text-white font-sans font-bold text-[13px]">{unlinkedUserToResolve.name}</p>
                <p className="text-zinc-400 text-[10.5px]">E-mail: {unlinkedUserToResolve.email || 'Não informado'}</p>
                <p className="text-zinc-400 text-[10.5px]">Função original: {unlinkedUserToResolve.role}</p>
              </div>

              {/* Smart matches analysis */}
              {(() => {
                const suggested = getSuggestedPlayer(unlinkedUserToResolve, players);
                return (
                  <div className="space-y-3 pt-1">
                    {suggested ? (
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/25 rounded-lg space-y-2">
                        <span className="text-[#4ade80] text-[9.5px] font-black uppercase block tracking-wider">💡 Sugestão Inteligente Encontrada</span>
                        <p className="text-white text-[12px] font-semibold">Identificamos o atleta existente: <strong className="text-emerald-400 font-extrabold">{suggested.name}</strong></p>
                        <button
                          type="button"
                          onClick={() => handleLinkUserToPlayer(unlinkedUserToResolve, suggested.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest transition cursor-pointer shadow hover:scale-[1.01] active:scale-95"
                        >
                          Vincular com {suggested.name.split(' ')[0]}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-lg text-center text-zinc-400 italic">
                        Nenhuma ficha correspondente foi detectada com inteligência de nome ou e-mail.
                      </div>
                    )}

                    <div className="space-y-2 pt-1 border-t border-zinc-900/60">
                      <span className="text-zinc-500 text-[9px] uppercase tracking-wider block font-bold">Vincular Manualmente</span>
                      <select
                        value={selectedManualPlayerId}
                        onChange={(e) => setSelectedManualPlayerId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2.5 font-mono text-[11px] focus:outline-none focus:border-zinc-700"
                      >
                        <option value="">-- Selecione uma Ficha de Atleta --</option>
                        {[...players]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((p) => {
                            const linkedUser = allUsersList.find(u => u.playerId === p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} {linkedUser ? `(⚠️ Já de: ${linkedUser.name})` : ''}
                              </option>
                            );
                          })}
                      </select>

                      <button
                        type="button"
                        disabled={!selectedManualPlayerId || actionLoading}
                        onClick={() => handleLinkUserToPlayer(unlinkedUserToResolve, selectedManualPlayerId)}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest transition cursor-pointer border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Confirmar Vínculo Manual
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2.5 pt-3 border-t border-zinc-90 w-full text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setIgnoredUserIds((prev) => [...prev, unlinkedUserToResolve.id]);
                    setUnlinkedUserToResolve(null);
                  }}
                  className="flex-1 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 py-2 rounded-lg transition cursor-pointer text-center uppercase tracking-wider"
                >
                  Ignorar
                </button>
                <button
                  type="button"
                  onClick={() => setUnlinkedUserToResolve(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white py-2 rounded-lg border border-zinc-800 transition cursor-pointer text-center uppercase tracking-wider"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GRAVAÇÃO DE PLACAR MODAL */}
        {showDashboardPlacarModal && nextMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn" id="dashboard-score-modal">
            <div className="w-full max-w-md bg-[#0b0f0d] border border-emerald-900/30 rounded-2xl p-6 shadow-2xl space-y-4 font-mono text-zinc-300">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                  <span className="font-display font-extrabold text-sm text-white uppercase tracking-wider">🏆 Gravar Placar do Racha</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDashboardPlacarModal(false)}
                  className="text-zinc-500 hover:text-white transition text-xs font-bold bg-zinc-900 hover:bg-zinc-850 p-1.5 rounded-lg border border-zinc-800"
                >
                  ✕
                </button>
              </div>

              <div className="text-[11px] leading-relaxed font-sans text-zinc-400">
                Registre a quantidade de vitórias de cada equipe e encerre oficialmente esta rodada do dia <span className="text-white font-semibold">{nextMatch.date.split('-').reverse().join('/')}</span>. Esta ação irá persistir os times de hoje e atualizar o ranking histórico.
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-3 text-center space-y-2">
                  <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">🔵 AZUL</label>
                  <input
                    type="number"
                    min="0"
                    value={winsBlueInput}
                    onChange={(e) => setWinsBlueInput(e.target.value)}
                    className="w-full bg-[#121815] text-center text-white border border-zinc-800 rounded-lg py-2.5 text-lg font-black focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 text-center space-y-2 font-mono">
                  <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest">🔴 VERMELHO</label>
                  <input
                    type="number"
                    min="0"
                    value={winsRedInput}
                    onChange={(e) => setWinsRedInput(e.target.value)}
                    className="w-full bg-[#121815] text-center text-white border border-zinc-800 rounded-lg py-2.5 text-lg font-black focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div className="bg-emerald-950/25 border border-emerald-500/20 rounded-xl p-3 text-center space-y-2 font-mono">
                  <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest">🟢 VERDE</label>
                  <input
                    type="number"
                    min="0"
                    value={winsGreenInput}
                    onChange={(e) => setWinsGreenInput(e.target.value)}
                    className="w-full bg-[#121815] text-center text-white border border-zinc-800 rounded-lg py-2.5 text-lg font-black focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg text-center leading-relaxed">
                  ⚠️ {errorMsg}
                </p>
              )}

              <div className="flex gap-3 pt-3 border-t border-zinc-900 text-xs uppercase tracking-wider font-extrabold font-mono">
                <button
                  type="button"
                  onClick={() => setShowDashboardPlacarModal(false)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white py-3 rounded-xl border border-zinc-800 transition cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    try {
                      await handleQuickSaveResult(nextMatch.id);
                      setShowDashboardPlacarModal(false);
                      window.dispatchEvent(new CustomEvent('match-status-changed'));
                    } catch (err) {
                      // error handled in handleQuickSaveResult
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl transition cursor-pointer text-center flex items-center justify-center gap-1.5 shadow shadow-emerald-600/20 disabled:opacity-50"
                >
                  {actionLoading ? 'Gravando...' : 'Gravar Placar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 flex flex-col pt-2 pb-12 animate-pulse" id="dashboard-status-loading-skeleton">
        {/* 1. SPORTS HERO LAYER SKELETON */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-900 pb-4">
            <div className="h-4 bg-zinc-800 rounded w-28" />
            <div className="h-6 bg-zinc-800 rounded-lg w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7 space-y-4">
              <div className="h-3 bg-zinc-800 rounded w-24" />
              <div className="h-10 bg-zinc-800 rounded-xl w-3/4" />
              <div className="h-6 bg-zinc-800 rounded-lg w-1/2" />
            </div>
            <div className="md:col-span-5 bg-zinc-950 border border-zinc-900/60 p-5 rounded-xl space-y-4 shadow">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-center">
                  <div className="h-2 bg-zinc-800 rounded w-12 mx-auto" />
                  <div className="h-8 bg-zinc-900 rounded-lg w-full" />
                </div>
                <div className="space-y-2 text-center">
                  <div className="h-2 bg-zinc-800 rounded w-12 mx-auto" />
                  <div className="h-8 bg-zinc-900 rounded-lg w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PRIMARY CTA SKELETON */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/25 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <div className="h-2 bg-zinc-800 rounded w-24" />
              <div className="h-4 bg-zinc-800 rounded w-48" />
            </div>
            <div className="h-8 bg-zinc-800 rounded-lg w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-12 bg-zinc-800 rounded-xl w-full" />
            <div className="h-12 bg-zinc-800 rounded-xl w-full" />
          </div>
        </div>

        {/* 3. CORE 2-COLUMN RESPONSIVE GRID SKELETON */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Player list */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-2xl border border-zinc-800 p-6 space-y-6 bg-zinc-950/20">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div className="h-4 bg-zinc-800 rounded w-36" />
                <div className="h-4 bg-zinc-800 rounded w-24" />
              </div>
              <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-900">
                <div className="h-8 bg-zinc-900 rounded-lg" />
                <div className="h-8 bg-transparent rounded-lg" />
                <div className="h-8 bg-transparent rounded-lg" />
                <div className="h-8 bg-transparent rounded-lg" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-zinc-950/40 border border-zinc-900/60 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3 bg-zinc-800 rounded w-28" />
                        <div className="h-2 bg-zinc-800 rounded w-16" />
                      </div>
                    </div>
                    <div className="h-6 bg-zinc-850 rounded-lg w-16 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Bento Widgets */}
          <div className="lg:col-span-4 space-y-6">
            {/* Treasury card skeleton */}
            <div className="rounded-2xl border border-zinc-800 p-6 space-y-5 bg-zinc-950/40">
              <div className="h-4 bg-zinc-800 rounded w-24 border-b border-zinc-900 pb-3" />
              <div className="h-12 bg-zinc-950 rounded-xl border border-zinc-900" />
              <div className="h-20 bg-zinc-950/80 rounded-xl border border-zinc-900" />
            </div>
            {/* Events card skeleton */}
            <div className="rounded-2xl border border-zinc-800 p-6 space-y-4 bg-zinc-950/40">
              <div className="h-4 bg-zinc-800 rounded w-32 border-b border-zinc-900 pb-3" />
              <div className="h-16 bg-zinc-950 rounded-xl border border-zinc-900" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusLabel = (stateNum: number) => {
    switch (stateNum) {
      case 1: return "Agendada";
      case 2: return "Confirmações Abertas";
      case 3: return "Lista Quase Completa";
      case 4: return "Lista Fechada";
      case 5: return "Sorteio Realizado";
      case 6: return "Dia de Racha";
      case 7: return "Jogo Encerrado (Aguardando Placar)";
      case 8: return "Avaliações Abertas";
      case 9: return "Resultado Consolidado";
      case 10: return "Museu & Galeria Atualizados";
      default: return "Aguardando";
    }
  };

  const getAthleteStatus = () => {
    if (myPresence === 'confirmado') return 'confirmado';
    if (myPresence === 'cancelado') return 'indisponível';
    if (currentUserCategory === 'reserva' && myPresence === 'nao_confirmado') return 'reserva';
    return 'aguardando';
  };

  return (
    <div className="space-y-6 flex flex-col pt-2 pb-12 animate-fadeIn" id="dashboard-status-main-container">
      {/* SUCCESS & ERROR MESSAGE FLOATING NOTIFICATIONS */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex justify-between items-center animate-fadeIn shrink-0">
          <span className="font-mono">✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-zinc-900 rounded font-bold text-[10px] w-6 h-6 flex items-center justify-center">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex justify-between items-center animate-fadeIn shrink-0">
          <span className="font-mono">⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-zinc-900 rounded font-bold text-[10px] w-6 h-6 flex items-center justify-center">✕</button>
        </div>
      )}

      {/* 1. Hero da Rodada */}
      {renderSportsHero()}

      {/* 2 & 3 & 4. CORE GRID: Lista Principal, Reservas, Área Dinâmica da Rodada */}
      {nextMatch && activeStateNum < 10 ? (
        <div className="space-y-6">
          {renderPrimaryCTA()}
          {renderCoreGrid()}
        </div>
      ) : (!nextMatch || activeStateNum === 10) ? (
        renderClosedMuseumScreen()
      ) : null}

      {/* SOCIAL BENTO: Eventos & Churrascos */}
      {renderSocialBento()}

      {/* PORTALS & MODALS */}
      {renderPortalsAndModals()}
    </div>
  );
}

