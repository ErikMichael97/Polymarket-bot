interface RecentEntry {
  walletAddress: string;
  marketId: string;
  firstSeenAt: Date;
  fillCount: number;
}

const recentEntries = new Map<string, RecentEntry>();
const DEDUP_WINDOW_MINUTES = 5;
let totalSlicesDetected = 0;

export function isOrderSlice(walletAddress: string, marketId: string): boolean {
  const key = `${walletAddress}:${marketId}`;
  const existing = recentEntries.get(key);

  if (!existing) {
    recentEntries.set(key, {
      walletAddress,
      marketId,
      firstSeenAt: new Date(),
      fillCount: 1,
    });
    return false;
  }

  const minutesSinceFirst = (Date.now() - existing.firstSeenAt.getTime()) / 60000;

  if (minutesSinceFirst <= DEDUP_WINDOW_MINUTES) {
    existing.fillCount++;
    totalSlicesDetected++;
    console.log(
      `[SLICE DETECTED] ${walletAddress.slice(0, 8)}... ` +
      `on market ${marketId} — fill #${existing.fillCount}, skipping`
    );
    return true;
  }

  // Window expired — new signal from same wallet on same market later
  recentEntries.set(key, {
    walletAddress,
    marketId,
    firstSeenAt: new Date(),
    fillCount: 1,
  });
  return false;
}

export function getSliceStats(): { totalDetected: number; activeWindows: number } {
  return {
    totalDetected: totalSlicesDetected,
    activeWindows: recentEntries.size,
  };
}

// Clean up stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000;
  for (const [key, entry] of recentEntries.entries()) {
    if (entry.firstSeenAt.getTime() < cutoff) {
      recentEntries.delete(key);
    }
  }
}, 10 * 60 * 1000);
