import React, { useState, useEffect } from 'react';
import { User, PresenceStatus, CATEGORY_LABELS, POSITION_LABELS, Player, FAVORITE_TEAMS } from '../types';
import { getAchievementsForPlayer, getMostRecentAchievement } from '../utils/achievements';
import { getRoundStatus } from '../utils/roundStatus';
import { 
  Calendar, MapPin, Clock, Trophy, AlertCircle, ArrowUpRight, Check, 
  Users, Users2, Shield, Sparkles, X, ChevronDown, ChevronUp, BellRing,
  CheckCircle2, AlertTriangle, ArrowDownAZ, VolumeX, Flame, Gift, Compass, Settings,
  Baby, User as UserIcon, Share2, Crown
} from 'lucide-react';

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
}

export default function DashboardStatus({
  currentUser,
  onNavigateToPlayers,
  onNavigateToApprovals,
  onNavigateToFinances,
  pendingApprovalsCount
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
        const activeMatches = matches.filter((m: any) => 
          ['agendada', 'confirmando', 'aguardando_reservas', 'fechada', 'sorteada'].includes(m.status) &&
          m.lifecycleState !== 'ARCHIVED' &&
          m.lifecycleState !== 'MATCH_FINISHED'
        );
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
  const todayStr = new Date().toISOString().split('T')[0];
  const pastMatchesWithoutResults = allMatches.filter((m: any) => {
    return m.date < todayStr && m.status !== 'encerrada' && !m.hasResults;
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
    if (!nextMatch) {
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

    const formattedDate = nextMatch.date.split('-').reverse().join('/');
    const timeRemainingStr = nextMatch.hoursRemaining !== undefined && nextMatch.hoursRemaining > 0
      ? nextMatch.hoursRemaining <= 2
        ? '⚠️ ÚLTIMAS HORAS'
        : `⌛ FALTAM ${Math.floor(nextMatch.hoursRemaining)}H`
      : 'CONVOCO ENCERRADO';

    const getStatusTheme = () => {
      switch (matchState) {
        case 'CONFIRMACOES_ABERTAS':
          return { label: 'Inscrições Abertas', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.06)]' };
        case 'RACHA_FECHADO':
          return { label: 'Racha Fechado', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' };
        case 'SORTEIO_REALIZADO':
          return { label: 'Sorteio Realizado', color: 'text-sky-400 bg-sky-500/10 border-sky-500/25' };
        case 'PARTIDA_ENCERRADA':
          return { label: 'Partida Finalizada', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' };
        case 'AGENDADO':
        default:
          return { label: 'Partida Agendada', color: 'text-zinc-400 bg-zinc-900/50 border-zinc-800' };
      }
    };

    const statusTheme = getStatusTheme();

    return (
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/20 p-6 md:p-8 shadow-2xl turf-glow field-decor" id="central-da-rodada-hero">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top bar with phase and countdown */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow shadow-emerald-400"></span>
            </div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">Central da Rodada</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-mono font-black px-3 py-1 rounded-lg border uppercase tracking-wide flex items-center gap-1.5 ${statusTheme.color}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusTheme.label}
            </span>
            {matchState === 'CONFIRMACOES_ABERTAS' && (
              <span className="text-[10px] font-mono font-black bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-lg animate-pulse tracking-wide">
                {timeRemainingStr}
              </span>
            )}
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
            <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight leading-none">
              Sábado de Racha <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 inline-block font-black font-display uppercase tracking-tight shadow-[0_0_15px_rgba(16,185,129,0.1)] mt-1 sm:mt-0">@ {nextMatch.location?.split(' ')[0] || 'Arena'}</span>
            </h1>
            <p className="text-zinc-400 text-xs flex items-center gap-2 font-mono bg-zinc-900/30 py-1.5 px-2.5 rounded-lg border border-zinc-900/50 max-w-max">
              <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="truncate">{nextMatch.location || 'Local do racha'}</span>
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
                  {nextMatch.time}
                </span>
              </div>
            </div>

            {/* Roster slots indicator progress bar */}
            {matchState !== 'PARTIDA_ENCERRADA' && matchState !== 'AGENDADO' && (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                  <span className="font-bold">Vagas Disponíveis</span>
                  <span className="text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15">{confirmedCount} / {maxPlayersLimit} Confirmados</span>
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    style={{ width: `${Math.min((confirmedCount / maxPlayersLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPrimaryCTA = () => {
    if (!nextMatch) return null;
    if (matchState === 'PARTIDA_ENCERRADA') return null;

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

    return (
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-950/80 to-emerald-950/10 backdrop-blur-md p-6 space-y-5 shadow-2xl animate-fadeIn" id="athlete-rsvp-focus-cta">
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

        {/* Big tactile buttons */}
        {matchState === 'CONFIRMACOES_ABERTAS' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleRsvpHolder('confirmado')}
              className={`flex items-center justify-center gap-2.5 h-13 rounded-xl border font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                isConfirmed
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-500/40 text-white shadow-[0_4px_20px_-2px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] hover:scale-[1.01]'
                  : 'bg-zinc-950 hover:bg-emerald-950/30 border-zinc-850 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-350 hover:scale-[1.01]'
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
                  ? 'bg-gradient-to-r from-rose-950 to-rose-900/85 border-rose-500/40 text-rose-400 hover:scale-[1.01] shadow-[0_4px_20px_-2px_rgba(244,63,94,0.15)]'
                  : 'bg-zinc-950 hover:bg-rose-950/10 border-zinc-850 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 hover:scale-[1.01]'
              }`}
            >
              <X className="w-5 h-5" />
              {actionLoading ? 'Gravando...' : isCancelled ? 'Ausente! (Alterar)' : 'Declarar Ausência (Não Vou)'}
            </button>
          </div>
        )}

        {/* Waitlist priority logic for Reserves */}
        {currentUserCategory === 'reserva' && !areReservesReleased && (
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2 text-left text-xs font-mono shadow-inner animate-fadeIn">
            <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
              <BellRing className="w-4 h-4 animate-bounce" />
              <span>Você está na Fila de Espera!</span>
            </div>
            <p className="text-zinc-400 text-[11px] leading-relaxed font-sans">
              As confirmações de mensalistas terminaram e você é o próximo da fila de reservas. Aguarde a liberação do administrador para confirmar sua vaga!
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderCoreGrid = () => {
    if (!nextMatch) return null;

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
          {/* STATE 1: PARTIDA_ENCERRADA - Resumo do Placar */}
          {matchState === 'PARTIDA_ENCERRADA' && (
            <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-2xl animate-fadeIn" id="match-results-scoreboard">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-2.5">
                  <Trophy className="w-5 h-5 text-amber-500 shadow-sm shadow-amber-500/20" />
                  <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Placar Final do Racha</h3>
                </div>
                <span className="text-[10px] font-mono font-black bg-amber-500/10 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-lg uppercase tracking-wide">
                  ✓ Finalizado
                </span>
              </div>

              {/* Real scores indicators */}
              <div className="grid grid-cols-3 gap-4 text-center bg-zinc-950/90 p-5 rounded-xl border border-zinc-900 shadow-inner">
                <div className="space-y-1.5 p-3 rounded-xl bg-sky-950/10 border border-sky-500/10">
                  <span className="text-xs text-sky-400 font-black block uppercase tracking-wider font-display">Time Azul</span>
                  <span className="text-4xl sm:text-5xl font-display font-black text-white tracking-tight">{nextMatch.winsBlue !== undefined ? nextMatch.winsBlue : '-'}</span>
                  <span className="text-[9px] text-zinc-500 font-mono font-bold block uppercase tracking-wider">Vitórias</span>
                </div>
                <div className="space-y-1.5 flex flex-col justify-center items-center">
                  <span className="text-zinc-500 font-display font-black text-xl sm:text-2xl italic tracking-tighter opacity-80">VS</span>
                  <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-widest font-black">Scoreboard</span>
                </div>
                <div className="space-y-1.5 p-3 rounded-xl bg-rose-950/10 border border-rose-500/10">
                  <span className="text-xs text-rose-400 font-black block uppercase tracking-wider font-display">Time Vermelho</span>
                  <span className="text-4xl sm:text-5xl font-display font-black text-white tracking-tight">{nextMatch.winsRed !== undefined ? nextMatch.winsRed : '-'}</span>
                  <span className="text-[9px] text-zinc-500 font-mono font-bold block uppercase tracking-wider">Vitórias</span>
                </div>
              </div>

              {/* Dynamic summary text if summaries exists */}
              {summaries && summaries.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-950/10 to-zinc-950/40 border border-emerald-900/30 p-5 rounded-xl space-y-2.5 shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest block font-mono">📝 Crônica do Racha</span>
                    <div className="h-px bg-emerald-500/20 flex-1" />
                  </div>
                  <p className="text-zinc-350 font-sans text-xs leading-relaxed italic pr-2">
                    "{summaries[0].summaryText}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STATE 2: SORTEIO_REALIZADO - Times Escalados no Campo */}
          {matchState === 'SORTEIO_REALIZADO' && matchDraw && matchDraw.teams && (
            <div className="space-y-6" id="tactical-teams-field-composer">
              <div className="flex items-center gap-2.5 pb-1 animate-fadeIn">
                <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h2 className="font-display font-black text-lg text-white uppercase tracking-tight">
                  Escalações Oficiais do Confronto
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {matchDraw.teams.map((team: any) => {
                  const teamPlayers = team.playerIds
                    .map((pid: string) => players.find(p => p.id === pid))
                    .filter(Boolean);

                  const teamOverall = team.name === 'Azul'
                    ? matchDraw.overallBlue
                    : team.name === 'Vermelho'
                      ? matchDraw.overallRed
                      : matchDraw.overallGreen;

                  const colorConfig = team.name === 'Azul'
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

                  const assignments = computeTacticalAssignments(teamPlayers);
                  const gks = teamPlayers.filter(p => assignments[p.id]?.position === 'goleiro');
                  const defs = teamPlayers.filter(p => assignments[p.id]?.position === 'zagueiro');
                  const mids = teamPlayers.filter(p => ['volante', 'meio_campo'].includes(assignments[p.id]?.position));
                  const atts = teamPlayers.filter(p => assignments[p.id]?.position === 'atacante');

                  const renderPlayerToken = (p: any) => {
                    const isCap = team.captainPlayerId === p.id;
                    const assignment = assignments[p.id] || { position: p.primaryPosition, isAdapted: false };

                    return (
                      <div key={p.id} className="flex flex-col items-center text-center space-y-1.5 bg-zinc-950/90 p-2.5 rounded-xl border border-zinc-900 shadow-md hover:border-zinc-800 hover:scale-105 transition duration-300">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-xs text-white uppercase shadow-inner border-2 ${colorConfig.badgeBg} ${colorConfig.badgeBorder}`}>
                            {p.name.slice(0, 2)}
                          </div>
                          {isCap && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black border border-zinc-950 rounded-full p-0.5 flex items-center justify-center w-5 h-5 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                              <Crown className="w-3 h-3 text-black fill-black" />
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-sans font-black text-zinc-100 block truncate max-w-[80px]">{p.name.split(' ')[0]}</span>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                              {POSITION_LABELS[p.primaryPosition as keyof typeof POSITION_LABELS] || 'MC'}
                            </span>
                            {assignment.isAdapted && (
                              <span className="text-[8px] font-mono font-black text-amber-500" title="Improvisado nesta posição">⚠️</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div key={team.id} className={`rounded-2xl border ${colorConfig.border} bg-zinc-950/40 overflow-hidden shadow-2xl transition duration-300 hover:shadow-emerald-500/[0.03] field-decor`}>
                      {/* Team Header */}
                      <div className={`px-5 py-4 border-b border-zinc-900/80 flex justify-between items-center ${colorConfig.header}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-base font-display font-black uppercase tracking-wider">
                            Time {team.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono text-[10px]">
                          <span className="text-zinc-500 font-bold uppercase tracking-wider">Equilíbrio:</span>
                          <span className="font-mono font-black text-white bg-zinc-950/80 px-2.5 py-1 rounded-lg border border-zinc-850">
                            {teamOverall ? Math.round(teamOverall) : 70} OVR
                          </span>
                        </div>
                      </div>

                      {/* Field Pitch Layout */}
                      <div className={`relative px-5 py-8 bg-gradient-to-b ${colorConfig.pitchBg} min-h-[320px] flex flex-col justify-between items-stretch gap-6`}>
                        {/* Grass Grid Decor lines */}
                        <div className="absolute inset-0 border-y border-dashed border-zinc-900/30 flex flex-col justify-around pointer-events-none">
                          <div className={`border-b border-dashed ${colorConfig.pitchLines} w-full opacity-30`} />
                          <div className={`border-b ${colorConfig.pitchLines} w-full opacity-40`} />
                          <div className={`border-b border-dashed ${colorConfig.pitchLines} w-full opacity-30`} />
                        </div>

                        {/* TIER 4: ATTACKERS */}
                        <div className="flex justify-center gap-4.5 z-10 min-h-[65px] items-center">
                          {atts.length > 0 ? atts.map(renderPlayerToken) : <span className="text-[10px] text-zinc-600 font-mono italic">Sem atacantes escalados</span>}
                        </div>

                        {/* TIER 3: MIDFIELDERS */}
                        <div className="flex justify-around gap-3.5 z-10 min-h-[65px] items-center">
                          {mids.length > 0 ? mids.map(renderPlayerToken) : <span className="text-[10px] text-zinc-600 font-mono italic">Sem meias escalados</span>}
                        </div>

                        {/* TIER 2: DEFENDERS */}
                        <div className="flex justify-around gap-3.5 z-10 min-h-[65px] items-center">
                          {defs.length > 0 ? defs.map(renderPlayerToken) : <span className="text-[10px] text-zinc-600 font-mono italic">Sem defensores escalados</span>}
                        </div>

                        {/* TIER 1: GOALKEEPER */}
                        <div className="flex justify-center z-10 min-h-[65px] items-center">
                          {gks.length > 0 ? gks.map(renderPlayerToken) : <span className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider italic bg-zinc-950/40 px-3 py-1.5 rounded-lg border border-zinc-900/50">Goleiro ausente</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: ROSTER LIST (Lista de Presença / Chamada) */}
          <div className="sports-card border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-2xl animate-fadeIn" id="match-roster-section">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900/60 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest block">Lista de Chamada</span>
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
                            <span className="bg-zinc-900/60 px-1.5 py-0.5 rounded border border-zinc-850">OVR {playerObj?.overallLevel || 70}</span>
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
        </div>

        {/* COLUNA DIREITA (Span 4): Fila de Espera, Reservas e Administração */}
        <div className="lg:col-span-4 space-y-6">
          {/* 1. RESERVAS & FILA DE ESPERA (Only if reservations exist or active) */}
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
                reserveQueue.queue.map((item: any, index: number) => {
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
                })
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

          {/* 2. ADMIN PORTAL (Shield - Quiet Admin Desk) */}
          {isAdmin && (
            <div className="sports-card border border-dashed border-emerald-500/25 bg-gradient-to-br from-zinc-950 via-zinc-950 to-emerald-950/5 p-6 space-y-5 shadow-2xl animate-fadeIn" id="quiet-admin-desk-panel">
              <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-900/80">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-black text-white text-sm uppercase tracking-wide">Painel Administrativo</h3>
                <span className="ml-auto text-[9px] font-mono font-black bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                  ADM
                </span>
              </div>

              {/* Admin actions block */}
              <div className="space-y-4 font-mono text-xs">
                {/* 1. Quick summon / score registers triggers */}
                <div className="space-y-2">
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

                  {/* Manual trigger for score input */}
                  {matchState === 'SORTEIO_REALIZADO' && (
                    <button
                      type="button"
                      onClick={() => setShowDashboardPlacarModal(true)}
                      className="w-full flex items-center justify-between p-3 bg-emerald-950/15 border border-emerald-900/35 hover:border-emerald-500/40 rounded-xl text-emerald-400 hover:text-white transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-sm"
                    >
                      <span className="font-sans font-bold text-xs">🏆 Registrar Placar Final</span>
                      <Trophy className="w-4 h-4 text-amber-500 animate-pulse" />
                    </button>
                  )}
                </div>

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
              </div>
            </div>
          )}
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

      {/* 1. DYNAMIC SPORTS HERO LAYER */}
      {renderSportsHero()}

      {/* 2. PRIMARY THUMB-FRIENDLY CTA */}
      {renderPrimaryCTA()}

      {/* 3. CORE 2-COLUMN RESPONSIVE GRID */}
      {renderCoreGrid()}

      {/* 4. SOCIAL & BENTO STATS AREA */}
      {renderSocialBento()}

      {/* 5. PORTALS & MODALS (PRESERVING 100% LOGIC) */}
      {renderPortalsAndModals()}
    </div>
  );
}
