import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

// Custom JWT sign helper using pure Deno Web Crypto (avoiding NPM dependency issues)
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const encodedHeader = btoa(JSON.stringify(jwtHeader)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedClaim = btoa(JSON.stringify(jwtClaim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = `${encodedHeader}.${encodedClaim}`;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(payload)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const assertion = `${payload}.${encodedSignature}`;

  const response = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });

  const resData = await response.json();
  if (resData.error) {
    throw new Error(`Google Auth error: ${resData.error_description || resData.error}`);
  }
  return resData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseCredsRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

  if (!supabaseUrl || !serviceKey || !firebaseCredsRaw) {
    console.error("Missing server env variables!");
    return json({ message: "Server configuration error" }, 500);
  }

  let firebaseCreds: any;
  try {
    firebaseCreds = JSON.parse(firebaseCredsRaw);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT secret:", e);
    return json({ message: "Invalid service account credential" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ message: "Invalid request body" }, 400);
  }

  const { type, table, record } = payload;
  console.log(`Received trigger event: ${type} on table ${table}`);

  if (table === "messages" && type === "INSERT") {
    const { channel_id, sender_id, sender_name, content } = record;

    try {
      // 1. Get other channel members
      const { data: members, error: mError } = await admin
        .from("channel_members")
        .select("user_id")
        .eq("channel_id", channel_id)
        .neq("user_id", sender_id);

      if (mError || !members || members.length === 0) {
        console.log("No other members in the channel to notify.");
        return json({ message: "No recipients" });
      }

      const recipientIds = members.map((m) => m.user_id);

      // 2. Fetch project/idea title if it exists
      let projectTitle = "SPARK";
      const { data: idea, error: iError } = await admin
        .from("ideas")
        .select("title")
        .eq("id", channel_id)
        .single();
      
      if (!iError && idea) {
        projectTitle = idea.title;
      }

      // 3. Fetch recipient tokens
      const { data: profiles, error: pError } = await admin
        .from("profiles")
        .select("id, fcm_token")
        .in("id", recipientIds);

      if (pError || !profiles || profiles.length === 0) {
        console.log("Could not find recipient profiles or tokens.");
        return json({ message: "No profiles found" });
      }

      // 4. Authenticate with Google / Firebase
      const fcmAccessToken = await getAccessToken(firebaseCreds);

      // 5. Send push notifications to all valid tokens
      let successCount = 0;
      for (const profile of profiles) {
        if (!profile.fcm_token) continue;

        const fcmPayload = {
          message: {
            token: profile.fcm_token,
            data: {
              type: "chat_message",
              sender_name: sender_name,
              project_title: projectTitle,
              body: content,
            },
          },
        };

        const fcmRes = await fetch(
          `https://fcm.googleapis.com/v1/projects/${firebaseCreds.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${fcmAccessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          }
        );

        if (fcmRes.ok) {
          successCount++;
        } else {
          const errText = await fcmRes.text();
          console.warn(`Failed to send push to user ${profile.id}:`, errText);
        }
      }

      console.log(`Push notifications sent successfully to ${successCount} recipients.`);
      return json({ success: true, count: successCount });
    } catch (e) {
      console.error("Error processing messages push webhook:", e);
      return json({ message: "Error processing notification", error: String(e) }, 500);
    }
  }

  return json({ message: "Ignored event" });
});
