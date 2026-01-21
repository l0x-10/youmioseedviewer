import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Search, ArrowLeft, ExternalLink, Tag, Loader2, Crown, Medal, Award, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { NFTType } from '@/utils/api';

interface LeaderboardNFT {
  tokenId: string;
  nftType: NFTType;
  points: number;
  imageUrl: string | null;
  openseaUrl: string | null;
  isListed: boolean;
}

interface CacheMeta {
  status: string;
  lastCompletedAt: string | null;
}

export default function Leaderboard() {
  const [allNFTs, setAllNFTs] = useState<LeaderboardNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cacheMeta, setCacheMeta] = useState<CacheMeta | null>(null);

  // Calculate totals
  const totalPoints = useMemo(() => allNFTs.reduce((sum, nft) => sum + nft.points, 0), [allNFTs]);
  const mythicPoints = useMemo(() => allNFTs.filter(n => n.nftType === 'Mythic').reduce((sum, nft) => sum + nft.points, 0), [allNFTs]);
  const ancientPoints = useMemo(() => allNFTs.filter(n => n.nftType === 'Ancient').reduce((sum, nft) => sum + nft.points, 0), [allNFTs]);

  // Filter and search
  const filteredNFTs = useMemo(() => {
    if (!searchQuery.trim()) return allNFTs;
    return allNFTs.filter(nft => nft.tokenId.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allNFTs, searchQuery]);

  // Find searched NFT position
  const searchedNFTPosition = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const exactMatch = allNFTs.findIndex(nft => nft.tokenId === searchQuery.trim());
    return exactMatch !== -1 ? exactMatch + 1 : null;
  }, [allNFTs, searchQuery]);

  const loadFromCache = async () => {
    setLoading(true);
    try {
      // Fetch cached leaderboard entries sorted by points
      const { data: entries, error } = await supabase
        .from('leaderboard_entries')
        .select('*')
        .order('points', { ascending: false });

      if (error) throw error;

      const nfts: LeaderboardNFT[] = (entries || []).map((e: any) => ({
        tokenId: e.token_id,
        nftType: e.nft_type as NFTType,
        points: Number(e.points),
        imageUrl: e.image_url,
        openseaUrl: e.opensea_url,
        isListed: e.is_listed,
      }));

      setAllNFTs(nfts);

      // Fetch cache meta
      const { data: meta } = await supabase
        .from('leaderboard_meta')
        .select('*')
        .eq('cache_key', 'leaderboard_v1')
        .maybeSingle();

      if (meta) {
        setCacheMeta({
          status: meta.status,
          lastCompletedAt: meta.last_completed_at,
        });
      }

      if (nfts.length === 0) {
        toast.info('No cached data yet. Click refresh to load leaderboard.');
      }
    } catch (err) {
      console.error('Error loading from cache:', err);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    toast.info('Refreshing leaderboard data... This may take a few minutes.');

    try {
      const { error } = await supabase.functions.invoke('leaderboard-refresh');
      if (error) throw error;

      toast.success('Leaderboard refreshed!');
      await loadFromCache();
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Refresh failed. Try again later.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFromCache();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center font-mono text-muted-foreground">#{rank}</span>;
  };

  const formatLastUpdated = () => {
    if (!cacheMeta?.lastCompletedAt) return 'Never';
    const date = new Date(cacheMeta.lastCompletedAt);
    return date.toLocaleString();
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Updated: {formatLastUpdated()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={triggerRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 mb-6">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Seed Leaderboard</h1>
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
              <p className="text-xs text-muted-foreground mt-1">{allNFTs.filter(n => n.nftType === 'Mythic').length} seeds</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Ancient Points</p>
              <p className="text-2xl font-bold text-amber-500">{ancientPoints.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{allNFTs.filter(n => n.nftType === 'Ancient').length} seeds</p>
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
                <Badge variant="secondary" className="text-xs">Rank #{searchedNFTPosition}</Badge>
              </div>
            )}
          </div>
        </header>

        {/* Loading State */}
        {loading && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Loading leaderboard...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && allNFTs.length === 0 && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground mb-4">No leaderboard data yet</p>
            <Button onClick={triggerRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Loading data...' : 'Load Leaderboard'}
            </Button>
          </div>
        )}

        {/* Leaderboard Table */}
        {!loading && filteredNFTs.length > 0 && (
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
                  {filteredNFTs.map((nft) => {
                    const globalRank = allNFTs.findIndex(n => n.tokenId === nft.tokenId && n.nftType === nft.nftType) + 1;
                    const isHighlighted = searchQuery.trim() && nft.tokenId.includes(searchQuery.trim());

                    return (
                      <tr
                        key={`${nft.nftType}-${nft.tokenId}`}
                        className={`transition-colors hover:bg-muted/30 ${isHighlighted ? 'bg-primary/10' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">{getRankIcon(globalRank)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {nft.imageUrl ? (
                              <img src={nft.imageUrl} alt={`Seed #${nft.tokenId}`} className="w-10 h-10 rounded-lg object-cover" />
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
                            <Badge variant="outline" className="bg-muted text-muted-foreground">Not Listed</Badge>
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

        {/* No search results */}
        {!loading && filteredNFTs.length === 0 && allNFTs.length > 0 && (
          <div className="bg-card rounded-xl shadow-card p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">No seeds found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
