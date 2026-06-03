import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, User, Calendar, AlertTriangle, CheckCircle, Trash2, Edit2, Zap, RotateCcw, TrendingUp, ChevronDown, ChevronUp, Star, Award, History } from 'lucide-react';
import { Player, PlayerPosition, FAVORITE_TEAMS, POSITION_LABELS, CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS, User as UserType } from '../types';
import PlayerEvaluationModal from './PlayerEvaluationModal';

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
  const [showFUTCard, setShowFUTCard] = useState(false);
  const [showAttributes, setShowAttributes] = useState(false);
  const [selectedImageView, setSelectedImageView] = useState<'original' | 'card'>(player.playerCardUrl ? 'card' : 'original');

  useEffect(() => {
    setSelectedImageView(player.playerCardUrl ? 'card' : 'original');
  }, [player.playerCardUrl]);
  
  // Real-time metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [rachaStats, setRachaStats] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

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
        const statsObj = (statsData.individual || []).find((s: any) => s.playerId === player.id);
        if (statsObj) {
          setRachaStats(statsObj);
        }
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

  const toggleAttributes = () => {
    const nextState = !showAttributes;
    setShowAttributes(nextState);
    if (nextState) {
      fetchMetrics();
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

  // Convert scale overall (0.0 - 5.0) to FIFA Overall (0 to 99)
  const calculateFifaOverall = () => {
    const overall = metrics ? metrics.overall : 3.5;
    // 3.5 overall => approx 70 rating. 5.0 overall => 99 rating.
    const score = Math.round(overall * 20);
    return Math.min(Math.max(score, 40), 99);
  };

  // Dynamically assign athletic statistics based on position
  const getStatsForPosition = (pos: PlayerPosition) => {
    const ratingValue = calculateFifaOverall();
    switch (pos) {
      case 'goleiro':
        return { rating: ratingValue, pac: 58, sho: 32, pas: 65, dri: 48, def: 90, phy: 84, fields: [{n: 'DIV', v: Math.round(ratingValue * 0.98)}, {n: 'HAN', v: Math.round(ratingValue * 0.94)}, {n: 'KIC', v: Math.round(ratingValue * 0.88)}, {n: 'REF', v: Math.round(ratingValue * 1.01)}, {n: 'SPD', v: 55}, {n: 'POS', v: Math.round(ratingValue * 0.96)}] };
      case 'zagueiro':
        return { rating: ratingValue, pac: 72, sho: 45, pas: 66, dri: 65, def: 88, phy: 86, fields: [{n: 'PAC', v: 72}, {n: 'SHO', v: 45}, {n: 'PAS', v: 66}, {n: 'DRI', v: 65}, {n: 'DEF', v: Math.round(ratingValue * 1.01)}, {n: 'PHY', v: Math.round(ratingValue * 0.98)}] };
      case 'lateral':
        return { rating: ratingValue, pac: 86, sho: 58, pas: 78, dri: 76, def: 78, phy: 74, fields: [{n: 'PAC', v: 86}, {n: 'SHO', v: 58}, {n: 'PAS', v: 78}, {n: 'DRI', v: 76}, {n: 'DEF', v: Math.round(ratingValue * 0.89)}, {n: 'PHY', v: 74}] };
      case 'volante':
        return { rating: ratingValue, pac: 75, sho: 64, pas: 80, dri: 74, def: 84, phy: 82, fields: [{n: 'PAC', v: 75}, {n: 'SHO', v: 64}, {n: 'PAS', v: 80}, {n: 'DRI', v: 74}, {n: 'DEF', v: Math.round(ratingValue * 0.96)}, {n: 'PHY', v: Math.round(ratingValue * 0.94)}] };
      case 'meio_campo':
        return { rating: ratingValue, pac: 79, sho: 78, pas: 90, dri: 85, def: 62, phy: 72, fields: [{n: 'PAC', v: 79}, {n: 'SHO', v: 78}, {n: 'PAS', v: Math.round(ratingValue * 1.01)}, {n: 'DRI', v: Math.round(ratingValue * 0.96)}, {n: 'DEF', v: 62}, {n: 'PHY', v: 72}] };
      case 'atacante':
        return { rating: ratingValue, pac: 92, sho: 89, pas: 74, dri: 87, def: 34, phy: 78, fields: [{n: 'PAC', v: 92}, {n: 'SHO', v: Math.round(ratingValue * 0.98)}, {n: 'PAS', v: 74}, {n: 'DRI', v: Math.round(ratingValue * 0.96)}, {n: 'DEF', v: 34}, {n: 'PHY', v: 78}] };
      default:
        return { rating: ratingValue, pac: 75, sho: 65, pas: 70, dri: 72, def: 60, phy: 70, fields: [{n: 'PAC', v: 75}, {n: 'SHO', v: 65}, {n: 'PAS', v: 70}, {n: 'DRI', v: 72}, {n: 'DEF', v: 60}, {n: 'PHY', v: 70}] };
    }
  };

  const sportsStats = getStatsForPosition(player.primaryPosition);

  // Generation feature will be implemented natively backend-side in the next version

  const isSoftDeleted = !!player.deletedAt;
  const originalPhoto = player.photoOriginal || (player as any).photoUrl || '';

  // Calculate SVG Graph Coordinates based on history points
  const renderSparkline = (historyPoints: any[]) => {
    if (!historyPoints || historyPoints.length < 2) return null;
    
    const width = 280;
    const height = 45;
    const padding = 5;

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
        {/* Area fill */}
        <polygon
          points={`${padding},${height} ${points} ${width - padding},${height}`}
          fill={`url(#grad-${player.id})`}
        />
        {/* Line */}
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="1.8"
          points={points}
        />
        {/* Dots */}
        {xCoords.map((x, i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={yCoords[i]}
              r="2.5"
              fill="#10b981"
              stroke="#0b110e"
              strokeWidth="0.8"
            />
            <title>{`Data: ${historyPoints[i].date} • Overall: ${historyPoints[i].overall}`}</title>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div
      id={`player-card-${player.id}`}
      className={`relative rounded-xl border p-4 sports-card transition-all duration-300 md:p-5 flex flex-col justify-between overflow-hidden ${
        isSoftDeleted ? 'opacity-50 grayscale border-zinc-800' : 'border-zinc-800/80 hover:scale-[1.01]'
      }`}
    >
      {/* Favorite Team color accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: team?.colorHex || '#22c55e' }}
      />

      {/* Header Info */}
      <div className="flex justify-between items-start gap-2 mb-3">
        <div>
          <span className="text-[10px] font-mono tracking-wider uppercase font-bold text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/30">
            {CATEGORY_LABELS[player.category]}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {metrics && metrics.evalCount > 0 && (
            <div className="flex items-center gap-0.5 bg-emerald-550/10 px-2 py-0.5 rounded border border-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold">
              <Star className="w-3 h-3 fill-emerald-400" />
              <span>{metrics.overall.toFixed(1)}</span>
            </div>
          )}
          <span className={`text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1 font-medium ${STATUS_COLORS[player.status]}`}>
            {getStatusIcon(player.status)}
            <span>{STATUS_LABELS[player.status]}</span>
          </span>
        </div>
      </div>

      {showFUTCard ? (
        /* Visualização de Imagens: Foto Original ou Card Gerado */
        <div id={`image-viewer-${player.id}`} className="py-3 flex flex-col items-center">
          {/* Tabs for choosing between Original and Generated */}
          <div className="flex gap-1.5 p-1 bg-zinc-950 border border-zinc-900 rounded-lg mb-4 w-full">
            <button
              id={`tab-view-original-${player.id}`}
              type="button"
              onClick={() => setSelectedImageView('original')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-medium transition cursor-pointer text-center ${
                selectedImageView === 'original'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Foto Original
            </button>
            <button
              id={`tab-view-card-${player.id}`}
              type="button"
              onClick={() => setSelectedImageView('card')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-mono font-medium transition cursor-pointer text-center ${
                selectedImageView === 'card'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              Card Gerado
            </button>
          </div>

          {/* Label indicating which image is currently shown */}
          <div className="w-full text-center mb-3">
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
              EXIBINDO: {selectedImageView === 'original' ? 'Foto Original' : 'Card Gerado'}
            </span>
          </div>

          {/* Render image view state */}
          <div className="w-full flex items-center justify-center min-h-[220px]">
            {selectedImageView === 'original' ? (
              originalPhoto ? (
                <div className="relative w-[180px] h-[180px] rounded-full overflow-hidden border-2 border-emerald-500 bg-black/40 flex items-center justify-center shadow-2xl">
                  <img
                    src={originalPhoto}
                    alt={`${player.name} - Foto Original`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-[180px] h-[180px] rounded-full border border-dashed border-zinc-850 bg-black/45 flex flex-col items-center justify-center text-center p-3 text-zinc-550">
                  <User className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-[11px] font-mono">Sem foto original cadastrada</p>
                </div>
              )
            ) : (
              /* Card Gerado ImageView */
              player.playerCardUrl ? (
                <div className="relative w-[190px] h-[270px] rounded-2xl overflow-hidden border border-emerald-500 bg-black/40 shadow-2xl flex items-center justify-center group">
                  <img
                    src={player.playerCardUrl}
                    alt={`${player.name} - Card Gerado`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-2 right-2 bg-emerald-600 border border-emerald-400 px-1.5 py-0.5 rounded text-[8px] font-mono text-white font-black uppercase shadow">
                    Temporada 2026
                  </div>
                </div>
              ) : (
                /* Card Gerado: Not generated yet. Requirement 5, 6, 8 details. */
                <div className="w-full max-w-sm p-4 rounded-xl border border-zinc-900 bg-zinc-950/80 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-amber-400 font-mono uppercase tracking-wider">Card do Atleta de IA</h4>
                    <span className="inline-block mt-1.5 text-[10px] font-bold bg-amber-550/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                      Funcionalidade planejada para próxima versão.
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                    Não simulamos a criação nem guardamos efeitos temporários de frontend.
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-normal text-center bg-zinc-900/30 p-2 border border-zinc-900 rounded font-sans">
                    O objetivo futuro é transformar a foto do atleta em um card de figurinha, isolando o rosto original e desenhando um uniforme estilizado inspirado nas cores do clube escolhido: <strong className="text-zinc-300">{team?.name || 'Outro'}</strong>.
                  </p>
                  <div className="w-full bg-zinc-900/50 border border-[#22c55e]/5 p-2.5 rounded-lg text-left text-[10px] font-mono text-zinc-500 space-y-1">
                    <p className="font-bold text-[#4ade80] text-[10px] mb-1.5 uppercase">Fluxo Futuro Planejado (Back-end):</p>
                    <p>1. Foto Original do Atleta no S3</p>
                    <p>2. Processamento via API de Inteligência Artificial</p>
                    <p>3. Geração do Card (Rosto original + uniforme customizado)</p>
                    <p>4. Upload do Card finalizado para S3</p>
                    <p>5. Salvamento definitivo do link no banco de dados</p>
                  </div>
                </div>
              )
            )}
          </div>

          <button
            id={`btn-close-fut-${player.id}`}
            type="button"
            onClick={() => setShowFUTCard(false)}
            className="mt-4 px-3 py-1 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 rounded-lg font-mono hover:text-white transition cursor-pointer"
          >
            ← Voltar para Ficha Básica
          </button>
        </div>
      ) : (
        /* Standard card layout view */
        <>
          {/* Main Card Body */}
          <div className="flex items-center gap-4 py-2">
            {/* Avatar/Photo Jersey View */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-800 bg-[#121c17] flex items-center justify-center shadow-inner">
                {originalPhoto ? (
                  <img
                    src={originalPhoto}
                    alt={player.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`flex flex-col items-center justify-center text-center ${originalPhoto ? 'hidden' : ''}`}>
                  <User className="w-6 h-6 text-zinc-500" />
                </div>
              </div>

              {/* Player Badge Overlay */}
              <div
                className="absolute -bottom-1 -right-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border text-white shadow-md flex items-center justify-center"
                style={{ backgroundColor: team?.colorHex || '#10b981', borderColor: 'rgba(255,255,255,0.15)' }}
                title={`Torcedor do ${team?.name}`}
              >
                {team ? team.name.substring(0, 3).toUpperCase() : 'FTB'}
              </div>
            </div>

            {/* Player Names & Main Positions */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-display font-bold text-lg text-white leading-tight truncate">
                  {player.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFUTCard(true)}
                  className="p-1 rounded bg-[#22c55e]/10 tracking-widest border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition cursor-pointer flex-shrink-0"
                  title="Exibir Card Esportivo de IA (FUT)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 truncate mb-1">
                {player.email}
              </p>

              {/* Position Badger */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono font-bold bg-[#22c55e]/20 text-[#4ade80] border border-[#22c55e]/30 px-1.5 py-0.5 rounded">
                  {getPositionAbbreviation(player.primaryPosition)} - {POSITION_LABELS[player.primaryPosition]}
                </span>

                {/* Secondary Positions */}
                {player.secondaryPositions && player.secondaryPositions.length > 0 && (
                  <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1">
                    <span>+</span>
                    {player.secondaryPositions.map((sp) => getPositionAbbreviation(sp)).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {saveSuccessMsg && (
            <p className="p-2 my-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-[11px] font-mono text-emerald-400 animate-fadeIn">
              {saveSuccessMsg}
            </p>
          )}

          {/* Date-ranges display if unavailable/injured */}
          {(player.status === 'lesionado' || player.status === 'indisponivel') && player.statusStartDate && player.statusEndDate && (
            <div className="mt-2.5 px-3 py-1.5 rounded bg-zinc-900/60 border border-zinc-800/40 text-[11px] text-zinc-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                Ausente: {player.statusStartDate.split('-').reverse().join('/')} até {player.statusEndDate.split('-').reverse().join('/')}
              </span>
            </div>
          )}

          {/* EXPANDING DETAILS / ATTRIBUTES SECTION */}
          {showAttributes && (
            <div className="mt-4 pt-4 border-t border-zinc-900 space-y-4 animate-slideDown">
              {loadingMetrics ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-[11px] text-zinc-500 font-mono">Processando avaliações...</span>
                </div>
              ) : metrics ? (
                <div className="space-y-4">
                  
                  {/* Overview statistics info card */}
                  <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-2.5 rounded-lg border border-zinc-900 text-center font-mono">
                    <div className="border-r border-zinc-900">
                      <span className="block text-[8px] text-zinc-500 uppercase leading-snug">Nota</span>
                      <span className="text-sm font-black text-emerald-400">{metrics.overall.toFixed(1)}</span>
                    </div>
                    <div className="border-r border-zinc-900">
                      <span className="block text-[8px] text-zinc-500 uppercase leading-snug">Votos</span>
                      <span className="text-sm font-black text-white">{metrics.evalCount}</span>
                    </div>
                    <div className="border-r border-zinc-900">
                      <span className="block text-[8px] text-zinc-500 uppercase leading-snug">Rachas</span>
                      <span className="text-sm font-black text-emerald-400">{metrics.presencesCount || 0}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-zinc-500 uppercase leading-snug">Faltas</span>
                      <span className="text-sm font-black text-rose-500">{metrics.absencesCount || 0}</span>
                    </div>
                  </div>

                  {/* Racha Tournament Stats Grid */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Estatísticas Gerais do Racha</span>
                    <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-900 font-mono text-center">
                      <div className="border-r border-zinc-900">
                        <span className="block text-[8px] text-zinc-500 uppercase">Ranking</span>
                        <span className="text-xs font-black text-amber-400">{rachaStats ? `#${rachaStats.rank}` : '--'}</span>
                      </div>
                      <div className="border-r border-zinc-900">
                        <span className="block text-[8px] text-zinc-500 uppercase">Vitórias</span>
                        <span className="text-xs font-black text-emerald-400">{rachaStats ? `${rachaStats.vitorias}V` : '0V'}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-zinc-500 uppercase">Aproveit.</span>
                        <span className="text-xs font-black text-sky-400">{rachaStats ? `${rachaStats.aproveitamento}%` : '0%'}</span>
                      </div>
                      <div className="col-span-3 border-t border-zinc-900/60 pt-2 mt-1.5 grid grid-cols-3 gap-2 text-[9px] text-zinc-400">
                        <div>
                          <span>Partidas:</span> <span className="font-bold text-white">{rachaStats ? rachaStats.presences : 0}</span>
                        </div>
                        <div>
                          <span>🔥 Seq. Atual:</span> <span className="font-bold text-amber-500">{rachaStats ? rachaStats.currentStreak : 0}V</span>
                        </div>
                        <div>
                          <span>👑 Melhor Seq.:</span> <span className="font-bold text-rose-400">{rachaStats ? rachaStats.maxStreak : 0}V</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Últimas Participações History Section */}
                  {metrics.lastParticipations && metrics.lastParticipations.length > 0 && (
                    <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/40 space-y-1.5 font-mono text-[10px]">
                      <span className="block font-bold text-zinc-400 uppercase tracking-wider">Últimas Participações</span>
                      <div className="space-y-1 divide-y divide-zinc-900/30">
                        {metrics.lastParticipations.map((part: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center pt-1 text-zinc-300">
                            <span className="flex items-center gap-1">
                              <span>⚽</span>
                              <span>{part.date.split('-').reverse().slice(0, 2).join('/')}</span>
                            </span>
                            <span className={`text-[9px] px-1 py-0.25 rounded ${
                              part.status === 'confirmado' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                            }`}>
                              {part.status === 'confirmado' ? 'PRESENÇA' : 'CANCELADO'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attributes breakdown progressive bar list */}
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Atributos Individuais</span>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(metrics.computedAttributes).map(attrName => {
                        const attributeInfo = metrics.computedAttributes[attrName];
                        const percentage = (attributeInfo.average / 5.0) * 100;
                        return (
                          <div key={attrName} className="space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-sans text-zinc-300 capitalize">{attrName.replace('_', ' ')}</span>
                              <div className="flex items-center gap-1.5 font-mono text-zinc-400">
                                <span className="font-black text-emerald-400">{attributeInfo.average.toFixed(1)}</span>
                                <span className="text-[9px] text-zinc-600">({attributeInfo.rawCount}v)</span>
                              </div>
                            </div>
                            
                            {/* Skill ProgressBar indicator */}
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-850/35">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Historical Evolution Chart (ONLY rendered if history points available) */}
                  {metrics.history && metrics.history.length >= 2 && (
                    <div className="space-y-2 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono font-bold uppercase">
                        <History className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Evolução do Overall</span>
                      </div>
                      
                      {/* Interactive Sparkline graph rendering */}
                      <div className="pt-2">
                        {renderSparkline(metrics.history)}
                      </div>

                      <div className="flex justify-between text-[8px] font-mono text-zinc-650 px-1 pt-1">
                        <span>{metrics.history[0].date.split('-').reverse().slice(0, 2).join('/')}</span>
                        <span>{metrics.history[metrics.history.length - 1].date.split('-').reverse().slice(0, 2).join('/')}</span>
                      </div>
                    </div>
                  )}

                  {/* Click to trigger evaluator modal from sheet directly */}
                  <button
                    type="button"
                    onClick={() => setEvalModalOpen(true)}
                    className="w-full bg-[#1b2b23] hover:bg-[#223d30] border border-emerald-500/25 hover:border-emerald-500/40 py-2.5 rounded-xl text-xs font-bold font-mono text-emerald-400 hover:text-emerald-300 transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>Avaliar este Atleta</span>
                  </button>

                </div>
              ) : (
                <p className="text-[11px] font-mono text-zinc-500 text-center italic py-4">Nenhuma métrica computada ainda.</p>
              )}
            </div>
          )}

          {/* Quick Info Drawer Button */}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={toggleAttributes}
              className="flex-1 bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-900 rounded-lg p-2 flex items-center justify-between text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer transition select-none"
            >
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-emerald-500" />
                <span>{showAttributes ? 'Ocultar Ficha Técnica' : 'Ver Ficha Técnica / Notas'}</span>
              </span>
              {showAttributes ? <ChevronUp className="w-3.5 h-3.5 text-zinc-550" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-550" />}
            </button>
            
            <button
              type="button"
              onClick={() => setShowFUTCard(true)}
              className="bg-zinc-950/60 hover:bg-[#131d17] border border-zinc-900 hover:border-emerald-500/20 rounded-lg px-3 py-2 flex items-center justify-center text-[11px] text-zinc-400 hover:text-emerald-400 cursor-pointer transition"
              title="Card IA de FUT"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Action Buttons footer */}
      {canEdit && (
        <div className="mt-4 pt-3 border-t border-zinc-900 flex justify-end gap-2 text-xs">
          {isSoftDeleted ? (
            <button
              id={`btn-restore-${player.id}`}
              onClick={() => onRestore && onRestore(player.id)}
              className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-[#4ade80] border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg transition-all font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Reativar</span>
            </button>
          ) : (
            <>
              <button
                id={`btn-edit-${player.id}`}
                onClick={() => onEdit(player)}
                className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 hover:text-white text-zinc-300 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
              <button
                id={`btn-inactivate-${player.id}`}
                onClick={() => onInactivate(player.id)}
                className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/10 hover:border-rose-500/30 text-rose-400 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                title="Inativar Jogador (Não exclui fisicamente)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Inativar</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Render evaluation modal if explicitly opened from the toggle action */}
      {evalModalOpen && (
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
      )}

    </div>
  );
}
