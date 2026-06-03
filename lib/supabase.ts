import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://mock-project-id.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vY2stcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiZWF0IjoxNzcwMDAwMDAwfQ.mock-signature'
);
