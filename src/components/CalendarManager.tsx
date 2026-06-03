import React, { useState, useEffect } from 'react';
import { User, Season, Match, MatchStatus } from '../types';
import { 
  Calendar, Clock, MapPin, Plus, Trash2, Edit, Check, Play, RefreshCw,
  Sliders, AlertTriangle, ArrowUp, ArrowDown, ShieldAlert, CheckCircle2,
  ListOrdered, HelpCircle, Activity, Hourglass, CalendarRange
} from 'lucide-react';

interface CalendarManagerProps {
  currentUser: User;
}

export default function CalendarManager({ currentUser }: CalendarManagerProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'auxiliar';
  
  // Tabs: 'matches' | 'recurrence' | 'reserves'
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'recurrence' | 'reserves'>('matches');
  
  // Data states
  const [matches, setMatches] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [recurrentConfig, setRecurrentConfig] = useState<any>(null);
  const [reserves, setReserves] = useState<any[]>([]);
  const [reservesOrder, setReservesOrder] = useState<string[]>([]);
  
  // UI Loading/Status States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Results & Placar State
  const [results, setResults] = useState<any[]>([]);
  const [showResultFormId, setShowResultFormId] = useState<string | null>(null);
  const [winsBlue, setWinsBlue] = useState('0');
  const [winsRed, setWinsRed] = useState('0');
  const [winsGreen, setWinsGreen] = useState('0');

  // Form states: New Season
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonYear, setNewSeasonYear] = useState('2026');
  const [newSeasonStart, setNewSeasonStart] = useState('2026-01-01');
  const [newSeasonEnd, setNewSeasonEnd] = useState('2026-12-31');
  const [newSeasonActive, setNewSeasonActive] = useState(true);

  // Form states: New Match
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [newMatchDate, setNewMatchDate] = useState('');
  const [newMatchTime, setNewMatchTime] = useState('20:00');
  const [newMatchLocation, setNewMatchLocation] = useState('Arena Green Society (Quadra Principal)');
  const [newMatchDuration, setNewMatchDuration] = useState('120');

  // Form states: Recurrence Config
  const [recurDay, setRecurDay] = useState('6'); // Default to Saturday
  const [recurTime, setRecurTime] = useState('20:00');
  const [recurLocation, setRecurLocation] = useState('Arena Green Society (Quadra Principal)');
  const [recurDuration, setRecurDuration] = useState('120');
  const [recurDeadline, setRecurDeadline] = useState('2');
  const [recurActive, setRecurActive] = useState(true);

  // Data Fetching
  const fetchAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Matches
      const matchRes = await fetch('/api/matches');
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        setMatches(matchData || []);
      }

      // 2. Seasons
      const seasonRes = await fetch('/api/seasons');
      if (seasonRes.ok) {
        const seasonData = await seasonRes.json();
        setSeasons(seasonData || []);
      }

      // 3. Recurrence Setup
      const recurRes = await fetch('/api/recurrent-config');
      if (recurRes.ok) {
        const recurData = await recurRes.json();
        setRecurrentConfig(recurData);
        if (recurData) {
          setRecurDay(recurData.dayOfWeek.toString());
          setRecurTime(recurData.time);
          setRecurLocation(recurData.location);
          setRecurDuration(recurData.durationMinutes.toString());
          setRecurDeadline(recurData.confirmationDeadlineDaysBefore.toString());
          setRecurActive(recurData.active);
        }
      }

      // 4. Reserve ordering queue
      const reserveRes = await fetch('/api/reserves/order');
      if (reserveRes.ok) {
        const reserveData = await reserveRes.json();
        setReserves(reserveData.reserves || []);
        setReservesOrder(reserveData.order || []);
      }

      // 5. Match Results
      const resultsRes = await fetch('/api/results');
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults(resultsData || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Não foi possível sincronizar as informações do calendário.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const triggerFeedback = (success: string, error: string = '') => {
    setSuccessMsg(success);
    setErrorMsg(error);
    setTimeout(() => {
      setSuccessMsg('');
    }, 5000);
  };

  // CREATE SEASON
  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSeasonName || !newSeasonYear || !newSeasonStart || !newSeasonEnd) {
      setErrorMsg('Todos os campos da temporada são de preenchimento obrigatório.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSeasonName,
          year: newSeasonYear,
          startDate: newSeasonStart,
          endDate: newSeasonEnd,
          active: newSeasonActive
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao registrar temporada.');
      }

      setNewSeasonName('');
      triggerFeedback('Nova temporada esportiva inserida com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar temporada.');
    } finally {
      setActionLoading(false);
    }
  };

  // ACTIVATE / TOGGLE SEASON
  const handleToggleSeason = async (seasonId: string, status: boolean) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/seasons/${seasonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: status })
      });
      if (!response.ok) throw new Error('Erro ao alternar ativação da temporada.');

      triggerFeedback(status ? 'Temporada ativada e definida como padrão.' : 'Temporada desativada.');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de rede.');
    } finally {
      setActionLoading(false);
    }
  };

  // SCHEDULE MANUAL MATCH
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatchDate || !newMatchTime) {
      setErrorMsg('Data e horário são obrigatórios para agendar partidas.');
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newMatchDate,
          time: newMatchTime,
          location: newMatchLocation,
          durationMinutes: newMatchDuration
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Não foi possível agendar o racha.');
      }

      setNewMatchDate('');
      setShowMatchForm(false);
      triggerFeedback('Rodada inserida de forma expressa no calendário com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao agendar partida.');
    } finally {
      setActionLoading(false);
    }
  };

  // UPDATE MATCH STATUS ('agendada' | 'confirmando' | 'encerrada' | 'cancelada')
  const handleUpdateMatchStatus = async (matchId: string, nextStatus: MatchStatus) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) {
        const bodyErr = await response.json();
        throw new Error(bodyErr.error || 'Erro ao alterar status da rodada.');
      }

      let extraMsg = '';
      if (nextStatus === 'cancelada') {
        extraMsg = ' Partida cancelada. Conforme regras, a recorrência automática foi pausada até confirmação manual.';
      } else if (nextStatus === 'agendada' || nextStatus === 'confirmando') {
        extraMsg = ' Partida reativada. A recorrência normal voltou ao fluxo ativo.';
      }

      triggerFeedback(`Status do racha editado para "${nextStatus.toUpperCase()}" com sucesso!${extraMsg}`);
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível salvar a alteração.');
    } finally {
      setActionLoading(false);
    }
  };

  // SAVE MATCH RESULTS & CONSOLIDATE STATS
  const handleSaveMatchResult = async (matchId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`/api/matches/${matchId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winsBlue: parseInt(winsBlue) || 0,
          winsRed: parseInt(winsRed) || 0,
          winsGreen: parseInt(winsGreen) || 0
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar os resultados.');
      }
      setShowResultFormId(null);
      triggerFeedback('Resultado do racha e estatísticas de jogo gravados com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao registrar placar.');
    } finally {
      setActionLoading(false);
    }
  };

  // EXPORT TO WHATSAPP DIALECT
  const handleShareResult = async (item: any, matchResult: any) => {
    try {
      setActionLoading(true);
      const statsRes = await fetch(`/api/stats?seasonId=${item.seasonId}`);
      if (!statsRes.ok) throw new Error();
      const stats = await statsRes.json();
      
      const top5 = (stats.individual || []).slice(0, 5).map((p: any, idx: number) => `*${idx + 1}.* ${p.name} (${p.vitorias} vitórias)`).join('\n');
      const bestDuoObj = (stats.duos || [])[0];
      const bestDuoStr = bestDuoObj ? `${bestDuoObj.playerAName} + ${bestDuoObj.playerBName}` : 'Nenhuma cadastrada';
      
      const text = `🏆 *Resultado do Racha* (${item.date.split('-').reverse().join('/')})

*Campeão:*
Time ${matchResult.champions.join(', ')}

*Vitórias:*
🔵 Azul: ${matchResult.winsBlue} vitórias
🔴 Vermelho: ${matchResult.winsRed} vitórias
🟢 Verde: ${matchResult.winsGreen} vitórias

🔥 *Top 5 Vitórias*
${top5}

👥 *Melhor Dupla:*
${bestDuoStr}

*Racha do Fofim* - Acesse para ver as estatísticas completas! ⚽`;

      const encoded = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    } catch (err) {
      const text = `🏆 *Resultado do Racha* (${item.date.split('-').reverse().join('/')})

*Campeão:*
Time ${matchResult.champions.join(', ')}

🔵 Azul: ${matchResult.winsBlue} vitórias | 🔴 Vermelho: ${matchResult.winsRed} vitórias | 🟢 Verde: ${matchResult.winsGreen} vitórias.

Acesse o sistema *Racha do Fofim* para verificar estatísticas atualizadas! ⚽`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    } finally {
      setActionLoading(false);
    }
  };

  // REMOVE MATCH
  const handleDeleteMatch = async (matchId: string) => {
    if (!window.confirm('Atenção: deseja remover definitivamente este racha do calendário? Isto também excluirá as presenças vinculadas.')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir rodada.');

      triggerFeedback('Partida removida do calendário.');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir partida.');
    } finally {
      setActionLoading(false);
    }
  };

  // SAVE RECURRENCE SETUP
  const handleSaveRecurrenceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch('/api/recurrent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: recurDay,
          time: recurTime,
          location: recurLocation,
          durationMinutes: recurDuration,
          confirmationDeadlineDaysBefore: recurDeadline,
          active: recurActive
        })
      });
      if (!response.ok) throw new Error('Falha ao processar configuração de recorrência.');

      triggerFeedback('Automação de rodadas e regras de recorrência salvas!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na rede.');
    } finally {
      setActionLoading(false);
    }
  };

  // TRIGGER RECURRENCE AUTO GENERATION
  const handleForceRecurrentGeneration = async () => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch('/api/matches/generate-recurrent', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao preencher calendário recorrente.');
      }

      triggerFeedback(data.message || 'Próximos rachas gerados com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar o mapeador de ocorrências.');
    } finally {
      setActionLoading(false);
    }
  };

  // REORDER RESERVES priority queue
  const handleMoveReserve = async (index: number, direction: 'up' | 'down') => {
    setActionLoading(true);
    setErrorMsg('');
    const listCopy = [...reserves];
    const newIdx = direction === 'up' ? index - 1 : index + 1;

    if (newIdx < 0 || newIdx >= listCopy.length) {
      setActionLoading(false);
      return;
    }

    // Swap items
    const tempObj = listCopy[index];
    listCopy[index] = listCopy[newIdx];
    listCopy[newIdx] = tempObj;

    setReserves(listCopy);

    const orderedIds = listCopy.map((r) => r.id);

    try {
      const response = await fetch('/api/reserves/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorderedIds: orderedIds })
      });
      if (!response.ok) throw new Error('Não foi possível persistir a nova ordem de prioridade dos reservas.');
      
      triggerFeedback('Lista de prioridade de reservas reorganizada e persistida!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao reordenar reservas.');
      fetchAllData(); // Revert state from server
    } finally {
      setActionLoading(false);
    }
  };

  const getDayName = (dayNum: number) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayNum] || 'Sábado';
  };

  const getMatchStatusBadge = (status: string) => {
    switch (status) {
      case 'agendada':
        return <span className="bg-zinc-800 border border-zinc-750 text-zinc-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">Agendada</span>;
      case 'confirmando':
        return <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase animate-pulse">Confirmando Presenças</span>;
      case 'encerrada':
        return <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">Encerrada</span>;
      case 'cancelada':
        return <span className="bg-rose-500/15 border border-rose-500/35 text-rose-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">Cancelada</span>;
      default:
        return <span className="bg-zinc-800 text-zinc-400 text-[9px] px-2 py-0.5 rounded">{status}</span>;
    }
  };

  const activeSeason = seasons.find((s) => s.active);

  return (
    <div className="space-y-6" id="calendar-manager-panel">
      
      {/* Sub Tabs menu */}
      <div className="flex border-b border-zinc-900 pb-px gap-1">
        <button
          onClick={() => setActiveSubTab('matches')}
          className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition ${
            activeSubTab === 'matches'
              ? 'border-b-2 border-emerald-400 text-white'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          📅 Agenda de Rachas
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('recurrence')}
            className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition ${
              activeSubTab === 'recurrence'
                ? 'border-b-2 border-emerald-400 text-white'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            ⚙️ Recorrência & Temporadas
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('reserves')}
          className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition ${
            activeSubTab === 'reserves'
              ? 'border-b-2 border-emerald-400 text-white'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          📋 Fila de Reservas
        </button>
      </div>

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- ABA 1: AGENDA DE RACHAS (MATCHES LISTINGS) --- */}
      {activeSubTab === 'matches' && (
        <div className="space-y-4">
          
          <div className="flex justify-between items-center bg-zinc-950/20 p-3 rounded-lg border border-zinc-900">
            <div>
              <h3 className="text-sm font-bold text-white font-display uppercase">Grade de Rodadas</h3>
              <p className="text-[10px] text-zinc-500 font-mono leading-none mt-1">
                Temporada Escopo: <span className="text-emerald-400 font-black">{activeSeason ? activeSeason.name : 'Nenhuma Ativa'}</span>
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowMatchForm(!showMatchForm)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agendar Racha</span>
              </button>
            )}
          </div>

          {/* MANUALLY SCHEDULE FORM */}
          {showMatchForm && isAdmin && (
            <form onSubmit={handleCreateMatch} className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 space-y-4 animate-slideDown">
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-xs font-bold text-white uppercase font-mono">Agendamento Manual</span>
                <button type="button" onClick={() => setShowMatchForm(false)} className="text-zinc-500 hover:text-white font-mono text-[10px]">Fechar [X]</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Data da Partida (Dia do Racha)</label>
                  <input
                    type="date"
                    required
                    value={newMatchDate}
                    onChange={(e) => setNewMatchDate(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Horário de Início</label>
                  <input
                    type="text"
                    required
                    placeholder="20:00"
                    value={newMatchTime}
                    onChange={(e) => setNewMatchTime(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Local / Quadra</label>
                  <input
                    type="text"
                    required
                    value={newMatchLocation}
                    onChange={(e) => setNewMatchLocation(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Duração (Minutos)</label>
                  <input
                    type="number"
                    value={newMatchDuration}
                    onChange={(e) => setNewMatchDuration(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition"
              >
                Efetivar Agendamento
              </button>
            </form>
          )}

          {/* LIST MATCHES */}
          {loading ? (
            <div className="text-center py-10 text-xs font-mono text-zinc-500">Buscando rodadas cadastradas...</div>
          ) : matches.length === 0 ? (
            <div className="text-center py-12 bg-zinc-950/20 border border-zinc-900 rounded-xl space-y-3">
              <p className="text-xs font-mono text-zinc-500">Não há partidas configuradas para a temporada ativa.</p>
              {isAdmin && (
                <div className="pt-2">
                  <button
                    onClick={() => setActiveSubTab('recurrence')}
                    className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Ir Configurar Recorrência
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((item: any) => {
                const matchResult = results.find(r => r.matchId === item.id);
                
                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-xl border ${
                      item.status === 'confirmando' 
                        ? 'border-amber-500/20 bg-amber-500/5' 
                        : item.status === 'cancelada'
                          ? 'border-zinc-900 bg-zinc-950/10 opacity-60'
                          : item.status === 'encerrada'
                            ? 'border-emerald-500/10 bg-emerald-500/5'
                            : 'border-zinc-900 bg-zinc-950/30'
                    } transition flex flex-col space-y-4`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-sans text-white font-extrabold flex items-center gap-1 font-mono">
                            📅 {item.date.split('-').reverse().join('/')}
                          </span>
                          {getMatchStatusBadge(item.status)}
                        </div>

                        <div className="space-y-1 text-[11px] text-zinc-400 font-mono">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Horário: {item.time} ({item.durationMinutes} min)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="truncate max-w-sm">{item.location}</span>
                          </div>
                        </div>

                        <div className="flex gap-4 text-[10px] pt-1 font-mono text-zinc-500 uppercase">
                          <div>⚽ Confirmados: <span className="text-emerald-400 font-extrabold">{item.confirmedCount}</span></div>
                          <div>👥 Vagas Restantes: <span className="text-zinc-300 font-extrabold">{item.vacancies}</span></div>
                        </div>
                      </div>

                      {/* ACTIONS BAR */}
                      <div className="flex flex-wrap gap-1.5 self-end sm:self-auto items-center">
                        {/* Results / Share Buttons for Finished Matches */}
                        {item.status === 'encerrada' && matchResult && (
                          <button
                            onClick={() => handleShareResult(item, matchResult)}
                            title="Compartilhar resultado no WhatsApp"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase flex items-center gap-1 cursor-pointer transition"
                          >
                            💚 WhatsApp
                          </button>
                        )}

                        {isAdmin && item.status !== 'encerrada' && item.status !== 'cancelada' && (
                          <button
                            onClick={() => {
                              setShowResultFormId(showResultFormId === item.id ? null : item.id);
                              setWinsBlue('0');
                              setWinsRed('0');
                              setWinsGreen('0');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                            title="Registrar Vitórias das Equipes e Encerrar Racha"
                          >
                            {showResultFormId === item.id ? 'Fechar Placar' : 'Gravar Placar / Encerrar'}
                          </button>
                        )}

                        {isAdmin && item.status !== 'confirmando' && item.status !== 'encerrada' && item.status !== 'cancelada' && (
                          <button
                            onClick={() => handleUpdateMatchStatus(item.id, 'confirmando')}
                            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                            title="Abrir confirmação de presenças"
                          >
                            Confirmar Presenças
                          </button>
                        )}

                        {isAdmin && item.status !== 'cancelada' && (
                          <button
                            onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                            className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2 py-1.5 rounded uppercase cursor-pointer"
                            title="Cancelar rodada"
                          >
                            Cancelar
                          </button>
                        )}

                        {isAdmin && item.status === 'cancelada' && (
                          <button
                            onClick={() => handleUpdateMatchStatus(item.id, 'agendada')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono font-bold text-[9px] px-2 py-1.5 rounded uppercase cursor-pointer"
                            title="Reativar rodada"
                          >
                            Reabrir
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteMatch(item.id)}
                            className="bg-zinc-950 border border-zinc-900 text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition"
                            title="Deletar partida definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SHOW RESULTS RIBBON IF ENDED */}
                    {item.status === 'encerrada' && matchResult && (
                      <div className="bg-zinc-900/40 border border-emerald-500/15 rounded-lg p-3 font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1">
                        <div className="flex items-center gap-2 font-display text-xs text-white uppercase font-black tracking-tight border-b border-zinc-800 pb-1.5">
                          <span>🏆 Resultados do Racha</span>
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[9.5px]">
                            Campeão: Time {matchResult.champions.join(' + ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center pt-1.5">
                          <div className="bg-blue-600/10 border border-blue-500/20 rounded py-1">
                            <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">🔵 Azul</span>
                            <span className="text-white text-xs font-extrabold">{matchResult.winsBlue} vitórias</span>
                          </div>
                          <div className="bg-rose-600/10 border border-rose-500/20 rounded py-1">
                            <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">🔴 Vermelho</span>
                            <span className="text-white text-xs font-extrabold">{matchResult.winsRed} vitórias</span>
                          </div>
                          <div className="bg-emerald-600/10 border border-emerald-500/20 rounded py-1">
                            <span className="text-[10px] text-zinc-400 uppercase block mb-0.5">🟢 Verde</span>
                            <span className="text-white text-xs font-extrabold">{matchResult.winsGreen} vitórias</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RECORD INLINE SCORES FORM */}
                    {showResultFormId === item.id && (
                      <div className="p-4 bg-zinc-950/80 border border-emerald-500/30 rounded-xl space-y-3 font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                          <span className="font-bold text-white uppercase text-[10px] text-emerald-400">🏆 Registrar Placar do Racha</span>
                          <button 
                            type="button" 
                            onClick={() => setShowResultFormId(null)}
                            className="text-zinc-500 hover:text-white"
                          >
                            Fechar [X]
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-2.5 text-center">
                            <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Time Azul</label>
                            <input 
                              type="number"
                              min="0"
                              value={winsBlue}
                              onChange={(e) => setWinsBlue(e.target.value)}
                              className="w-full bg-[#1c1c1e] text-center text-white border border-zinc-800 rounded py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5 text-center">
                            <label className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Time Vermelho</label>
                            <input 
                              type="number"
                              min="0"
                              value={winsRed}
                              onChange={(e) => setWinsRed(e.target.value)}
                              className="w-full bg-[#1c1c1e] text-center text-white border border-zinc-800 rounded py-1.5 text-xs font-bold focus:outline-none focus:border-rose-500"
                            />
                          </div>

                          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 text-center">
                            <label className="block text-[9px] font-bold text-emerald-400 uppercase mb-1">Time Verde</label>
                            <input 
                              type="number"
                              min="0"
                              value={winsGreen}
                              onChange={(e) => setWinsGreen(e.target.value)}
                              className="w-full bg-[#1c1c1e] text-center text-white border border-zinc-800 rounded py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveMatchResult(item.id)}
                          disabled={actionLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase py-2.5 rounded-lg cursor-pointer transition shadow"
                        >
                          Salvar e Encerrar a Rodada
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* --- ABA 2: RECORRÊNCIA E TEMPORADAS (ADMIN PANEL) --- */}
      {activeSubTab === 'recurrence' && isAdmin && (
        <div className="space-y-6">
          
          {/* Active Season Info */}
          <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/10 inline-block">Temporada Corrente</span>
              <h4 className="text-base text-white font-display font-extrabold uppercase">
                {activeSeason ? activeSeason.name : 'Nenhuma Ativada'}
              </h4>
              <p className="text-xs text-zinc-400 leading-normal font-mono">
                📅 Período: {activeSeason ? `${activeSeason.startDate.split('-').reverse().join('/')} até ${activeSeason.endDate.split('-').reverse().join('/')}` : 'Inativo'}
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={handleForceRecurrentGeneration}
                disabled={actionLoading}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 font-mono font-bold text-xs uppercase tracking-wider text-white px-5 py-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer shadow shadow-emerald-500/10"
              >
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
                <span>Gerar Calendário de Rachas</span>
              </button>
            </div>

            <div className="md:col-span-2 text-[10px] text-zinc-500 font-mono leading-normal bg-zinc-950 rounded-lg p-3 border border-zinc-900">
              💡 <span className="font-bold text-zinc-400">Instruções de Geração:</span> A geração automática de calendário calcula todos os dias da semana correspondentes à configuração de recorrência do Racha, de hoje até o final da data fim da temporada ativa ({activeSeason ? activeSeason.endDate.split('-').reverse().join('/') : 'sem limite definido'}), pulando dias que já tenham rachas cadastrados e interrompendo em cancelamentos.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Configure Recurrent matches Rules */}
            <form onSubmit={handleSaveRecurrenceConfig} className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase font-mono">Automação de Recorrência</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Dia da Semana Fixo</label>
                  <select
                    value={recurDay}
                    onChange={(e) => setRecurDay(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="0">Domingo</option>
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Horário Fixo da Partida</label>
                  <input
                    type="text"
                    required
                    value={recurTime}
                    onChange={(e) => setRecurTime(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Localização / Quadra</label>
                  <input
                    type="text"
                    required
                    value={recurLocation}
                    onChange={(e) => setRecurLocation(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase">Prazo de Confirmação (Dias antes)</label>
                    <input
                      type="number"
                      required
                      value={recurDeadline}
                      onChange={(e) => setRecurDeadline(e.target.value)}
                      className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase">Duração (Minutos)</label>
                    <input
                      type="number"
                      required
                      value={recurDuration}
                      onChange={(e) => setRecurDuration(e.target.value)}
                      className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                  <span className="text-[11px] font-mono text-zinc-400">Recorrência Habilitada:</span>
                  <input
                    type="checkbox"
                    checked={recurActive}
                    onChange={(e) => setRecurActive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition"
                >
                  Salvar Regras de Automação
                </button>
              </div>
            </form>

            {/* Manage Seasons List & Registration */}
            <div className="space-y-4">
              
              <form onSubmit={handleCreateSeason} className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                  <CalendarRange className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase font-mono">Abrir Nova Temporada</span>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase">Nome Identificador</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Temporada de Prata 2026"
                      value={newSeasonName}
                      onChange={(e) => setNewSeasonName(e.target.value)}
                      className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1 col-span-1">
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase">Ano</label>
                      <input
                        type="number"
                        required
                        value={newSeasonYear}
                        onChange={(e) => setNewSeasonYear(e.target.value)}
                        className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1 col-span-2">
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase">Início</label>
                      <input
                        type="date"
                        required
                        value={newSeasonStart}
                        onChange={(e) => setNewSeasonStart(e.target.value)}
                        className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-2 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase">Encerramento (Previsão)</label>
                    <input
                      type="date"
                      required
                      value={newSeasonEnd}
                      onChange={(e) => setNewSeasonEnd(e.target.value)}
                      className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                    <span className="text-[11px] font-mono text-zinc-400">Tornar Temporada Ativa:</span>
                    <input
                      type="checkbox"
                      checked={newSeasonActive}
                      onChange={(e) => setNewSeasonActive(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition"
                  >
                    Registrar Temporada
                  </button>
                </div>
              </form>

              {/* Seasons Listing Table */}
              <div className="space-y-2.5 bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl font-mono text-xs">
                <span className="block font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-900">Histórico de Temporadas</span>
                <div className="divide-y divide-zinc-900">
                  {seasons.map((s) => (
                    <div key={s.id} className="flex justify-between items-center py-2">
                      <div>
                        <span className="font-bold text-white block">{s.name} ({s.year})</span>
                        <span className="text-[10px] text-zinc-500">{s.startDate.split('-').reverse().join('/')} - {s.endDate.split('-').reverse().join('/')}</span>
                      </div>
                      
                      <button
                        onClick={() => handleToggleSeason(s.id, !s.active)}
                        className={`text-[10px] px-2.5 py-1.5 rounded uppercase font-bold cursor-pointer border ${
                          s.active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                        }`}
                      >
                        {s.active ? 'Ativa' : 'Ativar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* --- ABA 3: PRIORITY RESERVE LIST QUEUE --- */}
      {activeSubTab === 'reserves' && (
        <div className="space-y-4">
          
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 space-y-2 mb-4">
            <div className="flex items-center gap-2 text-white font-display font-black text-sm uppercase">
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              <span>Fila de Espera / Reservas do Racha</span>
            </div>
            
            <p className="text-xs text-zinc-400 leading-normal">
              O Racha do Fofim estabelece prioridades claras: os mensalistas possuem vaga garantida. Os reservas ocupam vagas extras ou cobrem faltas. No cancelamento pós-confirmação, o sistema sugere primeiro o reserva no topo desta fila!
            </p>

            {isAdmin && (
              <div className="text-[10px] text-zinc-500 font-mono italic">
                👉 Modo Admin: Use as setas para arrastar jogadores para cima ou para baixo, reorganizando a prioridade.
              </div>
            )}
          </div>

          {reserves.length === 0 ? (
            <div className="text-center py-12 bg-zinc-950/20 border border-zinc-900 rounded-xl text-zinc-500 font-mono text-xs">
              Não há atletas cadastrados com a categoria "Reserva" no elenco no momento.
            </div>
          ) : (
            <div className="space-y-2.5">
              {reserves.map((player: any, index: number) => (
                <div 
                  key={player.id} 
                  className="bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-900 flex items-center justify-between font-mono text-xs transition hover:border-[#10b981]/15"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-emerald-400 font-mono bg-[#10b981]/10 w-7 h-7 rounded-full flex items-center justify-center border border-[#10b981]/25">
                      {index + 1}
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white block">{player.name}</span>
                      <span className="text-[10px] text-zinc-500 block">Posição: {player.primaryPosition.toUpperCase()} ⚽</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={index === 0 || actionLoading}
                        onClick={() => handleMoveReserve(index, 'up')}
                        className={`p-2 rounded-lg border ${
                          index === 0 
                            ? 'border-zinc-900 text-zinc-700 bg-transparent' 
                            : 'border-zinc-800 text-emerald-400 bg-zinc-950 hover:bg-zinc-900'
                        } cursor-pointer transition`}
                        title="Subir na prioridade"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        disabled={index === reserves.length - 1 || actionLoading}
                        onClick={() => handleMoveReserve(index, 'down')}
                        className={`p-2 rounded-lg border ${
                          index === reserves.length - 1 
                            ? 'border-zinc-900 text-zinc-700 bg-transparent' 
                            : 'border-zinc-800 text-emerald-400 bg-zinc-950 hover:bg-zinc-900'
                        } cursor-pointer transition`}
                        title="Baixar na prioridade"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
