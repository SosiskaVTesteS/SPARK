create or replace function public.debug_get_triggers()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'trigger_name', tg.tgname,
    'table_name', c.relname,
    'schema_name', n.nspname
  ))
  into v_result
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where c.relname in ('users', 'profiles');
  
  return coalesce(v_result, '[]'::jsonb);
end;
$$;
