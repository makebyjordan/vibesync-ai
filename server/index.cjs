
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());

// Initialize Database
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    createTables();
  }
});

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    timestamp INTEGER,
    mood TEXT,
    detectedGenre TEXT,
    tempo TEXT,
    data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    timestamp INTEGER,
    content TEXT,
    relatedAnalysisId TEXT
  )`);
}

// Routes for History
app.get('/api/history', (req, res) => {
  db.all('SELECT * FROM history ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    // Parse data back to JSON
    const history = rows.map(row => {
      const data = JSON.parse(row.data);
      return { ...data, id: row.id, timestamp: row.timestamp };
    });
    res.json(history);
  });
});

app.post('/api/history', (req, res) => {
  const { id, timestamp, mood, detectedGenre, tempo, ...rest } = req.body;
  const data = JSON.stringify({ id, timestamp, mood, detectedGenre, tempo, ...rest });

  const sql = `INSERT INTO history (id, timestamp, mood, detectedGenre, tempo, data) VALUES (?, ?, ?, ?, ?, ?)`;
  const params = [id, timestamp, mood, detectedGenre, tempo, data];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'success', id: this.lastID });
  });
});

// Routes for Notes
app.get('/api/notes', (req, res) => {
  db.all('SELECT * FROM notes ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/notes', (req, res) => {
  const { id, timestamp, content, relatedAnalysisId } = req.body;
  const sql = `INSERT INTO notes (id, timestamp, content, relatedAnalysisId) VALUES (?, ?, ?, ?)`;
  const params = [id, timestamp, content, relatedAnalysisId];

  db.run(sql, params, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'success', id: this.lastID });
  });
});

app.delete('/api/notes/:id', (req, res) => {
  const sql = 'DELETE FROM notes WHERE id = ?';
  db.run(sql, req.params.id, function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.json({ message: 'deleted', changes: this.changes });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
