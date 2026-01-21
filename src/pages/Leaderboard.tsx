import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Search, ArrowLeft, ExternalLink, Tag, Loader2, Crown, Medal, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { COLLECTION_SLUGS, NFTType, fetchStakingPoints } from '@/utils/api';

interface LeaderboardNFT {
  tokenId: string;
  nftType: NFTType;
  points: number;
  imageUrl: string | null;
  openseaUrl: string | null;
  isListed: boolean;
  listingPrice?: number;
}

const LISTED_NFTS_CACHE: Map<string, Set<string>> = new Map();

export default function Leaderboard() {
  const [allNFTs, setAllNFTs] = useState<LeaderboardNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Calculate totals
  const totalPoints = useMemo(() => {
    return allNFTs.reduce((sum, nft) => sum + nft.points, 0);
  }, [allNFTs]);

  const mythicPoints = useMemo(() => {
    return allNFTs.filter(n => n.nftType === 'Mythic').reduce((sum, nft) => sum + nft.points, 0);
  }, [allNFTs]);

  const ancientPoints = useMemo(() => {
    return allNFTs.filter(n => n.nftType === 'Ancient').reduce((sum, nft) => sum + nft.points, 0);
  }, [allNFTs]);

  // Filter and search
  const filteredNFTs = useMemo(() => {
    if (!searchQuery.trim()) return allNFTs;
    return allNFTs.filter(nft => 
      nft.tokenId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allNFTs, searchQuery]);

  // Find searched NFT position
  const searchedNFTPosition = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const exactMatch = allNFTs.findIndex(nft => nft.tokenId === searchQuery.trim());
    return exactMatch !== -1 ? exactMatch + 1 : null;
  }, [allNFTs, searchQuery]);

  const fetchListedNFTs = async (collectionSlug: string): Promise<Set<string>> => {
    if (LISTED_NFTS_CACHE.has(collectionSlug)) {
      return LISTED_NFTS_CACHE.get(collectionSlug)!;
    }

    try {
      const { data, error } = await supabase.functions.invoke('opensea-listings', {
        body: { collectionSlug },
      });

      if (error) throw error;

      const listings = data?.listings || [];
      const listedIds = new Set<string>();
      
      listings.forEach((listing: any) => {
        const tokenId = listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria;
        if (tokenId) {
          listedIds.add(tokenId);
        }
      });

      LISTED_NFTS_CACHE.set(collectionSlug, listedIds);
      return listedIds;
    } catch (err) {
      console.error('Error fetching listed NFTs:', err);
      return new Set();
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    setAllNFTs([]);
    setLoadingProgress('Initializing...');

    try {
      const allLeaderboardNFTs: LeaderboardNFT[] = [];

      for (const [nftType, collectionSlug] of Object.entries(COLLECTION_SLUGS)) {
        setLoadingProgress(`Fetching ${nftType} Seeds...`);
        
        // Fetch all NFTs in collection
        const { data: nftData, error: nftError } = await supabase.functions.invoke('opensea-collection-nfts', {
          body: { collectionSlug },
        });

        if (nftError) {
          console.error(`Error fetching ${nftType} NFTs:`, nftError);
          continue;
        }

        const nfts = nftData?.nfts || [];
        console.log(`Fetched ${nfts.length} ${nftType} NFTs`);

        // Fetch listed NFTs for this collection
        setLoadingProgress(`Checking ${nftType} listings...`);
        const listedIds = await fetchListedNFTs(collectionSlug);
        console.log(`Found ${listedIds.size} listed ${nftType} NFTs`);

        // Fetch staking points for each NFT
        setLoadingProgress(`Loading ${nftType} staking points (${nfts.length} NFTs)...`);
        
        const batchSize = 20;
        for (let i = 0; i < nfts.length; i += batchSize) {
          const batch = nfts.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(async (nft: any) => {
              const tokenId = nft.identifier;
              if (!tokenId) return;

              const points = await fetchStakingPoints(tokenId, nftType as NFTType);
              
              allLeaderboardNFTs.push({
                tokenId,
                nftType: nftType as NFTType,
                points,
                imageUrl: nft.image_url,
                openseaUrl: nft.opensea_url,
                isListed: listedIds.has(tokenId),
              });
            })
          );

          setLoadingProgress(`Loading ${nftType} points: ${Math.min(i + batchSize, nfts.length)}/${nfts.length}`);
        }
      }

      // Sort by points descending
      allLeaderboardNFTs.sort((a, b) => b.points - a.points);
      
      setAllNFTs(allLeaderboardNFTs);
      toast.success(`Loaded ${allLeaderboardNFTs.length} seeds!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(errorMessage);
      toast.error('Error loading leaderboard', { description: errorMessage });
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center font-mono text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="bg-card rounded-xl shadow-card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Viewer
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              Seed Leaderboard
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Total Points</p>
              <p className="text-2xl font-bold text-primary">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{allNFTs.length} seeds</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Mythic Points</p>
              <p className="text-2xl font-bold text-purple-500">{mythicPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {allNFTs.filter(n => n.nftType === 'Mythic').length} seeds
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Ancient Points</p>
              <p className="text-2xl font-bold text-amber-500">{ancientPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {allNFTs.filter(n => n.nftType === 'Ancient').length} seeds
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Seed ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchedNFTPosition && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Badge variant="secondary" className="text-xs">
                  Rank #{searchedNFTPosition}
                </Badge>
              </div>
            )}
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">{loadingProgress}</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a moment as we fetch all seeds...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-6 text-center">
            <p>{error}</p>
            <Button onClick={loadLeaderboard} className="mt-4">
              Try Again
            </Button>
          </div>
        )}

        {/* Leaderboard Table */}
        {!loading && !error && filteredNFTs.length > 0 && (
          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Rank</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Seed</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Points</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredNFTs.map((nft, index) => {
                    const globalRank = allNFTs.findIndex(n => n.tokenId === nft.tokenId && n.nftType === nft.nftType) + 1;
                    const isHighlighted = searchQuery.trim() && nft.tokenId.includes(searchQuery.trim());
                    
                    return (
                      <tr 
                        key={`${nft.nftType}-${nft.tokenId}`}
                        className={`transition-colors hover:bg-muted/30 ${isHighlighted ? 'bg-primary/10' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getRankIcon(globalRank)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {nft.imageUrl ? (
                              <img 
                                src={nft.imageUrl} 
                                alt={`Seed #${nft.tokenId}`}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">#{nft.tokenId}</span>
                              </div>
                            )}
                            <span className="font-medium">#{nft.tokenId}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge 
                            variant="secondary"
                            className={nft.nftType === 'Mythic' ? 'bg-purple-500/20 text-purple-600' : 'bg-amber-500/20 text-amber-600'}
                          >
                            {nft.nftType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-primary">{nft.points.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {nft.isListed ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                              <Tag className="w-3 h-3 mr-1" />
                              Listed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              Not Listed
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {nft.openseaUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(nft.openseaUrl!, '_blank')}
                              title="View on OpenSea"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredNFTs.length === 0 && allNFTs.length > 0 && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No seeds found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
