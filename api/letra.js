module.exports = async (req, res) => {
  const key = process.env.MUSIXMATCH_API_KEY;
  if (!key) return res.status(500).json({ error: "Servidor ainda não configurado." });
  const q = String((req.query && req.query.q) || "").trim().slice(0, 120);
  if (q.length < 4) return res.status(400).json({ error: "Digite um trecho um pouco maior da letra." });

  let hits = [];
  try {
    const url = `https://api.musixmatch.com/ws/1.1/track.search?q_lyrics=${encodeURIComponent(q)}&f_has_lyrics=1&s_track_rating=desc&page_size=5&apikey=${encodeURIComponent(key)}`;
    const j = await (await fetch(url)).json();
    const body = (j.message && j.message.body) || {};
    hits = (Array.isArray(body.track_list) ? body.track_list : []).map((t) => t.track);
    if (!hits.length) console.log("Musixmatch:", JSON.stringify(j.message && j.message.header));
  } catch (e) {
    return res.status(502).json({ error: "Falha ao falar com o serviço de letras." });
  }

  const results = await Promise.all(hits.slice(0, 5).map(async (t) => {
    const o = { title: t.track_name, artist: t.artist_name, album: t.album_name, fonte: t.track_share_url };
    try {
      const dq = encodeURIComponent(`artist:"${o.artist || ""}" track:"${o.title}"`);
      const x = ((await (await fetch(`https://api.deezer.com/search?limit=1&q=${dq}`)).json()).data || [])[0];
      if (x) { o.cover = x.album && x.album.cover_medium; o.preview = x.preview; o.link = x.link; }
    } catch (e) {}
    return o;
  }));
  res.status(200).json({ results });
};
