import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Award, 
  Activity, 
  Star, 
  Calendar, 
  Zap, 
  Trophy, 
  Target, 
  Users, 
  User,
  Heart,
  CalendarCheck
} from 'lucide-react';
import { 
  Player, 
  POSITION_LABELS, 
  CATEGORY_LABELS, 
  STATUS_LABELS, 
  LINE_ATTRIBUTES, 
  GOALKEEPER_ATTRIBUTES
} from '../types';
import { SportsCard, SportsBadge } from './UI';
import { ClubShield } from './PlayerCard';

/**
 * Helper to render star rating stars safely
 */
export const renderStars = (rating: number, max = 5) => {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: max }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = rating >= starValue;
        const isHalf = !isFilled && rating >= (starValue - 0.5);
        return (
          <Star
            key={index}
            className={`w-3.5 h-3.5 ${
              isFilled
                ? 'fill-amber-400 text-amber-500'
                : isHalf
                  ? 'text-amber-500 fill-amber-500/30'
                  : 'text-zinc-700'
            }`}
          />
        );
      })}
    </div>
  );
};

/**
 * 1. PlayerStatCard Component
 */
interface PlayerStatCardProps {
  id?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  glowColor?: 'green' | 'sky' | 'purple' | 'none';
  onClick?: () => void;
}

export const PlayerStatCard: React.FC<PlayerStatCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  glowColor = 'none',
  onClick,
}) => {
  return (
    <SportsCard id={id} onClick={onClick} glowColor={glowColor} className="flex flex-col justify-between p-5 min-h-[135px]">
      <div className="flex justify-between items-start gap-2">
        <div className="space-y-1">
          <span className="block text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">{title}</span>
          <span className="block font-display font-black text-2xl text-white tracking-tight leading-none mt-1">{value}</span>
        </div>
        {icon && <div className="text-zinc-650 p-1.5 bg-zinc-900/40 rounded-xl border border-zinc-900/60">{icon}</div>}
      </div>

      <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-zinc-900/40">
        <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[70%]">{subtitle}</span>
        {trend && (
          <div className="flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
            {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
            {trend === 'neutral' && <Minus className="w-3.5 h-3.5 text-zinc-500" />}
            {trendLabel && <span className={`text-[9.5px] font-mono font-bold ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-zinc-500'}`}>{trendLabel}</span>}
          </div>
        )}
      </div>
    </SportsCard>
  );
};

/**
 * 2. PlayerPerformanceCard Component
 */
interface PlayerPerformanceCardProps {
  player: Player;
  metrics: any;
  className?: string;
}

export const PlayerPerformanceCard: React.FC<PlayerPerformanceCardProps> = ({
  player,
  metrics,
  className = '',
}) => {
  const isGk = player.primaryPosition === 'goleiro';
  const attributes = isGk ? GOALKEEPER_ATTRIBUTES : LINE_ATTRIBUTES;

  const getAttributeAverage = (attrId: string) => {
    if (metrics && metrics.computedAttributes && metrics.computedAttributes[attrId]) {
      return metrics.computedAttributes[attrId].average || 3.5;
    }
    return 3.5;
  };

  return (
    <SportsCard className={`p-6 space-y-4 ${className}`} glowColor="green">
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
          <Activity className="w-4 h-4" /> Atributos Técnicos
        </h3>
        <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase">
          Base: {metrics?.evalCount || 0} avaliações
        </span>
      </div>

      <div className="space-y-4 pt-1">
        {attributes.map((attr) => {
          const rating = getAttributeAverage(attr.id);
          const percent = (rating / 5.0) * 100;
          return (
            <div key={attr.id} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-sans font-extrabold text-zinc-250 uppercase tracking-wide text-[11px]">{attr.label}</span>
                <div className="flex items-center gap-2">
                  {renderStars(rating)}
                  <span className="font-mono font-black text-emerald-400 text-xs w-6 text-right">{rating.toFixed(1)}</span>
                </div>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900/60 relative">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SportsCard>
  );
};

/**
 * 3. PlayerAchievementsCard Component
 */
interface PlayerAchievementsCardProps {
  player: Player;
  rachaStats: any;
  metrics: any;
  className?: string;
}

export const PlayerAchievementsCard: React.FC<PlayerAchievementsCardProps> = ({
  player,
  rachaStats,
  metrics,
  className = '',
}) => {
  const matchCount = rachaStats?.presences || 0;
  const winsCount = rachaStats?.vitorias || 0;
  const activeStreak = rachaStats?.currentStreak || player.currentStreak || 0;

  const getPlayerBadges = () => {
    return [
      {
        id: 'primeira_vitoria',
        icon: '🏆',
        name: 'Primeira Vitória',
        desc: 'Venceu pelo menos uma rodada.',
        unlocked: winsCount >= 1,
        progress: winsCount,
        target: 1,
        rarity: 'Comum',
        rarityColor: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
      },
      {
        id: 'em_chamas',
        icon: '🔥',
        name: 'Em Chamas',
        desc: '5 vitórias consecutivas.',
        unlocked: activeStreak >= 5,
        progress: activeStreak,
        target: 5,
        rarity: 'Lendário',
        rarityColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      },
      {
        id: 'frequentador',
        icon: '📅',
        name: 'Frequentador',
        desc: 'Completou 10 partidas.',
        unlocked: matchCount >= 10,
        progress: matchCount,
        target: 10,
        rarity: 'Incomum',
        rarityColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      },
      {
        id: 'patrimonio',
        icon: '🗿',
        name: 'Patrimônio',
        desc: 'Atingiu 50 presenças.',
        unlocked: matchCount >= 50,
        progress: matchCount,
        target: 50,
        rarity: 'Místico',
        rarityColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      },
    ];
  };

  const badges = getPlayerBadges();
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const lockedBadges = badges.filter(b => !b.unlocked);
  const nextBadge = lockedBadges[0] || null;

  return (
    <SportsCard className={`p-6 space-y-5 ${className}`} glowColor="sky">
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
          <Award className="w-4 h-4" /> Conquistas da Temporada
        </h3>
        <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-lg border border-sky-500/15">
          {unlockedCount} / {badges.length} CONQUISTADO
        </span>
      </div>

      <div className="space-y-3.5">
        {badges.map((badge) => (
          <div 
            key={badge.id}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
              badge.unlocked 
                ? 'bg-emerald-950/5 border-emerald-900/30' 
                : 'bg-zinc-950/40 border-zinc-900/70 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0 leading-none">{badge.icon}</span>
              <div className="space-y-0.5">
                <span className={`font-sans font-bold text-xs ${badge.unlocked ? 'text-zinc-150' : 'text-zinc-500'}`}>
                  {badge.name}
                </span>
                <span className="block text-[10px] text-zinc-500 leading-snug">{badge.desc}</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <span className={`text-[8.5px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.rarityColor}`}>
                {badge.rarity}
              </span>
              <span className="text-[9.5px] font-mono text-zinc-400">
                {badge.unlocked ? '✓ Desbloqueada' : `${badge.progress}/${badge.target}`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {nextBadge && (
        <div className="mt-4 pt-4 border-t border-zinc-900 bg-sky-950/5 border border-sky-900/15 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold">
            <span className="text-zinc-400 uppercase tracking-wider">🔒 Foco da próxima Badge:</span>
            <span className="text-sky-400 font-mono">{nextBadge.name} ({nextBadge.progress}/{nextBadge.target})</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-sky-500 h-full rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(100, (nextBadge.progress / nextBadge.target) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </SportsCard>
  );
};

/**
 * 4. PlayerProgressCard Component
 */
interface PlayerProgressCardProps {
  player: Player;
  rachaStats: any;
  metrics: any;
  className?: string;
}

export const PlayerProgressCard: React.FC<PlayerProgressCardProps> = ({
  player,
  rachaStats,
  metrics,
  className = '',
}) => {
  const currentOvr = metrics?.overall || 3.5;
  const nextOvrTarget = Math.min(5.0, Math.floor(currentOvr * 10 + 1) / 10);
  const ovrProgressPercent = Math.min(100, Math.max(0, ((currentOvr - Math.floor(currentOvr)) * 10) * 10));

  const rank = rachaStats?.rank || 10;
  const nextRankTarget = Math.max(1, rank - 1);
  const rankProgressPercent = rank === 1 ? 100 : Math.min(100, Math.max(15, (10 - rank) * 10));

  // Visual text-based progress blocks simulating ██████░░░
  const buildAsciiBar = (percent: number) => {
    const totalBlocks = 10;
    const activeBlocks = Math.round((percent / 100) * totalBlocks);
    return '█'.repeat(activeBlocks) + '░'.repeat(totalBlocks - activeBlocks);
  };

  return (
    <SportsCard className={`p-6 space-y-5 ${className}`} glowColor="purple">
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
          <Zap className="w-4 h-4" /> Progresso de Temporada
        </h3>
        <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/15">
          EVOLUÇÃO ATIVA
        </span>
      </div>

      <div className="space-y-5 pt-1">
        {/* OVR EVOLUTION */}
        <div className="space-y-2 bg-zinc-950/40 border border-zinc-900 p-4 rounded-xl">
          <div className="flex justify-between text-xs font-mono font-bold">
            <span className="text-zinc-400">TÉCNICO (OVR)</span>
            <span className="text-purple-400">OBJETIVO: {nextOvrTarget.toFixed(1)}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-black text-white">{currentOvr.toFixed(1)}</span>
            <span className="text-xs text-purple-400 font-mono">{buildAsciiBar(ovrProgressPercent)}</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-snug font-mono">
            Suba suas avaliações técnicas da rodada para conquistar o próximo nível.
          </p>
        </div>

        {/* RANKING EVOLUTION */}
        <div className="space-y-2 bg-zinc-950/40 border border-zinc-900 p-4 rounded-xl">
          <div className="flex justify-between text-xs font-mono font-bold">
            <span className="text-zinc-400">POSIÇÃO GERAL</span>
            <span className="text-amber-400">ALVO: {rank === 1 ? 'TOP #1 👑' : `${nextRankTarget}º Lugar`}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-black text-white">{rank}º</span>
            <span className="text-xs text-amber-500 font-mono">{buildAsciiBar(rankProgressPercent)}</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-snug font-mono">
            Vença mais partidas para superar seus concorrentes diretos no racha.
          </p>
        </div>
      </div>
    </SportsCard>
  );
};

/**
 * 5. PlayerHistoryCard Component
 */
interface PlayerHistoryCardProps {
  player: Player;
  recentResults: ('V' | 'D' | 'E' | 'NP')[];
  className?: string;
}

export const PlayerHistoryCard: React.FC<PlayerHistoryCardProps> = ({
  player,
  recentResults = [],
  className = '',
}) => {
  return (
    <SportsCard className={`p-6 space-y-4 ${className}`}>
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-400" /> Forma Recente (Últimas Rodadas)
        </h3>
      </div>

      {/* HORIZONTAL FORM PATH WITHOUT TABLES */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl">
          <span className="text-[10.5px] font-mono font-bold text-zinc-450 uppercase">Resta de Resultados:</span>
          
          <div className="flex items-center gap-2">
            {recentResults.length > 0 ? (
              recentResults.map((res, idx) => {
                const colorMap = {
                  V: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-black',
                  D: 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-black',
                  E: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                  NP: 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-55'
                };
                return (
                  <span 
                    key={idx}
                    title={res === 'V' ? 'Vitória' : res === 'D' ? 'Derrota' : res === 'E' ? 'Empate' : 'Não Participou'}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-mono select-none ${colorMap[res]}`}
                  >
                    {res}
                  </span>
                );
              })
            ) : (
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Sem histórico registrado</span>
            )}
          </div>
        </div>

        {/* TIMELINE OF ENGAGEMENT */}
        <div className="bg-zinc-950/40 border border-zinc-900 p-4 rounded-xl space-y-3">
          <span className="block text-[9.5px] font-mono font-bold text-zinc-450 uppercase tracking-wider">Histórico de Engajamento</span>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5 text-emerald-400" /> Cadastrado no Sistema</span>
              <span className="font-mono text-[10.5px] text-zinc-500">{player.createdAt ? new Date(player.createdAt).toLocaleDateString('pt-BR') : '22/06/2026'}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">🛡️ Status da Presença</span>
              <SportsBadge variant={player.status === 'disponivel' ? 'success' : 'warning'}>
                {STATUS_LABELS[player.status]}
              </SportsBadge>
            </div>
          </div>
        </div>
      </div>
    </SportsCard>
  );
};

/**
 * 6. PlayerIdentityCard Component (Videogame-style Card layout)
 */
interface PlayerIdentityCardProps {
  player: Player;
  displayOvr: string;
  className?: string;
}

export const PlayerIdentityCard: React.FC<PlayerIdentityCardProps> = ({
  player,
  displayOvr,
  className = '',
}) => {
  return (
    <SportsCard className={`p-6 relative overflow-hidden flex flex-col justify-between ${className}`} glowColor="green">
      <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="flex justify-between items-start gap-4">
        {/* AVATAR DE IA */}
        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500/20 shadow-xl bg-zinc-900 flex items-center justify-center shrink-0">
          {player.avatarEsportivo || player.photoOriginal ? (
            <img
              src={player.avatarEsportivo || player.photoOriginal}
              alt={player.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-12 h-12 text-zinc-700" />
          )}
        </div>

        {/* OVERALL Y POSICIÓN PRINCIPAL GIGANTE */}
        <div className="text-right space-y-1">
          <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-widest">OVR SCORE</span>
          <span className="block font-display font-black text-5xl text-emerald-400 leading-none drop-shadow-[0_0_15px_rgba(52,211,153,0.35)]">
            {displayOvr}
          </span>
          <span className="block text-[10.5px] font-mono font-black text-zinc-300 uppercase tracking-wider bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 inline-block">
            {POSITION_LABELS[player.primaryPosition]}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-3 pt-4 border-t border-zinc-900/80">
        <h4 className="font-display font-black text-sm text-white uppercase tracking-tight truncate">
          {player.name}
        </h4>

        {/* METADATA ATRIBS GRID */}
        <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
          <div className="bg-zinc-950/50 p-2 rounded border border-zinc-900/60 flex justify-between items-center">
            <span className="text-zinc-500">PÉ DOMINANTE:</span>
            <span className="text-zinc-200 uppercase font-bold">{player.foot === 'canhoto' ? 'Canhoto 🦶' : 'Destro 🦶'}</span>
          </div>

          <div className="bg-zinc-950/50 p-2 rounded border border-zinc-900/60 flex justify-between items-center">
            <span className="text-zinc-500">CATEGORIA:</span>
            <span className="text-emerald-400 uppercase font-black">{CATEGORY_LABELS[player.category]}</span>
          </div>

          {player.favoriteTeamId && (
            <div className="bg-zinc-950/50 p-2 rounded border border-zinc-900/60 col-span-2 flex justify-between items-center">
              <span className="text-zinc-500 flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" /> TIME DO CORAÇÃO:</span>
              <div className="flex items-center gap-1.5">
                <ClubShield clubId={player.favoriteTeamId} className="w-4 h-4" />
                <span className="text-zinc-250 font-bold truncate">{player.timeDoCoracao || '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </SportsCard>
  );
};

/**
 * 7. PlayerComparisonCard Component
 */
interface PlayerComparisonCardProps {
  player: Player;
  rachaStats: any;
  allPlayersStats: any[];
  className?: string;
}

export const PlayerComparisonCard: React.FC<PlayerComparisonCardProps> = ({
  player,
  rachaStats,
  allPlayersStats = [],
  className = '',
}) => {
  if (allPlayersStats.length < 2) {
    return (
      <SportsCard className={`p-6 flex flex-col justify-center items-center text-center py-10 ${className}`}>
        <Users className="w-10 h-10 text-zinc-700 mb-2.5" />
        <span className="text-xs font-mono text-zinc-500 uppercase">Aguardando dados de comparação do grupo</span>
      </SportsCard>
    );
  }

  // Calculate percentiles
  const currentOvr = rachaStats?.overall || player.metrics?.overall || 3.5;
  const currentWins = rachaStats?.vitorias || 0;

  const totalPlayers = allPlayersStats.length;
  
  const lowerOvrCount = allPlayersStats.filter(p => (p.overall || 3.5) < currentOvr).length;
  const ovrPercentile = Math.round((lowerOvrCount / (totalPlayers - 1 || 1)) * 100);

  const lowerWinsCount = allPlayersStats.filter(p => (p.vitorias || 0) < currentWins).length;
  const winsPercentile = Math.round((lowerWinsCount / (totalPlayers - 1 || 1)) * 100);

  const isTopRanked = rachaStats?.rank && rachaStats.rank <= 5;

  return (
    <SportsCard className={`p-6 space-y-4 ${className}`} glowColor="sky">
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Comparação de Grupo
        </h3>
      </div>

      <div className="space-y-3.5 pt-1">
        {/* OVR Percentile Comparison */}
        <div className="flex items-center gap-3.5 bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl">
          <TrendingUp className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="space-y-0.5">
            <span className="block text-[10.5px] font-mono text-zinc-500 uppercase">Percentil OVR</span>
            <p className="text-xs text-zinc-200">
              Seu OVR de <strong className="text-emerald-400">{currentOvr.toFixed(1)}</strong> é maior que <strong className="text-emerald-400">{ovrPercentile}%</strong> do grupo.
            </p>
          </div>
        </div>

        {/* Wins Percentile Comparison */}
        <div className="flex items-center gap-3.5 bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl">
          <Trophy className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="space-y-0.5">
            <span className="block text-[10.5px] font-mono text-zinc-500 uppercase">Eficiência Geral</span>
            <p className="text-xs text-zinc-200">
              Você venceu mais partidas que <strong className="text-amber-400">{winsPercentile}%</strong> dos atletas participantes.
            </p>
          </div>
        </div>

        {/* Elite/Top status banner if applicable */}
        {isTopRanked && (
          <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/0 border border-amber-500/25 p-3 rounded-xl flex items-center gap-2">
            <span className="text-base">👑</span>
            <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest">
              Classificação Elite: Atleta no Top 5 Geral do Racha!
            </span>
          </div>
        )}
      </div>
    </SportsCard>
  );
};

/**
 * 8. PlayerGoalsCard Component
 */
interface PlayerGoalsCardProps {
  player: Player;
  rachaStats: any;
  metrics: any;
  className?: string;
}

export const PlayerGoalsCard: React.FC<PlayerGoalsCardProps> = ({
  player,
  rachaStats,
  metrics,
  className = '',
}) => {
  const currentOvr = metrics?.overall || 3.5;
  const matchCount = rachaStats?.presences || 0;
  const winsCount = rachaStats?.vitorias || 0;
  const rank = rachaStats?.rank || 10;

  // Derive dynamic milestones strictly based on current values
  const nextOvrTarget = Math.min(5.0, Math.floor(currentOvr * 10 + 1) / 10);
  const nextWinsTarget = winsCount + 2;
  const nextMatchTarget = matchCount + 3;
  const nextRankTarget = rank <= 3 ? 1 : 3;

  return (
    <SportsCard className={`p-6 space-y-4 ${className}`} glowColor="purple">
      <div className="flex justify-between items-center border-b border-zinc-900/80 pb-3">
        <h3 className="font-display font-black text-xs text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
          <Target className="w-4 h-4" /> Metas e Desafios Automatizados
        </h3>
      </div>

      <div className="space-y-3 pt-1">
        {/* Goal 1: Wins */}
        <div className="flex items-center gap-3 p-2.5 bg-zinc-950/45 border border-zinc-900/60 rounded-xl">
          <input type="checkbox" readOnly checked={false} className="rounded border-zinc-800 text-purple-500 focus:ring-0 bg-transparent w-4 h-4" />
          <div className="leading-tight space-y-0.5">
            <span className="block text-xs font-bold text-zinc-350">Vencer mais 2 rodadas</span>
            <span className="block text-[9.5px] font-mono text-zinc-500">Progresso: {winsCount} / {nextWinsTarget} vitórias</span>
          </div>
        </div>

        {/* Goal 2: Presences */}
        <div className="flex items-center gap-3 p-2.5 bg-zinc-950/45 border border-zinc-900/60 rounded-xl">
          <input type="checkbox" readOnly checked={false} className="rounded border-zinc-800 text-purple-500 focus:ring-0 bg-transparent w-4 h-4" />
          <div className="leading-tight space-y-0.5">
            <span className="block text-xs font-bold text-zinc-350">Completar mais 3 presenças no racha</span>
            <span className="block text-[9.5px] font-mono text-zinc-500">Progresso: {matchCount} / {nextMatchTarget} participações</span>
          </div>
        </div>

        {/* Goal 3: OVR upgrade */}
        <div className="flex items-center gap-3 p-2.5 bg-zinc-950/45 border border-zinc-900/60 rounded-xl">
          <input type="checkbox" readOnly checked={false} className="rounded border-zinc-800 text-purple-500 focus:ring-0 bg-transparent w-4 h-4" />
          <div className="leading-tight space-y-0.5">
            <span className="block text-xs font-bold text-zinc-350">Alcançar Nível Técnico {nextOvrTarget.toFixed(1)} OVR</span>
            <span className="block text-[9.5px] font-mono text-zinc-500">Progresso atual: {currentOvr.toFixed(1)} OVR</span>
          </div>
        </div>

        {/* Goal 4: Rank Goal */}
        <div className="flex items-center gap-3 p-2.5 bg-zinc-950/45 border border-zinc-900/60 rounded-xl">
          <input type="checkbox" readOnly checked={false} className="rounded border-zinc-800 text-purple-500 focus:ring-0 bg-transparent w-4 h-4" />
          <div className="leading-tight space-y-0.5">
            <span className="block text-xs font-bold text-zinc-350">Atingir o Top {nextRankTarget} do Ranking Geral</span>
            <span className="block text-[9.5px] font-mono text-zinc-500">Sua posição atual: {rank}º Lugar</span>
          </div>
        </div>
      </div>
    </SportsCard>
  );
};
