import { useState, useEffect } from 'react';
import { Scroll, ArrowUp, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FilterControls } from '@/components/FilterControls';
import { NFTGrid } from '@/components/NFTGrid';
import {
  NFTType,
  SortType,
  NFTWithMetadata,
  fetchNFTListings,
  fetchStakingPoints,
  sortListings,
} from '@/utils/api';

const DONATION_WALLET = '0x6C38ED25778a2341ABe9B6eEe6112151c7F189E5';

export default function Index() {
  const [nftType, setNftType] = useState<NFTType>('Mythic');
  const [sortType, setSortType] = useState<SortType>('lowestprice');
  const [hideZeroPoints, setHideZeroPoints] = useState(false);
  const [listings, setListings] = useState<NFTWithMetadata[]>([]);
  const [displayListings, setDisplayListings] = useState<NFTWithMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDonate = () => {
    navigator.clipboard.writeText(DONATION_WALLET);
    toast.success('Wallet address copied!', {
      description: 'Thank you for your support! 💖',
    });
  };

  const loadNFTs = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`\n🔄 Starting to load ${nftType} Seed NFTs...`);
      
      // Fetch listings
      const fetchedListings = await fetchNFTListings(nftType);
      setListings(fetchedListings);

      console.log(`\n📥 Fetched ${fetchedListings.length} unique NFTs`);
      console.log(`ℹ️  Check OpenSea to verify count: https://opensea.io/collection/${nftType === 'Mythic' ? 'mythicseed' : 'ancientseed'}`);

      // Fetch staking points for all NFTs in parallel
      console.log('\n⭐ Fetching staking points...');
      await Promise.all(
        fetchedListings.map(async (listing) => {
          if (listing.tokenId) {
            const points = await fetchStakingPoints(listing.tokenId, nftType);
            listing.stakingPoints = points;
          }
        })
      );

      // Update state to trigger re-render with points
      setListings([...fetchedListings]);
      
      console.log(`✅ Successfully loaded ${fetchedListings.length} NFTs with staking points\n`);
      
      toast.success('NFTs loaded successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load NFTs';
      setError(errorMessage);
      console.error('❌ Error loading NFTs:', errorMessage);
      toast.error('Error loading NFTs', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Update display listings when filters change
  useEffect(() => {
    let filtered = [...listings];

    // Filter zero points
    if (hideZeroPoints) {
      filtered = filtered.filter(listing => 
        listing.stakingPoints && listing.stakingPoints > 0
      );
    }

    // Sort
    filtered = sortListings(filtered, sortType);

    setDisplayListings(filtered);
  }, [listings, hideZeroPoints, sortType]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <header className="bg-card rounded-xl shadow-card p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Scroll className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">
              Youmio Seed Viewer
            </h1>
          </div>

          <FilterControls
            nftType={nftType}
            sortType={sortType}
            hideZeroPoints={hideZeroPoints}
            onNFTTypeChange={setNftType}
            onSortTypeChange={setSortType}
            onToggleZeroPoints={() => setHideZeroPoints(!hideZeroPoints)}
            onLoadNFTs={loadNFTs}
            loading={loading}
          />
        </header>

        {/* NFT Grid */}
        <NFTGrid 
          listings={displayListings} 
          loading={loading} 
          error={error} 
        />

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <Button
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 rounded-full w-12 h-12 p-0 shadow-lg gradient-primary z-50"
            title="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border py-4 px-6 shadow-lg z-40">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <small className="text-muted-foreground text-center sm:text-left">
            © <a
              href="https://discord.com/users/1057664293065211976"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-semibold"
            >
              @l0x_10
            </a> All rights reserved.
          </small>

          <Button
            onClick={handleDonate}
            variant="outline"
            className="gradient-success text-success-foreground font-semibold border-0 shadow-sm"
            title="Copy wallet address for donations"
          >
            <Gift className="w-4 h-4 mr-2" />
            Donate (MetaMask)
          </Button>
        </div>
      </footer>
    </div>
  );
}
