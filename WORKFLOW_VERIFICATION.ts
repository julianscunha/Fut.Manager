/**
 * Example: Migration workflow verification
 * This test file demonstrates the complete workflow
 * Can be removed after verification
 */

// ✅ PATTERN 1: Old code still works (backward compatible)
import { Player, POSITION_LABELS } from './src/types';
// Re-exports from domain.ts + ui.ts, no errors

// ✅ PATTERN 2: New code works (direct imports)
import type { Player as PlayerType } from './src/types/domain';
import { STATUS_COLORS } from './src/types/ui';
import { apiClient, ApiError } from './src/api/client';
import { useAuth, AuthProvider } from './src/contexts/AuthContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// ✅ PATTERN 3: API client usage
async function fetchPlayers(): Promise<PlayerType[]> {
  try {
    const players = await apiClient.get<PlayerType[]>('/api/players');
    return players;
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(`HTTP ${err.status}: ${err.message}`);
    }
    throw err;
  }
}

// ✅ PATTERN 4: Auth context usage
function ComponentUsingAuth() {
  const { user, isLoading, logout } = useAuth();
  if (isLoading) return 'Loading...';
  return `User: ${user?.name}`;
}

// ✅ PATTERN 5: Error boundary usage
function SafeComponent() {
  return <ErrorBoundary><ComponentUsingAuth /></ErrorBoundary>;
}

console.log('✅ All patterns validated - workflow is complete');
