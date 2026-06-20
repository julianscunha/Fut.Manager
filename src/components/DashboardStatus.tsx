import React, { useState, useEffect } from 'react';
import { User, PresenceStatus, CATEGORY_LABELS, POSITION_LABELS, Player } from '../types';
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
    case 'lateral': return 'LAT';
    case 'meio_campo': return 'MEI';
    case 'volante': return 'VOL';
    case 'atacante': return 'ATA';
    default: return pos.toUpperCase().slice(0, 3);
  }
};

function computeTacticalAssignments(playersList: Player[]): Record<string, { position: string; isAdapted: boolean }> {
  const positions = ['goleiro', 'zagueiro', 'lateral', 'meio_campo', 'volante', 'atacante'];
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
  const POSITION_ORDER = ['goleiro', 'zagueiro', 'volante', 'meio_campo', 'lateral', 'atacante'];

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
    findBestFor(['zagueiro', 'lateral'], 'ZAG');
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

  return (
    <div className="flex flex-col gap-6 animate-fadeIn" id="dashboard-status-wrapper">

      {/* PAINEL OPERACIONAL: AÇÕES NECESSÁRIAS */}
      {isAdmin && hasAdminPendencies && (
        <div className="rounded-xl border border-dashed border-emerald-500/20 bg-zinc-950/20 p-4 md:p-5 space-y-4 shadow-lg order-1" id="admin-required-actions-panel">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#22c55e]/10">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="font-display font-extrabold text-sm text-white uppercase tracking-wider">⚠ Pendências Administrativas</span>
            <span className="ml-auto text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Painel do Administrador
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-900/60">
              {adminPendenciesList.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-900/20 last:border-0 hover:bg-zinc-900/10 px-1 rounded transition">
                  <span className="text-zinc-350 leading-relaxed font-sans font-medium">{item.text}</span>
                  <button
                    onClick={item.onClick}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold px-3 py-1 rounded text-[10px] uppercase tracking-wider transition cursor-pointer border border-zinc-800 hover:border-zinc-700 hover:scale-[1.01] active:scale-95 shrink-0"
                  >
                    {item.actionText}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* AREA DO ADMINISTRADOR: STANDALONE OPERATIONAL CONTROL CENTER */}
      {isAdmin && nextMatch && (
        <div className="rounded-xl border border-dashed border-emerald-500/20 bg-zinc-950/25 p-5 space-y-4 shadow-lg order-2" id="admin-operational-center-panel">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#22c55e]/10">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="font-display font-extrabold text-sm text-white uppercase tracking-wider">🛡 Área do Administrador</span>
          </div>

          {matchState === 'AGENDADO' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Próxima ação necessária:</span>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                Abrir as confirmações para os atletas.
              </p>
              <button
                disabled={actionLoading}
                onClick={handleOpenConfirmations}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
              >
                Abrir Confirmações
              </button>
            </div>
          )}

          {matchState === 'CONFIRMACOES_ABERTAS' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Próxima ação necessária:</span>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                Aguardar confirmações dos atletas.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleShareMatchOnWhatsApp}
                  className="flex-1 bg-[#128C7E] hover:bg-[#075e54] text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Divulgar Racha</span>
                </button>
                {roundStatus.canDraw && (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }));
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
                  >
                    Realizar Sorteio
                  </button>
                )}
              </div>
            </div>
          )}

          {matchState === 'RACHA_FECHADO' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Próxima ação necessária:</span>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                Realizar sorteio.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }));
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
              >
                Realizar Sorteio
              </button>
            </div>
          )}

          {matchState === 'SORTEIO_REALIZADO' && (
            <div className="space-y-2.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Próxima ação necessária:</span>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                Gerenciar equipes ou registrar placar.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }));
                  }}
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md hover:scale-[1.01] active:scale-95"
                >
                  Gerenciar Times
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWinsBlueInput('0');
                    setWinsRedInput('0');
                    setWinsGreenInput('0');
                    setShowDashboardPlacarModal(true);
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shadow-md hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Gravar Placar</span>
                </button>
              </div>
            </div>
          )}

          {matchState === 'PARTIDA_ENCERRADA' && (
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Próxima ação necessária:</span>
              <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                Aguardar próximo agendamento.
              </p>
            </div>
          )}

          {nextMatch.status === 'cancelada' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-[10px] font-mono leading-normal">
                Este racha foi marcado como cancelado.
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleMassClearConfirmations}
                className="w-full bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-rose-300 font-bold py-2.5 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                Limpar Confirmações
              </button>
            </div>
          )}
        </div>
      )}



      {/* Action alerts and success indicators */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono flex items-center gap-2 animate-slideDown order-2">
          <Check className="w-4 h-4" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 text-zinc-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-mono flex items-center gap-2 animate-slideDown order-2">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="p-1 text-zinc-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* SEÇÃO DE EVENTOS & CONFRATERNIZAÇÕES ATIVOS */}
      {activeEvents.length > 0 && (
        <div className="rounded-xl border border-zinc-850 bg-zinc-950/20 p-5 space-y-4 shadow-xl font-sans order-6" id="dashboard-active-events-panel">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-900/40">
            <Gift className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
              Eventos & Confraternizações do Grupo
            </h3>
            <span className="ml-auto text-[9px] font-mono tracking-wider font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
              Confirmação Disponível
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEvents.map((evt) => {
              const isConfirmed = !!evt.myParticipant;
              const originalAdults = evt.myParticipant?.adultsCount || 0;
              const originalChildren = evt.myParticipant?.childrenCount || 0;
              
              const currentAdults = tempEventAdults[evt.id] || 0;
              const currentChildren = tempEventChildren[evt.id] || 0;
              const hasDraftChanges = (currentAdults !== originalAdults) || (currentChildren !== originalChildren);

              // Live cost estimation helper
              let priceText = `R$ ${evt.adultPrice} (Adulto) / R$ ${evt.childPrice} (Criança)`;
              if (evt.adultPrice === 0 && evt.childPrice === 0) {
                priceText = "Gratuito";
              }

              return (
                <div key={evt.id} className="bg-[#0c1311] border border-zinc-900 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500/20 transition">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-1">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {evt.type === 'churrasco' ? 'Churrasco' : evt.type === 'confraternizacao' ? 'Confraternização' : evt.type === 'festa' ? 'Festa' : evt.type === 'viagem' ? 'Viagem' : 'Personalizado'}
                        </span>
                        <h4 className="font-display font-bold text-white text-sm tracking-tight mt-1">
                          {evt.name}
                        </h4>
                      </div>
                      <span className={`text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        isConfirmed 
                          ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400' 
                          : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                      }`}>
                        {isConfirmed ? 'Confirmado' : 'Pendente'}
                      </span>
                    </div>

                    {evt.description && (
                      <p className="text-zinc-400 text-[11px] leading-relaxed line-clamp-2">
                        {evt.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900/40 text-[11px] text-zinc-400 font-mono">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-bold">Data & Hora</span>
                        <span className="text-zinc-300 font-bold">{evt.date.split('-').reverse().join('/')} - {evt.time}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase block font-bold">Valor</span>
                        <span className="text-emerald-400 font-bold">{priceText}</span>
                      </div>
                      <div className="col-span-2 border-t border-zinc-900/40 pt-1.5 mt-0.5">
                        <span className="text-[8px] text-zinc-500 uppercase block font-bold">Local</span>
                        <span className="text-zinc-300 block truncate">{evt.location || 'Não especificado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-zinc-900/60 pt-2 font-mono">
                    {/* Confirmation Status statement */}
                    {isConfirmed && !hasDraftChanges && (
                      <div className="text-center py-1 bg-emerald-950/15 border border-emerald-900/40 rounded text-[11px] text-[#4ade80]">
                        ✔️ Você confirmou <strong>{originalAdults} adulto(s)</strong> e <strong>{originalChildren} criança(s)</strong>.
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-900 text-[11px] flex-1 justify-center" title="Adultos">
                        <UserIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <button
                          type="button"
                          onClick={() => changeEventRsvpCount(evt.id, true, false)}
                          className="w-5 h-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-center transition font-bold"
                        >
                          -
                        </button>
                        <span className="w-4 text-center text-white font-bold">{currentAdults}</span>
                        <button
                          type="button"
                          onClick={() => changeEventRsvpCount(evt.id, true, true)}
                          className="w-5 h-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-center transition font-bold"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-900 text-[11px] flex-1 justify-center" title="Crianças">
                        <Baby className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <button
                          type="button"
                          onClick={() => changeEventRsvpCount(evt.id, false, false)}
                          className="w-5 h-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-center transition font-bold"
                        >
                          -
                        </button>
                        <span className="w-4 text-center text-white font-bold">{currentChildren}</span>
                        <button
                          type="button"
                          onClick={() => changeEventRsvpCount(evt.id, false, true)}
                          className="w-5 h-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-center transition font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      {/* Save Attendance button */}
                      {hasDraftChanges ? (
                        <button
                          type="button"
                          disabled={isSavingEventRsvp[evt.id]}
                          onClick={() => handleSaveEventRsvp(evt.id)}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase rounded transition cursor-pointer text-center"
                        >
                          {isSavingEventRsvp[evt.id] ? "Salvando..." : "Confirmar Presença"}
                        </button>
                      ) : null}

                      {/* Cancel Attendance completely button */}
                      {isConfirmed && (
                        <button
                          type="button"
                          disabled={isSavingEventRsvp[evt.id]}
                          onClick={() => handleCancelEventRsvp(evt.id)}
                          className="flex-1 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/10 text-rose-400 font-bold text-[10px] uppercase rounded transition cursor-pointer text-center"
                        >
                          Cancelar Presença
                        </button>
                      )}
                    </div>
                  </div>

                  {/* COLLAPSIBLE CONFIRMED PARTICIPANTS SECTION */}
                  <div className="border-t border-zinc-900/60 pt-2 font-mono">
                    <button
                      type="button"
                      onClick={() => toggleParticipantsList(evt.id)}
                      className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 rounded-lg flex items-center justify-between text-[11px] text-zinc-300 transition"
                    >
                      <span className="flex items-center gap-1.5 font-bold">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Participantes Confirmados</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {evt.totalParticipants || 0} pessoas
                        </span>
                        {expandedParticipantsMap[evt.id] ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </div>
                    </button>

                    {expandedParticipantsMap[evt.id] && (
                      <div className="mt-2.5 bg-zinc-950/50 rounded-lg border border-zinc-900/60 p-3 space-y-3">
                        {loadingParticipantsMap[evt.id] ? (
                          <div className="text-center py-2 text-zinc-500 text-[10px] flex items-center justify-center gap-2">
                            <Clock className="w-3 h-3 animate-spin text-emerald-400" />
                            <span>Carregando dados...</span>
                          </div>
                        ) : !eventParticipantsMap[evt.id] || eventParticipantsMap[evt.id].length === 0 ? (
                          <div className="text-center py-2 text-zinc-500 italic text-[10px]">
                            Nenhum participante confirmado ainda.
                          </div>
                        ) : (() => {
                          const partsList = eventParticipantsMap[evt.id] || [];
                          const countPlayers = partsList.length;
                          const countAdultCompanions = partsList.reduce((sum, p) => sum + Math.max(0, p.adultsCount - 1), 0);
                          const countChildren = partsList.reduce((sum, p) => sum + p.childrenCount, 0);
                          const totalPessoas = partsList.reduce((sum, p) => sum + p.adultsCount + p.childrenCount, 0);

                          const sortedPartsList = [...partsList].sort((a, b) => a.playerName.localeCompare(b.playerName));

                          return (
                            <div className="space-y-3">
                              {/* Dashboard do Evento / Stats Summary */}
                              <div className="bg-[#090f0d] border border-emerald-500/5 p-2 rounded text-[10px] space-y-1">
                                <div className="grid grid-cols-2 gap-2 text-zinc-400">
                                  <div>
                                    <span className="text-zinc-500 text-[8px] uppercase block font-bold">👥 Confirmados</span>
                                    <span className="text-white font-medium">{countPlayers} atletas</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 text-[8px] uppercase block font-bold">👨 Adultos</span>
                                    <span className="text-white font-medium">+{countAdultCompanions} acomp.</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 text-[8px] uppercase block font-bold">👶 Crianças</span>
                                    <span className="text-white font-medium">{countChildren} crianças</span>
                                  </div>
                                  <div className="border-l border-zinc-900 pl-1.5">
                                    <span className="text-emerald-500 text-[8px] uppercase block font-bold">📊 Total Geral</span>
                                    <span className="text-emerald-400 font-bold">{totalPessoas} pessoas</span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-zinc-900 mt-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleShareConfirmedList(evt)}
                                    className="px-2 py-1 bg-[#102419] hover:bg-emerald-600 border border-emerald-500/10 hover:border-emerald-500 hover:text-white text-emerald-400 font-bold text-[9px] uppercase rounded transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Share2 className="w-2.5 h-2.5" />
                                    <span>Compartilhar Lista</span>
                                  </button>
                                </div>
                              </div>

                              {/* Simple List of confirmed cards */}
                              <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                                {sortedPartsList.map(p => {
                                  const companionAdults = p.adultsCount - 1;
                                  const hasAdults = companionAdults > 0;
                                  const hasChildren = p.childrenCount > 0;

                                  return (
                                    <div key={p.id} className="bg-zinc-900 border border-zinc-850 p-1.5 rounded flex items-center gap-2">
                                      {p.photoOriginal ? (
                                        <img src={p.photoOriginal} alt="" className="w-6 h-6 rounded-full object-cover border border-zinc-850" referralPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-sans border border-zinc-750 text-[8px]">
                                          {p.playerName?.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <span className="font-sans font-bold text-zinc-200 block truncate">{p.playerName}</span>
                                        <div className="text-[9px] text-zinc-500 flex flex-wrap gap-x-1 font-mono">
                                          {!hasAdults && !hasChildren ? (
                                            <span>Somente participante</span>
                                          ) : (
                                            <>
                                              {hasAdults && (
                                                <span className="text-emerald-400">+{companionAdults} adulto{companionAdults > 1 ? 's' : ''}</span>
                                              )}
                                              {hasChildren && (
                                                <span className="text-amber-400">+{p.childrenCount} criança{p.childrenCount > 1 ? 's' : ''}</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 📸 DESTAQUE DA SEMANA SECTION ON HOME DASHBOARD */}
      {highlightPost && (
        <div className="bg-gradient-to-r from-emerald-950/20 to-zinc-950/40 border border-emerald-500/15 rounded-2xl p-5 shadow-xl relative overflow-hidden animate-fadeIn order-7" id="dashboard-destaque-da-semana">
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            
            {/* Visual media */}
            <div className="w-full sm:w-[150px] h-[95px] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-850 shadow-md flex-shrink-0">
              {highlightPost.mediaType === 'image' ? (
                <img 
                  src={highlightPost.mediaUrl || undefined} 
                  alt={highlightPost.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                  <video src={highlightPost.mediaUrl || undefined} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] bg-emerald-600 font-mono font-bold px-2 py-0.5 rounded text-white tracking-widest uppercase">PLAY</span>
                  </div>
                </div>
              )}
              <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white font-mono font-black text-[8px] px-2 py-0.25 rounded">
                DESTAQUE
              </span>
            </div>

            {/* Description details */}
            <div className="flex-1 text-left space-y-1.5 w-full">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                  📸 Destaque da Semana ({highlightPost.category})
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {new Date(highlightPost.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              <h4 className="font-display font-extrabold text-white text-base tracking-tight leading-snug">
                {highlightPost.title}
              </h4>

              <p className="text-zinc-400 text-xs line-clamp-1 leading-normal max-w-xl">
                {highlightPost.description || 'Publicação destacada pelos administradores esta semana.'}
              </p>

              <div className="text-[10px] text-zinc-500 font-mono">
                Momentos eternizados por: <span className="font-extrabold text-zinc-300 uppercase">{highlightPost.authorName}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500 font-mono gap-2 text-xs order-3">
          <Clock className="w-6 h-6 text-emerald-400 animate-spin" />
          <span>Lendo informações da próxima rodada...</span>
        </div>
      ) : nextMatch ? (
        <div className="flex flex-col gap-6 order-3 w-full">
          
          {matchState === 'PARTIDA_ENCERRADA' ? (
            /* 🏆 STATE 5: RESUMO DE PLACAR DA PARTIDA ENCERRADA */
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 space-y-4 flex flex-col justify-between shadow-lg" id="dashboard-resumo-da-partida">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 pb-3 border-b border-zinc-900/40">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                       <Trophy className="w-5 h-5 text-amber-500" />
                       <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
                         Resumo da Rodada
                       </h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase bg-amber-500/15 border-amber-500/20 text-amber-400">
                      Rodada Finalizada
                    </span>
                  </div>
                </div>

                {/* Scoreboard visual design */}
                <div className="bg-zinc-950/70 border border-zinc-900/80 p-4 rounded-xl space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {/* Time Azul */}
                    <div className="bg-sky-950/15 border border-sky-500/10 p-3 rounded-lg flex flex-col items-center justify-between">
                      <span className="text-[9px] text-sky-400 font-mono font-bold uppercase tracking-widest block">Time Azul</span>
                      <span className="text-3xl font-display font-black text-white py-1">{nextMatchResult ? nextMatchResult.winsBlue : 0}</span>
                      <span className="text-[8px] text-zinc-500 font-mono uppercase block">Vitórias</span>
                    </div>

                    {/* Time Vermelho */}
                    <div className="bg-rose-950/15 border border-rose-500/10 p-3 rounded-lg flex flex-col items-center justify-between">
                      <span className="text-[9px] text-rose-400 font-mono font-bold uppercase tracking-widest block">Time Vermelho</span>
                      <span className="text-3xl font-display font-black text-white py-1">{nextMatchResult ? nextMatchResult.winsRed : 0}</span>
                      <span className="text-[8px] text-zinc-500 font-mono uppercase block">Vitórias</span>
                    </div>

                    {/* Time Verde */}
                    <div className="bg-emerald-950/15 border border-emerald-500/10 p-3 rounded-lg flex flex-col items-center justify-between">
                      <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase tracking-widest block">Time Verde</span>
                      <span className="text-3xl font-display font-black text-white py-1">{nextMatchResult ? nextMatchResult.winsGreen : 0}</span>
                      <span className="text-[8px] text-zinc-500 font-mono uppercase block">Vitórias</span>
                    </div>
                  </div>

                  {/* Champion Announcement Banner */}
                  {(() => {
                    const winsList = [
                      { name: 'Azul', wins: nextMatchResult?.winsBlue || 0, color: 'text-sky-400', bannerBg: 'bg-gradient-to-r from-sky-950/40 via-sky-900/20 to-zinc-950 shadow-sky-500/5', border: 'border-sky-500/20' },
                      { name: 'Vermelho', wins: nextMatchResult?.winsRed || 0, color: 'text-rose-400', bannerBg: 'bg-gradient-to-r from-rose-950/40 via-rose-900/20 to-zinc-950 shadow-rose-500/5', border: 'border-rose-500/20' },
                      { name: 'Verde', wins: nextMatchResult?.winsGreen || 0, color: 'text-emerald-400', bannerBg: 'bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-zinc-950 shadow-emerald-400/5', border: 'border-emerald-500/20' }
                    ];
                    const maxWinsVal = Math.max(...winsList.map(w => w.wins));
                    const isAnyWin = maxWinsVal > 0;

                    if (!isAnyWin) {
                      return (
                        <div className="p-3 bg-zinc-900/40 border border-zinc-850/60 rounded-lg text-center font-mono text-[11px] text-zinc-400">
                          ⚔️ Aguardando registro ou liberação do placar da rodada.
                        </div>
                      );
                    }

                    const roundWinners = winsList.filter(w => w.wins === maxWinsVal);
                    if (roundWinners.length === 1) {
                      return (
                        <div className={`p-4 rounded-lg border flex items-center justify-between ${roundWinners[0].bannerBg} ${roundWinners[0].border}`}>
                          <div className="space-y-1">
                            <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest block font-bold">Destaque do Racha</span>
                            <span className="text-[13px] font-display font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                              🏆 Time <span className={roundWinners[0].color}>{roundWinners[0].name}</span> é o Campeão!
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-display font-black text-white block">{roundWinners[0].wins}</span>
                            <span className="text-[8px] text-zinc-550 block font-mono uppercase block">Vitórias Totais</span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="p-4 rounded-lg border border-zinc-850 bg-zinc-900/30 flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest block font-bold">Destaque do Racha</span>
                            <span className="text-[13px] font-display font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                              🤝 Rodada Empatada!
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-zinc-400 font-mono block">Mais de um time com {maxWinsVal} vitórias</span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Technical facts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/30 border border-zinc-900/60 p-3.5 rounded-xl font-mono text-[11px] text-zinc-400">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Data do Evento</span>
                    <span className="text-zinc-200 font-medium block">{nextMatch.date.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-zinc-550 uppercase tracking-widest font-black block">Horário & Local</span>
                    <span className="text-zinc-200 font-medium truncate block">{nextMatch.time} • {nextMatch.location}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : matchState === 'SORTEIO_REALIZADO' ? (
            /* Simplified Próxima Rodada Card (Sorteio realizado) */
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-4 space-y-3 flex flex-col justify-between shadow-lg">
              <div className="space-y-3">
                
                <div className="flex flex-col gap-1 pb-2 border-b border-zinc-900/40">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-wide">
                        Próxima Rodada
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-sky-500/15 border-sky-500/30 text-sky-400 font-extrabold">
                      SORTEIO REALIZADO
                    </span>
                  </div>
                </div>

                {/* Simplified Info Grid */}
                <div className="space-y-2.5 bg-zinc-950/60 border border-zinc-900/60 p-3 rounded-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Data</span>
                      <span className="text-xs font-semibold text-white flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 text-sky-400" />
                        {nextMatch.date.split('-').reverse().join('/')}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Horário</span>
                      <span className="text-xs font-semibold text-white flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-sky-400" />
                        {nextMatch.time} ({nextMatch.durationMinutes || 120} min)
                      </span>
                    </div>
                    <div className="space-y-0.5 sm:col-span-2">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Local</span>
                      <span className="text-xs font-semibold text-white flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3 text-sky-400 block flex-shrink-0" />
                        <span className="truncate">{nextMatch.location}</span>
                      </span>
                    </div>
                  </div>

                  {/* Sport-inspired soccer tactic boards */}
                  {matchDraw && matchDraw.teams && (
                    <div className="pt-1.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">
                          Visualização Tática das Equipes
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {matchDraw.teams.map((team: any) => {
                          const teamPlayers = team.playerIds
                            .map((pid: string) => players.find(p => p.id === pid))
                            .filter(Boolean);

                          const teamOverall = team.name === 'Azul'
                            ? matchDraw.overallBlue
                            : team.name === 'Vermelho'
                              ? matchDraw.overallRed
                              : matchDraw.overallGreen;

                          const themeStyles = team.name === 'Azul'
                            ? {
                                border: 'border-sky-500/20',
                                header: 'bg-sky-500/10 text-sky-400 border-sky-500/25',
                                pitchBg: 'from-sky-950/20 via-zinc-950 to-sky-950/20',
                                pitchLines: 'border-sky-500/10'
                              }
                            : team.name === 'Vermelho'
                              ? {
                                  border: 'border-red-500/20',
                                  header: 'bg-red-500/10 text-red-400 border-red-500/25',
                                  pitchBg: 'from-red-950/20 via-zinc-950 to-red-950/20',
                                  pitchLines: 'border-red-500/10'
                                }
                              : {
                                  border: 'border-emerald-500/20',
                                  header: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
                                  pitchBg: 'from-emerald-950/20 via-zinc-950 to-emerald-950/20',
                                  pitchLines: 'border-emerald-500/10'
                                };

                          // Calculate tactical assignments
                          const assignments = computeTacticalAssignments(teamPlayers);

                          // Group into the vertical tiers of the football field
                          const gks = teamPlayers.filter(p => assignments[p.id]?.position === 'goleiro');
                          const defs = teamPlayers.filter(p => ['zagueiro', 'lateral'].includes(assignments[p.id]?.position));
                          const mids = teamPlayers.filter(p => ['volante', 'meio_campo'].includes(assignments[p.id]?.position));
                          const atts = teamPlayers.filter(p => assignments[p.id]?.position === 'atacante');

                          const renderPlayerToken = (p: any) => {
                            const assignment = assignments[p.id] || { position: p.primaryPosition, isAdapted: false };
                            const isCap = team.captainPlayerId === p.id;

                            return (
                              <div key={p.id} className="flex flex-col items-center gap-0.5 group select-none relative w-12">
                                <div className="relative">
                                  <img 
                                    src={p.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=50'} 
                                    referrerPolicy="no-referrer"
                                    className={`w-6.5 h-6.5 rounded-full object-cover border shadow transition-transform group-hover:scale-105 ${
                                      isCap 
                                        ? 'border-amber-400 ring-1 ring-amber-400/20' 
                                        : 'border-zinc-500'
                                    }`} 
                                  />
                                  {isCap && (
                                    <div className="absolute -top-1 -right-1 bg-amber-500 text-black rounded-full p-0.5 shadow">
                                      <Crown className="w-1.5 h-1.5 fill-black" />
                                    </div>
                                  )}
                                </div>
                                <div className="text-center w-full">
                                  <p className="text-[8px] font-black text-white tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)] leading-none truncate w-full">
                                    {p.name.split(' ')[0].slice(0, 10)}
                                  </p>
                                  <span className="text-[6.5px] font-mono uppercase bg-black/60 px-0.5 py-0.1 rounded text-zinc-400 border border-zinc-800 leading-none font-bold mt-0.5 inline-block">
                                    {getAbbreviation(assignment.position)}
                                  </span>
                                </div>
                              </div>
                            );
                          };

                          return (
                            <div key={team.name} className={`flex flex-col rounded-lg border p-1.5 bg-zinc-950/40 relative shadow-sm transition hover:border-zinc-800 ${themeStyles.border}`}>
                              {/* Header team panel */}
                              <div className={`px-1.5 py-0.5 rounded border text-[9.5px] font-black uppercase tracking-wider flex items-center justify-between mb-1.5 ${themeStyles.header}`}>
                                <div className="flex items-center gap-1">
                                  <span>Time {team.name}</span>
                                  <span className="text-[7.5px] font-mono font-medium text-zinc-400">({teamPlayers.length})</span>
                                </div>
                                {teamOverall && (
                                  <span className="font-mono text-[9px]">★ {teamOverall.toFixed(1)}</span>
                                )}
                              </div>

                              {/* Soccer Field Viewport - Fixed height of 170px to shrink vertical space by 45% */}
                              <div className={`relative w-full h-[170px] bg-gradient-to-b ${themeStyles.pitchBg} border border-zinc-950 rounded-lg overflow-hidden p-1 flex flex-col justify-between shadow-[inset_0_1.5px_4px_rgba(0,0,0,0.85)]`}>
                                {/* Field Lines */}
                                <div className={`absolute inset-1 border ${themeStyles.pitchLines} pointer-events-none rounded`} />
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border ${themeStyles.pitchLines} pointer-events-none`} />
                                <div className={`absolute top-1/2 left-1 right-1 h-[1px] bg-zinc-800/15 pointer-events-none`} />
                                <div className={`absolute top-1 left-1/4 right-1/4 h-7 border-b border-x ${themeStyles.pitchLines} pointer-events-none`} />
                                <div className={`absolute bottom-1 left-1/4 right-1/4 h-7 border-t border-x ${themeStyles.pitchLines} pointer-events-none`} />

                                {/* Row 4: ATT (Top) */}
                                <div className="flex justify-around items-center z-10 min-h-[30px] h-[34px]">
                                  {atts.length > 0 ? atts.map(renderPlayerToken) : <div className="w-1" />}
                                </div>

                                {/* Row 3: MID (Middle-upper) */}
                                <div className="flex justify-around items-center z-10 min-h-[30px] h-[34px]">
                                  {mids.length > 0 ? mids.map(renderPlayerToken) : <div className="w-1" />}
                                </div>

                                {/* Row 2: DEF (Middle-lower) */}
                                <div className="flex justify-around items-center z-10 min-h-[30px] h-[34px]">
                                  {defs.length > 0 ? defs.map(renderPlayerToken) : <div className="w-1" />}
                                </div>

                                {/* Row 1: GK (Bottom) */}
                                <div className="flex justify-around items-center z-10 min-h-[30px] h-[34px]">
                                  {gks.length > 0 ? gks.map(renderPlayerToken) : <div className="text-[7px] font-mono text-zinc-650 uppercase select-none tracking-wider font-bold">Sem GK</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Próximo Racha Panel */
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 space-y-4 flex flex-col justify-between shadow-lg">
            <div className="space-y-3.5">
              
              <div className="flex flex-col gap-1.5 pb-3 border-b border-zinc-900/40">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
                      Próxima Rodada
                    </h3>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    matchState === 'AGENDADO'
                      ? 'bg-zinc-800 border-zinc-750 text-zinc-300'
                      : matchState === 'CONFIRMACOES_ABERTAS'
                        ? 'bg-[#eab308]/15 border-[#eab308]/30 text-[#eab308] animate-pulse font-extrabold'
                        : matchState === 'RACHA_FECHADO'
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-400 font-extrabold'
                          : matchState === 'SORTEIO_REALIZADO'
                            ? 'bg-sky-500/15 border-sky-500/30 text-sky-400 font-extrabold'
                            : matchState === 'PARTIDA_ENCERRADA'
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                              : 'bg-zinc-805 border-zinc-750 text-zinc-350'
                  }`}>
                    {matchState === 'AGENDADO' ? 'AGENDADA' :
                     matchState === 'CONFIRMACOES_ABERTAS' ? 'CONFIRMAÇÕES ABERTAS' :
                     matchState === 'RACHA_FECHADO' ? 'FECHADA' :
                     matchState === 'SORTEIO_REALIZADO' ? 'SORTEIO REALIZADO' :
                     matchState === 'PARTIDA_ENCERRADA' ? 'ENCERRADA' : 'AGENDADA'}
                  </span>
                </div>
                
              </div>

              {/* Racha Technical Info */}
              <div className="space-y-3.5 bg-zinc-950/60 border border-zinc-900/60 p-4 rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Data</span>
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      {nextMatch.date.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Horário</span>
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      {nextMatch.time} ({nextMatch.durationMinutes || 120} min)
                    </span>
                  </div>
                  <div className="space-y-0.5 sm:col-span-2">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Local</span>
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 block flex-shrink-0" />
                      <span className="truncate">{nextMatch.location}</span>
                    </span>
                  </div>
                </div>
              </div>

              {nextMatch.status === 'agendada' ? (
                  <div className="p-3 bg-zinc-900/40 border border-dashed border-zinc-850 rounded-lg font-mono text-[11px] text-zinc-400 text-center leading-relaxed">
                    {isAdmin ? (
                      <span>A rodada está criada. O próximo passo é abrir as confirmações para permitir que os mensalistas registrem presença.</span>
                    ) : (
                      <span>A rodada está criada e aguarda a abertura das confirmações pelo administrador.</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="border-t border-zinc-900/40 pt-3 flex items-center justify-between text-xs">
                      <div className="space-y-0.5 font-mono w-full text-center">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Status do Racha</span>
                        <span className="text-emerald-400 font-extrabold flex items-center justify-center gap-1.5 text-sm">
                          <Users className="w-4 h-4" />
                          <span>{confirmedCount} de {maxPlayersLimit} jogadores confirmados</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress bar of slots */}
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow shadow-emerald-500/20"
                        style={{ width: `${Math.min((confirmedCount / maxPlayersLimit) * 100, 100)}%` }}
                      />
                    </div>

                    {/* ALERT SYSTEM RULE: Vagas personalizáveis - Only show clean status badge if closed */}
                    {missingCount === 0 && (
                      <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-[11px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">✅ Racha Fechado</span>
                          <span className="text-[10px] text-zinc-400">{confirmedCount} de {maxPlayersLimit} jogadores confirmados</span>
                        </div>
                      </div>
                    )}

                    {/* PRAZO DE CONFIRMAÇÃO DISPLAY (REGRA OFICIAL CORREÇÃO DO PRAZO) */}
                    <div className={`p-3 rounded-lg border flex flex-col gap-1.5 font-mono text-[11px] ${
                      isDeadlineExpired 
                        ? 'bg-rose-950/20 border-rose-500/20 text-rose-450' 
                        : (nextMatch.hoursRemaining !== undefined && nextMatch.hoursRemaining <= 2)
                          ? 'bg-amber-950/30 border-amber-500/30 text-amber-400 animate-pulse'
                          : 'bg-zinc-900/60 border-zinc-850 text-zinc-300'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <Clock className={`w-4 h-4 flex-shrink-0 ${
                          isDeadlineExpired ? 'text-rose-400' : 'text-emerald-400'
                        }`} />
                        <span>Prazo de Confirmação</span>
                      </div>
                      <div className="flex flex-col gap-1 pl-6">
                        <span className="text-zinc-400">
                          {isDeadlineExpired ? 'Confirmações encerradas em:' : 'Confirmações encerram em:'}
                        </span>
                        <span className={`text-[12px] font-bold ${isDeadlineExpired ? 'text-rose-400' : 'text-white'}`}>
                          {nextMatch.deadlineDateStr || 'Não definido'}
                        </span>
                      </div>

                      {/* REAL-TIME ALERT BANNERS */}
                      {nextMatch.hoursRemaining !== undefined && nextMatch.hoursRemaining > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[10px] font-sans flex items-start gap-1.5 font-semibold">
                          {nextMatch.hoursRemaining <= 2 ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="text-amber-400">Últimas horas para confirmação.</span>
                            </>
                          ) : nextMatch.hoursRemaining <= 24 ? (
                            <>
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="text-amber-400">
                                Lembrete: confirmações encerram amanhã às {nextMatch.time || '21:30'}.
                              </span>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!isAdmin && (matchState === 'CONFIRMACOES_ABERTAS' || matchState === 'RACHA_FECHADO') && nextMatch.status !== 'agendada' && (
                  currentUserCategory === 'reserva' && !areReservesReleased ? (
                    <div className="flex flex-col gap-1 p-3 rounded-lg border border-dashed border-zinc-850 bg-zinc-950/40 text-center font-mono text-[11px]">
                      <span className="text-zinc-400 font-bold">Sua Confirmação:</span>
                      <span className="text-amber-500/85 text-[10px]">Reserva: aguardando liberação das confirmações dos mensalistas.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-medium">Sua Confirmação:</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          myPresence === 'confirmado' 
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                            : myPresence === 'cancelado' 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/10'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-750'
                        }`}>
                          {myPresence === 'confirmado' ? 'Confirmado' : myPresence === 'cancelado' ? 'Não Participará' : 'Pendente'}
                        </span>
                      </div>
                      {nextMatch.status === 'confirmando' && (currentUserCategory === 'mensalista') && (
                        <div className="text-[10.5px] text-emerald-400/90 text-center font-sans font-semibold pt-1.5 border-t border-zinc-900/60">
                          Sua confirmação está disponível.
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* RSVP BUTTON ACTIONS */}
                {!isAdmin && (matchState === 'CONFIRMACOES_ABERTAS' || matchState === 'RACHA_FECHADO') && (
                  <div className="space-y-4 mt-4 pt-4 border-t border-zinc-900/40">
                    <div className="grid grid-cols-2 gap-2">
                       <button
                        disabled={!nextMatch || !['confirmando', 'aguardando_reservas'].includes(nextMatch.status) || (currentUserCategory === 'reserva' && !areReservesReleased) || (confirmedCount >= maxPlayersLimit && myPresence !== 'confirmado') || actionLoading}
                        onClick={() => handleRsvpHolder('confirmado')}
                        className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 ${
                          !nextMatch || !['confirmando', 'aguardando_reservas'].includes(nextMatch.status) || (currentUserCategory === 'reserva' && !areReservesReleased)
                            ? 'bg-zinc-900 border border-zinc-850 text-zinc-650 cursor-not-allowed opacity-40'
                            : actionLoading
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-wait'
                              : myPresence === 'confirmado'
                                ? 'bg-emerald-600 border border-emerald-400 text-white shadow shadow-emerald-500/15 cursor-pointer hover:bg-emerald-500 active:scale-95'
                                : 'bg-zinc-900 hover:bg-emerald-500/10 border border-zinc-800 text-zinc-400 hover:text-emerald-400 cursor-pointer active:scale-95'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Vou Jogar</span>
                      </button>

                      <button
                        disabled={!nextMatch || !['confirmando', 'aguardando_reservas'].includes(nextMatch.status) || (currentUserCategory === 'reserva' && !areReservesReleased) || actionLoading}
                        onClick={() => handleRsvpHolder('cancelado')}
                        className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 ${
                          !nextMatch || !['confirmando', 'aguardando_reservas'].includes(nextMatch.status) || (currentUserCategory === 'reserva' && !areReservesReleased)
                            ? 'bg-zinc-900 border border-zinc-850 text-zinc-650 cursor-not-allowed opacity-40'
                            : actionLoading
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-wait'
                              : myPresence === 'cancelado'
                                ? 'bg-rose-600 border border-rose-500 text-white shadow shadow-rose-500/15 cursor-pointer hover:bg-rose-500 active:scale-95'
                                : 'bg-zinc-900 hover:bg-rose-500/10 border border-zinc-805 text-zinc-400 hover:text-rose-450 cursor-pointer active:scale-95'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>Não Vou</span>
                      </button>
                    </div>
                  </div>
                )}

                  {/* LIST OF CONFIRMED / CANCELLED IN THE MATCH */}
                  {(matchState === 'CONFIRMACOES_ABERTAS' || matchState === 'RACHA_FECHADO') && (
                    <div className="border-t border-zinc-900/40 pt-3">
                      {nextMatch.status === 'agendada' ? (
                        <div className="bg-zinc-950/20 border border-dashed border-zinc-900 p-4 rounded-xl text-center text-zinc-500 font-mono text-[11px] leading-relaxed">
                          {nextMatch && (nextMatch.status !== 'agendada' && nextMatch.status !== 'confirmando') ? 'Lista de chamada' : 'Lista de confirmações'} será disponibilizada após a abertura das confirmações.
                        </div>
                      ) : (
                        <div className="space-y-3" id="nested-presence-block">
                          <button
                            type="button"
                            onClick={() => setShowPresenceListDetail(!showPresenceListDetail)}
                            className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900 p-3 text-xs text-zinc-400 hover:text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between font-mono cursor-pointer transition gap-1.5"
                          >
                            <div className="flex flex-col items-start gap-1">
                              <span className="flex items-center gap-1.5 text-white font-bold font-sans">
                                <Users2 className="w-4 h-4 text-emerald-400" />
                                <span>{nextMatch && (nextMatch.status !== 'agendada' && nextMatch.status !== 'confirmando') ? 'Lista de Chamada' : 'Lista de Confirmações'}</span>
                              </span>
                              <span className="text-[10px] text-zinc-500 pl-5">
                                ({confirmedCount} confirmados)
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider self-end sm:self-auto text-emerald-400">
                              <span>{showPresenceListDetail ? 'Esconder' : 'Expandir'}</span>
                              {showPresenceListDetail ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {showPresenceListDetail && (
                            <div className="mt-2 bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl space-y-2 font-mono text-[11px] animate-fadeIn">
                              {presences.length === 0 ? (
                                <div className="text-center italic text-zinc-600 py-3">Nenhuma presença declarada ainda.</div>
                              ) : (
                                <div className="space-y-2.5">
                                  {/* Bulk action selection bar for admins */}
                                  {isAdmin && presences.length > 0 && nextMatch && (nextMatch.status === 'confirmando' || nextMatch.status === 'aguardando_reservas') && (
                                    <div className="bg-[#0b120f] border border-emerald-500/15 rounded-xl p-3 flex flex-col gap-2 mb-2 font-mono">
                                      <div className="text-[10px] uppercase font-bold tracking-wider text-[#94a3b8]">
                                        Ações de Confirmação em Lote
                                      </div>
                                      <div className="text-[9px] text-[#64748b] leading-tight flex justify-between">
                                        <span>Vagas Disponíveis: <strong>{missingCount} de {maxPlayersLimit}</strong></span>
                                        <span>Status da Rodada: <strong className="text-emerald-450 capitalize">{nextMatch.status.replace('_', ' ')}</strong></span>
                                      </div>

                                      {nextMatch.status === 'confirmando' && (
                                        <div className="mt-1">
                                          <button
                                            type="button"
                                            disabled={actionLoading || missingCount <= 0}
                                            onClick={handleConfirmMensalistasInBulk}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-sans font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 border border-emerald-500/10 cursor-pointer"
                                          >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>Confirmar Mensalistas Pendentes</span>
                                          </button>
                                          <p className="text-[9px] text-zinc-500 mt-1.5 font-sans leading-normal">
                                            * Confirma apenas mensalistas que estão pendentes, respeitando o limite do racha ({maxPlayersLimit} no total).
                                          </p>
                                        </div>
                                      )}

                                      {nextMatch.status === 'aguardando_reservas' && (
                                        <div className="mt-1">
                                          <button
                                            type="button"
                                            disabled={actionLoading || missingCount <= 0}
                                            onClick={handleConfirmReservesInBulk}
                                            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-sans font-black py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                                          >
                                            <Users2 className="w-3.5 h-3.5" />
                                            <span>Confirmar Reservas Convocados</span>
                                          </button>
                                          <p className="text-[9px] text-zinc-500 mt-1.5 font-sans leading-normal">
                                            * Confirma apenas reservas da fila que já se disponibilizaram para o racha, seguindo a ordem da fila de prioridade.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {sortedPresencesForList.map((p: any) => {
                                    // Look up the matching registered athlete to fetch real-time category and primary position
                                    const matchingPlayer = players.find((pl: any) => pl.id === p.playerId);
                                    
                                    const playerCat = matchingPlayer ? matchingPlayer.category : (p.category || 'reserva');
                                    const catLabel = CATEGORY_LABELS[playerCat] || 'Reserva';
                                    
                                    const playerPos = matchingPlayer ? matchingPlayer.primaryPosition : (p.isGoleiro ? 'goleiro' : '');
                                    const posLabel = playerPos && POSITION_LABELS[playerPos] ? POSITION_LABELS[playerPos] : '';
                                    
                                    const displayLegend = posLabel ? `${catLabel} • ${posLabel}` : catLabel;

                                    return (
                                      <div 
                                        key={p.playerId} 
                                        className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-zinc-900 last:border-b-0 gap-3 sm:gap-2"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="flex flex-col gap-0.5 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-extrabold text-[#e2e8f0] truncate text-xs sm:text-[11px] font-sans">
                                                {p.name}
                                              </span>
                                              {p.isGoleiro && (
                                                <span className="text-[8.5px] px-1 py-0 bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 rounded-md font-sans font-bold shrink-0 uppercase tracking-widest leading-none">
                                                  GK
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[9px] text-zinc-500 font-sans uppercase font-bold tracking-widest">
                                              {displayLegend}
                                            </span>
                                          </div>
                                        </div>
                                      <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                                        <div className="flex items-center gap-1 font-mono text-[10px]">
                                          <span className="text-zinc-500 sm:hidden">Status: </span>
                                          <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider bg-zinc-900/40 border ${
                                            p.presenceStatus === 'confirmado' 
                                              ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' 
                                              : p.presenceStatus === 'cancelado' 
                                                ? 'text-rose-500 border-rose-500/20 bg-rose-500/5' 
                                                : 'text-[#94a3b8] border-zinc-805'
                                          }`}>
                                            {p.presenceStatus === 'confirmado' ? 'Confirmado' : p.presenceStatus === 'cancelado' ? 'Não Vai' : 'Pendente'}
                                          </span>
                                        </div>
                                        {isAdmin && (
                                          <div className="flex gap-2.5 items-center">
                                            {p.presenceStatus !== 'confirmado' && (
                                              <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                                className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/25 rounded-xl w-11 h-11 sm:w-10 sm:h-10 transition cursor-pointer flex items-center justify-center active:scale-95 flex-shrink-0"
                                                title="Aprovar participação"
                                              >
                                                <Check className="w-5.5 h-5.5 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                                              </button>
                                            )}
                                            {p.presenceStatus !== 'cancelado' && (
                                              <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                                className="bg-rose-500/10 hover:bg-rose-500 text-rose-450 hover:text-black border border-rose-500/25 rounded-xl w-11 h-11 sm:w-10 sm:h-10 transition cursor-pointer flex items-center justify-center active:scale-95 flex-shrink-0"
                                                title="Remover / Cancelar"
                                              >
                                                <X className="w-5.5 h-5.5 sm:w-4.5 sm:h-4.5 stroke-[3]" />
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                  {/* RESERVES SECTION */}
                  {roundStatus.needsReserve && nextMatch.status !== 'agendada' && nextMatch.status !== 'sorteada' && nextMatch.status !== 'encerrada' && (() => {
                    const activeConvocationPlayerId = reserveQueue?.activeConvocation?.playerId;
                    const suggestedPlayer = activeConvocationPlayerId
                      ? players.find(p => p.id === activeConvocationPlayerId)
                      : (reserveQueue?.queue && reserveQueue.queue.length > 0 ? players.find(p => p.id === reserveQueue.queue[0].id) : null);

                    return (
                      <div className="border-t border-zinc-900 pt-4 mt-3">
                        <div className="text-[10px] text-zinc-400 uppercase font-black tracking-wider pb-1.5 border-b border-zinc-900/50 mb-3 flex justify-between items-center">
                          <span>Reservas na Prioridade</span>
                          {reserveQueue?.activeConvocation && (
                            <span className="text-[8px] font-mono tracking-widest font-extrabold uppercase px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded animate-pulse">
                              Convocado - Aguardando Resposta
                            </span>
                          )}
                        </div>

                        {suggestedPlayer ? (
                          <div className="bg-zinc-950/40 border border-[#1f2937]/30 rounded-lg p-3.5 space-y-3 shadow-md">
                            <div>
                              <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">
                                {reserveQueue?.activeConvocation ? 'Atleta Convocado' : 'Reserva Sugerido'}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-[#e2e8f0] text-sm font-sans">
                                  {suggestedPlayer.name}
                                </span>
                                {suggestedPlayer.primaryPosition === 'goleiro' && (
                                  <span className="text-[8.5px] px-1.5 py-0.5 bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 rounded-md font-sans font-bold shrink-0 uppercase tracking-widest leading-none">
                                    GK
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-emerald-450 uppercase font-bold tracking-wider mt-1.5 font-mono">
                                {getAbbreviation(suggestedPlayer.primaryPosition)} - {POSITION_LABELS[suggestedPlayer.primaryPosition as any] || suggestedPlayer.primaryPosition}
                                {suggestedPlayer.secondaryPositions && suggestedPlayer.secondaryPositions.length > 0 && (
                                  <span className="text-zinc-500 font-sans normal-case">
                                    {' '}| SEC: {suggestedPlayer.secondaryPositions.map((pos: string) => `${getAbbreviation(pos)} - ${POSITION_LABELS[pos as any] || pos}`).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-zinc-900/60 pt-2 text-[11px] font-sans">
                              <span className="text-zinc-500 uppercase font-extrabold tracking-wider text-[9px] block">Motivo:</span>
                              <span className="text-zinc-300 font-medium">
                                {reserveQueue?.isGoleiroMissing && suggestedPlayer.primaryPosition === 'goleiro'
                                  ? 'Vaga de goleiro aberta por ausência confirmada.'
                                  : 'Vaga aberta por desistência.'}
                              </span>
                            </div>

                            <div className="pt-1.5 flex items-center justify-end gap-2">
                              {reserveQueue?.activeConvocation ? (
                                /* RESPONSE FLOW */
                                (isAdmin || currentUser.playerId === reserveQueue.activeConvocation.playerId || currentUser.id === reserveQueue.activeConvocation.playerId || (resolvedPlayerId && resolvedPlayerId === reserveQueue.activeConvocation.playerId)) ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={() => handleRespondReserveConvocation(reserveQueue.activeConvocation!.id, 'confirmado')}
                                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition cursor-pointer active:scale-95 flex items-center gap-1"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>Confirmar Presença</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={() => handleRespondReserveConvocation(reserveQueue.activeConvocation!.id, 'recusado')}
                                      className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition cursor-pointer active:scale-95 flex items-center gap-1"
                                    >
                                      <X className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>Não Vou / Recusar</span>
                                    </button>
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        disabled={actionLoading}
                                        onClick={() => handleRespondReserveConvocation(reserveQueue.activeConvocation!.id, 'dispensado')}
                                        className="bg-zinc-850 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700/50 text-zinc-300 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition cursor-pointer active:scale-95"
                                      >
                                        Dispensar
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-zinc-500 italic text-[11px] font-sans bg-zinc-950/20 py-2 text-center rounded border border-zinc-900/60 block w-full">
                                    ⌛ Aguardando retorno da convocação enviada...
                                  </span>
                                )
                              ) : (
                                /* SUGGESTION / ACTION FLOW */
                                isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={handleSummonNextReserve}
                                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer active:scale-95"
                                    >
                                      Convocar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionLoading}
                                      onClick={() => handleIgnoreReservePlayer(suggestedPlayer.id)}
                                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition cursor-pointer active:scale-95"
                                    >
                                      Ignorar
                                    </button>
                                  </>
                                )
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-zinc-500 italic text-[11px] py-3 text-center bg-zinc-950/25 border border-zinc-900 rounded-lg">
                            📭 Fila de reservas vazia ou todos os jogadores foram ignorados.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
      ) : (
        <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-8 text-center space-y-4 shadow-xl order-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-white font-display font-extrabold text-sm uppercase">Nenhum racha ativo no momento</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Agende uma nova rodada para iniciar o próximo ciclo.
          </p>
          {(currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
            <div className="pt-2 text-zinc-500 text-[11px] font-mono leading-relaxed">
              Dica: Vá até a aba <span className="text-emerald-400 font-bold">"Calendário"</span> para configurar a recorrência e gerar rachas automaticamente para todo o ano de 2026!
            </div>
          )}
        </div>
      )}

      {/* NOVA ÁREA RESUMIDA DA HOME - 2 COLUNAS DE LARGURA EQUIVALENTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 order-8" id="dashboard-summarized-info-panel">
        {/* Coluna Esquerda: Resumo Financeiro */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="flex flex-col h-full justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-900/40">
                <span className="text-lg">💵</span>
                <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-wide">
                  Resumo Financeiro
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 font-sans mt-1.5">
                Acompanhe a integridade financeira geral e suas pendências individuais de mensalidades.
              </p>
            </div>

            {/* Real-time Financial Overview widgets */}
            <div className="space-y-3 font-mono text-[11px]">
              {/* User personal pending sum badge indicator */}
              <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                <span className="text-zinc-400 text-[10px] uppercase font-bold font-sans">Minhas Pendências:</span>
                {(() => {
                  const myUserBills = finData?.bills || [];
                  const userPendingTotal = myUserBills
                    .filter((b: any) => b.status === 'pendente')
                    .reduce((sum: number, b: any) => sum + b.amount, 0);

                  if (userPendingTotal > 0) {
                    return (
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20 uppercase">
                        R$ {userPendingTotal.toFixed(2)} EM ABERTO
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-[10px] font-black text-[#4ade80] bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 uppercase">
                        Nenhuma pendência 🎉
                      </span>
                    );
                  }
                })()}
              </div>

              {/* General Health statistics without showing debtor names */}
              <div className="space-y-2 bg-zinc-900/40 p-3 rounded-lg border border-zinc-900/60">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block font-sans">
                  Caixa do Grupo (Saúde Financeira)
                </span>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1 text-zinc-400">
                  <div className="space-y-1">
                    <span className="text-[8px] text-zinc-500 uppercase block font-sans">Previsto</span>
                    <span className="text-white font-extrabold text-xs block">R$ {Math.round(finData?.health?.totalExpected || 0)}</span>
                  </div>
                  <div className="space-y-1 border-x border-zinc-900">
                    <span className="text-[8px] text-emerald-500 uppercase block font-sans">Recebido</span>
                    <span className="text-emerald-400 font-extrabold text-xs block">R$ {Math.round(finData?.health?.totalReceived || 0)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] text-amber-500 uppercase block font-sans">Aberto</span>
                    <span className="text-amber-400 font-extrabold text-xs block">R$ {Math.round(finData?.health?.totalPending || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Mural Destaque da Temporada */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 flex flex-col justify-between space-y-4 shadow-lg">
          <div className="flex flex-col h-full justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-900/40">
                <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
                  Mural Destaque da Temporada
                </h3>
              </div>
              <p className="text-[12px] text-zinc-400 font-sans mt-1.5">
                Os grandes destaques do grupo nesta temporada.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {/* 1. ALL-STAR TEAM DA TEMPORADA */}
              <div className="w-full bg-[#0e1411]/60 border border-emerald-900/30 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-emerald-950/40 pb-1.5">
                  <span className="text-[11px] text-amber-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                    ⭐ ALL-STAR TEAM DA TEMPORADA
                  </span>
                  <span className="text-[9px] text-zinc-500 font-sans font-bold">TOP 5 PERFORMANCE</span>
                </div>
                {allStarTeam.length > 0 ? (
                  <div className="space-y-1.5">
                    {allStarTeam.map((p: any) => (
                      <div key={p.playerId} className="flex justify-between items-center text-[11px]">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-amber-400 font-extrabold w-8 text-left bg-zinc-900/50 px-1 py-0.5 rounded text-[10px] text-center border border-zinc-850">
                            {p.slotLabel}
                          </span>
                          <span className="text-white font-sans font-extrabold truncate max-w-[130px] sm:max-w-[180px]">
                            {p.name}
                          </span>
                        </div>
                        <span className="text-emerald-400 font-extrabold font-mono">
                          {p.vitorias}V ({p.aproveitamento}%)
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center italic text-zinc-550 font-sans py-2 text-[11px]">
                    Dados insuficientes para cálculo do All-Star.
                  </div>
                )}
              </div>

              {/* 2. TOP 5 ATLETAS */}
              <div className="w-full bg-zinc-950/60 border border-zinc-900 rounded-lg p-3.5 font-mono">
                <span className="text-[11px] text-amber-400 uppercase tracking-wider font-extrabold block mb-1.5">⭐ TOP 5 ATLETAS (VITÓRIAS)</span>
                <div className="space-y-1">
                  {stats && stats.individual && stats.individual.length > 0 ? (
                    stats.individual.slice(0, 5).map((p: any, idx: number) => (
                      <div key={p.playerId} className="flex justify-between items-center text-[11px] text-zinc-300">
                        <span className="truncate max-w-[140px] font-sans">{idx + 1}. {p.name}</span>
                        <span className="text-emerald-400 font-extrabold">{p.vitorias}V ({p.aproveitamento}%)</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-zinc-550 italic font-sans py-1 text-center font-bold">Nenhum atleta registrado.</p>
                  )}
                </div>
              </div>

              {/* 3. TERCEIRA LINHA - GRADE DE KPIs (4 cards menores idênticos) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] font-mono">
                {/* Duo */}
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between min-h-[110px] h-full">
                  <div>
                    <span className="text-[11px] text-[#38bdf8] uppercase tracking-wider font-extrabold block">🤝 Duo</span>
                    <h4 className="text-white text-[11px] font-bold mt-0.5 truncate leading-tight">
                      {stats && stats.duos && stats.duos.length > 0 
                        ? `${stats.duos[0].playerAName.split(' ')[0]} + ${stats.duos[0].playerBName.split(' ')[0]}` 
                        : 'Sem dados'}
                    </h4>
                  </div>
                  {stats && stats.duos && stats.duos.length > 0 ? (
                    <div className="text-[10px] text-zinc-400 mt-1 leading-tight font-sans">
                      💪 {stats.duos[0].wonTogether || stats.duos[0].winsCount || 0}V ({stats.duos[0].aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-550 font-sans">Sem dados...</span>
                  )}
                </div>

                {/* Trio */}
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between min-h-[110px] h-full">
                  <div>
                    <span className="text-[11px] text-purple-400 uppercase tracking-wider font-extrabold block">🚀 Trio</span>
                    <div className="text-white text-[10px] font-bold mt-1 leading-tight flex flex-col gap-0.5">
                      {stats && stats.trios && stats.trios.length > 0 ? (
                        <>
                          <span className="truncate block">{stats.trios[0].playerAName.split(' ')[0]}</span>
                          <span className="truncate block">{stats.trios[0].playerBName.split(' ')[0]}</span>
                          <span className="truncate block">{stats.trios[0].playerCName.split(' ')[0]}</span>
                        </>
                      ) : (
                        <span>Sem dados</span>
                      )}
                    </div>
                  </div>
                  {stats && stats.trios && stats.trios.length > 0 ? (
                    <div className="text-[10px] text-zinc-400 mt-1 leading-tight font-sans">
                      🔥 {stats.trios[0].wonTogether || stats.trios[0].winsCount || 0}V ({stats.trios[0].aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-550 font-sans">Sem dados...</span>
                  )}
                </div>

                {/* Sequência */}
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between min-h-[110px] h-full">
                  <div>
                    <span className="text-[11px] text-[#a855f7] uppercase tracking-wider font-extrabold block">👑 Sequência</span>
                    <h4 className="text-white text-[11px] font-bold mt-0.5 truncate leading-tight">
                      {streakRecordHolder && streakRecordHolder.maxStreak > 0 
                        ? streakRecordHolder.name.split(' ')[0] 
                        : 'Sem dados'}
                    </h4>
                  </div>
                  {streakRecordHolder && streakRecordHolder.maxStreak > 0 ? (
                    <div className="text-[10px] text-zinc-400 mt-1 leading-tight font-sans">
                      🔥 Recorde: {streakRecordHolder.maxStreak}V
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-550 font-sans">Sem dados...</span>
                  )}
                </div>

                {/* Goleiro Destaque */}
                <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between min-h-[110px] h-full">
                  <div>
                    <span className="text-[11px] text-rose-400 uppercase tracking-wider font-extrabold block">🧤 Goleiro</span>
                    <h4 className="text-white text-[11px] font-bold mt-0.5 truncate leading-tight">
                      {bestKeeper ? bestKeeper.name.split(' ')[0] : 'Sem dados'}
                    </h4>
                  </div>
                  {bestKeeper ? (
                    <div className="text-[10px] text-zinc-400 mt-1 leading-tight font-sans">
                      🧤 {bestKeeper.vitorias}V/{bestKeeper.presences}J ({bestKeeper.aproveitamento}%)
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-550 font-sans">Sem dados suficientes.</span>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

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

    </div>
  );
}
