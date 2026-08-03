# Architecture Refactoring - Critical Changes

## Summary

This refactoring addresses 3 critical architecture problems:

1. **types.ts (422 lines) → Separated into domain + UI types**
2. **authFetch() god node → New ApiClient + AuthContext**
3. **tsconfig paths → Structured module boundaries**

## What Changed

### 1. Types Reorganization

**Before:** All types mixed in `src/types.ts`
```typescript
import {
  Player, // Domain model
  PlayerPosition, // Domain enum
  POSITION_LABELS, // UI config
  STATUS_COLORS, // UI styling
  User, // Domain model
  // ...everything mixed
} from './types';
```

**After:** Separated into concerns
```typescript
// Domain types (business entities)
import type { Player, User, PlayerPosition } from '@types/domain';

// UI types (styling, labels, component props)
import { POSITION_LABELS, STATUS_COLORS } from '@types/ui';
```

**Files created:**
- `src/types/domain.ts` - All business entities and value objects
- `src/types/ui.ts` - Labels, colors, attribute configs
- `src/types/index.ts` - Re-exports both (backward compatibility)

### 2. API Client Architecture

**Before:** Components directly used `authFetch()` (34-edge god node)
```typescript
// Bad: Scattered across all components
const response = await authFetch('/api/players', {
  method: 'POST',
  body: JSON.stringify(player)
});
```

**After:** Centralized ApiClient with typed requests
```typescript
// Good: Typed, centralized, handles errors properly
import { apiClient } from '@api/client';

const result = await apiClient.post<Player>(
  '/api/players',
  player
);
```

**Files created:**
- `src/api/client.ts` - ApiClient with GET/POST/PUT/PATCH/DELETE methods
- `src/contexts/AuthContext.tsx` - Auth state management (replaces localStorage sprawl)
- `src/components/ErrorBoundary.tsx` - Graceful error recovery (replaces hard page reload)

### 3. Import Path Restructuring

**Before:** tsconfig allowed `@/*` → `./` (root imports, no structure)
```json
"paths": {
  "@/*": ["./*"]
}
```

**After:** Explicit module boundaries
```json
"paths": {
  "@api/*": ["./src/api/*"],
  "@components/*": ["./src/components/*"],
  "@contexts/*": ["./src/contexts/*"],
  "@types/*": ["./src/types/*"],
  "@lib/*": ["./src/lib/*"],
  "@utils/*": ["./src/utils/*"]
}
```

## Migration Path

### Phase 1: Update Imports (Low Risk)
Update your imports to use new paths:

```typescript
// Old
import { Player, POSITION_LABELS } from '@/types';

// New (both work via re-export)
import type { Player } from '@types/domain';
import { POSITION_LABELS } from '@types/ui';
```

### Phase 2: Wrap App with AuthProvider (No Breaking Changes)
In `src/main.tsx`:

```typescript
import { AuthProvider } from '@contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

### Phase 3: Replace authFetch Gradually
In each component that uses `authFetch()`:

```typescript
// Old
import { authFetch } from '@/lib/authFetch';
const response = await authFetch('/api/players');

// New
import { apiClient } from '@api/client';
const players = await apiClient.get<Player[]>('/api/players');
```

### Phase 4: Wrap Components with ErrorBoundary (Incremental)
```typescript
import { ErrorBoundary } from '@components/ErrorBoundary';

export function PlayerPage() {
  return (
    <ErrorBoundary>
      <YourContent />
    </ErrorBoundary>
  );
}
```

## Benefits

| Problem | Before | After |
|---------|--------|-------|
| Types organization | 1 file, 422 lines, mixed concerns | 2 files, clear separation |
| API layer | No abstraction, scattered authFetch calls | Centralized ApiClient with types |
| Auth state | localStorage + reload on 401 | AuthContext + graceful error recovery |
| Error handling | Hard page reload (loses state) | Error boundaries + retry mechanism |
| Import structure | Root-level `@/*` | Organized `@api/*`, `@components/*`, etc. |
| God nodes | authFetch: 34 edges | ApiClient: 1-2 uses per component |

## Next Steps

1. **Run `npm run lint`** to verify no import errors
2. **Migrate components incrementally** - no need to do all at once
3. **Keep `src/lib/authFetch.ts`** for now - it still works and re-exports are backward compatible
4. Eventually remove `authFetch.ts` and old `types.ts` when all components migrated

## Testing

After migration, verify:
- ✅ Login/logout still works
- ✅ API calls complete successfully
- ✅ 401 errors are handled gracefully (no page reload)
- ✅ Component errors show Error Boundary fallback
- ✅ No console errors about missing imports
