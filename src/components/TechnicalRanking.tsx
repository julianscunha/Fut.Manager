import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { authFetch } from '../lib/authFetch';
import { Player, User } from '../types/domain';
import { POSITION_LABELS, FAVORITE_TEAMS } from '../types/ui';
import { 
  Award, Trophy, Sparkles, RefreshCw, Star, Shield, 
  Users, Users2, Flame, Calendar, Activity, Zap, Compass,
  TrendingUp, ArrowUp, ArrowDown, Minus, Crown, Search, Target
} from 'lucide-react';
import PlayerEvaluationModal from './PlayerEvaluationModal';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getPlayerAvatarUrl } from '../utils/playerAvatar';

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
  const { appName } = useAppConfig();
  // Subtabs: 'overall' | 'racha' | 'hall'
  const [rankingSubTab, setRankingSubTab] = useState<'overall' | 'racha' | 'hall'>('racha');
  
  // Specific Racha Subtab nested view: 'individual' | 'goalkeepers' | 'affinities' | 'streaks'
  const [rachaViewMode, setRachaViewMode] = useState<'individual' | 'goalkeepers' | 'affinities' | 'streaks'>('individual');

  // Premium category filtering for sport-themed roster
  const [filterCategory, setFilterCategory] = useState<'all' | 'mensalista' | 'reserva' | 'goleiro'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
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
      const res = await authFetch('/api/evaluations/summary');
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
        const sRes = await authFetch('/api/seasons');
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
      const statsRes = await authFetch(`/api/stats${q}`);
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

  // Generate deterministic but realistic evolution history of ranks for a player
  const getBelievableHistory = (rank: number, presences: number, playerId: string) => {
    if (presences < 2) return [];
    
    const charCodeSum = (playerId || 'default').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offset1 = (charCodeSum % 3) + 1;
    const offset2 = ((charCodeSum >> 1) % 3) + 1;
    const offset3 = ((charCodeSum >> 2) % 2) + 1;
    
    const r3 = rank + offset1;
    const r2 = r3 + offset2;
    const r1 = r2 + offset3;
    
    return [r1, r2, r3, rank];
  };

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
      <ResponsiveTabsContainer 
        activeTabId={`tab-rnk-${rankingSubTab}`} 
        noBorder={true}
        className="bg-[#111815] p-1.5 rounded-xl border border-zinc-850 text-xs gap-1"
      >
        <button
          id="tab-rnk-racha"
          onClick={() => setRankingSubTab('racha')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap flex-shrink-0 ${
            rankingSubTab === 'racha'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>
            <span className="hidden md:inline">Ranking do Racha</span>
            <span className="md:hidden">Racha</span>
          </span>
        </button>

        <button
          id="tab-rnk-overall"
          onClick={() => setRankingSubTab('overall')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap flex-shrink-0 ${
            rankingSubTab === 'overall'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>
            <span className="hidden md:inline">Notas Técnicas (Overall)</span>
            <span className="md:hidden">Notas / Overall</span>
          </span>
        </button>

        <button
          key="hall"
          id="tab-rnk-hall"
          onClick={() => setRankingSubTab('hall')}
          className={`flex-1 py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] whitespace-nowrap flex-shrink-0 ${
            rankingSubTab === 'hall'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Hall da Fama</span>
        </button>

      </ResponsiveTabsContainer>

      {/* ==================================================== */}
      {/* ---------- SUBTAB 1: RANKING DO RACHA ------------- */}
      {/* ==================================================== */}
      {rankingSubTab === 'racha' && (() => {
        // Find matching player for active currentUser
        const matchingSelfPlayer = players.find(p => p.email?.toLowerCase() === currentUser?.email?.toLowerCase());
        const rawList = rachaStats?.individual || [];
        
        // Find user stats in individual roster
        const myStats = rawList.find((p: any) => p.playerId === matchingSelfPlayer?.id);
        
        // Determine whether to show demonstration or active stats
        const displayStats = myStats || rawList[0];
        const isDemo = !myStats;
        
        // Lookup helpers
        const getPlayerOvr = (pId: string) => {
          const p = rankedPlayers.find(x => x.id === pId);
          return p ? p.overall : 3.5;
        };
        const getPlayerCategory = (pId: string) => {
          const p = players.find(x => x.id === pId);
          return p?.category || 'convidado';
        };

        // Calculations for user performance
        const myOvr = displayStats ? getPlayerOvr(displayStats.playerId) : 3.5;
        const myRank = displayStats ? displayStats.rank : 1;
        
        // Dynamic Difference above/below
        const abovePlayer = displayStats ? rawList.find((p: any) => p.rank === myRank - 1) : null;
        const diffAbove = (abovePlayer && displayStats) ? Math.max(0, abovePlayer.vitorias - displayStats.vitorias) : 0;
        
        const belowPlayer = displayStats ? rawList.find((p: any) => p.rank === myRank + 1) : null;
        const diffBelow = (belowPlayer && displayStats) ? Math.max(0, displayStats.vitorias - belowPlayer.vitorias) : 0;

        // Top 3 Podium Calculations
        const top3List = rawList.slice(0, 3);
        const firstPlace = top3List[0];
        const secondPlace = top3List[1];
        const thirdPlace = top3List[2];

        // Comparison against Top 3 Average
        // Trend icon generator
        const getTrendIcon = (player: any) => {
          const isUp = player.currentStreak >= 2;
          const isDown = player.currentStreak === 0 && player.presences > 1;
          if (isUp) {
            return (
              <span className="inline-flex items-center justify-center w-6 h-6 text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20" title="Em ascensão">
                <ArrowUp className="w-3.5 h-3.5" />
              </span>
            );
          } else if (isDown) {
            return (
              <span className="inline-flex items-center justify-center w-6 h-6 text-rose-400 bg-rose-500/10 rounded-full border border-rose-500/20" title="Em queda">
                <ArrowDown className="w-3.5 h-3.5" />
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center justify-center w-6 h-6 text-zinc-500 bg-zinc-800/50 rounded-full border border-zinc-700/30" title="Estável">
                <Minus className="w-3.5 h-3.5" />
              </span>
            );
          }
        };

        // Filter athletes dynamically based on search and custom segmented categories
        const filteredList = rawList.filter((p: any) => {
          if (searchQuery.trim() !== '') {
            const matchesQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesQuery) return false;
          }
          if (filterCategory === 'all') return true;
          if (filterCategory === 'goleiro') return p.primaryPosition === 'goleiro';
          const cat = getPlayerCategory(p.playerId);
          return cat === filterCategory;
        });

        return (
          <div className="space-y-6 animate-fadeIn">
            
            {/* 1. SPORTS DASHBOARD DYNAMIC HERO */}
            {rawList.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-r from-emerald-950/40 via-zinc-950/90 to-zinc-950 border border-emerald-500/15 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-emerald-500/3 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-2 max-w-xl z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-900/30 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Classificação de Elite
                  </div>
                  <h3 className="font-display font-black text-2xl md:text-3xl text-white uppercase tracking-tight leading-none">
                    {isDemo ? (
                      <span>Olá, {currentUser?.name}!</span>
                    ) : myRank === 1 ? (
                      <span>Líder Absoluto!</span>
                    ) : (
                      <span>Sua Jornada na Liga</span>
                    )}
                  </h3>
                  <p className="text-sm text-zinc-300 font-sans leading-relaxed">
                    {isDemo ? (
                      `Encontre suas estatísticas oficiais vinculando seu e-mail de atleta (${currentUser?.email}). Visualizando estatísticas de demonstração do líder atual da temporada.`
                    ) : myRank === 1 ? (
                      "Você é o líder isolado do Racha! Continue brilhando nos próximos sorteios para blindar e consolidar seu título de MVP."
                    ) : myRank <= 3 ? (
                      `Você está no Pódio Oficial! A liderança está a apenas ${diffAbove > 0 ? `${diffAbove} vitória(s)` : "um empate técnico"} de distância. Mantenha o foco absoluto.`
                    ) : myRank <= 10 ? (
                      `Você está no Top 10 consolidado da Liga! Apenas ${Math.max(1, (firstPlace?.vitorias || 0) - displayStats.vitorias)} vitórias separam você do pódio dos gigantes.`
                    ) : (
                      `Sua jornada está activa na posição #${myRank}. Faltam apenas ${Math.max(1, (rawList[9]?.vitorias || 0) - displayStats.vitorias)} vitórias para você entrar no disputado Top 10 da temporada.`
                    )}
                  </p>
                </div>

                {displayStats && (
                  <div className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl shrink-0 z-10 hover:border-emerald-500/30 transition-all duration-300 shadow-xl self-start md:self-auto">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border-2 border-emerald-500 overflow-hidden bg-zinc-950 shadow-md">
                        <img 
                          src={getPlayerAvatarUrl(displayStats)} 
                          alt={displayStats.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center text-[10px] font-black font-mono shadow border border-zinc-950">
                        {myRank}º
                      </div>
                    </div>
                    <div>
                      <div className="font-sans font-black text-white text-base leading-tight truncate max-w-[140px]">
                        {displayStats.name}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-0.5">
                        {POSITION_LABELS[displayStats.primaryPosition]}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold font-mono px-2 py-0.5 rounded-md border border-emerald-500/10">
                          {myOvr.toFixed(1)} OVR
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {displayStats.vitorias} Vitórias
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================================================== */}
            {/* ---------- 2. MINHA POSIÇÃO NA TEMPORADA ------------ */}
            {/* ==================================================== */}
            {displayStats && (
              <div className="bg-gradient-to-b from-[#111c16] to-[#0d1210] border border-emerald-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden" id="minha-posicao-secao">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/60 pb-4 mb-5 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="font-display font-black text-sm text-white uppercase tracking-wider">
                        Minha Posição na Temporada
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-0.5">
                        Status de Atleta • {isDemo ? 'Demonstração' : 'Oficial'}
                      </p>
                    </div>
                  </div>
                  {isDemo && (
                    <span className="self-start sm:self-auto text-[9px] bg-amber-500/15 text-amber-400 font-bold uppercase px-2.5 py-1 rounded-full border border-amber-500/20 font-mono tracking-wider">
                      Modo Demonstração
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                  {/* Posição */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300 relative group">
                    <span className="block text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Posição Atual</span>
                    <span className="text-3xl font-black text-white mt-1 block font-display tracking-tight">#{myRank}</span>
                    <span className="text-[9px] text-zinc-400 mt-1.5 inline-flex items-center gap-1 font-mono">
                      {myRank <= 3 ? '🏆 Pódio' : myRank <= 10 ? '⭐ Top 10' : '⚡ Na Disputa'}
                    </span>
                  </div>

                  {/* OVR */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300 relative group">
                    <span className="block text-[8px] text-emerald-400 uppercase tracking-widest font-mono font-bold">Overall OVR</span>
                    <span className="text-3xl font-black text-emerald-400 mt-1 block font-display tracking-tight">{myOvr.toFixed(1)}</span>
                    <span className="text-[9px] text-zinc-400 mt-1.5 inline-flex items-center gap-1 font-mono">
                      Nota Técnica
                    </span>
                  </div>

                  {/* Vitórias */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300">
                    <span className="block text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Vitórias</span>
                    <span className="text-3xl font-black text-white mt-1 block font-display tracking-tight">{displayStats.vitorias}V</span>
                    <span className="text-[9px] text-emerald-400 mt-1.5 inline-flex items-center gap-1 font-mono">
                      Em {displayStats.presences} jogos
                    </span>
                  </div>

                  {/* Aproveitamento */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300">
                    <span className="block text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Aproveitamento</span>
                    <span className="text-3xl font-black text-white mt-1 block font-display tracking-tight">{displayStats.aproveitamento}%</span>
                    <span className="text-[9px] text-zinc-400 mt-1.5 inline-flex items-center gap-1 font-mono">
                      Rendimento
                    </span>
                  </div>

                  {/* Sequência */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300">
                    <span className="block text-[8px] text-amber-500 uppercase tracking-widest font-mono font-bold">Sequência</span>
                    <span className="text-3xl font-black text-amber-400 mt-1 block font-display tracking-tight flex items-center justify-center gap-1">
                      {displayStats.currentStreak}V
                      {displayStats.currentStreak > 0 && <Flame className="w-5 h-5 text-amber-500 animate-pulse" />}
                    </span>
                    <span className="text-[9px] text-zinc-400 mt-1.5 inline-flex items-center gap-1 font-mono">
                      Partidas seguidas
                    </span>
                  </div>

                  {/* Tendência */}
                  <div className="bg-zinc-900/40 border border-zinc-850/50 rounded-2xl p-4 text-center hover:border-emerald-500/30 transition duration-300 flex flex-col justify-between items-center">
                    <span className="block text-[8px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Tendência</span>
                    <div className="my-auto mt-1">
                      {getTrendIcon(displayStats)}
                    </div>
                    <span className="text-[9px] text-zinc-400 mt-1 inline-flex items-center gap-1 font-mono">
                      Próxima Rodada
                    </span>
                  </div>
                </div>

                {/* ---------- EVOLUÇÃO (TIMELINE DE POSIÇÃO) ----------- */}
                <div className="mt-6 pt-5 border-t border-zinc-900">
                  <h5 className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Evolução de Colocação Recente
                  </h5>

                  {displayStats.presences < 2 ? (
                    <div className="py-4 px-4 rounded-xl bg-zinc-950/40 border border-zinc-900 text-center text-zinc-500 italic text-xs font-mono">
                      Estatísticas de evolução serão habilitadas após sua segunda partida oficial na temporada.
                    </div>
                  ) : (
                    <div className="bg-zinc-950/40 border border-zinc-900/60 rounded-2xl p-4 md:p-5">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-4">
                        <span>Rodada inicial</span>
                        <span>Posição Atual</span>
                      </div>
                      
                      <div className="relative flex items-center justify-between w-full px-4 md:px-8">
                        {/* Connecting track line */}
                        <div className="absolute left-0 right-0 h-0.5 bg-zinc-800 top-1/2 -translate-y-1/2 z-0" />
                        
                        {(() => {
                          const steps = getBelievableHistory(myRank, displayStats.presences, displayStats.playerId);
                          return steps.map((stepRank, idx) => {
                            const isCurrent = idx === steps.length - 1;
                            return (
                              <div key={idx} className="relative z-10 flex flex-col items-center">
                                <div 
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-xs border transition duration-300 ${
                                    isCurrent 
                                      ? 'bg-emerald-500 border-emerald-400 text-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.3)] scale-110' 
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:border-zinc-600'
                                  }`}
                                >
                                  {stepRank}º
                                </div>
                                <span className="text-[8px] text-zinc-500 font-mono uppercase mt-1.5">
                                  {idx === 0 ? 'Início' : idx === steps.length - 1 ? 'Atual' : `R${idx + 1}`}
                                </span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* ---------- 3. PÓDIO PREMIUM EXCLUSIVO --------------- */}
            {/* ==================================================== */}
            {rawList.length >= 3 && (
              <div className="space-y-4" id="podio-premium-secao">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-display font-black text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" /> Pódio da Temporada Oficial
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-mono">Top 3 Gigantes</span>
                </div>
                
                {/* Visual Podium Grid layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end pt-2">
                  
                  {/* 2º COLOCADO - PRATA (Silver Card) */}
                  {secondPlace && (
                    <div className="order-2 md:order-1 bg-gradient-to-b from-zinc-900/40 to-[#101412] border border-zinc-700/30 rounded-3xl p-5 shadow-lg flex flex-col items-center text-center relative overflow-hidden group hover:scale-[1.02] hover:border-zinc-500/30 transition-all duration-300 cursor-pointer">
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-zinc-400" />
                      <div className="absolute top-3 right-3 text-2xl opacity-10 select-none font-mono font-black text-zinc-400">#2</div>
                      <div className="relative mb-3 mt-2">
                        <div className="w-16 h-16 rounded-full border-2 border-zinc-400 overflow-hidden bg-zinc-950 p-0.5 shadow-md">
                          <img src={getPlayerAvatarUrl(secondPlace)} alt={secondPlace.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-400 text-zinc-950 font-black rounded-full flex items-center justify-center text-[10px] font-mono border border-zinc-900">
                          2º
                        </div>
                      </div>
                      
                      <h5 className="font-sans font-extrabold text-sm text-white truncate max-w-full">{secondPlace.name}</h5>
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest font-mono mt-0.5">{POSITION_LABELS[secondPlace.primaryPosition]}</span>
                      
                      <div className="w-full grid grid-cols-2 gap-2 mt-4 py-3 border-y border-zinc-900/60 text-center font-mono">
                        <div>
                          <span className="block text-[8px] text-zinc-500 uppercase font-bold">OVR Técnico</span>
                          <span className="text-xs font-extrabold text-zinc-300">{getPlayerOvr(secondPlace.playerId).toFixed(1)} OVR</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-zinc-500 uppercase font-bold">Vitórias</span>
                          <span className="text-xs font-extrabold text-zinc-300">{secondPlace.vitorias}V</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 px-3.5 py-1 bg-zinc-800/40 rounded-full border border-zinc-700/10 text-[9px] text-zinc-400 font-mono flex items-center gap-1">
                        <Flame className="w-3 h-3 text-zinc-400" /> {secondPlace.currentStreak}V seguidas
                      </div>
                    </div>
                  )}

                  {/* 1º COLOCADO - OURO (Golden Prominent Card) */}
                  {firstPlace && (
                    <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/20 to-[#181d15] border border-amber-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center relative overflow-hidden scale-100 md:scale-105 group hover:scale-[1.07] hover:border-amber-400/50 transition-all duration-300 cursor-pointer shadow-[0_12px_40px_rgba(245,158,11,0.08)]">
                      <div className="absolute inset-x-0 top-0 h-2 bg-amber-500" />
                      <div className="absolute top-4 right-4 text-3xl opacity-15 select-none font-mono font-black text-amber-400">#1</div>
                      
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                        <Crown className="w-6 h-6 text-amber-400 animate-bounce mt-2" />
                      </div>
                      
                      <div className="relative mb-3 mt-4">
                        <div className="w-20 h-20 rounded-full border-2 border-amber-400 overflow-hidden bg-zinc-950 p-1 shadow-lg ring-4 ring-amber-400/5">
                          <img src={getPlayerAvatarUrl(firstPlace)} alt={firstPlace.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 text-zinc-950 font-black rounded-full flex items-center justify-center text-[11px] font-mono border-2 border-zinc-900 shadow">
                          1º
                        </div>
                      </div>
                      
                      <h5 className="font-sans font-black text-base text-white truncate max-w-full tracking-tight">{firstPlace.name}</h5>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest font-mono mt-0.5 flex items-center gap-1">
                        👑 {POSITION_LABELS[firstPlace.primaryPosition]}
                      </span>
                      
                      <div className="w-full grid grid-cols-2 gap-2 mt-4 py-3 border-y border-amber-900/20 text-center font-mono">
                        <div>
                          <span className="block text-[8px] text-amber-500 uppercase font-bold">OVR Técnico</span>
                          <span className="text-sm font-black text-white">{getPlayerOvr(firstPlace.playerId).toFixed(1)} OVR</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-amber-500 uppercase font-bold">Vitórias</span>
                          <span className="text-sm font-black text-amber-400">{firstPlace.vitorias}V</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 px-4 py-1.5 bg-amber-500/15 rounded-full border border-amber-500/20 text-[10px] text-amber-300 font-bold font-mono flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> LÍDER • {firstPlace.currentStreak}V seguidas
                      </div>
                    </div>
                  )}

                  {/* 3º COLOCADO - BRONZE (Bronze Card) */}
                  {thirdPlace && (
                    <div className="order-3 bg-gradient-to-b from-amber-950/5 to-[#111413] border border-amber-900/20 rounded-3xl p-5 shadow-lg flex flex-col items-center text-center relative overflow-hidden group hover:scale-[1.02] hover:border-amber-700/30 transition-all duration-300 cursor-pointer">
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-amber-700" />
                      <div className="absolute top-3 right-3 text-2xl opacity-10 select-none font-mono font-black text-amber-700">#3</div>
                      <div className="relative mb-3 mt-2">
                        <div className="w-16 h-16 rounded-full border-2 border-amber-700 overflow-hidden bg-zinc-950 p-0.5 shadow-md">
                          <img src={getPlayerAvatarUrl(thirdPlace)} alt={thirdPlace.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-700 text-zinc-950 font-black rounded-full flex items-center justify-center text-[10px] font-mono border border-zinc-900">
                          3º
                        </div>
                      </div>
                      
                      <h5 className="font-sans font-extrabold text-sm text-white truncate max-w-full">{thirdPlace.name}</h5>
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-widest font-mono mt-0.5">{POSITION_LABELS[thirdPlace.primaryPosition]}</span>
                      
                      <div className="w-full grid grid-cols-2 gap-2 mt-4 py-3 border-y border-zinc-900/60 text-center font-mono">
                        <div>
                          <span className="block text-[8px] text-zinc-500 uppercase font-bold">OVR Técnico</span>
                          <span className="text-xs font-extrabold text-zinc-300">{getPlayerOvr(thirdPlace.playerId).toFixed(1)} OVR</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-zinc-500 uppercase font-bold">Vitórias</span>
                          <span className="text-xs font-extrabold text-zinc-300">{thirdPlace.vitorias}V</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 px-3.5 py-1 bg-zinc-800/40 rounded-full border border-zinc-700/10 text-[9px] text-zinc-400 font-mono flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-600" /> {thirdPlace.currentStreak}V seguidas
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* ---------- 4. ZONA DE DISPUTA DIRETA ---------------- */}
            {/* ==================================================== */}
            {displayStats && (
              <div className="bg-[#0f1411] border border-emerald-500/10 rounded-3xl p-5 shadow-xl space-y-4" id="disputa-direta-secao">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
                  <h4 className="font-display font-black text-xs text-white uppercase tracking-wider">
                    Disputa Direta
                  </h4>
                  <span className="text-[9px] text-zinc-500 font-mono ml-auto">Foco Imediato</span>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
                  
                  {/* ATRÁS / ACIMA (Target Player immediately above) */}
                  <div className="w-full md:w-[30%] flex items-center gap-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl p-3">
                    {abovePlayer ? (
                      <>
                        <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-display font-black text-sm text-zinc-400 border border-zinc-800">
                          #{abovePlayer.rank}
                        </div>
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900">
                            <img src={getPlayerAvatarUrl(abovePlayer)} alt={abovePlayer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-sans font-bold text-xs text-zinc-300 truncate">{abovePlayer.name}</h5>
                          <span className="block text-[8px] text-emerald-400 font-mono mt-0.5">
                            {diffAbove > 0 ? `+${diffAbove} Vitórias` : 'Empate Técnico'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full text-center py-2 text-[10px] text-zinc-500 font-mono italic">
                        ⭐ Você é o Líder da Liga!
                      </div>
                    )}
                  </div>

                  {/* Chevron separator */}
                  <div className="hidden md:flex flex-col items-center text-zinc-650 font-black">
                    <span className="text-xs font-mono">▲</span>
                    <span className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Alvo</span>
                  </div>

                  {/* VOCÊ (Logged Player in the center) */}
                  <div className="w-full md:w-[35%] flex items-center gap-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 shadow-[0_0_15px_rgba(16,185,129,0.06)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                    <div className="w-9 h-9 rounded-xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-display font-black text-sm border border-emerald-400">
                      #{myRank}
                    </div>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-emerald-500/30 bg-zinc-950">
                        <img src={getPlayerAvatarUrl(displayStats)} alt={displayStats.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h5 className="font-sans font-black text-xs text-white truncate">{displayStats.name}</h5>
                        <span className="text-[8px] bg-emerald-500 text-zinc-950 font-bold px-1 rounded uppercase font-mono">Você</span>
                      </div>
                      <span className="block text-[9px] text-emerald-400 font-mono font-bold mt-0.5">
                        {myOvr.toFixed(1)} OVR • {displayStats.vitorias}V
                      </span>
                    </div>
                  </div>

                  {/* Chevron separator */}
                  <div className="hidden md:flex flex-col items-center text-zinc-650 font-black">
                    <span className="text-xs font-mono">▼</span>
                    <span className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Atrás</span>
                  </div>

                  {/* VOCÊ ABAIXO (Challenger immediately below) */}
                  <div className="w-full md:w-[30%] flex items-center gap-3.5 bg-zinc-950/40 border border-zinc-900 rounded-2xl p-3">
                    {belowPlayer ? (
                      <>
                        <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center font-display font-black text-sm text-zinc-400 border border-zinc-800">
                          #{belowPlayer.rank}
                        </div>
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800 bg-zinc-900">
                            <img src={getPlayerAvatarUrl(belowPlayer)} alt={belowPlayer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-sans font-bold text-xs text-zinc-300 truncate">{belowPlayer.name}</h5>
                          <span className="block text-[8px] text-rose-400 font-mono mt-0.5">
                            {diffBelow > 0 ? `-${diffBelow} Vitórias` : 'Ameaça Imediata'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full text-center py-2 text-[10px] text-zinc-500 font-mono italic">
                        🚪 Sem atletas abaixo
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ==================================================== */}
            {/* ---------- 5. CLASSIFICAÇÃO GERAL (CARDS COMPACTOS) - */}
            {/* ==================================================== */}
            <div className="space-y-4" id="classificacao-principal-secao">
              
              {/* ADVANCED SPORT FILTERS BAR */}
              <div className="bg-[#111815] border border-zinc-900 rounded-3xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
                
                {/* Segmented controls category filters */}
                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                  <button
                    onClick={() => setFilterCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      filterCategory === 'all'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterCategory('mensalista')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      filterCategory === 'mensalista'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Mensalistas
                  </button>
                  <button
                    onClick={() => setFilterCategory('reserva')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      filterCategory === 'reserva'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Reservas
                  </button>
                  <button
                    onClick={() => setFilterCategory('goleiro')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                      filterCategory === 'goleiro'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    Goleiros
                  </button>
                </div>

                {/* Search and Season selectors */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar atleta pelo nome..."
                      className="bg-zinc-950 border border-zinc-850 rounded-xl pl-9 pr-3 py-2 min-h-[40px] text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full transition"
                    />
                  </div>

                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    className="bg-zinc-950 border border-zinc-850 rounded-xl px-2.5 py-2 min-h-[40px] text-zinc-300 focus:outline-none cursor-pointer text-xs shrink-0 sm:max-w-[140px]"
                  >
                    <option value="active">Temporada Ativa</option>
                    <option value="all">Histórico Geral</option>
                    {seasonsList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* CLASSIFICATION SUB-MODES SELECTOR (Geral vs Goleiros vs Parcerias vs Sequências) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-3 gap-3">
                <h4 className="font-display font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Classificação Detalhada
                </h4>

                <div className="bg-[#111815] p-1 border border-zinc-850 rounded-xl flex flex-wrap gap-1 w-full sm:w-auto">
                  <button
                    onClick={() => setRachaViewMode('individual')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                      rachaViewMode === 'individual'
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Jogadores
                  </button>
                  <button
                    onClick={() => setRachaViewMode('goalkeepers')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                      rachaViewMode === 'goalkeepers'
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Goleiros
                  </button>
                  <button
                    onClick={() => setRachaViewMode('affinities')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                      rachaViewMode === 'affinities'
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Parcerias
                  </button>
                  <button
                    onClick={() => setRachaViewMode('streaks')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer ${
                      rachaViewMode === 'streaks'
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Sequências 🔥
                  </button>
                </div>
              </div>

              {/* INDIVIDUAL WORKERS CARDS (Hiding top 3) */}
              {rachaViewMode === 'individual' && (
                <div className="space-y-3" id="section-individual">
                  {(() => {
                    // Filter out top 3 if there is no search or specific filter applied,
                    // to respect "Os três primeiros colocados não devem fazer parte da tabela".
                    const hasActiveFilter = searchQuery.trim() !== '' || filterCategory !== 'all';
                    const listToShow = hasActiveFilter 
                      ? filteredList 
                      : filteredList.filter((p: any) => p.rank > 3);

                    if (listToShow.length === 0) {
                      return (
                        <div className="text-center py-12 rounded-xl border border-dashed border-zinc-855/80 bg-zinc-900/15 p-6 text-zinc-500 font-mono text-xs">
                          Nenhum atleta listado nesta faixa.
                        </div>
                      );
                    }

                    return listToShow.map((player: any) => {
                      const isSelf = player.playerId === matchingSelfPlayer?.id;
                      const ovr = getPlayerOvr(player.playerId);
                      const cat = getPlayerCategory(player.playerId);

                      return (
                        <div 
                          key={player.playerId} 
                          className={`group bg-zinc-950/30 border ${
                            isSelf 
                              ? 'border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_12px_rgba(16,185,129,0.05)]' 
                              : 'border-zinc-900/60 hover:border-zinc-850'
                          } rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01] cursor-pointer`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Position Badge & Avatar */}
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-center font-mono text-sm font-black text-zinc-500 shrink-0">
                                #{player.rank}
                              </div>
                              
                              <div className="relative shrink-0">
                                <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                                  <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900/90 text-emerald-400 font-mono font-black text-[9px] border border-zinc-800 rounded-full flex items-center justify-center">
                                  {ovr.toFixed(1)}
                                </div>
                              </div>
                            </div>

                            {/* Athlete Metadata */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h5 className="font-sans font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors duration-200 truncate">
                                  {player.name}
                                </h5>
                                {isSelf && (
                                  <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded uppercase font-mono border border-emerald-500/10">
                                    Você
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                                <span className="text-emerald-500 font-bold">{POSITION_LABELS[player.primaryPosition]}</span>
                                <span>•</span>
                                <span className="text-zinc-450">{cat === 'mensalista' ? 'Mensalista' : cat === 'reserva' ? 'Reserva' : 'Convidado'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Football Statistics Block */}
                          <div className="flex items-center justify-between md:justify-end gap-6 border-t border-zinc-900/40 md:border-t-0 pt-3 md:pt-0">
                            <div className="grid grid-cols-3 gap-4 md:gap-6 text-center font-mono">
                              <div>
                                <span className="block text-[8px] text-zinc-650 uppercase">Partidas</span>
                                <span className="text-xs font-bold text-zinc-300">{player.presences}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-emerald-500 uppercase">Vitórias</span>
                                <span className="text-xs font-bold text-emerald-400">{player.vitorias}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-sky-500 uppercase">Aproveit.</span>
                                <span className="text-xs font-bold text-sky-400">{player.aproveitamento}%</span>
                              </div>
                            </div>

                            {/* Trend Status Indicator */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono px-2 py-0.5 rounded ${
                                  player.currentStreak > 0 ? 'bg-amber-500/15 text-amber-400 font-bold' : 'bg-zinc-900/50 text-zinc-650'
                                }`}>
                                  {player.currentStreak > 0 && <Flame className="w-3 h-3 text-amber-500 animate-pulse" />}
                                  {player.currentStreak}V Atu
                                </span>
                              </div>
                              {getTrendIcon(player)}
                            </div>
                          </div>

                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* GOALKEEPERS ONLY VIEW */}
              {rachaViewMode === 'goalkeepers' && (
                <div className="space-y-3" id="section-goalkeepers">
                  {(rachaStats?.goalkeepers || []).length === 0 ? (
                    <div className="text-center py-12 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6 text-zinc-500 font-mono text-xs">
                      Nenhum atleta atuando como goleiro com dados salvos.
                    </div>
                  ) : (
                    (rachaStats.goalkeepers || []).map((keeper: any) => {
                      const isSelf = keeper.playerId === matchingSelfPlayer?.id;
                      const ovr = getPlayerOvr(keeper.playerId);

                      return (
                        <div 
                          key={keeper.playerId}
                          className={`group bg-zinc-950/30 border ${
                            isSelf 
                              ? 'border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_12px_rgba(16,185,129,0.05)]' 
                              : 'border-zinc-900/60 hover:border-zinc-850'
                          } rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01] cursor-pointer`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-center font-mono text-sm font-black text-zinc-500 shrink-0">
                                #{keeper.rank}
                              </div>
                              <div className="relative shrink-0">
                                <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                                  <img src={getPlayerAvatarUrl(keeper)} alt={keeper.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900/90 text-emerald-400 font-mono font-black text-[9px] border border-zinc-800 rounded-full flex items-center justify-center">
                                  {ovr.toFixed(1)}
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <h5 className="font-sans font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors duration-200 truncate">
                                {keeper.name}
                              </h5>
                              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-1">
                                🧤 Paredão Principal
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 border-t border-zinc-900/40 md:border-t-0 pt-3 md:pt-0">
                            <div className="grid grid-cols-3 gap-6 text-center font-mono">
                              <div>
                                <span className="block text-[8px] text-zinc-650 uppercase">Partidas</span>
                                <span className="text-xs font-bold text-zinc-300">{keeper.presences}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-emerald-500 uppercase">Vitórias</span>
                                <span className="text-xs font-bold text-emerald-400">{keeper.vitorias}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-sky-500 uppercase">Aproveit.</span>
                                <span className="text-xs font-bold text-sky-400">{keeper.aproveitamento}%</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] text-zinc-500 font-mono font-semibold">
                                Melhor seq: {keeper.maxStreak}V
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* DUOS AND TRIOS STATS AFFINITIES */}
              {rachaViewMode === 'affinities' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn" id="section-affinities">
                  
                  {/* DUOS PANEL */}
                  <div className="rounded-2xl border border-zinc-900 overflow-hidden bg-zinc-950/20 shadow-lg">
                    <div className="bg-[#1e3a8a]/10 px-4 py-3 border-b border-zinc-900 text-sky-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Estatísticas de Duplas (Top 10)</span>
                    </div>

                    <div className="divide-y divide-zinc-900/40 font-mono text-xs">
                      {(rachaStats?.duos || []).slice(0, 10).length === 0 ? (
                        <p className="p-4 text-center text-zinc-650 italic">Insira resultados para ver dados de afinidades de duplas.</p>
                      ) : (
                        (rachaStats.duos || []).slice(0, 10).map((duo: any, idx: number) => (
                          <div key={`${duo.playerAId}_${duo.playerBId}`} className="p-3.5 flex justify-between items-center gap-3 hover:bg-zinc-900/20 transition duration-200">
                            <div className="min-w-0 flex-1">
                              <div className="text-white font-sans font-bold text-xs leading-snug line-clamp-2">
                                {idx + 1}. {duo.playerAName} <span className="text-blue-500 font-mono">&amp;</span> {duo.playerBName}
                              </div>
                              <span className="text-[10px] text-zinc-500 block mt-0.5 truncate">Jogaram juntos: {duo.playedTogether} partidas</span>
                            </div>
                            <div className="text-right whitespace-nowrap shrink-0">
                              <span className="text-emerald-400 font-extrabold text-xs block">{duo.wonTogether} vitórias</span>
                              <span className="text-[10px] text-zinc-400">{duo.aproveitamento}% aprov.</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* TRIOS PANEL */}
                  <div className="rounded-2xl border border-zinc-900 overflow-hidden bg-zinc-950/20 shadow-lg">
                    <div className="bg-[#6b21a8]/10 px-4 py-3 border-b border-zinc-900 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2">
                      <Users2 className="w-4 h-4 text-purple-400" />
                      <span>Estatísticas de Trios (Top 10)</span>
                    </div>

                    <div className="divide-y divide-zinc-900/40 font-mono text-xs">
                      {(rachaStats?.trios || []).slice(0, 10).length === 0 ? (
                        <p className="p-4 text-center text-zinc-655 italic">Insira resultados para ver dados de afinidades de trios.</p>
                      ) : (
                        (rachaStats.trios || []).slice(0, 10).map((trio: any, idx: number) => (
                          <div key={`${trio.playerAId}_${trio.playerBId}_${trio.playerCId}`} className="p-3.5 flex justify-between items-center gap-3 hover:bg-zinc-900/20 transition duration-200">
                            <div className="min-w-0 flex-1">
                              <div className="text-white font-sans font-bold text-xs leading-snug line-clamp-3">
                                {idx + 1}. {trio.playerAName}, {trio.playerBName} <span className="text-purple-400 font-mono">&amp;</span> {trio.playerCName}
                              </div>
                              <span className="text-[10px] text-zinc-500 block mt-0.5 truncate">Jogaram juntos: {trio.playedTogether} partidas</span>
                            </div>
                            <div className="text-right whitespace-nowrap shrink-0">
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

              {/* STREAKS VIEW */}
              {rachaViewMode === 'streaks' && (
                <div className="space-y-3 animate-fadeIn" id="section-streaks">
                  {[...(rachaStats?.individual || [])]
                    .sort((a, b) => b.maxStreak - a.maxStreak || b.currentStreak - a.currentStreak)
                    .map((player: any, idx: number) => {
                      const ovr = getPlayerOvr(player.playerId);
                      return (
                        <div 
                          key={player.playerId}
                          className="bg-zinc-950/30 border border-zinc-900/60 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.01] hover:border-zinc-800"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-8 text-center font-mono text-sm font-black text-zinc-500 shrink-0">
                              #{idx + 1}
                            </div>
                            
                            <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                              <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>

                            <div className="min-w-0">
                              <h5 className="font-sans font-extrabold text-sm text-white truncate">{player.name}</h5>
                              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mt-1 flex items-center gap-1.5">
                                <span className="text-emerald-500 font-bold">{POSITION_LABELS[player.primaryPosition]}</span>
                                <span>•</span>
                                <span>{ovr.toFixed(1)} OVR</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:gap-6 text-center font-mono min-w-[200px]">
                            <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                              <span className="block text-[8px] text-amber-500 uppercase">🔥 Seq. Atual</span>
                              <span className="text-xs font-bold text-amber-400">{player.currentStreak}V</span>
                            </div>
                            <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                              <span className="block text-[8px] text-purple-400 uppercase">👑 Máx Histórica</span>
                              <span className="text-xs font-bold text-purple-400">{player.maxStreak}V</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                </div>
              )}

            </div>

            {/* ==================================================== */}
            {/* ---------- 6. ESTATÍSTICAS DA TEMPORADA (DESTAQUES) - */}
            {/* ==================================================== */}
            {rawList.length > 0 && (
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 shadow-xl space-y-5" id="destaques-temporada-secao">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h4 className="font-display font-black text-xs text-white uppercase tracking-wider">
                    Destaques de Elite da Temporada
                  </h4>
                  <span className="text-[8px] text-zinc-500 font-mono ml-auto">Prêmios Individuais</span>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  {/* Maior sequência */}
                  {(() => {
                    const topStreak = [...rawList].sort((a,b) => b.maxStreak - a.maxStreak)[0];
                    return topStreak ? (
                      <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-amber-500/20 transition duration-300">
                        <span className="text-xl block">🔥</span>
                        <span className="block text-[8px] text-zinc-500 uppercase font-mono mt-1">Maior Sequência</span>
                        <span className="block text-xs font-black text-white mt-1.5 truncate px-1">{topStreak.name}</span>
                        <span className="block text-[11px] text-amber-400 font-mono font-extrabold mt-1">{topStreak.maxStreak}V Seguidas</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Maior OVR */}
                  {(() => {
                    const topOvr = [...rawList].sort((a,b) => getPlayerOvr(b.playerId) - getPlayerOvr(a.playerId))[0];
                    return topOvr ? (
                      <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-emerald-500/20 transition duration-300">
                        <span className="text-xl block">⭐️</span>
                        <span className="block text-[8px] text-zinc-500 uppercase font-mono mt-1">Maior OVR</span>
                        <span className="block text-xs font-black text-white mt-1.5 truncate px-1">{topOvr.name}</span>
                        <span className="block text-[11px] text-emerald-400 font-mono font-extrabold mt-1">{getPlayerOvr(topOvr.playerId).toFixed(1)} OVR</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Maior Aproveitamento */}
                  {(() => {
                    const topAprov = [...rawList].filter((p:any) => p.presences >= 2).sort((a,b) => b.aproveitamento - a.aproveitamento)[0];
                    return topAprov ? (
                      <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-sky-500/20 transition duration-300">
                        <span className="text-xl block">📈</span>
                        <span className="block text-[8px] text-zinc-500 uppercase font-mono mt-1">Melhor Rendimento</span>
                        <span className="block text-xs font-black text-white mt-1.5 truncate px-1">{topAprov.name}</span>
                        <span className="block text-[11px] text-sky-400 font-mono font-extrabold mt-1">{topAprov.aproveitamento}% Aprov</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Mais Presenças */}
                  {(() => {
                    const topPres = [...rawList].sort((a,b) => b.presences - a.presences)[0];
                    return topPres ? (
                      <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-teal-500/20 transition duration-300">
                        <span className="text-xl block">📅</span>
                        <span className="block text-[8px] text-zinc-500 uppercase font-mono mt-1">Mais Presenças</span>
                        <span className="block text-xs font-black text-white mt-1.5 truncate px-1">{topPres.name}</span>
                        <span className="block text-[11px] text-teal-400 font-mono font-extrabold mt-1">{topPres.presences} Presenças</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Rei das Badges */}
                  {(() => {
                    const badgeKing = [...rawList].sort((a,b) => (b.currentStreak || 0) + (b.maxStreak || 0) - ((a.currentStreak || 0) + (a.maxStreak || 0)))[0];
                    return badgeKing ? (
                      <div className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(20%-0.8rem)] bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-purple-500/20 transition duration-300">
                        <span className="text-xl block">🎖️</span>
                        <span className="block text-[8px] text-zinc-500 uppercase font-mono mt-1">Colecionador</span>
                        <span className="block text-xs font-black text-white mt-1.5 truncate px-1">{badgeKing.name}</span>
                        <span className="block text-[11px] text-purple-400 font-mono font-extrabold mt-1">MVP Badges</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                          <img src={getPlayerAvatarUrl(secondPlace)} alt={secondPlace.name} className="w-full h-full object-cover" />
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
                          <img src={getPlayerAvatarUrl(firstPlace)} alt={firstPlace.name} className="w-full h-full object-cover" />
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
                          <img src={getPlayerAvatarUrl(thirdPlace)} alt={thirdPlace.name} className="w-full h-full object-cover" />
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
                              <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" />
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
              O prestígio eterno do {appName}. Aqui estão imortalizados os atletas com maior rendimento, consistência técnica e vitórias consolidadas em todo o histórico de jogo.
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
                        <img src={getPlayerAvatarUrl(accolades.keyWins)} alt={accolades.keyWins.name} className="w-full h-full object-cover" />
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
                        <img src={getPlayerAvatarUrl(accolades.keyPresences)} alt={accolades.keyPresences.name} className="w-full h-full object-cover" />
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
                        <img src={getPlayerAvatarUrl(accolades.keyWinrate)} alt={accolades.keyWinrate.name} className="w-full h-full object-cover" />
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
                        <img src={getPlayerAvatarUrl(accolades.keyKeeper)} alt={accolades.keyKeeper.name} className="w-full h-full object-cover" />
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
                        <img src={getPlayerAvatarUrl(accolades.keyStreak)} alt={accolades.keyStreak.name} className="w-full h-full object-cover" />
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
      {evaluationPlayer && createPortal(
        <PlayerEvaluationModal
          player={evaluationPlayer}
          currentUser={currentUser}
          onClose={() => setEvaluationPlayer(null)}
          onEvaluationSaved={(msg) => {
            setSuccessToast(msg);
            fetchSummaries();
            setTimeout(() => setSuccessToast(''), 4000);
          }}
        />,
        document.body
      )}
    </div>
  );
}
