module.exports = async (req, res) => {
  const key = process.env.GENIUS_ACCESS_TOKEN;
  if (!key) return res.status(500).json({ error: "Servidor ainda não configurado." });
  const q = String((req.query && req.query.q) || "").trim().slice(0, 120);
  if (q.length < 4) return res.status(400).json({ error: "Digite um trecho um pouco maior da letra." });

  let hits = [];
  try {
    const r = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(q)}&per_page=5`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j = await r.json();
    hits = ((j.response && j.response.hits) || []).filter((h) => h.type === "song").map((h) => h.result);
    if (!hits.length) console.log("Genius:", r.status, JSON.stringify(j.meta || {}));
  } catch (e) {
    return res.status(502).json({ error: "Falha ao falar com o serviço de letras." });
  }

  if (!hits.length) {
    try {
      const d = (await (await fetch(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(q)}`)).json()).data || [];
      return res.status(200).json({ results: d.map((x) => ({
        title: x.title,
        artist: x.artist && x.artist.name,
        album: x.album && x.album.title,
        cover: x.album && x.album.cover_medium,
        preview: x.preview,
        link: x.link,
      })) });
    } catch (e) {}
  }

  const results = await Promise.all(hits.slice(0, 5).map(async (t) => {
    const o = { title: t.title, artist: t.primary_artist && t.primary_artist.name, fonte: t.url };
    try {
      const dq = encodeURIComponent(`artist:"${o.artist || ""}" track:"${o.title}"`);
      const x = ((await (await fetch(`https://api.deezer.com/search?limit=1&q=${dq}`)).json()).data || [])[0];
      if (x) { o.cover = x.album && x.album.cover_medium; o.preview = x.preview; o.link = x.link; }
    } catch (e) {}
    return o;
  }));
  res.status(200).json({ results });
};
