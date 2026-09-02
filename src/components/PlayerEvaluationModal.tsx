import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { Player, User } from '../types/domain';
import { LINE_ATTRIBUTES, GOALKEEPER_ATTRIBUTES, FAVORITE_TEAMS } from '../types/ui';
import { X, Award, Check, Info, AlertTriangle, ArrowLeft, Star } from 'lucide-react';
import { getPlayerAvatarUrl } from '../utils/playerAvatar';

interface PlayerEvaluationModalProps {
  player: Player;
  currentUser: User;
  onClose: () => void;
  onEvaluationSaved: (message: string) => void;
}

export default function PlayerEvaluationModal({ player, currentUser, onClose, onEvaluationSaved }: PlayerEvaluationModalProps) {
  const isGk = player.primaryPosition === 'goleiro';
  const attributes = isGk ? GOALKEEPER_ATTRIBUTES : LINE_ATTRIBUTES;
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Scale of values from 1 to 5 inclusive (integers)
  const scale = [1, 2, 3, 4, 5];

  // Load existing evaluation if present
  useEffect(() => {
    async function fetchMyEvaluation() {
      try {
        const res = await authFetch(`/api/players/${player.id}/evaluations?evaluatorUserId=${currentUser.id}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            
            if (data.metrics) {
              setMetrics(data.metrics);
            }
            
            if (data.myEvaluation && data.myEvaluation.ratings) {
              setRatings(data.myEvaluation.ratings);
              
              const currentPeriod = new Date().toISOString().substring(0, 7); // "YYYY-MM"
              if (data.myEvaluation.date && data.myEvaluation.date.startsWith(currentPeriod)) {
                setValidationMsg('Você já avaliou este jogador neste período. Sua avaliação anterior será atualizada.');
              } else {
                setValidationMsg('Você possui uma avaliação feita em outro período. Ela será atualizada e substituída pela nova.');
              }
            } else {
              // Pre-populate with solid baseline 3 for quick entry
              const initial: Record<string, number> = {};
              attributes.forEach(attr => {
                initial[attr.id] = 3;
              });
              setRatings(initial);
            }
          }
        }
      } catch (err) {
        console.error('Falha ao buscar avaliações anteriores', err);
      }
    }
    fetchMyEvaluation();
  }, [player.id, currentUser.id]);

  const handleRatingChange = (attributeId: string, val: number) => {
    setRatings(prev => ({
      ...prev,
      [attributeId]: val
    }));
  };

  const calculateTempOverall = () => {
    let sum = 0;
    attributes.forEach(attr => {
      const val = ratings[attr.id] || 3;
      sum += val * attr.weight;
    });
    return Math.round(sum * 10) / 10;
  };

  const handleSubmit = async () => {
    setErrorLocal('');
    setLoading(true);

    try {
      const res = await authFetch(`/api/players/${player.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluatorUserId: currentUser.id,
          ratings
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        await res.text();
        throw new Error('Não foi possível salvar a avaliação.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível salvar a avaliação.');
      }

      onEvaluationSaved(data.message || 'Sua avaliação anônima foi gravada com sucesso!');
      onClose();
    } catch (err: any) {
      setErrorLocal(err.message || 'Erro de conexão ou serviço indisponível. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const rounded = Math.round(rating * 2) / 2; // round to nearest 0.5
    return (
      <div className="flex items-center gap-0.5 mt-0.5">
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const isFilled = rounded >= starValue;
          const isHalf = !isFilled && rounded >= (starValue - 0.5);
          return (
            <Star
              key={index}
              className={`w-3.5 h-3.5 ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : isHalf
                    ? 'text-amber-400 fill-amber-400/40'
                    : 'text-zinc-800'
              }`}
            />
          );
        })}
        <span className="text-[11px] font-mono text-zinc-500 ml-1.5 font-bold">
          {rating.toFixed(1)} / 5
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 md:bg-zinc-950/80 md:backdrop-blur-sm p-0 md:p-4 overflow-hidden" id="eval-modal-container">
      {/* Container - Full screen on Mobile, Centralized Card on Desktop */}
      <div className="relative w-full h-full md:h-initial md:max-h-[90vh] md:max-w-3xl bg-[#0a110e] rounded-none md:rounded-2xl border-0 md:border md:border-emerald-500/10 shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        
        {/* Header Block with Back Button (Mobile) or Close Button (Desktop) */}
        <div className="p-4 border-b border-zinc-900 bg-zinc-950/40 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="flex md:hidden items-center gap-1 text-zinc-400 hover:text-white transition text-xs font-bold font-mono cursor-pointer bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>← Voltar</span>
          </button>

          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-black text-white text-xs md:text-sm uppercase tracking-wider">Avaliação de Atleta</h3>
          </div>

          <button
            onClick={onClose}
            className="hidden md:flex p-1.5 rounded-lg border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* mobile symmetry spacer */}
          <div className="w-16 md:hidden" />
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 pb-10">
          
          {/* Top Banner: Athlete Identity + Overall displays (Simplified Centered Layout) */}
          <div className="flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#070d0b] to-zinc-950 p-6 rounded-2xl border border-emerald-500/10 w-full relative">
            
            {/* Embedded Help toggle button */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="absolute top-3.5 right-3.5 text-zinc-500 hover:text-emerald-400 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-900/60 transition"
              title="Informações de Avaliação"
              type="button"
            >
              <Info className="w-4 h-4" />
            </button>

            {/* Photo */}
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500/30 bg-zinc-950 flex-shrink-0 flex items-center justify-center mb-3">
              {getPlayerAvatarUrl(player) ? (
                <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-650 bg-zinc-950 text-[10px] font-mono font-black">ATLETA</div>
              )}
            </div>

            {/* Athlete Name */}
            <h4 className="font-sans font-black text-white text-lg tracking-tight uppercase leading-tight mb-2 max-w-[280px] break-words">
              {player.name}
            </h4>

            {/* Overall & Vote status badges */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-1">
              <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-850 px-3 py-1 rounded-full text-xs font-mono">
                <span className="text-amber-400">⭐</span>
                <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-bold">OVR</span>
                <span className="text-white font-extrabold">{metrics?.overall ? metrics.overall.toFixed(1) : '3.5'}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 px-3 py-1 rounded-full text-xs font-mono text-emerald-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Seu voto médio:</span>
                <span className="text-white font-extrabold">{calculateTempOverall().toFixed(1)}</span>
              </div>
            </div>

            {/* Micro tooltip explanation */}
            {showHelp && (
              <div className="absolute inset-x-4 top-10 sm:top-12 bg-zinc-950 border border-emerald-500/20 p-4 rounded-xl text-left text-xs text-zinc-300 shadow-2xl z-20 space-y-2 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
                  <span className="font-bold text-emerald-400 uppercase tracking-widest text-[9px] font-mono">ⓘ Informação</span>
                  <button onClick={() => setShowHelp(false)} className="text-zinc-500 hover:text-white p-0.5 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="font-sans text-zinc-400 leading-relaxed text-[11px]">
                  As avaliações são anônimas e utilizadas para o balanceamento dos sorteios. O racha calibra as médias ponderadas para balancear as partidas automaticamente.
                </p>
              </div>
            )}

          </div>

          {validationMsg && (
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-xs font-mono text-emerald-400 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{validationMsg}</span>
            </div>
          )}

          {errorLocal && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{errorLocal}</span>
            </div>
          )}

          {/* Rating Attributes list */}
          <div className="space-y-6 pt-1">
            {attributes.map(attr => {
              const currentVal = ratings[attr.id] ?? 3;
              return (
                <div key={attr.id} className="space-y-2 border-b border-zinc-900/60 pb-5 last:border-0 last:pb-0">
                  
                  {/* Label + Stars row */}
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-zinc-200 uppercase tracking-widest font-mono flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                        {attr.label}
                      </h5>
                      <div>
                        {renderStars(currentVal)}
                      </div>
                    </div>
                    
                    {/* Visual highlighted rating block [3] */}
                    <div className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-md">
                      [{currentVal.toFixed(1)}]
                    </div>
                  </div>

                  {/* Single Clean Visual Row selector bar */}
                  <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-xl border border-zinc-900 overflow-x-auto scrollbar-hide gap-1 select-none w-full">
                    {scale.map(step => {
                      const isSelected = currentVal === step;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => handleRatingChange(attr.id, step)}
                          className={`flex-grow min-w-[32px] h-9 rounded-lg text-xs font-mono transition-all flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-zinc-950 font-black shadow-md border border-emerald-400 scale-105'
                              : 'text-zinc-650 hover:text-zinc-250 hover:bg-zinc-900/50'
                          }`}
                          title={`Nota ${step}`}
                        >
                          {step}
                        </button>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* Fixed Footer Controls - Always Visible at bottom (flex-shrink-0 instead of absolute) */}
        <div className="p-4 border-t border-zinc-900 flex justify-end gap-3 bg-zinc-950 flex-shrink-0 z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial px-5 py-3 sm:py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer min-h-[44px]"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial px-6 py-3 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 min-h-[44px]"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Enviar Avaliação</span>
          </button>
        </div>

      </div>
    </div>
  );
}
