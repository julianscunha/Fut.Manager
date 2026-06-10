import React, { useState, useEffect } from 'react';
import { Player, User, POSITION_LABELS, FAVORITE_TEAMS } from '../types';
import { 
  Award, Medal, Trophy, Sparkles, RefreshCw, Star, Shield, 
  Users, Users2, Flame, UserCheck, Calendar, Activity, Zap, Compass 
} from 'lucide-react';
import PlayerEvaluationModal from './PlayerEvaluationModal';

interface TechnicalRankingProps {
  players: Player[];
  currentUser: User;
  onEvaluationTrigger?: (player: Player) => void;
}

interface PlayerSummary {
  playerId: string;
  overall: number;
  evalCount: number;
  computedAttributes: Record<string, { average: number, rawCount: number }>;
}

export default function TechnicalRanking({ players, currentUser }: TechnicalRankingProps) {
  // Subtabs: 'overall' | 'racha' | 'hall'
  const [rankingSubTab, setRankingSubTab] = useState<'overall' | 'racha' | 'hall'>('racha');
  
  // Specific Racha Subtab nested view: 'individual' | 'goalkeepers' | 'affinities' | 'streaks'
  const [rachaViewMode, setRachaViewMode] = useState<'individual' | 'goalkeepers' | 'affinities' | 'streaks'>('individual');
  
  // Overall evaluations states
  const [summaries, setSummaries] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluationPlayer, setEvaluationPlayer] = useState<Player | null>(null);
  const [successToast, setSuccessToast] = useState('');

  // Racha statistics states
  const [seasonsList, setSeasonsList] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('active'); // 'active' | 'all' | seasonId
  const [rachaStats, setRachaStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Fetch Evaluations Summary
  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/evaluations/summary');
      if (res.ok) {
        const data = await res.json();
        setSummaries(data);
      }
    } catch (err) {
      console.error('Falha ao baixar ranking técnico', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Seasons and computed match statistics from API
  const fetchRachaStats = async () => {
    setStatsLoading(true);
    try {
      // 1. Fetch seasons if empty
      if (seasonsList.length === 0) {
        const sRes = await fetch('/api/seasons');
        if (sRes.ok) {
          const seasons = await sRes.json();
          setSeasonsList(seasons || []);
        }
      }

      // 2. Resolve query target season ID query
      let targetSeasonId = '';
      if (selectedSeason === 'all') {
        targetSeasonId = '';
      } else if (selectedSeason === 'active') {
        // Find whichever season is set active
        const activeS = seasonsList.find(s => s.active);
        targetSeasonId = activeS ? activeS.id : '';
      } else {
        targetSeasonId = selectedSeason;
      }

      const q = targetSeasonId ? `?seasonId=${targetSeasonId}` : '';
      const statsRes = await fetch(`/api/stats${q}`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setRachaStats(data);
      }
    } catch (err) {
      console.error('Falha ao obter dados estatísticos do racha', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Primary load effect
  useEffect(() => {
    fetchSummaries();
  }, [players]);

  // Secondary stats effect
  useEffect(() => {
    fetchRachaStats();
  }, [selectedSeason, seasonsList.length]);

  // Merge the calculated metrics inside individual player profile objects (Overall values)
  const rankedPlayers = players
    .map(player => {
      const summary = summaries.find(s => s.playerId === player.id);
      return {
        ...player,
        overall: summary ? summary.overall : 3.5, // default fallback
        evalCount: summary ? summary.evalCount : 0,
        computedAttributes: summary ? summary.computedAttributes : {}
      };
    })
    .sort((a, b) => b.overall - a.overall);

  const getTeamName = (teamId: string) => {
    const t = FAVORITE_TEAMS.find(x => x.id === teamId);
    return t?.name || 'Vários';
  };

  // Top 3 Podium for Overall Evaluated players
  const firstPlace = rankedPlayers[0];
  const secondPlace = rankedPlayers[1];
  const thirdPlace = rankedPlayers[2];
  const restOfPlayers = rankedPlayers.slice(3);

  // Hall of Fame calculated awards using historical data (selectedSeason === 'all')
  // We compute these from rachaStats when loaded
  const getHallAccolades = () => {
    if (!rachaStats) return null;
    
    const indivs = rachaStats.individual || [];
    const keepers = rachaStats.goalkeepers || [];
    const duos = rachaStats.duos || [];
    const trios = rachaStats.trios || [];

    // Most Wins
    const keyWins = indivs.length > 0 ? indivs[0] : null;

    // Most Presences
    const keyPresences = indivs.length > 0 ? [...indivs].sort((a, b) => b.presences - a.presences)[0] : null;

    // Highest Winrate (Aproveitamento) - Needs at least 1 game
    const keyWinrate = indivs.length > 0 
      ? indivs.filter((p: any) => p.presences > 0).sort((a: any, b: any) => {
          if (b.aproveitamento !== a.aproveitamento) {
            return b.aproveitamento - a.aproveitamento;
          }
          return b.vitorias - a.vitorias;
        })[0] 
      : null;

    // Best Goalkeeper
    const keyKeeper = keepers.length > 0 ? keepers[0] : null;

    // Max Win Streak
    const keyStreak = indivs.length > 0 ? [...indivs].sort((a, b) => b.maxStreak - a.maxStreak)[0] : null;

    // Best Duo
    const keyDuo = duos.length > 0 ? duos[0] : null;

    // Best Trio
    const keyTrio = trios.length > 0 ? trios[0] : null;

    return {
      keyWins,
      keyPresences,
      keyWinrate,
      keyKeeper,
      keyStreak,
      keyDuo,
      keyTrio
    };
  };

  const accolades = getHallAccolades();

  return (
    <div className="space-y-6" id="ranking-tecnico-wrapper">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h2 className="font-display font-black text-xl text-white uppercase tracking-tight flex items-center gap-1.5">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Classificação & Estatísticas</span>
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">Veja rankings do racha society, notas técnicas gerais e o histórico do grupo.</p>
        </div>

        <div className="flex items-center gap-2">
          {rankingSubTab === 'overall' ? (
            <button
              type="button"
              onClick={fetchSummaries}
              disabled={loading}
              className="p-2 border border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-white rounded-lg transition shrink-0"
              title="Sincronizar Notas"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          ) : (
            <button
              type="button"
              onClick={fetchRachaStats}
              disabled={statsLoading}
              className="p-2 border border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-white rounded-lg transition shrink-0"
              title="Recarregar Estatísticas"
            >
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* THREE PRIMARY SUBTABS */}
      <div className="flex bg-[#111815] p-1.5 rounded-xl border border-zinc-850 text-xs">
        <button
          onClick={() => setRankingSubTab('racha')}
          className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            rankingSubTab === 'racha'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Ranking do Racha</span>
        </button>

        <button
          onClick={() => setRankingSubTab('overall')}
          className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            rankingSubTab === 'overall'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Notas Técnicas (Overall)</span>
        </button>

        <button
          onClick={() => setRankingSubTab('hall')}
          className={`flex-1 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            rankingSubTab === 'hall'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Hall da Fama</span>
        </button>
      </div>


      {/* ==================================================== */}
      {/* ---------- SUBTAB 1: RANKING DO RACHA ------------- */}
      {/* ==================================================== */}
      {rankingSubTab === 'racha' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Controls: Season filter + View toggle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/40 font-mono text-xs">
            
            {/* Season Selector */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 whitespace-nowrap">📅 Consultar Época:</span>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none cursor-pointer flex-1 text-xs"
              >
                <option value="active">Temporada Ativa</option>
                <option value="all">Histórico Geral (Todas)</option>
                {seasonsList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.year}) {s.active ? '⭐️' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* View level filters */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full">
              <button
                onClick={() => setRachaViewMode('individual')}
                className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold transition flex-1 text-center ${
                  rachaViewMode === 'individual'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Geral (Jogadores)
              </button>

              <button
                onClick={() => setRachaViewMode('goalkeepers')}
                className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold transition flex-1 text-center ${
                  rachaViewMode === 'goalkeepers'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Goleiros
              </button>

              <button
                onClick={() => setRachaViewMode('affinities')}
                className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold transition flex-1 text-center ${
                  rachaViewMode === 'affinities'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Parcerias / Trios
              </button>

              <button
                onClick={() => setRachaViewMode('streaks')}
                className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold transition flex-1 text-center ${
                  rachaViewMode === 'streaks'
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sequências 🔥
              </button>
            </div>

          </div>

          {statsLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
              <span className="text-xs text-zinc-500 font-mono">Processando banco e calculando coeficientes...</span>
            </div>
          ) : !rachaStats || (rachaStats.individual || []).length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
              <Activity className="w-10 h-10 text-zinc-650 mx-auto mb-2.5" />
              <p className="text-zinc-400 font-semibold text-sm">Sem rodadas com resultados salvos!</p>
              <p className="text-xs text-zinc-600 mt-1">Grave o resultado de pelo menos um racha finalizado para liberar o ranking.</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* INDIVIDUAL WORKERS TAB */}
              {rachaViewMode === 'individual' && (
                <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg">
                  <div className="bg-zinc-900/40 px-4 py-3 border-b border-zinc-900 text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>Ranking individual de atletas</span>
                    <span className="text-[9px] text-[#22c55e] lowercase font-normal italic">Ordenação Oficial: Vitórias &gt; Aproveit. &gt; Presenças</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono text-zinc-300">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] text-zinc-500 uppercase">
                          <th className="py-3 px-4 text-center">Pos</th>
                          <th className="py-3 px-2">Atleta</th>
                          <th className="py-3 px-2 text-center">J</th>
                          <th className="py-3 px-2 text-center text-emerald-400">V</th>
                          <th className="py-3 px-2 text-center text-sky-400">% Aprov</th>
                          <th className="py-3 px-2 text-center text-amber-500">Seq Atu</th>
                          <th className="py-3 px-2 text-center text-rose-400">Max Seq</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60">
                        {(rachaStats.individual || []).map((player: any) => (
                          <tr key={player.playerId} className="hover:bg-zinc-900/10 transition group">
                            <td className="py-3 px-4 text-center font-bold">
                              {player.rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-zinc-950 font-black rounded-full shadow text-[10px]">1</span>
                              ) : player.rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-zinc-400 text-zinc-950 font-black rounded-full shadow text-[10px]">2</span>
                              ) : player.rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-700 text-zinc-500 text-white font-black rounded-full shadow text-[10px]">3</span>
                              ) : (
                                <span className="text-zinc-500 text-[11px]">#{player.rank}</span>
                              )}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 flex-shrink-0">
                                  <img src={player.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={player.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-sans font-bold text-white group-hover:text-emerald-400 transition block truncate">{player.name}</span>
                                  <span className="text-[9px] text-zinc-500 uppercase">{POSITION_LABELS[player.primaryPosition]}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-center text-zinc-400 font-bold">{player.presences}</td>
                            <td className="py-3 px-2 text-center text-emerald-400 font-black text-xs">{player.vitorias}</td>
                            <td className="py-3 px-2 text-center text-sky-450 font-bold">{player.aproveitamento}%</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                                player.currentStreak > 0 ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-zinc-650'
                              }`}>
                                {player.currentStreak > 0 && <Flame className="w-3 h-3 text-amber-500 animate-pulse" />}
                                {player.currentStreak}V
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center text-rose-450">{player.maxStreak} max</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* GOALKEEPERS ONLY VIEW */}
              {rachaViewMode === 'goalkeepers' && (
                <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg">
                  <div className="bg-zinc-900/40 px-4 py-3 border-b border-zinc-900 text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider flex justify-between items-center">
                    <span>🏆 Ranking de Paredões (Goleiros)</span>
                    <span className="text-[10px] text-emerald-400 uppercase">🧤 Posição Goleiro</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono text-zinc-300">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] text-zinc-500 uppercase">
                          <th className="py-3 px-4 text-center">Pos</th>
                          <th className="py-3 px-2">Goleiro</th>
                          <th className="py-3 px-2 text-center">Jogos</th>
                          <th className="py-3 px-2 text-center text-emerald-400">Vitórias</th>
                          <th className="py-3 px-2 text-center text-sky-400">Aproveitamento</th>
                          <th className="py-3 px-2 text-center text-rose-400">Melhor Sequência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60">
                        {(rachaStats.goalkeepers || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-zinc-500 italic">Nenhum atleta atuando como goleiro com dados salvos.</td>
                          </tr>
                        ) : (
                          (rachaStats.goalkeepers || []).map((keeper: any) => (
                            <tr key={keeper.playerId} className="hover:bg-zinc-900/10 transition group">
                              <td className="py-3 px-4 text-center font-bold">
                                {keeper.rank === 1 ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-zinc-950 font-black rounded-full shadow text-[10px]">1</span>
                                ) : (
                                  <span className="text-zinc-500 text-[11px]">#{keeper.rank}</span>
                                )}
                              </td>
                              <td className="py-3 px-2 font-sans font-bold text-white flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 flex-shrink-0">
                                  <img src={keeper.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={keeper.name} className="w-full h-full object-cover" />
                                </div>
                                <span className="truncate">{keeper.name}</span>
                              </td>
                              <td className="py-3 px-2 text-center text-zinc-400 font-bold">{keeper.presences}</td>
                              <td className="py-3 px-2 text-center text-emerald-400 font-black text-xs">{keeper.vitorias}</td>
                              <td className="py-3 px-2 text-center text-sky-455 font-bold">{keeper.aproveitamento}%</td>
                              <td className="py-3 px-2 text-center text-rose-450">{keeper.maxStreak} max</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DUOS AND TRIOS STATS AFFINITIES */}
              {rachaViewMode === 'affinities' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* DUOS PANEL */}
                  <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg">
                    <div className="bg-[#1e3a8a]/10 px-4 py-3 border-b border-zinc-900 text-sky-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Estatísticas de Duplas</span>
                    </div>

                    <div className="divide-y divide-zinc-900 font-mono text-xs">
                      {(rachaStats.duos || []).slice(0, 10).length === 0 ? (
                        <p className="p-4 text-center text-zinc-650 italic">Insira resultados para ver dados de afinidades de duplas.</p>
                      ) : (
                        (rachaStats.duos || []).slice(0, 10).map((duo: any, idx: number) => (
                          <div key={`${duo.playerAId}_${duo.playerBId}`} className="p-3.5 flex justify-between items-center gap-4 hover:bg-zinc-900/10">
                            <div>
                              <div className="text-white font-sans font-bold text-xs">
                                {idx + 1}. {duo.playerAName} <span className="text-blue-500 font-mono">&amp;</span> {duo.playerBName}
                              </div>
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Jogaram juntos: {duo.playedTogether} partidas</span>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="text-emerald-400 font-extrabold text-xs block">{duo.wonTogether} vitórias</span>
                              <span className="text-[10px] text-zinc-400">{duo.aproveitamento}% aprov.</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* TRIOS PANEL */}
                  <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg">
                    <div className="bg-[#6b21a8]/10 px-4 py-3 border-b border-zinc-900 text-purple-450 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                      <Users2 className="w-4 h-4 text-purple-400" />
                      <span>Estatísticas de Trios</span>
                    </div>

                    <div className="divide-y divide-zinc-900 font-mono text-xs">
                      {(rachaStats.trios || []).slice(0, 10).length === 0 ? (
                        <p className="p-4 text-center text-zinc-655 italic">Insira resultados para ver dados de afinidades de trios.</p>
                      ) : (
                        (rachaStats.trios || []).slice(0, 10).map((trio: any, idx: number) => (
                          <div key={`${trio.playerAId}_${trio.playerBId}_${trio.playerCId}`} className="p-3.5 flex justify-between items-center gap-4 hover:bg-zinc-900/10">
                            <div>
                              <div className="text-white font-sans font-semibold text-xs leading-snug">
                                {idx + 1}. {trio.playerAName}, {trio.playerBName} <span className="text-purple-400">&amp;</span> {trio.playerCName}
                              </div>
                              <span className="text-[10px] text-zinc-500 block mt-0.5">Jogaram juntos: {trio.playedTogether} partidas</span>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="text-emerald-400 font-extrabold text-xs block">{trio.wonTogether} vitórias</span>
                              <span className="text-[10px] text-zinc-400">{trio.aproveitamento}% aprov.</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}

              {rachaViewMode === 'streaks' && (
                <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg animate-fadeIn">
                  <div className="bg-[#1f2937]/30 px-4 py-3 border-b border-zinc-900 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#8b5cf6]" />
                    <span>Maiores Sequências Históricas de Vitórias</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono text-zinc-300">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/40 text-[10px] text-zinc-500 uppercase">
                          <th className="py-3 px-4 text-center w-16">Pos</th>
                          <th className="py-3 px-2">Atleta</th>
                          <th className="py-3 px-2 text-center text-amber-500">🔥 Seq. Atual</th>
                          <th className="py-3 px-2 text-center text-purple-400">👑 Melhor Seq. Histórica</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60 font-mono">
                        {[...(rachaStats.individual || [])]
                          .sort((a, b) => b.maxStreak - a.maxStreak || b.currentStreak - a.currentStreak)
                          .map((player: any, idx: number) => (
                            <tr key={player.playerId} className="hover:bg-zinc-900/10 transition group">
                              <td className="py-3 px-4 text-center font-bold">
                                {idx === 0 ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-zinc-950 font-black rounded-full shadow text-[10px]">1</span>
                                ) : idx === 1 ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 bg-zinc-400 text-zinc-950 font-black rounded-full shadow text-[10px]">2</span>
                                ) : idx === 2 ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-700 text-white font-black rounded-full shadow text-[10px]">3</span>
                                ) : (
                                  <span className="text-zinc-500 text-[11px]">#{idx + 1}</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 flex-shrink-0">
                                    <img src={player.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={player.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-sans font-bold text-white group-hover:text-purple-400 transition block truncate">{player.name}</span>
                                    <span className="text-[9px] text-zinc-500 uppercase">{POSITION_LABELS[player.primaryPosition]}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className="text-amber-500 font-extrabold text-xs">
                                  {player.currentStreak}V
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className="text-purple-400 font-extrabold text-xs">
                                  {player.maxStreak}V
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}


      {/* ==================================================== */}
      {/* ---------- SUBTAB 2: NOTAS TÉCNICAS (OVERALL) ----- */}
      {/* ==================================================== */}
      {rankingSubTab === 'overall' && (
        <div className="space-y-6 animate-fadeIn">
          
          {loading && summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
              <span className="text-xs text-zinc-500 font-mono">Consolidando dados analíticos...</span>
            </div>
          ) : rankedPlayers.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
              <Award className="w-10 h-10 text-zinc-650 mx-auto mb-2.5" />
              <p className="text-zinc-400 font-semibold text-sm">Roster vazio!</p>
              <p className="text-xs text-zinc-600 mt-1">Nenhum atleta registrado para visualização no ranking técnico.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Podium Highlight */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/50 relative overflow-hidden select-none">
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />

                {/* SECOND PLACE */}
                {secondPlace ? (
                  <div className="sm:order-1 bg-[#101915]/60 hover:bg-[#101915]/90 border border-zinc-900 rounded-xl p-4 flex flex-col items-center text-center justify-between transition group">
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute -top-1 -left-1 text-xs bg-zinc-700 text-white rounded-full font-bold font-mono w-5 h-5 flex items-center justify-center shadow">2</span>
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-700 bg-zinc-900 mx-auto shadow-md">
                          <img src={secondPlace.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={secondPlace.name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm truncate max-w-[140px]">{secondPlace.name}</h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold mt-0.5">{POSITION_LABELS[secondPlace.primaryPosition]}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-1 w-full">
                      <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-850 px-3 py-1 rounded-full font-mono">
                        <Star className="w-3.5 h-3.5 text-zinc-400 fill-zinc-400" />
                        <span className="text-sm font-extrabold text-white">{secondPlace.overall.toFixed(1)}</span>
                      </div>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-1">{secondPlace.evalCount} votos recebidos</span>
                      <button
                        onClick={() => setEvaluationPlayer(secondPlace)}
                        className="w-full bg-zinc-900 hover:bg-emerald-600/10 border border-zinc-850 hover:border-emerald-550/30 text-[10px] font-bold font-mono py-1 rounded-lg text-zinc-400 hover:text-emerald-400 cursor-pointer transition mt-2"
                      >
                        Avaliar Atleta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:order-1 border border-zinc-900 border-dashed rounded-xl p-4 flex items-center justify-center text-center text-xs text-zinc-650 h-full min-h-[160px]">
                    Aguardando 2º Lugar
                  </div>
                )}

                {/* FIRST PLACE */}
                {firstPlace ? (
                  <div className="sm:order-2 bg-[#1a251f] hover:bg-[#1f2d26] border border-emerald-500/20 rounded-2xl p-5 flex flex-col items-center text-center justify-between transition relative scale-105 shadow-xl ring-1 ring-emerald-500/10 group">
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 font-black tracking-widest text-[9px] px-3 py-0.5 rounded-full shadow border border-amber-600 flex items-center gap-1 font-mono uppercase animate-pulse">
                      <Trophy className="w-3 h-3 block" />
                      <span>MELHOR NOTA</span>
                    </div>

                    <div className="space-y-2 mt-2">
                      <div className="relative">
                        <span className="absolute -top-1 -left-1 text-sm bg-amber-500 text-zinc-950 rounded-full font-black font-mono w-6 h-6 flex items-center justify-center shadow border border-amber-600">1</span>
                        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500 bg-zinc-900 mx-auto shadow-lg shadow-amber-500/10">
                          <img src={firstPlace.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={firstPlace.name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-black text-base truncate max-w-[150px]">{firstPlace.name}</h4>
                        <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-mono font-black mt-0.5">{POSITION_LABELS[firstPlace.primaryPosition]}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 w-full">
                      <div className="inline-flex items-center gap-1 bg-[#101814] border border-[#22c55e]/20 px-4 py-1.5 rounded-full font-mono shadow-md">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-base font-black text-emerald-400">{firstPlace.overall.toFixed(1)}</span>
                      </div>
                      <span className="block text-[9px] text-zinc-400 font-mono mt-1">{firstPlace.evalCount} votos recebidos</span>
                      <button
                        onClick={() => setEvaluationPlayer(firstPlace)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 hover:scale-102 text-[10px] font-black font-mono py-1.5 rounded-xl text-white cursor-pointer transition shadow mt-2 uppercase tracking-wider"
                      >
                        Avaliar Melhor
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:order-2 border border-zinc-900 border-dashed rounded-xl p-4 flex items-center justify-center text-center text-xs text-zinc-650 h-full min-h-[160px]">
                    Aguardando Líder
                  </div>
                )}

                {/* THIRD PLACE */}
                {thirdPlace ? (
                  <div className="sm:order-3 bg-[#101915]/60 hover:bg-[#101915]/90 border border-zinc-900 rounded-xl p-4 flex flex-col items-center text-center justify-between transition group">
                    <div className="space-y-2">
                      <div className="relative">
                        <span className="absolute -top-1 -left-1 text-xs bg-amber-700 text-white rounded-full font-bold font-mono w-5 h-5 flex items-center justify-center shadow">3</span>
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-800/80 bg-zinc-900 mx-auto shadow-md">
                          <img src={thirdPlace.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={thirdPlace.name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm truncate max-w-[140px]">{thirdPlace.name}</h4>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold mt-0.5">{POSITION_LABELS[thirdPlace.primaryPosition]}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-1 w-full">
                      <div className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-850 px-3 py-1 rounded-full font-mono">
                        <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                        <span className="text-sm font-extrabold text-white">{thirdPlace.overall.toFixed(1)}</span>
                      </div>
                      <span className="block text-[9px] text-zinc-500 font-mono mt-1">{thirdPlace.evalCount} votos recebidos</span>
                      <button
                        onClick={() => setEvaluationPlayer(thirdPlace)}
                        className="w-full bg-zinc-900 hover:bg-emerald-600/10 border border-zinc-850 hover:border-emerald-550/30 text-[10px] font-bold font-mono py-1 rounded-lg text-zinc-400 hover:text-emerald-400 cursor-pointer transition mt-2"
                      >
                        Avaliar Atleta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:order-3 border border-zinc-900 border-dashed rounded-xl p-4 flex items-center justify-center text-center text-xs text-zinc-650 h-full min-h-[160px]">
                    Aguardando 3º Lugar
                  </div>
                )}
              </div>

              {/* Roster Coadjuvantes table */}
              <div className="rounded-xl border border-zinc-900 overflow-hidden bg-zinc-950/10 shadow-lg">
                <div className="bg-zinc-900/60 px-4 py-3 border-b border-zinc-900 text-zinc-400 text-xs font-mono font-bold uppercase tracking-wider flex justify-between items-center">
                  <span>Classificação de Atletas Coadjuvantes</span>
                  <span className="text-[10px] text-zinc-500">Média Amortecida de Overall</span>
                </div>

                <div className="divide-y divide-zinc-900">
                  {restOfPlayers.length === 0 ? (
                    <div className="p-4 text-center text-zinc-600 text-xs italic font-mono">
                      Lista composta inteiramente pelo trio do Podium.
                    </div>
                  ) : (
                    restOfPlayers.map((player, index) => {
                      const relativeRank = index + 4;
                      return (
                        <div 
                          key={player.id} 
                          className={`p-4 flex items-center justify-between gap-4 hover:bg-zinc-900/20 transition ${
                            !!player.deletedAt ? 'opacity-40 italic' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-zinc-500 w-5 text-center">
                              #{relativeRank}
                            </span>
                            <div className="w-10 h-10 rounded-full border border-zinc-850 overflow-hidden bg-zinc-900 flex-shrink-0">
                              <img src={player.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={player.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="font-display font-bold text-white text-xs truncate flex items-center gap-1.5">
                                <span>{player.name}</span>
                              </h5>
                              <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate font-sans">
                                {POSITION_LABELS[player.primaryPosition]} • Torcedor do {getTeamName(player.favoriteTeamId)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex flex-col text-right font-mono min-w-[50px]">
                              <span className="text-xs font-black text-emerald-400">{player.overall.toFixed(1)}</span>
                              <span className="text-[9px] text-zinc-600">{player.evalCount} votos</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEvaluationPlayer(player)}
                              className="px-3 py-1.5 bg-zinc-90 shadow hover:bg-[#1b2621]/20 hover:text-emerald-400 hover:border-emerald-500/20 border border-zinc-850 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer select-none"
                            >
                              Avaliar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      )}


      {/* ==================================================== */}
      {/* ---------- SUBTAB 3: HALL DA FAMA stickers -------- */}
      {/* ==================================================== */}
      {rankingSubTab === 'hall' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="bg-[#1f2937]/10 p-4 border border-zinc-900 rounded-xl leading-relaxed">
            <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest font-black block mb-1">⭐ SOBRE O HALL DA FAMA</span>
            <p className="text-xs text-zinc-400">
              O prestígio eterno do Racha do Fofim. Aqui estão imortalizados os atletas com maior rendimento, consistência técnica e vitórias consolidadas em todo o histórico de jogo.
            </p>
          </div>

          {!accolades || !accolades.keyWins ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
              <Compass className="w-10 h-10 text-zinc-650 mx-auto mb-2.5 animate-spin" style={{ animationDuration: '4s' }} />
              <p className="text-zinc-400 font-semibold text-sm">O Hall da Fama está calculando...</p>
              <p className="text-xs text-zinc-600 mt-1">Conclua e salve placares de partidas para gerar os figurões lendários da galeria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* FIGURINHA 1: ARTILHEIRO DE VITÓRIAS (MAIS VITÓRIAS) */}
              {accolades.keyWins && (
                <div className="bg-gradient-to-b from-amber-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-amber-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-amber-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase uppercase">Legendary</div>
                  
                  <div className="space-y-2 mt-4">
                    <Trophy className="w-8 h-8 text-amber-400 mx-auto animate-bounce" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">🏆 REI DAS VITÓRIAS</span>
                    
                    <div className="relative mt-2">
                      <div className="w-20 h-20 rounded-full border-2 border-amber-500/60 overflow-hidden bg-zinc-900 mx-auto shadow-lg group-hover:scale-105 transition">
                        <img src={accolades.keyWins.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={accolades.keyWins.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 font-black px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow uppercase">
                        {accolades.keyWins.vitorias} Wins
                      </span>
                    </div>

                    <h4 className="text-white font-black text-sm pt-2 truncate max-w-[160px]">{accolades.keyWins.name}</h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono">{POSITION_LABELS[accolades.keyWins.primaryPosition]} do grupo</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10.5px] font-mono text-zinc-400">
                     Aproveitamento: <span className="text-emerald-400 font-extrabold">{accolades.keyWins.aproveitamento}%</span> ({accolades.keyWins.presences} presenças)
                  </div>
                </div>
              )}

              {/* FIGURINHA 2: ONIPRESENTE (MAIS PRESENÇAS) */}
              {accolades.keyPresences && (
                <div className="bg-gradient-to-b from-sky-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-sky-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-sky-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded uppercase">Onipresente</div>

                  <div className="space-y-2 mt-4">
                    <Calendar className="w-8 h-8 text-sky-400 mx-auto" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">📅 SEMPRE CONFIRMADO</span>

                    <div className="relative mt-2">
                      <div className="w-20 h-20 rounded-full border-2 border-sky-500/60 overflow-hidden bg-zinc-900 mx-auto shadow-lg group-hover:scale-105 transition">
                        <img src={accolades.keyPresences.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={accolades.keyPresences.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-sky-500 text-zinc-950 font-black px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow uppercase">
                        {accolades.keyPresences.presences} Jogos
                      </span>
                    </div>

                    <h4 className="text-white font-black text-sm pt-2 truncate max-w-[160px]">{accolades.keyPresences.name}</h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono">Inabalável no asfalto</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10.5px] font-mono text-zinc-400">
                     Soma <span className="text-sky-400 font-extrabold">{accolades.keyPresences.vitorias} vitórias</span> gerais da temporada.
                  </div>
                </div>
              )}

              {/* FIGURINHA 3: APROVEITAMENTO DE OURO */}
              {accolades.keyWinrate && (
                <div className="bg-gradient-to-b from-emerald-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-emerald-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-emerald-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">WinRate Ouro</div>

                  <div className="space-y-2 mt-4">
                    <Zap className="w-8 h-8 text-emerald-400 mx-auto" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono font-mono">⚡ RENTABILIDADE DE OURO</span>

                    <div className="relative mt-2">
                      <div className="w-20 h-20 rounded-full border-2 border-emerald-500/60 overflow-hidden bg-zinc-900 mx-auto shadow-lg group-hover:scale-105 transition">
                        <img src={accolades.keyWinrate.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={accolades.keyWinrate.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-emerald-555 border border-emerald-600 bg-emerald-500 text-zinc-950 font-black px-2.5 py-0.5 rounded-full text-[10.5px] font-mono shadow uppercase">
                        {accolades.keyWinrate.aproveitamento}% Aprov
                      </span>
                    </div>

                    <h4 className="text-white font-black text-sm pt-2 truncate max-w-[160px]">{accolades.keyWinrate.name}</h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono">Entra em campo para vencer</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10.5px] font-mono text-zinc-400">
                     Venceu <span className="text-emerald-400 font-extrabold">{accolades.keyWinrate.vitorias} de {accolades.keyWinrate.presences}</span> partidas.
                  </div>
                </div>
              )}

              {/* FIGURINHA 4: MELHOR GOLEIRO (PAREDÃO) */}
              {accolades.keyKeeper && (
                <div className="bg-gradient-to-b from-rose-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-rose-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-rose-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-rose-455 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded uppercase">Muralha</div>

                  <div className="space-y-2 mt-4">
                    <Shield className="w-8 h-8 text-rose-500 mx-auto" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">🧤 PAREDÃO DO RACHA</span>

                    <div className="relative mt-2">
                      <div className="w-20 h-20 rounded-full border-2 border-rose-500/60 overflow-hidden bg-zinc-900 mx-auto shadow-lg group-hover:scale-105 transition">
                        <img src={accolades.keyKeeper.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={accolades.keyKeeper.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-rose-500 text-zinc-950 font-black px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow uppercase">
                        {accolades.keyKeeper.vitorias} Vitórias
                      </span>
                    </div>

                    <h4 className="text-white font-black text-sm pt-2 truncate max-w-[160px]">{accolades.keyKeeper.name}</h4>
                    <p className="text-[10px] text-rose-400 lowercase font-mono">Dono oficial das traves</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10.5px] font-mono text-zinc-400">
                     Aproveitamento: <span className="text-rose-400 font-extrabold">{accolades.keyKeeper.aproveitamento}%</span> ({accolades.keyKeeper.presences} jogos).
                  </div>
                </div>
              )}

              {/* FIGURINHA 5: MAIOR SEQUÊNCIA HISTÓRICA */}
              {accolades.keyStreak && (
                <div className="bg-gradient-to-b from-purple-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-purple-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-purple-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase">Straker</div>

                  <div className="space-y-2 mt-4">
                    <Flame className="w-8 h-8 text-purple-450 mx-auto text-purple-400" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">🔥 ESTRELA SOLITÁRIA</span>

                    <div className="relative mt-2">
                      <div className="w-20 h-20 rounded-full border-2 border-purple-500/60 overflow-hidden bg-zinc-900 mx-auto shadow-lg group-hover:scale-105 transition">
                        <img src={accolades.keyStreak.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} alt={accolades.keyStreak.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-black px-2.5 py-0.5 rounded-full text-[10px] font-mono shadow uppercase">
                        {accolades.keyStreak.maxStreak} Vitórias Seguidas
                      </span>
                    </div>

                    <h4 className="text-white font-black text-sm pt-2 truncate max-w-[160px]">{accolades.keyStreak.name}</h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono">Maior invencibilidade registrada</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10.5px] font-mono text-zinc-400">
                     Atualmente mantendo sequência ativa de: <span className="text-purple-400 font-extrabold">{accolades.keyStreak.currentStreak} vitórias</span>.
                  </div>
                </div>
              )}

              {/* FIGURINHA 6: MELHOR DUPLA HISTÓRICA */}
              {accolades.keyDuo && (
                <div className="bg-gradient-to-b from-teal-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-teal-550/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-teal-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase">Golden Duo</div>

                  <div className="space-y-2 mt-4">
                    <Users className="w-8 h-8 text-teal-400 mx-auto" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">👥 DUPLA INVENCÍVEL</span>

                    <h4 className="text-white font-black text-xs leading-relaxed pt-4 line-clamp-2">
                      {accolades.keyDuo.playerAName} <br />
                      <span className="text-teal-400 font-normal">e</span> <br />
                      {accolades.keyDuo.playerBName}
                    </h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono pt-1">Sintonizados dentro das quadras</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10px] font-mono text-zinc-400 space-y-0.5">
                     <div>🏆 Vitórias juntos: <span className="text-teal-400 font-extrabold">{accolades.keyDuo.wonTogether} jogos</span></div>
                     <div>📈 Aproveitamento: <span className="text-teal-400 font-extrabold">{accolades.keyDuo.aproveitamento}%</span> ({accolades.keyDuo.playedTogether} partidas)</div>
                  </div>
                </div>
              )}

              {/* FIGURINHA 7: MELHOR TRIO HISTÓRICO */}
              {accolades.keyTrio && (
                <div className="bg-gradient-to-b from-indigo-600/25 via-zinc-950 to-zinc-950 p-5 rounded-2xl border-2 border-indigo-500/40 relative shadow-xl text-center flex flex-col items-center justify-between min-h-[300px] overflow-hidden group hover:border-indigo-500 transition duration-300">
                  <div className="absolute top-2 right-2 text-[8px] font-bold font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">Golden Trio</div>

                  <div className="space-y-2 mt-4">
                    <Users2 className="w-8 h-8 text-indigo-400 mx-auto" />
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block font-mono">⚡ TRIO INABALÁVEL</span>

                    <h4 className="text-white font-bold text-[11px] leading-snug pt-3 line-clamp-3">
                      {accolades.keyTrio.playerAName}, <br />
                      {accolades.keyTrio.playerBName} <br />
                      <span className="text-indigo-400 font-normal">&amp;</span> {accolades.keyTrio.playerCName}
                    </h4>
                    <p className="text-[10px] text-zinc-550 lowercase font-mono pt-1">O pesadelo dos adversários sorteados</p>
                  </div>

                  <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg p-2 mt-4 text-[10px] font-mono text-zinc-400 space-y-0.5">
                     <div>🏆 Vitórias juntos: <span className="text-indigo-400 font-extrabold">{accolades.keyTrio.wonTogether} jogos</span></div>
                     <div>📈 Aproveitamento: <span className="text-indigo-400 font-extrabold">{accolades.keyTrio.aproveitamento}%</span> ({accolades.keyTrio.playedTogether} partidas)</div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* Render evaluation modal if opened */}
      {evaluationPlayer && (
        <PlayerEvaluationModal
          player={evaluationPlayer}
          currentUser={currentUser}
          onClose={() => setEvaluationPlayer(null)}
          onEvaluationSaved={(msg) => {
            setSuccessToast(msg);
            fetchSummaries();
            setTimeout(() => setSuccessToast(''), 4000);
          }}
        />
      )}
    </div>
  );
}
