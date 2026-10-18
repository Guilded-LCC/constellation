revoke all on public.message_replies, public.message_threads, public.thread_replies from public, anon, authenticated;
revoke all on function public.app_message_relations(text,jsonb) from public, anon;
grant execute on function public.app_message_relations(text,jsonb) to authenticated;
notify pgrst,'reload schema';
