const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAKING_API_BASE = 'https://staking.youmio.ai/api';

type NFTType = 'Mythic' | 'Ancient';

function isValidTokenId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 20 && /^[0-9]+$/.test(value);
}

function isValidNftType(value: unknown): value is NFTType {
  return value === 'Mythic' || value === 'Ancient';
}

async function fetchPoints(tokenId: string, nftType: NFTType): Promise<number> {
  const url = `${STAKING_API_BASE}/seeds/points?id=${encodeURIComponent(tokenId)}&type=${encodeURIComponent(nftType)}`;
  const response = await fetch(url);

  // 404 is normal - means no staking data
  if (response.status === 404) return 0;
  if (!response.ok) return 0;

  const data = await response.json();
  return data.points !== undefined ? data.points : (data.totalPoints || data.stakingPoints || 0);
}

async function asyncPool<T, R>(poolLimit: number, array: T[], iteratorFn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<unknown>[] = [];

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e: Promise<unknown> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const tokenIds = body?.tokenIds;
    const nftType = body?.nftType;

    if (!Array.isArray(tokenIds) || !isValidNftType(nftType)) {
      return new Response(
        JSON.stringify({ error: 'tokenIds (array) and nftType (Mythic|Ancient) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const cleaned = tokenIds.filter(isValidTokenId);
    const MAX = 50;
    const sliced = cleaned.slice(0, MAX);

    console.log(`[StakingBatch] Fetching points for ${sliced.length}/${tokenIds.length} tokens (${nftType})`);

    const results = await asyncPool(6, sliced, async (tokenId) => {
      try {
        const points = await fetchPoints(tokenId, nftType);
        return { tokenId, points };
      } catch {
        return { tokenId, points: 0 };
      }
    });

    const pointsById: Record<string, number> = {};
    for (const r of results) pointsById[r.tokenId] = r.points;

    return new Response(
      JSON.stringify({ pointsById }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[StakingBatch] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', pointsById: {} }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
