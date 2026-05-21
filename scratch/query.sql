SELECT routine_name, data_type FROM information_schema.routines WHERE routine_name = 'invest_in_idea';
SELECT proname, proargnames, pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'invest_in_idea';
