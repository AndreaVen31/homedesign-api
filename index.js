require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', app: 'Casa Mia API' }));

// ── GET /products — lista tutti i prodotti ───────────────────
app.get('/products', async (req, res) => {
  try {
    const { rows } = await db.getAll();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero dei prodotti' });
  }
});

// ── GET /products/:id — singolo prodotto ─────────────────────
app.get('/products/:id', async (req, res) => {
  try {
    const { rows } = await db.getById(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero del prodotto' });
  }
});

// ── POST /products — crea prodotto ───────────────────────────
app.post('/products', async (req, res) => {
  const { articolo } = req.body;
  if (!articolo?.trim()) {
    return res.status(400).json({ error: 'Il campo "articolo" è obbligatorio' });
  }
  try {
    const { rows } = await db.create(req.body);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nella creazione del prodotto' });
  }
});

// ── PUT /products/:id — aggiorna prodotto ────────────────────
app.put('/products/:id', async (req, res) => {
  const { articolo } = req.body;
  if (!articolo?.trim()) {
    return res.status(400).json({ error: 'Il campo "articolo" è obbligatorio' });
  }
  try {
    const { rows } = await db.update(req.params.id, req.body);
    if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'aggiornamento del prodotto' });
  }
});

// ── DELETE /products/:id — elimina prodotto ──────────────────
app.delete('/products/:id', async (req, res) => {
  try {
    const { rows } = await db.delete(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Prodotto non trovato' });
    res.json({ message: 'Prodotto eliminato', id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nell\'eliminazione del prodotto' });
  }
});

// ── Avvio ────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 API in ascolto su porta ${PORT}`));
});
