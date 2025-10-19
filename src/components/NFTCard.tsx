import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  NFTWithMetadata, 
  getNFTName, 
  formatPrice, 
  calculatePointsPerPrice,
  getImageUrl,
  getOpenSeaUrl
} from '@/utils/api';

interface NFTCardProps {
  listing: NFTWithMetadata;
  isBestDeal?: boolean;
}

export function NFTCard({ listing, isBestDeal }: NFTCardProps) {
  const [imageUrl, setImageUrl] = useState<string>(
    listing.cachedImageUrl || 'https://via.placeholder.com/300x300/667eea/ffffff?text=Loading...'
  );
  const [imageLoading, setImageLoading] = useState(!listing.cachedImageUrl);

  const name = getNFTName(listing);
  const price = formatPrice(listing);
  const points = listing.stakingPoints;
  const ratio = calculatePointsPerPrice(listing);
  const openSeaUrl = getOpenSeaUrl(listing);

  useEffect(() => {
    if (!listing.cachedImageUrl) {
      getImageUrl(listing).then(url => {
        setImageUrl(url);
        setImageLoading(false);
        listing.cachedImageUrl = url;
      });
    }
  }, [listing]);

  const handleCardClick = () => {
    if (openSeaUrl) {
      window.open(openSeaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleImageError = () => {
    setImageUrl(
      `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect fill="%23667eea" width="300" height="300"/%3E%3Ctext x="50%25" y="45%25" text-anchor="middle" fill="white" font-size="24" font-family="Arial"%3ENFT Image%3C/text%3E%3Ctext x="50%25" y="55%25" text-anchor="middle" fill="white" font-size="16" font-family="Arial"%3ENot Available%3C/text%3E%3C/svg%3E`
    );
    setImageLoading(false);
  };

  return (
    <Card 
      className={`overflow-hidden transition-smooth cursor-pointer hover:shadow-card-hover hover:-translate-y-2 ${
        isBestDeal ? 'ring-2 ring-accent shadow-glow' : ''
      }`}
      onClick={handleCardClick}
    >
      <div className="relative w-full h-64 overflow-hidden bg-secondary">
        {listing.nftType && (
          <Badge 
            className="absolute top-3 right-3 z-10 gradient-primary text-primary-foreground font-bold uppercase text-xs shadow-lg"
          >
            {listing.nftType}
          </Badge>
        )}
        {isBestDeal && (
          <Badge 
            className="absolute top-3 left-3 z-10 gradient-accent text-accent-foreground font-bold uppercase text-xs shadow-lg"
          >
            🏆 Best Deal
          </Badge>
        )}
        {imageLoading && (
          <div className="absolute inset-0 bg-secondary animate-pulse" />
        )}
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover transition-smooth hover:scale-105"
          loading="lazy"
          onError={handleImageError}
        />
      </div>

      <div className="p-4 space-y-2">
        <h3 
          className="text-lg font-semibold text-foreground truncate" 
          title={name}
        >
          {name}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-primary">
            {price}
          </p>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </div>

        {points !== undefined && points !== null && (
          <div className={`px-3 py-1.5 rounded-md text-sm font-semibold ${
            points > 0 
              ? 'bg-success/10 text-success' 
              : 'bg-muted text-muted-foreground'
          }`}>
            ⭐ {points} points
          </div>
        )}

        {ratio > 0 && (
          <div className="px-3 py-1.5 rounded-md bg-accent/10 text-accent text-sm font-semibold">
            📊 {ratio.toFixed(2)} pts/ETH
          </div>
        )}
      </div>
    </Card>
  );
}
