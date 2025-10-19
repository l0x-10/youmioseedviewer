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

    console.log(`[OpenSea] Fetching ALL listings for: ${collectionSlug}`);
    
    let allListings: any[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;
    const maxPages = 20; // Safety limit to avoid infinite loops
    
    // Fetch all pages
    do {
      pageCount++;
      console.log(`[OpenSea] Fetching page ${pageCount}${nextCursor ? ` (cursor: ${nextCursor.substring(0, 20)}...)` : ''}`);
      
      const url: string = nextCursor 
        ? `${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/all?next=${nextCursor}`
        : `${OPENSEA_API_BASE}/listings/collection/${collectionSlug}/all`;
      
      const response: Response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
      });

      if (!response.ok) {
        console.error(`[OpenSea] API error on page ${pageCount}: ${response.status}`);
        const errorText = await response.text();
        console.error(`[OpenSea] Error details:`, errorText);
        
        // If we already have some listings, return them
        if (allListings.length > 0) {
          console.log(`[OpenSea] Returning ${allListings.length} listings collected before error`);
          break;
        }
        
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

      const data: any = await response.json();
      const pageListings = data.listings || [];
      allListings = allListings.concat(pageListings);
      
      console.log(`[OpenSea] Page ${pageCount}: ${pageListings.length} listings (total: ${allListings.length})`);
      
      // Get next cursor for pagination
      nextCursor = data.next || null;
      
      // Safety check
      if (pageCount >= maxPages) {
        console.log(`[OpenSea] Reached max pages limit (${maxPages})`);
        break;
      }
      
    } while (nextCursor);

    console.log(`[OpenSea] ✅ Found total ${allListings.length} listings across ${pageCount} pages`);

    return new Response(
      JSON.stringify({ listings: allListings }),
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
