create or replace function public.react_to_idea(
  p_idea_id uuid,
  p_emoji text,
  p_increment int
) returns jsonb as $$
declare
  v_current_reactions jsonb;
  v_current_count int;
  v_new_reactions jsonb;
begin
  -- Get current reactions with row lock
  select coalesce(reactions, '{}'::jsonb)
  into v_current_reactions
  from public.ideas
  where id = p_idea_id
  for update;

  if not found then
    raise exception 'Idea not found';
  end if;

  -- Calculate new count
  v_current_count := coalesce((v_current_reactions->>p_emoji)::int, 0);
  v_current_count := greatest(0, v_current_count + p_increment);

  -- Update jsonb
  v_new_reactions := jsonb_set(
    v_current_reactions,
    array[p_emoji],
    to_jsonb(v_current_count)
  );

  -- Save back to table
  update public.ideas
  set reactions = v_new_reactions
  where id = p_idea_id;

  return v_new_reactions;
end;
$$ language plpgsql security definer;
