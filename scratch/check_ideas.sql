-- Check ideas table structure and add missing columns
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ideas' ORDER BY ordinal_position;
