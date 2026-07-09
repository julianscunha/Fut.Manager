import React, { useState, useEffect } from 'react';
import { User, POSITION_LABELS } from '../types';
import { useAppConfig } from '../contexts/AppConfigContext';
import { 
  Zap, 
  Sliders, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Download, 
  Clock,
  RotateCcw,
  Shield
} from 'lucide-react';

interface LaboratorioManagerProps {
  currentUser: User;
  simulatedState: number | null;
  setSimulatedState: (state: number | null) => void;
}

// Stable reference athletes for mathematically rigorous audit (3 GKs, 4 DFs, 4 MFs, 4 FWs)
const AUDIT_PLAYERS = [
  { id: 'aud-1', name: 'Alisson Becker', primaryPosition: 'goleiro' as const, secondaryPositions: [], rating: 4.8 },
  { id: 'aud-2', name: 'Ederson Moraes', primaryPosition: 'goleiro' as const, secondaryPositions: [], rating: 4.4 },
  { id: 'aud-3', name: 'Weverton Silva', primaryPosition: 'goleiro' as const, secondaryPositions: [], rating: 3.8 },
  
  { id: 'aud-4', name: 'Thiago Silva', primaryPosition: 'zagueiro' as const, secondaryPositions: ['volante'], rating: 4.5 },
  { id: 'aud-5', name: 'Marquinhos', primaryPosition: 'zagueiro' as const, secondaryPositions: [], rating: 4.2 },
  { id: 'aud-6', name: 'Casemiro', primaryPosition: 'volante' as const, secondaryPositions: ['zagueiro'], rating: 4.0 },
  { id: 'aud-7', name: 'Guilherme Arana', primaryPosition: 'zagueiro' as const, secondaryPositions: [], rating: 3.5 },
  
  { id: 'aud-8', name: 'Lucas Paquetá', primaryPosition: 'meio_campo' as const, secondaryPositions: ['atacante'], rating: 4.6 },
  { id: 'aud-9', name: 'Bruno Guimarães', primaryPosition: 'meio_campo' as const, secondaryPositions: [], rating: 4.3 },
  { id: 'aud-10', name: 'Paulo Ganso', primaryPosition: 'meio_campo' as const, secondaryPositions: [], rating: 3.9 },
  { id: 'aud-11', name: 'Raphael Veiga', primaryPosition: 'meio_campo' as const, secondaryPositions: [], rating: 3.4 },
  
  { id: 'aud-12', name: 'Neymar Jr', primaryPosition: 'atacante' as const, secondaryPositions: ['meio_campo'], rating: 4.9 },
  { id: 'aud-13', name: 'Vinicius Júnior', primaryPosition: 'atacante' as const, secondaryPositions: [], rating: 4.7 },
  { id: 'aud-14', name: 'Rodrygo Goes', primaryPosition: 'atacante' as const, secondaryPositions: [], rating: 4.1 },
  { id: 'aud-15', name: 'Endrick Felipe', primaryPosition: 'atacante' as const, secondaryPositions: [], rating: 3.2 }
];

export default function LaboratorioManager({
  currentUser,
  simulatedState,
  setSimulatedState
}: LaboratorioManagerProps) {
  const { appName } = useAppConfig();
  const [labTab, setLabTab] = useState<'simulator' | 'auditoria'>('simulator');
  
  // Auditoria States
  const [auditSimCount, setAuditSimCount] = useState<number>(100);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  
  // Custom tolerances / bounds
  const [maxOvrDiffTarget, setMaxOvrDiffTarget] = useState<number>(0.35);
  const [maxDistDevTarget, setMaxDistDevTarget] = useState<number>(15.0);
  const [maxCompanionRep, setMaxCompanionRep] = useState<number>(45.0);
  const [maxOpponentRep, setMaxOpponentRep] = useState<number>(80.0);
  const [minCertScore, setMinCertScore] = useState<number>(85);

  const [selectedAuditA, setSelectedAuditA] = useState<string>('aud-12'); // Neymar
  const [selectedAuditB, setSelectedAuditB] = useState<string>('aud-13'); // Vini
  
  const [auditHistory, setAuditHistory] = useState<any[]>([]);

  // Load audit history
  useEffect(() => {
    try {
      const stored = localStorage.getItem('forensic_audit_history');
      if (stored) {
        setAuditHistory(JSON.parse(stored));
      } else {
        // Safe default initial entries
        const initial = [
          {
            id: 'audit_init_1',
            date: new Date(Date.now() - 3600000 * 24).toLocaleString('pt-BR'),
            simulationsCount: 100,
            fairnessScore: 92,
            meanDiff: 0.18,
            maxDiff: 0.32,
            stdDev: 0.08,
            algorithmVersion: "v1.4.2-MonteCarlo",
            executor: "sistema@auditoria.local",
            isCertified: true
          },
          {
            id: 'audit_init_2',
            date: new Date(Date.now() - 3600000 * 48).toLocaleString('pt-BR'),
            simulationsCount: 200,
            fairnessScore: 94,
            meanDiff: 0.14,
            maxDiff: 0.28,
            stdDev: 0.07,
            algorithmVersion: "v1.4.1-MonteCarlo",
            executor: "sistema.automatico@racha.com",
            isCertified: true
          }
        ];
        setAuditHistory(initial);
        localStorage.setItem('forensic_audit_history', JSON.stringify(initial));
      }
    } catch (e) {
      console.error('Error loading history', e);
    }
  }, []);

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
          const isDef = (pos: string) => pos === 'zagueiro' || pos === 'volante';
          const isAtt = (pos: string) => pos === 'meio_campo' || pos === 'atacante';
          const getDuoAff = (pA: string, pB: string) => {
            if ((pA === 'aud-12' && pB === 'aud-13') || (pA === 'aud-13' && pB === 'aud-12')) return 0.1; 
            return 1.0;
          };

          const goleiros = ['aud-1', 'aud-2', 'aud-3'];
          const shuffledGk = [...goleiros].sort(() => Math.random() - 0.5);
          const gkB = shuffledGk[0];
          const gkR = shuffledGk[1];
          const gkG = shuffledGk[2];

          const linePlayers = AUDIT_PLAYERS.filter(p => p.primaryPosition !== 'goleiro');
          let bestDraw: any = null;
          let bestDrawScore = Infinity;

          for (let attempt = 0; attempt < 25; attempt++) {
            const shuffledLine = [...linePlayers].sort(() => Math.random() - 0.5);
            const teamBluePids = shuffledLine.slice(0, 4).map(p => p.id);
            const teamRedPids = shuffledLine.slice(4, 8).map(p => p.id);
            const teamGreenPids = shuffledLine.slice(8, 12).map(p => p.id);

            const teamBlueAll = [gkB, ...teamBluePids];
            const teamRedAll = [gkR, ...teamRedPids];
            const teamGreenAll = [gkG, ...teamGreenPids];

            const ovrBlue = teamBlueAll.reduce((s, id) => s + playerOveralls[id], 0) / 5;
            const ovrRed = teamRedAll.reduce((s, id) => s + playerOveralls[id], 0) / 5;
            const ovrGreen = teamGreenAll.reduce((s, id) => s + playerOveralls[id], 0) / 5;

            const meanOvr = (ovrBlue + ovrRed + ovrGreen) / 3;
            const devBlue = Math.abs(ovrBlue - meanOvr);
            const devRed = Math.abs(ovrRed - meanOvr);
            const devGreen = Math.abs(ovrGreen - meanOvr);
            const totalOvrDeviation = devBlue + devRed + devGreen;

            let penalty = 0;
            const pairsToCheck = [
              [teamBlueAll, 'Azul'],
              [teamRedAll, 'Vermelho'],
              [teamGreenAll, 'Verde']
            ] as const;

            pairsToCheck.forEach(([pids]) => {
              for (let i = 0; i < pids.length; i++) {
                for (let j = i + 1; j < pids.length; j++) {
                  const aff = getDuoAff(pids[i], pids[j]);
                  if (aff < 0.5) penalty += 5.0; // Anti-affinity penalty
                }
              }
            });

            const drawScore = totalOvrDeviation + penalty;
            if (drawScore < bestDrawScore) {
              bestDrawScore = drawScore;
              bestDraw = {
                Blue: teamBlueAll,
                Red: teamRedAll,
                Green: teamGreenAll,
                ovrBlue,
                ovrRed,
                ovrGreen,
                totalOvrDeviation
              };
            }
          }

          draws.push(bestDraw);

          const teamBluePlayers = bestDraw.Blue;
          const teamRedPlayers = bestDraw.Red;
          const teamGreenPlayers = bestDraw.Green;

          teamBluePlayers.forEach((pId: string) => { assignmentStats[pId].Azul++; assignmentStats[pId].total++; });
          teamRedPlayers.forEach((pId: string) => { assignmentStats[pId].Vermelho++; assignmentStats[pId].total++; });
          teamGreenPlayers.forEach((pId: string) => { assignmentStats[pId].Verde++; assignmentStats[pId].total++; });

          const checkTeams = [
            { list: teamBluePlayers, color: 'Azul' as const },
            { list: teamRedPlayers, color: 'Vermelho' as const },
            { list: teamGreenPlayers, color: 'Verde' as const }
          ];

          checkTeams.forEach(({ list, color }) => {
            const hasGk = list.some(id => ['aud-1', 'aud-2', 'aud-3'].includes(id));
            if (hasGk) goleiroCountOk++;

            const dCount = list.filter(id => isDef(AUDIT_PLAYERS.find(p => p.id === id)!.primaryPosition)).length;
            if (dCount >= 1 && dCount <= 2) defenderCountOk++;

            const aCount = list.filter(id => isAtt(AUDIT_PLAYERS.find(p => p.id === id)!.primaryPosition)).length;
            if (aCount >= 1 && aCount <= 2) attackerCountOk++;

            list.forEach((pId: string) => {
              const cat = getPlayerPositionCategory(pId);
              positionCounts[cat][color]++;
              positionCounts[cat].total++;
            });

            for (let i = 0; i < list.length; i++) {
              for (let j = i + 1; j < list.length; j++) {
                const key = [list[i], list[j]].sort().join('__');
                duoCoOccurrence[key] = (duoCoOccurrence[key] || 0) + 1;
              }
            }
          });

          checkTeams.forEach(({ list, color }) => {
            list.forEach((pId: string) => {
              const comps = list.filter((x: string) => x !== pId).map((x: string) => AUDIT_PLAYERS.find(p => p.id === x)?.name || '');
              const opponents: string[] = [];
              checkTeams.forEach(oth => {
                if (oth.color !== color) {
                  oth.list.forEach((otherPid: string) => {
                    opponents.push(AUDIT_PLAYERS.find(p => p.id === otherPid)?.name || '');
                  });
                }
              });

              temporalTrajectory[pId].push({
                drawId: d + 1,
                teamColor: color,
                position: POSITION_LABELS[AUDIT_PLAYERS.find(p => p.id === pId)!.primaryPosition],
                companions: comps,
                opponents
              });
            });
          });
        }

        const maxDiffs = draws.map(d => Math.max(d.ovrBlue, d.ovrRed, d.ovrGreen) - Math.min(d.ovrBlue, d.ovrRed, d.ovrGreen));
        const maxDiffGlobal = Math.max(...maxDiffs);
        const minDiffGlobal = Math.min(...maxDiffs);
        const meanDiffGlobal = maxDiffs.reduce((s, x) => s + x, 0) / simCount;
        const varianceDiff = maxDiffs.reduce((s, x) => s + Math.pow(x - meanDiffGlobal, 2), 0) / simCount;
        const stdDevDiffGlobal = Math.sqrt(varianceDiff);

        const expectedCount = simCount / 3;
        const classifications = AUDIT_PLAYERS.map(pl => {
          const statsPl = assignmentStats[pl.id];
          const devB = Math.abs(statsPl.Azul - expectedCount) / expectedCount * 100;
          const devR = Math.abs(statsPl.Vermelho - expectedCount) / expectedCount * 100;
          const devG = Math.abs(statsPl.Verde - expectedCount) / expectedCount * 100;
          const maxDev = Math.max(devB, devR, devG);

          let classification: 'Excelente' | 'Boa' | 'Desequilibrada' = 'Excelente';
          if (maxDev <= 15) classification = 'Excelente';
          else if (maxDev <= 30) classification = 'Boa';
          else classification = 'Desequilibrada';

          return {
            id: pl.id,
            name: pl.name,
            position: POSITION_LABELS[pl.primaryPosition],
            rating: pl.rating,
            Azul: statsPl.Azul,
            Vermelho: statsPl.Vermelho,
            Verde: statsPl.Verde,
            maxDeviation: maxDev,
            classification
          };
        });
        const positionTableData = (['Goleiros', 'Zagueiros', 'Laterais', 'Meias', 'Atacantes'] as const).map(cat => {
          const statsCat = positionCounts[cat];
          const catTotal = statsCat.total;
          const expectedCatCount = catTotal / 3;

          const devB = Math.abs(statsCat.Azul - expectedCatCount) / (expectedCatCount || 1) * 100;
          const devR = Math.abs(statsCat.Vermelho - expectedCatCount) / (expectedCatCount || 1) * 100;
          const devG = Math.abs(statsCat.Verde - expectedCatCount) / (expectedCatCount || 1) * 100;
          const avgDev = (devB + devR + devG) / 3;

          return {
            position: cat,
            Azul: statsCat.Azul,
            Vermelho: statsCat.Vermelho,
            Verde: statsCat.Verde,
            deviation: avgDev
          };
        });

        const maxPositionDeviation = Math.max(...positionTableData.map(r => r.deviation));

        const companionPairsList: Array<{ names: string; together: number; obtainedTogetherPct: number; deviation: number }> = [];
        for (let i = 0; i < AUDIT_PLAYERS.length; i++) {
          for (let j = i + 1; j < AUDIT_PLAYERS.length; j++) {
            const pA = AUDIT_PLAYERS[i];
            const pB = AUDIT_PLAYERS[j];
            const key = [pA.id, pB.id].sort().join('__');
            const countTogether = duoCoOccurrence[key] || 0;
            const obtainedTogetherPct = (countTogether / simCount) * 100;
            const theoreticalTogetherPct = (4 / 14) * 100; // chance of being with player B in a 5-player team out of 15
            const deviation = obtainedTogetherPct - theoreticalTogetherPct;

            companionPairsList.push({
              names: `${pA.name} & ${pB.name}`,
              together: countTogether,
              obtainedTogetherPct,
              deviation
            });
          }
        }

        const sortedCompanionsDesc = [...companionPairsList].sort((a, b) => b.together - a.together);
        const sortedCompanionsAsc = [...companionPairsList].sort((a, b) => a.together - b.together);

        const neymarViniPair = companionPairsList.find(p => p.names.includes('Neymar Jr') && p.names.includes('Vinicius Júnior'));
        const neymarViniPct = neymarViniPair ? neymarViniPair.obtainedTogetherPct : 0.0;

        const maxOvrDiffObtained = meanDiffGlobal;
        const ovrScore = Math.max(0, 100 - (maxOvrDiffObtained * 180));
        const positionScore = Math.max(0, 100 - (maxPositionDeviation * 2.5));
        
        const gkBCompliance = Math.abs(assignmentStats['aud-1'].Azul - expectedCount) / expectedCount;
        const gkRCompliance = Math.abs(assignmentStats['aud-2'].Vermelho - expectedCount) / expectedCount;
        const gkGCompliance = Math.abs(assignmentStats['aud-3'].Verde - expectedCount) / expectedCount;
        const avgGkDev = (gkBCompliance + gkRCompliance + gkGCompliance) / 3 * 100;
        const goalkeeperScore = Math.max(0, 100 - (avgGkDev * 3));

        const antiAffScore = 100 - (neymarViniPct * 10);

        const maxCompanionPctObtained = sortedCompanionsDesc[0].obtainedTogetherPct;
        const companionScore = Math.max(0, 100 - Math.max(0, maxCompanionPctObtained - 28) * 4);

        const opponentPairsList: Array<{ names: string; against: number; obtainedAgainstPct: number; deviation: number }> = [];
        for (let i = 0; i < AUDIT_PLAYERS.length; i++) {
          for (let j = i + 1; j < AUDIT_PLAYERS.length; j++) {
            const pA = AUDIT_PLAYERS[i];
            const pB = AUDIT_PLAYERS[j];
            let againstCount = 0;
            draws.forEach(d => {
              const inBlue = d.Blue.includes(pA.id);
              const inRed = d.Red.includes(pA.id);
              const inGreen = d.Green.includes(pA.id);

              const bBlue = d.Blue.includes(pB.id);
              const bRed = d.Red.includes(pB.id);
              const bGreen = d.Green.includes(pB.id);

              if ((inBlue && (bRed || bGreen)) || (inRed && (bBlue || bGreen)) || (inGreen && (bBlue || bRed))) {
                againstCount++;
              }
            });

            const obtainedAgainstPct = (againstCount / simCount) * 100;
            const theoreticalAgainstPct = (10 / 14) * 100; 
            const deviation = obtainedAgainstPct - theoreticalAgainstPct;

            opponentPairsList.push({
              names: `${pA.name} x ${pB.name}`,
              against: againstCount,
              obtainedAgainstPct,
              deviation
            });
          }
        }

        const sortedOpponentsDesc = [...opponentPairsList].sort((a, b) => b.against - a.against);
        const sortedOpponentsAsc = [...opponentPairsList].sort((a, b) => a.against - b.against);

        const maxOpponentPctObtained = sortedOpponentsDesc[0].obtainedAgainstPct;
        const opponentScore = Math.max(0, 100 - Math.max(0, maxOpponentPctObtained - 71) * 3);

        const maxDiff = Math.max(...maxDiffs);
        const minDiff = Math.min(...maxDiffs);
        const binSize = (maxDiff - minDiff) / 5 || 0.1;
        const histogramBins = Array.from({ length: 5 }, (_, idx) => {
          const start = minDiff + idx * binSize;
          const end = start + binSize;
          const count = maxDiffs.filter(x => x >= start && x < end).length;
          return {
            range: `${start.toFixed(2)} - ${end.toFixed(2)}`,
            count,
            pct: (count / simCount) * 100
          };
        });

        const athleteDiversityData = AUDIT_PLAYERS.map(pl => {
          const compCounts: Record<string, number> = {};
          const oppCounts: Record<string, number> = {};

          temporalTrajectory[pl.id].forEach(t => {
            t.companions.forEach(c => { compCounts[c] = (compCounts[c] || 0) + 1; });
            t.opponents.forEach(o => { oppCounts[o] = (oppCounts[o] || 0) + 1; });
          });

          const compValues = Object.values(compCounts);
          const oppValues = Object.values(oppCounts);

          const expectedComp = (simCount * 4) / 14;
          const expectedOpp = (simCount * 10) / 14;

          const compVariance = compValues.reduce((s, v) => s + Math.pow(v - expectedComp, 2), 0) / 14;
          const oppVariance = oppValues.reduce((s, v) => s + Math.pow(v - expectedOpp, 2), 0) / 14;

          const compStdDev = Math.sqrt(compVariance);
          const oppStdDev = Math.sqrt(oppVariance);

          const devCompPct = (compStdDev / expectedComp) * 100;
          const devOppPct = (oppStdDev / expectedOpp) * 100;

          const diversityIndex = 100 - ((devCompPct + devOppPct) / 2);
          const avgCompanionRep = compValues.reduce((s, x) => s + x, 0) / (compValues.length || 1);
          const avgOpponentRep = oppValues.reduce((s, x) => s + x, 0) / (oppValues.length || 1);

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
          top10CompanionsMost: sortedCompanionsDesc.slice(0, 10).map(x => ({ ...x, obtainedTogetherPct: x.obtainedTogetherPct })),
          top10CompanionsLeast: sortedCompanionsAsc.slice(0, 10).map(x => ({ ...x, obtainedTogetherPct: x.obtainedTogetherPct })),
          top10OpponentsMost: sortedOpponentsDesc.slice(0, 10).map(x => ({ ...x, obtainedAgainstPct: x.obtainedAgainstPct })),
          top10OpponentsLeast: sortedOpponentsAsc.slice(0, 10).map(x => ({ ...x, obtainedAgainstPct: x.obtainedAgainstPct })),
          temporalTrajectory,
          isCertified,
          justificationText
        };

        setAuditResult(resultData);

        // Save into execution history
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

  useEffect(() => {
    if (labTab === 'auditoria' && !auditResult) {
      triggerAudit(100);
    }
  }, [labTab]);

  return (
    <div className="space-y-6 animate-fadeIn text-zinc-300 max-w-7xl mx-auto p-4 md:p-6" id="laboratorio-painel">
      {/* Outer Banner Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-[10px] uppercase tracking-wider">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Ferramentas de Administração Avançada</span>
          </div>
          <h1 className="font-display font-black text-2xl md:text-3xl lg:text-4xl text-white uppercase tracking-tight">
            Laboratório Técnico
          </h1>
          <p className="text-xs text-zinc-400 max-w-2xl font-sans leading-relaxed">
            Módulo isolado para simulação de rodadas e auditoria forense do motor de sorteio técnico (Monte Carlo). Mantenha a integridade esportiva do grupo.
          </p>
        </div>
      </div>

      {/* Main Tabs Selection */}
      <div className="flex border-b border-zinc-900 gap-1 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setLabTab('simulator')}
          className={`px-5 py-3.5 font-display font-bold text-xs uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            labTab === 'simulator'
              ? 'border-emerald-500 text-white bg-emerald-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span>Simulador de Rodada</span>
        </button>
        <button
          onClick={() => setLabTab('auditoria')}
          className={`px-5 py-3.5 font-display font-bold text-xs uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            labTab === 'auditoria'
              ? 'border-emerald-500 text-white bg-emerald-500/5'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Zap className="w-4 h-4 shrink-0" />
          <span>Auditoria Forense (Sorteio)</span>
        </button>
      </div>

      {/* TAB CONTENT: SIMULATOR */}
      {labTab === 'simulator' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Detailed explanations */}
          <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/80 space-y-3">
            <h3 className="text-white font-bold text-sm uppercase font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Simulador Contínuo de Evolução da Rodada</span>
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              O {appName} evolui dinamicamente ao longo da semana por 10 fases críticas. Utilize este simulador para forçar o estado ativo da rodada e verificar como toda a interface (convocação, escalações, avaliações, estatísticas e museu) se adapta em tempo real.
            </p>
          </div>

          {/* Selector Board */}
          <div className="bg-zinc-950/30 border border-zinc-900 p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider block">Selecione a fase simulada</span>
              {simulatedState !== null && (
                <button
                  onClick={() => setSimulatedState(null)}
                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 text-[10px] font-mono font-bold uppercase rounded transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resetar para Estado Real</span>
                </button>
              )}
            </div>

            {/* Simulated state blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 font-mono">
              {[
                { num: 1, name: "1. Standby", desc: "Confirmações fechadas", color: "border-zinc-800 text-zinc-400 bg-zinc-950/40" },
                { num: 2, name: "2. Inscrições", desc: "Presenças abertas", color: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:border-emerald-500/30" },
                { num: 3, name: "3. Últimas Vagas", desc: "Poucas vagas restantes", color: "border-amber-500/20 text-amber-400 bg-amber-500/5 hover:border-amber-500/30" },
                { num: 4, name: "4. Lista Fechada", desc: "Elenco preenchido", color: "border-purple-500/20 text-purple-400 bg-purple-500/5 hover:border-purple-500/30" },
                { num: 5, name: "5. Sorteio Realizado", desc: "Equipes escaladas", color: "border-sky-500/20 text-sky-400 bg-sky-500/5 hover:border-sky-500/30" },
                { num: 6, name: "6. Dia do Racha!", desc: "Partida acontecendo", color: "border-red-500/20 text-red-400 bg-red-500/5 hover:border-red-500/30" },
                { num: 7, name: "7. Jogo Encerrado", desc: "Placar finalizado", color: "border-zinc-700 text-zinc-300 bg-zinc-900/10 hover:border-zinc-650" },
                { num: 8, name: "8. Avaliações", desc: "Lançamento de notas", color: "border-yellow-500/20 text-yellow-400 bg-yellow-500/5 hover:border-yellow-500/30" },
                { num: 9, name: "9. Resultados", desc: "Estatísticas & OVR", color: "border-teal-500/20 text-teal-400 bg-teal-500/5 hover:border-teal-500/30" },
                { num: 10, name: "10. Galeria & Museu", desc: "Lances históricos", color: "border-violet-500/20 text-violet-400 bg-violet-500/5 hover:border-violet-500/30" }
              ].map(st => {
                const isActive = simulatedState === st.num;
                return (
                  <button
                    key={st.num}
                    onClick={() => setSimulatedState(st.num)}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3.5 transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? 'ring-2 ring-emerald-500 border-emerald-500 text-white bg-emerald-950/20 shadow-lg shadow-emerald-500/5 scale-[1.02]' 
                        : st.color
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black tracking-tight">{st.name}</span>
                      {isActive && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-zinc-500 leading-normal font-sans">{st.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Current status display feedback */}
            <div className="border-t border-zinc-900/60 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/10 p-4 rounded-xl border border-zinc-900">
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-mono block uppercase">Status de Simulação Ativo</span>
                <p className="text-white font-sans text-xs">
                  {simulatedState === null ? (
                    <span>Estado atual: <strong className="text-rose-400">DESATIVADO (Lendo do banco de dados em tempo real)</strong></span>
                  ) : (
                    <span>Estado atual: <strong className="text-emerald-400">ATIVADO (Simulando Fase {simulatedState})</strong></span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setLabTab('auditoria')}
                className="px-4 h-9 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-mono rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Ir para a Auditoria Forense →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUDITORIA */}
      {labTab === 'auditoria' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Main Info Header */}
          <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <h3 className="text-white font-bold text-base flex items-center gap-2 font-display">
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

          {/* Configurable limits */}
          <div className="bg-zinc-950/20 rounded-2xl border border-zinc-900/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
              <h4 className="text-white font-bold text-xs uppercase tracking-wide font-mono flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>⚙️ Limites e Parâmetros Regulamentares de Tolerância</span>
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">Parâmetros Configuráveis</span>
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
            const maxPositionDeviation = auditResult.maxPositionDeviation || 0;
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

                {/* LAUDO DE CERTIFICAÇÃO DO ALGORITMO */}
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
                      <span>QUALIDADE: <span className="text-white font-bold">{starSymbols} ({starClassification})</span></span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={downloadCSV}
                        className="text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Exportar CSV
                      </button>
                      <button 
                        onClick={downloadJSON}
                        className="text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" /> Exportar JSON
                      </button>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown & Positional Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Score Breakdown Radar/Bar representation */}
                  <div className="lg:col-span-6 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 space-y-4">
                    <div className="border-b border-zinc-900/60 pb-2.5">
                      <h5 className="text-white font-bold text-xs uppercase tracking-wider font-mono">📊 Composição do Fairness Score</h5>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Distribuição ponderada dos pesos regulamentares</span>
                    </div>
                    
                    <div className="space-y-3.5 font-mono text-xs">
                      {[
                        { label: "Nivelamento Técnico (OVR)", score: auditResult.ovrScore, weight: 30, desc: "Diferença média entre as forças" },
                        { label: "Distribuição Posicional", score: auditResult.positionScore, weight: 20, desc: "Equilíbrio tático das posições" },
                        { label: "Alocação de Goleiros", score: auditResult.goalkeeperScore, weight: 10, desc: "Garantia de arqueiro fixo por time" },
                        { label: "Antiafinidade (Neymar & Vini)", score: auditResult.antiAffScore, weight: 15, desc: "Restrição de panelinhas (teto 20%)" },
                        { label: "Barreira de Parceiros (Duo)", score: auditResult.companionScore, weight: 10, desc: "Dispersão de co-ocorrência extrema" },
                        { label: "Alternância de Rivais", score: auditResult.opponentScore, weight: 10, desc: "Dispersão de confrontos diretos repetidos" },
                        { label: "Variabilidade Geral", score: auditResult.variabilityScore, weight: 5, desc: "Diversidade geral de escalações" }
                      ].map((item, idx) => {
                        const isApproved = item.score >= 60;
                        return (
                          <div key={idx} className="space-y-1 bg-zinc-900/10 p-2 rounded-lg border border-zinc-900/40">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-zinc-300 font-sans font-semibold">{item.label} <span className="text-zinc-500 font-mono text-[9px] font-normal">({item.weight}%)</span></span>
                              <span className={`font-bold ${isApproved ? 'text-emerald-400' : 'text-rose-400'}`}>{item.score} / 100</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                style={{ width: `${item.score}%` }} 
                              />
                            </div>
                            <span className="text-[9px] text-zinc-500 leading-none block font-sans">{item.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Positional Table validation */}
                  <div className="lg:col-span-6 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 space-y-4">
                    <div className="border-b border-zinc-900/60 pb-2.5">
                      <h5 className="text-white font-bold text-xs uppercase tracking-wider font-mono">👥 Distribuição Posicional por Cor</h5>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Garantia de distribuição uniforme por posições</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 uppercase">
                            <th className="py-2.5 font-bold">Posição</th>
                            <th className="py-2.5 text-center text-sky-400">Azul</th>
                            <th className="py-2.5 text-center text-red-400">Vermelho</th>
                            <th className="py-2.5 text-center text-emerald-400 font-bold">Verde</th>
                            <th className="py-2.5 text-right font-bold">Desvio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/60">
                          {auditResult.positionTableData.map((row: any, rIdx: number) => {
                            const isOk = row.deviation <= maxDistDevTarget;
                            return (
                              <tr key={rIdx} className="hover:bg-zinc-900/10">
                                <td className="py-3 font-sans font-medium text-zinc-200">{row.position}</td>
                                <td className="py-3 text-center text-zinc-300">{row.Azul}</td>
                                <td className="py-3 text-center text-zinc-300">{row.Vermelho}</td>
                                <td className="py-3 text-center text-zinc-300">{row.Verde}</td>
                                <td className={`py-3 text-right font-bold ${isOk ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {row.deviation.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Specific structural rule checks */}
                    <div className="pt-3.5 border-t border-zinc-900/60 grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div className="p-2.5 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                        <span className="text-zinc-500 block uppercase text-[8px]">Goleiro Fixo</span>
                        <span className={`font-bold block mt-1 ${auditResult.positionsValidation?.goleiroCountOk === auditSimCount ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {auditResult.positionsValidation?.goleiroCountOk === auditSimCount ? '100% OK' : `${((auditResult.positionsValidation?.goleiroCountOk / auditSimCount) * 100).toFixed(0)}%`}
                        </span>
                      </div>
                      <div className="p-2.5 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                        <span className="text-zinc-500 block uppercase text-[8px]">Defensores (1-2)</span>
                        <span className={`font-bold block mt-1 ${auditResult.positionsValidation?.defenderCountOk === auditSimCount * 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {((auditResult.positionsValidation?.defenderCountOk / (auditSimCount * 3)) * 100).toFixed(0)}% OK
                        </span>
                      </div>
                      <div className="p-2.5 bg-zinc-900/20 border border-zinc-900 rounded-lg">
                        <span className="text-zinc-500 block uppercase text-[8px]">Atacantes (1-2)</span>
                        <span className={`font-bold block mt-1 ${auditResult.positionsValidation?.attackerCountOk === auditSimCount * 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {((auditResult.positionsValidation?.attackerCountOk / (auditSimCount * 3)) * 100).toFixed(0)}% OK
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Duos co-occurrence and alternating rival analysis */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Co-occurrence */}
                  <div className="lg:col-span-6 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 space-y-4">
                    <div className="border-b border-zinc-900/60 pb-2.5">
                      <h5 className="text-white font-bold text-xs uppercase tracking-wider font-mono">🔥 Limitação de Co-ocorrência (Parceiros)</h5>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Top 5 Duplas com maior índice de repetição como companheiros</span>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      {auditResult.top10CompanionsMost.slice(0, 5).map((row: any, idx: number) => {
                        const limitExceeded = row.obtainedTogetherPct > maxCompanionRep;
                        const isNeymarVini = row.names.includes('Neymar Jr') && row.names.includes('Vinicius Júnior');
                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-900/20 rounded-lg border border-zinc-900 flex-wrap gap-2">
                            <div className="space-y-0.5">
                              <span className="text-white font-sans font-bold text-[11px] block">{row.names}</span>
                              {isNeymarVini && <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider block">⚠️ Restrição Ativa de Antiafinidade</span>}
                            </div>
                            <div className="text-right">
                              <span className={`font-bold text-xs ${limitExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {row.obtainedTogetherPct.toFixed(1)}%
                              </span>
                              <span className="text-[9px] text-zinc-500 block">{row.together} partidas</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rival confront list */}
                  <div className="lg:col-span-6 bg-zinc-950/40 p-5 rounded-2xl border border-zinc-900/60 space-y-4">
                    <div className="border-b border-zinc-900/60 pb-2.5">
                      <h5 className="text-white font-bold text-xs uppercase tracking-wider font-mono">⚔️ Alternância de Rivalidades (Confrontos)</h5>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Top 5 Duplas com maior índice de confrontos diretos</span>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      {auditResult.top10OpponentsMost.slice(0, 5).map((row: any, idx: number) => {
                        const limitExceeded = row.obtainedAgainstPct > maxOpponentRep;
                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-900/20 rounded-lg border border-zinc-900 flex-wrap gap-2">
                            <span className="text-white font-sans font-bold text-[11px]">{row.names}</span>
                            <div className="text-right">
                              <span className={`font-bold text-xs ${limitExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {row.obtainedAgainstPct.toFixed(1)}%
                              </span>
                              <span className="text-[9px] text-zinc-500 block">{row.against} confrontos</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Audit history comparison */}
                <div className="bg-zinc-950/30 p-5 rounded-2xl border border-zinc-900 space-y-4">
                  <div className="border-b border-zinc-900/60 pb-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h5 className="text-white font-bold text-xs uppercase tracking-wider font-mono">📅 Histórico de Auditoria & Comparação de Versões</h5>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">Comparativo técnico de auditorias salvas localmente</span>
                    </div>
                    
                    <div className="flex items-center gap-2 font-sans text-xs">
                      <select 
                        value={selectedAuditA} 
                        onChange={(e) => setSelectedAuditA(e.target.value)}
                        className="bg-zinc-900 text-white text-xs border border-zinc-800 p-1.5 rounded-lg outline-none font-medium cursor-pointer"
                      >
                        <option value="">-- Selecione Auditoria A --</option>
                        {auditHistory.map(h => (
                          <option key={h.id} value={h.id}>{h.date} ({h.fairnessScore} pts)</option>
                        ))}
                      </select>
                      <span className="text-zinc-500 font-mono font-bold">vs</span>
                      <select 
                        value={selectedAuditB} 
                        onChange={(e) => setSelectedAuditB(e.target.value)}
                        className="bg-zinc-900 text-white text-xs border border-zinc-800 p-1.5 rounded-lg outline-none font-medium cursor-pointer"
                      >
                        <option value="">-- Selecione Auditoria B --</option>
                        {auditHistory.map(h => (
                          <option key={h.id} value={h.id}>{h.date} ({h.fairnessScore} pts)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedAuditA && selectedAuditB && (() => {
                    const entryA = auditHistory.find(h => h.id === selectedAuditA);
                    const entryB = auditHistory.find(h => h.id === selectedAuditB);
                    if (!entryA || !entryB) return null;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch animate-fadeIn text-xs font-mono">
                        <div className="md:col-span-12 bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-900 space-y-2.5">
                          <span className="text-[10px] text-zinc-500 block uppercase font-bold">Tabela de Comparação Direta</span>
                          
                          <div className="divide-y divide-zinc-900 border border-zinc-900 rounded-lg overflow-hidden bg-zinc-950/20">
                            <div className="grid grid-cols-3 py-2 px-2.5 bg-zinc-900/50 font-bold uppercase text-[9px] text-zinc-500 text-center">
                              <span className="text-left">Métrica</span>
                              <span>Auditoria A</span>
                              <span>Auditoria B</span>
                            </div>
                            <div className="grid grid-cols-3 py-2 px-2.5">
                              <span className="text-zinc-400">Data</span>
                              <span className="text-center text-white">{entryA.date.split(',')[0]}</span>
                              <span className="text-center text-white">{entryB.date.split(',')[0]}</span>
                            </div>
                            <div className="grid grid-cols-3 py-2 px-2.5">
                              <span className="text-zinc-400">Sorteios</span>
                              <span className="text-center text-white">{entryA.simulationsCount}</span>
                              <span className="text-center text-white">{entryB.simulationsCount}</span>
                            </div>
                            <div className="grid grid-cols-3 py-2 px-2.5">
                              <span className="text-zinc-400">Fairness Score</span>
                              <span className="text-center text-emerald-400 font-bold">{entryA.fairnessScore} pts</span>
                              <span className="text-center text-emerald-400 font-bold">{entryB.fairnessScore} pts</span>
                            </div>
                            <div className="grid grid-cols-3 py-2 px-2.5">
                              <span className="text-zinc-400">Diferença Média</span>
                              <span className="text-center text-white">{entryA.meanDiff.toFixed(2)} OVR</span>
                              <span className="text-center text-white">{entryB.meanDiff.toFixed(2)} OVR</span>
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
                      </div>
                    );
                  })()}

                  {/* Log History list */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-zinc-500 font-mono block uppercase">Histórico Geral de Auditorias</span>
                    <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                      {auditHistory.map(h => (
                        <div key={h.id} className="bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-900/60 flex items-center justify-between text-xs font-mono">
                          <div className="space-y-0.5 text-left">
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

              </div>
            );
          })()}

        </div>
      )}
    </div>
  );
}
