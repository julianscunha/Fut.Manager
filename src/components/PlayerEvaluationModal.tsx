import React, { useState, useEffect } from 'react';
import { Player, User, LINE_ATTRIBUTES, GOALKEEPER_ATTRIBUTES, FAVORITE_TEAMS, POSITION_LABELS } from '../types';
import { X, Award, Shield, Check, Info, AlertTriangle } from 'lucide-react';

interface PlayerEvaluationModalProps {
  player: Player;
  currentUser: User;
  onClose: () => void;
  onEvaluationSaved: (message: string) => void;
}

export default function PlayerEvaluationModal({ player, currentUser, onClose, onEvaluationSaved }: PlayerEvaluationModalProps) {
  const isGk = player.primaryPosition === 'goleiro';
  const attributes = isGk ? GOALKEEPER_ATTRIBUTES : LINE_ATTRIBUTES;
  const team = FAVORITE_TEAMS.find(t => t.id === player.favoriteTeamId);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  // Scale of values from 0.0 to 5.0 inclusive with 0.5 steps
  const scale = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

  // Load existing evaluation if present
  useEffect(() => {
    async function fetchMyEvaluation() {
      try {
        const res = await fetch(`/api/players/${player.id}/evaluations?evaluatorUserId=${currentUser.id}`);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.myEvaluation && data.myEvaluation.ratings) {
              setRatings(data.myEvaluation.ratings);
              
              // Correct period checking (Year-Month)
              const currentPeriod = new Date().toISOString().substring(0, 7); // "YYYY-MM"
              if (data.myEvaluation.date && data.myEvaluation.date.startsWith(currentPeriod)) {
                setValidationMsg('Você já avaliou este jogador neste período. Sua avaliação anterior será atualizada.');
              } else {
                setValidationMsg('Você possui uma avaliação feita em outro período. Ela será atualizada e substituída pela nova.');
              }
            } else {
              // Pre-populate with solid baseline 3.5 for quick entry
              const initial: Record<string, number> = {};
              attributes.forEach(attr => {
                initial[attr.id] = 3.5;
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
      const val = ratings[attr.id] || 3.5;
      sum += val * attr.weight;
    });
    return Math.round(sum * 10) / 10;
  };

  const handleSubmit = async () => {
    setErrorLocal('');
    setLoading(true);

    try {
      const res = await fetch(`/api/players/${player.id}/evaluate`, {
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
        await res.text(); // Consume text safely without throwing syntax errors
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto" id="eval-modal-container">
      <div className="relative w-full max-w-lg bg-[#0e1613] border border-emerald-500/10 rounded-2xl shadow-2xl flex flex-col my-8 animate-fadeIn max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-bold text-white text-base">Avaliar Atleta</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Athlete banner card summary */}
          <div className="flex items-center gap-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-900">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-900 flex-shrink-0">
              {player.photoOriginal ? (
                <img src={player.photoOriginal} alt={player.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-950">Atleta</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-bold text-white text-sm truncate">{player.name}</h4>
              <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: team?.colorHex || '#22c55e' }} />
                <span>Torcedor do {team?.name || 'Vários'} • {POSITION_LABELS[player.primaryPosition]}</span>
              </p>
            </div>
            
            {/* Real-time precalculated Overall Badge based on current slider configurations */}
            <div className="text-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex-shrink-0 font-mono">
              <span className="block text-[8px] font-bold text-emerald-500 uppercase">Seu Voto</span>
              <span className="text-xl font-black text-white">{calculateTempOverall().toFixed(1)}</span>
            </div>
          </div>

          {validationMsg && (
            <p className="text-[11px] font-mono text-emerald-400 px-3 py-1 bg-emerald-550/5 border border-emerald-500/10 rounded-lg flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              <span>{validationMsg}</span>
            </p>
          )}

          {errorLocal && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{errorLocal}</span>
            </div>
          )}

          {/* Guide description */}
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wide font-mono">Métricas de Desempenho</h5>
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              Toque nos botões para atribuir notas. Os coeficientes são balanceados conforme a posição do Atleta para calibrar o Overall final do grupo.
            </p>
          </div>

          {/* Ratings list item selectors */}
          <div className="space-y-4 pt-1">
            {attributes.map(attr => {
              const currentVal = ratings[attr.id] ?? 3.5;
              return (
                <div key={attr.id} className="space-y-1.5 border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-200">
                      {attr.label}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-mono">
                      {currentVal.toFixed(1)}
                    </span>
                  </div>

                  {/* Fully mobile touch-friendly selector pill row */}
                  <div className="grid grid-cols-11 gap-1 overflow-x-auto py-1 scrollbar-hide">
                    {scale.map(step => {
                      const isSelected = currentVal === step;
                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => handleRatingChange(attr.id, step)}
                          className={`py-1.5 rounded text-[10px] font-mono text-center transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-extrabold shadow shadow-emerald-500/20'
                              : 'bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          {step === 0 ? '0' : step === 5 ? '5' : step.toFixed(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sorteio Algorithm Integration Note */}
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 text-[10px] text-zinc-500 space-y-1 font-mono">
            <span className="font-extrabold text-emerald-500/80 uppercase block">🛡️ Proteção Contra Manipulação</span>
            <p className="leading-snug">
              Avaliações são anônimas para manter o fair play. O algoritmo do racha amortece votos extremos usando média ponderada cumulativa. Note que as alterações expiram após um intervalo seguro de 30 dias.
            </p>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-zinc-900 flex justify-end gap-3 bg-zinc-950/40 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white rounded-xl text-xs font-bold font-mono transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-555 text-white font-bold rounded-xl text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white border-r-2 border-r-transparent mr-1" />
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
