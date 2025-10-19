// OpenSea API configuration
const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';
const API_KEY = 'fdae3233ff1545ab8d5d7041e90ed89a';
const STAKING_API_BASE = 'https://staking.youmio.ai/api';

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
 * Fetch NFT listings from OpenSea
 */
export async function fetchNFTListings(nftType: NFTType): Promise<NFTWithMetadata[]> {
  const collectionSlug = COLLECTION_SLUGS[nftType];
  const url = `${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/all`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': API_KEY,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API Key');
      }
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    const listings = (data.listings || []) as NFTWithMetadata[];
    
    // Add NFT type to each listing
    listings.forEach(listing => {
      listing.nftType = nftType;
      const tokenId = getTokenId(listing);
      if (tokenId) {
        listing.tokenId = tokenId;
      }
    });
    
    console.log(`Fetched ${listings.length} listings for ${nftType}`);
    return listings;
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
 * Get image URL for NFT
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
  
  // Fetch from API
  const contractAddress = listing.protocol_data?.parameters?.offer?.[0]?.token;
  if (!contractAddress) {
    return getPlaceholderImage('No Contract');
  }
  
  const promise = (async () => {
    try {
      const url = `${OPENSEA_API_BASE}/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.nft?.image_url || data.nft?.display_image_url;
        if (imageUrl) {
          imageCache.set(tokenId, imageUrl);
          pendingImageRequests.delete(tokenId);
          return imageUrl;
        }
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
 * Fetch staking points for NFT
 */
export async function fetchStakingPoints(tokenId: string, nftType: NFTType): Promise<number> {
  const cacheKey = `${nftType}_${tokenId}`;
  
  // Check cache
  if (pointsCache.has(cacheKey)) {
    return pointsCache.get(cacheKey)!;
  }
  
  try {
    const url = `${STAKING_API_BASE}/seeds/points?id=${tokenId}&type=${nftType}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      // 404 means no staking data - not an error
      if (response.status === 404) {
        console.log(`No staking data for token ${tokenId} (${nftType})`);
      } else {
        console.warn(`Staking API error for token ${tokenId}: HTTP ${response.status}`);
      }
      pointsCache.set(cacheKey, 0);
      return 0;
    }
    
    const data = await response.json();
    const points = data.points || 0;
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
