
-- Add receipt image URL column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_image_url text;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts
CREATE POLICY "Users can upload receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment-receipts' AND auth.uid() IS NOT NULL);

-- Allow public read access to receipts
CREATE POLICY "Receipts are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-receipts');
