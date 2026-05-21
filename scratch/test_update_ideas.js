require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const file = fs.readFileSync('assets/js/config.js', 'utf8');
const urlMatch = file.match(/SUPABASE_URL:\s*'([^']+)'/);
const keyMatch = file.match(/SUPABASE_ANON_KEY:\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function test() {
  const { data: ideas } = await supabase.from('ideas').select('id, reactions').limit(1);
  if (ideas && ideas.length > 0) {
    const idea = ideas[0];
    console.log("Idea:", idea);
    
    // Try to update using anon key
    const { data, error } = await supabase.from('ideas').update({ reactions: { '🔥': 5 } }).eq('id', idea.id).select();
    console.log("Update result:", data, error);
  }
}

test();
