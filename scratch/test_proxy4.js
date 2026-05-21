var url = "https://corsproxy.io/?" + encodeURIComponent("https://ppehttbtrlavnrytoweu.supabase.co/rest/v1/ideas?select=id&limit=1");
fetch(url, {
  headers: {
    apikey: "sb_publishable_9uAFLjS4AaElHus4hiUuQQ_PMSFNkb8",
    Authorization: "Bearer sb_publishable_9uAFLjS4AaElHus4hiUuQQ_PMSFNkb8"
  }
}).then(r => r.json()).then(console.log).catch(console.error);
