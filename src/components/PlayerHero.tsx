import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { motion } from 'motion/react';
import {
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Award,
  Activity,
  ChevronRight,
  Zap,
  Trophy,
  Sparkles,
  X
} from 'lucide-react';
import { Player, POSITION_LABELS, CATEGORY_LABELS, STATUS_LABELS } from '../types';
import { ClubShield } from './PlayerCard';
import { SportsBadge, SportsIndicator, VISUAL_TOKENS } from './UI';

interface PlayerHeroProps {
  player: Player;
  currentUser?: { id: string; role?: string } | null;
  metricsProp?: any;
  rachaStatsProp?: any;
  isAdmin?: boolean;
  onActionClick?: () => void;
  className?: string;
}

export const PlayerHero: React.FC<PlayerHeroProps> = ({
  player,
  currentUser,
  metricsProp,
  rachaStatsProp,
  isAdmin = false,
  onActionClick,
  className = '',
}) => {
  const [metrics, setMetrics] = useState<any>(metricsProp || null);
  const [rachaStats, setRachaStats] = useState<any>(rachaStatsProp || null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [loading, setLoading] = useState(!metricsProp || !rachaStatsProp);
  const [personalHistory, setPersonalHistory] = useState<{
    vitorias: number;
    derrotas: number;
    empates: number;
    presences: number;
    recentResults: ('V' | 'D' | 'E' | 'NP')[];
  }>({
    vitorias: 0,
    derrotas: 0,
    empates: 0,
    presences: 0,
    recentResults: [],
  });

  // Fetch metrics and stats dynamically if not provided as props
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const evalUserId = currentUser?.id || 'guest';
        
        const [evalsRes, statsRes, resultsRes] = await Promise.all([
          authFetch(`/api/players/${player.id}/evaluations?evaluatorUserId=${evalUserId}`),
          authFetch('/api/stats'),
          authFetch('/api/results')
        ]);

        if (!active) return;
        if (evalsRes.ok && !metricsProp) {
          const data = await evalsRes.json();
          setMetrics(data.metrics);
        }

        let fetchedRachaStats = rachaStatsProp;
        if (statsRes.ok && !rachaStatsProp) {
          const statsData = await statsRes.json();
          const found = (statsData.individual || []).find((s: any) => s.playerId === player.id);
          if (found) {
            fetchedRachaStats = found;
            setRachaStats(found);
          }
        }

        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          const sortedResults = [...resultsData];
          let pWins = 0;
          let pLosses = 0;
          let pDraws = 0;
          let pPresences = 0;

          const last5Results = sortedResults.slice(-5);
          const recentOutcomes = last5Results.map(resObj => {
            const isGoalkeeper = player.primaryPosition === 'goleiro';
            const blueTeam = resObj.teams?.find((t: any) => t.name === 'Azul')?.playerIds || [];
            const redTeam = resObj.teams?.find((t: any) => t.name === 'Vermelho')?.playerIds || [];
            const greenTeam = resObj.teams?.find((t: any) => t.name === 'Verde')?.playerIds || [];

            const isBlue = blueTeam.includes(player.id);
            const isRed = redTeam.includes(player.id);
            const isGreen = greenTeam.includes(player.id);

            const hasPlayed = isBlue || isRed || isGreen;
            if (!hasPlayed) return 'NP';

            pPresences++;
            const champTeams = resObj.champions || [];
            if (resObj.isSharedGoalkeepers && isGoalkeeper) {
              pWins++;
              return champTeams.length > 0 ? 'V' : 'E';
            }

            const playerTeam = isBlue ? 'Azul' : isRed ? 'Vermelho' : isGreen ? 'Verde' : null;
            if (!playerTeam) return 'NP';

            if (champTeams.length === 0 || champTeams.length > 1) {
              pDraws++;
              return 'E';
            }
            if (champTeams.includes(playerTeam)) {
              pWins++;
              return 'V';
            }
            pLosses++;
            return 'D';
          });

          setPersonalHistory({
            vitorias: fetchedRachaStats?.vitorias || pWins,
            derrotas: fetchedRachaStats?.derrotas || pLosses,
            empates: fetchedRachaStats?.empates || pDraws,
            presences: fetchedRachaStats?.presences || pPresences,
            recentResults: recentOutcomes
          });
        }
      } catch (err) {
        console.error('Error fetching PlayerHero data:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [player.id, currentUser?.id, metricsProp, rachaStatsProp]);

  // Derived attributes
  const displayOvr = (metrics?.overall ?? 3.5).toFixed(1);
  const activeStreak = player.currentStreak || rachaStats?.currentStreak || 0;
  const rank = rachaStats?.rank || null;
  const presencesCount = metrics?.presencesCount || personalHistory.presences || 0;
  const absCount = metrics?.absencesCount || 0;
  const winsCount = personalHistory.vitorias || 0;
  const matchCount = rachaStats?.presences || personalHistory.presences || 0;
  const winRate = rachaStats?.aproveitamento || (matchCount > 0 ? Math.round((winsCount / matchCount) * 100) : 0);

  // Evolutions (simulating structured metrics history from current and baseline or older average)
  // Baseline OVR is 3.5. Baseline Rank is 10.
  const baselineOvr = 3.5;
  const previousOvr = metrics?.previousOverall || baselineOvr;
  const ovrDiff = parseFloat(displayOvr) - previousOvr;

  const previousRank = rachaStats?.previousRank || 8; // Default previous rank if none exists
  const rankDiff = rank ? previousRank - rank : 0; // Rank diff (positive means rank improved, e.g. from 5 to 4)

  // Custom Badges lists calculations matches PlayerCard.tsx
  const getPlayerBadges = () => {
    const isGk = player.primaryPosition === 'goleiro';
    const badgesList = [
      {
        id: 'primeira_vitoria',
        icon: '🏆',
        name: 'Primeira Vitória',
        desc: 'Venceu pelo menos uma rodada.',
        unlocked: winsCount >= 1,
        progress: winsCount,
        target: 1,
      },
      {
        id: 'em_chamas',
        icon: '🔥',
        name: 'Em Chamas',
        desc: '5 vitórias consecutivas.',
        unlocked: activeStreak >= 5,
        progress: activeStreak,
        target: 5,
      },
      {
        id: 'frequentador',
        icon: '📅',
        name: 'Frequentador',
        desc: 'Completou 10 partidas.',
        unlocked: matchCount >= 10,
        progress: matchCount,
        target: 10,
      },
      {
        id: 'patrimonio',
        icon: '🗿',
        name: 'Patrimônio',
        unlocked: matchCount >= 50,
        desc: 'Atingiu 50 presenças.',
        progress: matchCount,
        target: 50,
      }
    ];

    if (isGk) {
      badgesList.push({
        id: 'muralha',
        icon: '🧱',
        name: 'Muralha',
        desc: '5 partidas no gol.',
        unlocked: matchCount >= 5,
        progress: matchCount,
        target: 5,
      });
    }

    return badgesList;
  };

  const allBadges = getPlayerBadges();
  const unlockedBadges = allBadges.filter(b => b.unlocked).slice(0, 3);
  const nextBadge = allBadges.find(b => !b.unlocked) || null;

  // Progression bars calculations
  const currentOvrNum = parseFloat(displayOvr);
  const nextOvrObjective = Math.min(5.0, Math.floor(currentOvrNum * 10 + 1) / 10);
  const ovrProgressPercent = Math.min(100, Math.max(0, ((currentOvrNum - Math.floor(currentOvrNum)) * 10) * 10));

  const currentRankNum = rank || 10;
  const nextRankObjective = Math.max(1, currentRankNum - 1);
  const rankProgressPercent = rank === 1 ? 100 : Math.min(100, Math.max(15, (10 - currentRankNum) * 10));

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 space-y-6 animate-pulse">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
          <div className="h-4 bg-zinc-800 rounded w-28" />
          <div className="h-6 bg-zinc-800 rounded-lg w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 h-32 bg-zinc-800 rounded-xl" />
          <div className="md:col-span-8 h-32 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* MAIN CONTAINER COMPLYING WITH SPORTS HERO */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`rounded-3xl border border-zinc-850 bg-gradient-to-br from-zinc-950 via-[#0c1611]/60 to-zinc-950 p-6 relative overflow-hidden shadow-2xl ${VISUAL_TOKENS.shadows.glowGreen}`}
      >
        {/* Pitch Lines background overlay for Premium look */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* TOP METADATA BAR */}
        <div className="flex justify-between items-center gap-4 border-b border-zinc-900/80 pb-4 relative z-10">
          <div className="flex items-center gap-2">
            <SportsBadge variant={player.category === 'mensalista' ? 'success' : 'muted'}>
              ⚽ {CATEGORY_LABELS[player.category]}
            </SportsBadge>
            {isAdmin && (
              <SportsBadge variant="warning">
                🛡️ Administrador
              </SportsBadge>
            )}
          </div>
          <SportsIndicator status={player.status === 'disponivel' ? 'active' : 'warning'} label={STATUS_LABELS[player.status]} />
        </div>

        {/* TWO-COLUMN LAYOUT ON DESKTOP, AUTOMATICALLY REORGANIZING FOR MOBILE (ZONAS 1 & 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 relative z-10 items-center">
          
          {/* ZONA 1 — IDENTIDADE (Left column) */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            {/* AVATAR DE IA OU ORIGINAL */}
            <div className="relative group">
              <div
                onClick={() => {
                  if (player.avatarEsportivo || player.photoOriginal) setIsPhotoExpanded(true);
                }}
                className={`w-28 h-28 rounded-full overflow-hidden border-2 border-emerald-500/30 group-hover:border-emerald-500/60 transition-all duration-300 shadow-xl relative bg-zinc-900 flex items-center justify-center ${
                  player.avatarEsportivo || player.photoOriginal ? 'cursor-zoom-in' : ''
                }`}
              >
                {player.avatarEsportivo || player.photoOriginal ? (
                  <img
                    src={player.avatarEsportivo || player.photoOriginal}
                    alt={player.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <User className="w-12 h-12 text-zinc-600" />
                )}

                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-full border border-emerald-400/20 animate-pulse" />
              </div>

              {/* FAV ICON CORAÇÃO ESCUDO DEITADO */}
              {player.favoriteTeamId && (
                <div className="absolute -bottom-1 -right-1 bg-zinc-950 p-1.5 rounded-full border border-zinc-800 shadow-lg">
                  <ClubShield clubId={player.favoriteTeamId} className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* LIGHTBOX: foto ampliada ao clicar no avatar */}
            {isPhotoExpanded && (player.avatarEsportivo || player.photoOriginal) && (
              <div
                onClick={() => setIsPhotoExpanded(false)}
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out animate-fadeIn"
              >
                <button
                  onClick={() => setIsPhotoExpanded(false)}
                  className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700 rounded-full text-white transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={player.avatarEsportivo || player.photoOriginal}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-full max-h-[85vh] rounded-2xl border-2 border-emerald-500/30 shadow-2xl object-contain"
                />
              </div>
            )}

            {/* PLAYER INFO AND NAME */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2.5">
                <h1 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight leading-none">
                  {player.name}
                </h1>
                <Sparkles className="w-4 h-4 text-emerald-400 opacity-80 animate-pulse hidden sm:inline" />
              </div>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span className="text-[11px] font-mono font-black text-zinc-400 uppercase tracking-wider bg-zinc-900/60 px-2.5 py-1 rounded-lg border border-zinc-850">
                  {POSITION_LABELS[player.primaryPosition]}
                </span>
                {player.timeDoCoracao && (
                  <span className="text-[11px] font-mono font-bold text-zinc-400">
                    Torce para: <strong className="text-zinc-200">{player.timeDoCoracao}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* OVR GIGANTE & QUICK STATS (Right column / Zona 1 OVR) */}
          <div className="lg:col-span-5 flex items-center justify-around bg-zinc-950/40 border border-zinc-900/60 p-5 rounded-2xl">
            {/* OVR BADGE */}
            <div className="text-center">
              <span className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">MÉDIA OVR</span>
              <div className="relative inline-block mt-1">
                <span className="font-display font-black text-5xl sm:text-6xl text-emerald-400 tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                  {displayOvr}
                </span>
              </div>
            </div>

            <div className="h-10 w-[1px] bg-zinc-800" />

            {/* ZONA 2 — STATUS (Quick info inside Identity Header) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase">RANKING</span>
                  <span className="font-sans font-extrabold text-sm text-zinc-100">
                    {rank ? `${rank}º Lugar` : 'Sem classificação'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <div>
                  <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase">SEQUÊNCIA</span>
                  <span className="font-sans font-extrabold text-sm text-zinc-100">
                    {activeStreak > 0 ? `${activeStreak} Vitórias` : 'Sem streak'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ZONA 3 — EVOLUÇÃO (Dynamic comparison card) */}
        <div className="mt-8 pt-6 border-t border-zinc-900/80 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* EVOLUÇÃO CARD COMPLYING WITH REQUIREMENT */}
          <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-4 flex flex-col justify-between">
            <h4 className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <Activity className="w-3.5 h-3.5" /> Evolução de Atleta
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              {/* OVR TRANSITION */}
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Nível Técnico (OVR)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono line-through">{previousOvr.toFixed(1)}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                  <span className="text-base text-white font-sans font-black">{displayOvr}</span>
                  {ovrDiff > 0 ? (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-0.5 font-mono animate-pulse">
                      <TrendingUp className="w-3 h-3" /> +{ovrDiff.toFixed(1)}
                    </span>
                  ) : ovrDiff < 0 ? (
                    <span className="text-[11px] text-rose-400 font-bold flex items-center gap-0.5 font-mono">
                      <TrendingDown className="w-3 h-3" /> {ovrDiff.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      <Minus className="w-3 h-3" /> 0.0
                    </span>
                  )}
                </div>
              </div>

              {/* RANKING TRANSITION */}
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-zinc-500 block uppercase">Posição Geral</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono">{previousRank}º</span>
                  <ChevronRight className="w-3 h-3 text-zinc-600" />
                  <span className="text-base text-white font-sans font-black">{rank ? `${rank}º` : '—'}</span>
                  {rankDiff > 0 ? (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-0.5 font-mono">
                      <TrendingUp className="w-3 h-3" /> ↑ {rankDiff} pos
                    </span>
                  ) : rankDiff < 0 ? (
                    <span className="text-[11px] text-rose-400 font-bold flex items-center gap-0.5 font-mono">
                      <TrendingDown className="w-3 h-3" /> ↓ {Math.abs(rankDiff)} pos
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      <Minus className="w-3 h-3" /> →
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PROGRESSÃO TARGET (OVR Target & Rank target progress visual bar) */}
          <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-4 space-y-4">
            <h4 className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Metas de Progressão
            </h4>

            {/* OVR PROGRESSION BAR */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono font-bold">
                <span className="text-zinc-400">Progresso de OVR ({displayOvr})</span>
                <span className="text-emerald-400">Próximo OVR: {nextOvrObjective.toFixed(1)}</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850 relative">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${ovrProgressPercent}%` }}
                />
              </div>
            </div>

            {/* RANK PROGRESSION BAR */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono font-bold">
                <span className="text-zinc-400">Progresso do Ranking ({rank ? `${rank}º` : '—'})</span>
                <span className="text-amber-400">Próximo Objetivo: {nextRankObjective === rank ? 'Líder Supremo 👑' : `${nextRankObjective}º`}</span>
              </div>
              <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-850 relative">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${rankProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* ZONA 4 — RESUMO / PLAYER STAT CARD GRID */}
        <div className="mt-6 pt-6 border-t border-zinc-900/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Partidas</span>
            <span className="block font-display font-black text-lg text-white font-mono">{matchCount}</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Vitórias</span>
            <span className="block font-display font-black text-lg text-white font-mono">{winsCount}</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Aproveitamento</span>
            <span className="block font-display font-black text-lg text-emerald-400 font-mono">{winRate}%</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Presenças</span>
            <span className="block font-display font-black text-lg text-white font-mono">{presencesCount}</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Faltas</span>
            <span className="block font-display font-black text-lg text-rose-400 font-mono">{absCount}</span>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-900 rounded-xl p-3 text-center space-y-1 hover:border-zinc-800 transition duration-200">
            <span className="block text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-wider">Badges</span>
            <span className="block font-display font-black text-lg text-amber-400 font-mono">{unlockedBadges.length}</span>
          </div>

        </div>

        {/* BOTTOM BADGES CONTAINER ACCORDING TO SPECS */}
        <div className="mt-6 pt-6 border-t border-zinc-900/80 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" /> Badges Recentes Desbloqueadas
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {unlockedBadges.length > 0 ? (
              unlockedBadges.map((badge, idx) => (
                <div 
                  key={badge.id}
                  className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-2.5 flex items-center gap-2.5 hover:border-amber-500/25 transition duration-200"
                >
                  <span className="text-xl shrink-0 leading-none">{badge.icon}</span>
                  <div className="space-y-0.5 leading-none">
                    <span className="font-sans font-bold text-amber-400 text-xs">{badge.name}</span>
                    <span className="block text-[9px] text-zinc-500 leading-tight">{badge.desc}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="sm:col-span-3 text-center py-4 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Nenhuma badge conquistada nesta temporada</span>
              </div>
            )}
          </div>

          {/* NEXT AVAILABLE BADGE WITH PROGRESS */}
          {nextBadge && (
            <div className="mt-4 bg-zinc-950/40 border border-zinc-900/70 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                <span className="text-zinc-500 uppercase tracking-wider flex items-center gap-1">🔒 Próxima Badge Disponível: <strong className="text-zinc-300 font-semibold">{nextBadge.name}</strong></span>
                <span className="text-amber-400 font-mono">{nextBadge.progress}/{nextBadge.target}</span>
              </div>
              <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(100, (nextBadge.progress / nextBadge.target) * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-zinc-500 font-mono italic">{nextBadge.desc}</p>
            </div>
          )}
        </div>

      </motion.div>
    </div>
  );
};
