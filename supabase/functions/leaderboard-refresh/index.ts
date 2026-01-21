import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';
const OPENSEA_API_KEY = 'fdae3233ff1545ab8d5d7041e90ed89a';
const STAKING_API_BASE = 'https://staking.youmio.ai/api';

const COLLECTION_SLUGS = {
  Mythic: 'mythicseed',
  Ancient: 'ancientseed',
} as const;

type NFTType = keyof typeof COLLECTION_SLUGS;

interface NFTItem {
  identifier: string;
  image_url: string | null;
  opensea_url: string | null;
}

async function fetchAllNFTs(collectionSlug: string): Promise<NFTItem[]> {
  const allNFTs: NFTItem[] = [];
  let nextCursor: string | null = null;
  let pageCount = 0;
  const maxPages = 50;
  const limit = 200;

  do {
    pageCount++;
    let url = `${OPENSEA_API_BASE}/collection/${collectionSlug}/nfts?limit=${limit}`;
    if (nextCursor) url += `&next=${nextCursor}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-API-KEY': OPENSEA_API_KEY },
    });

    if (!response.ok) {
      console.error(`[Refresh] OpenSea error page ${pageCount}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const nfts = data.nfts || [];
    allNFTs.push(...nfts.map((n: any) => ({
      identifier: n.identifier,
      image_url: n.image_url,
      opensea_url: n.opensea_url,
    })));

    nextCursor = data.next || null;
    if (pageCount >= maxPages) break;
  } while (nextCursor);

  console.log(`[Refresh] Fetched ${allNFTs.length} NFTs for ${collectionSlug}`);
  return allNFTs;
}

async function fetchListedTokenIds(collectionSlug: string): Promise<Set<string>> {
  const listedIds = new Set<string>();
  let nextCursor: string | null = null;
  let pageCount = 0;
  const maxPages = 20;

  do {
    pageCount++;
    let url = `${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/all`;
    if (nextCursor) url += `?next=${nextCursor}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-API-KEY': OPENSEA_API_KEY },
    });

    if (!response.ok) break;

    const data = await response.json();
    const listings = data.listings || [];
    for (const listing of listings) {
      const tokenId = listing.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria;
      if (tokenId) listedIds.add(tokenId);
    }

    nextCursor = data.next || null;
    if (pageCount >= maxPages) break;
  } while (nextCursor);

  console.log(`[Refresh] Found ${listedIds.size} listed NFTs for ${collectionSlug}`);
  return listedIds;
}

async function fetchPointsBatch(tokenIds: string[], nftType: NFTType): Promise<Record<string, number>> {
  const pointsById: Record<string, number> = {};
  const concurrency = 10;

  const chunks: string[][] = [];
  for (let i = 0; i < tokenIds.length; i += concurrency) {
    chunks.push(tokenIds.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (tokenId) => {
      try {
        const url = `${STAKING_API_BASE}/seeds/points?id=${encodeURIComponent(tokenId)}&type=${encodeURIComponent(nftType)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          pointsById[tokenId] = data.points ?? data.totalPoints ?? data.stakingPoints ?? 0;
        } else {
          pointsById[tokenId] = 0;
        }
      } catch {
        pointsById[tokenId] = 0;
      }
    }));
  }

  return pointsById;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const cacheKey = 'leaderboard_v1';

  // Mark as running
  await supabase.from('leaderboard_meta').upsert({
    cache_key: cacheKey,
    status: 'running',
    last_started_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' });

  try {
    console.log('[Refresh] Starting leaderboard refresh...');

    for (const [nftType, collectionSlug] of Object.entries(COLLECTION_SLUGS)) {
      console.log(`[Refresh] Processing ${nftType}...`);

      const nfts = await fetchAllNFTs(collectionSlug);
      const listedIds = await fetchListedTokenIds(collectionSlug);
      const tokenIds = nfts.map(n => n.identifier).filter(Boolean);

      console.log(`[Refresh] Fetching points for ${tokenIds.length} ${nftType} NFTs...`);
      const pointsById = await fetchPointsBatch(tokenIds, nftType as NFTType);

      // Upsert in batches
      const batchSize = 100;
      for (let i = 0; i < nfts.length; i += batchSize) {
        const batch = nfts.slice(i, i + batchSize);
        const rows = batch.map(nft => ({
          collection_slug: collectionSlug,
          nft_type: nftType,
          token_id: nft.identifier,
          points: pointsById[nft.identifier] ?? 0,
          image_url: nft.image_url,
          opensea_url: nft.opensea_url,
          is_listed: listedIds.has(nft.identifier),
        }));

        const { error } = await supabase.from('leaderboard_entries').upsert(rows, {
          onConflict: 'collection_slug,token_id',
        });

        if (error) {
          console.error(`[Refresh] Upsert error batch ${i}:`, error);
        }
      }

      console.log(`[Refresh] Saved ${nfts.length} ${nftType} entries`);
    }

    // Mark as completed
    await supabase.from('leaderboard_meta').upsert({
      cache_key: cacheKey,
      status: 'idle',
      last_completed_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'cache_key' });

    console.log('[Refresh] Leaderboard refresh completed!');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Refresh] Error:', error);

    await supabase.from('leaderboard_meta').upsert({
      cache_key: cacheKey,
      status: 'error',
      last_error: error instanceof Error ? error.message : 'Unknown error',
    }, { onConflict: 'cache_key' });

    return new Response(JSON.stringify({ error: 'Refresh failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
