const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const { ACR_HOST: host, ACR_ACCESS_KEY: key, ACR_ACCESS_SECRET: secret } = process.env;
  if (!host || !key || !secret) return res.status(500).json({ error: "Servidor ainda não configurado." });

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const audio = Buffer.concat(chunks);
  if (audio.length < 10000 || audio.length > 4e6) return res.status(400).json({ error: "Áudio inválido." });

  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac("sha1", secret)
    .update(["POST", "/v1/identify", key, "audio", "1", ts].join("\n"))
    .digest("base64");

  const f = new FormData();
  f.append("sample", new Blob([audio], { type: "audio/wav" }), "s.wav");
  f.append("sample_bytes", String(audio.length));
  f.append("access_key", key);
  f.append("data_type", "audio");
  f.append("signature_version", "1");
  f.append("signature", sig);
  f.append("timestamp", ts);

  let j;
  try {
    j = await (await fetch(`https://${host}/v1/identify`, { method: "POST", body: f })).json();
  } catch (e) {
    return res.status(502).json({ error: "Falha ao falar com o serviço de reconhecimento." });
  }

  const m = j.metadata || {};
  const hits = (m.humming || m.music || []).slice(0, 5);
  if (!hits.length) {
    console.log("ACRCloud status:", JSON.stringify(j.status));
    return res.status(200).json({ results: [] });
  }

  const results = await Promise.all(hits.map(async (h) => {
    const first = (h.artists && h.artists[0] && h.artists[0].name) || "";
    const o = {
      title: h.title,
      artist: (h.artists || []).map((a) => a.name).join(", "),
      album: h.album && h.album.name,
      year: (h.release_date || "").slice(0, 4),
    };
    try {
      const q = encodeURIComponent(`artist:"${first}" track:"${h.title}"`);
      const d = ((await (await fetch(`https://api.deezer.com/search?limit=1&q=${q}`)).json()).data || [])[0];
      if (d) { o.cover = d.album && d.album.cover_medium; o.preview = d.preview; o.link = d.link; }
    } catch (e) {}
    return o;
  }));
  res.status(200).json({ results });
};
