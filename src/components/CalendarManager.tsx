import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { motion } from 'motion/react';
import { User, Season, Match, MatchStatus, Player } from '../types';
import { 
  Calendar, Clock, MapPin, Plus, Trash2, Edit, Check, Play, RefreshCw,
  Sliders, AlertTriangle, ArrowUp, ArrowDown, ShieldAlert, CheckCircle2,
  ListOrdered, HelpCircle, Activity, Hourglass, CalendarRange, X,
  Trophy, Users, Award, Star, Image, ChevronDown, ChevronUp, CheckSquare, Sparkles
} from 'lucide-react';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';
import { useAppConfig } from '../contexts/AppConfigContext';

const STATUS_METADATA: Record<string, { icon: string; bg: string; text: string; border: string; label: string }> = {
  agendada: {
    icon: '📅',
    bg: 'bg-zinc-850/40',
    text: 'text-zinc-300',
    border: 'border-zinc-800',
    label: 'Agendada'
  },
  confirmando: {
    icon: '🔔',
    bg: 'bg-amber-500/10 animate-pulse',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'Chamada Aberta'
  },
  fechada: {
    icon: '🔒',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    label: 'Lista Fechada'
  },
  sorteada: {
    icon: '🎲',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    label: 'Sorteio Realizado'
  },
  em_andamento: {
    icon: '⚡',
    bg: 'bg-red-500/10 animate-pulse',
    text: 'text-red-400',
    border: 'border-red-500/25',
    label: 'Em Andamento'
  },
  avaliacoes: {
    icon: '⭐',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    label: 'Avaliações Abertas'
  },
  encerrada: {
    icon: '🏆',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'Finalizada'
  },
  cancelada: {
    icon: '❌',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    label: 'Cancelada'
  }
};

interface CalendarManagerProps {
  currentUser: User;
  simulatedState?: number | null;
  setSimulatedState?: (state: number | null) => void;
}

export default function CalendarManager({ currentUser, simulatedState = null, setSimulatedState }: CalendarManagerProps) {
  const { appName } = useAppConfig();
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'presences' | 'teams' | 'result' | 'ratings' | 'museum'>('presences');
  const [muralPosts, setMuralPosts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
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
  const [newMatchTime, setNewMatchTime] = useState('21:30');
  const [newMatchLocation, setNewMatchLocation] = useState('Arena Furacão');
  const [newMatchDuration, setNewMatchDuration] = useState('60');
  const [newMatchDeadline, setNewMatchDeadline] = useState('2');

  // Form states: Recurrence Config
  const [recurDay, setRecurDay] = useState('6'); // Default to Saturday
  const [recurTime, setRecurTime] = useState('21:30');
  const [recurLocation, setRecurLocation] = useState('Arena Furacão');
  const [recurDuration, setRecurDuration] = useState('60');
  const [recurDeadline, setRecurDeadline] = useState('2');
  const [recurActive, setRecurActive] = useState(true);
  const [recurMonthlyFee, setRecurMonthlyFee] = useState('100');
  const [recurChargeDateRule, setRecurChargeDateRule] = useState('primeiro_jogo');
  const [recurMaxMensalistas, setRecurMaxMensalistas] = useState('12');
  const [recurMaxPlayers, setRecurMaxPlayers] = useState('15');
  const [newMatchMaxPlayers, setNewMatchMaxPlayers] = useState('15');
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);

  // Inline editing for scheduled matches
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editMatchDate, setEditMatchDate] = useState('');
  const [editMatchTime, setEditMatchTime] = useState('');
  const [editMatchLocation, setEditMatchLocation] = useState('');
  const [editMatchDeadline, setEditMatchDeadline] = useState('');

  const handleSaveMatchEdit = async (matchId: string) => {
    if (!editMatchDate || !editMatchTime) {
      setErrorMsg('Data e horário são obrigatórios para editar a partida.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    try {
      const response = await authFetch(`/api/matches/${matchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editMatchDate,
          time: editMatchTime,
          location: editMatchLocation,
          confirmationDeadlineDaysBefore: parseInt(editMatchDeadline || '2')
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Não foi possível salvar as alterações.');
      }

      setEditingMatchId(null);
      triggerFeedback('Rodada atualizada com sucesso!');
      await fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao atualizar partida.');
    } finally {
      setActionLoading(false);
    }
  };

  // Data Fetching
  const fetchAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Matches
      const matchRes = await authFetch('/api/matches');
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        setMatches(matchData || []);
      }

      // 2. Seasons
      const seasonRes = await authFetch('/api/seasons');
      if (seasonRes.ok) {
        const seasonData = await seasonRes.json();
        setSeasons(seasonData || []);
      }

      // 3. Recurrence Setup
      const recurRes = await authFetch('/api/recurrent-config');
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
      const reserveRes = await authFetch('/api/reserves/order');
      if (reserveRes.ok) {
        const reserveData = await reserveRes.json();
        setReserves(reserveData.reserves || []);
        setReservesOrder(reserveData.order || []);
      }

      // 5. Match Results
      const resultsRes = await authFetch('/api/results');
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults(resultsData || []);
      }

      // 6. Players
      const playersRes = await authFetch('/api/players');
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setPlayers(playersData || []);
      }

      // 7. Mural Posts
      const muralRes = await authFetch('/api/mural/posts');
      if (muralRes.ok) {
        const muralData = await muralRes.json();
        setMuralPosts(muralData || []);
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
        setExpandedMatchId(matchId);
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
      const response = await authFetch('/api/seasons', {
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
      const response = await authFetch(`/api/seasons/${seasonId}`, {
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
      const response = await authFetch('/api/matches', {
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
      const response = await authFetch(`/api/matches/${matchId}`, {
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
      const response = await authFetch(`/api/matches/${matchId}/results`, {
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
      const statsRes = await authFetch(`/api/stats?seasonId=${item.seasonId}`);
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

*${appName}* - Acesse para ver as estatísticas completas! \u26BD`;

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

Acesse o sistema *${appName}* para verificar estatísticas atualizadas! \u26BD`;

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
    const textMsg = `\u26BD *${appName.toUpperCase()} - CONVOCADOS PARA O DIA ${formattedDate}!* \u26BD\n` +
      `\uD83D\uDCC5 *Data:* ${formattedDate} às ${match.time}\n` +
      `\uD83D\uDCCD *Local:* ${match.location}\n\n` +
      `\uD83D\uDC65 *Confirmados (${match.confirmedCount}/15):*\n\n` +
      `\u26A0\uFE0F *Vagas em aberto:* ${match.vacancies} vagas disponíveis!\n\n` +
      `Por favor, atualizem seus status de presença no app oficial:\n` +
      `\uD83D\uDC49 Acesse e confirme: ${window.location.origin}\n\n` +
      `Abraços e bom racha!`;
      
    const escapedMsg = encodeURIComponent(textMsg);
    console.log("RAW MESSAGE (MATCH SHARE):", textMsg);
    console.log("ENCODED (MATCH SHARE):", escapedMsg);
    console.log("WHATSAPP URL (MATCH SHARE):", `https://wa.me/?text=${escapedMsg}`);
    window.open(`https://wa.me/?text=${escapedMsg}`, '_blank');
  };

  const handleConvocarReservas = (match: any) => {
    const formattedDate = match.date.split('-').reverse().join('/');
    const textMsg = `\u26BD *${appName.toUpperCase()} - CONVOCAÇÃO DE RESERVAS!* \u26BD\n` +
      `\uD83D\uDCC5 *Data:* ${formattedDate} às ${match.time}\n` +
      `\uD83D\uDCCD *Local:* ${match.location}\n\n` +
      `\u26A0\uFE0F Atenção reservas da fila de prioridade: O prazo de confirmação de mensalistas encerrou e ainda temos *${15 - match.confirmedCount} vagas em aberto*!\n\n` +
      `Por favor, os próximos da fila de reservas acessem o app para registrar presença:\n` +
      `\uD83D\uDC49 Acesse e confirme: ${window.location.origin}\n\n` +
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
      const hasHistory = match.hasDraws || match.hasResults;
      if (hasHistory) {
        const reasons = [];
        if (match.hasDraws) reasons.push('times sorteados/parciais');
        if (match.hasResults) reasons.push('placar/resultados finais gravados');
        
        setErrorMsg(`Não é possível excluir esta partida permanentemente pois ela possui sorteio realizado ou resultados registrados (${reasons.join(', ')}).`);
        return;
      }
    }

    setActionLoading(true);
    try {
      const response = await authFetch(`/api/matches/${matchId}`, { method: 'DELETE' });
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
      const response = await authFetch('/api/matches/bulk-delete', {
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
      .filter((m: any) => !(m.hasDraws || m.hasResults))
      .map((m: any) => m.id);
    setSelectedMatchIds(eligibleIds);
  };

  // SAVE RECURRENCE SETUP
  const handleSaveRecurrenceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await authFetch('/api/recurrent-config', {
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
      const response = await authFetch('/api/matches/generate-recurrent', { method: 'POST' });
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
      const response = await authFetch('/api/reserves/order', {
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

  const getHighlightsForLastMatch = () => {
    const ended = matches.filter(m => m.status === 'encerrada');
    const lastMatch = ended.length > 0
      ? [...ended].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;
    
    if (!lastMatch) return null;
    const result = results.find(r => r.matchId === lastMatch.id);
    
    // Find champion
    const championTeamNames = result?.champions || [];
    const championText = championTeamNames.length > 0 
      ? championTeamNames.map(c => c === 'Azul' ? 'Equipe A' : c === 'Vermelho' ? 'Equipe B' : 'Equipe C').join(' + ')
      : 'Nenhum';

    // Find players from champion team if available
    const championPlayerIds = result?.teams
      ? result.teams.filter((t: any) => championTeamNames.includes(t.name)).flatMap((t: any) => t.playerIds || [])
      : [];

    let mvpPlayer: Player | null = null;
    const activePlayers = players.filter(p => !p.deletedAt);

    if (championPlayerIds.length > 0) {
      // Find player from champion team with highest streak or overall as MVP
      const champs = activePlayers.filter(p => championPlayerIds.includes(p.id));
      if (champs.length > 0) {
        mvpPlayer = [...champs].sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))[0] || champs[0];
      }
    }
    if (!mvpPlayer && activePlayers.length > 0) {
      mvpPlayer = [...activePlayers].sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))[0];
    }

    // Find top striker / artilheiro
    const strikers = activePlayers.filter(p => p.primaryPosition === 'atacante');
    const artilheiroPlayer = strikers.length > 0
      ? [...strikers].sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))[0]
      : (activePlayers.length > 0 ? activePlayers[0] : null);

    // Find goalkeeper / melhor defesa
    const keepers = activePlayers.filter(p => p.primaryPosition === 'goleiro');
    const melhorDefesaPlayer = keepers.length > 0
      ? keepers[0]
      : (activePlayers.length > 0 ? activePlayers[Math.min(activePlayers.length - 1, 1)] : null);

    return {
      lastMatch,
      championText,
      mvp: mvpPlayer,
      artilheiro: artilheiroPlayer,
      melhorDefesa: melhorDefesaPlayer
    };
  };

  const currentSeasonName = activeSeason ? activeSeason.name : 'Nenhuma Temporada Ativa';
  const totalRounds = matches.length;

  const dToday = new Date();
  const dOffset = dToday.getTimezoneOffset();
  const dLocalTodayStr = new Date(dToday.getTime() - (dOffset * 60 * 1000)).toISOString().split('T')[0];

  const activeMatches = matches.filter((m: any) => {
    if (m.lifecycleState === 'ARCHIVED' || m.lifecycleState === 'MATCH_FINISHED') return false;
    if (m.status === 'cancelada') {
      return m.date >= dLocalTodayStr;
    }
    return ['agendada', 'confirmando', 'fechada', 'sorteada'].includes(m.status);
  });
  let nextMatch = activeMatches.length > 0 ? activeMatches[0] : null;
  if (!nextMatch) {
    const endedMatches = matches.filter((m: any) => m.status === 'encerrada');
    if (endedMatches.length > 0) {
      nextMatch = endedMatches[endedMatches.length - 1];
    }
  }

  const getAutoState = (): number => {
    if (!nextMatch) return 1;
    
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
    const isMatchDay = nextMatch.date === localToday;

    if (isMatchDay && nextMatch.status !== 'encerrada') {
      return 6; // Dia do Jogo
    }

    if (nextMatch.status === 'agendada') return 1;

    if (nextMatch.status === 'confirmando') {
      const vacancies = Math.max(0, (nextMatch.maxPlayers || 15) - (nextMatch.confirmedCount || 0));
      if (vacancies > 0 && vacancies <= 3) {
        return 3; // Lista Quase Completa
      }
      return 2; // Confirmações Abertas
    }

    if (nextMatch.status === 'fechada') {
      return 4; // Lista Fechada
    }

    if (nextMatch.status === 'sorteada') {
      return 5; // Sorteio Realizado
    }

    if (nextMatch.status === 'encerrada') {
      return 8; // Default to Avaliações Abertas
    }

    return 1;
  };

  const activeStateNum = simulatedState !== null ? simulatedState : getAutoState();

  const highlights = getHighlightsForLastMatch();

  const getCustomMatchStatus = (item: any) => {
    if (item.status === 'cancelada') return 'cancelada';
    if (item.status === 'encerrada') {
      return 'encerrada';
    }
    if (item.status === 'sorteada') {
      const matchDate = new Date(item.date + 'T' + (item.time || '00:00'));
      const now = new Date();
      const diffHours = (now.getTime() - matchDate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours <= 3) {
        return 'em_andamento';
      }
      if (diffHours > 3) {
        return 'avaliacoes';
      }
      return 'sorteada';
    }
    if (item.status === 'fechada') return 'fechada';
    if (item.status === 'confirmando') return 'confirmando';
    return 'agendada';
  };

  const handleGoToPresences = (matchId: string) => {
    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'dash' }));
  };

  const handleGoToTeams = (matchId: string) => {
    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'draw' }));
  };

  const handleGoToRatings = (matchId: string) => {
    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'ranking' }));
  };

  const handleGoToMural = (matchId: string) => {
    window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'mural' }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-mural-post', { detail: matchId }));
    }, 150);
  };

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

      {/* Progress Bar removed */}

      {/* SUCCESS / ERROR NOTIFICATIONS */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-400 hover:text-white hover:bg-emerald-500/10 rounded transition cursor-pointer"
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
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --- ABA 1: AGENDA DE RACHAS (MATCHES LISTINGS) --- */}
      {activeSubTab === 'matches' && (
        <div className="space-y-4">
          
          {/* HERO — CENTRAL DA TEMPORADA */}
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-zinc-800/60">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-widest uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  Central da Temporada
                </span>
                <h2 className="text-xl sm:text-2xl font-sans font-black text-white mt-1.5 tracking-tight">
                  {currentSeasonName}
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Total de rodadas: <span className="text-white font-bold">{totalRounds}</span>
                </p>
              </div>

              {isAdmin && (
                <div className="flex gap-2 self-stretch md:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkDeleteMode(!isBulkDeleteMode);
                      setSelectedMatchIds([]);
                      setShowBulkDeleteConfirm(false);
                    }}
                    className={`flex-1 md:flex-none font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition border ${
                      isBulkDeleteMode 
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBulkDeleteMode ? 'Desativar Seleção' : 'Excluir em Massa'}</span>
                  </button>
                  <button
                    onClick={() => setShowMatchForm(!showMatchForm)}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition inline-flex"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agendar Racha</span>
                  </button>
                </div>
              )}
            </div>

            {/* NEXT MATCH HERO CARD */}
            {nextMatch ? (
              <div className="bg-zinc-950/40 border border-emerald-500/20 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -z-10" />
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      Próximo Jogo Confirmado
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-sans font-extrabold text-white">
                      📅 {nextMatch.date.split('-').reverse().join('/')} às {nextMatch.time}
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{nextMatch.location}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                  <div className="bg-zinc-900/80 px-4 py-2.5 rounded-lg border border-zinc-850 text-center sm:text-left">
                    <span className="text-[9px] text-zinc-500 font-mono uppercase block">Atletas Confirmados</span>
                    <span className="text-white font-mono text-sm font-extrabold">
                      {nextMatch.confirmedCount} <span className="text-zinc-500 font-normal">de</span> {nextMatch.maxPlayers || 15}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setHighlightedMatchId(nextMatch.id);
                      setExpandedMatchId(nextMatch.id);
                      setTimeout(() => {
                        const el = document.getElementById(`match-card-${nextMatch.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                    className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-450 text-[10px] font-mono font-bold uppercase tracking-wider px-4 py-3 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Ver Detalhes</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs font-mono text-zinc-500 bg-zinc-950/20 rounded-xl border border-zinc-900">
                Não há próximos rachas agendados no momento.
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
          ) : (() => {
            const chronologicalMatches = [...matches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const matchesWithRound = matches.map(m => {
              const chronoIndex = chronologicalMatches.findIndex(x => x.id === m.id);
              return {
                ...m,
                roundNum: chronoIndex !== -1 ? chronoIndex + 1 : 1
              };
            });

            const sortedMatches = [...matchesWithRound].sort((a, b) => {
              const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              if (createdDiff !== 0) return createdDiff;
              return b.time.localeCompare(a.time);
            });

            const itemsPerPage = 5;
            const totalPages = Math.ceil(sortedMatches.length / itemsPerPage);
            const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages || 1);
            const startIndex = (safeCurrentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedMatches = sortedMatches.slice(startIndex, endIndex);

            return (
              <div className="space-y-6">
                <div className="relative border-l-2 border-zinc-850 ml-4 sm:ml-6 pl-6 sm:pl-10 space-y-6 py-4">
                  {paginatedMatches.map((item: any) => {
                    const roundNum = item.roundNum;
                    const matchResult = results.find(r => r.matchId === item.id);
                    const customStatus = getCustomMatchStatus(item);
                    const isSelected = selectedMatchIds.includes(item.id);
                    const isCardExpanded = expandedMatchId === item.id;

                    // Museum Content Availability
                    const matchMedias = muralPosts.filter(p => p.matchId === item.id && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted);
                    const hasMuseumContent = matchMedias.length > 0;

                    // Remaining spots logic
                    const maxPlayers = item.maxPlayers || 15;
                    const confirmedCount = item.confirmedCount || 0;
                    const remainingSpots = Math.max(0, maxPlayers - confirmedCount);

                    return (
                      <div key={item.id} className="relative group" id={`match-card-${item.id}`}>
                        {/* Timeline Node Icon Indicator */}
                        <div className={`absolute -left-[31px] sm:-left-[47px] top-4 -translate-x-1/2 w-8 h-8 rounded-full border bg-zinc-950 flex items-center justify-center z-10 transition-all duration-300 ${
                          isCardExpanded ? 'ring-4 ring-emerald-500/25 border-emerald-500 scale-110' : 'border-zinc-800 group-hover:border-zinc-650'
                        }`}>
                          <span className="text-xs">
                            {customStatus === 'agendada' && '🟢'}
                            {customStatus === 'confirmando' && '🟡'}
                            {(customStatus === 'fechada' || customStatus === 'sorteada') && '🔵'}
                            {(customStatus === 'em_andamento' || customStatus === 'avaliacoes') && '🟣'}
                            {customStatus === 'encerrada' && '⚫'}
                            {customStatus === 'cancelada' && '❌'}
                          </span>
                        </div>

                        {/* Card Container */}
                        <div className={`rounded-2xl border backdrop-blur-sm p-4 transition-all duration-300 space-y-3 ${
                          isCardExpanded 
                            ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/5 bg-zinc-900/10' 
                            : 'border-zinc-900 hover:border-zinc-850 bg-zinc-950/15'
                        }`}>
                          {/* Card Content Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Left Side: General Round Info */}
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                                  Rodada #{roundNum}
                                </span>
                                
                                {/* Status badge wrapper according to ETAPA 5 */}
                                {(() => {
                                  switch (customStatus) {
                                    case 'agendada':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                          Agendada
                                        </span>
                                      );
                                    case 'confirmando':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                          Confirmações
                                        </span>
                                      );
                                    case 'fechada':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                          Lista Fechada
                                        </span>
                                      );
                                    case 'sorteada':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                          Sorteio
                                        </span>
                                      );
                                    case 'em_andamento':
                                    case 'avaliacoes':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/25 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                          Em andamento
                                        </span>
                                      );
                                    case 'encerrada':
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                          Encerrada
                                        </span>
                                      );
                                    case 'cancelada':
                                    default:
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                          Cancelada
                                        </span>
                                      );
                                  }
                                })()}

                                {/* Bulk Selection Checkbox */}
                                {isBulkDeleteMode && isAdmin && (
                                  <label className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-900 rounded px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 cursor-pointer">
                                    <span>SELECIONAR</span>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={item.hasDraws || item.hasResults}
                                      onChange={() => {
                                        setShowBulkDeleteConfirm(false);
                                        if (isSelected) {
                                          setSelectedMatchIds(selectedMatchIds.filter(id => id !== item.id));
                                        } else {
                                          setSelectedMatchIds([...selectedMatchIds, item.id]);
                                        }
                                      }}
                                      className="w-3 h-3 cursor-pointer accent-rose-500 rounded border-zinc-800 bg-zinc-950 text-rose-500 focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                                    />
                                  </label>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300 font-sans">
                                <span className="font-bold text-white">📅 {item.date.split('-').reverse().join('/')} <span className="text-zinc-500 font-normal">às</span> {item.time}</span>
                                <span className="text-zinc-500 hidden sm:inline">•</span>
                                <span className="flex items-center gap-1 text-zinc-400 truncate">
                                  <MapPin className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                  <span className="truncate">{item.location}</span>
                                </span>
                              </div>
                            </div>

                            {/* Right Side: Participant Count & Result summaries */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-between md:justify-end text-right font-mono text-xs text-zinc-400">
                              {/* Show results dynamically based on ETAPA 6 / 8 */}
                              {item.status === 'encerrada' && matchResult ? (
                                <div className="text-left md:text-right space-y-0.5">
                                  <span className="block text-[11px] font-bold text-emerald-400">
                                    🏆 Campeã: {matchResult.champions.map((c: string) => c === 'Azul' ? 'Equipe A' : c === 'Vermelho' ? 'Equipe B' : 'Equipe C').join(' + ')}
                                  </span>
                                  <span className="block text-[10px] text-zinc-500">
                                    (A: {matchResult.winsBlue}v | B: {matchResult.winsRed}v | C: {matchResult.winsGreen}v)
                                  </span>
                                  <span className="block text-[10px] text-zinc-400 font-semibold">{confirmedCount} participantes</span>
                                </div>
                              ) : (
                                <div className="text-left md:text-right space-y-0.5">
                                  <span className="block font-bold text-white">{confirmedCount} / {maxPlayers} confirmados</span>
                                  <span className="block text-[10px] text-zinc-500">
                                    {remainingSpots > 0 ? `🟢 ${remainingSpots} vagas restantes` : '🔴 Vagas esgotadas'}
                                  </span>
                                </div>
                              )}

                              {/* Toggle Accordion Detail Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCardExpanded) {
                                    setExpandedMatchId(null);
                                  } else {
                                    setExpandedMatchId(item.id);
                                    setActiveDetailTab('presences');
                                  }
                                  setTimeout(() => {
                                    const el = document.getElementById(`match-card-${item.id}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 120);
                                }}
                                className={`px-3 py-2 rounded-xl text-xs font-bold font-sans transition flex items-center gap-1 cursor-pointer border ${
                                  isCardExpanded
                                    ? 'bg-emerald-600 border-emerald-500 text-white shadow shadow-emerald-500/10'
                                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-850'
                                }`}
                              >
                                <span>{isCardExpanded ? 'Fechar detalhes' : 'Ver detalhes'}</span>
                                {isCardExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* ACCORDION EXPANDED AREA FOR DETAILS & TAB SELECTIONS */}
                          {isCardExpanded && (
                            <div className="mt-4 pt-4 border-t border-zinc-900/60 space-y-4 animate-slideDown text-left">
                              {/* Dynamic Tab bar according to ETAPA 3 */}
                              <div className="flex flex-wrap gap-1.5 pb-2.5 border-b border-zinc-900/40">
                                <button
                                  type="button"
                                  onClick={() => setActiveDetailTab('presences')}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                    activeDetailTab === 'presences'
                                      ? 'bg-emerald-650/20 border border-emerald-500/35 text-emerald-400'
                                      : 'bg-zinc-900/60 border border-transparent text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  <CheckSquare className="w-3.5 h-3.5" />
                                  <span>Presenças</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setActiveDetailTab('teams')}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                    activeDetailTab === 'teams'
                                      ? 'bg-emerald-650/20 border border-emerald-500/35 text-emerald-400'
                                      : 'bg-zinc-900/60 border border-transparent text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  <ListOrdered className="w-3.5 h-3.5" />
                                  <span>Equipes</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveDetailTab('result')}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                    activeDetailTab === 'result'
                                      ? 'bg-emerald-650/20 border border-emerald-500/35 text-emerald-400'
                                      : 'bg-zinc-900/60 border border-transparent text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  <Trophy className="w-3.5 h-3.5" />
                                  <span>Resultado</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveDetailTab('ratings')}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                    activeDetailTab === 'ratings'
                                      ? 'bg-emerald-650/20 border border-emerald-500/35 text-emerald-400'
                                      : 'bg-zinc-900/60 border border-transparent text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  <span>Avaliações</span>
                                </button>

                                {hasMuseumContent && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveDetailTab('museum')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                                      activeDetailTab === 'museum'
                                        ? 'bg-emerald-650/20 border border-emerald-500/35 text-emerald-400'
                                        : 'bg-zinc-900/60 border border-transparent text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                    <span>Museu</span>
                                  </button>
                                )}
                              </div>

                              {/* On-demand Detail Tabs loading area */}
                              <div className="pt-2 animate-fadeIn min-h-[40px]">
                                {activeDetailTab === 'presences' && (
                                  <DetailPresences matchId={item.id} players={players} />
                                )}
                                {activeDetailTab === 'teams' && (
                                  <DetailTeams matchId={item.id} players={players} />
                                )}
                                {activeDetailTab === 'result' && (
                                  <DetailResult matchId={item.id} matchResult={matchResult} />
                                )}
                                {activeDetailTab === 'ratings' && (
                                  <DetailRatings matchId={item.id} players={players} />
                                )}
                                {activeDetailTab === 'museum' && (
                                  <DetailMuseum matchId={item.id} muralPosts={muralPosts} />
                                )}
                              </div>

                              {/* CONFIGURAÇÃO DA RODADA / ADMIN PANEL */}
                              {isAdmin && (
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 space-y-3 text-left mt-4">
                                  <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block mb-1">Configuração da Rodada</span>
                                  
                                  {editingMatchId === item.id ? (
                                    <div className="space-y-3 font-sans text-xs">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold mb-1">Data</label>
                                          <input
                                            type="date"
                                            value={editMatchDate}
                                            onChange={(e) => setEditMatchDate(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold mb-1">Horário</label>
                                          <input
                                            type="time"
                                            value={editMatchTime}
                                            onChange={(e) => setEditMatchTime(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold mb-1">Local da Partida</label>
                                        <input
                                          type="text"
                                          value={editMatchLocation}
                                          onChange={(e) => setEditMatchLocation(e.target.value)}
                                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-mono text-zinc-400 uppercase font-bold mb-1">Dias para Limite de Confirmação</label>
                                        <input
                                          type="number"
                                          value={editMatchDeadline}
                                          onChange={(e) => setEditMatchDeadline(e.target.value)}
                                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                        />
                                      </div>
                                      <div className="flex gap-2 pt-1 font-mono text-[9px] font-bold">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveMatchEdit(item.id)}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded uppercase transition cursor-pointer"
                                        >
                                          Salvar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMatchId(null)}
                                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded uppercase transition cursor-pointer"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMatchId(item.id);
                                            setEditMatchDate(item.date);
                                            setEditMatchTime(item.time);
                                            setEditMatchLocation(item.location || 'Arena Furacão');
                                            setEditMatchDeadline(item.confirmationDeadlineDaysBefore?.toString() || '2');
                                          }}
                                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] px-3 py-1.5 rounded-lg uppercase cursor-pointer transition flex items-center gap-1"
                                        >
                                          Editar Rodada
                                        </button>
                                        
                                        {item.status !== 'cancelada' && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateMatchStatus(item.id, 'cancelada')}
                                            className="bg-red-950/40 hover:bg-red-900/30 border border-red-500/20 text-red-400 font-mono font-bold text-[9px] px-3 py-1.5 rounded-lg uppercase cursor-pointer transition"
                                          >
                                            Cancelar Racha
                                          </button>
                                        )}
                                        
                                        {item.status === 'cancelada' && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateMatchStatus(item.id, 'agendada')}
                                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-mono font-bold text-[9px] px-3 py-1.5 rounded-lg uppercase cursor-pointer transition"
                                          >
                                            Reativar Racha
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowDeleteConfirmId(showDeleteConfirmId === item.id ? null : item.id);
                                          }}
                                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition cursor-pointer flex items-center justify-center"
                                          title="Deletar Rodada"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>

                                        {item.status === 'encerrada' && matchResult && (
                                          <button
                                            type="button"
                                            onClick={() => handleShareResult(item, matchResult)}
                                            className="bg-[#128C7E] hover:bg-[#075e54] text-white font-mono font-bold text-[9px] px-3 py-1.5 rounded-lg uppercase cursor-pointer transition inline-flex items-center gap-1"
                                          >
                                            Compartilhar Resultado
                                          </button>
                                        )}
                                      </div>
                                      
                                      {/* Active operational matches redirect to Cockpit */}
                                      {(item.status === 'confirmando' || item.status === 'fechada' || item.status === 'sorteada') && (
                                        <div className="text-[10px] font-mono text-zinc-400 leading-relaxed py-1 block mt-2 border-t border-zinc-900 pt-2">
                                          Esta rodada está em andamento operacional. As ações de confirmação de presença, sorteio de equipes e lançamento de placar devem ser realizadas diretamente no <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'dash' }))} className="text-emerald-400 font-bold underline cursor-pointer hover:text-emerald-300 transition">Painel Administrativo da Home</button>.
                                        </div>
                                      )}
                                    </>
                                  )}


                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* RECORD INLINE SCORES FORM */}
                        {showResultFormId === item.id && (
                          <div className="p-4 bg-zinc-950/80 border border-emerald-500/30 rounded-xl space-y-3 font-mono text-xs mt-2">
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
                                <label className="block text-[9px] font-bold text-blue-400 uppercase mb-1">Equipe A (Azul)</label>
                                <input 
                                  type="number"
                                  min="0"
                                  value={winsBlue}
                                  onChange={(e) => setWinsBlue(e.target.value)}
                                  className="w-full bg-[#1c1c1e] text-center text-white border border-zinc-800 rounded py-1.5 text-xs font-bold focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-2.5 text-center">
                                <label className="block text-[9px] font-bold text-rose-400 uppercase mb-1">Equipe B (Vermelho)</label>
                                <input 
                                  type="number"
                                  min="0"
                                  value={winsRed}
                                  onChange={(e) => setWinsRed(e.target.value)}
                                  className="w-full bg-[#1c1c1e] text-center text-white border border-zinc-800 rounded py-1.5 text-xs font-bold focus:outline-none focus:border-rose-500"
                                />
                              </div>

                              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 text-center">
                                <label className="block text-[9px] font-bold text-emerald-400 uppercase mb-1">Equipe C (Verde)</label>
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
                            {item.hasDraws || item.hasResults ? (
                              <div className="space-y-3">
                                <p className="text-zinc-350 leading-relaxed text-[11px]">
                                  ⚠️ <span className="font-extrabold text-white">Não é possível excluir esta partida permanentemente</span> porque ela já possui sorteio realizado ou resultados salvos:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1 text-[11px]">
                                  {item.hasDraws && (
                                    <li>Histórico de times ou sorteio de racha realizado.</li>
                                  )}
                                  {item.hasResults && (
                                    <li>Placar ou resultado final gravado.</li>
                                  )}
                                </ul>
                                
                                <div className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-lg text-rose-350 leading-relaxed text-[10.5px]">
                                  Para manter as estatísticas e pontuações do grupo intactas, rachas com sorteio não são excluídos fisicamente. Se a partida não for realizada, cancele-a.
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
                                    className="bg-zinc-900 hover:bg-zinc-850 text-zinc-300 py-2 px-3 rounded text-[10.5px] font-bold transition cursor-pointer"
                                  >
                                    Voltar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* CASE 2: FRESH MATCH (CAN BE DELETED) */
                              <div className="space-y-3">
                                <p className="text-zinc-350 leading-relaxed text-[11px]">
                                  {item.hasPresences ? (
                                    <span>Esta partida possui <span className="text-amber-500 font-bold">respostas de presença registradas</span>, mas como <span className="text-emerald-450 font-bold">não teve sorteio realizado</span>, ela pode ser excluída permanentemente. As confirmações dos atletas serão apagadas junto com a partida.</span>
                                  ) : (
                                    <span>Esta partida está vazia (sem presenças cadastradas, sorteios ou resultados) e <span className="text-emerald-450 font-bold">pode ser excluída permanentemente</span> do racha.</span>
                                  )}
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
                                    className="bg-zinc-900 hover:bg-zinc-800 text-zinc-350 px-4 py-2 rounded text-[11px] font-bold transition cursor-pointer"
                                  >
                                    Não, Voltar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-zinc-900 pt-6 mt-6 gap-4">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      Página <strong className="text-zinc-300 font-extrabold">{safeCurrentPage}</strong> de <strong className="text-zinc-300 font-extrabold">{totalPages}</strong> ({sortedMatches.length} rodadas)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safeCurrentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-mono disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
                            safeCurrentPage === page
                              ? 'bg-emerald-650/15 border-emerald-500/30 text-emerald-400'
                              : 'border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-900'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className="px-3 py-1.5 rounded-lg border border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-900 text-xs font-mono disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
              O {appName} estabelece prioridades claras: os mensalistas possuem vaga garantida. Os reservas ocupam vagas extras ou cobrem faltas. No cancelamento pós-confirmação, o sistema sugere primeiro o reserva no topo desta fila!
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

// =========================================================================
// --- SPRINT 3.1: DETAILED TAB SUB-COMPONENTS FOR ACCORDION DETAIL WORK ---
// =========================================================================

function DetailPresences({ matchId, players }: { matchId: string; players: Player[] }) {
  const [data, setData] = useState<{ match: any; presences: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authFetch(`/api/matches/${matchId}/presences`)
      .then(res => res.json())
      .then(resData => {
        if (active) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [matchId]);

  if (loading) {
    return <div className="text-zinc-500 text-[11px] font-mono animate-pulse py-4 text-center">Buscando presença dos atletas...</div>;
  }

  if (!data || !data.presences || data.presences.length === 0) {
    return <div className="text-zinc-500 text-[11px] font-mono py-4 text-center">Nenhuma presença confirmada para esta rodada.</div>;
  }

  const confirmed = data.presences.filter(p => p.status === 'confirmado');
  const waiting = data.presences.filter(p => p.status === 'espera');
  const refused = data.presences.filter(p => p.status === 'recusado' || p.status === 'desistente');

  return (
    <div className="space-y-4 font-sans text-xs">
      {confirmed.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-zinc-400 uppercase font-black tracking-wider block">🟢 Confirmados ({confirmed.length})</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {confirmed.map(p => (
              <div key={p.playerId} className="bg-zinc-950/60 border border-zinc-900 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <span className="font-semibold text-white truncate">{p.playerName}</span>
                <span className="text-[8px] font-mono text-zinc-500 uppercase ml-2">{p.playerStatus === 'mensalista' ? 'Mens' : 'Diar'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {waiting.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-amber-400 uppercase font-black tracking-wider block">🟡 Lista de Espera ({waiting.length})</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {waiting.map(p => (
              <div key={p.playerId} className="bg-zinc-950/60 border border-amber-500/10 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <span className="font-semibold text-white truncate">{p.playerName}</span>
                <span className="text-[9px] font-mono text-amber-500 font-extrabold ml-2">#{p.priorityOrder || 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {refused.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase font-black tracking-wider block">❌ Recusados / Ausentes ({refused.length})</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {refused.map(p => (
              <div key={p.playerId} className="bg-zinc-950/40 border border-zinc-950 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                <span className="text-zinc-500 truncate">{p.playerName}</span>
                <span className="text-[8px] font-mono text-zinc-600 uppercase ml-2">Ausente</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailTeams({ matchId, players }: { matchId: string; players: Player[] }) {
  const [draw, setDraw] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authFetch(`/api/matches/${matchId}/draw`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(resData => {
        if (active) {
          setDraw(resData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setDraw(null);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [matchId]);

  if (loading) {
    return <div className="text-zinc-500 text-[11px] font-mono animate-pulse py-4 text-center">Buscando equipes sorteadas...</div>;
  }

  if (!draw || !draw.teams || draw.teams.length === 0) {
    return (
      <div className="text-zinc-500 text-[11px] font-mono py-4 text-center">
        🎲 Sorteio de equipes ainda não realizado para esta rodada. 
        <div className="text-[9.5px] mt-1 text-zinc-600">
          Você pode realizar o sorteio no painel principal quando as confirmações estiverem fechadas.
        </div>
      </div>
    );
  }

  const getPlayerName = (id: string) => {
    const p = players.find(x => x.id === id);
    return p ? p.name : 'Atleta Desconhecido';
  };

  const getPlayerOVR = (id: string) => {
    const p = players.find(x => x.id === id);
    return p ? (p as any).ovr || (p as any).overall || 60 : 60;
  };

  const getPlayerPosition = (id: string) => {
    const p = players.find(x => x.id === id);
    if (!p) return 'LIN';
    if (p.primaryPosition === 'goleiro') return 'GOL';
    if (p.primaryPosition === 'zagueiro' || p.primaryPosition === 'volante') return 'DEF';
    if (p.primaryPosition === 'meio_campo') return 'MEI';
    return 'ATA';
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {draw.teams.map((team: any) => {
          const isBlue = team.name === 'Azul';
          const isRed = team.name === 'Vermelho';
          const title = isBlue ? '🔵 Equipe A (Azul)' : isRed ? '🔴 Equipe B (Vermelho)' : '🟢 Equipe C (Verde)';
          const bgHeader = isBlue ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : isRed ? 'bg-rose-600/10 border-rose-500/20 text-rose-400' : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400';
          const overall = isBlue ? draw.overallBlue : isRed ? draw.overallRed : draw.overallGreen;

          return (
            <div key={team.name} className="bg-zinc-950/40 border border-zinc-900 rounded-xl overflow-hidden">
              <div className={`px-3 py-2 border-b flex items-center justify-between font-bold ${bgHeader}`}>
                <span>{title}</span>
                {overall && <span className="text-[10px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-white border border-zinc-850">OVR {Math.round(overall)}</span>}
              </div>
              <div className="p-2.5 space-y-1.5">
                {team.playerIds.map((pid: string) => {
                  const isCaptain = team.captainPlayerId === pid;
                  return (
                    <div key={pid} className="flex items-center justify-between bg-zinc-950/80 px-2 py-1 rounded border border-zinc-900/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[8px] px-1 bg-zinc-900 rounded text-zinc-400 font-mono font-bold uppercase">{getPlayerPosition(pid)}</span>
                        <span className="font-semibold text-white truncate text-[11px]">{getPlayerName(pid)}</span>
                        {isCaptain && <span className="text-[8.5px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1 py-0.2 rounded font-mono font-bold leading-none scale-90">CAP</span>}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">★{getPlayerOVR(pid)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailResult({ matchId, matchResult }: { matchId: string; matchResult: any }) {
  if (!matchResult) {
    return (
      <div className="text-zinc-500 text-[11px] font-mono py-4 text-center">
        🏆 O placar final e resultado da rodada ainda não foram gravados.
        <div className="text-[9.5px] mt-1 text-zinc-600">
          As rodadas encerradas mostram o placar consolidado aqui após o fechamento técnico.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-xs">
      <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-4 max-w-md mx-auto space-y-3">
        <span className="text-[10px] font-mono text-zinc-500 uppercase font-black block tracking-wider text-center border-b border-zinc-900 pb-2">📊 Resultado Oficial</span>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-blue-950/20 border border-blue-500/10 px-3 py-2 rounded-lg">
            <span className="font-semibold text-blue-400">🔵 Equipe A</span>
            <span className="font-mono font-extrabold text-white text-sm">{matchResult.winsBlue} vitórias</span>
          </div>
          <div className="flex items-center justify-between bg-rose-950/20 border border-rose-500/10 px-3 py-2 rounded-lg">
            <span className="font-semibold text-rose-400">🔴 Equipe B</span>
            <span className="font-mono font-extrabold text-white text-sm">{matchResult.winsRed} vitórias</span>
          </div>
          <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-500/10 px-3 py-2 rounded-lg">
            <span className="font-semibold text-emerald-400">🟢 Equipe C</span>
            <span className="font-mono font-extrabold text-white text-sm">{matchResult.winsGreen} vitórias</span>
          </div>
        </div>
        <div className="pt-2 border-t border-zinc-900 text-center">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl text-emerald-400 font-bold font-mono">
            <span>🏆 Campeã:</span>
            <span>{matchResult.champions.map((c: string) => c === 'Azul' ? 'Equipe A' : c === 'Vermelho' ? 'Equipe B' : 'Equipe C').join(' + ')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRatings({ matchId, players }: { matchId: string; players: Player[] }) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authFetch('/api/evaluations/summary')
      .then(res => res.json())
      .then(resData => {
        if (active) {
          setSummaries(resData || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="text-zinc-500 text-[11px] font-mono animate-pulse py-4 text-center">Buscando avaliações dos atletas...</div>;
  }

  if (summaries.length === 0) {
    return <div className="text-zinc-500 text-[11px] font-mono py-4 text-center">Nenhuma avaliação registrada ainda.</div>;
  }

  const sorted = [...summaries]
    .filter(s => players.some(p => p.id === s.playerId))
    .sort((a, b) => (b.overall || 0) - (a.overall || 0))
    .slice(0, 6);

  return (
    <div className="space-y-3 font-sans text-xs">
      <span className="text-[10px] font-mono text-zinc-400 uppercase font-black block mb-1">⭐ Top Atletas & Desempenho Técnico</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sorted.map(s => {
          const p = players.find(x => x.id === s.playerId);
          if (!p) return null;
          return (
            <div key={s.playerId} className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="block font-bold text-white truncate">{p.name}</span>
                <span className="block text-[9px] font-mono text-zinc-500 uppercase mt-0.5">{p.primaryPosition} • {p.status}</span>
              </div>
              <div className="text-right font-mono">
                <span className="block text-emerald-400 font-extrabold text-xs">★{(s.overall ?? 0).toFixed(1)}</span>
                <span className="block text-[8px] text-zinc-500">Votos: {s.evalCount ?? 0}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailMuseum({ matchId, muralPosts }: { matchId: string; muralPosts: any[] }) {
  const matchMedias = muralPosts.filter(p => p.matchId === matchId && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted);

  if (matchMedias.length === 0) {
    return (
      <div className="text-zinc-500 text-[11px] font-mono py-4 text-center">
        🖼️ Nenhum registro visual ou memória guardada para esta rodada.
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-xs">
      <span className="text-[10px] font-mono text-zinc-400 uppercase font-black block mb-1">🖼️ Memórias do Museu ({matchMedias.length})</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matchMedias.map((post: any) => (
          <div key={post.id} className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden flex flex-col justify-between">
            {post.mediaUrl && (
              <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                <img
                  src={post.mediaUrl}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
              <div>
                <h5 className="font-bold text-white text-xs line-clamp-1">{post.title}</h5>
                <p className="text-zinc-400 text-[11px] line-clamp-2 leading-relaxed mt-1">{post.description || 'Sem descrição.'}</p>
              </div>
              <div className="pt-2 border-t border-zinc-900/60 flex items-center justify-between text-[9px] font-mono text-zinc-500">
                <span>Por: {post.authorName}</span>
                <span>{new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

