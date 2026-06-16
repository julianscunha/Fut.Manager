import React, { useState, useEffect } from 'react';
import { User, Season, Match, MatchStatus } from '../types';
import { 
  Calendar, Clock, MapPin, Plus, Trash2, Edit, Check, Play, RefreshCw,
  Sliders, AlertTriangle, ArrowUp, ArrowDown, ShieldAlert, CheckCircle2,
  ListOrdered, HelpCircle, Activity, Hourglass, CalendarRange, X
} from 'lucide-react';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';

interface CalendarManagerProps {
  currentUser: User;
}

export default function CalendarManager({ currentUser }: CalendarManagerProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'auxiliar';

  const todayVal = new Date();
  const todayStr = `${todayVal.getFullYear()}-${String(todayVal.getMonth() + 1).padStart(2, '0')}-${String(todayVal.getDate()).padStart(2, '0')}`;
  
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

  // Bulk Delete States
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Results & Placar State
  const [results, setResults] = useState<any[]>([]);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<string | null>(null);
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
  const [newMatchDeadline, setNewMatchDeadline] = useState('2');

  // Form states: Recurrence Config
  const [recurDay, setRecurDay] = useState('6'); // Default to Saturday
  const [recurTime, setRecurTime] = useState('20:00');
  const [recurLocation, setRecurLocation] = useState('Arena Green Society (Quadra Principal)');
  const [recurDuration, setRecurDuration] = useState('120');
  const [recurDeadline, setRecurDeadline] = useState('2');
  const [recurActive, setRecurActive] = useState(true);
  const [recurMonthlyFee, setRecurMonthlyFee] = useState('100');
  const [recurChargeDateRule, setRecurChargeDateRule] = useState('primeiro_jogo');
  const [recurMaxMensalistas, setRecurMaxMensalistas] = useState('12');
  const [recurMaxPlayers, setRecurMaxPlayers] = useState('15');
  const [newMatchMaxPlayers, setNewMatchMaxPlayers] = useState('15');
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);

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
          setNewMatchDeadline(recurData.confirmationDeadlineDaysBefore.toString());
          setRecurActive(recurData.active);
          setRecurMonthlyFee((recurData.monthlyFee ?? 100).toString());
          setRecurChargeDateRule(recurData.chargeDateRule ?? 'primeiro_jogo');
          setRecurMaxMensalistas((recurData.maxMensalistas ?? 12).toString());
          setRecurMaxPlayers((recurData.maxPlayers ?? 15).toString());
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

  useEffect(() => {
    const handleHighlightMatch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const matchId = customEvent.detail;
      if (matchId) {
        setHighlightedMatchId(matchId);
        setTimeout(() => {
          const el = document.getElementById(`match-card-${matchId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    };
    window.addEventListener('highlight-match', handleHighlightMatch);
    return () => {
      window.removeEventListener('highlight-match', handleHighlightMatch);
    };
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

    if (newMatchDate < todayStr) {
      setErrorMsg('Não é permitido agendar uma rodada com data anterior ao dia atual.');
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
          durationMinutes: newMatchDuration,
          confirmationDeadlineDaysBefore: newMatchDeadline ? parseInt(newMatchDeadline) : 2,
          maxPlayers: parseInt(newMatchMaxPlayers || '15')
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

  const [cancelMatchId, setCancelMatchId] = useState<string | null>(null);
  const [clearPresencesOnCancel, setClearPresencesOnCancel] = useState<boolean>(true);

  // UPDATE MATCH STATUS ('agendada' | 'confirmando' | 'encerrada' | 'cancelada')
  const handleUpdateMatchStatus = async (
    matchId: string, 
    nextStatus: MatchStatus, 
    options?: { clearPresences?: boolean }
  ) => {
    if (nextStatus === 'cancelada' && !options) {
      setCancelMatchId(matchId);
      setClearPresencesOnCancel(true);
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: nextStatus,
          clearPresences: options?.clearPresences,
          responsibleId: currentUser.id,
          responsibleName: currentUser.name,
          responsibleEmail: currentUser.email
        })
      });
      if (!response.ok) {
        const bodyErr = await response.json();
        throw new Error(bodyErr.error || 'Erro ao alterar status da rodada.');
      }

      let extraMsg = '';
      if (nextStatus === 'cancelada') {
        extraMsg = ' Partida cancelada. ' + (options?.clearPresences ? 'Confirmações e convocações limpas!' : '') + ' Conforme regras, a recorrência automática foi pausada até confirmação manual.';
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
      
      const text = `\uD83C\uDFC6 *Resultado do Racha* (${item.date.split('-').reverse().join('/')})

*Campeão:*
Time ${matchResult.champions.join(', ')}

*Vitórias:*
\uD83D\uDD35 Azul: ${matchResult.winsBlue} vitórias
\uD83D\uDD34 Vermelho: ${matchResult.winsRed} vitórias
\uD83D\uDFE2 Verde: ${matchResult.winsGreen} vitórias

\uD83D\uDD25 *Top 5 Vitórias*
${top5}

\uD83D\uDC65 *Melhor Dupla:*
${bestDuoStr}

*Racha do Fofim* - Acesse para ver as estatísticas completas! \u26BD`;

      const encoded = encodeURIComponent(text);
      console.log("RAW MESSAGE:", text);
      console.log("ENCODED:", encoded);
      console.log("WHATSAPP URL:", `https://wa.me/?text=${encoded}`);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } catch (err) {
      const text = `\uD83C\uDFC6 *Resultado do Racha* (${item.date.split('-').reverse().join('/')})

*Campeão:*
Time ${matchResult.champions.join(', ')}

\uD83D\uDD35 Azul: ${matchResult.winsBlue} vitórias | \uD83D\uDD34 Vermelho: ${matchResult.winsRed} vitórias | \uD83D\uDFE2 Verde: ${matchResult.winsGreen} vitórias.

Acesse o sistema *Racha do Fofim* para verificar estatísticas atualizadas! \u26BD`;

      const encoded = encodeURIComponent(text);
      console.log("RAW MESSAGE (FALLBACK):", text);
      console.log("ENCODED (FALLBACK):", encoded);
      console.log("WHATSAPP URL (FALLBACK):", `https://wa.me/?text=${encoded}`);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareMatchOnWhatsApp = (match: any) => {
    const formattedDate = match.date.split('-').reverse().join('/');
    const textMsg = `\u26BD *RACHA DO FOFIM - CONVOCADOS PARA O DIA ${formattedDate}!* \u26BD\n` +
      `\uD83D\uDCC5 *Data:* ${formattedDate} às ${match.time}\n` +
      `\uD83D\uDCCD *Local:* ${match.location}\n\n` +
      `\uD83D\uDC65 *Confirmados (${match.confirmedCount}/15):*\n\n` +
      `\u26A0\uFE0F *Vagas em aberto:* ${match.vacancies} vagas disponíveis!\n\n` +
      `Por favor, atualizem seus status de presença no app oficial:\n` +
      `\uD83D\uDC49 Acesse e confirme: https://racha-do-fofim.com\n\n` +
      `Abraços e bom racha!`;
      
    const escapedMsg = encodeURIComponent(textMsg);
    console.log("RAW MESSAGE (MATCH SHARE):", textMsg);
    console.log("ENCODED (MATCH SHARE):", escapedMsg);
    console.log("WHATSAPP URL (MATCH SHARE):", `https://wa.me/?text=${escapedMsg}`);
    window.open(`https://wa.me/?text=${escapedMsg}`, '_blank');
  };

  const handleConvocarReservas = (match: any) => {
    const formattedDate = match.date.split('-').reverse().join('/');
    const textMsg = `\u26BD *RACHA DO FOFIM - CONVOCAÇÃO DE RESERVAS!* \u26BD\n` +
      `\uD83D\uDCC5 *Data:* ${formattedDate} às ${match.time}\n` +
      `\uD83D\uDCCD *Local:* ${match.location}\n\n` +
      `\u26A0\uFE0F Atenção reservas da fila de prioridade: O prazo de confirmação de mensalistas encerrou e ainda temos *${15 - match.confirmedCount} vagas em aberto*!\n\n` +
      `Por favor, os próximos da fila de reservas acessem o app para registrar presença:\n` +
      `\uD83D\uDC49 Acesse e confirme: https://racha-do-fofim.com\n\n` +
      `Abraços!`;
    const escapedMsg = encodeURIComponent(textMsg);
    console.log("RAW MESSAGE (RESERVES):", textMsg);
    console.log("ENCODED (RESERVES):", escapedMsg);
    console.log("WHATSAPP URL (RESERVES):", `https://wa.me/?text=${escapedMsg}`);
    window.open(`https://wa.me/?text=${escapedMsg}`, '_blank');
  };

  // REMOVE MATCH
  const handleDeleteMatch = async (matchId: string) => {
    setErrorMsg('');
    const match = matches.find((m) => m.id === matchId);
    if (match) {
      const hasHistory = match.hasPresences || match.hasDraws || match.hasResults;
      if (hasHistory) {
        const reasons = [];
        if (match.hasPresences) reasons.push('respostas de presença (confirmados/recusados)');
        if (match.hasDraws) reasons.push('times sorteados/parciais');
        if (match.hasResults) reasons.push('placar/resultados finais gravados');
        
        setErrorMsg(`Não é possível excluir esta partida permanentemente pois ela já possui histórico registrado (${reasons.join(', ')}). Utilize a opção "Cancelar" para cancelar a rodada e manter as informações históricas.`);
        return;
      }
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao excluir rodada.');
      }

      triggerFeedback('Partida removida do calendário definitivamente.');
      setShowDeleteConfirmId(null);
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir partida.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDeleteMatches = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (selectedMatchIds.length === 0) {
      setErrorMsg('Selecione pelo menos uma partida elegível para excluir.');
      return;
    }

    if (!showBulkDeleteConfirm) {
      setShowBulkDeleteConfirm(true);
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/matches/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: selectedMatchIds })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Erro ao realizar exclusão em massa.');
      }

      setSuccessMsg(`${resData.deletedCount} partidas foram excluídas em massa com sucesso.`);
      setSelectedMatchIds([]);
      setIsBulkDeleteMode(false);
      setShowBulkDeleteConfirm(false);
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao deletar partidas em massa.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectAllEligible = () => {
    const eligibleIds = matches
      .filter((m: any) => !(m.hasPresences || m.hasDraws || m.hasResults))
      .map((m: any) => m.id);
    setSelectedMatchIds(eligibleIds);
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
          active: recurActive,
          maxMensalistas: parseInt(recurMaxMensalistas || '12'),
          maxPlayers: parseInt(recurMaxPlayers || '15')
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
        return <span className="bg-zinc-800 border border-zinc-750 text-zinc-300 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">AGENDADA</span>;
      case 'confirmando':
        return <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase animate-pulse">CONFIRMAÇÕES ABERTAS</span>;
      case 'aguardando_reservas':
        return <span className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase animate-pulse">AGUARDANDO RESERVAS</span>;
      case 'fechada':
        return <span className="bg-purple-500/15 border border-purple-500/30 text-purple-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase">FECHADA</span>;
      case 'sorteada':
        return <span className="bg-sky-500/15 border border-sky-500/30 text-sky-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase">SORTEIO REALIZADO</span>;
      case 'encerrada':
        return <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase">FINALIZADA</span>;
      case 'cancelada':
        return <span className="bg-rose-500/15 border border-rose-500/35 text-rose-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase">CANCELADA</span>;
      default:
        return <span className="bg-zinc-800 text-zinc-400 font-mono text-[10px] px-2 py-0.5 rounded uppercase">{status}</span>;
    }
  };

  const activeSeason = seasons.find((s) => s.active);

  return (
    <div className="space-y-6" id="calendar-manager-panel">
      
      {/* Sub Tabs menu */}
      <ResponsiveTabsContainer activeTabId={`tab-cal-${activeSubTab}`} className="gap-1">
        <button
          id="tab-cal-matches"
          onClick={() => setActiveSubTab('matches')}
          className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'matches'
              ? 'border-b-2 border-emerald-400 text-white bg-emerald-500/5'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          <span>📅 </span>
          <span>
            <span className="hidden md:inline">Agenda de Rachas</span>
            <span className="md:hidden">Agenda</span>
          </span>
        </button>

        {isAdmin && (
          <button
            id="tab-cal-recurrence"
            onClick={() => setActiveSubTab('recurrence')}
            className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'recurrence'
                ? 'border-b-2 border-emerald-400 text-white bg-emerald-500/5'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            <span>⚙️ </span>
            <span>
              <span className="hidden md:inline">Recorrência & Temporadas</span>
              <span className="md:hidden">Recorrência</span>
            </span>
          </button>
        )}

        <button
          id="tab-cal-reserves"
          onClick={() => setActiveSubTab('reserves')}
          className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'reserves'
              ? 'border-b-2 border-emerald-400 text-white bg-emerald-500/5'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          <span>📋 </span>
          <span>
            <span className="hidden md:inline">Fila de Reservas</span>
            <span className="md:hidden">Reservas</span>
          </span>
        </button>
      </ResponsiveTabsContainer>

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="p-1 text-rose-400 hover:text-white hover:bg-rose-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --- ABA 1: AGENDA DE RACHAS (MATCHES LISTINGS) --- */}
      {activeSubTab === 'matches' && (
        <div className="space-y-4">
          
          <div className="flex justify-between items-center bg-zinc-950/20 p-3 rounded-lg border border-zinc-900 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-white font-display uppercase">Grade de Rodadas</h3>
              <p className="text-[10px] text-zinc-500 font-mono leading-none mt-1">
                Temporada Escopo: <span className="text-emerald-400 font-black">{activeSeason ? activeSeason.name : 'Nenhuma Ativa'}</span>
              </p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkDeleteMode(!isBulkDeleteMode);
                    setSelectedMatchIds([]);
                    setShowBulkDeleteConfirm(false);
                  }}
                  className={`font-mono font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition border ${
                    isBulkDeleteMode 
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isBulkDeleteMode ? 'Desativar Seleção' : 'Excluir em Massa'}</span>
                </button>
                <button
                  onClick={() => setShowMatchForm(!showMatchForm)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition inline-flex"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agendar Racha</span>
                </button>
              </div>
            )}
          </div>

          {/* BULK ACTIONS TOOLBAR */}
          {isBulkDeleteMode && isAdmin && (
            <div className="space-y-2">
              <div className="bg-[#1c1c1e] p-3 rounded-xl border border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-3 font-mono text-xs animate-slideDown">
                <div className="text-zinc-400 text-[11px]">
                  <span className="text-emerald-400 font-black">{selectedMatchIds.length}</span> partidas sem histórico selecionadas.
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectAllEligible();
                    }}
                    className="flex-1 md:flex-none bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold px-3 py-1.5 rounded border border-zinc-850 transition text-[10px] uppercase cursor-pointer"
                  >
                    Selecionar Todas Elegíveis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMatchIds([]);
                    }}
                    className="flex-1 md:flex-none bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white font-bold px-3 py-1.5 rounded border border-zinc-900 transition text-[10px] uppercase cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={selectedMatchIds.length === 0 || actionLoading}
                    className={`flex-1 md:flex-none font-bold px-4 py-1.5 rounded text-[10px] uppercase transition cursor-pointer ${
                      selectedMatchIds.length > 0
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow shadow-rose-500/10'
                        : 'bg-zinc-850 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                    }`}
                  >
                    {actionLoading ? 'Processando...' : 'Remover em Massa'}
                  </button>
                </div>
              </div>

              {/* BEAUTIFUL GLASSMORPHISM CONFIRMATION MODAL */}
              {showBulkDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
                  <div className="bg-[#121214] border border-red-500/20 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl relative animate-scaleUp">
                    <div className="flex items-start gap-4 font-sans">
                      <div className="p-3 bg-red-500/10 rounded-full flex-shrink-0 text-red-500 border border-red-500/20">
                        <AlertTriangle className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold font-display uppercase text-white tracking-wider">
                          Confirmação de Segurança
                        </h3>
                        <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                          Você está prestes a apagar permanentemente as <span className="text-emerald-400 font-extrabold underline">{selectedMatchIds.length}</span> rodadas selecionadas.
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-900 max-h-36 overflow-y-auto space-y-1.5 font-mono text-[10.5px] text-zinc-400">
                      <p className="font-bold text-zinc-500 mb-1">Partidas a serem excluídas:</p>
                      {matches
                        .filter(m => selectedMatchIds.includes(m.id))
                        .map(m => (
                          <div key={m.id} className="flex justify-between border-b border-zinc-900 pb-1 last:border-0 last:pb-0">
                            <span className="text-zinc-300 font-bold">📅 {m.date.split('-').reverse().join('/')}</span>
                            <span className="text-zinc-500">🕒 {m.time} ({m.location.split(' ')[0]})</span>
                          </div>
                        ))}
                    </div>

                    <p className="text-[10px] sm:text-[11px] text-red-400/90 font-mono italic leading-relaxed bg-red-950/20 border border-red-900/30 p-2.5 rounded-lg">
                      ⚠️ <span className="font-bold uppercase">Atenção:</span> Esta ação é definitiva e removerá completamente estes agendamentos do racha. O histórico de presença será encerrado para estas rodadas.
                    </p>

                    <div className="flex gap-3 pt-2 font-mono text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkDeleteConfirm(false);
                        }}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 py-2.5 rounded-xl border border-zinc-800 transition cursor-pointer text-center uppercase text-[10.5px] tracking-wider"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleBulkDeleteMatches}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl border border-red-400 shadow shadow-red-500/30 transition cursor-pointer text-center uppercase text-[10.5px] tracking-wider"
                      >
                        {actionLoading ? 'Excluindo...' : '💥 Sim, Confirmar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                    min={todayStr}
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
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Prazo de Confirmação (Dias antes)</label>
                  <input
                    type="number"
                    required
                    value={newMatchDeadline}
                    onChange={(e) => setNewMatchDeadline(e.target.value)}
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

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Limite de Vagas (Atletas)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newMatchMaxPlayers}
                    onChange={(e) => setNewMatchMaxPlayers(e.target.value)}
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
                const hasHistory = item.hasPresences || item.hasDraws || item.hasResults;
                const isSelected = selectedMatchIds.includes(item.id);
                
                return (
                  <div key={item.id} className="flex gap-3 items-stretch">
                    {isBulkDeleteMode && isAdmin && (
                      <div className="flex flex-col justify-center items-center bg-[#09090b] px-3.5 py-4 rounded-xl border border-zinc-900 flex-shrink-0 animate-slideRight">
                        {hasHistory ? (
                          <div className="text-zinc-650 text-xs font-bold" title="Partidas com histórico não podem ser excluídas em massa para preservar estatísticas.">
                            🔒
                          </div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setShowBulkDeleteConfirm(false);
                              if (isSelected) {
                                setSelectedMatchIds(selectedMatchIds.filter(id => id !== item.id));
                              } else {
                                setSelectedMatchIds([...selectedMatchIds, item.id]);
                              }
                            }}
                            className="w-4 h-4 cursor-pointer accent-emerald-500 rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                          />
                        )}
                      </div>
                    )}
                    <div 
                      id={`match-card-${item.id}`}
                      className={`flex-1 p-4 rounded-xl border ${
                        highlightedMatchId === item.id
                          ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500 bg-emerald-950/20 scale-[1.01]'
                          : item.status === 'confirmando' 
                            ? 'border-amber-500/20 bg-amber-500/5' 
                            : item.status === 'aguardando_reservas'
                              ? 'border-indigo-500/20 bg-indigo-500/5'
                              : item.status === 'fechada'
                                ? 'border-purple-500/20 bg-purple-500/5'
                                : item.status === 'sorteada'
                                  ? 'border-sky-500/20 bg-sky-500/5'
                                  : item.status === 'encerrada'
                                    ? 'border-emerald-500/10 bg-emerald-500/5'
                                    : item.status === 'cancelada'
                                      ? 'border-zinc-900 bg-zinc-950/10 opacity-60'
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

                        {item.status !== 'agendada' && (
                          <div className="flex flex-col gap-1 text-[11px] pt-1.5 font-mono text-zinc-400 uppercase">
                            <div>⚽ Atletas Confirmados: <span className="text-emerald-400 font-extrabold">{item.confirmedCount} de {item.maxPlayers || 15}</span></div>
                            
                            {item.status === 'confirmando' && item.deadlineDateStr && (
                              <div className="text-[10px] text-amber-500 font-semibold lowercase">
                                ⏳ prazo limite: <span className="font-extrabold">{item.deadlineDateStr}</span>
                              </div>
                            )}

                            {item.status === 'aguardando_reservas' && (
                              <div className="text-[10px] text-indigo-400 font-semibold">
                                📢 Faltam <span className="font-extrabold">{Math.max(0, 15 - item.confirmedCount)}</span> atletas
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ACTIONS BAR */}
                      <div className="flex flex-wrap gap-1.5 self-end sm:self-auto items-center">
                        
                        {/* Se a partida for finalizada (encerrada), exibimos o WhatsApp / Ver Resultado */}
                        {item.status === 'encerrada' && (
                          <div className="flex items-center gap-1.5 font-mono">
                            {matchResult && (
                              <button
                                onClick={() => handleShareResult(item, matchResult)}
                                title="Compartilhar resultado no WhatsApp"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-[10px] px-2.5 py-1.5 rounded uppercase flex items-center gap-1 cursor-pointer transition"
                              >
                                💚 WhatsApp Resultados
                              </button>
                            )}
                          </div>
                        )}

                        {/* Se a partida estiver cancelada */}
                        {isAdmin && item.status === 'cancelada' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateMatchStatus(item.id, 'agendada')}
                              className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                              title="Reabrir racha"
                            >
                              Reabrir
                            </button>
                            {!item.hasPresences && (
                              <button
                                onClick={() => {
                                  setShowDeleteConfirmId(showDeleteConfirmId === item.id ? null : item.id);
                                  setShowResultFormId(null);
                                }}
                                className={`p-1.5 rounded-lg border transition ${
                                  showDeleteConfirmId === item.id
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold'
                                    : 'bg-zinc-950 border-zinc-900 text-rose-500 hover:bg-rose-500/10'
                                }`}
                                title="Opções de Exclusão da Partida"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Se a partida estiver ativa e o usuário for Administrador */}
                        {isAdmin && item.status !== 'encerrada' && item.status !== 'cancelada' && (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            
                            {/* ESTADO: AGENDADA */}
                            {item.status === 'agendada' && (
                              <>
                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'confirmando')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition animate-pulse"
                                  title="Iniciar confirmação de presenças"
                                >
                                  Abrir Confirmações
                                </button>
                                
                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                  className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Cancelar racha"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {/* ESTADO: CONFIRMANDO (Confirmações Abertas) */}
                            {item.status === 'confirmando' && (
                              <>
                                <button
                                  onClick={() => handleShareMatchOnWhatsApp(item)}
                                  className="bg-[#128C7E] hover:bg-[#075e54] text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition inline-flex items-center gap-1"
                                  title="Compartilhar lista de chamada no WhatsApp"
                                >
                                  💚 Compartilhar
                                </button>

                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                  className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Cancelar racha"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {/* ESTADO: AGUARDANDO_RESERVAS */}
                            {item.status === 'aguardando_reservas' && (
                              <>
                                <button
                                  onClick={() => handleConvocarReservas(item)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Convocar atletas reservas no WhatsApp"
                                >
                                  Convocar Reservas
                                </button>

                                <button
                                  onClick={() => handleShareMatchOnWhatsApp(item)}
                                  className="bg-[#128C7E] hover:bg-[#075e54] text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition inline-flex items-center gap-1"
                                  title="Compartilhar lista de chamada"
                                >
                                  💚 Compartilhar
                                </button>

                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                  className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Cancelar racha"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {/* ESTADO: FECHADA */}
                            {item.status === 'fechada' && (
                              <>
                                <button
                                  onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }))}
                                  className="bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition animate-bounce"
                                  title="Iniciar sorteio de equipes"
                                >
                                  Realizar Sorteio
                                </button>

                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                  className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Cancelar racha"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {/* ESTADO: SORTEADA */}
                            {item.status === 'sorteada' && (
                              <>
                                <button
                                  onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }))}
                                  className="bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Visualizar o sorteio já realizado"
                                >
                                  Visualizar Sorteio
                                </button>

                                <button
                                  onClick={() => {
                                    setShowResultFormId(showResultFormId === item.id ? null : item.id);
                                    setShowDeleteConfirmId(null);
                                    setWinsBlue('0');
                                    setWinsRed('0');
                                    setWinsGreen('0');
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Registrar Vitórias das Equipes e Encerrar Racha"
                                >
                                  {showResultFormId === item.id ? 'Fechar Placar' : 'Gravar Placar / Encerrar'}
                                </button>

                                <button
                                  onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                  className="bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-2.5 py-1.5 rounded uppercase cursor-pointer transition"
                                  title="Cancelar racha"
                                >
                                  Cancelar
                                </button>
                              </>
                            )}

                            {/* BOTÃO DE DELETAR / LIXEIRA (Disponível apenas para AGENDADA por segurança e precisão do fluxo) */}
                            {item.status === 'agendada' && (
                              <button
                                onClick={() => {
                                  setShowDeleteConfirmId(showDeleteConfirmId === item.id ? null : item.id);
                                  setShowResultFormId(null);
                                }}
                                className={`p-1.5 rounded-lg border transition ${
                                  showDeleteConfirmId === item.id
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold'
                                    : 'bg-zinc-950 border-zinc-900 text-rose-500 hover:bg-rose-500/10'
                                }`}
                                title="Opções de Exclusão da Partida"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                          </div>
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

                        {/* Link to Mural */}
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'mural' }));
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('open-mural-post', { detail: item.id }));
                            }, 150);
                          }}
                          className="w-full mt-3 bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-450 border border-emerald-500/20 rounded py-2 text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer uppercase font-mono tracking-wider"
                        >
                          🖼️ Ver Mural desta Partida
                        </button>
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

                    {/* INLINE DELETE CONFIRMATION OR EXPLANATION AREA */}
                    {showDeleteConfirmId === item.id && (
                      <div className="p-4 bg-[#09090b] border border-zinc-900 rounded-xl space-y-3 font-mono text-xs animate-fadeIn mt-2" id={`delete-panel-${item.id}`}>
                        <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                          <span className="font-bold text-white uppercase text-[10.5px] text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                            Excluir Rodada do Calendário
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setShowDeleteConfirmId(null)}
                            className="text-zinc-500 hover:text-white"
                          >
                            Fechar [X]
                          </button>
                        </div>

                        {/* CASE 1: MATCH HAS HISTORY (CANNOT BE DELETED) */}
                        {item.hasPresences || item.hasDraws || item.hasResults ? (
                          <div className="space-y-3">
                            <p className="text-zinc-350 leading-relaxed text-[11px]">
                              ⚠️ <span className="font-extrabold text-white">Não é possível excluir esta partida permanentemente</span> porque ela já possui movimentação histórica no sistema:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1 text-[11px]">
                              {item.hasPresences && (
                                <li>Respostas de presença ativas (<span className="text-amber-500">confirmados, recusados ou em espera</span>).</li>
                              )}
                              {item.hasDraws && (
                                <li>Histórico de times ou sorteio de racha realizado.</li>
                              )}
                              {item.hasResults && (
                                <li>Placar ou resultado final gravado.</li>
                              )}
                            </ul>
                            
                            <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-lg text-rose-350 leading-relaxed text-[10.5px]">
                              Para manter as estatísticas e pontuações do grupo intactas, rachas com histórico não são excluídos fisicamente. Se a partida não for realizada, cancele-a.
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              {item.status !== 'cancelada' ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setShowDeleteConfirmId(null);
                                    await handleUpdateMatchStatus(item.id, 'cancelada');
                                  }}
                                  className="flex-1 bg-red-950/40 hover:bg-red-900/30 border border-red-500/30 text-rose-400 py-2 px-3 rounded text-[10px] font-bold transition uppercase cursor-pointer"
                                >
                                  Cancelar Rodada Preservando Histórico
                                </button>
                              ) : (
                                <div className="text-[10px] text-zinc-500 italic p-1">
                                  Esta partida já foi cancelada. Seu histórico continua preservado.
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirmId(null)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 py-2 px-3 rounded text-[10.5px] font-bold transition cursor-pointer space-x-1"
                              >
                                Voltar
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* CASE 2: FRESH MATCH (CAN BE DELETED) */
                          <div className="space-y-3">
                            <p className="text-zinc-350 leading-relaxed text-[11px]">
                              Esta partida está vazia (sem presenças cadastradas, sorteios ou resultados) e <span className="text-emerald-400 font-bold">pode ser excluída permanentemente</span> do racha.
                            </p>
                            <p className="text-red-400 font-extrabold text-[10px] uppercase">
                              ⚠️ Atenção: Esta ação é definitiva e removerá completamente este registro do banco de dados!
                            </p>
                            <div className="flex gap-2 pt-1 font-mono">
                              <button
                                type="button"
                                onClick={() => handleDeleteMatch(item.id)}
                                disabled={actionLoading}
                                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded text-[11px] uppercase transition cursor-pointer"
                              >
                                {actionLoading ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirmId(null)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded text-[11px] font-bold transition cursor-pointer"
                              >
                                Não, Voltar
                              </button>
                            </div>
                          </div>
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

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono text-zinc-500 uppercase">Limite de Vagas do Racha (Jogadores)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={recurMaxPlayers}
                    onChange={(e) => setRecurMaxPlayers(e.target.value)}
                    className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded px-3 py-2 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
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

      {/* CANCEL MATCH MODAL WITH DUAL RULES */}
      {cancelMatchId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-[#121214] border border-red-500/20 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl relative animate-scaleUp">
            <div className="flex items-start gap-4 font-sans">
              <div className="p-3 bg-red-500/10 rounded-full flex-shrink-0 text-red-500 border border-red-500/20">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold font-display uppercase text-white tracking-wider">
                  Cancelar Rodada
                </h3>
                <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                  Tem certeza que deseja cancelar esta rodada?
                </p>
              </div>
            </div>

            <div className="bg-zinc-950/80 p-4 rounded-xl border border-zinc-900 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={clearPresencesOnCancel}
                  onChange={(e) => setClearPresencesOnCancel(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/20 focus:ring-offset-0 focus:outline-none"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-200 block">
                    Limpar confirmações e convocações
                  </span>
                  <span className="text-[10px] text-zinc-500 block leading-relaxed">
                    Marque para remover todas as confirmações, convocações automáticas de reservas, e restaurar todos os atletas para estado "sem resposta".
                  </span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2 font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => setCancelMatchId(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 py-2.5 rounded-xl border border-zinc-800 transition cursor-pointer text-center uppercase text-[10.5px] tracking-wider"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  const mId = cancelMatchId;
                  setCancelMatchId(null);
                  await handleUpdateMatchStatus(mId, 'cancelada', { clearPresences: clearPresencesOnCancel });
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl border border-red-400 shadow shadow-red-500/30 transition cursor-pointer text-center uppercase text-[10.5px] tracking-wider disabled:opacity-50"
              >
                {actionLoading ? 'Processando...' : '💥 Sim, Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
