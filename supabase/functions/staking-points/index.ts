const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAKING_API_BASE = 'https://staking.youmio.ai/api';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokenId, nftType } = await req.json();
    
    if (!tokenId || !nftType) {
      console.error('[Staking] Missing parameters');
      return new Response(
        JSON.stringify({ error: 'tokenId and nftType are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[Staking] Fetching points for token ${tokenId} (${nftType})`);
    
    const url = `${STAKING_API_BASE}/seeds/points?id=${tokenId}&type=${nftType}`;
    const response = await fetch(url);

    // 404 is normal - means no staking data
    if (response.status === 404) {
      console.log(`[Staking] No data found for token ${tokenId} - returning 0 points`);
      return new Response(
        JSON.stringify({ points: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      console.warn(`[Staking] API warning: HTTP ${response.status}`);
      return new Response(
        JSON.stringify({ points: 0 }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const points = data.points !== undefined ? data.points : (data.totalPoints || data.stakingPoints || 0);
    
    console.log(`[Staking] Token ${tokenId} has ${points} points`);

    return new Response(
      JSON.stringify({ points }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[Staking] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        points: 0
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
