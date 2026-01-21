const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENSEA_API_BASE = 'https://api.opensea.io/api/v2';
const API_KEY = 'fdae3233ff1545ab8d5d7041e90ed89a';

interface NFTItem {
  identifier: string;
  collection: string;
  contract: string;
  token_standard: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  metadata_url: string | null;
  opensea_url: string | null;
  updated_at: string;
  is_disabled: boolean;
  is_nsfw: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collectionSlug } = await req.json();
    
    if (!collectionSlug) {
      console.error('[OpenSea NFTs] Missing collectionSlug parameter');
      return new Response(
        JSON.stringify({ error: 'Collection slug is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[OpenSea NFTs] Fetching ALL NFTs for collection: ${collectionSlug}`);
    
    let allNFTs: NFTItem[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;
    const maxPages = 50; // Higher limit since we want all NFTs
    const limit = 200; // Max per page
    
    // Fetch all pages
    do {
      pageCount++;
      console.log(`[OpenSea NFTs] Fetching page ${pageCount}${nextCursor ? ` (cursor: ${nextCursor.substring(0, 20)}...)` : ''}`);
      
      let url = `${OPENSEA_API_BASE}/collection/${collectionSlug}/nfts?limit=${limit}`;
      if (nextCursor) {
        url += `&next=${nextCursor}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': API_KEY,
        },
      });

      if (!response.ok) {
        console.error(`[OpenSea NFTs] API error on page ${pageCount}: ${response.status}`);
        const errorText = await response.text();
        console.error(`[OpenSea NFTs] Error details:`, errorText);
        
        // If we already have some NFTs, return them
        if (allNFTs.length > 0) {
          console.log(`[OpenSea NFTs] Returning ${allNFTs.length} NFTs collected before error`);
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

      const data = await response.json();
      const pageNFTs = data.nfts || [];
      allNFTs = allNFTs.concat(pageNFTs);
      
      console.log(`[OpenSea NFTs] Page ${pageCount}: ${pageNFTs.length} NFTs (total: ${allNFTs.length})`);
      
      // Get next cursor for pagination
      nextCursor = data.next || null;
      
      // Safety check
      if (pageCount >= maxPages) {
        console.log(`[OpenSea NFTs] Reached max pages limit (${maxPages})`);
        break;
      }
      
    } while (nextCursor);

    console.log(`[OpenSea NFTs] ✅ Found total ${allNFTs.length} NFTs across ${pageCount} pages`);

    return new Response(
      JSON.stringify({ nfts: allNFTs }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[OpenSea NFTs] Error:', error);
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
