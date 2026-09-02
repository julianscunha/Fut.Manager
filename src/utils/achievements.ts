import { Player, PlayerStats } from '../types/domain';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'bronze' | 'prata' | 'ouro' | 'lendaria';
  icon: string; // Emoji representation 
  earned: boolean;
  progress: number;
  target: number;
  progressPercent: number;
}

/**
 * Calculates achievements for a given player based on their individual stats
 * and overall season/history stats (for Best Duo/Trio awards).
 */
export function getAchievementsForPlayer(
  player: Player,
  playerStats: PlayerStats | null,
  allStats: { duos?: any[]; trios?: any[] } | null
): Achievement[] {
  const presences = playerStats ? playerStats.presences : 0;
  const vitorias = playerStats ? playerStats.vitorias : 0;
  const maxStreak = playerStats ? playerStats.maxStreak : 0;
  const isGoleiro = player.primaryPosition === 'goleiro';

  // Check if player is in the #1 Duo
  const isBestDuo = !!(
    allStats?.duos &&
    allStats.duos.length > 0 &&
    (allStats.duos[0].playerAId === player.id || allStats.duos[0].playerBId === player.id) &&
    allStats.duos[0].playedTogether >= 1
  );

  // Check if player is in the #1 Trio
  const isBestTrio = !!(
    allStats?.trios &&
    allStats.trios.length > 0 &&
    (allStats.trios[0].playerAId === player.id ||
      allStats.trios[0].playerBId === player.id ||
      allStats.trios[0].playerCId === player.id) &&
    allStats.trios[0].playedTogether >= 1
  );

  const achievementsList: Achievement[] = [
    {
      id: 'primeira_partida',
      title: 'Primeira Partida',
      description: 'Participou de pelo menos 1 racha oficial.',
      category: 'bronze',
      icon: '⚽',
      earned: presences >= 1,
      progress: Math.min(presences, 1),
      target: 1,
      progressPercent: Math.round((Math.min(presences, 1) / 1) * 100),
    },
    {
      id: 'veterano',
      title: 'Veterano',
      description: 'Participou de 50 rachas oficiais do grupo.',
      category: 'ouro',
      icon: '🎖️',
      earned: presences >= 50,
      progress: Math.min(presences, 50),
      target: 50,
      progressPercent: Math.round((Math.min(presences, 50) / 50) * 100),
    },
    {
      id: 'lenda',
      title: 'Lenda',
      description: 'Atingiu a incrível marca de 100 rachas jogados.',
      category: 'lendaria',
      icon: '👑',
      earned: presences >= 100,
      progress: Math.min(presences, 100),
      target: 100,
      progressPercent: Math.round((Math.min(presences, 100) / 100) * 100),
    },
    {
      id: 'primeira_vitoria',
      title: 'Primeira Vitória',
      description: 'Venceu seu primeiro racha no grupo.',
      category: 'bronze',
      icon: '🏆',
      earned: vitorias >= 1,
      progress: Math.min(vitorias, 1),
      target: 1,
      progressPercent: Math.round((Math.min(vitorias, 1) / 1) * 100),
    },
    {
      id: 'campeao',
      title: 'Campeão',
      description: 'Alcançou 10 vitórias totais na temporada.',
      category: 'prata',
      icon: '🏅',
      earned: vitorias >= 10,
      progress: Math.min(vitorias, 10),
      target: 10,
      progressPercent: Math.round((Math.min(vitorias, 10) / 10) * 100),
    },
    {
      id: 'rei_vitorias',
      title: 'Rei das Vitórias',
      description: 'Somou 50 vitórias consagradas no racha.',
      category: 'ouro',
      icon: '🤴',
      earned: vitorias >= 50,
      progress: Math.min(vitorias, 50),
      target: 50,
      progressPercent: Math.round((Math.min(vitorias, 50) / 50) * 100),
    },
    {
      id: 'embalado',
      title: 'Embalado',
      description: 'Estabeleceu uma sequência de 5 vitórias consecutivas.',
      category: 'prata',
      icon: '🔥',
      earned: maxStreak >= 5,
      progress: Math.min(maxStreak, 5),
      target: 5,
      progressPercent: Math.round((Math.min(maxStreak, 5) / 5) * 100),
    },
    {
      id: 'imparavel',
      title: 'Imparável',
      description: 'Ficou invicto com 10 vitórias consecutivas!',
      category: 'lendaria',
      icon: '⚡',
      earned: maxStreak >= 10,
      progress: Math.min(maxStreak, 10),
      target: 10,
      progressPercent: Math.round((Math.min(maxStreak, 10) / 10) * 100),
    },
    {
      id: 'melhor_dupla',
      title: 'Melhor Dupla',
      description: 'Integrou a dupla com melhor aproveitamento do racha.',
      category: 'ouro',
      icon: '👥',
      earned: isBestDuo,
      progress: isBestDuo ? 1 : 0,
      target: 1,
      progressPercent: isBestDuo ? 100 : 0,
    },
    {
      id: 'melhor_trio',
      title: 'Melhor Trio',
      description: 'Integrou o trio de ouro invencível do racha.',
      category: 'ouro',
      icon: '✨',
      earned: isBestTrio,
      progress: isBestTrio ? 1 : 0,
      target: 1,
      progressPercent: isBestTrio ? 100 : 0,
    },
  ];

  // Exclusive Goalkeeper achievement
  if (isGoleiro) {
    achievementsList.push({
      id: 'muralha',
      title: 'Muralha',
      description: 'Conquista de honra exclusiva para os defensores da baliza.',
      category: 'bronze',
      icon: '🧤',
      earned: presences >= 1,
      progress: Math.min(presences, 1),
      target: 1,
      progressPercent: Math.round((Math.min(presences, 1) / 1) * 100),
    });
  }

  return achievementsList;
}

/**
 * Helper to get the most significant unlocked achievement for a player.
 * Priority: Lendária > Ouro > Prata > Bronze.
 */
export function getMostRecentAchievement(achievements: Achievement[]): Achievement | null {
  const earned = achievements.filter((a) => a.earned);
  if (earned.length === 0) return null;

  // Sort by category importance for maximum prestige spotlight
  const categoryPriority: Record<string, number> = {
    lendaria: 4,
    ouro: 3,
    prata: 2,
    bronze: 1,
  };

  return [...earned].sort((a, b) => {
    const priorityDiff = (categoryPriority[b.category] || 0) - (categoryPriority[a.category] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    // fallback to target difficulty to display highest effort targets
    return b.target - a.target;
  })[0];
}
