import { Player, TeamDraw, DrawTeam, DuoAffinity, TrioAffinity, PlayerPosition } from '../src/types';

// Helper to check if a position represents a defender
function isDefender(pos: PlayerPosition): boolean {
  return pos === 'zagueiro' || pos === 'volante';
}

// Helper to check if a position represents an attacker
function isAttacker(pos: PlayerPosition): boolean {
  return pos === 'meio_campo' || pos === 'atacante';
}

// Helper to get duo affinity count
function getDuoAffinity(playerA: string, playerB: string, duoAffinities: DuoAffinity[]): number {
  const first = playerA < playerB ? playerA : playerB;
  const second = playerA < playerB ? playerB : playerA;
  const record = duoAffinities.find(a => a.playerAId === first && a.playerBId === second);
  return record ? record.count : 0;
}

// Returns the subset of overflowPositions relevant to a team's roster, or
// undefined if none of the team's players has a draw-only position override.
function pickOverflowPositions(pids: string[], overflowPositions: Record<string, PlayerPosition>): Record<string, PlayerPosition> | undefined {
  const entries = pids.filter(id => overflowPositions[id]).map(id => [id, overflowPositions[id]] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

// Helper to get trio affinity count
function getTrioAffinity(p1: string, p2: string, p3: string, trioAffinities: TrioAffinity[]): number {
  const sorted = [p1, p2, p3].sort();
  const record = trioAffinities.find(a => 
    a.playerAId === sorted[0] && 
    a.playerBId === sorted[1] && 
    a.playerCId === sorted[2]
  );
  return record ? record.count : 0;
}

// Balance Engine main function
export function runSmartDraw({
  confirmedPlayers,
  playerOveralls, // Record<playerId, overallRating>
  duoAffinities,
  trioAffinities,
  captains = {}, // e.g., { Azul?: string, Vermelho?: string, Verde?: string }
  isSharedGoalkeepers = false
}: {
  confirmedPlayers: Player[];
  playerOveralls: Record<string, number>;
  duoAffinities: DuoAffinity[];
  trioAffinities: TrioAffinity[];
  captains?: { Azul?: string; Vermelho?: string; Verde?: string };
  isSharedGoalkeepers?: boolean;
}): {
  teams: DrawTeam[];
  overallBlue: number;
  overallRed: number;
  overallGreen: number;
  maxDifference: number;
} {
  // 1. Separate goalkeepers and field players
  const goalkeepers = confirmedPlayers.filter(p => p.primaryPosition === 'goleiro');
  let fieldPlayers = confirmedPlayers.filter(p => p.primaryPosition !== 'goleiro');

  let assignedGks: Record<string, string | null> = { Azul: null, Vermelho: null, Verde: null };
  // Draw-only position override for overflow goalkeepers (playerId -> position played this draw)
  const overflowGkPositions: Record<string, PlayerPosition> = {};

  // If we have goalkeepers and not sharing:
  if (!isSharedGoalkeepers && goalkeepers.length > 0) {
    // Sort goalkeepers so the 3 real goal slots go to keepers with no usable
    // secondary position first; keepers who also play another position are
    // held back to fill the overflow (outfield) slot instead of duplicating
    // the goalkeeper role on a team. Ties broken by overall.
    const sortedGks = [...goalkeepers].sort((a, b) => {
      const aHasSecondary = (a.secondaryPositions || []).length > 0;
      const bHasSecondary = (b.secondaryPositions || []).length > 0;
      if (aHasSecondary !== bHasSecondary) return aHasSecondary ? 1 : -1;
      return (playerOveralls[b.id] || 3.5) - (playerOveralls[a.id] || 3.5);
    });

    // Distribute goalkeepers: Azul, Vermelho, Verde (only 3 teams, only 3 goalkeeper slots)
    if (sortedGks[0]) assignedGks.Azul = sortedGks[0].id;
    if (sortedGks[1]) assignedGks.Vermelho = sortedGks[1].id;
    if (sortedGks[2]) assignedGks.Verde = sortedGks[2].id;

    // Goalkeepers beyond the 3 team slots play out as field players via their
    // secondary position, instead of vanishing from the draw entirely.
    const overflowGks = sortedGks.slice(3);
    fieldPlayers = [...fieldPlayers, ...overflowGks];
    overflowGks.forEach(p => {
      overflowGkPositions[p.id] = (p.secondaryPositions || [])[0] || p.primaryPosition;
    });
  }

  // Pre-arrange captains if any -> Deprecated: Captain selection is purely administrative and visual, having zero impact on balance
  const remainingField = [...fieldPlayers];

  let bestDraw: {
    teams: DrawTeam[];
    overallBlue: number;
    overallRed: number;
    overallGreen: number;
    maxDifference: number;
  } | null = null;
  
  let bestFitness = Infinity; // We want lower fitness (lower technical overall difference + lower affinity/repetition penalty)

  // We perform a randomized search to find the optimal combination that fits positions and balances ratings
  const iterations = 5000;
  for (let iter = 0; iter < iterations; iter++) {
    // Shuffle the field players list
    const shuffled = [...remainingField];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Build the tentative teams
    const teamBluePlayers: string[] = [];
    const teamRedPlayers: string[] = [];
    const teamGreenPlayers: string[] = [];

    // Pre-seed goalkeepers if not shared
    if (!isSharedGoalkeepers) {
      if (assignedGks.Azul) teamBluePlayers.push(assignedGks.Azul);
      if (assignedGks.Vermelho) teamRedPlayers.push(assignedGks.Vermelho);
      if (assignedGks.Verde) teamGreenPlayers.push(assignedGks.Verde);
    }

    // Distribute remaining field players in snake/round-robin order to teams
    // Target size for each team is: 5 players
    let currentIdx = 0;
    while (currentIdx < shuffled.length) {
      const p = shuffled[currentIdx];
      // Push to the team that currently has fewest players and hasn't reached size 5
      // Wait, if goalkeepers are shared, the target size of field players is 4 (if 12 total field) or 4/5 (if 13 field players).
      // Let's just distribute them sequentially to the team with the smallest size.
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

    // Create the teams objects
    const teamBlueList = confirmedPlayers.filter(p => teamBluePlayers.includes(p.id));
    const teamRedList = confirmedPlayers.filter(p => teamRedPlayers.includes(p.id));
    const teamGreenList = confirmedPlayers.filter(p => teamGreenPlayers.includes(p.id));

    // Priority 2: Position Balance validation
    // Ensure each team has at least one defender and at least one attacker among its members
    const validPositions = (list: Player[]) => {
      const defCount = list.filter(p => {
        if (isDefender(p.primaryPosition)) return true;
        const secondaries = p.secondaryPositions || [];
        return secondaries.some(isDefender);
      }).length;

      const attCount = list.filter(p => {
        if (isAttacker(p.primaryPosition)) return true;
        const secondaries = p.secondaryPositions || [];
        return secondaries.some(isAttacker);
      }).length;

      // Defensor e Atacante são obrigatórios em cada time
      return defCount >= 1 && attCount >= 1;
    };

    if (teamBlueList.length > 0 && !validPositions(teamBlueList)) continue;
    if (teamRedList.length > 0 && !validPositions(teamRedList)) continue;
    if (teamGreenList.length > 0 && !validPositions(teamGreenList)) continue;

    // Priority 3 & 4: Overall Balance
    // Sum of overalls for the players on each team
    // If goalkeepers are shared, we add the average rating of the 2 goalkeepers to all teams for balance metric consistency
    let bSum = teamBluePlayers.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);
    let rSum = teamRedPlayers.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);
    let gSum = teamGreenPlayers.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);

    if (isSharedGoalkeepers && goalkeepers.length > 0) {
      const avgGkRating = goalkeepers.reduce((sum, g) => sum + (playerOveralls[g.id] || 3.5), 0) / goalkeepers.length;
      bSum += avgGkRating;
      rSum += avgGkRating;
      gSum += avgGkRating;
    }

    // Average overall rating of the team (or total rating sum)
    // If goalkeepers are shared, they count towards the team size as well
    const bCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (teamBluePlayers.length + 1) : teamBluePlayers.length;
    const rCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (teamRedPlayers.length + 1) : teamRedPlayers.length;
    const gCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (teamGreenPlayers.length + 1) : teamGreenPlayers.length;

    const bOverall = bCount > 0 ? (bSum / bCount) : 3.5;
    const rOverall = rCount > 0 ? (rSum / rCount) : 3.5;
    const gOverall = gCount > 0 ? (gSum / gCount) : 3.5;

    const maxRating = Math.max(bOverall, rOverall, gOverall);
    const minRating = Math.min(bOverall, rOverall, gOverall);
    const diff = maxRating - minRating;

    // Skip if difference is too large (we want difference <= 0.6 ideally, if not we fall back to lowest available)
    if (diff > 0.6) continue;

    // Calculate Teammate Affinity Penalty (Priority 5)
    // Counts how many times players paired in this team configuration have historically grouped up
    let totalAffinityPenalty = 0;

    const calcTeamAffinity = (pids: string[]) => {
      let penalty = 0;
      // Duos
      for (let i = 0; i < pids.length; i++) {
        for (let j = i + 1; j < pids.length; j++) {
          penalty += getDuoAffinity(pids[i], pids[j], duoAffinities) * 2; // Weight duos strongly
        }
      }
      // Trios
      for (let i = 0; i < pids.length; i++) {
        for (let j = i + 1; j < pids.length; j++) {
          for (let k = j + 1; k < pids.length; k++) {
            penalty += getTrioAffinity(pids[i], pids[j], pids[k], trioAffinities) * 4; // Trios penalized more heavily
          }
        }
      }
      return penalty;
    };

    totalAffinityPenalty += calcTeamAffinity(teamBluePlayers);
    totalAffinityPenalty += calcTeamAffinity(teamRedPlayers);
    totalAffinityPenalty += calcTeamAffinity(teamGreenPlayers);

    // Fitness metric = Technical difference (times 20 to weigh it as equivalent to 20 affinity encounters) + Affinity Penalty
    const fitness = (diff * 15) + totalAffinityPenalty;

    if (fitness < bestFitness) {
      bestFitness = fitness;
      const bRounded = Math.round(bOverall * 10) / 10;
      const rRounded = Math.round(rOverall * 10) / 10;
      const gRounded = Math.round(gOverall * 10) / 10;
      const maxRounded = Math.max(bRounded, rRounded, gRounded);
      const minRounded = Math.min(bRounded, rRounded, gRounded);
      const diffRounded = Math.round((maxRounded - minRounded) * 10) / 10;

      bestDraw = {
        teams: [
          { name: 'Azul', captainPlayerId: captains.Azul && teamBluePlayers.includes(captains.Azul) ? captains.Azul : undefined, playerIds: teamBluePlayers, playerPositions: pickOverflowPositions(teamBluePlayers, overflowGkPositions) },
          { name: 'Vermelho', captainPlayerId: captains.Vermelho && teamRedPlayers.includes(captains.Vermelho) ? captains.Vermelho : undefined, playerIds: teamRedPlayers, playerPositions: pickOverflowPositions(teamRedPlayers, overflowGkPositions) },
          { name: 'Verde', captainPlayerId: captains.Verde && teamGreenPlayers.includes(captains.Verde) ? captains.Verde : undefined, playerIds: teamGreenPlayers, playerPositions: pickOverflowPositions(teamGreenPlayers, overflowGkPositions) }
        ],
        overallBlue: bRounded,
        overallRed: rRounded,
        overallGreen: gRounded,
        maxDifference: diffRounded
      };
    }
  }

  // Backup simple sort if Monte Carlo found nothing due to too strict position constraints or bad input
  if (!bestDraw) {
    const listBlue: string[] = [];
    const listRed: string[] = [];
    const listGreen: string[] = [];

    if (!isSharedGoalkeepers) {
      if (assignedGks.Azul) listBlue.push(assignedGks.Azul);
      if (assignedGks.Vermelho) listRed.push(assignedGks.Vermelho);
      if (assignedGks.Verde) listGreen.push(assignedGks.Verde);
    }

    // Simply distribute Remaining players round-robin sorted by rating (excluding captains pre-seeding as it was deprecated to safeguard balancing and goalkeeper duplication)
    const sortedField = [...remainingField].sort((a,b) => (playerOveralls[b.id] || 3.5) - (playerOveralls[a.id] || 3.5));
    sortedField.forEach((p, idx) => {
      const mode = idx % 3;
      if (mode === 0) listBlue.push(p.id);
      else if (mode === 1) listRed.push(p.id);
      else listGreen.push(p.id);
    });

    let bSum = listBlue.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);
    let rSum = listRed.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);
    let gSum = listGreen.reduce((sum, pid) => sum + (playerOveralls[pid] || 3.5), 0);

    if (isSharedGoalkeepers && goalkeepers.length > 0) {
      const avgGkRating = goalkeepers.reduce((sum, g) => sum + (playerOveralls[g.id] || 3.5), 0) / goalkeepers.length;
      bSum += avgGkRating;
      rSum += avgGkRating;
      gSum += avgGkRating;
    }

    const bCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (listBlue.length + 1) : listBlue.length;
    const rCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (listRed.length + 1) : listRed.length;
    const gCount = (isSharedGoalkeepers && goalkeepers.length > 0) ? (listGreen.length + 1) : listGreen.length;

    const bOverall = bCount > 0 ? (bSum / bCount) : 3.5;
    const rOverall = rCount > 0 ? (rSum / rCount) : 3.5;
    const gOverall = gCount > 0 ? (gSum / gCount) : 3.5;

    const bRounded = Math.round(bOverall * 10) / 10;
    const rRounded = Math.round(rOverall * 10) / 10;
    const gRounded = Math.round(gOverall * 10) / 10;
    const maxRounded = Math.max(bRounded, rRounded, gRounded);
    const minRounded = Math.min(bRounded, rRounded, gRounded);
    const diffRounded = Math.round((maxRounded - minRounded) * 10) / 10;

    bestDraw = {
      teams: [
        { name: 'Azul', captainPlayerId: captains.Azul && listBlue.includes(captains.Azul) ? captains.Azul : undefined, playerIds: listBlue, playerPositions: pickOverflowPositions(listBlue, overflowGkPositions) },
        { name: 'Vermelho', captainPlayerId: captains.Vermelho && listRed.includes(captains.Vermelho) ? captains.Vermelho : undefined, playerIds: listRed, playerPositions: pickOverflowPositions(listRed, overflowGkPositions) },
        { name: 'Verde', captainPlayerId: captains.Verde && listGreen.includes(captains.Verde) ? captains.Verde : undefined, playerIds: listGreen, playerPositions: pickOverflowPositions(listGreen, overflowGkPositions) }
      ],
      overallBlue: bRounded,
      overallRed: rRounded,
      overallGreen: gRounded,
      maxDifference: diffRounded
    };
  }

  return bestDraw;
}

// Function to increment teammate affinities when match is finished or draw gets locked
export function recordAffinities(
  playerIds: string[],
  duoAffinities: DuoAffinity[],
  trioAffinities: TrioAffinity[]
) {
  // Record duos
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const first = playerIds[i] < playerIds[j] ? playerIds[i] : playerIds[j];
      const second = playerIds[i] < playerIds[j] ? playerIds[j] : playerIds[i];

      const recordIndex = duoAffinities.findIndex(a => a.playerAId === first && a.playerBId === second);
      if (recordIndex >= 0) {
        duoAffinities[recordIndex].count++;
      } else {
        duoAffinities.push({ playerAId: first, playerBId: second, count: 1, winsCount: 0 });
      }
    }
  }

  // Record trios
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      for (let k = j + 1; k < playerIds.length; k++) {
        const sorted = [playerIds[i], playerIds[j], playerIds[k]].sort();
        const recordIndex = trioAffinities.findIndex(a => 
          a.playerAId === sorted[0] && 
          a.playerBId === sorted[1] && 
          a.playerCId === sorted[2]
        );
        if (recordIndex >= 0) {
          trioAffinities[recordIndex].count++;
        } else {
          trioAffinities.push({ playerAId: sorted[0], playerBId: sorted[1], playerCId: sorted[2], count: 1, winsCount: 0 });
        }
      }
    }
  }
}
