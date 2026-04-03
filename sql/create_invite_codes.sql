-- invite_codes table for single-use invite codes
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES users(id) DEFAULT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT NULL,
  used boolean DEFAULT false NOT NULL,
  used_by uuid REFERENCES users(id) DEFAULT NULL,
  used_at timestamptz DEFAULT NULL
);

-- helpful index for lookup by code
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes (lower(code));

-- Example: create a sample code that expires in 7 days
-- INSERT INTO public.invite_codes (code, expires_at) VALUES ('MED-ABC123', now() + interval '7 days');
