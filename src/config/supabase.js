import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fgzwmwrugerptfqfrsjd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnendtd3J1Z2VycHRmcWZyc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MjA2ODgsImV4cCI6MjA5MDI5NjY4OH0.vi4iEyxWL7vmrb5OLe0mwQ0ozwpyNMYFqSTJzpnT9SM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
