# Quick Start: New Architecture

## For Frontend Developers

### Use ApiClient Instead of authFetch

**OLD:**
```typescript
import { authFetch } from '@/lib/authFetch';

const response = await authFetch('/api/players', {
  method: 'POST',
  body: JSON.stringify(player)
});
const data = await response.json();
```

**NEW:**
```typescript
import { apiClient } from '@api/client';

const player = await apiClient.post<Player>(
  '/api/players',
  playerData
);
// Already typed as Player, no need to parse JSON
```

---

### Import Types Correctly

**OLD:**
```typescript
import { Player, POSITION_LABELS } from '@/types';
// Mixes domain + UI in one import
```

**NEW:**
```typescript
import type { Player } from '@types/domain';
import { POSITION_LABELS } from '@types/ui';
// Clear separation: types vs config
```

---

### Handle Errors Gracefully

**OLD:**
```typescript
// authFetch hard-reloads page on 401 (loses state)
const response = await authFetch('/api/players');
```

**NEW:**
```typescript
import { ErrorBoundary } from '@components/ErrorBoundary';

// At component level
<ErrorBoundary>
  <PlayerList />
</ErrorBoundary>

// Or in try-catch
try {
  const players = await apiClient.get<Player[]>('/api/players');
} catch (error) {
  // Handle ApiError, log it, show user message
  console.error(error.status, error.message);
}
```

---

### Access Auth State in Components

**OLD:**
```typescript
// Had to check localStorage directly
const token = localStorage.getItem('racha_token');
```

**NEW:**
```typescript
import { useAuth } from '@contexts/AuthContext';

export function MyComponent() {
  const { user, isLoading, logout } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## Common Patterns

### Fetch Data with Error Handling
```typescript
import { apiClient, ApiError } from '@api/client';
import { useEffect, useState } from 'react';

export function PlayerPage() {
  const [data, setData] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Player[]>('/api/players')
      .then(setData)
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{data.map(p => <PlayerCard key={p.id} player={p} />)}</div>;
}
```

### Create/Update with Optimistic UI
```typescript
const [players, setPlayers] = useState<Player[]>([]);

async function addPlayer(newPlayer: Omit<Player, 'id'>) {
  // Optimistic update
  const optimisticId = `temp-${Date.now()}`;
  setPlayers(p => [...p, { ...newPlayer, id: optimisticId } as Player]);

  try {
    const created = await apiClient.post<Player>('/api/players', newPlayer);
    // Replace optimistic with real
    setPlayers(p => p.map(x => x.id === optimisticId ? created : x));
  } catch (error) {
    // Revert on error
    setPlayers(p => p.filter(x => x.id !== optimisticId));
    alert('Failed to create player');
  }
}
```

### Login/Logout
```typescript
import { useAuth } from '@contexts/AuthContext';

export function LoginForm() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      // AuthContext updates, app re-renders
      window.location.href = '/dashboard';
    } catch (err) {
      // error state in context is updated
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error.message}</div>}
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Migration Checklist

- [ ] Wrap App with `<AuthProvider>` in `main.tsx`
- [ ] Update imports: `@/types` → `@types/domain`, `@types/ui`
- [ ] Replace first `authFetch` call with `apiClient`
- [ ] Test login/logout works
- [ ] Wrap critical components with `<ErrorBoundary>`
- [ ] Check console for import errors: `npm run lint`

---

## Import Alias Reference

```
@api/       → HTTP client, ApiError, request/response types
@components → React components including ErrorBoundary
@contexts   → Context providers (AuthContext, etc.)
@types      → Domain models and UI types
@lib        → Utilities (eventually: logger, formatter, etc.)
@utils      → Helpers (achievements, playerAvatar, etc.)
```

---

## When to Use What

| Use | When |
|-----|------|
| `apiClient.get()` | Fetch data, no body |
| `apiClient.post()` | Create new resource |
| `apiClient.put()` | Replace entire resource |
| `apiClient.patch()` | Update partial resource |
| `apiClient.delete()` | Remove resource |
| `useAuth()` | Access user, login, logout |
| `<ErrorBoundary>` | Wrap components that might crash |
| `<AuthProvider>` | Once at app root (already done) |
| `@types/domain` | Type imports for business objects |
| `@types/ui` | Import POSITION_LABELS, STATUS_COLORS, etc. |

---

## Troubleshooting

**Q: Import error for `@api/client`**
```
Module not found: Can't resolve '@api/client'
```
A: Make sure `src/api/client.ts` exists. Also run `npm run lint` to verify tsconfig.

**Q: AuthContext errors**
```
useAuth must be used within AuthProvider
```
A: Ensure App is wrapped with `<AuthProvider>` in main.tsx (only once at root).

**Q: API call returns 401 but doesn't redirect**
```
Response error but page isn't reloading
```
A: Good! That's the new behavior. Use try-catch or ErrorBoundary to handle it gracefully instead of hard reload.

**Q: Types not working**
```
Type 'Player' is not recognized
```
A: Check import path. Should be `import type { Player } from '@types/domain'` not `from '@/types'`.
