// server_fixed.js

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Пути к файлам
const DATA_FILE = path.join(__dirname, 'posts.json');
const UPLOAD_DIR = path.join(__dirname, 'images', 'uploads');

// Создаём папку для загрузок, если нет
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Middleware для JSON и urlencoded
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));

// Статические файлы
app.use(express.static(__dirname));
app.use('/images/uploads', express.static(UPLOAD_DIR));

// --------------------
// Вспомогательные функции
// --------------------
function readPosts() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch (e) {
    console.error('readPosts error', e);
    return [];
  }
}

function writePosts(posts) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
  } catch (e) {
    console.error('writePosts error', e);
  }
}

// --------------------
// API: Получить все посты
// --------------------
app.get('/api/posts', (req, res) => {
  const posts = readPosts();
  res.json(posts);
});

// --------------------
// API: Загрузка изображения и создание поста
// --------------------
app.post('/api/upload', (req, res) => {
  try {
    const { imageData, caption, location, coauthors, meta, filter, username } = req.body;
    if (!imageData) return res.status(400).json({ error: 'no imageData' });

    const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'invalid image data' });

    const mime = match[1];
    const ext = mime.split('/')[1] || 'jpg';
    const buffer = Buffer.from(match[2], 'base64');
    const filename = `${Date.now()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, buffer);

    const posts = readPosts();
    const id = Date.now();
    const post = {
      id,
      url: `/images/uploads/${filename}`,
      likes: 0,
      modalComments: [],
      username: username || '@me',
      caption: caption || '',
      location: location || '',
      coauthors: coauthors || [],
      meta: meta || {},
      filter: filter || 'none',
      created: Date.now(),
    };
    posts.unshift(post);
    writePosts(posts);

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// --------------------
// API: Лайк/дизлайк поста
// --------------------
app.post('/api/posts/:id/like', (req, res) => {
  const id = parseInt(req.params.id);
  const delta = parseInt(req.body.delta) || 0;

  const posts = readPosts();
  const p = posts.find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: 'not found' });

  p.likes = Math.max(0, (p.likes || 0) + delta);
  writePosts(posts);

  res.json({ id: p.id, likes: p.likes });
});

// --------------------
// API: Комментарий
// --------------------
app.post('/api/posts/:id/comment', (req, res) => {
  const id = parseInt(req.params.id);
  const { user, text } = req.body;
  if (!text) return res.status(400).json({ error: 'empty comment' });

  const posts = readPosts();
  const p = posts.find((x) => x.id === id);
  if (!p) return res.status(404).json({ error: 'not found' });

  p.modalComments = p.modalComments || [];
  p.modalComments.push({ user: user || '@me', text, likes: 0 });
  writePosts(posts);

  res.json({ ok: true, commentCount: p.modalComments.length });
});

// --------------------
// API: Очистка всех постов (dev только)
// --------------------
app.post('/api/posts/clear', (req, res) => {
  writePosts([]);
  res.json({ ok: true });
});

// --------------------
// Запуск сервера
// --------------------
app.listen(PORT, () => {
  console.log(`RuGram server listening on http://localhost:${PORT}`);
});
