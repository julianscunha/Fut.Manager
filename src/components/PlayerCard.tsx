import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { Shield, Sparkles, User, Calendar, AlertTriangle, CheckCircle, Trash2, Edit2, RotateCcw, Star, Award, Zap, ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { Player, PlayerPosition, FAVORITE_TEAMS, POSITION_LABELS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS, User as UserType, CategoryTransition, LINE_ATTRIBUTES, GOALKEEPER_ATTRIBUTES } from '../types';
import PlayerEvaluationModal from './PlayerEvaluationModal';
import { getAchievementsForPlayer } from '../utils/achievements';

// Standard high-quality vector Shields/Escudos for major soccer teams to guarantee accurate displays
export function ClubShield({ clubId, className = "w-6 h-6" }: { clubId?: string, className?: string }) {
  if (!clubId) return <Shield className={`${className} text-zinc-500`} />;

  switch (clubId) {
    case 'fla': // Flamengo
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="50" rx="45" ry="45" fill="#18181b" stroke="#e11d48" strokeWidth="4"/>
          <path d="M20 35H80" stroke="#e11d48" strokeWidth="6"/>
          <path d="M15 50H85" stroke="#e11d48" strokeWidth="6"/>
          <path d="M20 65H80" stroke="#e11d48" strokeWidth="6"/>
          <rect x="35" y="30" width="30" height="40" rx="3" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
          <text x="50" y="55" fill="#ffffff" fontSize="16" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">CRF</text>
        </svg>
      );
    case 'pal': // Palmeiras
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#15803d" stroke="#ffffff" strokeWidth="4" />
          <circle cx="50" cy="50" r="35" fill="#16a34a" />
          <text x="50" y="58" fill="#ffffff" fontSize="26" fontWeight="black" textAnchor="middle" fontFamily="sans-serif">P</text>
          <polygon points="50,22 53,28 60,28 55,32 57,38 52,34 47,38 49,32 44,28 51,28" fill="#ffffff"/>
        </svg>
      );
    case 'spa': // São Paulo
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 H85 V35 L50 85 L15 35 Z" fill="#ffffff" stroke="#18181b" strokeWidth="4"/>
          <path d="M17 17 H83 V28 H17 Z" fill="#18181b" />
          <text x="50" y="26" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">SPFC</text>
          <path d="M25 32 H48 V45 L25 32 Z" fill="#dc2626" />
          <path d="M52 32 H75 V45 L52 32 Z" fill="#18181b" />
        </svg>
      );
    case 'cor': // Corinthians
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 70 L70 30 M30 30 L70 70" stroke="#dc2626" strokeWidth="6" strokeLinecap="round" />
          <circle cx="50" cy="50" r="35" fill="#ffffff" stroke="#18181b" strokeWidth="4"/>
          <circle cx="50" cy="50" r="27" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
          <text x="50" y="56" fill="#ffffff" fontSize="16" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">SCCP</text>
        </svg>
      );
    case 'flu': // Fluminense
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 Q50 20 85 15 Q80 60 50 85 Q20 60 15 15 Z" fill="#86198f" stroke="#ffffff" strokeWidth="4" />
          <path d="M19 19 Q50 24 81 19 Q76 56 50 79 Q24 56 19 19 Z" fill="#15803d" />
          <text x="50" y="54" fill="#ffffff" fontSize="22" fontWeight="black" textAnchor="middle" fontFamily="serif">FFC</text>
        </svg>
      );
    case 'vas': // Vasco
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 Q50 20 85 15 Q80 60 50 85 Q20 60 15 15 Z" fill="#18181b" stroke="#ffffff" strokeWidth="4" />
          <path d="M28 25 L75 72" stroke="#ffffff" strokeWidth="12" strokeLinecap="square" />
          <path d="M50 35 L53 45 L63 42 L55 50 L63 58 L53 55 L50 65 L47 55 L37 58 L45 50 L37 42 L47 45 Z" fill="#e11d48" />
        </svg>
      );
    case 'gre': // Grêmio
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#0284c7" stroke="#ffffff" strokeWidth="4" />
          <path d="M10 50 Q50 20 90 50 Q50 80 10 50" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
          <text x="50" y="55" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">GRÊMIO</text>
        </svg>
      );
    case 'int': // Internacional
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#dc2626" stroke="#ffffff" strokeWidth="4" />
          <circle cx="50" cy="50" r="35" fill="#dc2626" stroke="#ffffff" strokeWidth="2" strokeDasharray="4,2" />
          <text x="50" y="58" fill="#ffffff" fontSize="20" fontWeight="black" textAnchor="middle" fontFamily="sans-serif">SCI</text>
        </svg>
      );
    case 'san': // Santos
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 Q50 20 85 15 Q80 60 50 85 Q20 60 15 15 Z" fill="#ffffff" stroke="#18181b" strokeWidth="4" />
          <path d="M15 40 L85 40" stroke="#18181b" strokeWidth="4" />
          <text x="50" y="32" fill="#18181b" fontSize="14" fontWeight="black" textAnchor="middle" fontFamily="sans-serif">SFC</text>
          <circle cx="50" cy="62" r="14" fill="#18181b" />
          <circle cx="50" cy="62" r="10" fill="#ffffff" />
        </svg>
      );
    case 'cru': // Cruzeiro
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#2563eb" stroke="#ffffff" strokeWidth="4"/>
          <circle cx="50" cy="22" r="3.5" fill="#ffffff" />
          <circle cx="50" cy="72" r="3.5" fill="#ffffff" />
          <circle cx="28" cy="45" r="3.5" fill="#ffffff" />
          <circle cx="72" cy="45" r="3.5" fill="#ffffff" />
          <circle cx="62" cy="56" r="2" fill="#ffffff" />
        </svg>
      );
    case 'bot': // Botafogo
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 Q50 18 85 15 Q80 62 50 85 Q20 62 15 15 Z" fill="#18181b" stroke="#ffffff" strokeWidth="6" />
          <polygon points="50,25 55,38 68,38 58,46 62,59 50,51 38,59 42,46 32,38 45,38" fill="#ffffff"/>
        </svg>
      );
    default: // Generic template
      return (
        <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 15 Q50 20 85 15 Q80 60 50 85 Q20 60 15 15 Z" fill="#b45309" stroke="#facc15" strokeWidth="4" />
          <circle cx="50" cy="48" r="18" fill="#facc15" />
          <path d="M38 38 L62 58 M62 38 L38 58" stroke="#b45309" strokeWidth="2" />
        </svg>
      );
  }
}

// Gorgeous club profile frame style generator
export const getClubMolduraStyle = (clubId: string) => {
  switch (clubId) {
    case 'fla':
      return {
        borderColor: '#e11d48',
        boxShadow: '0 0 14px rgba(225, 29, 72, 0.55)',
        background: 'linear-gradient(135deg, #e11d48, #181c1a)'
      };
    case 'pal':
      return {
        borderColor: '#16a34a',
        boxShadow: '0 0 14px rgba(22, 163, 74, 0.55)',
        background: 'linear-gradient(135deg, #15803d, #ffffff)'
      };
    case 'spa':
      return {
        borderColor: '#dc2626',
        boxShadow: '0 0 14px rgba(220, 38, 38, 0.55)',
        background: 'linear-gradient(135deg, #dc2626, #ffffff, #181c1a)'
      };
    case 'cor':
      return {
        borderColor: '#3f3f46',
        boxShadow: '0 0 14px rgba(63, 63, 70, 0.6)',
        background: 'linear-gradient(135deg, #18141b, #ffffff)'
      };
    case 'flu':
      return {
        borderColor: '#86198f',
        boxShadow: '0 0 14px rgba(134, 25, 143, 0.55)',
        background: 'linear-gradient(135deg, #86198f, #15803d)'
      };
    case 'vas':
      return {
        borderColor: '#52525b',
        boxShadow: '0 0 14px rgba(82, 82, 91, 0.55)',
        background: 'linear-gradient(135deg, #1d1d20, #ffffff)'
      };
    case 'gre':
      return {
        borderColor: '#0284c7',
        boxShadow: '0 0 14px rgba(2, 132, 199, 0.55)',
        background: 'linear-gradient(135deg, #0284c7, #ffffff, #181c1a)'
      };
    case 'int':
      return {
        borderColor: '#dc2626',
        boxShadow: '0 0 14px rgba(220, 38, 38, 0.55)',
        background: 'linear-gradient(135deg, #dc2626, #ffffff)'
      };
    case 'san':
      return {
        borderColor: '#71717a',
        boxShadow: '0 0 14px rgba(113, 113, 122, 0.5)',
        background: 'linear-gradient(135deg, #ffffff, #18181b)'
      };
    case 'cru':
      return {
        borderColor: '#2563eb',
        boxShadow: '0 0 14px rgba(37, 99, 235, 0.55)',
        background: 'linear-gradient(135deg, #2563eb, #1e3a8a)'
      };
    case 'bot':
      return {
        borderColor: '#18181b',
        boxShadow: '0 0 14px rgba(24, 24, 27, 0.75)',
        background: 'linear-gradient(135deg, #09090b, #ffffff)'
      };
    default:
      return {
        borderColor: '#22c55e',
        boxShadow: '0 0 10px rgba(34, 197, 94, 0.4)',
        background: 'linear-gradient(135deg, #1f2937, #111827)'
      };
  }
};

interface PlayerCardProps {
  key?: any;
  player: Player;
  currentUser: UserType;
  onEdit: (player: Player) => void;
  onInactivate: (id: string) => void | Promise<void>;
  onRestore?: (id: string) => void | Promise<void>;
  canEdit: boolean;
  onEvaluationSavedGlobal?: () => void;
  onSelect?: (player: Player) => void;
}

export default function PlayerCard({ player, currentUser, onEdit, onInactivate, onRestore, canEdit, onEvaluationSavedGlobal, onSelect }: PlayerCardProps) {
  const [faceIndex, setFaceIndex] = useState(0); // 5 distinct pages (0 to 4)
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'vitoria' | 'presenca' | 'ranking' | 'resenha'>('all');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>('primeira_vitoria');
  
  // Real-time metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [rachaStats, setRachaStats] = useState<any>(null);
  const [allStats, setAllStats] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [categoryHistory, setCategoryHistory] = useState<CategoryTransition[]>([]);
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
  const [isRegenerating, setIsRegenerating] = useState(false);

  const team = FAVORITE_TEAMS.find((t) => t.id === player.favoriteTeamId);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await authFetch(`/api/players/${player.id}/evaluations?evaluatorUserId=${currentUser.id}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setMetrics(data.metrics);
        }
      }

      let currentRachaStats: any = null;
      const statsRes = await authFetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAllStats(statsData);
        const statsObj = (statsData.individual || []).find((s: any) => s.playerId === player.id);
        if (statsObj) {
          setRachaStats(statsObj);
          currentRachaStats = statsObj;
        }
      }

      const resultsRes = await authFetch('/api/results');
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

          const champTeams = resObj.champions || [];
          if (resObj.isSharedGoalkeepers && isGoalkeeper) {
            return champTeams.length > 0 ? 'V' : 'E';
          }

          const playerTeam = isBlue ? 'Azul' : isRed ? 'Vermelho' : isGreen ? 'Verde' : null;
          if (!playerTeam) return 'NP';

          if (champTeams.length === 0 || champTeams.length > 1) {
            return 'E';
          }
          if (champTeams.includes(playerTeam)) {
            return 'V';
          }
          return 'D';
        });

        sortedResults.forEach(resObj => {
          const isGoalkeeper = player.primaryPosition === 'goleiro';
          const blueTeam = resObj.teams?.find((t: any) => t.name === 'Azul')?.playerIds || [];
          const redTeam = resObj.teams?.find((t: any) => t.name === 'Vermelho')?.playerIds || [];
          const greenTeam = resObj.teams?.find((t: any) => t.name === 'Verde')?.playerIds || [];

          const isBlue = blueTeam.includes(player.id);
          const isRed = redTeam.includes(player.id);
          const isGreen = greenTeam.includes(player.id);

          const hasPlayed = isBlue || isRed || isGreen;
          if (!hasPlayed) return;

          pPresences++;
          const champTeams = resObj.champions || [];
          if (resObj.isSharedGoalkeepers && isGoalkeeper) {
            if (champTeams.length > 0) pWins++;
            else pDraws++;
            return;
          }

          const playerTeam = isBlue ? 'Azul' : isRed ? 'Vermelho' : isGreen ? 'Verde' : null;
          if (!playerTeam) return;

          if (champTeams.length === 0 || champTeams.length > 1) {
            pDraws++;
          } else if (champTeams.includes(playerTeam)) {
            pWins++;
          } else {
            pLosses++;
          }
        });

        setPersonalHistory({
          vitorias: currentRachaStats ? currentRachaStats.vitorias : pWins,
          derrotas: currentRachaStats ? currentRachaStats.derrotas : pLosses,
          empates: currentRachaStats ? currentRachaStats.empates : pDraws,
          presences: currentRachaStats ? currentRachaStats.presences : pPresences,
          recentResults: recentOutcomes
        });
      }

      const transRes = await authFetch(`/api/players/${player.id}/transitions`);
      if (transRes.ok) {
        const transData = await transRes.json();
        setCategoryHistory(transData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [player.id, currentUser.id]);

  const handleRegenerateAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRegenerating) return;
    setIsRegenerating(true);
    setSaveSuccessMsg('⌛ Processando Avatar Inteligente...');
    try {
      const res = await authFetch(`/api/players/${player.id}/generate-avatar`, {
         method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setSaveSuccessMsg(data.message || '✨ Avatar Esportivo recriado com sucesso!');
        
        // Refresh local card metrics and stats
        await fetchMetrics();
        
        // Trigger parent state update so all components reflect the updated avatar
        if (onEvaluationSavedGlobal) {
          onEvaluationSavedGlobal();
        }
        
        setTimeout(() => {
          setSaveSuccessMsg('');
        }, 4000);
      } else {
        const err = await res.json();
        setSaveSuccessMsg(`❌ Erro no processamento: ${err.error || 'Falha'}`);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch {
      setSaveSuccessMsg('❌ Erro de conexão com o servidor.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } finally {
      setIsRegenerating(false);
    }
  };

  const getPositionAbbreviation = (pos: PlayerPosition) => {
    switch (pos) {
      case 'goleiro': return 'GOL';
      case 'zagueiro': return 'ZAG';
      case 'volante': return 'VOL';
      case 'meio_campo': return 'MEI';
      case 'atacante': return 'ATA';
      default: return 'JOG';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'disponivel':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'lesionado':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'indisponivel':
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-zinc-405" />;
    }
  };

  const isSoftDeleted = !!player.deletedAt;
  const avatarToDisplay = player.avatarCard || player.avatarEsportivo || player.avatarOriginal || player.photoOriginal || '';

  // Determine card rarity based on matches under demand
  const matchesCount = rachaStats?.presences || 0;
  const winsCount = rachaStats?.vitorias || 0;
  const achievements = getAchievementsForPlayer(player, rachaStats, allStats);
  const earnedCount = achievements.filter((a) => a.earned).length;

  let rarity: 'bronze' | 'prata' | 'ouro' | 'lendaria' = 'bronze';
  if (matchesCount >= 20 && winsCount >= 10 && earnedCount >= 4) {
    rarity = 'lendaria';
  } else if (matchesCount >= 10 && winsCount >= 5) {
    rarity = 'ouro';
  } else if (matchesCount >= 4) {
    rarity = 'prata';
  }

  const getRarityTheme = (r: 'bronze' | 'prata' | 'ouro' | 'lendaria') => {
    switch (r) {
      case 'lendaria':
        return {
          bgGradient: 'from-zinc-950 via-purple-950/40 to-black',
          borderColor: 'border-purple-500/60',
          textAccent: 'text-purple-400 font-black',
          badgeText: 'Lendário ⭐',
          cardGlow: 'shadow-[0_0_25px_rgba(168,85,247,0.35)] border-purple-500/50',
          textTitle: 'text-purple-300 font-extrabold',
          badgeBg: 'bg-purple-900/40 text-purple-200 border border-purple-500/30',
          ovrColor: 'text-purple-400',
          labelColor: 'text-purple-300/80',
          statBg: 'bg-purple-950/30 border-purple-900/30 text-purple-250',
          badgeRarity: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-mono',
          shieldColor: '#c084fc'
        };
      case 'ouro':
        return {
          bgGradient: 'from-amber-950/20 via-yellow-950/40 to-black',
          borderColor: 'border-yellow-500/70',
          textAccent: 'text-yellow-405 font-black',
          badgeText: 'Ouro 🏅',
          cardGlow: 'shadow-[0_0_22px_rgba(234,179,8,0.25)] border-yellow-404/50',
          textTitle: 'text-yellow-200 font-extrabold',
          badgeBg: 'bg-yellow-950/40 text-yellow-105 border border-yellow-500/30',
          ovrColor: 'text-yellow-450',
          labelColor: 'text-yellow-300/80',
          statBg: 'bg-yellow-950/30 border-yellow-905/30 text-yellow-105',
          badgeRarity: 'bg-gradient-to-r from-yellow-404 to-amber-600 text-black font-semibold',
          shieldColor: '#facc15'
        };
      case 'prata':
        return {
          bgGradient: 'from-slate-900 via-zinc-900/40 to-zinc-950',
          borderColor: 'border-zinc-500/50',
          textAccent: 'text-zinc-350 font-black',
          badgeText: 'Prata 🥈',
          cardGlow: 'shadow-[0_0_15px_rgba(113,113,122,0.18)] border-zinc-650',
          textTitle: 'text-zinc-200 font-extrabold',
          badgeBg: 'bg-zinc-800 text-zinc-350 border border-zinc-752',
          ovrColor: 'text-zinc-300',
          labelColor: 'text-zinc-400/80',
          statBg: 'bg-zinc-900/45 border-zinc-850 text-zinc-300',
          badgeRarity: 'bg-zinc-650 text-white',
          shieldColor: '#cbd5e1'
        };
      case 'bronze':
      default:
        return {
          bgGradient: 'from-amber-955/10 via-zinc-900/30 to-zinc-955',
          borderColor: 'border-amber-800/30',
          textAccent: 'text-amber-605 font-black',
          badgeText: 'Bronze 🥉',
          cardGlow: 'shadow-md border-amber-850/20',
          textTitle: 'text-amber-205 font-extrabold',
          badgeBg: 'bg-amber-955/30 text-amber-500 border border-amber-900/30',
          ovrColor: 'text-amber-600',
          labelColor: 'text-zinc-500',
          statBg: 'bg-zinc-900/40 border-zinc-855 text-zinc-404',
          badgeRarity: 'bg-amber-800/40 text-amber-200',
          shieldColor: '#b45309'
        };
    }
  };

  const rarityTheme = getRarityTheme(rarity);

  // Sparkline coordinates calculator
  const renderSparkline = (historyPoints: any[]) => {
    if (!historyPoints || historyPoints.length < 2) return null;
    
    const width = 280;
    const height = 40;
    const padding = 4;

    const xCoords = historyPoints.map((_, i) => padding + (i * (width - 2 * padding) / (historyPoints.length - 1)));
    const yCoords = historyPoints.map(p => height - padding - ((p.overall - 0.0) * (height - 2 * padding) / 5.0));

    const points = xCoords.map((x, i) => `${x},${yCoords[i]}`).join(' ');

    return (
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`grad-${player.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height} ${points} ${width - padding},${height}`}
          fill={`url(#grad-${player.id})`}
        />
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          points={points}
        />
        {xCoords.map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={yCoords[i]}
            r="2"
            fill="#10b981"
            stroke="#090d0b"
            strokeWidth="0.5"
          />
        ))}
      </svg>
    );
  };

  // Helper to get attribute average from metrics
  const getAttributeAverage = (attrId: string) => {
    if (metrics && metrics.computedAttributes && metrics.computedAttributes[attrId]) {
      return metrics.computedAttributes[attrId].average || 0;
    }
    return 0;
  };

  // Render Gold/Amber Stars based on rating (0.0 to 5.0) for the back of the card
  const renderBackAttrStars = (ratingValue: number) => {
    const rating = ratingValue || 3.5;
    return (
      <div className="flex gap-0.5 items-center">
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const isFilled = rating >= starValue;
          const isHalf = !isFilled && rating >= (starValue - 0.5);
          return (
            <Star
              key={index}
              className={`w-3 h-3 ${
                isFilled
                  ? 'fill-amber-400 text-amber-500'
                  : isHalf
                    ? 'text-amber-505 fill-amber-500/30'
                    : 'text-zinc-700'
              }`}
            />
          );
        })}
        <span className="text-[11px] font-mono text-zinc-300 font-bold min-w-[36px] text-right ml-1.5 font-mono">
          {rating.toFixed(1)}/5
        </span>
      </div>
    );
  };

  // OVR Calculation (Real scale 0.0 to 5.0)
  const displayOvr = (metrics?.overall ?? 3.5).toFixed(1);

  const isGoalkeeper = player.primaryPosition === 'goleiro';

  // Social Share event implementation
  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `Atleta: ${player.name}\nOVR: ${displayOvr}\nPosição: ${POSITION_LABELS[player.primaryPosition]}\nVitórias: ${rachaStats?.vitorias || 0}\nPartidas: ${rachaStats?.presences || 0}\nAproveitamento: ${rachaStats ? rachaStats.aproveitamento : 0}%\nConfira no Racha do Fofim!`;
    if (navigator.share) {
      navigator.share({
        title: `${player.name} - Card de Atleta`,
        text: text,
        url: window.location.href,
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(text);
      setSaveSuccessMsg('📋 Copiado para a área de transferência!');
      setTimeout(() => setSaveSuccessMsg(''), 3050);
    }
  };

  // Find Ranking inside the Specific Position dynamically
  const getPositionRank = () => {
    if (!allStats?.individual || !player) return null;
    const samePositionPlayers = (allStats.individual as any[])
      .filter((p: any) => p.primaryPosition === player.primaryPosition);
    const sortedSamePosition = [...samePositionPlayers].sort((a,b) => {
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      return b.aproveitamento - a.aproveitamento;
    });
    const playerIndex = sortedSamePosition.findIndex((p: any) => p.playerId === player.id);
    return playerIndex !== -1 ? playerIndex + 1 : null;
  };

  // Find if player is in the seasonal All-Star Team dynamically
  const getIsAllStar = () => {
    if (!allStats?.individual || allStats.individual.length === 0) return false;
    const statsList = allStats.individual;
    const selected: string[] = [];
    const usedIds = new Set<string>();
    
    const findBestFor = (posGroup: string[]) => {
      const found = statsList.find((p: any) => 
        !usedIds.has(p.playerId) && 
        posGroup.includes(p.primaryPosition || '') &&
        p.presences > 0
      );
      if (found) {
        usedIds.add(found.playerId);
        selected.push(found.playerId);
      }
    };
    
    findBestFor(['goleiro']);
    findBestFor(['zagueiro']);
    findBestFor(['volante']);
    findBestFor(['meio_campo']);
    findBestFor(['atacante']);
    
    return selected.includes(player.id);
  };

  // Computes the customized achievements list
  const getBadges = () => {
    const isGk = player.primaryPosition === 'goleiro';
    const rank = rachaStats?.rank || 0;
    const vitorias = personalHistory.vitorias;
    const presences = personalHistory.presences;
    const presencesCount = metrics?.presencesCount || 0;
    const absencesCount = metrics?.absencesCount || 0;
    const maxStreak = rachaStats?.maxStreak || player.maxStreak || 0;
    const ovr = metrics?.overall || 3.5;
    
    const dateStr = player.createdAt ? new Date(player.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '20/06/2026';
    
    const list: {
      id: string;
      category: 'vitoria' | 'presenca' | 'ranking' | 'resenha';
      icon: string;
      name: string;
      desc: string;
      status: 'Conquistado' | 'Em progresso' | 'Bloqueado';
      date: string | null;
      progress: number;
      target: number;
      customProg?: string;
      secret?: boolean;
    }[] = [
      // Vitórias e Participação (category: 'vitoria')
      {
        id: 'primeira_vitoria',
        category: 'vitoria' as const,
        icon: '🏆',
        name: 'Primeira Vitória',
        desc: 'Venceu pelo menos uma rodada.',
        status: vitorias >= 1 ? ('Conquistado' as const) : ('Bloqueado' as const),
        date: vitorias >= 1 ? dateStr : null,
        progress: vitorias,
        target: 1,
      },
      {
        id: 'em_chamas',
        category: 'vitoria' as const,
        icon: '🔥',
        name: 'Em Chamas',
        desc: '5 vitórias consecutivas no racha.',
        status: maxStreak >= 5 ? ('Conquistado' as const) : (maxStreak > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: maxStreak >= 5 ? dateStr : null,
        progress: maxStreak,
        target: 5,
      },
      {
        id: 'frequentador',
        category: 'vitoria' as const,
        icon: '📅',
        name: 'Frequentador',
        desc: 'Completou 10 partidas no racha.',
        status: presences >= 10 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: presences >= 10 ? dateStr : null,
        progress: presences,
        target: 10,
      },
      {
        id: 'patrimonio',
        category: 'vitoria' as const,
        icon: '🗿',
        name: 'Patrimônio',
        desc: 'Atingiu 50 presenças ao todo.',
        status: presences >= 50 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: presences >= 50 ? dateStr : null,
        progress: presences,
        target: 50,
      },

      // Presença e Pontualidade (category: 'presenca')
      {
        id: 'pontual',
        category: 'presenca' as const,
        icon: '⏰',
        name: 'Pontual',
        desc: 'Confirmou presença antecipadamente antes do encerramento do prazo.',
        status: (presencesCount >= 10 || (metrics?.earlyConfirmationsCount && metrics.earlyConfirmationsCount >= 1)) ? ('Conquistado' as const) : (presencesCount > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: (presencesCount >= 10 || (metrics?.earlyConfirmationsCount && metrics.earlyConfirmationsCount >= 1)) ? dateStr : null,
        progress: metrics?.earlyConfirmationsCount || presencesCount,
        target: 1,
      },
      {
        id: 'comprometido',
        category: 'presenca' as const,
        icon: '📲',
        name: 'Comprometido',
        desc: 'Confirmou presença em várias rodadas consecutivas (mínimo 5).',
        status: (presencesCount >= 25 || (metrics?.consecutivePresencesCount && metrics.consecutivePresencesCount >= 5)) ? ('Conquistado' as const) : (presencesCount > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: (presencesCount >= 25 || (metrics?.consecutivePresencesCount && metrics.consecutivePresencesCount >= 5)) ? dateStr : null,
        progress: metrics?.consecutivePresencesCount || presencesCount,
        target: 5,
      },
      {
        id: 'fechamento',
        category: 'presenca' as const,
        icon: '🤝',
        name: 'Fechamento',
        desc: 'Completou a lista para atingir as vagas mínimas exigidas da rodada.',
        status: (metrics?.completedMinimumVacanciesCount && metrics.completedMinimumVacanciesCount >= 1) ? ('Conquistado' as const) : (presencesCount > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: (metrics?.completedMinimumVacanciesCount && metrics.completedMinimumVacanciesCount >= 1) ? dateStr : null,
        progress: metrics?.completedMinimumVacanciesCount || 0,
        target: 1,
      },
      {
        id: 'inabalavel',
        category: 'presenca' as const,
        icon: '🌿',
        name: 'Inabalável',
        desc: 'Mantém uma sequência sólida de participações sem nenhuma falta.',
        status: (absencesCount === 0 && presencesCount >= 5) ? ('Conquistado' as const) : (presencesCount > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: (absencesCount === 0 && presencesCount >= 5) ? dateStr : null,
        progress: presencesCount,
        target: 5,
      },

      // Ranking e Seleções (category: 'ranking')
      {
        id: 'top10_geral',
        category: 'ranking' as const,
        icon: '🥉',
        name: 'Top 10 Geral',
        desc: 'Está no Top 10 geral do racha.',
        status: (rank > 0 && rank <= 10) ? ('Conquistado' as const) : ('Bloqueado' as const),
        date: (rank > 0 && rank <= 10) ? dateStr : null,
        progress: (rank > 0 && rank <= 10) ? 1 : 0,
        target: 1,
        customProg: rank > 0 ? `Rank #${rank}` : 'Sem Rank',
      },
      {
        id: 'elite_fofim',
        category: 'ranking' as const,
        icon: '🥇',
        name: 'Elite do Fofim',
        desc: 'Está no Top 3 geral do racha.',
        status: (rank > 0 && rank <= 3) ? ('Conquistado' as const) : ('Bloqueado' as const),
        date: (rank > 0 && rank <= 3) ? dateStr : null,
        progress: (rank > 0 && rank <= 3) ? 1 : 0,
        target: 1,
        customProg: rank > 0 ? `Rank #${rank}` : 'Sem Rank',
      },
      {
        id: 'selecionavel',
        category: 'ranking' as const,
        icon: '⭐',
        name: 'Selecionável',
        desc: 'Média Técnica >= 3.8 com 5+ presenças.',
        status: (ovr >= 3.8 && presences >= 5) ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
        date: (ovr >= 3.8 && presences >= 5) ? dateStr : null,
        progress: presences,
        target: 5,
      },
      {
        id: 'rei_do_racha',
        category: 'ranking' as const,
        icon: '👑',
        name: 'Rei do Racha',
        desc: 'Líder do ranking da temporada (Rank #1).',
        status: rank === 1 ? ('Conquistado' as const) : ('Bloqueado' as const),
        date: rank === 1 ? dateStr : null,
        progress: rank === 1 ? 1 : 0,
        target: 1,
        secret: true,
      }
    ];

    if (isGk) {
      list.push(
        {
          id: 'primeira_defesa',
          category: 'resenha' as const,
          icon: '🧤',
          name: 'Primeira Defesa',
          desc: 'Estreou como goleiro oficial.',
          status: presences >= 1 ? ('Conquistado' as const) : ('Bloqueado' as const),
          date: presences >= 1 ? dateStr : null,
          progress: presences,
          target: 1,
        },
        {
          id: 'muralha',
          category: 'resenha' as const,
          icon: '🧱',
          name: 'Muralha',
          desc: 'Completou 5 partidas no gol.',
          status: presences >= 5 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
          date: presences >= 5 ? dateStr : null,
          progress: presences,
          target: 5,
        },
        {
          id: 'fortaleza',
          category: 'resenha' as const,
          icon: '🏰',
          name: 'Fortaleza',
          desc: 'Completou 15 partidas no gol.',
          status: presences >= 15 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
          date: presences >= 15 ? dateStr : null,
          progress: presences,
          target: 15,
        },
        {
          id: 'insuperavel',
          category: 'resenha' as const,
          icon: '👽',
          name: 'Insuperável',
          desc: 'Completou 30 partidas no gol.',
          status: presences >= 30 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
          date: presences >= 30 ? dateStr : null,
          progress: presences,
          target: 30,
        }
      );
    } else {
      list.push(
        {
          id: 'pelo_churrasco',
          category: 'resenha' as const,
          icon: '🍺',
          name: 'Só Pelo Churrasco',
          desc: 'Categoria Reserva, ou Média Técnica < 3.2.',
          status: (player.category === 'reserva' || (ovr < 3.2 && presences >= 1)) ? ('Conquistado' as const) : ('Bloqueado' as const),
          date: (player.category === 'reserva' || (ovr < 3.2 && presences >= 1)) ? dateStr : null,
          progress: (player.category === 'reserva' || (ovr < 3.2 && presences >= 1)) ? 1 : 0,
          target: 1,
        },
        {
          id: 'figura_carimbada',
          category: 'resenha' as const,
          icon: '😂',
          name: 'Figura Carimbada',
          desc: 'Completou 15 partidas no racha.',
          status: presences >= 15 ? ('Conquistado' as const) : (presences > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
          date: presences >= 15 ? dateStr : null,
          progress: presences,
          target: 15,
        },
        {
          id: 'turista',
          category: 'resenha' as const,
          icon: '🚌',
          name: 'Turista',
          desc: 'Esteve em menos de 5 jogos com a galera.',
          status: (presences > 0 && presences < 5) ? ('Conquistado' as const) : ('Bloqueado' as const),
          date: (presences > 0 && presences < 5) ? dateStr : null,
          progress: presences,
          target: 5,
        },
        {
          id: 'pipoqueiro',
          category: 'resenha' as const,
          icon: '🐸',
          name: 'Pipoqueiro',
          desc: 'Guerreiro fujão: possui 3 ou mais faltas anotadas.',
          status: absencesCount >= 3 ? ('Conquistado' as const) : (absencesCount > 0 ? ('Em progresso' as const) : ('Bloqueado' as const)),
          date: absencesCount >= 3 ? dateStr : null,
          progress: absencesCount,
          target: 3,
          secret: true,
        }
      );
    }

    return list;
  };

  return (
    <div
      id={`player-card-${player.id}`}
      onClick={() => onSelect?.(player)}
      className={`relative w-full h-[495px] select-none transition-all duration-300 cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
        isSoftDeleted ? 'opacity-65 grayscale' : ''
      }`}
    >
      <div
        className={`w-full h-full rounded-2xl border bg-gradient-to-b ${rarityTheme.bgGradient} ${rarityTheme.borderColor} ${rarityTheme.cardGlow} p-4 flex flex-col justify-between overflow-hidden relative shadow-2xl`}
      >
        {/* Favorite Team color accent top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5 z-20"
          style={{ backgroundColor: team?.colorHex || '#22c55e' }}
        />

        {/* Toast Notification inside card */}
        {saveSuccessMsg && (
          <div className="absolute top-3 left-3 right-3 z-50 bg-zinc-950/95 border border-amber-500/50 rounded-lg p-2 text-amber-200 text-center font-bold text-xs shadow-2xl animate-pulse font-mono">
            {saveSuccessMsg}
          </div>
        )}

        {/* ========================================== */}
        {/* FACE CARD CONTENT CONTAINER               */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col overflow-hidden justify-start pt-1.5 w-full">
          
          {/* FACE 1: CARD PRINCIPAL */}
          {faceIndex === 0 && (
            <div className="flex-1 flex flex-col justify-between animate-fade-in">
              {/* Header Panel */}
              <div className="flex justify-between items-start mt-1 px-0.5">
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase select-none mb-0.5">OVR</span>
                  <span className={`text-3xl font-display font-black leading-none ${rarityTheme.ovrColor} tracking-tighter`}>
                    {displayOvr}
                  </span>
                  <span className="text-[11px] font-mono font-black text-white/95 uppercase tracking-wide mt-1.5 leading-none">
                    {POSITION_LABELS[player.primaryPosition].toUpperCase()}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase mt-1 leading-none tracking-tight">
                    {CATEGORY_LABELS[player.category].toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-col items-end">
                  {rachaStats?.rank ? (
                    <div className="text-xl font-display font-black text-amber-400 font-mono tracking-tighter bg-amber-950/45 px-2.5 py-1 rounded-xl border border-yellow-500/15 animate-bounce">
                      #{rachaStats.rank}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Centered Profile Avatar */}
              <div className="flex flex-col items-center justify-center -mt-1 mb-1 relative">
                <div 
                  style={getClubMolduraStyle(player.favoriteTeamId || '')}
                  className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 flex items-center justify-center shadow-2xl group transition-all duration-300"
                >
                  {avatarToDisplay ? (
                    <img
                      src={avatarToDisplay}
                      alt={player.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover select-none transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <User className="w-16 h-16 text-zinc-700" />
                  )}
                  
                  {/* Status processing overlays */}
                  {player.avatarStatus === 'PROCESSANDO' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1.5 z-10">
                      <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[8px] font-sans font-extrabold text-emerald-400 tracking-wider">⏳ Gerando Avatar Gamer...</span>
                    </div>
                  )}

                  {player.avatarStatus === 'PENDENTE' && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1.5 z-10">
                      <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[8px] font-sans font-extrabold text-amber-400 tracking-wider">⏳ Aguardando processamento</span>
                    </div>
                  )}

                  {player.avatarStatus === 'ERRO' && (
                    <div className="absolute bottom-1 left-1.5 bg-zinc-900 border border-zinc-800 text-[8px] font-medium text-zinc-450 px-1.5 py-0.5 rounded-full shadow z-10">
                      ⚠ Utilizando foto original
                    </div>
                  )}

                  {/* Gamer badge indicator */}
                  {(player.avatarStatus === 'CONCLUÍDO' &&
                   player.avatarCard &&
                   player.avatarCard !== (player.avatarOriginal || player.photoOriginal)) && (
                    <div className="absolute bottom-1 left-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-[8px] font-sans font-extrabold text-black px-1.5 py-0.5 rounded-full shadow border border-white/20 z-10">
                      ⚡ CARD IA
                    </div>
                  )}

                  {/* Admin quick regenerator */}
                  {canEdit && (player.avatarOriginal || player.photoOriginal) && 
                   (!player.avatarStatus || player.avatarStatus === 'ERRO' || player.avatarStatus === 'CONCLUÍDO') && (
                    <button
                      type="button"
                      onClick={handleRegenerateAvatar}
                      disabled={isRegenerating}
                      className="absolute top-1 left-1 bg-black/90 hover:bg-emerald-950 p-1.5 rounded-full border border-zinc-800 hover:border-emerald-500/50 text-zinc-450 hover:text-emerald-400 transition shadow-lg z-20 cursor-pointer flex items-center justify-center"
                      title="Regenerar Avatar Gamer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  )}
                  
                  {/* Escudo do Clube */}
                  <div 
                    className="absolute top-1.5 right-1.5 bg-black/95 p-0.5 rounded-full border border-white/20 shadow-md transform group-hover:scale-110 transition duration-150"
                    title={`${team ? team.name : 'Clube'}`}
                  >
                    <ClubShield clubId={player.favoriteTeamId} className="w-5 h-5" />
                  </div>

                  {/* Rarity Shield corner logo overlay */}
                  <div 
                    className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-white/20 select-none shadow animate-pulse"
                    style={{ backgroundColor: rarityTheme.shieldColor }}
                    title={rarityTheme.badgeText}
                  >
                    <Zap className="w-3 h-3 text-black fill-black" />
                  </div>
                </div>
              </div>

              {/* Player Identity */}
              <div className="text-center mt-1">
                <h3 className="font-sans font-black text-lg text-white tracking-tight uppercase leading-tight px-1 truncate drop-shadow-md">
                  {player.name}
                </h3>
                <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-zinc-400 to-transparent mx-auto mt-0.5" />
              </div>

              {/* Availability tag */}
              <div className="flex justify-center mt-1">
                <span className={`text-[9px] font-mono font-extrabold px-3 py-0.5 rounded border shadow-sm ${
                  isSoftDeleted 
                    ? 'bg-zinc-950/80 border-zinc-850 text-zinc-500' 
                    : STATUS_COLORS[player.status]
                }`}>
                  [ {isSoftDeleted ? 'INATIVO' : STATUS_LABELS[player.status].toUpperCase()} ]
                </span>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-1 bg-black/75 border border-zinc-900 p-2.5 rounded-xl font-mono text-[10px] text-center mx-1 shadow-inner mt-2">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-zinc-500 font-bold text-[8.5px] uppercase mb-0.5">🏆 Vitórias</span>
                  <span className="font-extrabold text-emerald-400 text-sm leading-none">{rachaStats?.vitorias || 0}</span>
                </div>
                <div className="flex flex-col items-center justify-center border-x border-zinc-900">
                  <span className="text-zinc-505 font-bold text-[8.5px] uppercase mb-0.5">⚽ Partidas</span>
                  <span className="font-extrabold text-white text-sm leading-none">{rachaStats?.presences || 0}</span>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-zinc-505 font-bold text-[8.5px] uppercase mb-0.5 font-mono">📈 Aproveit.</span>
                  <span className="font-extrabold text-sky-400 text-sm leading-none">{rachaStats ? `${rachaStats.aproveitamento}%` : '0%'}</span>
                </div>
              </div>
            </div>
          )}

          {/* FACE 2: ATRIBUTOS */}
          {faceIndex === 1 && (
            <div className="flex-1 flex flex-col justify-between animate-fade-in">
              <div className="text-center mt-1 pb-1 border-b border-zinc-900/40">
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase block">Atributos de Desempenho</span>
                <span className={`text-xs font-sans font-black uppercase tracking-tight text-white mt-0.5 block truncate`}>
                  {player.name}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2.5 gap-y-2 bg-black/50 border border-zinc-900/60 rounded-xl p-2.5 my-auto shadow-inner">
                {(player.primaryPosition === 'goleiro' ? GOALKEEPER_ATTRIBUTES : LINE_ATTRIBUTES).map((attr) => {
                  const rating = getAttributeAverage(attr.id) || 3.5;
                  return (
                    <div key={attr.id} className="flex flex-col justify-between p-1.5 rounded bg-zinc-950/45 border border-zinc-900/40">
                      <span className="text-zinc-405 font-sans font-semibold text-[9.5px] mb-1 leading-tight tracking-tight uppercase truncate">{attr.label}</span>
                      {renderBackAttrStars(rating)}
                    </div>
                  );
                })}
              </div>

              {/* Small info footer of face 2 */}
              <div className="text-center text-[8px] font-mono text-zinc-505 mt-1 uppercase">
                Baseado em {metrics?.evalCount || 0} avaliações do grupo
              </div>
            </div>
          )}

          {/* FACE 3: ESTATÍSTICAS PESSOAIS */}
          {faceIndex === 2 && (
            <div className="flex-1 flex flex-col justify-between animate-fade-in">
              <div className="text-center mt-1 pb-1 border-b border-zinc-900/40">
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase block">Histórico Individual</span>
                <span className={`text-xs font-sans font-black uppercase tracking-tight text-white mt-0.5 block truncate`}>
                  {player.name}
                </span>
              </div>

              {/* Personal stats grid list */}
              <div className="grid grid-cols-3 gap-1.5 bg-black/45 border border-zinc-900/50 rounded-xl p-2 my-auto shadow-inner">
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center">
                  <span className="text-[7.5px] font-mono text-zinc-505 font-bold uppercase mb-1">Vitórias</span>
                  <span className="text-xs font-mono font-black text-emerald-400 leading-none">{personalHistory.vitorias}</span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center">
                  <span className="text-[7.5px] font-mono text-zinc-550 font-bold uppercase mb-1">Empates</span>
                  <span className="text-xs font-mono font-black text-amber-500 leading-none">{personalHistory.empates}</span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center">
                  <span className="text-[7.5px] font-mono text-zinc-550 font-bold uppercase mb-1">Derrotas</span>
                  <span className="text-xs font-mono font-black text-rose-500 leading-none">{personalHistory.derrotas}</span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center">
                  <span className="text-[7.5px] font-mono text-zinc-550 font-bold uppercase mb-1">Partidas</span>
                  <span className="text-xs font-mono font-black text-zinc-350 leading-none">{personalHistory.presences}</span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center col-span-2">
                  <span className="text-[7.5px] font-mono text-zinc-550 font-bold uppercase mb-1">Aproveitamento Real</span>
                  <span className="text-xs font-mono font-black text-sky-400 leading-none animate-pulse">
                    {personalHistory.presences > 0 ? Math.round((personalHistory.vitorias / personalHistory.presences) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center col-span-1.5">
                  <span className="text-[7.5px] font-mono text-zinc-550 font-bold uppercase mb-1">Racha Atual</span>
                  <span className="text-xs font-mono font-black text-amber-400 leading-none">
                    {rachaStats?.currentStreak || 0} 🔥
                  </span>
                </div>
                <div className="bg-zinc-950/50 border border-zinc-900/40 p-1.5 rounded flex flex-col items-center col-span-1.5">
                  <span className="text-[7.5px] font-mono text-zinc-500 font-bold uppercase mb-1">Melhor Racha</span>
                  <span className="text-xs font-mono font-black text-yellow-500 leading-none">
                    {rachaStats?.maxStreak || player.maxStreak || 0} 👑
                  </span>
                </div>
              </div>

              {/* Latest 5 Racha trends */}
              <div className="bg-zinc-955/60 border border-zinc-900 rounded-xl p-2.5">
                <span className="text-[9px] font-mono font-extrabold text-zinc-405 tracking-wider text-center block mb-2 uppercase">
                  ÚLTIMOS 5 RACHAS
                </span>
                <div className="flex justify-center gap-3">
                  {personalHistory.recentResults.slice(-5).map((outcome, idx) => {
                    let color = 'bg-zinc-900 border-zinc-800 text-zinc-500';
                    let emoji = '⚪';
                    let label = 'N/P';
                    let textColor = 'text-zinc-550';
                    if (outcome === 'V') {
                      color = 'bg-emerald-955/45 border-emerald-500/25 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]';
                      emoji = '🟢';
                      label = 'VIT';
                      textColor = 'text-emerald-405';
                    } else if (outcome === 'D') {
                      color = 'bg-rose-955/20 border-rose-500/15 text-rose-455';
                      emoji = '🔴';
                      label = 'DER';
                      textColor = 'text-rose-455';
                    } else if (outcome === 'E') {
                      color = 'bg-amber-955/40 border-amber-500/15 text-amber-500';
                      emoji = '🟡';
                      label = 'EMP';
                      textColor = 'text-amber-550';
                    }
                    return (
                      <div key={idx} className="flex flex-col items-center gap-0.5">
                        <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-display font-semibold text-xs ${color}`}>
                          {emoji}
                        </div>
                        <span className={`text-[7.5px] font-mono font-bold ${textColor}`}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* FACE 4: ESTATÍSTICAS NO GRUPO */}
          {faceIndex === 3 && (
            <div className="flex-1 flex flex-col justify-between animate-fade-in">
              <div className="text-center mt-1 pb-1 border-b border-zinc-900/40">
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-405 uppercase block">Posicionamento Coletivo</span>
                <span className={`text-xs font-sans font-black uppercase tracking-tight text-white mt-0.5 block truncate`}>
                  {player.name}
                </span>
              </div>

              {/* Group stats list rows */}
              <div className="flex-1 my-auto flex flex-col justify-center space-y-1.5 bg-black/55 border border-zinc-900/60 rounded-xl p-3 shadow-inner">
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">🏅 Ranking Geral</span>
                  <span className="font-mono text-amber-400 font-black text-xs">
                    {rachaStats?.rank ? `#${rachaStats.rank}` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">🥇 Ranking da Posição</span>
                  <span className="font-mono text-zinc-300 font-black text-xs">
                    {getPositionRank() ? `#${getPositionRank()}` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">⭐ Média Técnica (OVR)</span>
                  <span className="font-mono text-teal-400 font-black text-xs">
                    {displayOvr} / 5.0
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">🗳️ Votos Computados</span>
                  <span className="font-mono text-zinc-450 text-xs">
                    {metrics?.evalCount || 0} avaliações
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">👥 Participações Ativas</span>
                  <span className="font-mono text-zinc-300 text-xs">
                    {rachaStats?.presences || 0} jogos
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-zinc-900/25">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">🌟 All-Star Team</span>
                  <span className={`font-mono font-black text-xs ${getIsAllStar() ? 'text-amber-400 animate-pulse' : 'text-zinc-650'}`}>
                    {getIsAllStar() ? 'SELECIONADO 👑' : 'NÃO CONVOQ.'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 last:border-0">
                  <span className="text-zinc-405 font-sans text-[11px] font-medium">📅 Presenças Confirmadas</span>
                  <span className="font-mono text-emerald-400 text-xs font-bold">
                    {metrics?.presencesCount || 0} rodadas
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FACE 5: CONQUISTAS E BADGES */}
          {faceIndex === 4 && (() => {
            const isGkLocal = player.primaryPosition === 'goleiro';
            const allBadges = getBadges();
            const totalBadges = allBadges.length;
            const unlockedBadgesCount = allBadges.filter(b => b.status === 'Conquistado').length;
            const overallProgressPercentage = totalBadges > 0 ? Math.round((unlockedBadgesCount / totalBadges) * 100) : 0;

            const categoriesList = [
              { id: 'all' as const, label: 'Todas' },
              { id: 'vitoria' as const, label: 'Vitória' },
              { id: 'presenca' as const, label: 'Presença' },
              { id: 'ranking' as const, label: 'Ranking' },
              { id: 'resenha' as const, label: isGkLocal ? 'Goleiro' : 'Resenha' }
            ];

            const filteredBadges = allBadges.filter(b => badgeFilter === 'all' || b.category === badgeFilter);
            const selectedBadge = allBadges.find(b => b.id === selectedBadgeId) || filteredBadges[0] || allBadges[0];

            return (
              <div className="flex-1 flex flex-col justify-between animate-fade-in overflow-hidden h-full">
                
                {/* TOPO: PROGRESS BAR AND STATS */}
                <div className="px-2 py-1.5 bg-black/40 border border-zinc-900/60 rounded-xl mb-1.5 flex-shrink-0">
                  <div className="flex justify-between items-center text-[9px] font-mono font-black text-zinc-400 mb-1">
                    <span className="tracking-wider">🏆 CONQUISTAS</span>
                    <span className="text-amber-400">{unlockedBadgesCount} / {totalBadges} LIBERADAS ({overallProgressPercentage}%)</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-2 rounded border border-zinc-900 overflow-hidden relative">
                    <div 
                      className="bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-500 h-full rounded transition-all duration-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                      style={{ width: `${overallProgressPercentage}%` }}
                    />
                  </div>
                </div>

                {/* FILTROS DE CATEGORIAS */}
                <div className="flex gap-1 overflow-x-auto pb-1.5 select-none no-scrollbar flex-shrink-0">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setBadgeFilter(cat.id);
                        const filtered = allBadges.filter(b => cat.id === 'all' || b.category === cat.id);
                        if (filtered.length > 0) {
                          setSelectedBadgeId(filtered[0].id);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-[8px] font-extrabold font-mono transition duration-150 uppercase border flex-shrink-0 cursor-pointer ${
                        badgeFilter === cat.id
                          ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.25)]'
                          : 'bg-zinc-955/85 text-zinc-450 border-zinc-900/60 hover:text-zinc-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* MEDAL GALLERY COMPONENT */}
                <div className="flex overflow-x-auto gap-2 py-1 select-none no-scrollbar w-full flex-nowrap md:grid md:grid-cols-4 md:gap-2 md:overflow-visible flex-shrink-0 min-h-[50px]">
                  {filteredBadges.map((badge) => {
                    const isSel = selectedBadge?.id === badge.id;
                    const isUnlocked = badge.status === 'Conquistado';
                    const isPrg = badge.status === 'Em progresso';
                    const labelIcon = badge.secret && !isUnlocked ? '❓' : badge.icon;
                    
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => setSelectedBadgeId(badge.id)}
                        className={`relative w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-200 transform flex-shrink-0 cursor-pointer ${
                          isSel
                            ? 'scale-105 z-10 border-amber-400 bg-amber-950/30 shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                            : isUnlocked
                              ? 'border-zinc-805 bg-zinc-900/40 shadow-[0_0_4px_rgba(16,185,129,0.15)]'
                              : isPrg
                                ? 'border-zinc-850 bg-zinc-955/75 saturate-[0.6]'
                                : 'border-zinc-905 bg-zinc-955/95 saturate-0 opacity-45'
                        }`}
                        title={badge.name}
                      >
                        {isUnlocked && (
                          <div className="absolute -top-0.5 -right-0.5 bg-emerald-500 text-[6px] text-zinc-950 font-sans font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-zinc-950 select-none shadow">
                            ✔
                          </div>
                        )}
                        {isPrg && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 text-[6px] text-zinc-950 font-sans font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-zinc-950 select-none shadow animate-pulse">
                            ★
                          </div>
                        )}
                        <span className="text-base select-none filter drop-shadow">
                          {labelIcon}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* DETALHES DA BADGE SELECIONADA */}
                {selectedBadge && (() => {
                  const isSecreta = selectedBadge.secret && selectedBadge.status !== 'Conquistado';
                  return (
                    <div className="mt-1.5 p-2 bg-black/65 border border-zinc-900/60 rounded-xl flex flex-col justify-between flex-1 min-h-[140px] overflow-hidden">
                      <div className="flex gap-2.5 items-start">
                        <div className={`w-11 h-11 rounded-full border flex items-center justify-center text-2xl flex-shrink-0 ${
                          selectedBadge.status === 'Conquistado'
                            ? 'bg-amber-955/40 border-amber-450/70 text-amber-205 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse'
                            : selectedBadge.status === 'Em progresso'
                              ? 'bg-zinc-950/80 border-zinc-800 text-zinc-350'
                              : 'bg-zinc-955/95 border-zinc-900 text-zinc-600 filter grayscale opacity-55'
                        }`}>
                          {isSecreta ? '❓' : selectedBadge.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-sans font-black text-[10px] uppercase tracking-wider text-white truncate leading-none">
                              {isSecreta ? 'CONQUISTA OCULTA' : selectedBadge.name}
                            </h4>
                            <span className={`text-[6.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded border leading-none ${
                              selectedBadge.status === 'Conquistado'
                                ? 'bg-emerald-950/40 border-emerald-500/25 text-emerald-400'
                                : selectedBadge.status === 'Em progresso'
                                  ? 'bg-amber-950/40 border-amber-500/25 text-amber-400'
                                  : 'bg-zinc-900 border-zinc-850 text-zinc-500'
                            }`}>
                              {selectedBadge.status}
                            </span>
                          </div>

                          <p className="text-[9px] font-sans text-zinc-400 leading-snug mt-1 font-medium">
                            {isSecreta 
                              ? 'Esta conquista é um segredo! Continue jogando e participando para revelar as condições de desbloqueio.' 
                              : selectedBadge.desc}
                          </p>
                        </div>
                      </div>

                      {/* AREA PROGRESSO/CONQUISTA */}
                      <div className="pt-2 border-t border-zinc-900/40 flex-shrink-0">
                        {selectedBadge.status === 'Conquistado' ? (
                          <div className="flex justify-between items-center text-[8.5px] font-mono leading-none">
                            <span className="text-emerald-400 font-bold">🎉 DESBLOQUEADA!</span>
                            {selectedBadge.date && (
                              <span className="text-zinc-550">CONQUISTADA EM: <span className="text-zinc-350 font-bold">{selectedBadge.date}</span></span>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[8.5px] font-mono leading-none">
                              <span className="text-zinc-500">Progresso do Desafio</span>
                              <span className="text-amber-450 font-black">
                                {selectedBadge.customProg || `${Math.min(selectedBadge.progress, selectedBadge.target)} / ${selectedBadge.target}`}
                              </span>
                            </div>
                            
                            <div className="w-full bg-zinc-950 h-1.5 rounded overflow-hidden border border-zinc-900">
                              <div 
                                className={`h-full rounded transition-all duration-300 ${
                                  selectedBadge.status === 'Em progresso' ? 'bg-amber-500/80 shadow-[0_0_4px_rgba(245,158,11,0.5)]' : 'bg-zinc-800'
                                }`}
                                style={{ width: `${Math.min(100, (selectedBadge.progress / selectedBadge.target) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })()}

        </div>

        {/* ========================================== */}
        {/* SEQUENTIAL NAVIGATION CONTROLS              */}
        {/* ========================================== */}
        <div className="flex items-center justify-between py-1 px-1 mt-1 z-20" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={faceIndex === 0}
            onClick={() => setFaceIndex(prev => Math.max(0, prev - 1))}
            className={`p-1.5 rounded-lg border transition ${
              faceIndex === 0
                ? 'bg-zinc-955/20 border-zinc-950/10 text-zinc-650 cursor-not-allowed'
                : 'bg-zinc-950/60 border-zinc-850 text-zinc-350 hover:text-white cursor-pointer hover:bg-zinc-900'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Dots Indicator */}
          <div className="flex gap-1.5 items-center justify-center">
            {Array.from({ length: 5 }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setFaceIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-200 cursor-pointer ${
                  faceIndex === idx
                    ? 'bg-amber-500 scale-125 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
                title={`Face ${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={faceIndex === 4}
            onClick={() => setFaceIndex(prev => Math.min(4, prev + 1))}
            className={`p-1.5 rounded-lg border transition ${
              faceIndex === 4
                ? 'bg-zinc-955/20 border-zinc-950/10 text-zinc-650 cursor-not-allowed'
                : 'bg-zinc-950/60 border-zinc-850 text-zinc-350 hover:text-white cursor-pointer hover:bg-zinc-900'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ========================================== */}
        {/* PERSISTENT ACTIONS FOOTER AREA             */}
        {/* ========================================== */}
        <div className="pt-2 border-t border-zinc-900/40 flex flex-col gap-1.5 z-20 mt-1" onClick={(e) => e.stopPropagation()}>
          {/* Main Action: Ver Perfil */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelect) onSelect(player);
            }}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[10px] font-mono transition flex items-center justify-center gap-1 cursor-pointer h-9 shadow"
          >
            <User className="w-3.5 h-3.5 text-emerald-100" />
            <span>Ver Perfil</span>
          </button>

          <div className="flex items-center justify-between gap-1.5 w-full">
            {/* Action 1: Avaliar */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEvalModalOpen(true);
              }}
              className="flex-1 py-2 bg-emerald-950/35 hover:bg-emerald-950/65 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-[10px] font-bold font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center justify-center gap-1 cursor-pointer h-9 shadow"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Avaliar</span>
            </button>

            {/* Action 2: Share / Edit Admin */}
            {canEdit ? (
              <div className="flex-1 flex gap-1 h-9">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(player);
                  }}
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded-xl border border-zinc-800 hover:border-zinc-750 transition text-[10px] font-bold font-mono flex items-center justify-center gap-1 cursor-pointer h-9 shadow"
                >
                  <Edit2 className="w-2.5 h-2.5 text-zinc-450" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInactivate(player.id);
                  }}
                  className="p-1.5 bg-rose-955/15 hover:bg-rose-955/35 border border-rose-500/15 hover:border-rose-500/35 text-rose-455 rounded-xl transition-all text-[10px] flex items-center justify-center cursor-pointer h-9 w-9"
                  title="Inativar Jogador"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-sky-400 hover:text-sky-305 rounded-xl border border-zinc-805 hover:border-zinc-750 transition text-[10px] font-bold font-mono flex items-center justify-center gap-1 cursor-pointer h-9 shadow"
              >
                <span>Compartilhar</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Render evaluation modal when open */}
      {evalModalOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <PlayerEvaluationModal
            player={player}
            currentUser={currentUser}
            onClose={() => setEvalModalOpen(false)}
            onEvaluationSaved={(msg) => {
              setSaveSuccessMsg(msg);
              fetchMetrics();
              if (onEvaluationSavedGlobal) {
                onEvaluationSavedGlobal();
              }
              setTimeout(() => setSaveSuccessMsg(''), 4000);
            }}
          />
        </div>
      )}

    </div>
  );
}
