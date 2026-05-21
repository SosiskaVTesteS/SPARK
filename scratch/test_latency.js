const https = require('https');

function measureLatency(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, (res) => {
      // Consume response data to free up memory
      res.on('data', () => {});
      res.on('end', () => {
        const end = Date.now();
        resolve({
          status: res.statusCode,
          time: end - start,
          error: null
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        status: null,
        time: Date.now() - start,
        error: e.message
      });
    });

    // Timeout after 15 seconds
    req.setTimeout(15000, () => {
      req.destroy(new Error('Timeout'));
    });
  });
}

async function run() {
  console.log("Measuring latency to Supabase API...\n");
  
  const directUrl = "https://ppehttbtrlavnrytoweu.supabase.co/rest/v1/ideas?select=id&limit=1";
  const proxyUrl = "https://spark-supabase-proxy.mtsoppe1.workers.dev/rest/v1/ideas?select=id&limit=1";

  // Measure Proxy
  console.log("Testing Proxy (Cloudflare Worker)...");
  const proxyResult = await measureLatency(proxyUrl);
  console.log(`Proxy Result: Status: ${proxyResult.status}, Time: ${proxyResult.time}ms`);
  if (proxyResult.error) console.log(`Proxy Error: ${proxyResult.error}`);
  console.log("");

  // Measure Direct
  console.log("Testing Direct (Supabase)...");
  const directResult = await measureLatency(directUrl);
  console.log(`Direct Result: Status: ${directResult.status}, Time: ${directResult.time}ms`);
  if (directResult.error) console.log(`Direct Error: ${directResult.error}`);
}

run();
