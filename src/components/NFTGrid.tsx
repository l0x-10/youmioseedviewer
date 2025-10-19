import { NFTCard } from './NFTCard';
import { NFTWithMetadata, calculatePointsPerPrice } from '@/utils/api';

interface NFTGridProps {
  listings: NFTWithMetadata[];
  loading?: boolean;
  error?: string | null;
}

export function NFTGrid({ listings, loading, error }: NFTGridProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl shadow-card">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground text-lg">Loading NFTs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border-l-4 border-destructive rounded-lg">
        <p className="text-destructive font-semibold">{error}</p>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl shadow-card">
        <p className="text-muted-foreground text-lg">No NFTs found for this collection.</p>
      </div>
    );
  }

  // Find best deal (highest points per ETH)
  const bestDealIndex = listings.reduce((bestIdx, listing, idx) => {
    const currentRatio = calculatePointsPerPrice(listing);
    const bestRatio = calculatePointsPerPrice(listings[bestIdx]);
    return currentRatio > bestRatio ? idx : bestIdx;
  }, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing, index) => (
        <NFTCard
          key={`${listing.tokenId}-${index}`}
          listing={listing}
          isBestDeal={index === bestDealIndex && calculatePointsPerPrice(listing) > 0}
        />
      ))}
    </div>
  );
}
