import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { NFTType, SortType } from '@/utils/api';

interface FilterControlsProps {
  nftType: NFTType;
  sortType: SortType;
  hideZeroPoints: boolean;
  onNFTTypeChange: (type: NFTType) => void;
  onSortTypeChange: (type: SortType) => void;
  onToggleZeroPoints: () => void;
  onLoadNFTs: () => void;
  loading?: boolean;
}

export function FilterControls({
  nftType,
  sortType,
  hideZeroPoints,
  onNFTTypeChange,
  onSortTypeChange,
  onToggleZeroPoints,
  onLoadNFTs,
  loading = false,
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center justify-center">
      <Select value={nftType} onValueChange={(value) => onNFTTypeChange(value as NFTType)}>
        <SelectTrigger className="w-[180px] font-semibold">
          <SelectValue placeholder="Select NFT Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Mythic">Mythic Seed</SelectItem>
          <SelectItem value="Ancient">Ancient Seed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortType} onValueChange={(value) => onSortTypeChange(value as SortType)}>
        <SelectTrigger className="w-[180px] font-semibold border-accent/30 bg-accent/5">
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="lowestprice">Lowest Price</SelectItem>
          <SelectItem value="highestprice">Highest Price</SelectItem>
          <SelectItem value="bestdeal">Best Deal</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant={hideZeroPoints ? "default" : "secondary"}
        onClick={onToggleZeroPoints}
        className={hideZeroPoints ? "gradient-success" : ""}
        title={hideZeroPoints ? "Showing NFTs with points only" : "Click to hide 0 points"}
      >
        {hideZeroPoints ? '✓ Hiding 0 Points' : '🚫 Hide 0 Points'}
      </Button>

      <Button
        onClick={onLoadNFTs}
        disabled={loading}
        className="gradient-primary font-semibold px-6"
      >
        {loading ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            Loading...
          </>
        ) : (
          'Load NFTs'
        )}
      </Button>
    </div>
  );
}
