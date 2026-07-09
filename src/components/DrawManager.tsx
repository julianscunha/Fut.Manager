import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { Match, Player, DrawTeam, TeamDraw } from '../types';
import { 
  Users, 
  Calendar, 
  Sparkles, 
  Share2, 
  CheckCircle2, 
  Copy, 
  RefreshCw, 
  ArrowLeftRight, 
  Crown, 
  ShieldAlert, 
  UserPlus, 
  MapPin, 
  TrendingUp, 
  AlertTriangle,
  Lock,
  Unlock,
  Check
} from 'lucide-react';

interface DrawManagerProps {
  currentUser: { id: string; name: string; role: 'admin' | 'auxiliar' | 'jogador' };
}

const POS_SQUAD_ORDER: Record<string, number> = {
  goleiro: 1,
  zagueiro: 2,
  meio_campo: 3,
  volante: 4,
  atacante: 5,
};

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

export function computeTacticalAssignments(players: Player[]): Record<string, { position: string; isAdapted: boolean }> {
  const positions = ['goleiro', 'zagueiro', 'meio_campo', 'volante', 'atacante'];
  const bestAssignment: Record<string, string> = {};
  let bestScore = -Infinity;

  function backtrack(playerIndex: number, currentAssigned: Record<string, string>, usedPositionsCount: Record<string, number>) {
    if (playerIndex === players.length) {
      let score = 0;
      const uniquePositions = new Set<string>();

      for (const p of players) {
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
        for (const p of players) {
          bestAssignment[p.id] = currentAssigned[p.id];
        }
      }
      return;
    }

    const player = players[playerIndex];
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

  if (players.length > 0) {
    backtrack(0, {}, {});
  }

  const result: Record<string, { position: string; isAdapted: boolean }> = {};
  for (const p of players) {
    const pos = bestAssignment[p.id] || p.primaryPosition;
    result[p.id] = {
      position: pos,
      isAdapted: pos !== p.primaryPosition
    };
  }
  return result;
}

export default function DrawManager({ currentUser }: DrawManagerProps) {
  const isEditor = currentUser.role === 'admin' || currentUser.role === 'auxiliar';

  // State
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [confirmedPlayers, setConfirmedPlayers] = useState<Player[]>([]);
  const [playerOveralls, setPlayerOveralls] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sorting state for left sidebar
  const [orderingMode, setOrderingMode] = useState<'posicao' | 'confirmacao' | 'nome'>('posicao');
  const [confirmedPresenceOrder, setConfirmedPresenceOrder] = useState<string[]>([]);

  // Draw config state
  const [captainsConfigured, setCaptainsConfigured] = useState(false);
  const [captains, setCaptains] = useState<Record<string, string>>({ Azul: '', Vermelho: '', Verde: '' });
  const [isSharedGoalkeepers, setIsSharedGoalkeepers] = useState(false);

  // Active Draw state
  const [activeDraw, setActiveDraw] = useState<TeamDraw | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Moving state for manual swaps
  const [selectedPlayerToMove, setSelectedPlayerToMove] = useState<{ playerId: string; currentTeam: string } | null>(null);

  // Helper to sort a list of players based on current sidebar ordering settings
  const sortPlayersBySelectedOrdering = (list: Player[]) => {
    return [...list].sort((a, b) => {
      if (orderingMode === 'posicao') {
        const POSITION_ORDER: Record<string, number> = {
          goleiro: 1,
          zagueiro: 2,
          meio_campo: 3,
          volante: 4,
          atacante: 5,
        };
        const orderA = POSITION_ORDER[a.primaryPosition] || 99;
        const orderB = POSITION_ORDER[b.primaryPosition] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      } else if (orderingMode === 'confirmacao') {
        const idxA = confirmedPresenceOrder.indexOf(a.id);
        const idxB = confirmedPresenceOrder.indexOf(b.id);
        return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
      } else {
        return a.name.localeCompare(b.name);
      }
    });
  };

  // Load matches on start
  useEffect(() => {
    fetchMatches();

    const handleStatusRefresh = () => {
      fetchMatches();
    };
    window.addEventListener('match-status-changed', handleStatusRefresh);
    window.addEventListener('set-active-tab', handleStatusRefresh);
    return () => {
      window.removeEventListener('match-status-changed', handleStatusRefresh);
      window.removeEventListener('set-active-tab', handleStatusRefresh);
    };
  }, []);

  // Fetch verified player ratings & overalls when match is selected
  useEffect(() => {
    if (selectedMatch) {
      if (selectedMatch.status === 'cancelada' || selectedMatch.status === 'encerrada') {
        setConfirmedPlayers([]);
        setActiveDraw(null);
        setCaptainsConfigured(false);
        setCaptains({ Azul: '', Vermelho: '', Verde: '' });
        setIsSharedGoalkeepers(false);
      } else {
        fetchConfirmedPlayers(selectedMatch.id);
        fetchActiveDraw(selectedMatch.id);
      }
    } else {
      setConfirmedPlayers([]);
      setActiveDraw(null);
    }
  }, [selectedMatch]);

  // Auto-hide success or balanced banner messages after 6 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/matches');
      if (res.ok) {
        const data = await res.json();
        // Sort matches starting with nearest date
        const sorted = data.sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setMatches(sorted);
        // Default to active match
        const active = sorted.find((m: Match) => ['confirmando', 'aguardando_reservas', 'fechada', 'sorteada', 'agendada'].includes(m.status));
        if (active) {
          setSelectedMatch(active);
        } else if (sorted.length > 0) {
          setSelectedMatch(sorted[0]);
        }
      }
    } catch (err) {
      setErrorMsg('Falha ao sincronizar agenda de partidas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfirmedPlayers = async (matchId: string) => {
    try {
      setErrorMsg('');
      // Get presences and compute overalls
      const presRes = await authFetch(`/api/matches/${matchId}/presences`);
      const playersRes = await authFetch('/api/players');
      const ratingsRes = await authFetch('/api/evaluations/summary');

      if (presRes.ok && playersRes.ok && ratingsRes.ok) {
        const presData = await presRes.json();
        const playersList = await playersRes.json();
        const ratingsSummary = await ratingsRes.json();

        // Map rating summaries
        const ratingsMap: Record<string, number> = {};
        ratingsSummary.forEach((r: any) => {
          ratingsMap[r.playerId] = r.overall;
        });
        setPlayerOveralls(ratingsMap);

        // Filter only confirmed status
        const presList = presData.presences || [];
        const confirmedIds: string[] = presList
          .filter((p: any) => p.presenceStatus === 'confirmado')
          .map((p: any) => p.playerId);

        const filtered = playersList.filter((p: Player) => confirmedIds.includes(p.id));
        setConfirmedPlayers(filtered);
        setConfirmedPresenceOrder(confirmedIds);
      }
    } catch (err) {
      setErrorMsg('Falha ao carregar lista de atletas confirmados.');
    }
  };

  const fetchActiveDraw = async (matchId: string) => {
    try {
      const res = await authFetch(`/api/matches/${matchId}/draw`);
      if (res.ok) {
        const draw = await res.json();
        setActiveDraw(draw);
        setCaptainsConfigured(draw.captainsConfigured);
        setIsSharedGoalkeepers(draw.isSharedGoalkeepers);
        
        // Populate captains
        const caps: Record<string, string> = { Azul: '', Vermelho: '', Verde: '' };
        draw.teams.forEach((t: DrawTeam) => {
          if (t.captainPlayerId) {
            caps[t.name] = t.captainPlayerId;
          }
        });
        setCaptains(caps);
      } else {
        setActiveDraw(null);
      }
    } catch (err) {
      setActiveDraw(null);
    }
  };

  const handleGenerateDraw = async () => {
    if (!selectedMatch) return;
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await authFetch(`/api/matches/${selectedMatch.id}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainsConfigured,
          captains,
          isSharedGoalkeepers
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao sortear times.');
      }

      const draw = await res.json();
      setActiveDraw(draw);
      setSuccessMsg('Times balanceados com inteligência! Ajuste ou compartilhe.');
      setSelectedPlayerToMove(null);
      if (selectedMatch) {
        setSelectedMatch({ ...selectedMatch, status: 'sorteada' });
        setMatches(prev => prev.map(m => m.id === selectedMatch.id ? { ...m, status: 'sorteada' } : m));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar balanceamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCaptain = async (playerId: string, teamName: 'Azul' | 'Vermelho' | 'Verde') => {
    if (!activeDraw) return;
    try {
      setErrorMsg('');
      const updatedTeams = activeDraw.teams.map((t) => {
        if (t.name === teamName) {
          // If this player is already captain, remove them. Otherwise, set them as captain of this team!
          return {
            ...t,
            captainPlayerId: t.captainPlayerId === playerId ? undefined : playerId
          };
        }
        // If this player is being made captain of this team, make sure they are not captain of another team
        let capId = t.captainPlayerId;
        if (capId === playerId) {
          capId = undefined;
        }
        return {
          ...t,
          captainPlayerId: capId
        };
      });

      const res = await authFetch(`/api/draws/${activeDraw.id}/update-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeams })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao atualizar capitão.');
      }

      const updatedDraw = await res.json();
      setActiveDraw(updatedDraw);

      // Notify or update captains state
      const caps: Record<string, string> = { Azul: '', Vermelho: '', Verde: '' };
      updatedDraw.teams.forEach((t: any) => {
        if (t.captainPlayerId) {
          caps[t.name] = t.captainPlayerId;
        }
      });
      setCaptains(caps);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao definir capitão.');
    }
  };

  const handleMovePlayer = async (playerId: string, targetTeamName: 'Azul' | 'Vermelho' | 'Verde') => {
    if (!activeDraw) return;

    try {
      setErrorMsg('');
      // Build updated list of team configurations
      const updatedTeams = activeDraw.teams.map((t) => {
        // Remove player if present
        let pids = t.playerIds.filter((id) => id !== playerId);

        // Add player if selected target
        if (t.name === targetTeamName) {
          pids = [...pids, playerId];
        }

        // Handle structural captain adjustments
        let capId = t.captainPlayerId;
        if (t.name === targetTeamName && captainsConfigured) {
          // If moving a captain, we could preserve it
          const capForT = captains[t.name];
          capId = capForT === playerId ? playerId : undefined;
        } else if (capId === playerId) {
          capId = undefined; // unset previous captaincy
        }

        return {
          ...t,
          captainPlayerId: capId,
          playerIds: pids
        };
      });

      const res = await authFetch(`/api/draws/${activeDraw.id}/update-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeams })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao rebalancear times.');
      }

      const updatedDraw = await res.json();
      setActiveDraw(updatedDraw);
      setSelectedPlayerToMove(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar rebalanceamento manual.');
    }
  };

  const handleLockDraw = async () => {
    if (!activeDraw) return;
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await authFetch(`/api/draws/${activeDraw.id}/confirm-lock`, {
        method: 'POST'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao fechar racha.');
      }

      setSuccessMsg('Sorteio consolidado com sucesso! Afinidade de parcerias acumulada.');
      setIsLocked(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao consolidar sorteio.');
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting to extract names
  const getPlayerName = (pid: string) => {
    const p = confirmedPlayers.find((x) => x.id === pid);
    return p ? p.name : 'Jogador Desconhecido';
  };

  const getPlayerObj = (pid: string) => {
    return confirmedPlayers.find((x) => x.id === pid);
  };

  const getSortedTeamPlayers = (playerIds: string[], teamName: string, captainPlayerId?: string) => {
    const teamPlayers = playerIds
      .map(pid => getPlayerObj(pid))
      .filter((p): p is Player => !!p);

    const tacticalAssignments = computeTacticalAssignments(teamPlayers);

    return [...teamPlayers].sort((a, b) => {
      const posA = tacticalAssignments[a.id]?.position || 'atacante';
      const posB = tacticalAssignments[b.id]?.position || 'atacante';

      const POS_ORDER: Record<string, number> = {
        goleiro: 1,
        zagueiro: 2,
        volante: 3,
        meio_campo: 4,
        atacante: 5,
      };

      const valA = POS_ORDER[posA] || 99;
      const valB = POS_ORDER[posB] || 99;

      if (valA !== valB) return valA - valB;

      return a.name.localeCompare(b.name);
    });
  };

  // Prepare standard WhatsApp message
  const getShareMessage = () => {
    if (!activeDraw || !selectedMatch) return '';

    const formatDate = (d: string) => {
      const parts = d.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    let text = `⚽ RACHA DO FOFIM - ESCALAÇÃO OFICIAL ⚽\n\n`;
    text += `📅 Data: ${formatDate(selectedMatch.date)} às ${selectedMatch.time}\n`;
    text += `📍 Local: ${selectedMatch.location}\n\n`;
    text += `Diferença Técnica: ${activeDraw.maxDifference.toFixed(1)}\n\n`;

    activeDraw.teams.forEach((t) => {
      const teamOverall = t.name === 'Azul' ? activeDraw.overallBlue : t.name === 'Vermelho' ? activeDraw.overallRed : activeDraw.overallGreen;
      // Use color circle depending on team name
      const colorIcon = t.name === 'Azul' ? '🔵' : t.name === 'Vermelho' ? '🔴' : '🟢';
      const displayLabel = t.name === 'Azul' ? 'EQUIPE A' : t.name === 'Vermelho' ? 'EQUIPE B' : 'EQUIPE C';
      text += `${colorIcon} ${displayLabel} (Média ${teamOverall.toFixed(1)})\n`;
      
      const sortedTeamPlayers = getSortedTeamPlayers(t.playerIds, t.name, t.captainPlayerId);
      const teamPlayers = t.playerIds.map(pid => getPlayerObj(pid)).filter((p): p is Player => !!p);
      const tacticalAssignments = computeTacticalAssignments(teamPlayers);

      sortedTeamPlayers.forEach((p) => {
        const isCap = captainsConfigured && (t.captainPlayerId === p.id || captains[t.name] === p.id);
        const assignment = tacticalAssignments[p.id] || { position: p.primaryPosition, isAdapted: false };
        const labelPos = getAbbreviation(assignment.position);
        const isAdapted = assignment.isAdapted;
        const points = playerOveralls[p.id] ? playerOveralls[p.id].toFixed(1) : '3.5';
        
        const prefix = isCap ? '(C) ' : '';
        const adaptSuffix = isAdapted ? ' (Adaptado)' : '';
        text += `${prefix}${p.name} - ${labelPos}${adaptSuffix} ⭐ ${points}\n`;
      });
      text += `\n`;
    });

    text += `Chegue com 15 minutos de antecedência.`;
    return text;
  };

  const handleCopyToClipboard = async () => {
    const msg = getShareMessage();
    if (!msg) return;
    try {
      await navigator.clipboard.writeText(msg);
      console.log("Escalação enviada ao clipboard:", msg);
      setSuccessMsg('Escalação copiada para a área de transferência! Envie no WhatsApp.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg('Falha ao copiar escalação.');
    }
  };

  const handleShareWhatsApp = () => {
    const msg = getShareMessage();
    if (!msg) return;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Helper category display
  const getPositionBadgeColor = (pos: string) => {
    switch (pos) {
      case 'goleiro': return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      case 'zagueiro': return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400';
      case 'volante': return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'meio_campo': return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
      case 'atacante': return 'bg-rose-500/15 border-rose-500/30 text-rose-400';
      default: return 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400';
    }
  };

  const getPositionLabel = (pos: string) => {
    switch (pos) {
      case 'goleiro': return 'Goleiro';
      case 'zagueiro': return 'Zagueiro';
      case 'volante': return 'Volante';
      case 'meio_campo': return 'Meio Campo';
      case 'atacante': return 'Atacante';
      default: return pos;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and selection */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="font-display font-extrabold text-2xl text-white">Sorteio de Times</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Monte times equilibrados baseados no histórico, posição e nota técnica.</p>
        </div>

        {/* Selected match drop-down */}
        <div className="flex items-center gap-2 bg-[#111815] px-3 py-2 border border-zinc-850 rounded-xl w-full md:w-auto">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-zinc-400">Racha:</span>
          <select
            value={selectedMatch?.id || ''}
            onChange={(e) => {
              const m = matches.find((x) => x.id === e.target.value);
              if (m) setSelectedMatch(m);
            }}
            className="bg-transparent text-xs text-white p-1 hover:text-emerald-400 cursor-pointer focus:outline-none"
          >
            {matches.map((m) => {
              const formattedDate = m.date.split('-').reverse().join('/');
              return (
                <option key={m.id} value={m.id} className="bg-zinc-950 text-white">
                  {formattedDate} • {m.location.split('(')[0]}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Internal Alerts */}
      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-rose-450 hover:text-rose-300 p-1 rounded-lg focus:outline-none transition cursor-pointer font-black text-sm"
            title="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-emerald-400 hover:text-emerald-300 p-1 rounded-lg focus:outline-none transition cursor-pointer font-black"
            title="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main split work-layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Setup config if there's no active draw or if editing */}
        <div className="lg:col-span-4 space-y-5 bg-[#0f1613] p-4 rounded-xl border border-zinc-850">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-2 mb-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-white">Atletas Confirmados ({confirmedPlayers.length})</h3>
          </div>

          {confirmedPlayers.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900">
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Ordenação da Lista</label>
              <select
                value={orderingMode}
                onChange={(e) => setOrderingMode(e.target.value as any)}
                className="w-full bg-zinc-950 text-xs text-white p-2 rounded-lg border border-zinc-850 focus:outline-none focus:border-emerald-500 cursor-pointer text-zinc-300 font-sans"
              >
                <option value="posicao">Por posição (padrão)</option>
                <option value="confirmacao">Por ordem de confirmação</option>
                <option value="nome">Por nome</option>
              </select>
            </div>
          )}

          {confirmedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-zinc-500 font-mono">Nenhum jogador confirmado para este racha.</p>
              <p className="text-[10px] text-zinc-600 mt-1">Sorteios exigem pelo menos um jogador do grupo confirmado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {sortPlayersBySelectedOrdering(confirmedPlayers)
                .map((p) => {
                  const overall = playerOveralls[p.id] ? playerOveralls[p.id].toFixed(1) : '3.5';
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/50 border border-zinc-900 text-xs">
                      <div className="flex items-center gap-2">
                        <img 
                          src={p.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=50'} 
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover" 
                        />
                        <div>
                          <p className="font-bold text-white line-clamp-1">{p.name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getPositionBadgeColor(p.primaryPosition)}`}>
                            {getPositionLabel(p.primaryPosition)}
                          </span>
                        </div>
                      </div>
                      {/* Performance points bubble */}
                      <span className="font-extrabold text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
                        ⭐ {overall}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Draw Strategy Settings */}
          {isEditor && selectedMatch?.status !== 'cancelada' && (
            <div className="pt-4 border-t border-zinc-850 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Definir Capitães (Opcional)</span>
                <input
                  type="checkbox"
                  checked={captainsConfigured}
                  disabled={selectedMatch?.status === 'sorteada' && (!activeDraw || (activeDraw.redrawCount || 0) >= 2)}
                  onChange={(e) => setCaptainsConfigured(e.target.checked)}
                  className="accent-emerald-500 h-3.5 w-3.5"
                />
              </div>

              {captainsConfigured && (
                <div className="space-y-2 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-900">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-black block">CAPITÃO AZUL</label>
                    <select
                      value={captains.Azul || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        if (hasFreeRedraws) {
                          setCaptains(prev => ({ ...prev, Azul: val }));
                          const teamPlayerIds = activeDraw.teams.find(t => t.name === 'Azul')?.playerIds || [];
                          if (val === '' || teamPlayerIds.includes(val)) {
                            handleToggleCaptain(val, 'Azul');
                          }
                        } else if (activeDraw) {
                          handleToggleCaptain(val, 'Azul');
                        } else {
                          setCaptains({ ...captains, Azul: val });
                        }
                      }}
                      className="w-full bg-zinc-950 text-xs text-white p-2 rounded border border-zinc-850"
                    >
                      <option value="">Selecione...</option>
                      {(() => {
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        const teamPlayerIds = !hasFreeRedraws ? activeDraw?.teams.find(t => t.name === 'Azul')?.playerIds : null;
                        const playersList = teamPlayerIds
                          ? confirmedPlayers.filter(p => teamPlayerIds.includes(p.id))
                          : confirmedPlayers;
                        const sortedList = sortPlayersBySelectedOrdering(playersList);
                        return sortedList.map(p => {
                          const isSelectedOther = captains.Vermelho === p.id ? 'Vermelho' : captains.Verde === p.id ? 'Verde' : null;
                          if (isSelectedOther) {
                            return (
                              <option key={p.id} value={p.id} disabled>
                                🔒 {p.name} (já definido como Capitão {isSelectedOther})
                              </option>
                            );
                          }
                          return <option key={p.id} value={p.id}>{p.name}</option>;
                        });
                      })()}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-black block">CAPITÃO VERMELHO</label>
                    <select
                      value={captains.Vermelho || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        if (hasFreeRedraws) {
                          setCaptains(prev => ({ ...prev, Vermelho: val }));
                          const teamPlayerIds = activeDraw.teams.find(t => t.name === 'Vermelho')?.playerIds || [];
                          if (val === '' || teamPlayerIds.includes(val)) {
                            handleToggleCaptain(val, 'Vermelho');
                          }
                        } else if (activeDraw) {
                          handleToggleCaptain(val, 'Vermelho');
                        } else {
                          setCaptains({ ...captains, Vermelho: val });
                        }
                      }}
                      className="w-full bg-zinc-950 text-xs text-white p-2 rounded border border-zinc-850"
                    >
                      <option value="">Selecione...</option>
                      {(() => {
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        const teamPlayerIds = !hasFreeRedraws ? activeDraw?.teams.find(t => t.name === 'Vermelho')?.playerIds : null;
                        const playersList = teamPlayerIds
                          ? confirmedPlayers.filter(p => teamPlayerIds.includes(p.id))
                          : confirmedPlayers;
                        const sortedList = sortPlayersBySelectedOrdering(playersList);
                        return sortedList.map(p => {
                          const isSelectedOther = captains.Azul === p.id ? 'Azul' : captains.Verde === p.id ? 'Verde' : null;
                          if (isSelectedOther) {
                            return (
                              <option key={p.id} value={p.id} disabled>
                                🔒 {p.name} (já definido como Capitão {isSelectedOther})
                              </option>
                            );
                          }
                          return <option key={p.id} value={p.id}>{p.name}</option>;
                        });
                      })()}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 font-black block">CAPITÃO VERDE</label>
                    <select
                      value={captains.Verde || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        if (hasFreeRedraws) {
                          setCaptains(prev => ({ ...prev, Verde: val }));
                          const teamPlayerIds = activeDraw.teams.find(t => t.name === 'Verde')?.playerIds || [];
                          if (val === '' || teamPlayerIds.includes(val)) {
                            handleToggleCaptain(val, 'Verde');
                          }
                        } else if (activeDraw) {
                          handleToggleCaptain(val, 'Verde');
                        } else {
                          setCaptains({ ...captains, Verde: val });
                        }
                      }}
                      className="w-full bg-zinc-950 text-xs text-white p-2 rounded border border-zinc-850"
                    >
                      <option value="">Selecione...</option>
                      {(() => {
                        const hasFreeRedraws = selectedMatch?.status === 'sorteada' && activeDraw && (activeDraw.redrawCount || 0) < 2;
                        const teamPlayerIds = !hasFreeRedraws ? activeDraw?.teams.find(t => t.name === 'Verde')?.playerIds : null;
                        const playersList = teamPlayerIds
                          ? confirmedPlayers.filter(p => teamPlayerIds.includes(p.id))
                          : confirmedPlayers;
                        const sortedList = sortPlayersBySelectedOrdering(playersList);
                        return sortedList.map(p => {
                          const isSelectedOther = captains.Azul === p.id ? 'Azul' : captains.Vermelho === p.id ? 'Vermelho' : null;
                          if (isSelectedOther) {
                            return (
                              <option key={p.id} value={p.id} disabled>
                                🔒 {p.name} (já definido como Capitão {isSelectedOther})
                              </option>
                            );
                          }
                          return <option key={p.id} value={p.id}>{p.name}</option>;
                        });
                      })()}
                    </select>
                  </div>
                </div>
              )}

              {/* Shared goalkeepers setting */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-400">Goleiros Compartilhados</span>
                  <span className="text-[9px] text-zinc-650">Os dois goleiros jogam por todos os três times</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSharedGoalkeepers}
                  disabled={selectedMatch?.status === 'sorteada' && (!activeDraw || (activeDraw.redrawCount || 0) >= 2)}
                  onChange={(e) => setIsSharedGoalkeepers(e.target.checked)}
                  className="accent-emerald-500 h-3.5 w-3.5"
                />
              </div>

              {activeDraw && (
                <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-900 flex flex-col gap-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Re-sorteios utilizados:</span>
                    <span className={`font-bold ${activeDraw.redrawCount && activeDraw.redrawCount >= 2 ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}`}>
                      {activeDraw.redrawCount || 0} / 2
                    </span>
                  </div>
                  {activeDraw.redrawCount && activeDraw.redrawCount >= 2 && (
                    <p className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded leading-relaxed text-center mt-1">
                      ⚠️ O limite de 2 re-sorteios para esta partida foi atingido para garantir a governança e transparência do sorteio.
                    </p>
                  )}
                </div>
              )}

              {/* Action Button */}
              {selectedMatch?.status === 'sorteada' && activeDraw && activeDraw.redrawCount !== undefined && activeDraw.redrawCount >= 2 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10.5px] rounded-lg leading-relaxed text-center font-mono">
                  🔒 O sorteio oficial está ativo! Apenas trocas manuais de jogadores e alteração de capitães são permitidas. Re-sorteios estão desativados para preservar a governança.
                </div>
              ) : (selectedMatch?.lifecycleState === 'CHECKIN_CLOSED' || selectedMatch?.status === 'fechada' || selectedMatch?.lifecycleState === 'DRAW_COMPLETED' || selectedMatch?.status === 'sorteada') ? (
                <button
                  type="button"
                  onClick={handleGenerateDraw}
                  disabled={loading || confirmedPlayers.length === 0 || selectedMatch?.status === 'cancelada' || (activeDraw && activeDraw.redrawCount !== undefined && activeDraw.redrawCount >= 2)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-850 disabled:text-zinc-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{activeDraw ? 'Sortear Novamente' : 'Realizar Sorteio'}</span>
                </button>
              ) : (
                <div className="p-3 bg-zinc-900/60 border border-zinc-850 text-zinc-400 text-[10.5px] rounded-lg leading-relaxed text-center font-mono">
                  ⏳ O sorteio estará disponível após o fechamento do check-in de presenças (estado CHECKIN_CLOSED). No momento, as presenças estão sendo confirmadas.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Visualizing teams with responsive metrics */}
        <div className="lg:col-span-8 space-y-6">
          
          {selectedMatch?.status === 'cancelada' ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Alert message indicating that match is cancelled and no draw is available */}
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2.5 font-mono">
                <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 animate-pulse" />
                <span>Esta rodada foi cancelada. Não há sorteio disponível.</span>
              </div>

              {/* Present clean empty squads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Azul', 'Vermelho', 'Verde'].map((teamName) => {
                  const teamColor = teamName === 'Azul' ? 'border-blue-600 bg-blue-950/2' : teamName === 'Vermelho' ? 'border-red-600 bg-red-950/2' : 'border-emerald-600 bg-emerald-950/2';
                  const teamHeaderColor = teamName === 'Azul' ? 'bg-blue-600/10 text-blue-400 border-blue-900/30' : teamName === 'Vermelho' ? 'bg-red-600/10 text-red-400 border-red-900/30' : 'bg-emerald-600/10 text-emerald-400 border-emerald-900/30';
                  
                  return (
                    <div key={teamName} className={`rounded-xl border border-zinc-850 p-3 bg-[#0c120f] flex flex-col justify-between shadow ${teamColor}`}>
                      <div>
                        <div className={`p-2 rounded-lg border flex items-center justify-between mb-3 text-xs font-black ${teamHeaderColor}`}>
                          <span>{teamName === 'Azul' ? 'EQUIPE A' : teamName === 'Vermelho' ? 'EQUIPE B' : 'EQUIPE C'}</span>
                          <span className="font-mono text-[11px]">⭐ 0.0</span>
                        </div>
                        <div className="space-y-1.5 min-h-[140px] flex flex-col items-center justify-center text-zinc-650">
                          <span className="text-[10px] font-mono">Time Vazio</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeDraw ? (
            <div className="space-y-6">
              
              {/* Balance metrics widget bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#111815] p-3 rounded-xl border border-emerald-950/20">
                <div className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-90 w-full text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold font-mono">Diferença Técnica</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <TrendingUp className={`w-4 h-4 ${activeDraw.maxDifference <= 0.4 ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className={`text-lg font-black font-mono ${activeDraw.maxDifference <= 0.4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {activeDraw.maxDifference.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-90 w-full text-center">
                  <span className="text-[10px] text-[#3b82f6] uppercase font-bold font-mono">Overall Equipe A</span>
                  <p className="text-lg font-black text-[#60a5fa] mt-1 font-mono">{activeDraw.overallBlue.toFixed(1)}</p>
                </div>

                <div className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-90 w-full text-center">
                  <span className="text-[10px] text-[#ef4444] uppercase font-bold font-mono">Overall Equipe B</span>
                  <p className="text-lg font-black text-[#f87171] mt-1 font-mono">{activeDraw.overallRed.toFixed(1)}</p>
                </div>

                <div className="p-3 bg-zinc-950/50 rounded-lg border border-zinc-90 w-full text-center">
                  <span className="text-[10px] text-[#22c55e] uppercase font-bold font-mono">Overall Equipe C</span>
                  <p className="text-lg font-black text-[#4ade80] mt-1 font-mono">{activeDraw.overallGreen.toFixed(1)}</p>
                </div>
              </div>

              {/* The three actual squads */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {activeDraw.teams.map((team) => {
                  const teamColor = team.name === 'Azul' ? 'border-blue-600 bg-blue-950/2' : team.name === 'Vermelho' ? 'border-red-600 bg-red-950/2' : 'border-emerald-600 bg-emerald-950/2';
                  const teamHeaderColor = team.name === 'Azul' ? 'bg-blue-600/10 text-blue-400 border-blue-900/30' : team.name === 'Vermelho' ? 'bg-red-600/10 text-red-400 border-red-900/30' : 'bg-emerald-600/10 text-emerald-400 border-emerald-900/30';
                  
                  return (
                    <div key={team.name} className={`rounded-xl border border-zinc-850 p-3 bg-[#0c120f] flex flex-col justify-between shadow ${teamColor}`}>
                      {/* Squad header banner */}
                      <div>
                        <div className={`p-2 rounded-lg border flex items-center justify-between mb-3 text-xs font-black ${teamHeaderColor}`}>
                          <span>{team.name === 'Azul' ? 'EQUIPE A' : team.name === 'Vermelho' ? 'EQUIPE B' : 'EQUIPE C'}</span>
                          <span className="font-mono text-[11px]">
                            ⭐ {team.name === 'Azul' ? activeDraw.overallBlue.toFixed(1) : team.name === 'Vermelho' ? activeDraw.overallRed.toFixed(1) : activeDraw.overallGreen.toFixed(1)}
                          </span>
                        </div>

                        {/* Player lists inside columns */}
                        <div className="space-y-1.5 min-h-[140px]">
                          {(() => {
                            if (team.playerIds.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-8 text-zinc-650">
                                  <span className="text-[10px] font-mono">Time Vazio</span>
                                </div>
                              );
                            }

                            const teamPlayers = team.playerIds
                              .map(pid => getPlayerObj(pid))
                              .filter((p): p is Player => !!p);

                            const tacticalAssignments = computeTacticalAssignments(teamPlayers);

                            const sortedTeamPlayers = getSortedTeamPlayers(team.playerIds, team.name, team.captainPlayerId);

                            return sortedTeamPlayers.map((p) => {
                              const overall = playerOveralls[p.id] ? playerOveralls[p.id].toFixed(1) : '3.5';
                              const isCap = captainsConfigured && (team.captainPlayerId === p.id || captains[team.name] === p.id);
                              
                              const assignment = tacticalAssignments[p.id] || { position: p.primaryPosition, isAdapted: false };
                              const assignedPos = assignment.position;
                              const isAdapted = assignment.isAdapted;

                              return (
                                <div 
                                  key={p.id} 
                                  className={`p-2 rounded-lg text-xs flex items-center justify-between transition relative border ${
                                    isCap 
                                      ? 'border-amber-500/45 bg-gradient-to-r from-amber-500/5 to-transparent shadow-[0_0_8px_rgba(245,158,11,0.06)]' 
                                      : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-800'
                                  } ${
                                    selectedPlayerToMove?.playerId === p.id ? 'ring-1 ring-emerald-500' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <img 
                                      src={p.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=50'} 
                                      referrerPolicy="no-referrer"
                                      className={`w-6.5 h-6.5 rounded-full object-cover border flex-shrink-0 ${
                                        isCap ? 'border-amber-500/40' : 'border-zinc-800'
                                      }`} 
                                    />
                                    <div className="truncate">
                                      <div className="flex items-center gap-1">
                                        <p className="font-bold text-white leading-none truncate max-w-[90px] md:max-w-none">{p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}</p>
                                        {isEditor ? (
                                          <button
                                            onClick={() => handleToggleCaptain(p.id, team.name)}
                                            className="focus:outline-none transition-transform active:scale-95 cursor-pointer ml-1"
                                            title={isCap ? "Remover função de capitão" : "Definir como capitão deste time"}
                                          >
                                            <Crown className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isCap ? 'text-amber-400 fill-amber-400/20' : 'text-zinc-700 hover:text-amber-400/50'}`} />
                                          </button>
                                        ) : (
                                          isCap && <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold leading-none ${getPositionBadgeColor(assignedPos)}`}>
                                          {getAbbreviation(assignedPos)}
                                        </span>
                                        {isAdapted && (
                                          <span className="text-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded font-black font-mono tracking-wider uppercase leading-none">
                                            adaptado
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
 
                                  {/* Right side move button or info */}
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="font-bold text-[10.5px] text-zinc-400">
                                      {overall}
                                    </span>
                                    {isEditor && (
                                      isCap ? (
                                        <div 
                                          className="p-1 text-zinc-600 rounded bg-zinc-950/40 border border-zinc-900/30 cursor-not-allowed"
                                          title="Capitães estão travados no time. Remova a função de capitão para poder movê-lo."
                                        >
                                          <Lock className="w-3 h-3 text-zinc-500" />
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            if (selectedPlayerToMove?.playerId === p.id) {
                                              setSelectedPlayerToMove(null);
                                            } else {
                                              setSelectedPlayerToMove({ playerId: p.id, currentTeam: team.name });
                                            }
                                          }}
                                          className="p-1 text-zinc-500 hover:text-white rounded-md bg-zinc-900 border border-zinc-850 transition cursor-pointer"
                                          title="Mover Jogador"
                                        >
                                          <ArrowLeftRight className="w-3 h-3 text-emerald-500" />
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Display click-move list for mobile efficiency if this team player is active */}
                      {selectedPlayerToMove && selectedPlayerToMove.currentTeam === team.name && (
                        <div className="mt-4 p-2 bg-zinc-950 rounded-lg border border-emerald-950/30 text-[10px] space-y-1.5">
                          <p className="font-bold text-zinc-400">Mudar "{getPlayerName(selectedPlayerToMove.playerId)}" para:</p>
                          <div className="flex gap-2.5">
                            {['Azul', 'Vermelho', 'Verde'].map((tName) => {
                              if (tName === team.name) return null;
                              return (
                                <button
                                  key={tName}
                                  onClick={() => handleMovePlayer(selectedPlayerToMove.playerId, tName as any)}
                                  className="flex-1 py-1 px-2 border border-zinc-800 text-[10px] bg-zinc-900 rounded font-black text-white hover:border-emerald-500 cursor-pointer text-center"
                                >
                                  {tName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer controls: Save / Copy Escalação / WhatsApp Share */}
              <div className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCopyToClipboard}
                  className="flex-1 py-3 px-4 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs rounded-xl border border-zinc-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-emerald-400" />
                  <span>Copiar Escalação</span>
                </button>

                <button
                  onClick={handleShareWhatsApp}
                  className="flex-1 py-3 px-4 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-800/40 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-zinc-950/10 border border-zinc-900 p-8 rounded-2xl text-center space-y-4">
              <Sparkles className="w-12 h-12 text-zinc-700 animate-pulse" />
              <div>
                <h4 className="text-sm font-semibold text-white">Pronto para Sorteio Técnico</h4>
                <p className="text-xs text-zinc-500 max-w-sm mt-1 mx-auto">
                  Monte os melhores times automaticamente! O algoritmo analisa os goleiros, posições e notas de avaliação para evitar distorções de nivelamento técnico.
                </p>
              </div>

              {isEditor ? (
                <button
                  onClick={handleGenerateDraw}
                  disabled={confirmedPlayers.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-black text-white uppercase rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Realizar Sorteio Técnico</span>
                </button>
              ) : (
                <p className="text-[10px] text-zinc-600 italic">Sorteios devem ser acionados por Administradores ou Auxiliares.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
