const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';
const API_KEY = 'fdae3233ff1545ab8d5d7041e90ed89a';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractAddress, tokenId } = await req.json();
    
    if (!contractAddress || !tokenId) {
      console.error('[NFT Image] Missing parameters');
      return new Response(
        JSON.stringify({ error: 'contractAddress and tokenId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[NFT Image] Fetching image for token ${tokenId}`);
    
    const url = `${OPENSEA_API_BASE}/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': API_KEY,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[NFT Image] API returned ${response.status} for token ${tokenId}`);
      return new Response(
        JSON.stringify({ imageUrl: null }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const imageUrl = data.nft?.image_url || data.nft?.display_image_url || null;
    
    if (imageUrl) {
      console.log(`[NFT Image] ✅ Found image for token ${tokenId}`);
    } else {
      console.log(`[NFT Image] ⚠️ No image found for token ${tokenId}`);
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.name === 'AbortError') {
      console.error('[NFT Image] Request timeout');
      return new Response(
        JSON.stringify({ imageUrl: null, error: 'Timeout' }),
        { 
          status: 408, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.error('[NFT Image] Error:', error);
    return new Response(
      JSON.stringify({ 
        imageUrl: null,
        error: errorObj.message || 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
