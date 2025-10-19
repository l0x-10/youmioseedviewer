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
    const { collectionSlug } = await req.json();
    
    if (!collectionSlug) {
      console.error('[OpenSea] Missing collectionSlug parameter');
      return new Response(
        JSON.stringify({ error: 'Collection slug is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[OpenSea] Fetching listings for: ${collectionSlug}`);
    
    const url = `${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/all`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`[OpenSea] API error: ${response.status}`);
      const errorText = await response.text();
      console.error(`[OpenSea] Error details:`, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `OpenSea API error: ${response.status}`,
          details: errorText
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    console.log(`[OpenSea] Found ${data.listings?.length || 0} listings`);

    return new Response(
      JSON.stringify({ listings: data.listings || [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[OpenSea] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
