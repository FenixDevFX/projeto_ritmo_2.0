const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function viaGenius(q, key) {
  try {
    const r = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(q)}&per_page=5`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j = await r.json();
    if (!r.ok) console.log("Genius:", r.status, JSON.stringify(j.meta || {}));
    return ((j.response && j.response.hits) || [])
      .filter((h) => h.type === "song")
      .map((h) => ({ title: h.result.title, artist: h.result.primary_artist && h.result.primary_artist.name, fonte: h.result.url }));
  } catch (e) {
    return [];
  }
}

async function viaDeezer(q) {
  try {
    const d = (await (await fetch(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(q)}`)).json()).data || [];
    return d.map((x) => ({
      title: x.title,
      artist: x.artist && x.artist.name,
      album: x.album && x.album.title,
      cover: x.album && x.album.cover_medium,
      preview: x.preview,
      link: x.link,
    }));
  } catch (e) {
    return [];
  }
}

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").trim().slice(0, 120);
  if (q.length < 4) return res.status(400).json({ error: "Digite um trecho um pouco maior." });
  const key = process.env.GENIUS_ACCESS_TOKEN;

  const [g, d] = await Promise.all([key ? viaGenius(q, key) : [], viaDeezer(q)]);

  // alterna as duas fontes para que nenhuma ocupe todas as vagas; duplicadas são fundidas
  const idx = new Map(), out = [];
  for (let i = 0; i < 3; i++) {
    for (const list of [g, d]) {
      const t = list[i];
      if (!t) continue;
      const k = norm(t.title) + norm((t.artist || "").split(",")[0]);
      if (idx.has(k)) {
        const e = idx.get(k);
        for (const f in t) if (!e[f]) e[f] = t[f];
        continue;
      }
      idx.set(k, t);
      out.push(t);
    }
  }
  if (!out.length) console.log("Sem resultados para:", q);

  const results = await Promise.all(out.map(async (o) => {
    if (o.cover) return o;
    try {
      const dq = encodeURIComponent(`artist:"${o.artist || ""}" track:"${o.title}"`);
      const x = ((await (await fetch(`https://api.deezer.com/search?limit=1&q=${dq}`)).json()).data || [])[0];
      if (x) { o.cover = x.album && x.album.cover_medium; o.preview = x.preview; o.link = x.link; }
    } catch (e) {}
    return o;
  }));
  res.status(200).json({ results });
};
