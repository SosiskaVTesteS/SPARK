-- Migration: Set messages table REPLICA IDENTITY to FULL to ensure DELETE event payloads include old row data for RLS evaluation
ALTER TABLE public.messages REPLICA IDENTITY FULL;

COMMIT;
