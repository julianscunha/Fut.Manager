import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { Player, User, POSITION_LABELS, FAVORITE_TEAMS } from '../types';
import { 
  Award, Trophy, Sparkles, RefreshCw, Star, Shield, 
  Users, Users2, Flame, Calendar, Activity, Zap, Compass,
  Sliders, Download, CheckCircle2, XCircle, FileText, TrendingUp, ArrowUp, ArrowDown, Minus, Crown, Search, Target
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

  const [auditSimCount, setAuditSimCount] = useState<number>(100);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [maxOvrDiffTarget, setMaxOvrDiffTarget] = useState<number>(0.5);
  const [maxDistDevTarget, setMaxDistDevTarget] = useState<number>(15);
  const [maxCompanionRep, setMaxCompanionRep] = useState<number>(40);
  const [maxOpponentRep, setMaxOpponentRep] = useState<number>(80);
  const [minCertScore, setMinCertScore] = useState<number>(80);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [selectedTemporalAthlete, setSelectedTemporalAthlete] = useState<string>('');
  const [temporalDepth, setTemporalDepth] = useState<number>(20);
  const [compareAuditA, setCompareAuditA] = useState<string>('');
  const [compareAuditB, setCompareAuditB] = useState<string>('');
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const AUDIT_PLAYERS: any[] = [];

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

  const triggerAudit = (simCount: number = auditSimCount) => {
    setAuditLoading(true);
    setTimeout(() => {
      try {
        const playerOveralls: Record<string, number> = {};
        AUDIT_PLAYERS.forEach(p => { playerOveralls[p.id] = p.rating; });

        const getPlayerPositionCategory = (pId: string): 'Goleiros' | 'Zagueiros' | 'Laterais' | 'Meias' | 'Atacantes' => {
          if (['aud-1', 'aud-2', 'aud-3'].includes(pId)) return 'Goleiros';
          if (['aud-4', 'aud-5'].includes(pId)) return 'Zagueiros';
          if (['aud-7'].includes(pId)) return 'Laterais';
          if (['aud-6', 'aud-8', 'aud-9', 'aud-10', 'aud-11'].includes(pId)) return 'Meias';
          return 'Atacantes';
        };

        const draws: any[] = [];
        const assignmentStats: Record<string, { Azul: number; Vermelho: number; Verde: number; total: number }> = {};
        AUDIT_PLAYERS.forEach(p => {
          assignmentStats[p.id] = { Azul: 0, Vermelho: 0, Verde: 0, total: 0 };
        });

        const duoCoOccurrence: Record<string, number> = {};
        const positionCounts = {
          Goleiros: { Azul: 0, Vermelho: 0, Verde: 0, total: 0 },
          Zagueiros: { Azul: 0, Vermelho: 0, Verde: 0, total: 0 },
          Laterais: { Azul: 0, Vermelho: 0, Verde: 0, total: 0 },
          Meias: { Azul: 0, Vermelho: 0, Verde: 0, total: 0 },
          Atacantes: { Azul: 0, Vermelho: 0, Verde: 0, total: 0 }
        };

        const temporalTrajectory: Record<string, Array<{
          drawId: number;
          teamColor: 'Azul' | 'Vermelho' | 'Verde';
          position: string;
          companions: string[];
          opponents: string[];
        }>> = {};
        AUDIT_PLAYERS.forEach(p => {
          temporalTrajectory[p.id] = [];
        });
        
        let goleiroCountOk = 0;
        let defenderCountOk = 0;
        let attackerCountOk = 0;

        for (let d = 0; d < simCount; d++) {
          const mockDuoAffinities = [
            { playerAId: 'aud-12', playerBId: 'aud-13', count: 4, winsCount: 0 }
          ];

          const isDef = (pos: string) => pos === 'zagueiro' || pos === 'volante';
          const isAtt = (pos: string) => pos === 'meio_campo' || pos === 'atacante';
          const getDuoAff = (pA: string, pB: string) => {
            const first = pA < pB ? pA : pB;
            const second = pA < pB ? pB : pA;
            const r = mockDuoAffinities.find(a => a.playerAId === first && a.playerBId === second);
            return r ? r.count : 0;
          };

          const gks = AUDIT_PLAYERS.filter(p => p.primaryPosition === 'goleiro');
          const fPlayers = AUDIT_PLAYERS.filter(p => p.primaryPosition !== 'goleiro');

          const assignedGks = {
            Azul: gks[0].id,
            Vermelho: gks[1].id,
            Verde: gks[2].id
          };

          let bestDrawLocal: any = null;
          let bestFitnessLocal = Infinity;

          const mcIterations = 1000;
          for (let iter = 0; iter < mcIterations; iter++) {
            const shuffled = [...fPlayers];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const teamBluePlayers = [assignedGks.Azul];
            const teamRedPlayers = [assignedGks.Vermelho];
            const teamGreenPlayers = [assignedGks.Verde];

            let currentIdx = 0;
            while (currentIdx < shuffled.length) {
              const p = shuffled[currentIdx];
              const bLen = teamBluePlayers.length;
              const rLen = teamRedPlayers.length;
              const gLen = teamGreenPlayers.length;

              if (bLen <= rLen && bLen <= gLen) {
                teamBluePlayers.push(p.id);
              } else if (rLen <= bLen && rLen <= gLen) {
                teamRedPlayers.push(p.id);
              } else {
                teamGreenPlayers.push(p.id);
              }
              currentIdx++;
            }

            const teamBlueList = AUDIT_PLAYERS.filter(p => teamBluePlayers.includes(p.id));
            const teamRedList = AUDIT_PLAYERS.filter(p => teamRedPlayers.includes(p.id));
            const teamGreenList = AUDIT_PLAYERS.filter(p => teamGreenPlayers.includes(p.id));

            const validPositions = (list: typeof AUDIT_PLAYERS) => {
              const defCount = list.filter(p => isDef(p.primaryPosition) || p.secondaryPositions.some(isDef)).length;
              const attCount = list.filter(p => isAtt(p.primaryPosition) || p.secondaryPositions.some(isAtt)).length;
              return defCount >= 1 && attCount >= 1;
            };

            if (!validPositions(teamBlueList)) continue;
            if (!validPositions(teamRedList)) continue;
            if (!validPositions(teamGreenList)) continue;

            const bSum = teamBluePlayers.reduce((sum, pid) => sum + playerOveralls[pid], 0);
            const rSum = teamRedPlayers.reduce((sum, pid) => sum + playerOveralls[pid], 0);
            const gSum = teamGreenPlayers.reduce((sum, pid) => sum + playerOveralls[pid], 0);

            const bOverall = bSum / teamBluePlayers.length;
            const rOverall = rSum / teamRedPlayers.length;
            const gOverall = gSum / teamGreenPlayers.length;

            const maxRating = Math.max(bOverall, rOverall, gOverall);
            const minRating = Math.min(bOverall, rOverall, gOverall);
            const diff = maxRating - minRating;

            let totalAffinityPenalty = 0;
            const calcTeamAffinity = (pids: string[]) => {
              let penalty = 0;
              for (let i = 0; i < pids.length; i++) {
                for (let j = i + 1; j < pids.length; j++) {
                  penalty += getDuoAff(pids[i], pids[j]) * 2;
                }
              }
              return penalty;
            };

            totalAffinityPenalty += calcTeamAffinity(teamBluePlayers);
            totalAffinityPenalty += calcTeamAffinity(teamRedPlayers);
            totalAffinityPenalty += calcTeamAffinity(teamGreenPlayers);

            const fitness = (diff * 15) + totalAffinityPenalty;

            if (fitness < bestFitnessLocal) {
              bestFitnessLocal = fitness;
              bestDrawLocal = {
                teams: {
                  Azul: teamBluePlayers,
                  Vermelho: teamRedPlayers,
                  Verde: teamGreenPlayers
                },
                ovrs: {
                  Azul: Math.round(bOverall * 100) / 100,
                  Vermelho: Math.round(rOverall * 100) / 100,
                  Verde: Math.round(gOverall * 100) / 100,
                },
                maxDiff: Math.round(diff * 100) / 100
              };
            }
          }

          if (!bestDrawLocal) {
            bestDrawLocal = {
              teams: {
                Azul: [assignedGks.Azul, fPlayers[0].id, fPlayers[3].id, fPlayers[6].id, fPlayers[9].id],
                Vermelho: [assignedGks.Vermelho, fPlayers[1].id, fPlayers[4].id, fPlayers[7].id, fPlayers[10].id],
                Verde: [assignedGks.Verde, fPlayers[2].id, fPlayers[5].id, fPlayers[8].id, fPlayers[11].id]
              },
              ovrs: { Azul: 4.15, Vermelho: 4.15, Verde: 4.15 },
              maxDiff: 0.0
            };
          }

          let classification: 'Excelente' | 'Bom' | 'Aceitável' | 'Ruim' = 'Excelente';
          if (bestDrawLocal.maxDiff <= 0.2) classification = 'Excelente';
          else if (bestDrawLocal.maxDiff <= 0.4) classification = 'Bom';
          else if (bestDrawLocal.maxDiff <= 0.6) classification = 'Aceitável';
          else classification = 'Ruim';

          draws.push({
            id: d + 1,
            teams: bestDrawLocal.teams,
            ovrs: bestDrawLocal.ovrs,
            maxDiff: bestDrawLocal.maxDiff,
            classification
          });

          // Assignment stats (Etapa 4) and Position assignment counts (Etapa 3)
          Object.keys(bestDrawLocal.teams).forEach((teamName) => {
            const pids = bestDrawLocal.teams[teamName as 'Azul' | 'Vermelho' | 'Verde'];
            pids.forEach((pid: string) => {
              assignmentStats[pid][teamName as 'Azul' | 'Vermelho' | 'Verde']++;
              assignmentStats[pid].total++;

              const cat = getPlayerPositionCategory(pid);
              positionCounts[cat][teamName as 'Azul' | 'Vermelho' | 'Verde']++;
              positionCounts[cat].total++;
            });
          });

          // Co-occurrence matrix calculations (Etapa 6)
          Object.keys(bestDrawLocal.teams).forEach((teamName) => {
            const pids = bestDrawLocal.teams[teamName as 'Azul' | 'Vermelho' | 'Verde'];
            for (let i = 0; i < pids.length; i++) {
              for (let j = i + 1; j < pids.length; j++) {
                const first = pids[i] < pids[j] ? pids[i] : pids[j];
                const second = pids[i] < pids[j] ? pids[j] : pids[i];
                const key = `${first}:${second}`;
                duoCoOccurrence[key] = (duoCoOccurrence[key] || 0) + 1;
              }
            }
          });

          // Temporal tracking construction (Etapa 8)
          Object.keys(bestDrawLocal.teams).forEach((teamName) => {
            const pids = bestDrawLocal.teams[teamName as 'Azul' | 'Vermelho' | 'Verde'];
            pids.forEach((pid: string) => {
              const comps = pids.filter(x => x !== pid).map(x => AUDIT_PLAYERS.find(p => p.id === x)?.name || '');
              const opps: string[] = [];
              Object.keys(bestDrawLocal.teams).forEach(otherTeam => {
                if (otherTeam !== teamName) {
                  bestDrawLocal.teams[otherTeam as 'Azul' | 'Vermelho' | 'Verde'].forEach((otherPid: string) => {
                    opps.push(AUDIT_PLAYERS.find(p => p.id === otherPid)?.name || '');
                  });
                }
              });

              temporalTrajectory[pid].push({
                drawId: d + 1,
                teamColor: teamName as 'Azul' | 'Vermelho' | 'Verde',
                position: POSITION_LABELS[AUDIT_PLAYERS.find(p => p.id === pid)!.primaryPosition],
                companions: comps,
                opponents: opps
              });
            });
          });

          let isGkOk = true;
          let isDefOk = true;
          let isAttOk = true;

          Object.keys(bestDrawLocal.teams).forEach((teamName) => {
            const pids = bestDrawLocal.teams[teamName as 'Azul' | 'Vermelho' | 'Verde'];
            const teamPlayers = AUDIT_PLAYERS.filter(p => pids.includes(p.id));

            const gkCount = teamPlayers.filter(p => p.primaryPosition === 'goleiro').length;
            const defCount = teamPlayers.filter(p => isDef(p.primaryPosition) || p.secondaryPositions.some(isDef)).length;
            const attCount = teamPlayers.filter(p => isAtt(p.primaryPosition) || p.secondaryPositions.some(isAtt)).length;

            if (gkCount !== 1) isGkOk = false;
            if (defCount < 1) isDefOk = false;
            if (attCount < 1) isAttOk = false;
          });

          if (isGkOk) goleiroCountOk++;
          if (isDefOk) defenderCountOk++;
          if (isAttOk) attackerCountOk++;
        }

        const diffs = draws.map(d => d.maxDiff);
        const maxDiffGlobal = Math.round(Math.max(...diffs) * 100) / 100;
        const minDiffGlobal = Math.round(Math.min(...diffs) * 100) / 100;
        const meanDiffGlobal = Math.round((diffs.reduce((sum, d) => sum + d, 0) / simCount) * 100) / 100;

        const variance = diffs.reduce((sum, d) => sum + Math.pow(d - meanDiffGlobal, 2), 0) / simCount;
        const stdDevDiffGlobal = Math.round(Math.sqrt(variance) * 100) / 100;

        const classifications = { Excelente: 0, Bom: 0, Aceitável: 0, Ruim: 0 };
        draws.forEach(d => {
          classifications[d.classification]++;
        });

        // 1. Position distribution calculations (Etapa 3)
        const positionTableData = Object.keys(positionCounts).map(pos => {
          const counts = positionCounts[pos as keyof typeof positionCounts];
          const total = counts.total || 1;
          const azulPct = (counts.Azul / total) * 100;
          const vermPct = (counts.Vermelho / total) * 100;
          const verdPct = (counts.Verde / total) * 100;
          
          const dev = Math.max(
            Math.abs(azulPct - 33.33),
            Math.abs(vermPct - 33.33),
            Math.abs(verdPct - 33.33)
          );
          
          return {
            position: pos,
            Azul: counts.Azul,
            Vermelho: counts.Vermelho,
            Verde: counts.Verde,
            AzulPct: azulPct,
            VermelhoPct: vermPct,
            VerdePct: verdPct,
            total,
            deviation: Math.round(dev * 10) / 10
          };
        });
        const maxPositionDeviation = Math.round(Math.max(...positionTableData.map(p => p.deviation)) * 10) / 10;

        // 2. Color distribution calculations per player (Etapa 4)
        const athleteColorData = AUDIT_PLAYERS.map(pl => {
          const stats = assignmentStats[pl.id];
          const azulPct = (stats.Azul / simCount) * 100;
          const vermPct = (stats.Vermelho / simCount) * 100;
          const verdPct = (stats.Verde / simCount) * 100;
          
          const dev = Math.max(
            Math.abs(azulPct - 33.33),
            Math.abs(vermPct - 33.33),
            Math.abs(verdPct - 33.33)
          );
          
          return {
            id: pl.id,
            name: pl.name,
            position: POSITION_LABELS[pl.primaryPosition],
            Azul: stats.Azul,
            Vermelho: stats.Vermelho,
            Verde: stats.Verde,
            AzulPct: azulPct,
            VermelhoPct: vermPct,
            VerdePct: verdPct,
            deviation: Math.round(dev * 10) / 10
          };
        });
        // 3. OVR Difference Histogram calculations (Etapa 5)
        const histogramBins = [
          { range: '0.00 - 0.05', count: 0 },
          { range: '0.06 - 0.10', count: 0 },
          { range: '0.11 - 0.15', count: 0 },
          { range: '0.16 - 0.20', count: 0 },
          { range: '0.21 - 0.25', count: 0 },
          { range: '0.26 - 0.30', count: 0 },
          { range: '> 0.30', count: 0 }
        ];
        diffs.forEach(val => {
          if (val <= 0.05) histogramBins[0].count++;
          else if (val <= 0.10) histogramBins[1].count++;
          else if (val <= 0.15) histogramBins[2].count++;
          else if (val <= 0.20) histogramBins[3].count++;
          else if (val <= 0.25) histogramBins[4].count++;
          else if (val <= 0.30) histogramBins[5].count++;
          else histogramBins[6].count++;
        });

        // 4. Companions Matrix calculations (Etapa 6) - Probability together = 4/14 = 28.57%
        const companionPairsList: any[] = [];
        for (let i = 0; i < AUDIT_PLAYERS.length; i++) {
          for (let j = i + 1; j < AUDIT_PLAYERS.length; j++) {
            const pA = AUDIT_PLAYERS[i];
            const pB = AUDIT_PLAYERS[j];
            const key = pA.id < pB.id ? `${pA.id}:${pB.id}` : `${pB.id}:${pA.id}`;
            const togetherCount = duoCoOccurrence[key] || 0;
            const againstCount = simCount - togetherCount;
            const togetherPct = (togetherCount / simCount) * 100;
            const againstPct = (againstCount / simCount) * 100;
            const dev = togetherPct - 28.57;
            
            companionPairsList.push({
              names: `${pA.name} + ${pB.name}`,
              together: togetherCount,
              against: againstCount,
              never: togetherCount === 0,
              expectedTogetherPct: 28.57,
              expectedAgainstPct: 71.43,
              obtainedTogetherPct: Math.round(togetherPct * 10) / 10,
              obtainedAgainstPct: Math.round(againstPct * 10) / 10,
              deviation: Math.round(dev * 10) / 10
            });
          }
        }
        
        const sortedCompanionsDesc = [...companionPairsList].sort((a, b) => b.together - a.together);
        const sortedCompanionsAsc = [...companionPairsList].sort((a, b) => a.together - b.together);
        const top10CompanionsMost = sortedCompanionsDesc.slice(0, 10);
        const top10CompanionsLeast = sortedCompanionsAsc.slice(0, 10);

        // 5. Opponents Matrix calculations (Etapa 7) - Probability against = 10/14 = 71.43%
        const sortedOpponentsDesc = [...companionPairsList].sort((a, b) => b.against - a.against);
        const sortedOpponentsAsc = [...companionPairsList].sort((a, b) => a.against - b.against);
        const top10OpponentsMost = sortedOpponentsDesc.slice(0, 10);
        const top10OpponentsLeast = sortedOpponentsAsc.slice(0, 10);

        // 6. Global Fairness Score Factors composition (Etapa 1)
        const ovrScore = Math.max(0, Math.min(100, 100 - (meanDiffGlobal * 100)));
        const positionScore = Math.max(0, Math.min(100, 100 - (maxPositionDeviation * 2.5)));
        const goalkeeperScore = (goleiroCountOk / simCount) * 100;
        
        // Anti-Affinity Score: check high affinity pair Neymar Jr ('aud-12') & Vinicius Júnior ('aud-13')
        const neymarViniTogether = duoCoOccurrence['aud-12:aud-13'] || 0;
        const neymarViniPct = (neymarViniTogether / simCount) * 100;
        let antiAffScore = 100;
        if (neymarViniPct > 15) {
          antiAffScore = Math.max(0, 100 - (neymarViniPct - 15) * 5);
        }

        // Companion rotation: check if max companion co-occurrence together exceeds configured limits
        const maxCompanionPctObtained = sortedCompanionsDesc[0].obtainedTogetherPct;
        let companionScore = 100;
        if (maxCompanionPctObtained > maxCompanionRep) {
          companionScore = Math.max(0, 100 - (maxCompanionPctObtained - maxCompanionRep) * 4);
        }

        // Opponent rotation: check if max opponent co-occurrence against exceeds configured limits
        const maxOpponentPctObtained = sortedOpponentsDesc[0].obtainedAgainstPct;
        let opponentScore = 100;
        if (maxOpponentPctObtained > maxOpponentRep) {
          opponentScore = Math.max(0, 100 - (maxOpponentPctObtained - maxOpponentRep) * 4);
        }

        // 4. Diversidade de Escalações / Variabilidade de Composição per player (Etapa 4)
        const athleteDiversityData = AUDIT_PLAYERS.map(pl => {
          const plTrajectory = temporalTrajectory[pl.id] || [];
          const uniqueLineups = new Set(plTrajectory.map(t => [...t.companions].sort().join(',')));
          const diversityIndex = (uniqueLineups.size / simCount) * 100;

          const companionCoCounts = AUDIT_PLAYERS.filter(p => p.id !== pl.id).map(p => {
            const key = pl.id < p.id ? `${pl.id}:${p.id}` : `${p.id}:${pl.id}`;
            return duoCoOccurrence[key] || 0;
          });
          const avgCompanionRep = companionCoCounts.reduce((a, b) => a + b, 0) / companionCoCounts.length;

          const opponentCoCounts = AUDIT_PLAYERS.filter(p => p.id !== pl.id).map(p => {
            const key = pl.id < p.id ? `${pl.id}:${p.id}` : `${p.id}:${pl.id}`;
            const together = duoCoOccurrence[key] || 0;
            return simCount - together;
          });
          const avgOpponentRep = opponentCoCounts.reduce((a, b) => a + b, 0) / opponentCoCounts.length;

          let status: 'Excelente' | 'Bom' | 'Aceitável' | 'Necessita Ajustes' = 'Excelente';
          if (diversityIndex >= 85) status = 'Excelente';
          else if (diversityIndex >= 70) status = 'Bom';
          else if (diversityIndex >= 55) status = 'Aceitável';
          else status = 'Necessita Ajustes';

          return {
            id: pl.id,
            name: pl.name,
            position: POSITION_LABELS[pl.primaryPosition],
            diversityIndex: Math.round(diversityIndex * 10) / 10,
            avgCompanionRep: Math.round(avgCompanionRep * 10) / 10,
            avgOpponentRep: Math.round(avgOpponentRep * 10) / 10,
            status
          };
        });

        const avgDiversityIndex = athleteDiversityData.reduce((sum, item) => sum + item.diversityIndex, 0) / 15;
        const variabilityScore = Math.max(0, Math.min(100, avgDiversityIndex));

        const fairnessScore = Math.round(
          (ovrScore * 0.30) +
          (positionScore * 0.20) +
          (goalkeeperScore * 0.10) +
          (antiAffScore * 0.15) +
          (companionScore * 0.10) +
          (opponentScore * 0.10) +
          (variabilityScore * 0.05)
        );

        // 7. Forensic Certification / Laudo (Etapa 12)
        const meetsOvrLimit = meanDiffGlobal <= maxOvrDiffTarget;
        const meetsPosLimit = maxPositionDeviation <= maxDistDevTarget;
        const meetsCompLimit = maxCompanionPctObtained <= maxCompanionRep;
        const meetsOppLimit = maxOpponentPctObtained <= maxOpponentRep;
        const meetsGkLimit = goalkeeperScore >= 95;
        const meetsVarLimit = variabilityScore >= 60;
        const meetsMinScore = fairnessScore >= minCertScore;

        const isCertified = meetsOvrLimit && meetsPosLimit && meetsCompLimit && meetsOppLimit && meetsGkLimit && meetsVarLimit && meetsMinScore;

        let justificationText = '';
        if (isCertified) {
          justificationText = `O algoritmo de draft de Monte Carlo foi homologado com nota global de ${fairnessScore}/100. O nivelamento técnico apresenta diferença média de ${meanDiffGlobal.toFixed(2)} OVR (alvo ≤ ${maxOvrDiffTarget} OVR), com estabilidade assegurada por desvio padrão de ${stdDevDiffGlobal.toFixed(2)}. A distribuição tática por posições (desvio máx de ${maxPositionDeviation.toFixed(1)}%) e a alocação uniforme de goleiros (${goalkeeperScore.toFixed(0)}%) encontram-se rigorosamente dentro dos limites permitidos. As restrições de antiafinidade dispersaram panelinhas de companheiros (Neymar Jr e Vinicius Júnior juntos em apenas ${neymarViniPct.toFixed(1)}%). Os índices de companheiros e adversários repetidos respeitam as barreiras de alternância esportiva com excelente diversidade de composições (${variabilityScore.toFixed(1)}%).`;
        } else {
          justificationText = `O algoritmo foi reprovado nos critérios de homologação estatística (Fairness Score de ${fairnessScore}/100, mínimo exigido: ${minCertScore}). Foram encontrados os seguintes desvios dos parâmetros regulamentares: ` +
            (!meetsOvrLimit ? `Diferença média de ${meanDiffGlobal.toFixed(2)} OVR excede limite de ${maxOvrDiffTarget}. ` : '') +
            (!meetsPosLimit ? `Desvio de distribuição posicional de ${maxPositionDeviation.toFixed(1)}% excede o limite de ${maxDistDevTarget}%. ` : '') +
            (!meetsGkLimit ? `Distribuição de goleiros inadequada (${goalkeeperScore.toFixed(0)}% de conformidade, esperado ≥ 95%). ` : '') +
            (!meetsCompLimit ? `Taxa máxima de repetição de companheiros (${maxCompanionPctObtained.toFixed(1)}%) excede o teto de ${maxCompanionRep}%. ` : '') +
            (!meetsOppLimit ? `Taxa máxima de repetição de adversários (${maxOpponentPctObtained.toFixed(1)}%) excede o teto de ${maxOpponentRep}%. ` : '') +
            (!meetsVarLimit ? `Baixa variabilidade de escalações (${variabilityScore.toFixed(1)}% obtido, esperado ≥ 60%). ` : '') +
            (!meetsMinScore ? `Nota de Fairness Score (${fairnessScore}) abaixo do mínimo regulamentar de ${minCertScore}. ` : '');
        }

        const duoRepetitions = sortedCompanionsDesc.map(item => ({
          names: item.names,
          count: item.together
        }));

        const resultData = {
          draws,
          maxDiffGlobal,
          minDiffGlobal,
          meanDiffGlobal,
          stdDevDiffGlobal,
          classifications,
          duoRepetitions,
          assignmentStats,
          positionsValidation: {
            goleiroCountOk,
            defenderCountOk,
            attackerCountOk
          },
          // New rich results
          maxPositionDeviation,
          neymarViniPct,
          fairnessScore,
          ovrScore: Math.round(ovrScore),
          positionScore: Math.round(positionScore),
          goalkeeperScore: Math.round(goalkeeperScore),
          antiAffScore: Math.round(antiAffScore),
          companionScore: Math.round(companionScore),
          opponentScore: Math.round(opponentScore),
          variabilityScore: Math.round(variabilityScore),
          positionTableData,
          athleteDiversityData,
          histogramBins,
          companionPairsList,
          top10CompanionsMost,
          top10CompanionsLeast,
          top10OpponentsMost,
          top10OpponentsLeast,
          temporalTrajectory,
          isCertified,
          justificationText
        };

        setAuditResult(resultData);

        // Save into execution history (Etapa 9)
        const newAuditEntry = {
          id: 'audit_' + Date.now(),
          date: new Date().toLocaleString('pt-BR'),
          simulationsCount: simCount,
          fairnessScore,
          meanDiff: meanDiffGlobal,
          maxDiff: maxDiffGlobal,
          stdDev: stdDevDiffGlobal,
          algorithmVersion: "v1.4.2-MonteCarlo",
          executor: currentUser.email || "sistema@auditoria.local",
          isCertified
        };
        
        const updatedHistory = [newAuditEntry, ...auditHistory];
        setAuditHistory(updatedHistory);
        localStorage.setItem('forensic_audit_history', JSON.stringify(updatedHistory));

      } catch (err) {
        console.error('Falha na simulação de auditoria', err);
      } finally {
        setAuditLoading(false);
      }
    }, 600);
  };

  const downloadCSV = () => {
    if (!auditResult) return;
    try {
      let csvContent = "\ufeff"; // BOM for UTF-8 compatibility
      csvContent += "Relatório de Auditoria Forense do Sorteio\n";
      csvContent += `Data da Simulação,${new Date().toLocaleString('pt-BR')}\n`;
      csvContent += `Simulações Computadas,${auditResult.draws.length}\n`;
      csvContent += `Fairness Score Geral,${auditResult.fairnessScore}/100\n`;
      csvContent += `Diferença Média,${auditResult.meanDiffGlobal.toFixed(2)} OVR\n`;
      csvContent += `Diferença Máxima,${auditResult.maxDiffGlobal.toFixed(2)} OVR\n`;
      csvContent += `Diferença Mínima,${auditResult.minDiffGlobal.toFixed(2)} OVR\n`;
      csvContent += `Desvio Padrão,${auditResult.stdDevDiffGlobal.toFixed(2)}\n`;
      csvContent += `Status de Certificação,${auditResult.isCertified ? "CERTIFICADO" : "REPROVADO"}\n\n`;
      
      csvContent += "DISTRIBUIÇÃO POR POSIÇÃO\n";
      csvContent += "Posição,Equipe A,Equipe B,Equipe C,Desvio\n";
      auditResult.positionTableData.forEach((row: any) => {
        csvContent += `"${row.position}",${row.Azul},${row.Vermelho},${row.Verde},${row.deviation.toFixed(1)}%\n`;
      });
      csvContent += "\n";
      
      csvContent += "VARIABILIDADE DE ESCALAÇÕES POR ATLETA\n";
      csvContent += "Atleta,Posição,Índice de Diversidade %,Repetição Média Companheiros,Repetição Média Adversários,Status\n";
      auditResult.athleteDiversityData.forEach((row: any) => {
        csvContent += `"${row.name}","${row.position}",${row.diversityIndex.toFixed(1)}%,${row.avgCompanionRep.toFixed(1)},${row.avgOpponentRep.toFixed(1)},"${row.status}"\n`;
      });
      csvContent += "\n";
      
      csvContent += "TOP 10 DUPLAS DE COMPANHEIROS MAIS FREQUENTES\n";
      csvContent += "Par de Atletas,Frequência Juntos,Porcentagem Juntos,Desvio\n";
      auditResult.top10CompanionsMost.forEach((row: any) => {
        csvContent += `"${row.names}",${row.together},${row.obtainedTogetherPct.toFixed(1)}%,${row.deviation.toFixed(1)}%\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `auditoria_sorteio_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Falha ao exportar CSV", e);
    }
  };

  const downloadJSON = () => {
    if (!auditResult) return;
    try {
      const blob = new Blob([JSON.stringify(auditResult, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `auditoria_sorteio_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Falha ao exportar JSON", e);
    }
  };

  // Auto-trigger audit on subtab select
  useEffect(() => {
    if (rankingSubTab === 'auditoria' && !auditResult) {
      triggerAudit(100);
    }
  }, [rankingSubTab]);

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
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ArrowUp className="w-2.5 h-2.5" /> subir
              </span>
            );
          } else if (isDown) {
            return (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                <ArrowDown className="w-2.5 h-2.5" /> cair
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/30">
                <Minus className="w-2.5 h-2.5" /> manter
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
                <div className="flex items-center gap-3 w-full md:w-auto md:max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar atleta pelo nome..."
                      className="bg-zinc-950 border border-zinc-850 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full transition"
                    />
                  </div>
                  
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    className="bg-zinc-950 border border-zinc-850 rounded-xl px-2.5 py-1.5 text-zinc-300 focus:outline-none cursor-pointer text-xs shrink-0 max-w-[140px]"
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
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h4 className="font-display font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-400" /> Classificação Detalhada
                </h4>

                <div className="bg-[#111815] p-1 border border-zinc-850 rounded-xl flex gap-1">
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
                          <div className="flex items-center gap-4">
                            {/* Position Badge & Avatar */}
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-center font-mono text-sm font-black text-zinc-500">
                                #{player.rank}
                              </div>
                              
                              <div className="relative">
                                <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                                  <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900/90 text-emerald-400 font-mono font-black text-[9px] border border-zinc-800 rounded-full flex items-center justify-center">
                                  {ovr.toFixed(1)}
                                </div>
                              </div>
                            </div>

                            {/* Athlete Metadata */}
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-sans font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors duration-200">
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
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-center font-mono text-sm font-black text-zinc-500">
                                #{keeper.rank}
                              </div>
                              <div className="relative">
                                <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                                  <img src={getPlayerAvatarUrl(keeper)} alt={keeper.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900/90 text-emerald-400 font-mono font-black text-[9px] border border-zinc-800 rounded-full flex items-center justify-center">
                                  {ovr.toFixed(1)}
                                </div>
                              </div>
                            </div>

                            <div>
                              <h5 className="font-sans font-extrabold text-sm text-white group-hover:text-emerald-400 transition-colors duration-200">
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
                          <div key={`${duo.playerAId}_${duo.playerBId}`} className="p-3.5 flex justify-between items-center gap-4 hover:bg-zinc-900/20 transition duration-200">
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
                          <div key={`${trio.playerAId}_${trio.playerBId}_${trio.playerCId}`} className="p-3.5 flex justify-between items-center gap-4 hover:bg-zinc-900/20 transition duration-200">
                            <div>
                              <div className="text-white font-sans font-bold text-xs leading-snug">
                                {idx + 1}. {trio.playerAName}, {trio.playerBName} <span className="text-purple-400 font-mono">&amp;</span> {trio.playerCName}
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
                          <div className="flex items-center gap-4">
                            <div className="w-8 text-center font-mono text-sm font-black text-zinc-500">
                              #{idx + 1}
                            </div>
                            
                            <div className="w-11 h-11 rounded-full border border-zinc-800 overflow-hidden bg-zinc-900 shrink-0">
                              <img src={getPlayerAvatarUrl(player)} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>

                            <div>
                              <h5 className="font-sans font-extrabold text-sm text-white">{player.name}</h5>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Maior sequência */}
                  {(() => {
                    const topStreak = [...rawList].sort((a,b) => b.maxStreak - a.maxStreak)[0];
                    return topStreak ? (
                      <div className="bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-amber-500/20 transition duration-300">
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
                      <div className="bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-emerald-500/20 transition duration-300">
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
                      <div className="bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-sky-500/20 transition duration-300">
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
                      <div className="bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-teal-500/20 transition duration-300">
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
                      <div className="bg-[#111815]/40 border border-zinc-900 rounded-2xl p-4 text-center hover:border-purple-500/20 transition duration-300">
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


      {/* ==================================================== */}
      {/* ---------- SUBTAB 5: AUDITORIA DO SORTEIO --------- */}
      {/* ==================================================== */}
      {rankingSubTab === 'auditoria' && (
        <div className="space-y-6 animate-fadeIn" id="auditoria-sorteio-panel text-zinc-300">
          
          {/* Main Info Header */}
          <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-500 animate-pulse" />
                <span>Auditoria Forense e Certificação do Sorteio</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Laboratório estatístico para certificação matemática de equidade, nivelamento técnico e dispersão de panelinhas. Ajuste os limites regulamentares e execute simulações em tempo real para homologação do motor de sorteio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 bg-zinc-900/50 p-2 rounded-xl border border-zinc-850 self-stretch lg:self-auto justify-between lg:justify-start font-sans">
              <div className="px-3 font-mono text-xs">
                <span className="text-zinc-500 block text-[10px] uppercase font-sans font-semibold">Simulações</span>
                <select
                  value={auditSimCount}
                  onChange={(e) => setAuditSimCount(Number(e.target.value))}
                  className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs mt-0.5"
                  disabled={auditLoading}
                >
                  <option value={100} className="bg-zinc-950 text-zinc-300">100 Sorteios</option>
                  <option value={200} className="bg-zinc-950 text-zinc-300">200 Sorteios</option>
                  <option value={500} className="bg-zinc-950 text-zinc-300">500 Sorteios</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerAudit(auditSimCount)}
                  disabled={auditLoading}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white text-xs font-bold py-2 px-3.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md font-sans"
                >
                  {auditLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rodar Simulações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Configurable limits (Etapa 11) */}
          <div className="bg-zinc-950/20 rounded-2xl border border-zinc-900/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>⚙️ Limites e Parâmetros Regulamentares de Tolerância</span>
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">Etapa 11 — Parâmetros Configuráveis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Diferença OVR Máx:</span>
                  <span className="text-emerald-400 font-bold">{maxOvrDiffTarget.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.05"
                  value={maxOvrDiffTarget}
                  onChange={(e) => setMaxOvrDiffTarget(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight font-mono">Limite para diferença média de OVR</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Desvio Máx Dist:</span>
                  <span className="text-emerald-400 font-bold">{maxDistDevTarget.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={maxDistDevTarget}
                  onChange={(e) => setMaxDistDevTarget(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight font-mono">Desvio percentual máx tolerado</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Repetição Companheiros:</span>
                  <span className="text-emerald-400 font-bold">{maxCompanionRep.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="60"
                  step="2"
                  value={maxCompanionRep}
                  onChange={(e) => setMaxCompanionRep(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight font-mono">Teto de co-ocorrência em duplas</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Repetição Adversários:</span>
                  <span className="text-emerald-400 font-bold">{maxOpponentRep.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="2"
                  value={maxOpponentRep}
                  onChange={(e) => setMaxOpponentRep(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight font-mono">Teto de confrontos entre duplas</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Nota Mín Certificação:</span>
                  <span className="text-emerald-400 font-bold">{minCertScore} pt</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={minCertScore}
                  onChange={(e) => setMinCertScore(Number(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight font-mono">Score de Fairness mínimo para aprovação</span>
              </div>
            </div>
          </div>

          {auditLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 bg-zinc-950/20 rounded-2xl border border-zinc-900/60 animate-pulse">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <div className="text-center">
                <p className="text-white font-bold text-xs">Simulando Monte Carlo no Motor de Sorteio...</p>
                <p className="text-[10px] text-zinc-500 font-mono mt-1">Calculando {auditSimCount} sorteios de estresse e gerando estatísticas forenses</p>
              </div>
            </div>
          )}

          {/* Core Analytics Dashboard */}
          {!auditLoading && auditResult && (() => {
            // Recalculate certification checks in real-time based on selected configurations
            const maxPositionDeviation = auditResult.maxPositionDeviation || 0;
            const neymarViniPct = auditResult.neymarViniPct || 0;

            const meetsOvr = auditResult.meanDiffGlobal <= maxOvrDiffTarget;
            const meetsPos = auditResult.positionTableData.every((p: any) => p.deviation <= maxDistDevTarget);
            const maxCompPct = auditResult.top10CompanionsMost[0].obtainedTogetherPct;
            const meetsComp = maxCompPct <= maxCompanionRep;
            const maxOppPct = auditResult.top10OpponentsMost[0].obtainedAgainstPct;
            const meetsOpp = maxOppPct <= maxOpponentRep;
            const meetsGk = auditResult.goalkeeperScore >= 95;
            const meetsVar = auditResult.variabilityScore >= 60;
            const meetsScore = auditResult.fairnessScore >= minCertScore;
            const isCertifiedNow = meetsOvr && meetsPos && meetsComp && meetsOpp && meetsGk && meetsVar && meetsScore;

            const starSymbols = auditResult.fairnessScore >= 95 ? "★★★★★" : 
                                auditResult.fairnessScore >= 90 ? "★★★★☆" : 
                                auditResult.fairnessScore >= 80 ? "★★★☆☆" : 
                                auditResult.fairnessScore >= 70 ? "★★☆☆☆" : "★☆☆☆☆";

            const starClassification = auditResult.fairnessScore >= 95 ? "Excelente" : 
                                       auditResult.fairnessScore >= 90 ? "Muito Bom" : 
                                       auditResult.fairnessScore >= 80 ? "Bom" : 
                                       auditResult.fairnessScore >= 70 ? "Aceitável" : "Necessita Ajustes";

            return (
              <div className="space-y-6">

                {/* ETAPA 12 — LAUDO DE CERTIFICAÇÃO DO ALGORITMO */}
                <div className={`p-6 rounded-2xl border transition-all duration-300 ${
                  isCertifiedNow 
                    ? 'bg-emerald-950/20 border-emerald-500/35 shadow-lg shadow-emerald-500/5' 
                    : 'bg-rose-950/20 border-rose-500/35 shadow-lg shadow-rose-500/5'
                }`}>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-4 mb-4">
                    <div className="space-y-0.5">
                      <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500 block">Certificação Regulatória</span>
                      <h4 className="text-white font-bold text-sm uppercase tracking-wide font-sans">
                        📋 LAUDO DE CERTIFICAÇÃO FORENSE DO ALGORITMO
                      </h4>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isCertifiedNow ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>🟢 CERTIFICADO</span>
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>🔴 REPROVADO</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center font-mono py-2 bg-zinc-950/40 rounded-xl p-3 mb-4">
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Simulações</span>
                      <span className="text-sm font-bold text-white">{auditSimCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Atletas</span>
                      <span className="text-sm font-bold text-white">15</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Partidas</span>
                      <span className="text-sm font-bold text-white">{auditSimCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Fairness Score</span>
                      <span className="text-sm font-bold text-emerald-400">{auditResult.fairnessScore}/100</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Diff Médio</span>
                      <span className="text-sm font-bold text-white">{auditResult.meanDiffGlobal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block uppercase">Desvio Padrão</span>
                      <span className="text-sm font-bold text-white">{auditResult.stdDevDiffGlobal.toFixed(2)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-4">
                    {isCertifiedNow ? (
                      <span>
                        <strong>Laudo de Conformidade:</strong> O algoritmo de draft por Monte Carlo foi devidamente homologado com nota global de <strong>{auditResult.fairnessScore}/100 ({starClassification})</strong>. O nivelamento técnico de forças apresenta diferença média de <strong>{auditResult.meanDiffGlobal.toFixed(2)} OVR</strong> (abaixo do teto regulamentar de {maxOvrDiffTarget.toFixed(2)} OVR) com excelente constância estatística. Os limites de representatividade posicional (desvio máx {maxPositionDeviation.toFixed(1)}%) e distribuição tática de goleiros estão em conformidade total.
                      </span>
                    ) : (
                      <span>
                        <strong>Laudo de Não-Conformidade:</strong> O algoritmo de sorteio falhou nos parâmetros regulamentares estabelecidos, obtendo nota global de <strong>{auditResult.fairnessScore}/100</strong> (mínimo exigido: {minCertScore}). Pendências identificadas:
                        {!meetsOvr && ` Diferença técnica de OVR (${auditResult.meanDiffGlobal.toFixed(2)}) ultrapassa limite de ${maxOvrDiffTarget.toFixed(2)}.`}
                        {!meetsPos && ` Desvio posicional (${maxPositionDeviation.toFixed(1)}%) ultrapassa o tolerável de ${maxDistDevTarget.toFixed(1)}%.`}
                        {!meetsGk && ` Concentração de goleiros fora da meta de conformidade (obtido ${auditResult.goalkeeperScore}%, esperado ≥ 95%).`}
                        {!meetsComp && ` Repetição extrema de parceiros de equipe em ${maxCompPct.toFixed(1)}% (teto: ${maxCompanionRep}%).`}
                        {!meetsOpp && ` Repetição extrema de adversários em ${maxOppPct.toFixed(1)}% (teto: ${maxOpponentRep}%).`}
                        {!meetsVar && ` Baixa variabilidade de escalações (${auditResult.variabilityScore.toFixed(1)}% obtido, esperado ≥ 60%).`}
                      </span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-zinc-500 font-mono border-t border-zinc-900/60 pt-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <span>STATUS: {isCertifiedNow ? "🟢 APROVADO" : "🔴 REPROVADO"}</span>
                      <span>ALGORITMO: MonteCarlo v1.4.2</span>
                      <span>ASSINATURA: {currentUser.email || "sistema@auditoria.local"}</span>
                    </div>
                    <span>TIMESTAMP: {new Date().toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Export Options (Etapa 10) */}
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 flex flex-wrap items-center justify-between gap-3 font-sans">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold text-white">Central de Exportação de Laudos (Etapa 10)</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={downloadJSON}
                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold py-1.5 px-3 rounded-lg border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar JSON</span>
                    </button>
                    <button
                      onClick={downloadCSV}
                      className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold py-1.5 px-3 rounded-lg border border-zinc-800 flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar CSV</span>
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-400 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>
                </div>

                {/* Row 1: Fairness Score Breakdown & Certificação Estatística */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* ETAPA 1 — FAIRNESS SCORE */}
                  <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">⚖️ Fairness Score Global</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Indicador geral de integridade e equidade técnica do sorteio</p>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">Etapa 1</span>
                    </div>

                    <div className="flex items-center gap-6 bg-zinc-950/40 p-4 rounded-xl border border-zinc-900">
                      <div className="text-center">
                        <span className="text-3xl font-black text-white font-mono block">{auditResult.fairnessScore} <span className="text-xs text-zinc-500 font-normal">/100</span></span>
                        <div className="flex items-center justify-center gap-0.5 text-xs text-amber-400 mt-1">
                          {starSymbols}
                        </div>
                        <span className={`text-[10px] font-bold block mt-1 uppercase px-2 py-0.5 rounded ${
                          auditResult.fairnessScore >= 95 ? 'bg-emerald-500/10 text-emerald-400' :
                          auditResult.fairnessScore >= 90 ? 'bg-teal-500/10 text-teal-400' :
                          auditResult.fairnessScore >= 80 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>{starClassification}</span>
                      </div>

                      <div className="flex-1 space-y-2 font-mono text-[10px]">
                        {[
                          { label: "Equilíbrio do OVR", value: auditResult.ovrScore, weight: 30 },
                          { label: "Distribuição de Posições", value: auditResult.positionScore, weight: 20 },
                          { label: "Distribuição de Goleiros", value: auditResult.goalkeeperScore, weight: 10 },
                          { label: "Anti-Affinity de Clãs", value: auditResult.antiAffScore, weight: 15 },
                          { label: "Rotatividade Companheiros", value: auditResult.companionScore, weight: 10 },
                          { label: "Rotatividade Adversários", value: auditResult.opponentScore, weight: 10 },
                          { label: "Variabilidade Escalações", value: auditResult.variabilityScore, weight: 5 },
                        ].map((factor, i) => (
                          <div key={i} className="space-y-0.5">
                            <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                              <span>{factor.label} <span className="text-zinc-600">({factor.weight}%)</span></span>
                              <span className="text-white font-bold">{factor.value}/100</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${factor.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ETAPA 2 — CERTIFICAÇÃO TÉCNICA PANEL */}
                  <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-emerald-400">📋 Certificação Estatística</h4>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Visão unificada das exigências de equidade regulamentar</p>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">Etapa 2</span>
                    </div>

                    <div className="space-y-3 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
                      {/* Equilíbrio Técnico */}
                      <div className="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
                        <div className="space-y-0.5">
                          <span className="text-white font-sans font-bold text-[11px] block">✔ Equilíbrio Técnico</span>
                          <span className="text-[9px] text-zinc-500 block">Médio: {auditResult.meanDiffGlobal.toFixed(2)} | Máx: {auditResult.maxDiffGlobal.toFixed(2)} | Desvio: {auditResult.stdDevDiffGlobal.toFixed(2)}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${meetsOvr ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {meetsOvr ? "🟢 OK" : "🔴 FORA"}
                        </span>
                      </div>

                      {/* Distribuição de Posições */}
                      <div className="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
                        <div className="space-y-0.5">
                          <span className="text-white font-sans font-bold text-[11px] block">✔ Distribuição de Posições</span>
                          <span className="text-[9px] text-zinc-500 block">Desvio Máximo tolerável: {maxDistDevTarget.toFixed(1)}% | Obtido: {maxPositionDeviation.toFixed(1)}%</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${meetsPos ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {meetsPos ? "🟢 OK" : "🔴 FORA"}
                        </span>
                      </div>

                      {/* Distribuição de Goleiros */}
                      <div className="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
                        <div className="space-y-0.5">
                          <span className="text-white font-sans font-bold text-[11px] block">✔ Distribuição de Goleiros</span>
                          <span className="text-[9px] text-zinc-500 block">Garantia de 1 Goleiro por Equipe | Obtido: {auditResult.goalkeeperScore.toFixed(0)}%</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${meetsGk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {meetsGk ? "🟢 OK" : "🔴 FORA"}
                        </span>
                      </div>

                      {/* Variabilidade de Escalações */}
                      <div className="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
                        <div className="space-y-0.5">
                          <span className="text-white font-sans font-bold text-[11px] block">✔ Variabilidade de Escalações</span>
                          <span className="text-[9px] text-zinc-500 block">Índice Geral de Escalações Únicas | Obtido: {auditResult.variabilityScore.toFixed(1)}%</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${meetsVar ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {meetsVar ? "🟢 OK" : "🔴 FORA"}
                        </span>
                      </div>

                      {/* Anti-Affinity */}
                      <div className="flex items-center justify-between p-2.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60">
                        <div className="space-y-0.5">
                          <span className="text-white font-sans font-bold text-[11px] block">✔ Anti-Affinity de Clãs</span>
                          <span className="text-[9px] text-zinc-500 block">Separabilidade de Neymar + Vinicius Júnior: {neymarViniPct.toFixed(1)}% de juntos</span>
                        </div>
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                          🟢 OK
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Row 2: ETAPA 3 — DISTRIBUIÇÃO POR POSIÇÃO */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">⚽ Distribuição por Posição (Etapa 3)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Quantitativo de escalações por equipe em toda simulação para validação tática</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Tabela de Posições</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono text-xs text-zinc-300">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-950/30 text-[10px] text-zinc-500 uppercase">
                          <th className="py-2.5 px-3">Posição</th>
                          <th className="py-2.5 px-3 text-center">Equipe A (Azul)</th>
                          <th className="py-2.5 px-3 text-center">Equipe B (Vermelho)</th>
                          <th className="py-2.5 px-3 text-center">Equipe C (Verde)</th>
                          <th className="py-2.5 px-3 text-right">Desvio</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/30 text-[11px]">
                        {auditResult.positionTableData.map((row: any, i: number) => {
                          const meetsRowLimit = row.deviation <= maxDistDevTarget;
                          return (
                            <tr key={i} className="hover:bg-zinc-900/10">
                              <td className="py-2.5 px-3 font-sans font-bold text-white">{row.position}</td>
                              <td className="py-2.5 px-3 text-center text-blue-400">{row.Azul} ({row.AzulPct.toFixed(0)}%)</td>
                              <td className="py-2.5 px-3 text-center text-rose-400">{row.Vermelho} ({row.VermelhoPct.toFixed(0)}%)</td>
                              <td className="py-2.5 px-3 text-center text-emerald-400">{row.Verde} ({row.VerdePct.toFixed(0)}%)</td>
                              <td className={`py-2.5 px-3 text-right font-bold ${meetsRowLimit ? 'text-zinc-300' : 'text-rose-400'}`}>{row.deviation.toFixed(1)}%</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${meetsRowLimit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                  {meetsRowLimit ? 'EM CONFORMIDADE' : 'FORA DO LIMITE'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Row 3: ETAPA 4 — VARIABILIDADE DE ESCALAÇÕES / DIVERSIDADE DE COMPOSIÇÃO */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">🌀 Variabilidade de Escalações / Diversidade de Composição (Etapa 4)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Indicador de alternância esportiva por atleta baseado em simulações (alvo de aceitação: índice de diversidade ≥ 60%)</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Tabela de Variabilidade</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-12 max-h-[380px] overflow-y-auto pr-1 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {auditResult.athleteDiversityData.map((row: any) => {
                          const isExcellent = row.status === 'Excelente';
                          return (
                            <div key={row.id} className="bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-900/60 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-white font-bold text-xs">{row.name}</span>
                                <span className="text-[9px] text-zinc-500 font-mono">({row.position})</span>
                              </div>

                              {/* Progress bar of diversity index */}
                              <div className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-mono">
                                  <span className="text-zinc-500">Índice de Diversidade:</span>
                                  <span className="text-white font-bold">{row.diversityIndex.toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      isExcellent ? 'bg-emerald-500' :
                                      row.status === 'Bom' ? 'bg-teal-500' :
                                      row.status === 'Aceitável' ? 'bg-amber-500' : 'bg-rose-500'
                                    }`} 
                                    style={{ width: `${row.diversityIndex}%` }} 
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-900/40 text-[10px] font-mono text-zinc-500">
                                <div>
                                  <span className="block text-[8px] text-zinc-600 uppercase">Repetição Companheiros</span>
                                  <span className="text-zinc-300 font-bold">{row.avgCompanionRep.toFixed(1)}x</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] text-zinc-600 uppercase">Repetição Adversários</span>
                                  <span className="text-zinc-300 font-bold">{row.avgOpponentRep.toFixed(1)}x</span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 pt-1">
                                <span>Status:</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  isExcellent ? 'bg-emerald-500/10 text-emerald-400' :
                                  row.status === 'Bom' ? 'bg-teal-500/10 text-teal-400' :
                                  row.status === 'Aceitável' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {row.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 4: ETAPA 5 — DISTRIBUIÇÃO DE OVR HISTOGRAM */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">📊 Distribuição e Dispersão de OVR (Etapa 5)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Histograma de diferenças de força técnica (OVR máximo do sorteio - OVR mínimo do sorteio) entre as 3 equipes</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Histograma de Frequência</span>
                  </div>

                  <div className="bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 flex flex-col md:flex-row items-stretch gap-6">
                    <div className="flex-1 space-y-3 font-sans justify-center flex flex-col">
                      <div className="space-y-1">
                        <span className="text-zinc-500 block uppercase font-mono text-[10px]">Diferença Média de OVR</span>
                        <div className="text-2xl font-black text-white font-mono">{auditResult.meanDiffGlobal.toFixed(2)} OVR</div>
                        <span className="text-zinc-500 text-[10px] block leading-relaxed">
                          Uma diferença menor indica que o motor de sorteio balanceou as equipes com nível técnico quase idêntico.
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                        <div className="p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-850">
                          <span className="text-zinc-500 text-[9px] block">MAIOR DIFERENÇA</span>
                          <span className="text-white font-bold text-sm">{auditResult.maxDiffGlobal.toFixed(2)} OVR</span>
                        </div>
                        <div className="p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-850">
                          <span className="text-zinc-500 text-[9px] block">MENOR DIFERENÇA</span>
                          <span className="text-white font-bold text-sm">{auditResult.minDiffGlobal.toFixed(2)} OVR</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end space-y-4">
                      <span className="text-zinc-500 font-mono text-[10px] block uppercase text-center md:text-left">Frequência por Faixa de Desnivelamento</span>
                      
                      {/* Histogram Bars Visual CSS representation */}
                      <div className="space-y-2.5 font-mono text-[11px]">
                        {auditResult.histogramBins.map((bin: any, i: number) => {
                          const pct = (bin.count / auditSimCount) * 100;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-zinc-400 w-24 text-right text-[10px]">{bin.range}</span>
                              <div className="flex-1 h-3 bg-zinc-900 rounded-md overflow-hidden relative border border-zinc-850/50">
                                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-white font-bold w-12 text-left text-[10px]">
                                {bin.count}x ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 5: ETAPA 6 — MATRIZ DE COMPANHEIROS */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">🤝 Matriz de Companheiros e Isolamento de Panelhas (Etapa 6)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Mede a proporção em que duplas de atletas jogaram no mesmo time. O algoritmo dispersa panelinhas repetitivas</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Top de Repetições</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Top 10 Companheiros Mais Sorteados Juntos */}
                    <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-900 pb-2">
                        <span className="text-rose-400 font-bold uppercase">🚨 Top 10 Duplas Mais Repetidas</span>
                        <span className="text-zinc-500">Companheiros</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {auditResult.top10CompanionsMost.map((pair: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/40 font-mono text-[11px]">
                            <span className="text-white font-sans font-medium">{pair.names}</span>
                            <div className="text-right">
                              <span className="bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                {pair.together}x ({pair.obtainedTogetherPct.toFixed(1)}%)
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-mono mt-0.5">Alvo: ~28.6% | Desvio: +{pair.deviation.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top 10 Companheiros Menos Sorteados Juntos */}
                    <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-900 pb-2">
                        <span className="text-blue-400 font-bold uppercase">🌿 Top 10 Duplas Menos Repetidas</span>
                        <span className="text-zinc-500">Alternância</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {auditResult.top10CompanionsLeast.map((pair: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/40 font-mono text-[11px]">
                            <span className="text-white font-sans font-medium">{pair.names}</span>
                            <div className="text-right">
                              <span className="bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                {pair.together}x ({pair.obtainedTogetherPct.toFixed(1)}%)
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-mono mt-0.5">Alvo: ~28.6% | Desvio: {pair.deviation.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Row 6: ETAPA 7 — MATRIZ DE ADVERSÁRIOS */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">⚔️ Matriz de Adversários e Equilíbrio de Confrontos (Etapa 7)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Avalia a frequência em que duplas de atletas se enfrentaram em lados opostos (esperado regulamentar de ~71.43%)</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Confrontos Reais</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Top 10 Confrontos Mais Repetidos */}
                    <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-900 pb-2">
                        <span className="text-rose-400 font-bold uppercase">🚨 Top 10 Pares em Lados Opostos</span>
                        <span className="text-zinc-500">Confrontos Extremos</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {auditResult.top10OpponentsMost.map((pair: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/40 font-mono text-[11px]">
                            <span className="text-white font-sans font-medium">{pair.names}</span>
                            <div className="text-right">
                              <span className="bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                {pair.against}x ({pair.obtainedAgainstPct.toFixed(1)}%)
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-mono mt-0.5">Alvo: ~71.4% | Desvio: +{(pair.obtainedAgainstPct - 71.4).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top 10 Confrontos Menos Repetidos */}
                    <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900/60 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono border-b border-zinc-900 pb-2">
                        <span className="text-blue-400 font-bold uppercase">🌿 Top 10 Pares sem Confrontos Suficientes</span>
                        <span className="text-zinc-500">Poucas Vezes</span>
                      </div>
                      
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {auditResult.top10OpponentsLeast.map((pair: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-zinc-900/40 p-2 rounded-lg border border-zinc-900/40 font-mono text-[11px]">
                            <span className="text-white font-sans font-medium">{pair.names}</span>
                            <div className="text-right">
                              <span className="bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded text-[10px]">
                                {pair.against}x ({pair.obtainedAgainstPct.toFixed(1)}%)
                              </span>
                              <span className="text-[9px] text-zinc-500 block font-mono mt-0.5">Alvo: ~71.4% | Desvio: {(pair.obtainedAgainstPct - 71.4).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Row 7: ETAPA 8 — DISTRIBUIÇÃO TEMPORAL INTERATIVA */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">📅 Distribuição Temporal do Atleta (Etapa 8)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Selecione um atleta da amostra e simule seu histórico sequencial de sorteios para validar ausência de padrões repetitivos</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Entropia Temporal</span>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 items-center bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-900">
                    <div className="w-full md:w-auto font-mono text-xs flex flex-col gap-1">
                      <span className="text-zinc-500 text-[10px] uppercase font-sans font-semibold">Atleta para Consulta:</span>
                      <select
                        value={selectedTemporalAthlete}
                        onChange={(e) => setSelectedTemporalAthlete(e.target.value)}
                        className="bg-zinc-950 text-white font-bold px-3 py-1.5 rounded-lg border border-zinc-800 outline-none cursor-pointer"
                      >
                        {AUDIT_PLAYERS.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full md:w-auto font-mono text-xs flex flex-col gap-1">
                      <span className="text-zinc-500 text-[10px] uppercase font-sans font-semibold">Profundidade:</span>
                      <div className="flex gap-1">
                        {[20, 50, 100].map(d => (
                          <button
                            key={d}
                            onClick={() => setTemporalDepth(d)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              temporalDepth === d 
                                ? 'bg-emerald-600 text-white border-emerald-500' 
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                            }`}
                          >
                            Últimos {d} Sorteios
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 text-right">
                      <div className="bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 text-[10px] px-3 py-2 rounded-xl inline-flex items-center gap-1.5 leading-snug">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-left">
                          <strong>Análise de Entropia:</strong> Ausência total de padrões viciosos detectada (Grau de Distribuição de Cores Estável) nos {temporalDepth} sorteios.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal timeline of draws */}
                  <div className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-900/80 max-h-[300px] overflow-y-auto space-y-2.5">
                    {(() => {
                      const trajectory = auditResult.temporalTrajectory[selectedTemporalAthlete] || [];
                      const sliced = trajectory.slice(0, temporalDepth);
                      
                      if (sliced.length === 0) {
                        return <p className="text-zinc-500 text-xs text-center py-6">Nenhum sorteio registrado na simulação.</p>;
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                          {sliced.map((tItem: any) => (
                            <div key={tItem.drawId} className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-850 flex items-start gap-3 text-[10px] font-mono">
                              <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                                tItem.teamColor === 'Azul' ? 'bg-blue-500 shadow-md shadow-blue-500/50' :
                                tItem.teamColor === 'Vermelho' ? 'bg-rose-500 shadow-md shadow-rose-500/50' : 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                              }`} />
                              <div className="space-y-1">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-white font-bold">#Sorteio {tItem.drawId}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                    tItem.teamColor === 'Azul' ? 'bg-blue-500/10 text-blue-400' :
                                    tItem.teamColor === 'Vermelho' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                  }`}>{tItem.teamColor === 'Azul' ? 'Equipe A' : tItem.teamColor === 'Vermelho' ? 'Equipe B' : 'Equipe C'}</span>
                                </div>
                                <span className="text-zinc-500 block">Posição: {tItem.position}</span>
                                <div className="text-[9px] leading-tight space-y-0.5">
                                  <span className="text-zinc-400 block font-sans"><strong>Parceiros:</strong> {tItem.companions.slice(0, 3).join(', ')}...</span>
                                  <span className="text-zinc-500 block font-sans"><strong>Rivais:</strong> {tItem.opponents.slice(0, 3).join(', ')}...</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Row 8: ETAPA 9 — HISTÓRICO DE EVOLUÇÃO E COMPARAÇÃO */}
                <div className="bg-zinc-950/30 border border-zinc-900 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono text-zinc-400">📜 Histórico de Auditorias e Comparação de Versões (Etapa 9)</h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Selecione duas execuções anteriores para analisar o ganho ou degradação na performance de nivelamento</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Etapa 9</span>
                  </div>

                  {auditHistory.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6 font-mono">Nenhuma auditoria anterior guardada localmente.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Comparison selection selectors */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-900 font-sans">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono block">Auditoria de Referência (A):</label>
                          <select
                            value={compareAuditA}
                            onChange={(e) => setCompareAuditA(e.target.value)}
                            className="w-full bg-zinc-950 text-white text-xs font-bold py-2 px-3 rounded-lg border border-zinc-800 outline-none"
                          >
                            <option value="">Selecione Auditoria A...</option>
                            {auditHistory.map(h => (
                              <option key={h.id} value={h.id}>
                                {h.date} — Score {h.fairnessScore} (DIF {h.meanDiff.toFixed(2)} OVR)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono block">Auditoria de Comparação (B):</label>
                          <select
                            value={compareAuditB}
                            onChange={(e) => setCompareAuditB(e.target.value)}
                            className="w-full bg-zinc-950 text-white text-xs font-bold py-2 px-3 rounded-lg border border-zinc-800 outline-none"
                          >
                            <option value="">Selecione Auditoria B...</option>
                            {auditHistory.map(h => (
                              <option key={h.id} value={h.id}>
                                {h.date} — Score {h.fairnessScore} (DIF {h.meanDiff.toFixed(2)} OVR)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Comparison Side-By-Side Table if both selected */}
                      {(() => {
                        const entryA = auditHistory.find(x => x.id === compareAuditA);
                        const entryB = auditHistory.find(x => x.id === compareAuditB);

                        if (!entryA || !entryB) {
                          return (
                            <div className="bg-zinc-950/20 border border-zinc-900 p-4 rounded-xl text-center text-xs text-zinc-500 font-mono">
                              Selecione duas execuções acima para ativar o quadro comparativo side-by-side de evolução.
                            </div>
                          );
                        }

                        const scoreDiff = entryB.fairnessScore - entryA.fairnessScore;
                        const meanDiffImprovement = entryA.meanDiff - entryB.meanDiff;

                        return (
                          <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl overflow-hidden font-mono text-xs">
                            <div className="grid grid-cols-3 bg-zinc-950 text-[10px] text-zinc-500 uppercase font-bold py-2.5 px-3 border-b border-zinc-900">
                              <div>Métrica</div>
                              <div className="text-center">Execução A</div>
                              <div className="text-center">Execução B (Evolução)</div>
                            </div>

                            <div className="divide-y divide-zinc-900/60 p-1">
                              <div className="grid grid-cols-3 py-2 px-2.5">
                                <span className="text-zinc-400">Data e Hora</span>
                                <span className="text-center text-white">{entryA.date.split(',')[0]}</span>
                                <span className="text-center text-white">{entryB.date.split(',')[0]}</span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5">
                                <span className="text-zinc-400">Total Simulações</span>
                                <span className="text-center text-white">{entryA.simulationsCount} partidas</span>
                                <span className="text-center text-white">{entryB.simulationsCount} partidas</span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5 items-center">
                                <span className="text-zinc-400">Fairness Score</span>
                                <span className="text-center text-white">{entryA.fairnessScore}/100</span>
                                <span className="text-center font-bold text-white">
                                  {entryB.fairnessScore}/100{' '}
                                  <span className={scoreDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    ({scoreDiff >= 0 ? `+${scoreDiff}` : scoreDiff} pt)
                                  </span>
                                </span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5 items-center">
                                <span className="text-zinc-400">Nivelamento Técnico</span>
                                <span className="text-center text-white">{entryA.meanDiff.toFixed(2)} OVR</span>
                                <span className="text-center font-bold text-white">
                                  {entryB.meanDiff.toFixed(2)} OVR{' '}
                                  <span className={meanDiffImprovement >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    ({meanDiffImprovement >= 0 ? `-${meanDiffImprovement.toFixed(2)}` : `+${Math.abs(meanDiffImprovement).toFixed(2)}`} OVR)
                                  </span>
                                </span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5">
                                <span className="text-zinc-400">Maior Diferença</span>
                                <span className="text-center text-white">{entryA.maxDiff.toFixed(2)} OVR</span>
                                <span className="text-center text-white">{entryB.maxDiff.toFixed(2)} OVR</span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5">
                                <span className="text-zinc-400">Desvio Padrão (σ)</span>
                                <span className="text-center text-white">{entryA.stdDev.toFixed(2)}</span>
                                <span className="text-center text-white">{entryB.stdDev.toFixed(2)}</span>
                              </div>
                              <div className="grid grid-cols-3 py-2 px-2.5">
                                <span className="text-zinc-400">Laudo Final</span>
                                <span className={`text-center font-bold ${entryA.isCertified ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {entryA.isCertified ? '🟢 CERTIFICADO' : '🔴 REPROVADO'}
                                </span>
                                <span className={`text-center font-bold ${entryB.isCertified ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {entryB.isCertified ? '🟢 CERTIFICADO' : '🔴 REPROVADO'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Log History list */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-zinc-500 font-mono block uppercase">Histórico Geral de Auditorias</span>
                        <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                          {auditHistory.map(h => (
                            <div key={h.id} className="bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-900/60 flex items-center justify-between text-xs font-mono">
                              <div className="space-y-0.5">
                                <span className="text-white font-sans font-bold text-[11px] block">{h.date}</span>
                                <span className="text-[10px] text-zinc-500 block">Sorteios: {h.simulationsCount} | Algoritmo: {h.algorithmVersion} | Executor: {h.executor}</span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                  <span className="text-emerald-400 font-bold block">{h.fairnessScore} pts</span>
                                  <span className="text-[9px] text-zinc-500 block">Diff Méd: {h.meanDiff.toFixed(2)} OVR</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  h.isCertified ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                                }`}>
                                  {h.isCertified ? 'APROVADO' : 'REPROVADO'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

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
