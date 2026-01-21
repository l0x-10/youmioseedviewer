-- Cache table for leaderboard entries (publicly readable)
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL,
  nft_type text NOT NULL,
  token_id text NOT NULL,
  points bigint NOT NULL DEFAULT 0,
  image_url text,
  opensea_url text,
  is_listed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_slug, token_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_entries_points_idx ON public.leaderboard_entries (points DESC);
CREATE INDEX IF NOT EXISTS leaderboard_entries_type_idx ON public.leaderboard_entries (nft_type);
CREATE INDEX IF NOT EXISTS leaderboard_entries_token_idx ON public.leaderboard_entries (token_id);

-- Meta table to track refresh jobs
CREATE TABLE IF NOT EXISTS public.leaderboard_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle',
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_meta ENABLE ROW LEVEL SECURITY;

-- Public read access (leaderboard is public)
DO $$ BEGIN
  CREATE POLICY "Leaderboard entries are viewable by everyone"
  ON public.leaderboard_entries
  FOR SELECT
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Leaderboard meta is viewable by everyone"
  ON public.leaderboard_meta
  FOR SELECT
  USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No public write policies (writes only via service role in backend)

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_leaderboard_entries_updated_at ON public.leaderboard_entries;
CREATE TRIGGER set_leaderboard_entries_updated_at
BEFORE UPDATE ON public.leaderboard_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_leaderboard_meta_updated_at ON public.leaderboard_meta;
CREATE TRIGGER set_leaderboard_meta_updated_at
BEFORE UPDATE ON public.leaderboard_meta
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();