(function () {
  'use strict';

  let token = sessionStorage.getItem('admin_token') || '';
  let projects = [];
  let selectedFile = null;

  // --- API ---

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Authorization': 'Bearer ' + token },
    };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    const res = await fetch('/api' + path, opts);
    if (res.status === 401) {
      sessionStorage.removeItem('admin_token');
      token = '';
      showLogin();
      throw new Error('Session expired');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // --- Toast ---

  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.classList.add('hidden'); }, 4000);
  }

  // --- Login ---

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('password-input').focus();
  }

  function showApp() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    loadProjects();
  }

  async function handleLogin() {
    var pw = document.getElementById('password-input').value;
    var errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');

    try {
      var data = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      var result = await data.json();
      if (!data.ok) throw new Error(result.error || 'Login failed');
      token = result.token;
      sessionStorage.setItem('admin_token', token);
      showApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    }
  }

  // --- Navigation ---

  function switchSection(name) {
    document.querySelectorAll('.section').forEach(function (s) {
      s.classList.add('hidden');
    });
    document.getElementById('sec-' + name).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === name);
    });

    if (name === 'publish') loadPublishStatus();
    if (name === 'projects') renderProjectList();
  }

  // --- Projects ---

  async function loadProjects() {
    try {
      projects = await api('GET', '/projects');
      populateProjectDropdown();
      renderProjectList();
    } catch (e) {
      toast('Failed to load projects: ' + e.message, 'error');
    }
  }

  function populateProjectDropdown() {
    var select = document.getElementById('upload-project');
    select.innerHTML = '';

    var currentGroup = document.createElement('optgroup');
    currentGroup.label = 'Current Work';
    var catalogueGroup = document.createElement('optgroup');
    catalogueGroup.label = 'Catalogue';

    projects.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.slug;
      opt.textContent = p.title + ' (' + p.count + ' works)';
      if (p.section === 'current') {
        currentGroup.appendChild(opt);
      } else {
        catalogueGroup.appendChild(opt);
      }
    });

    if (currentGroup.children.length) select.appendChild(currentGroup);
    if (catalogueGroup.children.length) select.appendChild(catalogueGroup);
  }

  function renderProjectList() {
    var container = document.getElementById('project-list');
    container.innerHTML = '';

    projects.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'project-item';
      div.innerHTML =
        '<div class="project-item-info">' +
          '<div class="project-item-title">' + escapeHtml(p.title) + '</div>' +
          '<div class="project-item-meta">' + p.year + ' &middot; ' + p.count + ' works</div>' +
        '</div>' +
        '<span class="project-item-badge ' + (p.section === 'current' ? 'current' : '') + '">' +
          (p.section === 'current' ? 'Current' : 'Catalogue') +
        '</span>';
      container.appendChild(div);
    });
  }

  // --- File Upload ---

  function setupDropZone() {
    var zone = document.getElementById('drop-zone');
    var input = document.getElementById('file-input');

    zone.addEventListener('click', function () { input.click(); });

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', function () {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', function () {
      if (input.files.length) handleFileSelect(input.files[0]);
    });
  }

  function handleFileSelect(file) {
    if (!file.type.match(/^image\/jpe?g$/)) {
      toast('Please select a JPEG image', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Image is larger than 10MB. Export at 2000px, quality 80.', 'error');
      return;
    }

    selectedFile = file;
    var preview = document.getElementById('image-preview');
    var img = document.getElementById('preview-img');
    var info = document.getElementById('file-info');

    var reader = new FileReader();
    reader.onload = function (e) {
      img.src = e.target.result;
      preview.classList.remove('hidden');

      var tempImg = new Image();
      tempImg.onload = function () {
        info.textContent = file.name + ' · ' +
          tempImg.naturalWidth + ' x ' + tempImg.naturalHeight + 'px · ' +
          (file.size / 1024).toFixed(0) + ' KB';
      };
      tempImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

    updateUploadButton();
  }

  function updateUploadButton() {
    var btn = document.getElementById('btn-upload');
    var hasFile = selectedFile !== null;
    var hasTitle = document.getElementById('img-title').value.trim() !== '';
    var hasProject = document.getElementById('upload-project').value !== '';
    btn.disabled = !(hasFile && hasTitle && hasProject);
  }

  async function handleUpload() {
    var btn = document.getElementById('btn-upload');
    var errEl = document.getElementById('upload-error');
    errEl.classList.add('hidden');

    var slug = document.getElementById('upload-project').value;
    var metadata = {
      title: document.getElementById('img-title').value.trim(),
      medium: document.getElementById('img-medium').value.trim(),
      dimensions: document.getElementById('img-dimensions').value.trim(),
      date: document.getElementById('img-date').value.trim(),
      collection: document.getElementById('img-collection').value.trim(),
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving to repository...';

    try {
      var form = new FormData();
      form.append('image', selectedFile);
      form.append('metadata', JSON.stringify(metadata));

      var result = await api('POST', '/upload/' + slug, form);

      toast('Added "' + metadata.title + '" successfully. Preview will build in ~1 minute.', 'success');

      // Reset form
      selectedFile = null;
      document.getElementById('file-input').value = '';
      document.getElementById('image-preview').classList.add('hidden');
      document.getElementById('img-title').value = '';
      document.getElementById('img-dimensions').value = '';
      document.getElementById('img-collection').value = '';

      // Refresh project data
      loadProjects();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add to Collection';
      updateUploadButton();
    }
  }

  // --- Publish ---

  async function loadPublishStatus() {
    var statusEl = document.getElementById('publish-status');
    var actionsEl = document.getElementById('publish-actions');
    statusEl.textContent = 'Checking status...';
    statusEl.className = 'publish-status';
    actionsEl.classList.add('hidden');

    try {
      var status = await api('GET', '/status');

      if (status.ahead === 0) {
        statusEl.textContent = 'Everything is up to date. No unpublished changes.';
        statusEl.classList.add('up-to-date');
        actionsEl.classList.add('hidden');
        return;
      }

      statusEl.textContent = status.ahead + ' commit' + (status.ahead > 1 ? 's' : '') +
        ' ahead of production. ' + status.files.length + ' file' +
        (status.files.length !== 1 ? 's' : '') + ' changed.';
      statusEl.classList.add('has-changes');

      actionsEl.innerHTML = '';
      actionsEl.classList.remove('hidden');

      var previewLink = document.createElement('a');
      previewLink.href = '#';
      previewLink.textContent = 'Preview site';
      previewLink.title = 'Opens the dev branch preview deployment';
      previewLink.onclick = function (e) {
        e.preventDefault();
        toast('Check your Cloudflare Pages dashboard for the dev branch preview URL', '');
      };
      actionsEl.appendChild(previewLink);

      if (status.hasOpenPR) {
        var prLink = document.createElement('a');
        prLink.href = status.prUrl;
        prLink.target = '_blank';
        prLink.textContent = 'View Pull Request';
        actionsEl.appendChild(prLink);

        var mergeBtn = document.createElement('button');
        mergeBtn.className = 'btn primary btn-sm';
        mergeBtn.textContent = 'Merge & Deploy';
        mergeBtn.onclick = function () { handlePublish('merge'); };
        actionsEl.appendChild(mergeBtn);
      } else {
        var prBtn = document.createElement('button');
        prBtn.className = 'btn primary btn-sm';
        prBtn.textContent = 'Create Pull Request';
        prBtn.onclick = function () { handlePublish('pr'); };
        actionsEl.appendChild(prBtn);
      }
    } catch (e) {
      statusEl.textContent = 'Failed to check status: ' + e.message;
    }
  }

  async function handlePublish(action) {
    try {
      var result = await api('POST', '/publish', { action: action });
      if (action === 'merge') {
        toast('Merged and deployed. Production will rebuild in ~1 minute.', 'success');
      } else if (result.existing) {
        toast('Pull request already exists.', '');
      } else {
        toast('Pull request created.', 'success');
      }
      loadPublishStatus();
    } catch (e) {
      toast('Publish failed: ' + e.message, 'error');
    }
  }

  // --- Utilities ---

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Init ---

  function init() {
    // Login
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('password-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleLogin();
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', function () {
      sessionStorage.removeItem('admin_token');
      token = '';
      showLogin();
    });

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchSection(btn.dataset.section);
      });
    });

    // Upload form listeners
    setupDropZone();
    document.getElementById('img-title').addEventListener('input', updateUploadButton);
    document.getElementById('upload-project').addEventListener('change', updateUploadButton);
    document.getElementById('btn-upload').addEventListener('click', handleUpload);

    // Auto-login if token exists
    if (token) {
      showApp();
    } else {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
