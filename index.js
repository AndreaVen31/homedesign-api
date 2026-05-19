require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Cloudinary per le foto/documenti
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// ════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════
app.get('/', (req, res) => res.json({ status: 'ok', app: 'HomeDesign API v2' }));

// ════════════════════════════════════════════
// PRODOTTI (arredamento)
// ════════════════════════════════════════════
app.get('/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/products', async (req, res) => {
  const { tipo, ambiente, articolo, marca, modello, codice, note, preventivi, stato, preventivo_scelto } = req.body;
  if (!articolo?.trim()) return res.status(400).json({ error: 'Articolo obbligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (tipo,ambiente,articolo,marca,modello,codice,note,preventivi,stato,preventivo_scelto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [tipo, ambiente, articolo, marca, modello, codice, note, JSON.stringify(preventivi || []), stato || 'in_valutazione', preventivo_scelto]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/products/:id', async (req, res) => {
  const { tipo, ambiente, articolo, marca, modello, codice, note, preventivi, stato, preventivo_scelto } = req.body;
  if (!articolo?.trim()) return res.status(400).json({ error: 'Articolo obbligatorio' });
  try {
    const { rows } = await pool.query(
      `UPDATE products SET tipo=$1,ambiente=$2,articolo=$3,marca=$4,modello=$5,codice=$6,note=$7,
       preventivi=$8,stato=$9,preventivo_scelto=$10 WHERE id=$11 RETURNING *`,
      [tipo, ambiente, articolo, marca, modello, codice, note, JSON.stringify(preventivi || []), stato, preventivo_scelto, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Non trovato' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Non trovato' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════
// SCADENZE / TASK
// ════════════════════════════════════════════
app.get('/tasks', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY data_scadenza ASC NULLS LAST, created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/tasks', async (req, res) => {
  const { titolo, descrizione, categoria, data_scadenza, completato, priorita } = req.body;
  if (!titolo?.trim()) return res.status(400).json({ error: 'Titolo obbligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (titolo,descrizione,categoria,data_scadenza,completato,priorita)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [titolo, descrizione, categoria, data_scadenza || null, completato || false, priorita || 'media']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/tasks/:id', async (req, res) => {
  const { titolo, descrizione, categoria, data_scadenza, completato, priorita } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET titolo=$1,descrizione=$2,categoria=$3,data_scadenza=$4,completato=$5,priorita=$6
       WHERE id=$7 RETURNING *`,
      [titolo, descrizione, categoria, data_scadenza || null, completato, priorita, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Non trovato' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Non trovato' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════
// DOCUMENTI E FOTO
// ════════════════════════════════════════════
app.get('/documents', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM documents ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upload file su Cloudinary e salva riferimento nel DB
app.post('/documents', upload.single('file'), async (req, res) => {
  const { nome, cartella, note } = req.body;
  if (!req.file) return res.status(400).json({ error: 'File mancante' });
  try {
    // Carica su Cloudinary
    const uploaded = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: `homedesign/${cartella || 'Generale'}`, resource_type: 'auto' },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });
    // Salva nel DB
    const { rows } = await pool.query(
      `INSERT INTO documents (nome,cartella,tipo_file,url,public_id,dimensione,note)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nome || req.file.originalname, cartella || 'Generale', req.file.mimetype, uploaded.secure_url, uploaded.public_id, req.file.size, note]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/documents/:id', async (req, res) => {
  try {
    const { rows: docs } = await pool.query('SELECT public_id FROM documents WHERE id=$1', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'Non trovato' });
    // Elimina da Cloudinary
    if (docs[0].public_id) await cloudinary.uploader.destroy(docs[0].public_id, { resource_type: 'auto' });
    await pool.query('DELETE FROM documents WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════
// BUDGET
// ════════════════════════════════════════════
app.get('/budget', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM budget_settings ORDER BY ambito');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Upsert: crea o aggiorna budget per un ambito
app.post('/budget', async (req, res) => {
  const { ambito, tipo, budget_max, note } = req.body;
  if (!ambito || !tipo) return res.status(400).json({ error: 'Ambito e tipo obbligatori' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO budget_settings (ambito,tipo,budget_max,note) VALUES ($1,$2,$3,$4)
       ON CONFLICT (ambito) DO UPDATE SET tipo=EXCLUDED.tipo, budget_max=EXCLUDED.budget_max, note=EXCLUDED.note
       RETURNING *`,
      [ambito, tipo, budget_max, note]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/budget/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM budget_settings WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════
// AVVIO
// ════════════════════════════════════════════
initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 API HomeDesign v2 in ascolto su porta ${PORT}`));
});
