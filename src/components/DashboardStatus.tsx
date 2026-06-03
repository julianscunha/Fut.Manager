import React, { useState, useEffect } from 'react';
import { User, PresenceStatus } from '../types';
import { 
  Calendar, MapPin, Clock, Trophy, AlertCircle, ArrowUpRight, Check, 
  Users, Users2, Shield, Sparkles, X, ChevronDown, ChevronUp, BellRing,
  CheckCircle2, AlertTriangle, ArrowDownAZ, VolumeX
} from 'lucide-react';

interface DashboardStatusProps {
  currentUser: User;
  onNavigateToPlayers: () => void;
  onNavigateToApprovals?: () => void;
  pendingApprovalsCount: number;
}

export default function DashboardStatus({
  currentUser,
  onNavigateToPlayers,
  onNavigateToApprovals,
  pendingApprovalsCount
}: DashboardStatusProps) {
  const [nextMatch, setNextMatch] = useState<any>(null);
  const [presences, setPresences] = useState<any[]>([]);
  const [reserveAlerts, setReserveAlerts] = useState<any[]>([]);
  const [myPresence, setMyPresence] = useState<string>('nao_confirmado');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPresenceListDetail, setShowPresenceListDetail] = useState(false);

  // Analytical Racha States
  const [stats, setStats] = useState<any>(null);
  const [latestResult, setLatestResult] = useState<any>(null);

  // Load next match, presences, and alerts
  const loadDashboardData = async () => {
    try {
      setErrorMsg('');
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
                                <span className={`text-[9px] px-1 rounded font-bold ${
                                  p.presenceStatus === 'confirmado' ? 'text-emerald-400' : p.presenceStatus === 'cancelado' ? 'text-rose-500' : 'text-zinc-500'
                                }`}>
                                  {p.presenceStatus === 'confirmado' ? 'CONFIRMADO' : p.presenceStatus === 'cancelado' ? 'CANCELADO' : 'PENDENTE'}
                                </span>
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
                                <span className={`text-[9px] px-1 rounded font-bold ${
                                  p.presenceStatus === 'confirmado' ? 'text-emerald-400' : p.presenceStatus === 'cancelado' ? 'text-rose-500' : 'text-[#a78bfa]'
                                }`}>
                                  {p.presenceStatus === 'confirmado' ? 'CONFIRMADO' : p.presenceStatus === 'cancelado' ? 'CANCELADO' : 'ESPERANDO'}
                                </span>
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
            </div>

            <div className="text-[10px] text-zinc-500 border-t border-zinc-900/40 pt-4 leading-relaxed font-mono">
              📢 Sorteio de times, financeiro da mensalidade e galeria de fotos integradas serão disponibilizados nas futuras atualizações planejadas.
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

    </div>
  );
}
