// Мобильное меню: свайп для закрытия
function setupMobileMenu(){
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if(!btn || !sidebar) return;
  let backdrop = document.querySelector('.mobile-backdrop');
  if(!backdrop){ backdrop = document.createElement('div'); backdrop.className='mobile-backdrop'; document.body.appendChild(backdrop); }

  function open(){ sidebar.classList.add('mobile-open'); backdrop.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function close(){ sidebar.classList.remove('mobile-open'); backdrop.classList.remove('show'); document.body.style.overflow = ''; }

  btn.addEventListener('click', (e)=>{ e.stopPropagation(); if(sidebar.classList.contains('mobile-open')) close(); else open(); });
  backdrop.addEventListener('click', ()=>{ close(); });
  document.querySelectorAll('.menu-items a').forEach(a=> a.addEventListener('click', ()=>{ if(window.innerWidth <= 900) close(); }));

  // свайп влево для закрытия
  let touchStartX = null;
  sidebar.addEventListener('touchstart', e=>{
    if(e.touches.length===1) touchStartX = e.touches[0].clientX;
  });
  sidebar.addEventListener('touchmove', e=>{
    if(touchStartX!==null && e.touches.length===1){
      const dx = e.touches[0].clientX - touchStartX;
      if(dx < -60){ close(); touchStartX=null; }
    }
  });
  sidebar.addEventListener('touchend', ()=>{ touchStartX=null; });
}
// Search index cache for faster suggestions (global)
let searchIndex = { users: [], postsByUser: [], postsByCaption: [] };
// Функция для переключения темы
function toggleTheme() {
    const body = document.body;
    const themeButton = document.querySelector('.theme-toggle button i');
  // Search index cache declared globally (see top-level variable)
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        themeButton.className = 'fas fa-moon';
    } else {
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        themeButton.className = 'fas fa-sun';
    }
    // Keep Tailwind dark mode in sync (Tailwind configured with darkMode: 'class')
    if(document && document.documentElement){
      if(body.classList.contains('dark-theme')) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    }
    
  // Swap logo depending on theme
  const logoImg = document.querySelector('.logo-img');
  if(logoImg){ logoImg.src = body.classList.contains('dark-theme') ? 'images/logo2.png' : 'images/logo.png'; }
  // Добавляем анимацию для иконки
  themeButton.style.transform = 'rotate(360deg)';
  setTimeout(() => {
    themeButton.style.transform = '';
  }, 300);
}

// Применяем сохраненную тему при загрузке
document.addEventListener('DOMContentLoaded', async () => {
  // apply saved theme
  const savedTheme = localStorage.getItem('theme');
  const themeIcon = document.querySelector('.theme-toggle button i');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    if(document && document.documentElement) document.documentElement.classList.add('dark');
    if(themeIcon) themeIcon.className = 'fas fa-sun';
  } else {
    if(document && document.documentElement) document.documentElement.classList.remove('dark');
    if(themeIcon) themeIcon.className = 'fas fa-moon';
  }

  // No authentication: init app immediately, await initial data load to avoid flash of empty feed
  await initApp();

  // Setup handlers for new post modal (drag'n'drop, file input, preview)
  setupNewPostHandlers();
  // Setup search handlers so search works immediately
  initSearchHandlers();
  // Setup emoji picker for post caption (создание поста)
  setupEmojiPickerFor('emoji-btn','emoji-picker','post-caption');
  // Setup mobile menu toggle
  setupMobileMenu();
  // Attach robust handler for modal like button (ensure it works after DOM changes)
  const mbtn = document.getElementById('modal-like-heart');
  if(mbtn){
    mbtn.onclick = null;
    mbtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(!currentModalPost) return;
      const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
      const idx = liked.indexOf(currentModalPost.id);
      if(idx >= 0){
        // unlike
        currentModalPost.likes = Math.max(0, currentModalPost.likes - 1);
        liked.splice(idx,1);
        mbtn.classList.remove('liked');
      } else {
        // like
        currentModalPost.likes = (currentModalPost.likes || 0) + 1;
        liked.push(currentModalPost.id);
        mbtn.classList.add('liked');
      }
      localStorage.setItem('likedPosts', JSON.stringify(liked));
      const likesSpan = document.getElementById('modal-likes'); if(likesSpan) likesSpan.textContent = currentModalPost.likes;
      updateLikesInPost(currentModalPost);
      // persist like to server (best-effort)
      (async ()=>{ try{ const delta = JSON.parse(localStorage.getItem('likedPosts')||'[]').includes(currentModalPost.id) ? 1 : -1; await fetch(`/api/posts/${currentModalPost.id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }) }); await loadStoredPhotos(); }catch(err){ console.error('persist modal like', err); } })();
    });
  }
});

// Adjust modal image area size based on viewport to better fit mobile screens
function adjustModalImageSize(){
  const modal = document.getElementById('post-modal');
  if(!modal || modal.style.display === 'none') return;
  const media = modal.querySelector('.modal-media');
  const info = modal.querySelector('.modal-info');
  if(!media) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  // allocate about 55% of viewport to image on small screens, but leave space for header/inputs
  const imageArea = Math.floor(Math.min(vh * 0.65, vh - 120));
  media.style.maxHeight = imageArea + 'px';
  const img = media.querySelector('img'); if(img){ img.style.maxHeight = '100%'; img.style.width = 'auto'; }
  if(info) info.style.maxHeight = (vh - imageArea - 40) + 'px';
}

window.addEventListener('resize', ()=>{ adjustModalImageSize(); });

// Гарантированная инициализация emoji picker для комментариев после открытия модального окна поста
function ensureModalEmojiPicker() {
  // Удаляем старый picker, если был
  const picker = document.getElementById('emoji-picker-modal');
  if (picker) picker.innerHTML = '';
  setupEmojiPickerFor('emoji-btn-modal','emoji-picker-modal','modal-comment-input');
}

// Переопределяем openPostModal чтобы инициализировать emoji picker после открытия модального окна
const _openPostModal = openPostModal;
openPostModal = function(post) {
  _openPostModal(post);
  setTimeout(ensureModalEmojiPicker, 0); // после рендера DOM
}

// Emoji picker factory: attach to a button, picker container and input/textarea
function setupEmojiPickerFor(btnId, pickerId, inputId){
  const btn = document.getElementById(btnId);
  const picker = document.getElementById(pickerId);
  const input = document.getElementById(inputId);
  if(!btn || !picker || !input) return;
  // grouped emoji categories (без битых символов)
  const groups = {
    'Smileys': ['😀','😁','😂','🤣','😅','😊','😇','🙂','😉','😍','😘','🤩','😜','🤪','🥰','😋','😎','😏','😢','😭','😡','😱','😴','🤗','🤔','😇','🥳'],
    'People': ['👋','🤝','👏','🙌','👍','👎','🙏','💪','🤲','🧑','👨','👩','🧑‍🎓','🧑‍💻','👩‍🎤','👨‍🚀','🧑‍🚒','🧑‍🍳','🧑‍🔬','🧑‍🏫','🧑‍⚕️'],
    'Nature': ['🌸','🌼','🌻','🌲','🌳','🌴','🌵','🌊','🔥','☀️','🌧️','❄️','🌈','🌙','⭐','🌞','🌦️','🌪️','🌋','🪐'],
    'Food': ['🍏','🍎','🍊','🍌','🍉','🍓','🍕','🍔','🍟','🍣','🍩','🍪','🍫','🍿','🍦','🍰','🥗','🍔','🍜','🍣','🍺'],
    'Activities': ['⚽','🏀','🏈','🎾','🎮','🎲','🏆','🎯','🎳','🎸','🎤','🎹','🎻','🥁','🎬','🎨','🎭','🎮','🏹','🏓'],
    'Objects': ['📱','💻','⌚','📷','🔑','💡','🔒','🎁','💼','📚','🖊️','🖼️','📦','🛒','🚗','🚲','🛴','🛵','✈️','🚀'],
    'Symbols': ['❤️','💔','✨','⭐','🔥','⚡','✔️','❌','🎵','🔔','💯','🔝','🔞','🆗','🆒','🆕','🆓','🆙','🆚','🈳']
  };

  picker.innerHTML = '';
  // tabs с анимацией
  const tabs = document.createElement('div'); tabs.className = 'emoji-tabs';
  Object.keys(groups).forEach((name, idx)=>{
    const t = document.createElement('button'); t.type='button'; t.className='emoji-tab'; t.textContent = name;
    if(idx===0) t.classList.add('active');
    t.addEventListener('click', ()=>{
      tabs.querySelectorAll('.emoji-tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      renderGroup(name);
    });
    tabs.appendChild(t);
  });
  picker.appendChild(tabs);

  const list = document.createElement('div'); list.className='emoji-list'; picker.appendChild(list);

  function renderGroup(name){
    list.innerHTML = '';
    groups[name].forEach(e=>{
      const b=document.createElement('button'); b.type='button'; b.className='emoji-btn'; b.textContent=e;
      b.onclick = (ev)=>{ ev.preventDefault(); insertAtCursor(input, e); input.focus(); };
      list.appendChild(b);
    });
  }
  // initial render
  renderGroup(Object.keys(groups)[0]);

  // toggle picker visibility with smart positioning (open down when possible)
  function positionAndShowPicker(){
    // make visible to measure
    picker.style.display = 'block';
    picker.style.position = 'fixed';
    picker.style.right = 'auto';
    picker.style.bottom = 'auto';
    picker.style.maxWidth = '320px';
    const btnRect = btn.getBoundingClientRect();
    const pkRect = picker.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;
    let top;
    if(spaceBelow >= pkRect.height + 8){
      // open downwards
      top = btnRect.bottom + 6;
    } else if(spaceAbove >= pkRect.height + 8){
      // open upwards
      top = btnRect.top - pkRect.height - 6;
    } else {
      // default: open down but clamp
      top = Math.min(window.innerHeight - pkRect.height - 8, btnRect.bottom + 6);
      top = Math.max(8, top);
    }
    let left = btnRect.left;
    // clamp horizontally
    if(left + pkRect.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pkRect.width - 8);
    picker.style.left = left + 'px';
    picker.style.top = top + 'px';
    btn.setAttribute('aria-expanded','true');
  }

  function hidePicker(){ picker.style.display='none'; btn.setAttribute('aria-expanded','false'); }

  btn.addEventListener('click', (e)=>{ e.stopPropagation(); if(picker.style.display === 'block') hidePicker(); else positionAndShowPicker(); });
  btn.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); btn.click(); }
    if(e.key==='Escape' && picker.style.display==='block'){ hidePicker(); }
  });
  // close picker on outside click
  document.addEventListener('click', (ev)=>{ if(!picker.contains(ev.target) && ev.target !== btn){ picker.style.display='none'; } });
}

function insertAtCursor(input, text){
  // works for input and textarea
  input.focus();
  if(typeof input.selectionStart === 'number'){
    const start = input.selectionStart; const end = input.selectionEnd;
    const value = input.value;
    input.value = value.slice(0,start) + text + value.slice(end);
    const pos = start + text.length;
    input.selectionStart = input.selectionEnd = pos;
  } else {
    input.value += text;
  }
}

// Инициализация приложения (рендеры) после успешной аутентификации
async function initApp(){
  // load persisted photos into posts/myPosts, then render
  await loadStoredPhotos();
  renderStories();
  renderSuggestions();
  showPage('feed');
  // ensure logo matches current theme on init
  const savedTheme = localStorage.getItem('theme');
  const logoImg = document.querySelector('.logo-img');
  if(logoImg){ logoImg.src = (savedTheme === 'dark') ? 'images/logo2.png' : 'images/logo.png'; }
  // build search index for faster lookups
  buildSearchIndex();
}

function buildSearchIndex(){
  searchIndex.users = usernames.map(u=>u.toLowerCase());
  searchIndex.postsByUser = posts.map(p=>({ id:p.id, username:(p.username||'').toLowerCase(), raw: p }));
  searchIndex.postsByCaption = posts.map(p=>({ id:p.id, caption:(p.caption||'').toLowerCase(), raw: p }));
}

// Mobile menu toggle setup
function setupMobileMenu(){
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if(!btn || !sidebar) return;
  // create backdrop
  let backdrop = document.querySelector('.mobile-backdrop');
  if(!backdrop){ backdrop = document.createElement('div'); backdrop.className='mobile-backdrop'; document.body.appendChild(backdrop); }

  function open(){ sidebar.classList.add('mobile-open'); backdrop.classList.add('show'); document.body.style.overflow = 'hidden'; }
  function close(){ sidebar.classList.remove('mobile-open'); backdrop.classList.remove('show'); document.body.style.overflow = ''; }

  btn.addEventListener('click', (e)=>{ e.stopPropagation(); if(sidebar.classList.contains('mobile-open')) close(); else open(); });
  backdrop.addEventListener('click', ()=>{ close(); });
  // close sidebar when navigating to a page
  document.querySelectorAll('.menu-items a').forEach(a=> a.addEventListener('click', ()=>{ if(window.innerWidth <= 900) close(); }));
}

// Authentication removed: app works for demo without users.

const usernames = ["Alice","Bob","Charlie","Dave","Eve","Mike","Sara","Tom","Lisa","John"];
const captions = [
  "Какой красивый день!",
  "Люблю это место",
  "Мой новый пост",
  "Ничего не может быть лучше",
  "Всем привет!",
  "Потрясающий закат",
  "С друзьями весело",
  "Новые впечатления",
  "Солнечное настроение",
  "Мечты сбываются"
];

const myUsername = "@mentos";

// Генерация случайных комментариев
function generateRandomComments(){
  const randomUsers = ["@Alice52","@Bob34","@Charlie12","@Eve99"];
  const randomTexts = ["Супер!","Красиво!","Обожаю это место","Вау!"];
  const arr = [];
  const num = Math.floor(Math.random()*2)+2;
  for(let i=0;i<num;i++){
    arr.push({user: randomUsers[Math.floor(Math.random()*randomUsers.length)], text: randomTexts[Math.floor(Math.random()*randomTexts.length)], likes: Math.floor(Math.random()*20)});
  }
  return arr;
}

// Посты ленты и профиля
// posts are loaded from localStorage (shared per-app instance). If none exist, start empty.
let posts = [], myPosts = [];

async function loadStoredPhotos(){
  try{
    const res = await fetch('/api/posts');
    if(!res.ok) throw new Error('fetch posts failed');
    const data = await res.json();
    posts = Array.isArray(data) ? data : [];
    myPosts = posts.filter(p => (p.username||'') === myUsername);
    // render after loading so UI reflects persisted posts
    renderFeed(); renderProfile();
  }catch(err){ console.error('loadStoredPhotos error', err); posts = []; myPosts = []; }
}

// utility to clear all stored posts (removes localStorage and clears arrays)
function clearAllPosts(){
  localStorage.removeItem('photos');
  posts = [];
  myPosts = [];
  renderFeed(); renderProfile();
  console.log('All posts cleared.');
}
// expose to console if user wants to call it
window.clearAllPosts = clearAllPosts;

let currentModalPost = null;

// Показ страницы
function showPage(pageId){
  // Скрываем все страницы
  document.querySelectorAll('.page').forEach(p=>p.style.display='none');
  document.getElementById(pageId).style.display='flex';
  
  // Обновляем активное состояние в меню
  document.querySelectorAll('.menu-items a').forEach(link => {
    link.classList.remove('active');
    if(link.getAttribute('data-page') === pageId) {
      link.classList.add('active');
    }
  });
  
  renderFeed(); 
  renderProfile();
}

// Рендер ленты
function renderFeed(){
  const feed=document.getElementById('posts'); feed.innerHTML='';
  posts.forEach(post=>{
    const div=document.createElement('div'); div.className='post'; div.setAttribute('data-id', post.id);
    div.innerHTML=`<img src="${post.url}"><div class="info"><strong>${post.username}</strong>: ${post.caption}</div><div class="actions"><button>❤️ ${post.likes}</button><button>💬 ${post.modalComments.length}</button></div>`;
    feed.appendChild(div);
  });
  addFeedHandlers();
}

// Рендер сторис
function renderStories(){
  const container = document.getElementById('stories');
  if(!container) return;
  container.innerHTML = '';
  // создадим несколько тестовых сторис
  for(let i=1;i<=6;i++){
    const name = (usernames[i-1] || 'user') + String(i);
    const div = document.createElement('div'); div.className='story';
    div.innerHTML = `<div class="ring"><img src="https://picsum.photos/seed/story${i}/100/100" alt="${name}"></div><small>${name}</small>`;
    container.appendChild(div);
  }
}

// Рендер рекомендаций в правой колонке
function renderSuggestions(){
  const list = document.getElementById('suggestions-list');
  if(!list) return;
  list.innerHTML = '';
  for(let i=1;i<=6;i++){
    const uname = 'user' + (100+i);
    const div = document.createElement('div'); div.className='suggestion';
    div.innerHTML = `<img src="https://picsum.photos/seed/sug${i}/80/80" alt="${uname}"><div class="s-info"><div class="s-name">${uname}</div><div class="s-desc">Рекомендации для вас</div></div><a href="#" class="s-action">Подписаться</a>`;
    list.appendChild(div);
  }
}

// Рендер профиля
function renderProfile(){
  const profile=document.getElementById('my-posts'); profile.innerHTML='';
  document.querySelector('#profile h2').textContent=`Мой профиль ${myUsername}`;
  myPosts.forEach(post=>{
    const div=document.createElement('div'); div.className='post'; div.setAttribute('data-id', post.id);
    div.innerHTML=`<img src="${post.url}"><div class="info"><strong>${post.username}</strong>: ${post.caption}</div><div class="actions"><button>❤️ ${post.likes}</button><button>💬 ${post.modalComments.length}</button></div>`;
    profile.appendChild(div);
  });
  addProfileHandlers();
}

// Модальное окно
function renderModalComments(){
  const container=document.getElementById('modal-comments'); container.innerHTML='';
  // сначала добавим подпись автора как первый элемент
  const captionDiv = document.createElement('div');
  captionDiv.className = 'comment caption';
  captionDiv.innerHTML = `<strong>${currentModalPost.username}</strong>: ${currentModalPost.caption}`;
  container.appendChild(captionDiv);

  // ensure modalComments exists
  currentModalPost.modalComments = currentModalPost.modalComments || [];

  currentModalPost.modalComments.forEach((c,i)=>{
    const div=document.createElement('div');
    div.className = 'comment';
    // comment header + actions
    const likedComments = JSON.parse(localStorage.getItem('likedComments') || '[]');
    const key = `${currentModalPost.id}:${i}`;
    const isLiked = likedComments.includes(key);
    // build HTML: user, text, like button (toggle), reply button, reply input placeholder, replies list
    div.innerHTML = `
      <div class="comment-row"><span><strong>${c.user}</strong>: ${c.text}</span>
        <span style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <button class="c-like" data-idx="${i}">${isLiked? '💔' : '❤️'} ${c.likes}</button>
          <button class="c-reply" data-idx="${i}">Ответить</button>
        </span>
      </div>
      <div id="reply-input-${i}" class="reply-input" style="display:none; margin-top:6px;">
        <input id="reply-text-${i}" class="modal-reply-field" placeholder="Добавьте комментарий...">
        <button data-idx="${i}" class="reply-send">Отправить</button>
      </div>
      <div class="replies" id="replies-${i}" style="margin-left:12px; margin-top:6px;"></div>
    `;
    container.appendChild(div);

    // render existing replies (one level)
    const repliesContainer = div.querySelector(`#replies-${i}`);
    if(c.replies && c.replies.length){
      c.replies.forEach((r,j)=>{
        const rd = document.createElement('div'); rd.className='reply';
        rd.innerHTML = `<small><strong>${r.user}</strong>: ${r.text}</small>`;
        repliesContainer.appendChild(rd);
      });
    }
  });

  // attach event handlers for comment like & reply buttons
  container.querySelectorAll('.c-like').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const idx = parseInt(btn.getAttribute('data-idx'));
      toggleCommentLike(idx);
    });
  });
  container.querySelectorAll('.c-reply').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const idx = parseInt(btn.getAttribute('data-idx'));
      const box = document.getElementById(`reply-input-${idx}`);
      if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
    });
  });
  container.querySelectorAll('.reply-send').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const idx = parseInt(btn.getAttribute('data-idx'));
      const input = document.getElementById(`reply-text-${idx}`);
      if(input && input.value.trim()){
        submitReply(idx, input.value.trim());
        input.value = '';
      }
    });
  });

  document.getElementById('modal-likes').textContent=currentModalPost.likes;
}

function likeModalComment(i){ 
  // legacy: not used now, kept for compatibility
  currentModalPost.modalComments[i].likes++;
  renderModalComments();
  updateLikesInPost(currentModalPost);
}

// Toggle like for a comment (by index)
function toggleCommentLike(i){
  if(!currentModalPost) return;
  const key = `${currentModalPost.id}:${i}`;
  const liked = JSON.parse(localStorage.getItem('likedComments') || '[]');
  const comment = currentModalPost.modalComments[i];
  if(!comment) return;
  const idx = liked.indexOf(key);
  if(idx>=0){
    // unlike
    comment.likes = Math.max(0, comment.likes-1);
    liked.splice(idx,1);
  } else {
    // like
    comment.likes++;
    liked.push(key);
  }
  localStorage.setItem('likedComments', JSON.stringify(liked));
  renderModalComments();
  // persist comment likes to server
  (async ()=>{
    try{
      await fetch(`/api/posts/${currentModalPost.id}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modalComments: currentModalPost.modalComments }) });
      await loadStoredPhotos();
    }catch(e){ console.error('persist comment-like error', e); }
  })();
}

// Submit a reply to comment index i
function submitReply(i, text){
  if(!currentModalPost) return;
  const comment = currentModalPost.modalComments[i];
  if(!comment) return;
  comment.replies = comment.replies || [];
  comment.replies.push({ user: myUsername, text: text, likes: 0 });
  renderModalComments();
  // persist reply to server
  (async ()=>{
    try{
      await fetch(`/api/posts/${currentModalPost.id}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modalComments: currentModalPost.modalComments }) });
      await loadStoredPhotos();
    }catch(e){ console.error('persist reply error', e); }
  })();
}

document.getElementById('modal-like-heart').onclick=function(){ 
  if(!currentModalPost) return;
  const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
  const mbtn = document.getElementById('modal-like-heart');
  if(liked.includes(currentModalPost.id)){
    // unlike
    currentModalPost.likes = Math.max(0, currentModalPost.likes-1);
    const idx = liked.indexOf(currentModalPost.id); if(idx>=0) liked.splice(idx,1);
    localStorage.setItem('likedPosts', JSON.stringify(liked));
    if(mbtn){ mbtn.disabled=false; mbtn.style.opacity=1; }
  } else {
    // like
    currentModalPost.likes++;
    liked.push(currentModalPost.id);
    localStorage.setItem('likedPosts', JSON.stringify(liked));
    if(mbtn){ mbtn.disabled=false; mbtn.style.opacity=1; }
  }
  renderModalComments(); 
  // persist like to server
  (async ()=>{
    try{
      const delta = JSON.parse(localStorage.getItem('likedPosts')||'[]').includes(currentModalPost.id) ? 1 : -1;
      await fetch(`/api/posts/${currentModalPost.id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }) });
      await loadStoredPhotos();
      renderModalComments();
    }catch(e){ console.error('like persist error', e); }
  })();
}

// Обновляем число лайков на кнопках поста
function updateLikesInPost(post){
  document.querySelectorAll(`.post[data-id='${post.id}']`).forEach(div=>{
    const likeBtn = div.querySelector('.actions button:nth-child(1)');
    likeBtn.textContent = `❤️ ${post.likes}`;
  });
}

// Открытие модального окна
function openPostModal(post){
  currentModalPost=post;
  document.getElementById('modal-img').src=post.url;
  document.getElementById('modal-username').textContent=post.username;
  // caption теперь отображается в списке комментариев как первый элемент
  post.modalComments = post.modalComments || generateRandomComments();
  renderModalComments();
  // disable modal like if already liked
  const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
  const mbtn = document.getElementById('modal-like-heart');
  // set thumbnail and like button state
  const thumb = document.getElementById('modal-thumb');
  if(thumb) thumb.src = post.url;
  if(mbtn){
    // show like control on small screens; hide on large
    try{ if(window.innerWidth <= 900) mbtn.style.display = 'inline-block'; else mbtn.style.display = 'none'; }catch(e){ mbtn.style.display = 'none'; }
    if(liked.includes(post.id)) mbtn.classList.add('liked'); else mbtn.classList.remove('liked');
  }
  // update likes counter in modal
  const likesSpan = document.getElementById('modal-likes'); if(likesSpan) likesSpan.textContent = post.likes;
  document.getElementById('post-modal').style.display='flex';
}

function closePostModal(){ 
  document.getElementById('post-modal').style.display='none'; 
  currentModalPost=null; 
}

// Добавление комментария в модальном окне
document.getElementById('modal-comment-btn').onclick=function(){
  const input=document.getElementById('modal-comment-input'); 
  const text=input.value.trim();
  if(text && currentModalPost){ 
    // persist comment to server then refresh posts
    (async ()=>{
      try{
        await fetch(`/api/posts/${currentModalPost.id}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: myUsername, text }) });
        input.value=''; 
        await loadStoredPhotos();
        // re-open modal for this post
        const p = posts.find(p=>p.id===currentModalPost.id);
        if(p) openPostModal(p);
      }catch(e){ console.error('persist comment error', e); alert('Не удалось отправить комментарий'); }
    })();
  }
}

// Обработчики для ленты
function addFeedHandlers(){
  document.querySelectorAll('#posts .post').forEach(postDiv=>{
    const img = postDiv.querySelector('img');
    const commentBtn = postDiv.querySelector('.actions button:nth-child(2)');
    const likeBtn = postDiv.querySelector('.actions button:nth-child(1)');
    const postId = parseInt(postDiv.getAttribute('data-id'));
    const post = posts.find(p=>p.id===postId);
    if(!post) return;

    img.onclick = ()=>openPostModal(post);
    commentBtn.onclick = ()=>{ openPostModal(post); setTimeout(()=>{ const inp = document.getElementById('modal-comment-input'); if(inp) inp.focus(); }, 80); };
    // mark liked state from storage
    // mark liked state from storage (visual only)
    const likedNow = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    if(likedNow.includes(post.id)){
      likeBtn.classList.add('liked');
    }
    likeBtn.textContent = `❤️ ${post.likes}`;
    likeBtn.onclick = (e)=>{
      e.stopPropagation();
      const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
      const idx = liked.indexOf(post.id);
      if(idx>=0){
        // unlike
        post.likes = Math.max(0, post.likes-1);
        liked.splice(idx,1);
        likeBtn.classList.remove('liked');
      } else {
        // like
        post.likes++;
        liked.push(post.id);
        likeBtn.classList.add('liked');
      }
      localStorage.setItem('likedPosts', JSON.stringify(liked));
      likeBtn.textContent = `❤️ ${post.likes}`;
      // persist to server
      (async ()=>{
        try{
          const delta = JSON.parse(localStorage.getItem('likedPosts')||'[]').includes(post.id) ? 1 : -1;
          await fetch(`/api/posts/${post.id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }) });
          await loadStoredPhotos();
        }catch(e){ console.error('persist like error', e); }
      })();
      if(currentModalPost && currentModalPost.id===post.id){
        document.getElementById('modal-likes').textContent = post.likes;
        const mbtn = document.getElementById('modal-like-heart'); if(mbtn){ if(liked.includes(post.id)) mbtn.classList.add('liked'); else mbtn.classList.remove('liked'); }
      }
    };
  });
}

// Обработчики для профиля
function addProfileHandlers(){
  document.querySelectorAll('#my-posts .post').forEach(postDiv=>{
    const img = postDiv.querySelector('img');
    const commentBtn = postDiv.querySelector('.actions button:nth-child(2)');
    const likeBtn = postDiv.querySelector('.actions button:nth-child(1)');
    const postId = parseInt(postDiv.getAttribute('data-id'));
    const post = myPosts.find(p=>p.id===postId);
    if(!post) return;

    img.onclick = ()=>openPostModal(post);
    commentBtn.onclick = ()=>{ openPostModal(post); setTimeout(()=>{ const inp = document.getElementById('modal-comment-input'); if(inp) inp.focus(); }, 80); };
    const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
    if(liked.includes(post.id)){
      likeBtn.classList.add('liked');
    }
    likeBtn.onclick = (e)=>{
      e.stopPropagation();
      const liked = JSON.parse(localStorage.getItem('likedPosts') || '[]');
      const idx = liked.indexOf(post.id);
      if(idx>=0){
        post.likes = Math.max(0, post.likes-1);
        liked.splice(idx,1);
        likeBtn.classList.remove('liked');
      } else {
        post.likes++;
        liked.push(post.id);
        likeBtn.classList.add('liked');
      }
      localStorage.setItem('likedPosts', JSON.stringify(liked));
      likeBtn.textContent = `❤️ ${post.likes}`;
      if(currentModalPost && currentModalPost.id===post.id){
        document.getElementById('modal-likes').textContent = post.likes;
        const mbtn = document.getElementById('modal-like-heart'); if(mbtn){ if(liked.includes(post.id)) mbtn.classList.add('liked'); else mbtn.classList.remove('liked'); }
      }
    };
  });
}

// Новый пост
// Новый пост: откр/закр + обработка файла (drag'n'drop, preview, resize)
function openNewPost(){
  const modal = document.getElementById('new-post-modal');
  if(modal) {
    modal.style.display='flex';
    modal.classList.remove('create-hide');
    modal.classList.add('create-show');
    setTimeout(()=>{
      modal.classList.remove('create-show');
    }, 260);
  }
  // ensure upload area visible and preview reset so user can create multiple posts
  const uploadArea = document.getElementById('upload-area'); if(uploadArea) uploadArea.style.display = 'block';
  const previewArea = document.getElementById('preview-area'); if(previewArea) previewArea.style.display = 'none';
  const cropCanvas = document.getElementById('crop-canvas'); if(cropCanvas){ const ctx=cropCanvas.getContext('2d'); ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height); }
  // hide mobile bottom nav while creating post for better UX
}
function closeNewPost(){
  const modal = document.getElementById('new-post-modal');
  if(modal) {
    modal.classList.remove('create-show');
    modal.classList.add('create-hide');
    setTimeout(()=>{ modal.style.display='none'; modal.classList.remove('create-hide'); }, 260);
  }
  // reset preview
  const previewArea = document.getElementById('preview-area');
  if(previewArea) previewArea.style.display='none';
  const cropCanvas = document.getElementById('crop-canvas'); if(cropCanvas){ const ctx=cropCanvas.getContext('2d'); ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height); }
  const fileInput = document.getElementById('new-post-file'); if(fileInput) fileInput.value='';
  const caption = document.getElementById('post-caption'); if(caption) caption.value='';
  const loc = document.getElementById('post-location'); if(loc) loc.value='';
  const co = document.getElementById('post-coauthors'); if(co) co.value='';
  const mentionBox = document.getElementById('mention-suggestions'); if(mentionBox) mentionBox.style.display='none';
  // show upload area again so user can add another photo next time
  const uploadArea = document.getElementById('upload-area'); if(uploadArea) uploadArea.style.display = 'block';
  window.__processedImageDataURL = null;
  // mobile bottom nav should remain visible at all times (handled by CSS)
}

// Setup handlers for the upload area and processing
function setupNewPostHandlers(){
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('new-post-file');
  const chooseBtn = document.getElementById('choose-file-btn');
  const previewArea = document.getElementById('preview-area');
  const cropCanvas = document.getElementById('crop-canvas');
  const cropSelection = document.getElementById('crop-selection');
  const cropBtn = document.getElementById('crop-btn');
  const resetBtn = document.getElementById('reset-btn');
  const filterList = document.getElementById('filter-list');
  const addBtn = document.getElementById('add-post-btn');
  const captionInput = document.getElementById('post-caption');
  const locationInput = document.getElementById('post-location');
  const coauthorsInput = document.getElementById('post-coauthors');
  const mentionBox = document.getElementById('mention-suggestions');
  const advHideLikes = document.getElementById('adv-hide-likes');
  const advDisableComments = document.getElementById('adv-disable-comments');
  const advAutoThreads = document.getElementById('adv-auto-threads');

  if(!uploadArea || !fileInput || !chooseBtn || !previewArea || !cropCanvas || !addBtn) return;

  let originalImage = null; // full-resolution Image object
  let currentFilter = 'none';
  let cropRect = null; // {x,y,w,h} in canvas coords

  chooseBtn.onclick = ()=> fileInput.click();

  // drag'n'drop поддержка
  uploadArea.addEventListener('dragover', (e)=>{ e.preventDefault(); uploadArea.classList.add('dragging'); });
  uploadArea.addEventListener('dragleave', ()=>{ uploadArea.classList.remove('dragging'); });
  uploadArea.addEventListener('drop', (e)=>{
    e.preventDefault(); uploadArea.classList.remove('dragging');
    const files = e.dataTransfer.files;
    if(files && files.length) handleFileForPost(files[0]);
  });

  // клик по области drag'n'drop открывает выбор файла
  uploadArea.addEventListener('click', (e)=>{
    if(e.target === uploadArea) fileInput.click();
  });

  fileInput.addEventListener('change', (e)=>{
    const files = e.target.files;
    if(files && files.length) handleFileForPost(files[0]);
  });

  // filters
  if(filterList){
    filterList.addEventListener('click', (e)=>{
      const item = e.target.closest('.filter-item'); if(!item) return;
      filterList.querySelectorAll('.filter-item').forEach(i=>i.classList.remove('active'));
      item.classList.add('active');
      currentFilter = item.getAttribute('data-filter') || 'none';
      // apply both canvas filter (for exported image) and CSS preview filter
      drawCanvas();
      try{ cropCanvas.style.filter = getFilterStyle(currentFilter); }catch(e){}
      // при выборе фильтра — включаем поля (назад в workflow)
      try{ enablePostFields(); }catch(err){}
    });
  }

  // advanced panel toggle (smooth open/close)
  const advToggle = document.getElementById('adv-toggle');
  const advPanel = document.getElementById('advanced-panel');
  if(advToggle && advPanel){
    advToggle.addEventListener('click', ()=>{
      advPanel.classList.toggle('open');
      advPanel.classList.toggle('collapsed');
    });
  }

  // simple crop selection using mouse on canvas
  let isSelecting=false, selStart={x:0,y:0};
  cropCanvas.addEventListener('mousedown', (e)=>{
    if(!originalImage) return;
    isSelecting=true; selStart = getMousePos(e);
    cropSelection.style.display='block';
    cropSelection.style.left = selStart.x + 'px'; cropSelection.style.top = selStart.y + 'px';
    cropSelection.style.width='0px'; cropSelection.style.height='0px';
  });
  // touch support for mobile
  cropCanvas.addEventListener('touchstart', (e)=>{
    if(!originalImage) return; e.preventDefault();
    const t = e.touches[0]; isSelecting=true; selStart = getClientPos(t.clientX, t.clientY);
    cropSelection.style.display='block';
    cropSelection.style.left = selStart.x + 'px'; cropSelection.style.top = selStart.y + 'px';
    cropSelection.style.width='0px'; cropSelection.style.height='0px';
  });
  window.addEventListener('mousemove', (e)=>{
    if(!isSelecting) return;
    const pos = getMousePos(e);
    const x = Math.min(pos.x, selStart.x), y = Math.min(pos.y, selStart.y);
    const w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y);
    cropSelection.style.left = x + 'px'; cropSelection.style.top = y + 'px';
    cropSelection.style.width = w + 'px'; cropSelection.style.height = h + 'px';
  });
  window.addEventListener('touchmove', (e)=>{
    if(!isSelecting) return; e.preventDefault(); const t = e.touches[0]; const pos = getClientPos(t.clientX, t.clientY);
    const x = Math.min(pos.x, selStart.x), y = Math.min(pos.y, selStart.y);
    const w = Math.abs(pos.x - selStart.x), h = Math.abs(pos.y - selStart.y);
    cropSelection.style.left = x + 'px'; cropSelection.style.top = y + 'px';
    cropSelection.style.width = w + 'px'; cropSelection.style.height = h + 'px';
  });
  window.addEventListener('mouseup', (e)=>{
    if(!isSelecting) return; isSelecting=false;
    const rect = cropSelection.getBoundingClientRect();
    const canvasRect = cropCanvas.getBoundingClientRect();
    // compute cropRect relative to canvas coordinates
    cropRect = { x: rect.left - canvasRect.left, y: rect.top - canvasRect.top, w: rect.width, h: rect.height };
    // clamp
    cropRect.x = Math.max(0, cropRect.x); cropRect.y = Math.max(0, cropRect.y);
    cropRect.w = Math.max(1, Math.min(cropRect.w, cropCanvas.width - cropRect.x));
    cropRect.h = Math.max(1, Math.min(cropRect.h, cropCanvas.height - cropRect.y));
  });

  cropBtn && cropBtn.addEventListener('click', ()=>{
    if(!originalImage) return;
    if(!cropRect){ alert('Выделите область для обрезки мышью на изображении'); return; }
    // map cropRect from canvas pixels to original image pixels
    const scaleX = originalImage.naturalWidth / cropCanvas.width;
    const scaleY = originalImage.naturalHeight / cropCanvas.height;
    const sx = Math.round(cropRect.x * scaleX);
    const sy = Math.round(cropRect.y * scaleY);
    const sw = Math.round(cropRect.w * scaleX);
    const sh = Math.round(cropRect.h * scaleY);
    // draw cropped to temp canvas and replace originalImage source
    const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle='#fff'; tctx.fillRect(0,0,sw,sh);
    tctx.drawImage(originalImage, sx, sy, sw, sh, 0,0,sw,sh);
    const data = tmp.toDataURL('image/jpeg', 0.9);
    // replace originalImage with cropped version
    const img2 = new Image(); img2.onload = ()=>{ originalImage = img2; drawCanvas(); cropSelection.style.display='none'; cropRect=null; };
    img2.src = data;
  });

  resetBtn && resetBtn.addEventListener('click', ()=>{ if(originalImage){ drawCanvas(true); cropSelection.style.display='none'; cropRect=null; } });

  // mention suggestions for coauthors
  if(coauthorsInput){
    coauthorsInput.addEventListener('input', (e)=>{
      const val = coauthorsInput.value;
      const atIndex = val.lastIndexOf('@');
      if(atIndex===-1){ mentionBox.style.display='none'; return; }
      const query = val.substring(atIndex+1).toLowerCase();
      const matches = usernames.filter(u=>u.toLowerCase().startsWith(query));
      if(matches.length===0){ mentionBox.style.display='none'; return; }
      mentionBox.innerHTML = '';
      matches.forEach(m=>{
        const d = document.createElement('div'); d.textContent = '@'+m; d.onclick = ()=>{
          // replace token after last @
          const before = val.substring(0, atIndex);
          coauthorsInput.value = before + '@' + m + ' ';
          mentionBox.style.display='none';
        };
        mentionBox.appendChild(d);
      });
      // position box under input
      mentionBox.style.display='block';
    });
    document.addEventListener('click', (e)=>{ if(!coauthorsInput.contains(e.target) && !mentionBox.contains(e.target)) mentionBox.style.display='none'; });
  }

  // Создание поста вынесено в функцию, чтобы гарантированно вызывать её (fallback при делегировании)
  async function createPostFromEditor(){
    if(!originalImage){ alert('Выберите изображение'); return; }
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = cropRect ? Math.round(cropRect.w) : cropCanvas.width;
    finalCanvas.height = cropRect ? Math.round(cropRect.h) : cropCanvas.height;
    const fctx = finalCanvas.getContext('2d');
  if(currentFilter && currentFilter!=='none') fctx.filter = getFilterStyle(currentFilter);
    if(cropRect){
      const scaleX = originalImage.naturalWidth / cropCanvas.width;
      const scaleY = originalImage.naturalHeight / cropCanvas.height;
      const sx = Math.round(cropRect.x * scaleX);
      const sy = Math.round(cropRect.y * scaleY);
      const sw = Math.round(cropRect.w * scaleX);
      const sh = Math.round(cropRect.h * scaleY);
      const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
      const tctx = tmp.getContext('2d'); tctx.fillStyle='#fff'; tctx.fillRect(0,0,sw,sh);
      tctx.drawImage(originalImage, sx, sy, sw, sh, 0,0,sw,sh);
      fctx.drawImage(tmp, 0,0, finalCanvas.width, finalCanvas.height);
    } else {
      fctx.drawImage(cropCanvas, 0,0, finalCanvas.width, finalCanvas.height);
    }
    const quality = window.innerWidth && window.innerWidth < 600 ? 0.8 : 0.9;
    const dataURL = finalCanvas.toDataURL('image/jpeg', quality);

    const caption = (captionInput && captionInput.value.trim()) || captions[Math.floor(Math.random()*captions.length)];
    const location = (locationInput && locationInput.value.trim()) || '';
    const coauthors = (coauthorsInput && coauthorsInput.value.trim()) ? coauthorsInput.value.trim().split(/\s+/).filter(s=>s.startsWith('@')) : [];
    const meta = { hideLikes: !!(advHideLikes && advHideLikes.checked), disableComments: !!(advDisableComments && advDisableComments.checked), autoThreads: !!(advAutoThreads && advAutoThreads.checked) };

    // send to server to persist
    try{
      const res = await fetch('/api/upload', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ imageData: dataURL, caption, location, coauthors, meta, filter: currentFilter, username: myUsername }) });
      if(!res.ok){
        // try to surface server error message
        let bodyText = '';
        try{ bodyText = await res.text(); }catch(e){}
        throw new Error(`upload failed: ${res.status} ${bodyText}`);
      }
  const saved = await res.json();
  // server returns post object; re-load posts from server to keep consistent state
  await loadStoredPhotos();
  closeNewPost();
  }catch(err){ console.error('upload error', err); alert('Ошибка загрузки. Попробуйте ещё раз.\n' + (err && err.message ? err.message : '')); }
  }

  // attach handler if button exists
  if(addBtn) addBtn.addEventListener('click', (e)=>{ e.stopPropagation(); createPostFromEditor(); });
  // fallback: delegate clicks on document (covers cases where handler wasn't attached)
  document.addEventListener('click', (e)=>{ if(e.target && e.target.id === 'add-post-btn'){ e.stopPropagation(); createPostFromEditor(); } });

  // helper: read file and draw to canvas
  function handleFileForPost(file){
    if(!file) return;
    if(!file.type.startsWith('image/')){ alert('Поддерживаются только изображения'); return; }
    const reader = new FileReader();
    reader.onload = function(ev){
      const img = new Image();
      img.onload = function(){
        originalImage = img;
        // choose max canvas size based on device width to avoid huge data URLs on mobile
        const viewportW = Math.max(360, (window.innerWidth || 640) - 80);
        const maxW = Math.min(1080, Math.max(640, viewportW)); const maxH = maxW;
        let w = img.width, h = img.height;
        const ratio = Math.min(maxW / w, maxH / h, 1);
        const canvasW = Math.round(w * ratio);
        const canvasH = Math.round(h * ratio);
        cropCanvas.width = canvasW; cropCanvas.height = canvasH;
        // draw
  drawCanvas(true);
  previewArea.style.display = 'block';
  // hide upload/select area and start editing immediately
  if(uploadArea) uploadArea.style.display = 'none';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // helper to translate client coordinates to canvas coordinates
  function getClientPos(clientX, clientY){
    const rect = cropCanvas.getBoundingClientRect();
    return { x: Math.round(clientX - rect.left), y: Math.round(clientY - rect.top) };
  }

  // adapt getMousePos to support both mouse and touch events
  function getMousePos(e){
    const rect = cropCanvas.getBoundingClientRect();
    const cx = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const cy = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    return { x: Math.round(cx - rect.left), y: Math.round(cy - rect.top) };
  }

  function drawCanvas(forceReset){
    if(!originalImage) return;
    const ctx = cropCanvas.getContext('2d');
    // scale original image to canvas size
    ctx.save();
    ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
  ctx.filter = currentFilter && currentFilter!=='none' ? getFilterStyle(currentFilter) : 'none';
    ctx.drawImage(originalImage, 0,0, originalImage.naturalWidth, originalImage.naturalHeight, 0,0, cropCanvas.width, cropCanvas.height);
    ctx.restore();
    if(forceReset){ cropSelection.style.display='none'; cropRect=null; }
  }

  function getMousePos(e){
    const rect = cropCanvas.getBoundingClientRect();
    return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
  }
}


function updateCommentsInPost(post){
  document.querySelectorAll(`.post[data-id='${post.id}']`).forEach(div=>{
    const commentBtn = div.querySelector('.actions button:nth-child(2)');
    commentBtn.textContent = `💬 ${post.modalComments.length}`;
  });
}

// Initialize search handlers so search works at load time
function initSearchHandlers(){
  const searchInput = document.getElementById('search-user');
  const searchResults = document.getElementById('search-results');
  if(!searchInput || !searchResults) return;
  let selectedIndex = -1;
  function clearSelection(){
    selectedIndex = -1; Array.from(searchResults.children).forEach(ch=>ch.classList.remove('search-selected'));
  }

  searchInput.addEventListener('input', ()=>{
    const value = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if(!value){ searchResults.style.display='none'; return; }
    const matches = [];
    // search usernames list
    usernames.forEach(u=>{ if(u.toLowerCase().includes(value)) matches.push({type:'user', name:u}); });
    // search posts usernames
    posts.forEach(p=>{ const uname = (p.username||'').replace(/^@/,''); if(uname.toLowerCase().includes(value)) matches.push({type:'post', name:p.username, postId:p.id}); });
    if(matches.length===0){ searchResults.style.display='none'; return; }
    matches.slice(0,20).forEach(m=>{
      const div=document.createElement('div'); div.className='search-item';
      if(m.type==='user'){
        div.textContent = '@' + m.name;
        div.onclick = ()=>{ showUserResults(m.name); searchResults.style.display='none'; };
      } else {
        div.textContent = m.name + ' — пост #' + m.postId;
        div.onclick = ()=>{ openPostModal(posts.find(p=>p.id===m.postId)); searchResults.style.display='none'; };
      }
      searchResults.appendChild(div);
    });
    // reset keyboard selection
    selectedIndex = -1; searchResults.style.display='block';
  });

  // keyboard navigation
  searchInput.addEventListener('keydown', (e)=>{
    const items = Array.from(searchResults.querySelectorAll('.search-item'));
    if(!items.length) return;
    if(e.key === 'ArrowDown'){
      e.preventDefault(); selectedIndex = Math.min(items.length-1, selectedIndex+1); updateSel();
    } else if(e.key === 'ArrowUp'){
      e.preventDefault(); selectedIndex = Math.max(0, selectedIndex-1); updateSel();
    } else if(e.key === 'Enter'){
      e.preventDefault(); if(selectedIndex>=0){ items[selectedIndex].click(); }
    } else if(e.key === 'Escape'){
      closeSearch();
    }
    function updateSel(){ items.forEach(it=>it.classList.remove('search-selected')); if(selectedIndex>=0){ items[selectedIndex].classList.add('search-selected'); items[selectedIndex].scrollIntoView({block:'nearest'}); } }
  });
  document.addEventListener('click', (e)=>{
    if(!searchInput.contains(e.target) && !searchResults.contains(e.target)){ searchResults.style.display='none'; }
  });
}

function openSearch(){ const modal=document.getElementById('search-modal'); if(!modal) return; modal.style.display='flex'; modal.classList.remove('search-hide'); modal.classList.add('search-show'); const inp=document.getElementById('search-user'); if(inp){ inp.focus(); inp.value=''; const ev = new Event('input'); inp.dispatchEvent(ev); } }
function closeSearch(){ const modal=document.getElementById('search-modal'); if(!modal) return; modal.classList.remove('search-show'); modal.classList.add('search-hide'); setTimeout(()=>{ modal.style.display='none'; modal.classList.remove('search-hide'); }, 260); }

function showUserResults(username){
  // show posts by user (filter feed)
  const uname = '@'+username;
  const feed = document.getElementById('posts'); if(!feed) return;
  feed.innerHTML='';
  const found = posts.filter(p=> (p.username||'').toLowerCase() === uname.toLowerCase() );
  if(found.length===0){ const div=document.createElement('div'); div.textContent = 'Постов пользователя не найдено'; feed.appendChild(div); return; }
  found.forEach(post=>{
    const div=document.createElement('div'); div.className='post'; div.setAttribute('data-id', post.id);
    div.innerHTML=`<img src="${post.url}"><div class="info"><strong>${post.username}</strong>: ${post.caption}</div><div class="actions"><button>❤️ ${post.likes}</button><button>💬 ${post.modalComments.length}</button></div>`;
    feed.appendChild(div);
  });
  addFeedHandlers(); showPage('feed');
}

// Запуск
showPage('feed');

document.getElementById('choose-file-btn').addEventListener('click', () => {
  document.getElementById('new-post-file').click();
});

const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('new-post-file');
let fileSelected = false; // флаг — уже загружен файл

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (fileSelected) return; // игнорируем, если уже файл выбран
  uploadArea.classList.add('dragging');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragging');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragging');
  if (fileSelected) return; // не позволяем добавить ещё
  const files = e.dataTransfer.files;
  handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (fileSelected) return; // игнорируем повторный выбор
  handleFiles(files);
});

function handleFiles(files) {
  if (files.length > 0) {
    const previewArea = document.getElementById('preview-area');
    const cropCanvas = document.getElementById('crop-canvas');
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
      const ctx = cropCanvas.getContext('2d');
      // Масштабируем изображение под ширину превью (макс 640px) чтобы не вылезало из модалки
      const MAX_WIDTH = 640;
      const scale = Math.min(1, MAX_WIDTH / img.width);
      cropCanvas.width = Math.round(img.width * scale);
      cropCanvas.height = Math.round(img.height * scale);
      ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
      ctx.drawImage(img, 0, 0, cropCanvas.width, cropCanvas.height);
      // Подстраиваем отображение canvas через CSS
      cropCanvas.style.width = '100%';
      cropCanvas.style.height = 'auto';
      previewArea.style.display = 'block';
      };
    };
    reader.readAsDataURL(file);
    // После успешной загрузки делаем недоступной область загрузки — нельзя добавить ещё
    reader.onloadend = () => {
      fileSelected = true;
      // Полностью скрываем область загрузки (убираем возможность добавить ещё)
      uploadArea.style.display = 'none';

      // Отключаем поля подписи/локации/эмодзи до выбора фильтра
      disablePostFields();
    };
  }
}

// Функции включения/отключения полей редактирования
function disablePostFields(){
  document.getElementById('post-caption').disabled = true;
  document.getElementById('post-location').disabled = true;
  const eb = document.getElementById('emoji-btn');
  if(eb){ eb.disabled = true; /* скрываем picker если открыт */ const pk = document.getElementById('emoji-picker'); if(pk) pk.style.display='none'; eb.setAttribute('aria-expanded','false'); }
  document.getElementById('add-post-btn').disabled = true;
}

function enablePostFields(){
  document.getElementById('post-caption').disabled = false;
  document.getElementById('post-location').disabled = false;
  document.getElementById('add-post-btn').disabled = false;
  const eb = document.getElementById('emoji-btn');
  if(eb){ eb.disabled = false; eb.setAttribute('aria-expanded','false'); }
  // ensure emoji picker is (re)initialized after enabling — in case listeners were not attached while disabled
  try{ setupEmojiPickerFor('emoji-btn','emoji-picker','post-caption'); }catch(e){ /* ignore */ }
}

// Изменение цвета сердечка при лайке
const likeButton = document.getElementById('modal-like-heart');

likeButton.addEventListener('click', () => {
  const likesCount = document.getElementById('modal-likes');
  if (likeButton.classList.contains('liked')) {
    likeButton.classList.remove('liked');
    likesCount.textContent = parseInt(likesCount.textContent) - 1;
  } else {
    likeButton.classList.add('liked');
    likesCount.textContent = parseInt(likesCount.textContent) + 1;
  }
});

// NOTE: filter handling lives inside setupNewPostHandlers to keep state consistent

function getFilterStyle(filter) {
  switch (filter) {
    case 'aden': return 'contrast(1.2) brightness(1.1) sepia(0.2)';
    case 'clarendon': return 'contrast(1.4) brightness(1.1)';
    case 'crema': return 'contrast(1.1) brightness(1.1) sepia(0.3)';
    case 'gingham': return 'contrast(1.1) brightness(0.9) sepia(0.2)';
    case 'juno': return 'contrast(1.3) brightness(1.2)';
    case 'lark': return 'contrast(1.2) brightness(1.1)';
    case 'ludwig': return 'contrast(1.1) brightness(1.2) sepia(0.2)';
    case 'moon': return 'grayscale(1) contrast(1.1)';
    case 'perpetua': return 'contrast(1.1) brightness(1.1) sepia(0.2)';
    case 'reyes': return 'contrast(1.1) brightness(1.1) sepia(0.3)';
    default: return 'none';
  }
}

// Ensure mobile bottom nav visibility on resize
window.addEventListener('resize', () => {
  const mbn = document.getElementById('mobile-bottom-nav');
  if(!mbn) return;
  if(window.innerWidth <= 900) mbn.style.display = 'flex';
  else mbn.style.display = '';
});

// When page loads ensure bottom nav is visible on small screens
document.addEventListener('DOMContentLoaded', ()=>{
  const mbn = document.getElementById('mobile-bottom-nav');
  if(!mbn) return;
  if(window.innerWidth <= 900) mbn.style.display = 'flex'; else mbn.style.display = '';
});

