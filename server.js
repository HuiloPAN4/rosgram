const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));
  p.modalComments = p.modalComments || [];
  p.modalComments.push({ user: user||'@me', text: text, likes: 0 });
  writePosts(posts);
  res.json({ ok:true, commentCount: p.modalComments.length });
});

// API: clear posts (dangerous) - for dev convenience
app.post('/api/posts/clear', (req, res) => {
  writePosts([]);
  res.json({ ok:true });
});

app.listen(PORT, ()=>{
  console.log(`RuGram server listening on http://localhost:${PORT}`);
});
  }

  // Serve static site files
  app.use(express.static(__dirname));
  // Serve uploaded images
  app.use('/images/uploads', express.static(UPLOAD_DIR));

  // API: get posts
  app.get('/api/posts', (req, res) => {
    const posts = readPosts();
    res.json(posts);
  });

  // API: upload image (expects JSON with dataURL and metadata)
  app.post('/api/upload', async (req, res) => {
    try{
      const { imageData, caption, location, coauthors, meta, filter, username } = req.body;
      if(!imageData) return res.status(400).json({ error: 'no imageData' });
      // parse data url
      const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if(!match) return res.status(400).json({ error: 'invalid image data' });
      const mime = match[1]; const ext = mime.split('/')[1] || 'jpg';
      const b64 = match[2];
      const buffer = Buffer.from(b64, 'base64');
      const filename = `${Date.now()}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(filepath, buffer);

      const posts = readPosts();
      const id = Date.now();
      const post = { id, url: `/images/uploads/${filename}`, likes: 0, modalComments: [], username: username || '@me', caption: caption||'', location: location||'', coauthors: coauthors||[], meta: meta||{}, filter: filter||'none', created: Date.now() };
      posts.unshift(post);
      writePosts(posts);
      return res.json(post);
    }catch(err){ console.error(err); return res.status(500).json({ error: 'server error' }); }
  });

  // API: like (delta expected: +1 or -1)
  app.post('/api/posts/:id/like', (req, res) => {
    const id = parseInt(req.params.id);
    const delta = parseInt(req.body.delta) || 0;
    const express = require('express');
    const fs = require('fs');
    const path = require('path');

    const app = express();
    const PORT = process.env.PORT || 3000;

    app.use(express.json({ limit: '80mb' }));
    app.use(express.urlencoded({ extended: true, limit: '80mb' }));

    const DATA_FILE = path.join(__dirname, 'posts.json');
    const UPLOAD_DIR = path.join(__dirname, 'images', 'uploads');

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    function readPosts(){
      try{
        if(!fs.existsSync(DATA_FILE)) return [];
        return JSON.parse(fs.readFileSync(DATA_FILE,'utf8') || '[]');
      }catch(e){ console.error('readPosts error', e); return []; }
    }

    function writePosts(posts){
      try{ fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8'); }
      catch(e){ console.error('writePosts error', e); }
    }

    // Serve static site files
    app.use(express.static(__dirname));
    // Serve uploaded images
    app.use('/images/uploads', express.static(UPLOAD_DIR));

    // API: get posts
    app.get('/api/posts', (req, res) => {
      const posts = readPosts();
      res.json(posts);
    });

    // API: upload image (expects JSON with dataURL and metadata)
    app.post('/api/upload', async (req, res) => {
      try{
        const { imageData, caption, location, coauthors, meta, filter, username } = req.body;
        if(!imageData) return res.status(400).json({ error: 'no imageData' });
        // parse data url
        const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if(!match) return res.status(400).json({ error: 'invalid image data' });
        const mime = match[1]; const ext = mime.split('/')[1] || 'jpg';
        const b64 = match[2];
        const buffer = Buffer.from(b64, 'base64');
        const filename = `${Date.now()}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filepath, buffer);

        const posts = readPosts();
        const id = Date.now();
        const post = { id, url: `/images/uploads/${filename}`, likes: 0, modalComments: [], username: username || '@me', caption: caption||'', location: location||'', coauthors: coauthors||[], meta: meta||{}, filter: filter||'none', created: Date.now() };
        posts.unshift(post);
        writePosts(posts);
        return res.json(post);
      }catch(err){ console.error(err); return res.status(500).json({ error: 'server error' }); }
    });

    // API: like (delta expected: +1 or -1)
    app.post('/api/posts/:id/like', (req, res) => {
      const id = parseInt(req.params.id);
      const delta = parseInt(req.body.delta) || 0;
      const posts = readPosts();
      const p = posts.find(x=>x.id===id);
      if(!p) return res.status(404).json({ error: 'not found' });
      p.likes = Math.max(0, (p.likes||0) + delta);
      writePosts(posts);
      res.json({ id: p.id, likes: p.likes });
    });

    // API: comment
    app.post('/api/posts/:id/comment', (req, res) => {
      const id = parseInt(req.params.id);
      const { user, text } = req.body;
      if(!text) return res.status(400).json({ error: 'empty comment' });
      const posts = readPosts();
      const p = posts.find(x=>x.id===id);
      if(!p) return res.status(404).json({ error: 'not found' });
      p.modalComments = p.modalComments || [];
      p.modalComments.push({ user: user||'@me', text: text, likes: 0 });
      writePosts(posts);
      res.json({ ok:true, commentCount: p.modalComments.length });
    });

    // API: clear posts (dangerous) - for dev convenience
    app.post('/api/posts/clear', (req, res) => {
      writePosts([]);
      res.json({ ok:true });
    });

    app.listen(PORT, ()=>{
      console.log(`RuGram server listening on http://localhost:${PORT}`);
    });
