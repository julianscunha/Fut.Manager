import { Player, Match, Presence, MatchResult, Season, PlayerStats, DuoAffinity, TrioAffinity } from '../src/types/domain';

function computePlayerMetrics(playerId: string, playerPosition: string, evaluations: any[] = []) {
  const playerEvals = evaluations.filter(e => e.targetPlayerId === playerId);
  const isGk = playerPosition === 'goleiro';
  const attribs = isGk 
    ? ['reflexo', 'posicionamento', 'saida_gol', 'reposicao']
    : ['defesa', 'passe', 'finalizacao', 'velocidade', 'posicionamento', 'drible', 'marcacao', 'fisico'];
    
  const weights: Record<string, number> = isGk
    ? { reflexo: 0.35, posicionamento: 0.25, saida_gol: 0.20, reposicao: 0.20 }
    : { defesa: 0.15, passe: 0.15, finalizacao: 0.15, velocidade: 0.15, posicionamento: 0.15, drible: 0.10, marcacao: 0.10, fisico: 0.05 };

  const BASE_RATING = 3.5;
  const BASE_WEIGHT = 4.0;

  let weightedOverallSum = 0;

  attribs.forEach(attr => {
    const votes = playerEvals.map(e => e.ratings?.[attr]).filter(v => v !== undefined && v !== null);
    const votesSum = votes.reduce((acc, v) => acc + (v as number), 0);
    const votesCount = votes.length;
    const weightedAvg = ((BASE_RATING * BASE_WEIGHT) + votesSum) / (BASE_WEIGHT + votesCount);
    const roundedAvg = Math.round(weightedAvg * 10) / 10;
    const weight = weights[attr] || 0;
    weightedOverallSum += roundedAvg * weight;
  });

  return Math.round(weightedOverallSum * 10) / 10;
}

// Helper to sort players as defined in the request:
// 1. Vitórias (desc)
// 2. Aproveitamento (desc)
// 3. Presenças (desc)
// 4. OVR (desc)
// 5. Melhor Sequência Histórica (desc)
// 6. Ordem de Cadastro (last resort, ascending - oldest first)
export function sortPlayersForRanking(statsList: Array<PlayerStats & { name: string; photoOriginal: string; primaryPosition: string }>) {
  return [...statsList].sort((a, b) => {
    // 1. Vitórias
    if (b.vitorias !== a.vitorias) {
      return b.vitorias - a.vitorias;
    }
    // 2. Aproveitamento
    if (b.aproveitamento !== a.aproveitamento) {
      return b.aproveitamento - a.aproveitamento;
    }
    // 3. Presenças
    if (b.presences !== a.presences) {
      return b.presences - a.presences;
    }
    // 4. OVR (descending)
    const ovrA = a.ovr ?? 3.5;
    const ovrB = b.ovr ?? 3.5;
    if (ovrB !== ovrA) {
      return ovrB - ovrA;
    }
    // 5. Melhor Sequência Histórica (descending)
    if (b.maxStreak !== a.maxStreak) {
      return b.maxStreak - a.maxStreak;
    }
    // 6. Ordem de Cadastro (ascending - older first)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });
}

export interface AdvancedDuoStat {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  playedTogether: number;
  wonTogether: number;
  aproveitamento: number; // percentage
}

export interface AdvancedTrioStat {
  playerAId: string;
  playerBId: string;
  playerCId: string;
  playerAName: string;
  playerBName: string;
  playerCName: string;
  playedTogether: number;
  wonTogether: number;
  aproveitamento: number; // percentage
}

export interface RenderedStats {
  individual: Array<PlayerStats & { name: string; photoOriginal: string; primaryPosition: string; rank: number }>;
  goalkeepers: Array<PlayerStats & { name: string; photoOriginal: string; rank: number }>;
  duos: AdvancedDuoStat[];
  trios: AdvancedTrioStat[];
}

export function computeStatsForSeason({
  players,
  matches,
  presences,
  results,
  seasonId, // string or undefined/null for whole history
  evaluations = [],
  evaluationHistory = []
}: {
  players: Player[];
  matches: Match[];
  presences: Presence[];
  results: MatchResult[];
  seasonId?: string | null;
  evaluations?: any[];
  evaluationHistory?: any[];
}): RenderedStats {
  // Filter matches of this season
  const activeMatches = seasonId 
    ? matches.filter(m => m.seasonId === seasonId) 
    : matches;
  const activeMatchIds = new Set(activeMatches.map(m => m.id));

  // Filter results
  const activeResults = results.filter(r => activeMatchIds.has(r.matchId));
  // Sort results chronologically based on matching match dates to calculate streaks
  const matchIdToDate: Record<string, string> = {};
  activeMatches.forEach(m => {
    matchIdToDate[m.id] = m.date;
  });

  const sortedResults = [...activeResults].sort((a, b) => {
    const dateA = matchIdToDate[a.matchId] || '1970-01-01';
    const dateB = matchIdToDate[b.matchId] || '1970-01-01';
    return dateA.localeCompare(dateB);
  });

  // Calculate statistics for each active player
  const activePlayers = players.filter(p => !p.deletedAt);

  // Streak counters
  const currentStreakMap: Record<string, number> = {};
  const maxStreakMap: Record<string, number> = {};
  const winCountMap: Record<string, number> = {};
  const lossCountMap: Record<string, number> = {};
  const drawCountMap: Record<string, number> = {};
  const presenceCountMap: Record<string, number> = {};
  // Soma dos jogos individuais vencidos (winsBlue/winsRed/winsGreen do time do jogador),
  // ao contrário de winCountMap que so conta 1 por rodada quando o time e campeao do dia.
  const gameWinCountMap: Record<string, number> = {};

  activePlayers.forEach(p => {
    currentStreakMap[p.id] = 0;
    maxStreakMap[p.id] = 0;
    winCountMap[p.id] = 0;
    lossCountMap[p.id] = 0;
    drawCountMap[p.id] = 0;
    presenceCountMap[p.id] = 0;
    gameWinCountMap[p.id] = 0;
  });

  // For Duos
  // Note: key as firstId_secondId where firstId < secondId
  const duoPlayed: Record<string, number> = {};
  const duoWon: Record<string, number> = {};

  // For Trios
  // Note: key as sorted first_second_third
  const trioPlayed: Record<string, number> = {};
  const trioWon: Record<string, number> = {};

  // Track each game result chronologically
  sortedResults.forEach((resObj) => {
    const isSharedGk = resObj.isSharedGoalkeepers;
    const champTeams = resObj.champions || []; // e.g. ['Azul']
    
    // Find confirmed presences of players for this match
    const confIds = new Set(
      presences
        .filter(p => p.matchId === resObj.matchId && p.status === 'confirmado')
        .map(p => p.playerId)
    );

    // Filter confirmed players present in players roster too
    const playingPlayerIds = new Set(
      activePlayers
        .filter(p => confIds.has(p.id))
        .map(p => p.id)
    );

    // Map of team member list
    const blueTeamPlayerIds = new Set(resObj.teams.find(t => t.name === 'Azul')?.playerIds || []);
    const redTeamPlayerIds = new Set(resObj.teams.find(t => t.name === 'Vermelho')?.playerIds || []);
    const greenTeamPlayerIds = new Set(resObj.teams.find(t => t.name === 'Verde')?.playerIds || []);

    // Process each active player's results for streak and counts
    activePlayers.forEach((player) => {
      // Did they play?
      // Match presence is either explicit confirmed presence or being in a team roster
      const isPresent = playingPlayerIds.has(player.id) || 
                        blueTeamPlayerIds.has(player.id) || 
                        redTeamPlayerIds.has(player.id) || 
                        greenTeamPlayerIds.has(player.id);

      if (!isPresent) return; // Didn't play: streak is unchanged, presences don't increment

      presenceCountMap[player.id]++;

      // Did they won, draw, or lose?
      let won = false;
      let draw = false;
      let lost = false;
      const isGoalkeeper = player.primaryPosition === 'goleiro';

      if (isSharedGk && isGoalkeeper) {
        if (champTeams.length > 0) {
          won = true;
        } else {
          draw = true;
        }
        // Goleiro compartilhado jogou pelos 3 times: soma os jogos vencidos por todos.
        gameWinCountMap[player.id] += (resObj.winsBlue || 0) + (resObj.winsRed || 0) + (resObj.winsGreen || 0);
      } else {
        const teamNameOfPlayer = blueTeamPlayerIds.has(player.id) ? 'Azul' :
                                 redTeamPlayerIds.has(player.id) ? 'Vermelho' :
                                 greenTeamPlayerIds.has(player.id) ? 'Verde' : null;
        if (teamNameOfPlayer) {
          if (champTeams.length === 0 || champTeams.length > 1) {
            draw = true;
          } else if (champTeams.includes(teamNameOfPlayer)) {
            won = true;
          } else {
            lost = true;
          }

          const teamGameWins = teamNameOfPlayer === 'Azul' ? resObj.winsBlue :
                               teamNameOfPlayer === 'Vermelho' ? resObj.winsRed :
                               resObj.winsGreen;
          gameWinCountMap[player.id] += teamGameWins || 0;
        }
      }

      if (won) {
        winCountMap[player.id]++;
        currentStreakMap[player.id]++;
        if (currentStreakMap[player.id] > maxStreakMap[player.id]) {
          maxStreakMap[player.id] = currentStreakMap[player.id];
        }
      } else {
        if (draw) {
          drawCountMap[player.id]++;
        } else if (lost) {
          lossCountMap[player.id]++;
        }
        currentStreakMap[player.id] = 0; // streak is broken
      }
    });

    // Compute Duo played/won together
    // Only looking within the teams defined in this match
    resObj.teams.forEach((t) => {
      const isTeamChampion = champTeams.includes(t.name);
      const teamPlayers = t.playerIds.filter(pid => activePlayers.some(p => p.id === pid));

      for (let i = 0; i < teamPlayers.length; i++) {
        for (let j = i + 1; j < teamPlayers.length; j++) {
          const first = teamPlayers[i] < teamPlayers[j] ? teamPlayers[i] : teamPlayers[j];
          const second = teamPlayers[i] < teamPlayers[j] ? teamPlayers[j] : teamPlayers[i];
          const key = `${first}_${second}`;

          duoPlayed[key] = (duoPlayed[key] || 0) + 1;
          if (isTeamChampion) {
            duoWon[key] = (duoWon[key] || 0) + 1;
          }
        }
      }

      // Compute Trio played/won together
      for (let i = 0; i < teamPlayers.length; i++) {
        for (let j = i + 1; j < teamPlayers.length; j++) {
          for (let k = j + 1; k < teamPlayers.length; k++) {
            const sorted = [teamPlayers[i], teamPlayers[j], teamPlayers[k]].sort();
            const key = `${sorted[0]}_${sorted[1]}_${sorted[2]}`;

            trioPlayed[key] = (trioPlayed[key] || 0) + 1;
            if (isTeamChampion) {
              trioWon[key] = (trioWon[key] || 0) + 1;
            }
          }
        }
      }
    });
  });

  // Compile individual stats
  const individualStatsList: Array<PlayerStats & { name: string; photoOriginal: string; avatarEsportivo?: string; primaryPosition: string }> = activePlayers.map(p => {
    const presences = presenceCountMap[p.id] || 0;
    const vitorias = winCountMap[p.id] || 0;
    const derrotas = lossCountMap[p.id] || 0;
    const empates = drawCountMap[p.id] || 0;
    const aproveitamento = presences > 0 ? Math.round((vitorias / presences) * 100) : 0;
    const ovr = computePlayerMetrics(p.id, p.primaryPosition, evaluations);

    return {
      playerId: p.id,
      name: p.name,
      photoOriginal: p.photoOriginal,
      avatarEsportivo: p.avatarEsportivo,
      primaryPosition: p.primaryPosition,
      presences,
      vitorias,
      derrotas,
      empates,
      aproveitamento,
      vitoriasJogos: gameWinCountMap[p.id] || 0,
      currentStreak: currentStreakMap[p.id] || 0,
      maxStreak: maxStreakMap[p.id] || 0,
      ovr,
      createdAt: p.createdAt
    };
  });

  // Sort them for overall ranking
  const sortedIndividuals = sortPlayersForRanking(individualStatsList);
  // Add Rank
  const individualFinal = sortedIndividuals.map((stat, index) => ({
    ...stat,
    rank: index + 1
  }));

  // GKs ranking
  const keepersList = individualFinal.filter(p => p.primaryPosition === 'goleiro');
  const sortedKeepers = keepersList.map((k, idx) => ({
    ...k,
    rank: idx + 1
  }));

  // Format Duos stats
  const duosList: AdvancedDuoStat[] = Object.keys(duoPlayed).map((key) => {
    const [pAId, pBId] = key.split('_');
    const pA = activePlayers.find(p => p.id === pAId);
    const pB = activePlayers.find(p => p.id === pBId);
    const played = duoPlayed[key] || 0;
    const won = duoWon[key] || 0;

    return {
      playerAId: pAId,
      playerBId: pBId,
      playerAName: pA ? pA.name : 'Unknown',
      playerBName: pB ? pB.name : 'Unknown',
      playedTogether: played,
      wonTogether: won,
      aproveitamento: played > 0 ? Math.round((won / played) * 100) : 0
    };
  })
  // Sort duos: 1. Wins, 2. WinRate
  .sort((a, b) => {
    if (b.wonTogether !== a.wonTogether) {
      return b.wonTogether - a.wonTogether;
    }
    return b.aproveitamento - a.aproveitamento;
  });

  // Format Trios stats
  const triosList: AdvancedTrioStat[] = Object.keys(trioPlayed).map((key) => {
    const [pAId, pBId, pCId] = key.split('_');
    const pA = activePlayers.find(p => p.id === pAId);
    const pB = activePlayers.find(p => p.id === pBId);
    const pC = activePlayers.find(p => p.id === pCId);
    const played = trioPlayed[key] || 0;
    const won = trioWon[key] || 0;

    return {
      playerAId: pAId,
      playerBId: pBId,
      playerCId: pCId,
      playerAName: pA ? pA.name : 'Unknown',
      playerBName: pB ? pB.name : 'Unknown',
      playerCName: pC ? pC.name : 'Unknown',
      playedTogether: played,
      wonTogether: won,
      aproveitamento: played > 0 ? Math.round((won / played) * 100) : 0
    };
  })
  // Sort trios: 1. Wins, 2. WinRate
  .sort((a, b) => {
    if (b.wonTogether !== a.wonTogether) {
      return b.wonTogether - a.wonTogether;
    }
    return b.aproveitamento - a.aproveitamento;
  });

  return {
    individual: individualFinal,
    goalkeepers: sortedKeepers,
    duos: duosList,
    trios: triosList
  };
}
