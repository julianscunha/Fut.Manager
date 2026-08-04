export interface RoundStatus {
  totalSlots: number;
  confirmed: number;
  pending: number;
  declined: number;
  reserveConfirmed: number;
  reservePending: number;
  vacancies: number;
  isClosed: boolean;
  canDraw: boolean;
  needsReserve: boolean;
  nextReserve: any | null;
  phase: 'CONFIRMING' | 'CLOSED' | 'DRAWN' | 'FINISHED';
}

export function getRoundStatus(
  nextMatch: any,
  presences: any[],
  reserveQueue: any = null,
  playersList: any[] = []
): RoundStatus {
  // 15 is the standard limit of players in a match
  const totalSlots = nextMatch && nextMatch.maxPlayers !== undefined && nextMatch.maxPlayers !== null
    ? nextMatch.maxPlayers
    : 15;

  const confirmed = presences.filter(p => p.presenceStatus === 'confirmado').length;
  const pending = presences.filter(p => p.presenceStatus === 'nao_confirmado' && p.category !== 'reserva').length;
  const declined = presences.filter(p => p.presenceStatus === 'cancelado').length;

  const reserveConfirmed = presences.filter(p => p.category === 'reserva' && p.presenceStatus === 'confirmado').length;
  const reservePending = presences.filter(p => p.category === 'reserva' && p.presenceStatus === 'aguardando_resposta').length;

  const vacancies = Math.max(0, totalSlots - confirmed);
  const isClosed = confirmed >= totalSlots;

  const phase: 'CONFIRMING' | 'CLOSED' | 'DRAWN' | 'FINISHED' =
    nextMatch?.status === 'encerrada'
      ? 'FINISHED'
      : (nextMatch?.status === 'sorteada'
        ? 'DRAWN'
        : (isClosed || nextMatch?.status === 'fechada'
          ? 'CLOSED'
          : 'CONFIRMING'));

  const canDraw = confirmed >= totalSlots && phase !== 'DRAWN' && phase !== 'FINISHED';
  
  // 1. Checks if any mensalista has declined (is marked as 'cancelado')
  const hasDeclinedMensalista = presences.some(p => p.category !== 'reserva' && p.presenceStatus === 'cancelado');

  // 2. Checks if the total pool of non-deleted mensalistas is structurally insufficient to fill the match slots
  const activeMensalistasList = playersList.length > 0 
    ? playersList.filter(p => p.category !== 'reserva' && !p.deletedAt)
    : presences.filter(p => p.category !== 'reserva');
  const hasNotEnoughMensalistas = activeMensalistasList.length < totalSlots;

  // 3. Keep showing reserves if a reserve is already confirmed or invited to ensure consistent rendering
  const hasActiveConvocation = !!reserveQueue?.activeConvocation?.playerId;
  const hasInteractedReserve = presences.some(p => p.category === 'reserva' && (p.presenceStatus === 'confirmado' || p.presenceStatus === 'aguardando_resposta'));

  // 4. Also show if reserves are explicitly released by deadline or admin release flags, or if the confirmation deadline has expired
  const isDeadlineExpired = nextMatch?.isDeadlineExpired === true;
  const areReservesReleased = nextMatch?.reservesReleased === true || isDeadlineExpired;

  const needsReserve = confirmed < totalSlots && (
    hasDeclinedMensalista || 
    hasNotEnoughMensalistas || 
    hasActiveConvocation || 
    hasInteractedReserve ||
    areReservesReleased
  );

  // Identify next reserve in line or active convocation
  let nextReserve = null;
  const activeConvocationPlayerId = reserveQueue?.activeConvocation?.playerId;
  if (activeConvocationPlayerId) {
    nextReserve = playersList.find(p => p.id === activeConvocationPlayerId) || null;
  } else if (reserveQueue?.queue && reserveQueue.queue.length > 0) {
    nextReserve = playersList.find(p => p.id === reserveQueue.queue[0].id) || null;
  }

  // Central debug trace
  console.log('[DEBUG_ROUND_STATUS_CLIENT]', {
    roundId: nextMatch?.id,
    slots: totalSlots,
    confirmed,
    pending,
    declined,
    reserveConfirmed,
    reservePending,
    vacancies,
    isClosed,
    canDraw,
    needsReserve,
    phase
  });

  return {
    totalSlots,
    confirmed,
    pending,
    declined,
    reserveConfirmed,
    reservePending,
    vacancies,
    isClosed,
    canDraw,
    needsReserve,
    nextReserve,
    phase
  };
}
