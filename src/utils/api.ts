import { supabase } from '@/integrations/supabase/client';

// Collection slugs for Youmio Seeds
export const COLLECTION_SLUGS = {
  Mythic: 'mythicseed',
  Ancient: 'ancientseed',
} as const;

export type NFTType = keyof typeof COLLECTION_SLUGS;

// Types for API responses
export interface OpenSeaListing {
  price?: {
    current?: {
      value: string;
      currency: string;
    };
  };
  protocol_data?: {
    parameters?: {
      offer?: Array<{
        identifierOrCriteria: string;
        token: string;
        imageUrl?: string;
      }>;
    };
  };
}

export interface NFTWithMetadata extends OpenSeaListing {
  tokenId?: string;
  nftType?: NFTType;
  stakingPoints?: number;
  cachedImageUrl?: string;
}

// Caches
const imageCache = new Map<string, string>();
const pointsCache = new Map<string, number>();
const pendingImageRequests = new Map<string, Promise<string>>();

/**
 * Remove duplicate NFTs and keep only the lowest price for each tokenId
 */
function removeDuplicateNFTs(listings: NFTWithMetadata[]): NFTWithMetadata[] {
  const nftMap = new Map<string, NFTWithMetadata>();
  const duplicates: { tokenId: string; oldPrice: number; newPrice: number }[] = [];
  
  listings.forEach(listing => {
    const tokenId = listing.tokenId;
    if (!tokenId) return;
    
    const currentPrice = getPriceValue(listing);
    const existing = nftMap.get(tokenId);
    
    if (!existing) {
      // First time seeing this NFT
      nftMap.set(tokenId, listing);
    } else {
      // Found duplicate - compare prices and keep the lower one
      const existingPrice = getPriceValue(existing);
      if (currentPrice < existingPrice) {
        duplicates.push({ 
          tokenId, 
          oldPrice: existingPrice, 
          newPrice: currentPrice 
        });
        nftMap.set(tokenId, listing);
      } else {
        duplicates.push({ 
          tokenId, 
          oldPrice: currentPrice, 
          newPrice: existingPrice 
        });
      }
    }
  });
  
  // Log detailed duplicate information
  if (duplicates.length > 0) {
    console.log(`🔍 Found ${duplicates.length} duplicate NFTs (keeping lowest price for each):`);
    duplicates.forEach(({ tokenId, oldPrice, newPrice }) => {
      console.log(`  - NFT #${tokenId}: Removed ${oldPrice.toFixed(4)} ETH, Kept ${newPrice.toFixed(4)} ETH`);
    });
  }
  
  const uniqueNFTs = Array.from(nftMap.values());
  console.log(`📊 Summary: ${listings.length} total listings → ${uniqueNFTs.length} unique NFTs (removed ${listings.length - uniqueNFTs.length} duplicates)`);
  
  return uniqueNFTs;
}

/**
 * Fetch NFT listings from OpenSea via Edge Function
 */
export async function fetchNFTListings(nftType: NFTType): Promise<NFTWithMetadata[]> {
  const collectionSlug = COLLECTION_SLUGS[nftType];
  
  try {
    console.log(`Fetching listings for ${nftType} via Edge Function`);
    
    const { data, error } = await supabase.functions.invoke('opensea-listings', {
      body: { collectionSlug },
    });
    
    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(error.message || 'Failed to fetch NFT listings');
    }
    
    const allListings = (data?.listings || []) as NFTWithMetadata[];
    
    // Add NFT type and tokenId to each listing
    allListings.forEach(listing => {
      listing.nftType = nftType;
      const tokenId = getTokenId(listing);
      if (tokenId) {
        listing.tokenId = tokenId;
      }
    });
    
    // Remove duplicates - keep only lowest price for each NFT
    const uniqueListings = removeDuplicateNFTs(allListings);
    
    console.log(`Fetched ${allListings.length} total listings, ${uniqueListings.length} unique NFTs for ${nftType}`);
    return uniqueListings;
  } catch (error) {
    console.error('Error fetching NFT listings:', error);
    throw error;
  }
}

/**
 * Get token ID from listing
 */
export function getTokenId(listing: OpenSeaListing): string | null {
  try {
    return listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria || null;
  } catch {
    return null;
  }
}

/**
 * Get NFT name
 */
export function getNFTName(listing: OpenSeaListing): string {
  const tokenId = getTokenId(listing);
  return tokenId ? `NFT #${tokenId}` : 'Unknown NFT';
}

/**
 * Format price in ETH
 */
export function formatPrice(listing: OpenSeaListing): string {
  try {
    if (!listing.price?.current?.value) return 'Price not available';
    const value = parseFloat(listing.price.current.value) / 1e18;
    const currency = listing.price.current.currency || 'ETH';
    return `${value.toFixed(4)} ${currency}`;
  } catch {
    return 'Price not available';
  }
}

/**
 * Get numeric price value in ETH
 */
export function getPriceValue(listing: OpenSeaListing): number {
  try {
    if (!listing.price?.current?.value) return 0;
    return parseFloat(listing.price.current.value) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Get image URL for NFT via Edge Function
 */
export async function getImageUrl(listing: OpenSeaListing): Promise<string> {
  const tokenId = getTokenId(listing);
  if (!tokenId) return getPlaceholderImage('No ID');
  
  // Check cache
  if (imageCache.has(tokenId)) {
    return imageCache.get(tokenId)!;
  }
  
  // Check if already loading
  if (pendingImageRequests.has(tokenId)) {
    return pendingImageRequests.get(tokenId)!;
  }
  
  // Try to get from listing data first
  const cachedUrl = listing.protocol_data?.parameters?.offer?.[0]?.imageUrl;
  if (cachedUrl) {
    imageCache.set(tokenId, cachedUrl);
    return cachedUrl;
  }
  
  // Fetch from Edge Function
  const contractAddress = listing.protocol_data?.parameters?.offer?.[0]?.token;
  if (!contractAddress) {
    const placeholder = getPlaceholderImage('No Contract');
    imageCache.set(tokenId, placeholder);
    return placeholder;
  }
  
  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke('opensea-nft-image', {
        body: { contractAddress, tokenId },
      });
      
      if (!error && data?.imageUrl) {
        imageCache.set(tokenId, data.imageUrl);
        pendingImageRequests.delete(tokenId);
        return data.imageUrl;
      }
    } catch (error) {
      console.warn(`Failed to fetch image for token ${tokenId}:`, error);
    }
    
    // Fallback to placeholder
    const placeholder = getPlaceholderImage(`NFT #${tokenId}`);
    imageCache.set(tokenId, placeholder);
    pendingImageRequests.delete(tokenId);
    return placeholder;
  })();
  
  pendingImageRequests.set(tokenId, promise);
  return promise;
}

/**
 * Get placeholder image URL
 */
function getPlaceholderImage(text: string): string {
  const encodedText = encodeURIComponent(text);
  return `https://via.placeholder.com/300x300/667eea/ffffff?text=${encodedText}`;
}

/**
 * Fetch staking points for NFT via Edge Function
 */
export async function fetchStakingPoints(tokenId: string, nftType: NFTType): Promise<number> {
  const cacheKey = `${nftType}_${tokenId}`;
  
  // Check cache
  if (pointsCache.has(cacheKey)) {
    return pointsCache.get(cacheKey)!;
  }
  
  try {
    const { data, error } = await supabase.functions.invoke('staking-points', {
      body: { tokenId, nftType },
    });
    
    if (error) {
      console.warn(`Error fetching staking points for token ${tokenId}:`, error);
      pointsCache.set(cacheKey, 0);
      return 0;
    }
    
    const points = data?.points || 0;
    pointsCache.set(cacheKey, points);
    return points;
  } catch (error) {
    console.error(`Error fetching staking points for token ${tokenId}:`, error);
    pointsCache.set(cacheKey, 0);
    return 0;
  }
}

/**
 * Calculate points per ETH ratio
 */
export function calculatePointsPerPrice(listing: NFTWithMetadata): number {
  const points = listing.stakingPoints || 0;
  const price = getPriceValue(listing);
  if (price === 0 || points === 0) return 0;
  return points / price;
}

/**
 * Get OpenSea URL for NFT
 */
export function getOpenSeaUrl(listing: OpenSeaListing): string | null {
  const tokenId = getTokenId(listing);
  const contractAddress = listing.protocol_data?.parameters?.offer?.[0]?.token;
  
  if (tokenId && contractAddress) {
    return `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  }
  
  return null;
}

/**
 * Sort listings
 */
export type SortType = 'lowestprice' | 'highestprice' | 'bestdeal';

export function sortListings(listings: NFTWithMetadata[], sortType: SortType): NFTWithMetadata[] {
  const sorted = [...listings];
  
  switch (sortType) {
    case 'bestdeal':
      return sorted.sort((a, b) => {
        const ratioA = calculatePointsPerPrice(a);
        const ratioB = calculatePointsPerPrice(b);
        return ratioB - ratioA;
      });
    case 'highestprice':
      return sorted.sort((a, b) => getPriceValue(b) - getPriceValue(a));
    case 'lowestprice':
      return sorted.sort((a, b) => getPriceValue(a) - getPriceValue(b));
    default:
      return sorted;
  }
}
