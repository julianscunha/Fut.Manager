import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, User, Calendar, AlertTriangle, CheckCircle, Trash2, Edit2, RotateCcw, Star, Award, Zap } from 'lucide-react';
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
}

export default function PlayerCard({ player, currentUser, onEdit, onInactivate, onRestore, canEdit, onEvaluationSavedGlobal }: PlayerCardProps) {
  // eSports Horizontal Flip state
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'atributos' | 'historico' | 'conquistas'>('geral');
  
  // Real-time metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [rachaStats, setRachaStats] = useState<any>(null);
  const [allStats, setAllStats] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [categoryHistory, setCategoryHistory] = useState<CategoryTransition[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const team = FAVORITE_TEAMS.find((t) => t.id === player.favoriteTeamId);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch(`/api/players/${player.id}/evaluations?evaluatorUserId=${currentUser.id}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setMetrics(data.metrics);
        }
      }

      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAllStats(statsData);
        const statsObj = (statsData.individual || []).find((s: any) => s.playerId === player.id);
        if (statsObj) {
          setRachaStats(statsObj);
        }
      }

      const transRes = await fetch(`/api/players/${player.id}/transitions`);
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
      const res = await fetch(`/api/players/${player.id}/generate-avatar`, {
        method: 'POST'
      });
      if (res.ok) {
        setSaveSuccessMsg('✨ Avatar Esportivo recriado com sucesso!');
        setTimeout(() => {
          setSaveSuccessMsg('');
          window.location.reload(); // Hard update to refresh avatar cache in browser
        }, 1500);
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
      case 'lateral': return 'LAT';
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
        return <Shield className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const isSoftDeleted = !!player.deletedAt;
  const avatarToDisplay = player.avatarEsportivo || player.photoOriginal || (player as any).photoUrl || '';

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
          cardGlow: 'shadow-[0_0_22px_rgba(234,179,8,0.25)] border-yellow-400/50',
          textTitle: 'text-yellow-200 font-extrabold',
          badgeBg: 'bg-yellow-950/40 text-yellow-105 border border-yellow-500/30',
          ovrColor: 'text-yellow-450',
          labelColor: 'text-yellow-300/80',
          statBg: 'bg-yellow-950/30 border-yellow-900/30 text-yellow-105',
          badgeRarity: 'bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-semibold',
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
          badgeBg: 'bg-zinc-800 text-zinc-350 border border-zinc-750',
          ovrColor: 'text-zinc-300',
          labelColor: 'text-zinc-400/80',
          statBg: 'bg-zinc-900/45 border-zinc-850 text-zinc-300',
          badgeRarity: 'bg-zinc-650 text-white',
          shieldColor: '#cbd5e1'
        };
      case 'bronze':
      default:
        return {
          bgGradient: 'from-amber-955/10 via-zinc-900/30 to-zinc-950',
          borderColor: 'border-amber-800/30',
          textAccent: 'text-amber-605 font-black',
          badgeText: 'Bronze 🥉',
          cardGlow: 'shadow-md border-amber-850/20',
          textTitle: 'text-amber-205 font-extrabold',
          badgeBg: 'bg-amber-950/30 text-amber-500 border border-amber-900/30',
          ovrColor: 'text-amber-600',
          labelColor: 'text-zinc-500',
          statBg: 'bg-zinc-900/40 border-zinc-850 text-zinc-400',
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

  // eSports Dynamic FUT metrics converter (0-5 stars mapped to classic 50-99 system)
  const getFifaStat = (attrId: string, defaultValue = 72) => {
    const average = getAttributeAverage(attrId);
    if (average === 0) return defaultValue;
    return Math.min(99, Math.max(50, Math.round(average * 10 + 50)));
  };

  // Render Gold/Amber Stars based on rating (0.0 to 5.0)
  const renderAttrStars = (ratingValue: number) => {
    return (
      <div className="flex gap-0.5 items-center">
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const isFilled = ratingValue >= starValue;
          const isHalf = !isFilled && ratingValue >= (starValue - 0.5);
          return (
            <Star
              key={index}
              className={`w-3 h-3 ${
                isFilled
                  ? 'fill-amber-450 text-amber-455'
                  : isHalf
                    ? 'text-amber-455 fill-amber-455/40'
                    : 'text-zinc-805'
              }`}
            />
          );
        })}
        {ratingValue > 0 && (
          <span className="text-[10px] font-mono text-zinc-400 ml-1 font-bold">
            {ratingValue.toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  // OVR Calculation (50-99 scale derived from overall 0-5 average)
  const displayOvr = metrics?.overall 
    ? Math.min(99, Math.max(50, Math.round(metrics.overall * 10 + 50))) 
    : 72;

  // Render 6 FUT main attributes on card face
  const isGoalkeeper = player.primaryPosition === 'goleiro';

  // Stats calculation
  const pac = getFifaStat('velocidade', 75);
  const sho = getFifaStat('finalizacao', 72);
  const pas = getFifaStat('passe', 74);
  const dri = getFifaStat('drible', 73);
  const defVal = Math.round(((getAttributeAverage('defesa') + getAttributeAverage('marcacao')) / 2) * 10 + 50) || 70;
  const phy = getFifaStat('fisico', 74);

  const div = getFifaStat('reflexo', 76);
  const han = getFifaStat('saida_gol', 72);
  const kic = getFifaStat('reposicao', 70);
  const ref = Math.round(((getAttributeAverage('reflexo') + getAttributeAverage('posicionamento')) / 2) * 10 + 50) || 75;
  const spd = Math.round(getAttributeAverage('reflexo') * 9 + 50) || 68;
  const posGK = getFifaStat('posicionamento', 74);

  return (
    <div
      id={`player-card-${player.id}`}
      className={`relative w-full h-[460px] select-none transition-all duration-300 ${
        isSoftDeleted ? 'opacity-65 grayscale' : ''
      }`}
      style={{ perspective: '1000px' }}
    >
      {/* 3D Rotating card element */}
      <div
        className="relative w-full h-full cursor-pointer transition-transform duration-500 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        
        {/* ========================================== */}
        {/* FRONT SIDE (FRENTE - FIFA FUT STYLE CARD)  */}
        {/* ========================================== */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl border bg-gradient-to-b ${rarityTheme.bgGradient} ${rarityTheme.borderColor} ${rarityTheme.cardGlow} p-4 flex flex-col justify-between overflow-hidden`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {/* Favorite Team color accent top bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: team?.colorHex || '#22c55e' }}
          />

          {/* Toast Notification inside card */}
          {saveSuccessMsg && (
            <div className="absolute top-3 left-3 right-3 z-50 bg-zinc-950/95 border border-amber-500/50 rounded-lg p-2 text-amber-200 text-center font-bold text-xs shadow-2xl animate-pulse">
              {saveSuccessMsg}
            </div>
          )}

          {/* FUT Shield layout top section */}
          <div className="flex justify-between items-start mt-2">
            
            {/* OVR & Badge panel (Left) */}
            <div className="flex flex-col items-center">
              <span className={`text-3xl font-display font-black leading-none ${rarityTheme.ovrColor} tracking-tighter`}>
                {displayOvr}
              </span>
              <span className="text-[10px] font-mono font-black text-white/90 uppercase tracking-widest mt-0.5 leading-none">
                {getPositionAbbreviation(player.primaryPosition)}
              </span>
              <div className="w-4 h-px bg-white/20 my-1" />
              <span className="text-[10px]" title="Nacionalidade">🇧🇷</span>
              
              {/* Club name tag */}
              <div 
                className="text-[8px] font-mono font-extrabold px-1 py-0.5 rounded border border-white/10 text-white mt-1.5 leading-none uppercase"
                style={{ backgroundColor: team?.colorHex || '#52525b' }}
              >
                {team ? team.name.substring(0, 3) : 'FOF'}
              </div>

              {/* Dominant feet indicator */}
              <span className="text-[7px] font-mono text-zinc-400 mt-1 uppercase tracking-tight">
                {player.peDominante === 'Esquerdo' ? 'LEF' : player.peDominante === 'Ambidestro' ? 'AMB' : 'RGT'}
              </span>
              
              {/* Card Rarity label */}
              <span className={`text-[7px] px-1 py-0.5 rounded uppercase font-bold tracking-tighter mt-1.5 ${rarityTheme.badgeRarity}`}>
                {rarity === 'lendaria' ? 'LND' : rarity === 'ouro' ? 'GOL' : rarity === 'prata' ? 'SLV' : 'BRZ'}
              </span>
            </div>

            {/* Giant Jersey Number or Favorite Number with subtle styling (Right top) */}
            <div className="flex flex-col items-end">
              <div className="text-3xl font-display font-black text-white/5 font-mono select-none -mr-1">
                #{player.numeroFavorito || 10}
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded border ${STATUS_COLORS[player.status]} font-bold font-mono tracking-tight`}>
                {STATUS_LABELS[player.status]}
              </span>
            </div>

          </div>

          {/* Centered Profile Avatar/Athlete section with premium club framing and crest */}
          <div className="flex flex-col items-center justify-center -mt-6 mb-1 relative">
            <div 
              style={getClubMolduraStyle(player.favoriteTeamId || '')}
              className="relative w-28 h-28 rounded-xl overflow-hidden border-2 flex items-center justify-center shadow-2xl group transition-all duration-300"
            >
              {avatarToDisplay ? (
                <img
                  src={avatarToDisplay}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover select-none transition duration-300 group-hover:scale-105"
                />
              ) : (
                <User className="w-14 h-14 text-zinc-700" />
              )}
              
              {/* Escudo do Clube (Floating Badge) */}
              <div 
                className="absolute top-1 right-1 bg-black/90 p-0.5 rounded-full border border-white/20 shadow-md transform group-hover:scale-110 transition duration-150"
                title={`${team ? team.name : 'Clube'}`}
              >
                <ClubShield clubId={player.favoriteTeamId} className="w-4.5 h-4.5" />
              </div>

              {/* Rarity Shield corner logo overlay (Bottom-Right) */}
              <div 
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center border border-white/20 select-none shadow"
                style={{ backgroundColor: rarityTheme.shieldColor }}
                title={rarityTheme.badgeText}
              >
                <Zap className="w-2.5 h-2.5 text-black fill-black" />
              </div>
            </div>
          </div>

          {/* Player Identity Block */}
          <div className="text-center">
            <h3 className="font-sans font-black text-base text-white tracking-tight uppercase leading-tight px-1 truncate">
              {player.name}
            </h3>
            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-zinc-400 to-transparent mx-auto mt-1" />
          </div>

          {/* FUT 6 Attributes Dashboard (Classic Grid) */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-black/60 border border-zinc-900 p-2 rounded-lg font-mono text-[10px] leading-snug mx-1.5 shadow-inner">
            {isGoalkeeper ? (
              <>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">DIV (Sal)</span>
                  <span className="font-extrabold text-amber-400">{div}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">REF (Ref)</span>
                  <span className="font-extrabold text-amber-400">{ref}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">HAN (Man)</span>
                  <span className="font-extrabold text-[#38bdf8]">{han}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">SPD (Vel)</span>
                  <span className="font-extrabold text-[#38bdf8]">{spd}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">KIC (Rep)</span>
                  <span className="font-extrabold text-emerald-400">{kic}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">POS (Pos)</span>
                  <span className="font-extrabold text-emerald-400">{posGK}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">PAC (Rit)</span>
                  <span className="font-extrabold text-purple-400">{pac}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">DRI (Dri)</span>
                  <span className="font-extrabold text-purple-400">{dri}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">SHO (Fin)</span>
                  <span className="font-extrabold text-amber-500">{sho}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-850 py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">DEF (Mar)</span>
                  <span className="font-extrabold text-amber-500">{defVal}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">PAS (Pas)</span>
                  <span className="font-extrabold text-[#4ade80]">{pas}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-zinc-500 uppercase tracking-tight">PHY (Fis)</span>
                  <span className="font-extrabold text-[#4ade80]">{phy}</span>
                </div>
              </>
            )}
          </div>

          {/* Action Footer persistent controls */}
          <div className="mt-1">
            <div className="text-center mb-1.5">
              <span className="inline-flex items-center gap-1 text-[8.5px] font-bold font-mono text-zinc-500 hover:text-zinc-400 select-none bg-zinc-900/60 px-2.5 py-0.5 rounded border border-zinc-850">
                <RotateCcw className="w-2.5 h-2.5 text-zinc-500 animate-pulse" /> 3D Flip • Estatísticas Completas
              </span>
            </div>

            {/* Admin control panel footer inside the card container */}
            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEvalModalOpen(true);
                }}
                className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-[10px] font-bold font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Avaliar</span>
              </button>

              {/* On-demand generator trigger & Edit buttons */}
              {canEdit && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  
                  {/* Manual AI sports avatar reconstruction button */}
                  {!isSoftDeleted && (
                    <button
                      onClick={handleRegenerateAvatar}
                      disabled={isRegenerating}
                      className="p-1 px-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-emerald-400 rounded-lg border border-zinc-800 transition-all text-[10px] flex items-center gap-1 cursor-pointer"
                      title="Gerar / Recriar Avatar Inteligente"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    </button>
                  )}

                  {isSoftDeleted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore && onRestore(player.id);
                      }}
                      className="px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-[#4ade80] border border-emerald-500/20 rounded-lg transition-all text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Reativar</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(player);
                        }}
                        className="p-1 px-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-lg border border-zinc-800 transition-all text-[10px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInactivate(player.id);
                        }}
                        className="p-1 px-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/15 hover:border-rose-500/35 text-rose-400 rounded-lg transition-all text-[10px] flex items-center justify-center cursor-pointer"
                        title="Inativar Jogador"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* BACK SIDE (VERSO - COMPREHENSIVE RECORDS)  */}
        {/* ========================================== */}
        <div
          className={`absolute inset-0 w-full h-full rounded-2xl border bg-zinc-950 ${rarityTheme.borderColor} p-4 flex flex-col justify-between overflow-hidden`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {/* Favorite Team color accent top bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1.5"
            style={{ backgroundColor: team?.colorHex || '#22c55e' }}
          />

          {/* Tab Selection Header */}
          <div className="flex bg-zinc-900/50 p-0.5 rounded-lg border border-zinc-850 text-[9.5px] items-center text-center">
            {(['geral', 'atributos', 'historico', 'conquistas'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(tab);
                }}
                className={`flex-1 py-1 rounded capitalize font-mono font-extrabold transition-all duration-150 cursor-pointer ${
                  activeTab === tab
                    ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/50 shadow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB CONTENTS (Fixed Height, scrollable inside when necessary to prevent card size shifts) */}
          <div className="flex-1 my-3 overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-zinc-800">
            
            {/* 1. TAB GERAL */}
            {activeTab === 'geral' && (
              <div className="space-y-1.5 font-mono text-[10px] animate-fadeIn">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Ranking:</span>
                    <span className="text-amber-400 font-extrabold">{rachaStats ? `#${rachaStats.rank}` : '--'}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Vitórias:</span>
                    <span className="text-emerald-400 font-bold">{rachaStats?.vitorias || 0}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Derrotas:</span>
                    <span className="text-rose-400 font-bold">
                      {rachaStats ? (rachaStats.presences - rachaStats.vitorias) : 0}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Presenças:</span>
                    <span className="text-zinc-200 font-bold">{rachaStats?.presences || 0}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Faltas:</span>
                    <span className="text-amber-500 font-bold">{metrics?.absencesCount || 0}</span>
                  </div>
                  <div className="bg-zinc-900/40 p-1.5 rounded border border-zinc-900/60 flex justify-between items-center">
                    <span className="text-zinc-500">Aproveitam.:</span>
                    <span className="text-sky-400 font-bold">{rachaStats ? `${rachaStats.aproveitamento}%` : '0%'}</span>
                  </div>
                </div>

                <div className="bg-zinc-900/20 p-2 rounded-lg border border-zinc-905 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-bold">🔥 Seq. Atual:</span>
                    <span className="text-amber-500 font-bold">{rachaStats ? `${rachaStats.currentStreak}V` : '0V'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-bold">👑 Melhor Seq.:</span>
                    <span className="text-rose-400 font-bold">{rachaStats ? `${rachaStats.maxStreak}V` : '0V'}</span>
                  </div>
                </div>

                {player.email && (
                  <div className="bg-zinc-900/25 p-2 rounded-lg border border-zinc-905 text-zinc-400 flex flex-col pt-1.5">
                    <span className="text-[8px] uppercase text-zinc-500 leading-none mb-1">Contato/E-mail</span>
                    <span className="truncate text-zinc-350">{player.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. TAB ATRIBUTOS */}
            {activeTab === 'atributos' && (
              <div className="space-y-1 font-mono text-[11px] animate-fadeIn">
                {(player.primaryPosition === 'goleiro' ? GOALKEEPER_ATTRIBUTES : LINE_ATTRIBUTES).map((attr) => {
                  const rating = getAttributeAverage(attr.id);
                  return (
                    <div key={attr.id} className="flex justify-between items-center py-1 border-b border-zinc-900/60">
                      <span className="text-zinc-350 font-sans">{attr.label}</span>
                      {renderAttrStars(rating)}
                    </div>
                  );
                })}
                <div className="mt-2.5 p-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded text-center">
                  <span className="text-[9px] text-zinc-505 block font-sans">Nota Geral de Avaliações</span>
                  <span className="text-sm font-mono font-black text-emerald-400">
                    {metrics?.overall ? metrics.overall.toFixed(2) : '3.5'}
                  </span>
                </div>
              </div>
            )}

            {/* 3. TAB HISTÓRICO */}
            {activeTab === 'historico' && (
              <div className="space-y-3 font-mono text-[10px] animate-fadeIn">
                
                {/* Last matches visual representation ✅ ✅ ❌ ✅ */}
                <div>
                  <span className="block text-[8px] font-mono font-bold text-zinc-550 uppercase tracking-wider mb-1.5">Últimos Rachas</span>
                  {metrics?.lastParticipations && metrics.lastParticipations.length > 0 ? (
                    <div className="flex items-center justify-around bg-zinc-900/20 border border-zinc-900 p-2 rounded-lg">
                      {metrics.lastParticipations.slice(0, 5).map((part: any, idx: number) => {
                        const isConfirmed = part.status === 'confirmado';
                        const isFirstAndstreakWon = idx === 0 && rachaStats?.currentStreak > 0;
                        return (
                          <div key={idx} className="flex flex-col items-center">
                            <span 
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] select-none ${
                                isConfirmed 
                                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                              }`}
                              title={`Partida em ${part.date.split('-').reverse().join('/')}`}
                            >
                              {isConfirmed ? (isFirstAndstreakWon ? '🏆' : '✅') : '❌'}
                            </span>
                            <span className="text-[7.5px] font-mono text-zinc-650 mt-1">
                              {part.date ? part.date.split('-').reverse().slice(0, 2).join('/') : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[9px] text-zinc-605 font-mono italic text-center py-1">Sem histórico de rachas disponível.</p>
                  )}
                </div>

                {/* Sparkling chart for overalls */}
                {metrics?.history && metrics.history.length >= 2 && (
                  <div className="bg-zinc-900/20 p-2 rounded-lg border border-zinc-900 space-y-1">
                    <span className="block text-[8px] font-mono font-bold text-zinc-550 uppercase tracking-wider">Evolução do Over</span>
                    <div className="pt-1 select-none">
                      {renderSparkline(metrics.history)}
                    </div>
                  </div>
                )}

                {/* Transitions timeline log summary */}
                <div className="bg-zinc-900/10 p-2 rounded border border-zinc-900 text-zinc-500 text-[8.5px] leading-tight space-y-0.5">
                  <span className="block font-bold text-zinc-440 text-[8px] uppercase tracking-wider mb-1">Status de Categoria</span>
                  <div className="flex justify-between">
                    <span>Categoria:</span>
                    <span className="text-zinc-350 font-bold uppercase">{CATEGORY_LABELS[player.category]}</span>
                  </div>
                  {categoryHistory && categoryHistory.length > 0 && (
                    <div className="flex justify-between pt-1 border-t border-zinc-900 mt-1">
                      <span>Último ajuste:</span>
                      <span>{new Date(categoryHistory[0].date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 4. TAB CONQUISTAS */}
            {activeTab === 'conquistas' && (
              <div className="space-y-3 animate-fadeIn">
                {/* Trophy collection grids */}
                <div className="grid grid-cols-5 gap-1.5 justify-items-center">
                  {getAchievementsForPlayer(player, rachaStats, allStats).map((ach) => {
                    let tierColor = 'border-zinc-800 text-zinc-655 bg-zinc-900/30';
                    if (ach.earned) {
                      if (ach.category === 'bronze') tierColor = 'border-amber-700/60 bg-amber-900/15 text-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.1)]';
                      else if (ach.category === 'prata') tierColor = 'border-zinc-500/50 bg-zinc-700/15 text-zinc-250 shadow-[0_0_8px_rgba(113,113,122,0.1)]';
                      else if (ach.category === 'ouro') tierColor = 'border-yellow-500/50 bg-yellow-950/20 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.15)]';
                      else if (ach.category === 'lendaria') tierColor = 'border-purple-500/50 bg-purple-950/25 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]';
                    }

                    return (
                      <div
                        key={ach.id}
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center text-lg relative group transition-all duration-300 ${tierColor} ${
                          ach.earned ? 'opacity-100 scale-102' : 'opacity-25 grayscale hover:opacity-80'
                        }`}
                      >
                        <span>{ach.icon}</span>
                        {/* Hover Popup */}
                        <div className="absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                          <div className="bg-zinc-950 text-white border border-zinc-805 p-2 rounded-lg shadow-2xl w-36 text-[9px] leading-relaxed relative text-center">
                            <p className="font-bold text-white text-[9.5px] leading-none mb-1">{ach.title}</p>
                            <p className="text-zinc-400 mb-1 leading-snug">{ach.description}</p>
                            <span className="text-[7.5px] font-mono uppercase font-bold text-amber-500 block">
                              {ach.category} • {ach.progress}/{ach.target}
                            </span>
                            {/* Down pointing small arrow */}
                            <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-zinc-950 animate-bounce"></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 bg-zinc-900/35 rounded-lg border border-zinc-900 flex justify-between items-center text-[9px] font-mono">
                  <span className="text-zinc-550">Concluídas:</span>
                  <span className="text-emerald-400 font-extrabold">
                    {getAchievementsForPlayer(player, rachaStats, allStats).filter(a => a.earned).length} / {getAchievementsForPlayer(player, rachaStats, allStats).length}
                  </span>
                </div>

              </div>
            )}
          </div>

          {/* Verso Card flip control & admin action persistent footer */}
          <div className="mt-1">
            <div className="text-center mb-1.5">
              <span className="inline-flex items-center gap-1 text-[8.5px] font-bold font-mono text-zinc-500 hover:text-zinc-400 select-none bg-zinc-900/60 px-2.5 py-0.5 rounded border border-zinc-850">
                <RotateCcw className="w-2.5 h-2.5 text-zinc-500 animate-pulse" /> Voltar para Frente
              </span>
            </div>

            {/* Actions footer (mirrored so administrators have identical fast access on back of card too!) */}
            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEvalModalOpen(true);
                }}
                className="px-2 py-1 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-[10px] font-bold font-mono text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                <span>Avaliar</span>
              </button>

              {canEdit && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {isSoftDeleted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore && onRestore(player.id);
                      }}
                      className="px-2 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-[#4ade80] border border-emerald-500/20 rounded-lg transition-all text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <span>Reativar</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(player);
                        }}
                        className="p-1 px-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-lg border border-zinc-800 transition-all text-[10px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInactivate(player.id);
                        }}
                        className="p-1 px-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/15 hover:border-rose-500/35 text-rose-400 rounded-lg transition-all text-[10px] flex items-center justify-center cursor-pointer"
                        title="Inativar Jogador"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
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
