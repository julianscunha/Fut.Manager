import React, { useState, useEffect } from 'react';
import { User, PresenceStatus } from '../types';
import { getAchievementsForPlayer, getMostRecentAchievement } from '../utils/achievements';
import { 
  Calendar, MapPin, Clock, Trophy, AlertCircle, ArrowUpRight, Check, 
  Users, Users2, Shield, Sparkles, X, ChevronDown, ChevronUp, BellRing,
  CheckCircle2, AlertTriangle, ArrowDownAZ, VolumeX, Flame, Gift, Compass, Settings,
  Baby, User as UserIcon, Share2
} from 'lucide-react';

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
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [priorityReserves, setPriorityReserves] = useState<any[]>([]);
  const [loadingReserves, setLoadingReserves] = useState(false);
  const [showReserveSuggestions, setShowReserveSuggestions] = useState(false);
  
  // Results inputs for inline past match registrations
  const [winsBlueInput, setWinsBlueInput] = useState<string>('0');
  const [winsRedInput, setWinsRedInput] = useState<string>('0');
  const [winsGreenInput, setWinsGreenInput] = useState<string>('0');

  // Financial Stats
  const [finData, setFinData] = useState<any>(null);

  // Analytical Racha States
  const [stats, setStats] = useState<any>(null);
  const [latestResult, setLatestResult] = useState<any>(null);

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
        const activeMatches = matches.filter((m: any) => ['agendada', 'confirmando', 'aguardando_reservas', 'fechada', 'sorteada'].includes(m.status));
        // Since matches is sorted by date ascending, the first active match is the closest to today chronologically
        const targetMatch = activeMatches.length > 0 ? activeMatches[0] : matches[matches.length - 1];
        
        setNextMatch(targetMatch);

        // Fetch presences for this match
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
              const matchingPlayer = playersList.find((p: any) => {
                if (currentUser.playerId && p.id === currentUser.playerId) return true;
                if (p.email && currentUser.email && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) return true;
                return false;
              });
              if (matchingPlayer) {
                // If the user matches an active athlete profile
                linkedAthleteCategory = matchingPlayer.category; // e.g. 'mensalista' or 'mensalista_goleiro'
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
    window.open(`https://api.whatsapp.com/send?text=${escapedMsg}`, '_blank');
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

    if (status === 'confirmado' && currentUserCategory !== 'reserva' && isDeadlineExpired) {
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

  const handleShareMatchOnWhatsApp = () => {
    if (!nextMatch) return;
    const formattedDate = nextMatch.date.split('-').reverse().join('/');
    const confirmedList = confirmedPlayers.map((p, idx) => `👉 ${idx + 1}. ${p.name}`).join('\n');
    const absentList = cancelPlayers.map(p => `❌ ${p.name}`).join('\n');
    const vacanciesCount = Math.max(0, 15 - confirmedCount);
    
    const textMsg = `⚽ *RACHA DO FOFIM - CONVOCADOS PARA O DIA ${formattedDate}!* ⚽\n` +
      `📅 *Data:* ${formattedDate} às ${nextMatch.time}\n` +
      `📍 *Local:* ${nextMatch.location}\n\n` +
      `👥 *Confirmados (${confirmedCount}/15):*\n${confirmedList || '_Nenhum jogador confirmado ainda_'}\n\n` +
      `❌ *Não Vão (${cancelPlayers.length}):*\n${absentList || '_Nenhuma recusa registrada_'}\n\n` +
      `⚠️ *Vagas em aberto:* ${vacanciesCount} vagas disponíveis!\n\n` +
      `Por favor, atualizem seus status de presença no app oficial:\n` +
      `👉 Acesse e confirme: https://racha-do-fofim.com\n\n` +
      `Abraços e bom racha!`;
      
    const escapedMsg = encodeURIComponent(textMsg);
    window.open(`https://api.whatsapp.com/send?text=${escapedMsg}`, '_blank');
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
  const confirmedPlayers = presences.filter(p => p.presenceStatus === 'confirmado');
  const cancelPlayers = presences.filter(p => p.presenceStatus === 'cancelado');
  const unconfirmedPlayers = presences.filter(p => p.presenceStatus === 'nao_confirmado');

  const confirmedCount = confirmedPlayers.length;
  const maxPlayersLimit = nextMatch && nextMatch.maxPlayers !== undefined && nextMatch.maxPlayers !== null ? nextMatch.maxPlayers : 15;
  const missingCount = nextMatch ? Math.max(0, maxPlayersLimit - confirmedCount) : 0;
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

  // Determine current operational state for the nextMatch representing the single logical next action
  const getAdminOperationalState = () => {
    if (pastMatchesWithoutResults.length > 0) {
      return 'pos_jogo';
    }
    if (!nextMatch) return null;

    if (nextMatch.status === 'agendada') {
      return 'agendada';
    }
    if (nextMatch.status === 'fechada') {
      return 'racha_fechado';
    }
    if (nextMatch.status === 'aguardando_reservas') {
      return 'necessidade_reservas';
    }
    if (nextMatch.status === 'sorteada') {
      return 'sorteada';
    }
    if (nextMatch.status === 'encerrada') {
      return 'encerrada';
    }
    if (nextMatch.status === 'cancelada') {
      return 'cancelada';
    }
    if (confirmedCount >= 15) {
      return 'racha_fechado';
    }
    if (areReservesReleased && confirmedCount < 15) {
      return 'necessidade_reservas';
    }
    if (nextMatch.status === 'confirmando') {
      return 'confirmacoes_abertas';
    }
    return null;
  };

  const adminState = getAdminOperationalState();
  const hasPendingActions = isAdmin && adminState !== null;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn" id="dashboard-status-wrapper">

      {/* PAINEL OPERACIONAL: AÇÕES NECESSÁRIAS */}
      {isAdmin && adminState && (
        <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-950/5 p-4 md:p-5 space-y-4 shadow-lg order-1" id="admin-required-actions-panel">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#22c55e]/20">
            <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="font-display font-extrabold text-sm text-white uppercase tracking-wider">AÇÕES NECESSÁRIAS</span>
            <span className="ml-auto text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Painel do Administrador
            </span>
          </div>

          <div className="space-y-4">
            
            {adminState === 'pos_jogo' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl text-xs font-sans animate-fadeIn">
                <div className="space-y-1">
                  <div className="font-extrabold text-amber-500 flex items-center gap-2 text-sm animate-pulse">
                    <Trophy className="w-4.5 h-4.5 text-amber-500" />
                    <span>Resultado de Jogo Pendente</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-sans">
                    O resultado da rodada ainda não foi registrado.
                  </p>
                </div>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'calendar' }));
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4.5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer self-stretch sm:self-auto shadow-md hover:scale-[1.01] active:scale-95 transition-all text-center"
                >
                  Gravar Placar
                </button>
              </div>
            )}

            {adminState === 'agendada' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl text-xs font-sans animate-fadeIn">
                <div className="space-y-1">
                  <div className="font-extrabold text-white flex items-center gap-2 text-sm">
                    <Calendar className="w-4.5 h-4.5 text-emerald-400" />
                    <span>Rodada Agendada</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-sans">
                    A rodada de <span className="text-emerald-400 font-bold font-mono">{nextMatch.date.split('-').reverse().join('/')}</span> está agendada e aguarda liberação das confirmações.
                  </p>
                </div>
                <button
                  disabled={actionLoading}
                  onClick={handleOpenConfirmations}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4.5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer self-stretch sm:self-auto shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  Abrir Confirmações
                </button>
              </div>
            )}

            {adminState === 'racha_fechado' && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl text-xs font-sans animate-fadeIn">
                <div className="space-y-1">
                  <div className="font-extrabold text-[#4ade80] flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4.5 h-4.5 text-[#4ade80]" />
                    <span>Racha Completo!</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-sans">
                    {confirmedCount} de {maxPlayersLimit} jogadores confirmados.
                  </p>
                </div>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }));
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4.5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer self-stretch sm:self-auto shadow-md hover:scale-[1.01] active:scale-95 transition-all"
                >
                  Realizar Sorteio
                </button>
              </div>
            )}

            {adminState === 'necessidade_reservas' && (
              <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl text-xs space-y-4 font-sans animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="font-extrabold text-white text-sm">Falta de Atletas</span>
                </div>

                <p className="text-zinc-300 text-[11px] sm:text-xs leading-relaxed pl-1 font-sans">
                  Faltam <span className="text-amber-400 font-bold font-mono text-xs">{15 - confirmedCount}</span> atletas para fechar o racha.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <button
                    onClick={async () => {
                      if (!showReserveSuggestions) {
                        await fetchReservesOrder();
                      }
                      setShowReserveSuggestions(!showReserveSuggestions);
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black py-2.5 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 select-none"
                  >
                    <span>Convocar Reservas</span>
                    {showReserveSuggestions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleShareMatchOnWhatsApp}
                    className="flex-1 bg-[#128C7E] hover:bg-[#075e54] border border-[#128C7E]/20 text-white font-black py-2.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <Share2 className="w-4 h-4 text-white shrink-0" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>
                </div>

                {showReserveSuggestions && (
                  <div className="pt-3 border-t border-zinc-900/40 space-y-2 mt-2 animate-fadeIn">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-bold">
                      Sugeridos da Fila de Reservas (Próximos em Ordem de Prioridade):
                    </div>
                    {loadingReserves ? (
                      <div className="text-[11px] text-zinc-500 font-mono animate-pulse py-2">
                        Buscando fila de prioridade do banco...
                      </div>
                    ) : priorityReserves.filter(r => !confirmedPlayers.some(p => p.playerId === r.id)).length === 0 ? (
                      <div className="text-[11px] text-zinc-500 font-mono py-1">
                        Nenhum reserva pendente na fila disponível para convocação.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {priorityReserves
                          .filter(r => !confirmedPlayers.some(p => p.playerId === r.id))
                          .slice(0, 4)
                          .map((reserve: any, idx) => (
                            <div key={reserve.id} className="flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-805">
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-zinc-200 block truncate text-xs">
                                  {idx + 1}. {reserve.name}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono block truncate">
                                  ⚽ Reserva {reserve.phone ? `| ${reserve.phone}` : ''}
                                </span>
                              </div>
                              <button
                                disabled={actionLoading}
                                onClick={() => handleAdminTogglePresence(reserve.id, 'confirmado')}
                                className="bg-emerald-600/95 hover:bg-emerald-500 text-white font-black px-2.5 py-1.5 rounded text-[10px] uppercase transition cursor-pointer flex items-center gap-1 hover:scale-[1.02] shrink-0 active:scale-95"
                              >
                                <Check className="w-3.5 h-3.5 inline" />
                                Convocar
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {adminState === 'confirmacoes_abertas' && (
              <div className="bg-zinc-950/80 border border-zinc-900 p-4 rounded-xl text-xs space-y-4 font-sans animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  <span className="text-base text-emerald-400">⚽</span>
                  <span className="font-extrabold text-white text-sm">Confirmações Abertas</span>
                </div>
                
                <p className="text-zinc-400 text-[11px] sm:text-xs font-sans">
                  Os mensalistas já podem confirmar presença.
                </p>

                <div className="font-mono text-[11px] space-y-1.5 bg-zinc-900/30 p-3 rounded-lg border border-zinc-900/60 leading-relaxed">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span>Confirmados:</span>
                    <span className="text-emerald-400 font-extrabold font-mono text-xs">{confirmedCount} de {maxPlayersLimit}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-300">
                    <span>Prazo encerra em:</span>
                    <span className="text-emerald-300 font-bold font-mono text-xs">{nextMatch.deadlineDateStr || 'Não definido'}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={handleShareMatchOnWhatsApp}
                    className="flex-1 bg-[#128C7E] hover:bg-[#075e54] text-white font-black py-2.5 rounded-lg text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Share2 className="w-4 h-4 text-white shrink-0" />
                    <span>Compartilhar no WhatsApp</span>
                  </button>
                </div>
              </div>
            )}








          </div>
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

      {/* Admin Reserve Queue substitution prompts */}
      {reserveAlerts.length > 0 && (currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 animate-pulse order-4">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
            <BellRing className="w-4 h-4 animate-bounce text-amber-400" />
            <span>Convocação de Reservas Recomendada ({reserveAlerts.length})</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-normal">
            Um ou mais mensalistas confirmados cancelaram participação após a data limite. O sistema selecionou automaticamente o reserva prioritize disponível:
          </p>
          <div className="space-y-2">
            {reserveAlerts.map((alert: any) => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-900 px-3.5 py-2.5 rounded-lg text-xs font-mono">
                <div className="space-y-1">
                  <div className="text-zinc-300">
                    📉 <span className="text-rose-400 font-extrabold">{alert.cancelledPlayerName}</span> CANCELOU presença.
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    👉 Próximo da Fila: <span className="text-emerald-400 font-extrabold">{alert.suggestedReservePlayerName || 'Nenhum reserva na prioridade'}</span>
                  </div>
                </div>
                
                {alert.suggestedReservePlayerId && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleSummonReserve(alert.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded font-bold text-[10px] uppercase tracking-wider transition cursor-pointer"
                    >
                      Convocação Direta
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleClearAlert(alert.id)}
                      className="bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 px-2.5 py-1.5 rounded font-bold text-[10px] uppercase transition cursor-pointer"
                    >
                      Dispensar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
                  src={highlightPost.mediaUrl} 
                  alt={highlightPost.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                  <video src={highlightPost.mediaUrl} className="w-full h-full object-cover opacity-60" />
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
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500 font-mono gap-2 text-xs order-2">
          <Clock className="w-6 h-6 text-emerald-400 animate-spin" />
          <span>Lendo informações da próxima rodada...</span>
        </div>
      ) : nextMatch ? (
        <div className="flex flex-col gap-6 order-2 w-full">
          
          {/* Próximo Racha Panel */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 space-y-4 flex flex-col justify-between shadow-lg">
            <div className="space-y-3.5">
              
              <div className="flex justify-between items-center pb-3 border-b border-zinc-900/40">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
                    Próxima Rodada
                  </h3>
                </div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  nextMatch.status === 'agendada'
                    ? 'bg-zinc-800 border-zinc-750 text-zinc-300'
                    : nextMatch.status === 'confirmando'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse'
                      : nextMatch.status === 'aguardando_reservas'
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 animate-pulse'
                        : nextMatch.status === 'fechada'
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                          : nextMatch.status === 'sorteada'
                            ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                            : nextMatch.status === 'encerrada'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : nextMatch.status === 'cancelada'
                                ? 'bg-rose-500/15 border border-rose-500/35 text-rose-400'
                                : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {nextMatch.status === 'agendada' ? 'AGENDADA' :
                   nextMatch.status === 'confirmando' ? 'CONFIRMAÇÕES ABERTAS' :
                   nextMatch.status === 'aguardando_reservas' ? 'AGUARDANDO RESERVAS' :
                   nextMatch.status === 'fechada' ? 'FECHADA' :
                   nextMatch.status === 'sorteada' ? 'SORTEADA' :
                   nextMatch.status === 'encerrada' ? 'FINALIZADA' :
                   nextMatch.status === 'cancelada' ? 'CANCELADA' : nextMatch.status}
                </span>
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

                {nextMatch.status === 'agendada' ? (
                  <div className="flex flex-col items-center justify-center py-6 text-zinc-500 font-mono text-xs gap-1.5 opacity-80 bg-zinc-950/20 border border-dashed border-zinc-900 rounded-xl">
                    <Clock className="w-5 h-5 text-zinc-500" />
                    <span className="font-bold">Confirmações ainda não iniciadas</span>
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
                        ? 'bg-rose-950/20 border-rose-500/20 text-rose-400' 
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

                      {/* CUSTOM REAL-TIME ALERT BANNERS */}
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

                {nextMatch.status === 'agendada' ? (
                  <div className="flex flex-col gap-1 p-3 rounded-lg border border-dashed border-zinc-850 bg-zinc-950/40 text-center font-mono text-[11px]">
                    <span className="text-zinc-400 font-bold">Sua Confirmação:</span>
                    <span className="text-zinc-500 text-[10px]">Sua confirmação ficará disponível após a abertura das confirmações pelo administrador.</span>
                  </div>
                ) : currentUserCategory === 'reserva' && !areReservesReleased ? (
                  <div className="flex flex-col gap-1 p-3 rounded-lg border border-dashed border-zinc-850 bg-zinc-950/40 text-center font-mono text-[11px]">
                    <span className="text-zinc-400 font-bold">Sua Confirmação:</span>
                    <span className="text-amber-500/85 text-[10px]">Reserva: aguardando liberação das confirmações dos mensalistas.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400 font-medium">Sua Confirmação:</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        myPresence === 'confirmado' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                          : myPresence === 'cancelado' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/10'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-750'
                      }`}>
                        {myPresence === 'confirmado' ? 'CONFIRMADO' : myPresence === 'cancelado' ? 'NÃO VOU' : 'PENDENTE'}
                      </span>
                    </div>
                    {nextMatch.status === 'confirmando' && (currentUserCategory === 'mensalista' || currentUserCategory === 'mensalista_goleiro') && (
                      <div className="text-[10.5px] text-emerald-400/90 text-center font-sans font-semibold pt-1.5 border-t border-zinc-900/60">
                        Sua confirmação está disponível.
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* RSVP BUTTON ACTIONS */}
            <div className="space-y-2 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={nextMatch.status === 'agendada' || (currentUserCategory === 'reserva' && !areReservesReleased) || actionLoading || (currentUserCategory !== 'reserva' && isDeadlineExpired && myPresence !== 'confirmado')}
                  onClick={() => handleRsvpHolder('confirmado')}
                  className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 ${
                    nextMatch.status === 'agendada' || (currentUserCategory === 'reserva' && !areReservesReleased)
                      ? 'bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed opacity-40'
                      : (currentUserCategory !== 'reserva' && isDeadlineExpired && myPresence !== 'confirmado')
                        ? 'bg-zinc-800 border border-zinc-750 text-zinc-500 cursor-not-allowed opacity-50'
                        : myPresence === 'confirmado'
                          ? 'bg-emerald-600/30 border border-emerald-400 text-emerald-300'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-500/5'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Vou Jogar</span>
                </button>

                <button
                  disabled={nextMatch.status === 'agendada' || (currentUserCategory === 'reserva' && !areReservesReleased) || actionLoading}
                  onClick={() => handleRsvpHolder('cancelado')}
                  className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                    nextMatch.status === 'agendada' || (currentUserCategory === 'reserva' && !areReservesReleased)
                      ? 'bg-zinc-900 border border-zinc-850 text-zinc-650 cursor-not-allowed opacity-40'
                      : myPresence === 'cancelado'
                        ? 'bg-rose-950/40 border border-rose-400 text-rose-400'
                        : 'bg-zinc-905 border border-zinc-800 hover:bg-zinc-850 hover:text-white text-zinc-400'
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>Não Vou</span>
                </button>
              </div>

              {/* LIST OF CONFIRMED / CANCELLED IN THE MATCH */}
              <div className="border-t border-zinc-900 pt-3">
                {nextMatch.status === 'agendada' ? (
                  <div className="bg-zinc-950/20 border border-dashed border-zinc-900 p-4 rounded-xl text-center text-zinc-500 font-mono text-[11px] leading-relaxed">
                    Lista de chamada será disponibilizada após a abertura das confirmações.
                  </div>
                ) : (
                  <div className="space-y-3" id="nested-presence-block">
                    <button
                      type="button"
                      onClick={() => setShowPresenceListDetail(!showPresenceListDetail)}
                      className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900 p-2 text-xs text-zinc-400 hover:text-white rounded flex items-center justify-between font-mono cursor-pointer transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Users2 className="w-4 h-4 text-emerald-400" />
                        <span>Lista de Chamada ({confirmedCount} confirmados)</span>
                      </span>
                      <span>{showPresenceListDetail ? '▲ Esconder' : '▼ Expandir'}</span>
                    </button>

                    {showPresenceListDetail && (
                      <div className="mt-2 bg-zinc-950 border border-zinc-900 p-2.5 rounded max-h-96 overflow-y-auto space-y-2 font-mono text-[11px] animate-fadeIn">
                    {presences.length === 0 ? (
                      <div className="text-center italic text-zinc-600 py-3">Nenhuma presença declarada ainda.</div>
                    ) : (
                      <div className="space-y-2.5">
                        {/* Bulk action selection bar for admins */}
                        {isAdmin && presences.length > 0 && (
                          <div className="bg-[#0b120f] border border-emerald-500/15 rounded-xl p-3 flex flex-col gap-2.5 mb-2 font-mono">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-[10px] font-sans font-bold text-zinc-300 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={selectedPlayerIds.length === presences.length && presences.length > 0}
                                  onChange={handleToggleSelectAll}
                                  className="accent-emerald-500 w-4.5 h-4.5 rounded border-zinc-800 bg-[#070b09] text-emerald-500 cursor-pointer"
                                />
                                <span className="uppercase tracking-wider">Selecionar Todos ({presences.length})</span>
                              </label>
                              {selectedPlayerIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayerIds([])}
                                  className="text-[9px] font-sans font-extrabold text-[#94a3b8] hover:text-white uppercase tracking-wider transition"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>

                            {selectedPlayerIds.length > 0 && (
                              <div className="flex items-center justify-between gap-2 border-t border-zinc-900/60 pt-2.5 mt-0.5 animate-fadeIn">
                                <span className="text-[10px] text-zinc-400 font-sans">
                                  Com os <strong className="text-emerald-400">{selectedPlayerIds.length}</strong> atletas:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleBulkTogglePresence('confirmado')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-[9px] font-sans font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Confirmar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleBulkTogglePresence('cancelado')}
                                    className="bg-rose-950/80 text-rose-400 hover:bg-rose-900 hover:text-white border border-rose-500/25 px-3 py-1.5 rounded-lg text-[9px] font-sans font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Cancelar</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Group by category */}
                        <div>
                          <div className="text-[9px] text-zinc-500 uppercase font-black tracking-wider pb-1">Mensalistas & Goleiros ({confirmedPlayers.filter(p=>p.category !== 'reserva').length})</div>
                          <div className="space-y-1">
                            {presences.filter(p => p.category !== 'reserva').map((p) => (
                              <div key={p.playerId} className="flex justify-between items-center py-2.5 gap-1.5 border-b border-zinc-900/40 last:border-0">
                                <div className="flex items-center min-w-0">
                                  {isAdmin && (
                                    <input
                                      type="checkbox"
                                      checked={selectedPlayerIds.includes(p.playerId)}
                                      onChange={() => handleToggleSelectPlayer(p.playerId)}
                                      className="accent-emerald-500 w-4.5 h-4.5 rounded border-zinc-800 bg-[#070b09] text-emerald-500 cursor-pointer mr-3 flex-shrink-0"
                                    />
                                  )}
                                  <span className={`${p.presenceStatus === 'confirmado' ? 'text-white font-bold' : p.presenceStatus === 'cancelado' ? 'text-zinc-650 line-through' : 'text-zinc-400'} truncate text-xs sm:text-[11px]`}>
                                    ⚽ {p.name} {p.category === 'mensalista_goleiro' && '🧤'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-zinc-900/40 ${
                                    p.presenceStatus === 'confirmado' ? 'text-emerald-400 border border-emerald-500/10' : p.presenceStatus === 'cancelado' ? 'text-rose-500 border border-rose-500/10' : 'text-[#94a3b8] border border-zinc-805'
                                  }`}>
                                    {p.presenceStatus === 'confirmado' ? 'Vou' : p.presenceStatus === 'cancelado' ? 'Falta' : 'Pendente'}
                                  </span>
                                  {isAdmin && (
                                    <div className="flex gap-2">
                                      {p.presenceStatus !== 'confirmado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/25 rounded-xl w-10.5 h-10.5 sm:w-8.5 sm:h-8.5 transition cursor-pointer flex items-center justify-center active:scale-95"
                                          title="Confirmar participação"
                                        >
                                          <Check className="w-5.5 h-5.5 sm:w-4 sm:h-4 stroke-[3]" />
                                        </button>
                                      )}
                                      {p.presenceStatus !== 'cancelado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                          className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black border border-rose-500/25 rounded-xl w-10.5 h-10.5 sm:w-8.5 sm:h-8.5 transition cursor-pointer flex items-center justify-center active:scale-95"
                                          title="Não vai / Cancelar"
                                        >
                                          <X className="w-5.5 h-5.5 sm:w-4 sm:h-4 stroke-[3]" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-zinc-900 pt-3 mt-3">
                          <div className="text-[9px] text-zinc-500 uppercase font-black tracking-wider pb-1.5 border-b border-zinc-900/50 mb-1">
                            Reservas na Prioridade {areReservesReleased && `(${confirmedPlayers.filter(p=>p.category === 'reserva').length})`}
                          </div>
                          {!areReservesReleased ? (
                            <div className="text-zinc-500 italic text-[11px] py-3 text-center border border-dashed border-zinc-900/50 rounded-lg bg-zinc-950/20 font-sans leading-relaxed">
                              ⏳ Reserva: aguardando liberação das confirmações dos mensalistas.
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {presences.filter(p => p.category === 'reserva').map((p, idx) => (
                                <div key={p.playerId} className="flex justify-between items-center py-2.5 gap-1.5 border-b border-zinc-900/40 last:border-0">
                                  <div className="flex items-center min-w-0">
                                    {isAdmin && (
                                      <input
                                        type="checkbox"
                                        checked={selectedPlayerIds.includes(p.playerId)}
                                        onChange={() => handleToggleSelectPlayer(p.playerId)}
                                        className="accent-emerald-500 w-4.5 h-4.5 rounded border-zinc-800 bg-[#070b09] text-emerald-500 cursor-pointer mr-3 flex-shrink-0"
                                      />
                                    )}
                                    <span className={`${p.presenceStatus === 'confirmado' ? 'text-[#4ade80] font-bold' : p.presenceStatus === 'cancelado' ? 'text-zinc-650 line-through' : 'text-zinc-400'} truncate text-xs sm:text-[11px]`}>
                                      {idx + 1}. {p.name} (Reserva)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-zinc-900/40 ${
                                      p.presenceStatus === 'confirmado' ? 'text-[#4ade80] border border-emerald-500/10' : p.presenceStatus === 'cancelado' ? 'text-rose-500 border border-rose-500/10' : 'text-[#a78bfa] border border-[#a78bfa]/10'
                                    }`}>
                                      {p.presenceStatus === 'confirmado' ? 'Vou' : p.presenceStatus === 'cancelado' ? 'Falta' : 'Fila'}
                                    </span>
                                    {isAdmin && (
                                      <div className="flex gap-2">
                                        {p.presenceStatus !== 'confirmado' && (
                                          <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/25 rounded-xl w-10.5 h-10.5 sm:w-8.5 sm:h-8.5 transition cursor-pointer flex items-center justify-center active:scale-95"
                                            title="Aprovar participação"
                                          >
                                            <Check className="w-5.5 h-5.5 sm:w-4 sm:h-4 stroke-[3]" />
                                          </button>
                                        )}
                                        {p.presenceStatus !== 'cancelado' && (
                                          <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                            className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black border border-rose-500/25 rounded-xl w-10.5 h-10.5 sm:w-8.5 sm:h-8.5 transition cursor-pointer flex items-center justify-center active:scale-95"
                                            title="Remover / Cancelar"
                                          >
                                            <X className="w-5.5 h-5.5 sm:w-4 sm:h-4 stroke-[3]" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      ) : (
        <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-8 text-center space-y-4 shadow-xl order-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-white font-display font-extrabold text-sm uppercase">Nenhuma Partida Agendada</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Não existem rodadas agendadas para a temporada ativa no momento. O administrador precisa gerar as partidas recorrentes ou criar uma rodada manualmente.
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
          <div className="flex flex-col h-full justify-between space-y-3.5">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-900/40">
                <Trophy className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                <h3 className="font-display font-extrabold text-white text-xs uppercase tracking-wide">
                  Mural Destaque da Temporada
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 font-sans mt-1.5">
                Os grandes destaques do grupo nesta temporada.
              </p>
            </div>

            {/* Compact grid of subset */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              {/* 1. ÚLTIMO CAMPEÃO */}
              <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-2.5 flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[8px] text-[#22c55e] uppercase tracking-wider font-extrabold block">🏆 Campeão</span>
                  <h4 className="text-white text-[10px] font-black mt-0.5 uppercase truncate">
                    {latestResult ? `Time ${latestResult.champions.join('/')}` : 'Sem dados'}
                  </h4>
                </div>
                {latestResult ? (
                  <div className="text-[9px] text-zinc-450 mt-1 leading-tight font-sans">
                    🔵{latestResult.winsBlue} 🔴{latestResult.textRed || latestResult.winsRed} 🟢{latestResult.textGreen || latestResult.winsGreen}
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 font-sans">Aguardando racha...</span>
                )}
              </div>

              {/* 2. MELHOR DUPLA */}
              <div className="bg-zinc-950/60 border border-[#182330] rounded-lg p-2.5 flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[8px] text-[#38bdf8] uppercase tracking-wider font-extrabold block">👥 Duo</span>
                  <h4 className="text-white text-[10px] font-bold mt-0.5 truncate">
                    {stats && stats.duos && stats.duos.length > 0 
                      ? `${stats.duos[0].playerAName.split(' ')[0]} + ${stats.duos[0].playerBName.split(' ')[0]}` 
                      : 'Sem dados'}
                  </h4>
                </div>
                {stats && stats.duos && stats.duos.length > 0 ? (
                  <div className="text-[9px] text-zinc-450 mt-1 leading-tight">
                    💪 {stats.duos[0].winsCount}V ({Math.round(stats.duos[0].aproveitamento * 100)}%)
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 font-sans">Sem dados...</span>
                )}
              </div>

              {/* 3. MELHOR TRIO */}
              <div className="bg-zinc-950/60 border border-[#2b1f3c] rounded-lg p-2.5 flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[8px] text-purple-400 uppercase tracking-wider font-extrabold block">🚀 Trio</span>
                  <h4 className="text-white text-[10px] font-bold mt-0.5 truncate">
                    {stats && stats.trios && stats.trios.length > 0 
                      ? `${stats.trios[0].playerAName.split(' ')[0]} + ...` 
                      : 'Sem dados'}
                  </h4>
                </div>
                {stats && stats.trios && stats.trios.length > 0 ? (
                  <div className="text-[9px] text-zinc-450 mt-1 leading-tight">
                    🔥 {stats.trios[0].winsCount}V ({Math.round(stats.trios[0].aproveitamento * 100)}%)
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 font-sans">Sem dados...</span>
                )}
              </div>

              {/* 4. LENDA DAS SEQUÊNCIAS */}
              <div className="bg-zinc-950/60 border border-[#251e36] rounded-lg p-2.5 flex flex-col justify-between min-h-[96px]">
                <div>
                  <span className="text-[8px] text-[#a855f7] uppercase tracking-wider font-extrabold block">👑 Sequência</span>
                  <h4 className="text-white text-[10px] font-bold mt-0.5 truncate">
                    {streakRecordHolder && streakRecordHolder.maxStreak > 0 
                      ? streakRecordHolder.name.split(' ')[0] 
                      : 'Sem dados'}
                  </h4>
                </div>
                {streakRecordHolder && streakRecordHolder.maxStreak > 0 ? (
                  <div className="text-[9px] text-zinc-450 mt-1 leading-tight">
                    🔥 Recorde: {streakRecordHolder.maxStreak}V
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 font-sans">Sem dados...</span>
                )}
              </div>
            </div>

            {/* 5. TOP 5 ATLETAS */}
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 font-mono">
              <span className="text-[8px] text-amber-400 uppercase tracking-wider font-extrabold block mb-1.5">⭐ Top 5 Atletas (Vitórias)</span>
              <div className="space-y-1">
                {stats && stats.individual && stats.individual.length > 0 ? (
                  stats.individual.slice(0, 5).map((p: any, idx: number) => (
                    <div key={p.playerId} className="flex justify-between items-center text-[9.5px] text-zinc-300">
                      <span className="truncate max-w-[140px] font-sans">{idx + 1}. {p.name}</span>
                      <span className="text-emerald-400 font-extrabold">{p.vitorias}V ({Math.round(p.aproveitamento * 100)}%)</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-zinc-650 italic font-sans py-1 text-center">Nenhum atleta registrado.</p>
                )}
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

    </div>
  );
}
