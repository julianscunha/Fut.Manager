const FALLBACK_SVG = (name: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect width="120" height="120" fill="#14532d"/>
    <circle cx="60" cy="46" r="22" fill="#22c55e" opacity="0.25"/>
    <path d="M36 98c0-18 10.8-34 24-34s24 16 24 34" fill="#22c55e" opacity="0.25"/>
    <text x="60" y="74" text-anchor="middle" fill="#fff" font-size="22" font-family="Arial,sans-serif" font-weight="bold">${(name || '?').slice(0,2).toUpperCase()}</text>
  </svg>`
)}`;

export function getPlayerAvatarUrl(player: {
  avatarCard?: string | null;
  avatarEsportivo?: string | null;
  avatarOriginal?: string | null;
  photoOriginal?: string | null;
  name?: string;
}): string {
  return (
    player.avatarCard ||
    player.avatarEsportivo ||
    player.avatarOriginal ||
    player.photoOriginal ||
    FALLBACK_SVG(player.name || '')
  );
}
