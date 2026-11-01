let password = '';
let authToken = null;
let currentProjectSlug = null;
const isProduction = !['localhost', '127.0.0.1'].includes(location.hostname);

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function authHeaders() {
  if (authToken) return { 'Authorization': `Bearer ${authToken}` };
  return { 'X-Admin-Password': password };
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ── LOGIN ──

document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('password-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryLogin();
});

async function tryLogin() {
  password = document.getElementById('password-input').value;
  try {
    if (isProduction) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Invalid password');
      const data = await res.json();
      authToken = data.token;
    }
    await api('GET', '/projects');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    loadProjects();
  } catch {
    authToken = null;
    document.getElementById('login-error').textContent = 'Incorrect password';
    document.getElementById('login-error').classList.remove('hidden');
  }
}

// ── NAVIGATION ──

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${btn.dataset.section}`).classList.remove('hidden');

    if (btn.dataset.section === 'projects') loadProjects();
    if (btn.dataset.section === 'homepage') loadHomepageOrder();
    if (btn.dataset.section === 'ephemera') loadEphemera();
    if (btn.dataset.section === 'exhibitions') loadExhibitions();
  });
});

// ── PROJECTS ──

async function loadProjects() {
  const projects = await api('GET', '/projects');
  const list = document.getElementById('project-list');
  list.innerHTML = '';
  document.getElementById('project-editor').classList.add('hidden');
  list.classList.remove('hidden');

  for (const p of projects) {
    const thumb = p.images.length > 0 ? p.images[0].src : '';
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      ${thumb ? `<img class="list-item-thumb" src="${esc(thumb)}" onerror="this.style.display='none'">` : ''}
      <div class="list-item-info">
        <div class="list-item-title">${esc(p.title)}</div>
        <div class="list-item-meta">${esc(p.year)} &middot; ${p.images.length} images</div>
      </div>
    `;
    item.addEventListener('click', () => openProjectEditor(p.slug));
    list.appendChild(item);
  }
}

async function openProjectEditor(slug) {
  currentProjectSlug = slug;
  const project = await api('GET', `/project/${slug}`);
  document.getElementById('project-list').classList.add('hidden');
  document.getElementById('project-editor').classList.remove('hidden');

  document.getElementById('proj-title').value = project.title;
  document.getElementById('proj-year').value = project.year;
  document.getElementById('proj-summary').value = project.summary || '';

  renderProjectImages(project.images, slug);
}

function renderProjectImages(images, slug) {
  const container = document.getElementById('proj-images');
  container.innerHTML = '';

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const entry = document.createElement('div');
    entry.className = 'image-entry';
    entry.dataset.index = i;
    entry.innerHTML = `
      <img class="img-preview" src="${esc(img.src)}" onerror="this.style.display='none'">
      <div class="img-fields">
        <input type="text" placeholder="Image path" value="${esc(img.src)}" data-field="src">
        <input type="text" placeholder="Title" value="${esc(img.title)}" data-field="title">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <input type="text" placeholder="Medium" value="${esc(img.medium)}" data-field="medium">
          <input type="text" placeholder="Dimensions" value="${esc(img.dimensions)}" data-field="dimensions">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <input type="text" placeholder="Date" value="${esc(img.date)}" data-field="date">
          <input type="text" placeholder="Collection" value="${esc(img.collection || '')}" data-field="collection">
        </div>
      </div>
      <button class="btn-remove" title="Remove">&times;</button>
    `;

    entry.querySelector('.btn-remove').addEventListener('click', () => entry.remove());
    container.appendChild(entry);
  }
}

document.getElementById('btn-add-image').addEventListener('click', () => {
  const container = document.getElementById('proj-images');
  const slug = currentProjectSlug;
  const nextNum = container.children.length + 1;
  const padded = String(nextNum).padStart(2, '0');

  const entry = document.createElement('div');
  entry.className = 'image-entry';
  entry.innerHTML = `
    <div class="img-preview" style="background:#eee;width:80px;height:80px;border-radius:4px"></div>
    <div class="img-fields">
      <input type="text" placeholder="Image path" value="/assets/images/${slug}/${padded}.jpg" data-field="src">
      <input type="text" placeholder="Title" value="" data-field="title">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input type="text" placeholder="Medium" value="" data-field="medium">
        <input type="text" placeholder="Dimensions" value="" data-field="dimensions">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input type="text" placeholder="Date" value="" data-field="date">
        <input type="text" placeholder="Collection" value="" data-field="collection">
      </div>
    </div>
    <button class="btn-remove" title="Remove">&times;</button>
  `;

  entry.querySelector('.btn-remove').addEventListener('click', () => entry.remove());
  container.appendChild(entry);
  entry.querySelector('[data-field="title"]').focus();
});

document.getElementById('image-upload').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files.length) return;

  for (const file of files) {
    try {
      let result;
      if (isProduction) {
        const title = prompt(`Title for "${file.name}":`);
        if (title === null) continue;
        const formData = new FormData();
        formData.append('image', file);
        formData.append('metadata', JSON.stringify({
          title: title || '',
          medium: '',
          dimensions: '',
          date: '',
          collection: '',
        }));
        const res = await fetch(`/api/upload/${currentProjectSlug}`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Upload failed');
        }
        result = await res.json();
      } else {
        const res = await fetch(`/api/upload/${currentProjectSlug}?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: { 'X-Admin-Password': password },
          body: file,
        });
        result = await res.json();
      }
      if (result.ok) {
        toast(`Uploaded: ${file.name}`);
        openProjectEditor(currentProjectSlug);
      }
    } catch (err) {
      toast(`Upload failed: ${err.message}`);
    }
  }
  e.target.value = '';
});

document.getElementById('btn-save-project').addEventListener('click', async () => {
  const container = document.getElementById('proj-images');
  const images = [];

  for (const entry of container.children) {
    const img = {};
    entry.querySelectorAll('[data-field]').forEach(input => {
      img[input.dataset.field] = input.value.trim();
    });
    if (img.src) images.push(img);
  }

  const data = {
    title: document.getElementById('proj-title').value.trim(),
    year: document.getElementById('proj-year').value.trim(),
    summary: document.getElementById('proj-summary').value.trim() || undefined,
    layout: 'project.njk',
    images,
  };

  await api('PUT', `/project/${currentProjectSlug}`, data);
  toast('Project saved');
});

document.getElementById('btn-back-projects').addEventListener('click', loadProjects);

document.getElementById('btn-new-project').addEventListener('click', async () => {
  const title = prompt('Project title:');
  if (!title) return;
  const year = prompt('Year:') || '';
  const result = await api('POST', '/project', { title, year, images: [] });
  toast(`Created: ${title}`);
  openProjectEditor(result.slug);
});

// ── HOMEPAGE ORDER ──

let homepageData = [];

async function loadHomepageOrder() {
  homepageData = await api('GET', '/homepage-order');
  renderHomepageOrder();
}

function renderHomepageOrder() {
  const list = document.getElementById('homepage-list');
  list.innerHTML = '';

  for (let i = 0; i < homepageData.length; i++) {
    const p = homepageData[i];
    const item = document.createElement('div');
    item.className = 'sortable-item';
    item.draggable = true;
    item.dataset.index = i;
    item.innerHTML = `
      <span class="sortable-handle">&#9776;</span>
      ${p.thumbnail ? `<img class="list-item-thumb" src="${esc(p.thumbnail)}" onerror="this.style.display='none'">` : ''}
      <div class="list-item-info">
        <div class="list-item-title">${esc(p.title)}</div>
        <div class="list-item-meta">${esc(p.year)} &middot; ${esc(p.studio)}</div>
      </div>
    `;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', i);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => e.preventDefault());
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = i;
      if (fromIndex === toIndex) return;
      const moved = homepageData.splice(fromIndex, 1)[0];
      homepageData.splice(toIndex, 0, moved);
      renderHomepageOrder();
    });

    list.appendChild(item);
  }
}

document.getElementById('btn-save-homepage').addEventListener('click', async () => {
  await api('PUT', '/homepage-order', homepageData);
  toast('Homepage order saved');
});

// ── EPHEMERA ──

let ephemeraData = [];

async function loadEphemera() {
  ephemeraData = await api('GET', '/ephemera');
  renderEphemera();
}

function renderEphemera() {
  const list = document.getElementById('ephemera-list');
  list.innerHTML = '';

  for (let i = 0; i < ephemeraData.length; i++) {
    const item = ephemeraData[i];
    const entry = document.createElement('div');
    entry.className = 'ephemera-entry';
    entry.innerHTML = `
      <div class="entry-header" onclick="this.nextElementSibling.classList.toggle('collapsed')">
        ${(item.images && item.images[0]) ? `<img class="list-item-thumb" src="${esc(item.images[0])}" onerror="this.style.display='none'">` : ''}
        <h4 style="flex:1">${esc(item.title)} <span style="font-weight:normal;color:var(--text-light)">(${esc(item.date)})</span></h4>
        <div>
          <button class="btn danger btn-sm btn-delete-eph" data-index="${i}">&times;</button>
        </div>
      </div>
      <div class="entry-body">
        <div class="field-row">
          <div class="field">
            <label>Type</label>
            <select data-eph="${i}" data-field="type">
              ${['Announcement','Photograph','Catalogue','Review','Essay','Feature','Installation Photo','Installation Photos','Profile','Poster','Press Release','Interview']
                .map(t => `<option ${item.type === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Title</label>
            <input type="text" data-eph="${i}" data-field="title" value="${esc(item.title)}">
          </div>
        </div>
        <div class="field">
          <label>Date</label>
          <input type="text" data-eph="${i}" data-field="date" value="${esc(item.date)}">
        </div>
        <div class="field">
          <label>Primary Image Path</label>
          <input type="text" data-eph="${i}" data-field="primaryImage" value="${esc((item.images || [])[0] || '')}">
        </div>
        <div class="field">
          <label>Description</label>
          <textarea data-eph="${i}" data-field="description" rows="2">${esc(item.description || '')}</textarea>
        </div>
        <div class="field">
          <label>Text</label>
          <textarea data-eph="${i}" data-field="text" rows="3">${esc(Array.isArray(item.text) ? item.text.join('\n\n') : (item.text || ''))}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Download PDF Path</label>
            <input type="text" data-eph="${i}" data-field="download" value="${esc(item.download || '')}">
          </div>
          <div class="field">
            <label>External Link</label>
            <input type="text" data-eph="${i}" data-field="externalLink" value="${esc(item.externalLink || '')}">
          </div>
        </div>
      </div>
    `;

    entry.querySelector('.btn-delete-eph').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${item.title}"?`)) {
        ephemeraData.splice(i, 1);
        renderEphemera();
      }
    });

    list.appendChild(entry);
  }
}

document.getElementById('btn-add-ephemera').addEventListener('click', () => {
  ephemeraData.unshift({
    type: 'Announcement',
    title: 'New Entry',
    date: new Date().getFullYear().toString(),
    images: [],
    gallery: '',
    description: '',
    text: '',
    download: null,
    externalLink: null,
  });
  renderEphemera();
});

document.getElementById('btn-save-ephemera').addEventListener('click', async () => {
  document.querySelectorAll('[data-eph]').forEach(el => {
    const i = parseInt(el.dataset.eph);
    const field = el.dataset.field;
    if (field === 'primaryImage') {
      ephemeraData[i].images = el.value.trim() ? [el.value.trim()] : [];
    } else if (field === 'text') {
      const val = el.value.trim();
      ephemeraData[i].text = val.includes('\n\n') ? val.split('\n\n') : val;
    } else {
      ephemeraData[i][field] = el.value.trim() || null;
    }
  });

  await api('PUT', '/ephemera', ephemeraData);
  toast('Ephemera saved');
});

// ── EXHIBITIONS ──

let exhibitionsData = { shows: [], education: [] };

async function loadExhibitions() {
  exhibitionsData = await api('GET', '/exhibitions');
  renderExhibitions();
}

function renderExhibitions() {
  const list = document.getElementById('exhibitions-list');
  list.innerHTML = '';

  for (let i = 0; i < exhibitionsData.shows.length; i++) {
    const group = exhibitionsData.shows[i];
    const yearDiv = document.createElement('div');
    yearDiv.className = 'year-group';
    yearDiv.innerHTML = `
      <div class="year-header">
        <input type="text" class="year-input" value="${esc(group.year)}" data-year-index="${i}" style="width:100px;font-weight:700;font-size:15px;border:1px solid var(--border);border-radius:4px;padding:4px 8px">
        <div>
          <button class="btn secondary btn-sm btn-add-show" data-year="${i}">+ Show</button>
          <button class="btn danger btn-sm btn-delete-year" data-year="${i}">&times;</button>
        </div>
      </div>
      <div class="entries" data-year-entries="${i}"></div>
    `;

    const entriesDiv = yearDiv.querySelector(`[data-year-entries="${i}"]`);
    for (let j = 0; j < group.entries.length; j++) {
      const row = document.createElement('div');
      row.className = 'entry-row';
      row.innerHTML = `
        <input type="text" value="${esc(group.entries[j])}" data-show="${i}-${j}">
        <button class="btn-remove" data-remove-show="${i}-${j}">&times;</button>
      `;
      row.querySelector('.btn-remove').addEventListener('click', () => {
        group.entries.splice(j, 1);
        renderExhibitions();
      });
      entriesDiv.appendChild(row);
    }

    yearDiv.querySelector('.btn-add-show').addEventListener('click', () => {
      group.entries.push('');
      renderExhibitions();
    });

    yearDiv.querySelector('.btn-delete-year').addEventListener('click', () => {
      if (confirm(`Delete year ${group.year}?`)) {
        exhibitionsData.shows.splice(i, 1);
        renderExhibitions();
      }
    });

    list.appendChild(yearDiv);
  }

  const eduList = document.getElementById('education-list');
  eduList.innerHTML = '';
  for (let i = 0; i < exhibitionsData.education.length; i++) {
    const row = document.createElement('div');
    row.className = 'entry-row';
    row.style.marginBottom = '4px';
    row.innerHTML = `
      <input type="text" value="${esc(exhibitionsData.education[i])}" data-edu="${i}" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:4px;font-size:14px">
      <button class="btn-remove" data-remove-edu="${i}">&times;</button>
    `;
    row.querySelector('.btn-remove').addEventListener('click', () => {
      exhibitionsData.education.splice(i, 1);
      renderExhibitions();
    });
    eduList.appendChild(row);
  }
}

document.getElementById('btn-add-year').addEventListener('click', () => {
  const year = prompt('Year (e.g., 2026):');
  if (!year) return;
  exhibitionsData.shows.unshift({ year, entries: [''] });
  renderExhibitions();
});

document.getElementById('btn-add-education').addEventListener('click', () => {
  exhibitionsData.education.push('');
  renderExhibitions();
});

document.getElementById('btn-save-exhibitions').addEventListener('click', async () => {
  document.querySelectorAll('.year-input').forEach(el => {
    const i = parseInt(el.dataset.yearIndex);
    exhibitionsData.shows[i].year = el.value.trim();
  });

  document.querySelectorAll('[data-show]').forEach(el => {
    const [yi, si] = el.dataset.show.split('-').map(Number);
    exhibitionsData.shows[yi].entries[si] = el.value.trim();
  });

  exhibitionsData.shows.forEach(g => {
    g.entries = g.entries.filter(e => e);
  });

  document.querySelectorAll('[data-edu]').forEach(el => {
    const i = parseInt(el.dataset.edu);
    exhibitionsData.education[i] = el.value.trim();
  });
  exhibitionsData.education = exhibitionsData.education.filter(e => e);

  await api('PUT', '/exhibitions', exhibitionsData);
  toast('Exhibitions saved');
});
