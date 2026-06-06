import React, { useState, useEffect } from 'react';
import { User, PresenceStatus } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isHoveredHighlight, setIsHoveredHighlight] = useState(false);
  const [showPresenceListDetail, setShowPresenceListDetail] = useState(false);

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

      if (matches && matches.length > 0) {
        // Find most recent scheduled or confirmando match (closest to today)
        const activeMatches = matches.filter((m: any) => m.status === 'agendada' || m.status === 'confirmando');
        // Since matches is sorted by date ascending, the first active match is the closest to today chronologically
        const targetMatch = activeMatches.length > 0 ? activeMatches[0] : matches[matches.length - 1];
        
        setNextMatch(targetMatch);

        // Fetch presences for this match
        const presRes = await fetch(`/api/matches/${targetMatch.id}/presences`);
        if (presRes.ok) {
          const presData = await presRes.json();
          setPresences(presData.presences || []);
          
          // Find current user's presence
          const myPresRecord = (presData.presences || []).find((pr: any) => pr.playerId === currentUser.id);
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
        body: JSON.stringify({ playerId, status })
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
  const missingCount = nextMatch ? Math.max(0, 15 - confirmedCount) : 0;
  const isDeadlineExpired = nextMatch ? nextMatch.isDeadlineExpired : false;

  // Find current record holder of the longest historical streak
  const getStreakRecordHolder = () => {
    if (!stats || !stats.individual || stats.individual.length === 0) return null;
    const sortedByStreak = [...stats.individual].sort((a: any, b: any) => b.maxStreak - a.maxStreak);
    return sortedByStreak[0];
  };
  const streakRecordHolder = getStreakRecordHolder();

  return (
    <div className="space-y-6 animate-fadeIn" id="dashboard-status-wrapper">
      
      {/* Welcome Card & Status */}
      <div className="relative rounded-2xl border border-zinc-850 bg-zinc-950/40 px-5 py-6 md:p-8 overflow-hidden shadow-xl">
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-mono tracking-wider font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                ● Racha do Fofim Ativo
              </span>
              <span className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded border ${getRoleBadgeColor(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
            </div>
            <h2 className="text-2xl font-display font-black text-white tracking-tight">
              Fala, <span className="text-emerald-400">{currentUser.name}</span>!
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Bem-vindo ao centro oficial de controle. Gerencie sua presença, substituições e acompanhe as estatísticas do grupo society.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1 font-mono">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Acesso Liberado</span>
            <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1.5 bg-[#0a1510] border border-emerald-950 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Jogador Registrado</span>
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Avisos Recentes Widget banner */}
      {notifications.filter(n => n.status === 'nao_lida').length > 0 && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-950/5 p-5 space-y-3 shadow-lg" id="dashboard-recent-news-banner">
          <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-900/40">
            <BellRing className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
            <span className="font-display font-black text-xs text-white uppercase tracking-wider">Avisos Importantes</span>
            <span className="ml-auto text-[9px] font-mono tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {notifications.filter(n => n.status === 'nao_lida').length} Pendentes
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {notifications
              .filter(n => n.status === 'nao_lida')
              .slice(0, 3)
              .map((notif: any) => {
                const getBannerThemeRGB = (category: string) => {
                  switch(category) {
                    case 'financeiro': return 'border-amber-500/25 bg-amber-500/5 text-amber-400';
                    case 'evento': return 'border-violet-500/25 bg-violet-500/5 text-violet-400';
                    case 'sorteio': return 'border-sky-500/25 bg-sky-500/5 text-sky-400';
                    case 'jogador': return 'border-rose-500/25 bg-rose-500/5 text-rose-400';
                    default: return 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400';
                  }
                };

                return (
                  <div 
                    key={notif.id} 
                    className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 text-xs relative overflow-hidden transition hover:bg-zinc-900/10 ${getBannerThemeRGB(notif.category)}`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <span>{notif.title}</span>
                      </div>
                      <p className="text-[11px] text-zinc-450 leading-normal line-clamp-3">
                        {notif.message}
                      </p>
                    </div>
                    {notif.actionUrl && (
                      <button
                        onClick={() => {
                          const event = new CustomEvent('set-active-tab', { detail: notif.actionUrl });
                          window.dispatchEvent(event);
                        }}
                        className="text-[10px] font-extrabold underline cursor-pointer hover:opacity-80 transition self-start block text-emerald-400"
                      >
                        Ver detalhes →
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Action alerts and success indicators */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono flex items-center gap-2 animate-slideDown">
          <Check className="w-4 h-4" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 text-zinc-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-mono flex items-center gap-2 animate-slideDown">
          <AlertCircle className="w-4 h-4" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="p-1 text-zinc-500 hover:text-white">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Admin Reserve Queue substitution prompts */}
      {reserveAlerts.length > 0 && (currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 animate-pulse">
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
        <div className="rounded-xl border border-zinc-850 bg-zinc-950/20 p-5 space-y-4 shadow-xl font-sans" id="dashboard-active-events-panel">
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
        <div className="bg-gradient-to-r from-emerald-950/20 to-zinc-950/40 border border-emerald-500/15 rounded-2xl p-5 shadow-xl relative overflow-hidden animate-fadeIn" id="dashboard-destaque-da-semana">
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
        <div className="flex flex-col items-center justify-center p-12 text-zinc-500 font-mono gap-2 text-xs">
          <Clock className="w-6 h-6 text-emerald-400 animate-spin" />
          <span>Lendo informações da próxima rodada...</span>
        </div>
      ) : nextMatch ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
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
                  nextMatch.status === 'confirmando' 
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {nextMatch.status === 'confirmando' ? 'Aberto / Lista Aberta' : 'Agendada'}
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

                <div className="border-t border-zinc-900/40 pt-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5 font-mono">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Confirmados</span>
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{confirmedCount} Confirmados</span>
                    </span>
                  </div>
                  <div className="space-y-0.5 text-right font-mono">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-black block">Vagas Restantes</span>
                    <span className="text-zinc-300 font-extrabold">
                      {nextMatch.vacancies > 0 ? `${nextMatch.vacancies} Vagas` : 'Lista de Espera'}
                    </span>
                  </div>
                </div>

                {/* Progress bar of slots */}
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow shadow-emerald-500/20"
                    style={{ width: `${Math.min((confirmedCount / 24) * 100, 100)}%` }}
                  />
                </div>

                {/* ALERT SYSTEM RULE: Prazo Expirado ou Menos de 15 confirmados */}
                {missingCount > 0 && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[11px] font-mono text-amber-400">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Faltam jogadores para completar o racha.</span> Necessita de pelo menos 15 atletas. Falta(m) <span className="underline font-black">{missingCount} jogador(es)</span>!
                    </div>
                  </div>
                )}

                {isDeadlineExpired && (
                  <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/25 p-2 rounded-lg text-[10px] font-mono text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span>Prazo limite para confirmações regulares finalizado (D-{nextMatch.deadlineDateStr}).</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono">
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

              </div>
            </div>

            {/* RSVP BUTTON ACTIONS */}
            <div className="space-y-2 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('confirmado')}
                  className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                    myPresence === 'confirmado'
                      ? 'bg-emerald-600/30 border border-emerald-400 text-emerald-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-500/5'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Vou Jogar</span>
                </button>

                <button
                  disabled={actionLoading}
                  onClick={() => handleRsvpHolder('cancelado')}
                  className={`py-2.5 rounded-lg text-xs font-bold font-mono tracking-wider transition uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                    myPresence === 'cancelado'
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
                  <div className="mt-2 bg-zinc-950 border border-zinc-900 p-2.5 rounded max-h-56 overflow-y-auto space-y-2 font-mono text-[11px] animate-fadeIn">
                    {presences.length === 0 ? (
                      <div className="text-center italic text-zinc-600 py-3">Nenhuma presença declarada ainda.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Group by category */}
                        <div>
                          <div className="text-[9px] text-zinc-500 uppercase font-black tracking-wider pb-1">Mensalistas & Goleiros ({confirmedPlayers.filter(p=>p.category !== 'reserva').length})</div>
                          <div className="space-y-1">
                            {presences.filter(p => p.category !== 'reserva').map((p) => (
                              <div key={p.playerId} className="flex justify-between items-center py-0.5">
                                <span className={p.presenceStatus === 'confirmado' ? 'text-white font-bold' : p.presenceStatus === 'cancelado' ? 'text-zinc-600 line-through' : 'text-zinc-400'}>
                                  ⚽ {p.name} {p.category === 'mensalista_goleiro' && '🧤'}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9.5px] px-1 rounded font-bold ${
                                    p.presenceStatus === 'confirmado' ? 'text-emerald-400' : p.presenceStatus === 'cancelado' ? 'text-rose-500' : 'text-zinc-500'
                                  }`}>
                                    {p.presenceStatus === 'confirmado' ? 'CONFIRMADO' : p.presenceStatus === 'cancelado' ? 'CANCELADO' : 'PENDENTE'}
                                  </span>
                                  {isAdmin && (
                                    <div className="flex gap-1">
                                      {p.presenceStatus !== 'confirmado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 rounded p-1 transition cursor-pointer flex items-center justify-center"
                                          title="Aprovar participação"
                                        >
                                          <Check className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      {p.presenceStatus !== 'cancelado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                          className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black border border-rose-500/20 rounded p-1 transition cursor-pointer flex items-center justify-center"
                                          title="Remover / Cancelar"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-zinc-900 pt-2.5 mt-2">
                          <div className="text-[9px] text-zinc-500 uppercase font-black tracking-wider pb-1">Reservas na Prioridade ({confirmedPlayers.filter(p=>p.category === 'reserva').length})</div>
                          <div className="space-y-1">
                            {presences.filter(p => p.category === 'reserva').map((p, idx) => (
                              <div key={p.playerId} className="flex justify-between items-center py-0.5">
                                <span className={p.presenceStatus === 'confirmado' ? 'text-[#4ade80] font-bold' : p.presenceStatus === 'cancelado' ? 'text-zinc-600 line-through' : 'text-zinc-400'}>
                                  {idx + 1}. {p.name} (Reserva)
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9.5px] px-1 rounded font-bold ${
                                    p.presenceStatus === 'confirmado' ? 'text-emerald-400' : p.presenceStatus === 'cancelado' ? 'text-rose-500' : 'text-[#a78bfa]'
                                  }`}>
                                    {p.presenceStatus === 'confirmado' ? 'CONFIRMADO' : p.presenceStatus === 'cancelado' ? 'CANCELADO' : 'ESPERANDO'}
                                  </span>
                                  {isAdmin && (
                                    <div className="flex gap-1">
                                      {p.presenceStatus !== 'confirmado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'confirmado')}
                                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black border border-emerald-500/20 rounded p-1 transition cursor-pointer flex items-center justify-center"
                                          title="Aprovar participação"
                                        >
                                          <Check className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                      {p.presenceStatus !== 'cancelado' && (
                                        <button
                                          type="button"
                                          disabled={actionLoading}
                                          onClick={() => handleAdminTogglePresence(p.playerId, 'cancelado')}
                                          className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-black border border-rose-500/20 rounded p-1 transition cursor-pointer flex items-center justify-center"
                                          title="Remover / Cancelar"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Core Panel Menu / Stats Overview */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-5 flex flex-col justify-between space-y-4 shadow-lg">
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-900/40">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-extrabold text-white text-sm uppercase tracking-wide">
                  Atalhos de Acesso
                </h3>
              </div>

              <p className="text-xs text-zinc-400">
                Verifique avaliações, configure escalações ou aprove credenciais de novos jogadores aprovados pela comissão técnica do Racha do Fofim.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={onNavigateToPlayers}
                className="w-full text-left bg-zinc-950/80 hover:bg-emerald-950/10 border border-zinc-900 hover:border-emerald-500/20 p-3.5 rounded-lg flex items-center justify-between text-xs text-zinc-300 group transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-white group-hover:text-emerald-400">Elenco & Ficha dos Atletas</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                  <span>Visualizar</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {onNavigateToApprovals && (currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
                <button
                  onClick={onNavigateToApprovals}
                  className="w-full text-left bg-zinc-950/80 hover:bg-emerald-950/10 border border-zinc-900 hover:border-emerald-500/20 p-3.5 rounded-lg flex items-center justify-between text-xs text-zinc-300 group transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-white group-hover:text-amber-400">Solicitações de Cadastro</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingApprovalsCount > 0 && (
                      <span className="bg-amber-500 text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[9px] font-mono animate-pulse">
                        {pendingApprovalsCount} pendente
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-0.5">
                      <span>Analisar</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              )}

              {onNavigateToFinances && (
                <button
                  onClick={onNavigateToFinances}
                  className="w-full text-left bg-zinc-950/80 hover:bg-[#1a2d24] hover:text-[#4ade80] border border-zinc-900 hover:border-emerald-500/20 p-3.5 rounded-lg flex items-center justify-between text-xs text-zinc-300 group transition cursor-pointer font-sans"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow shadow-blue-500/50 animate-pulse" />
                    <span className="font-semibold text-white group-hover:text-emerald-400">Financeiro & Mensalidades</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                    <span>Acessar</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              )}
            </div>

            {/* Real-time Financial Overview widgets */}
            <div className="border-t border-zinc-900/40 pt-4 space-y-3 font-mono text-[11px]">
              {/* User personal pending sum badge indicator */}
              <div className="flex justify-between items-center bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
                <span className="text-zinc-500 text-[10px] uppercase font-bold">Minhas Pendências:</span>
                {(() => {
                  const myUserBills = finData?.bills || [];
                  const userPendingTotal = myUserBills
                    .filter((b: any) => b.status === 'pendente')
                    .reduce((sum: number, b: any) => sum + b.amount, 0);

                  if (userPendingTotal > 0) {
                    return (
                      <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase">
                        R$ {userPendingTotal.toFixed(2)} pendente
                      </span>
                    );
                  } else {
                    return (
                      <span className="text-[10px] font-black text-[#4ade80] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                        Nenhuma pendência 🎉
                      </span>
                    );
                  }
                })()}
              </div>

              {/* General Health statistics without showing debtor names */}
              <div className="space-y-1.5 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900/60">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold block">
                  Caixa do Grupo (Saúde Financeira)
                </span>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-center pt-1 text-zinc-400">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-zinc-500 uppercase block">Previsto</span>
                    <span className="text-white font-bold">R$ {Math.round(finData?.health?.totalExpected || 0)}</span>
                  </div>
                  <div className="space-y-0.5 border-x border-zinc-900">
                    <span className="text-[8px] text-emerald-500 uppercase block">Recebido</span>
                    <span className="text-emerald-400 font-bold">R$ {Math.round(finData?.health?.totalReceived || 0)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-amber-500 uppercase block">Aberto</span>
                    <span className="text-amber-400 font-bold">R$ {Math.round(finData?.health?.totalPending || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-zinc-950/20 border border-zinc-900 rounded-xl p-8 text-center space-y-4 shadow-xl">
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

      {/* SEÇÃO ANALÍTICA / RANKINGS DO RACHA */}
      <div className="border-t border-zinc-900 pt-6 space-y-4">
        <div>
          <h3 className="font-display font-black text-sm text-white uppercase tracking-tight flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <span>Mural Destaque da Temporada</span>
          </h3>
          <p className="text-zinc-500 text-xs mt-0.5">Os grandes destaques do racha, melhores afinidades e o último campeão atualizado do grupo.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* CARD 1 - ÚLTIMO CAMPEÃO */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between font-mono space-y-2">
            <div>
              <span className="text-[9px] text-[#22c55e] uppercase tracking-wider font-extrabold flex items-center gap-1">🏆 Último Campeão</span>
              <h4 className="text-white text-xs font-black mt-1 uppercase">
                {latestResult ? `Time ${latestResult.champions.join(' / ')}` : 'Nenhum resultado'}
              </h4>
            </div>
            {latestResult ? (
              <div className="text-[10px] text-zinc-400 space-y-1 bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
                <div>🔵 Azul: {latestResult.winsBlue} vitórias</div>
                <div>🔴 Vermelho: {latestResult.winsRed} vitórias</div>
                <div>🟢 Verde: {latestResult.winsGreen} vitórias</div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-650 italic">Aguardando placar de racha.</p>
            )}
          </div>

          {/* CARD 2 - MELHOR DUPLA */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between font-mono space-y-2">
            <div>
              <span className="text-[9px] text-sky-400 uppercase tracking-wider font-extrabold flex items-center gap-1">👥 Melhor Dupla</span>
              <h4 className="text-white text-xs font-bold mt-1 line-clamp-2">
                {stats && stats.duos && stats.duos.length > 0 
                  ? `${stats.duos[0].playerAName} + ${stats.duos[0].playerBName}` 
                  : 'Nenhuma registrada'}
              </h4>
            </div>
            {stats && stats.duos && stats.duos.length > 0 ? (
              <div className="text-[10px] text-zinc-400 space-y-0.5 bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
                <div>💪 <span className="font-extrabold text-white">{stats.duos[0].winsCount} vitórias</span> juntos</div>
                <div>📈 Aproveitamento: {Math.round(stats.duos[0].aproveitamento * 100)}%</div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-650 italic">Aguardando partidas juntas.</p>
            )}
          </div>

          {/* CARD 3 - MELHOR TRIO */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between font-mono space-y-2">
            <div>
              <span className="text-[9px] text-purple-400 uppercase tracking-wider font-extrabold flex items-center gap-1">🚀 Melhor Trio</span>
              <h4 className="text-white text-xs font-bold mt-1 line-clamp-2">
                {stats && stats.trios && stats.trios.length > 0 
                  ? `${stats.trios[0].playerAName}, ${stats.trios[0].playerBName} & ${stats.trios[0].playerCName}` 
                  : 'Nenhum registrado'}
              </h4>
            </div>
            {stats && stats.trios && stats.trios.length > 0 ? (
              <div className="text-[10px] text-zinc-400 space-y-0.5 bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
                <div>🔥 <span className="font-extrabold text-white">{stats.trios[0].winsCount} vitórias</span> juntos</div>
                <div>📈 Aproveitamento: {Math.round(stats.trios[0].aproveitamento * 100)}%</div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-650 italic">Aguardando dados de trios.</p>
            )}
          </div>

          {/* CARD 4 - RECORDISTA DE SEQUÊNCIA */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between font-mono space-y-2">
            <div>
              <span className="text-[9px] text-[#a855f7] uppercase tracking-wider font-extrabold flex items-center gap-1">👑 Lenda das Sequências</span>
              <h4 className="text-white text-xs font-bold mt-1 line-clamp-2">
                {streakRecordHolder && streakRecordHolder.maxStreak > 0 
                  ? streakRecordHolder.name 
                  : 'Nenhum registrado'}
              </h4>
            </div>
            {streakRecordHolder && streakRecordHolder.maxStreak > 0 ? (
              <div className="text-[10px] text-zinc-400 space-y-0.5 bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
                <div>🔥 Recorde: <span className="font-extrabold text-purple-400">{streakRecordHolder.maxStreak}V seguidas</span></div>
                <div>⚡ Atual: {streakRecordHolder.currentStreak}V seguidas</div>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-650 italic">Nenhum recordista registrado.</p>
            )}
          </div>

          {/* CARD 5 - TOP 5 JOGADORES */}
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between font-mono space-y-1.5">
            <span className="text-[9px] text-amber-400 uppercase tracking-wider font-extrabold">⭐ Top 5 Atletas (Vitórias)</span>
            <div className="space-y-1 bg-zinc-900/40 border border-zinc-900/60 p-2 rounded">
              {stats && stats.individual && stats.individual.length > 0 ? (
                stats.individual.slice(0, 5).map((p: any, idx: number) => (
                  <div key={p.playerId} className="flex justify-between items-center text-[9.5px] text-zinc-300">
                    <span className="truncate max-w-[85px]">{idx + 1}. {p.name}</span>
                    <span className="text-emerald-400 font-extrabold">{p.vitorias}V ({Math.round(p.aproveitamento * 100)}%)</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-zinc-650 italic">Sem estatísticas registradas.</p>
              )}
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
