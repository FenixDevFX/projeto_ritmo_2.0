module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let d;
  try { d = JSON.parse(Buffer.concat(chunks).toString() || "{}"); }
  catch (e) { return res.status(400).json({ ok: false }); }

  const clip = (v, n) => String(v || "").slice(0, n);
  const row = {
    quando: new Date().toISOString(),
    modo: clip(d.modo, 10),
    consulta: clip(d.consulta, 120),
    resultado: clip(d.resultado, 12),
    escolhida: clip(d.escolhida, 160),
    esperada: clip(d.esperada, 160),
    lista: (Array.isArray(d.lista) ? d.lista : []).slice(0, 6).map((x) => clip(x, 160)),
  };
  console.log("FEEDBACK", JSON.stringify(row));

  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (url) {
    try { await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(row) }); }
    catch (e) {}
  }
  res.status(200).json({ ok: true });
};
