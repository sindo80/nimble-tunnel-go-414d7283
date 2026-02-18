
-- Create a function to get total user count (for public display)
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.profiles;
$$;

-- Add payment-related columns to orders for card-to-card
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payer_card_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email text;
