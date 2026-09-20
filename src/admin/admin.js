(function () {
  'use strict';

  var token = sessionStorage.getItem('admin_token') || '';
  var projects = [];
  var currentDetail = null;
  var selectedFile = null;
  var ephemeraFile = null;
  var ephemeraData = [];

  // --- API ---

  function api(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token },
    };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }
    return fetch('/api' + path, opts).then(function (res) {
      if (res.status === 401) {
        sessionStorage.removeItem('admin_token');
        token = '';
        showLogin();
        throw new Error('Session expired');
      }
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
      });
    });
  }

  // --- Toast ---

  function toast(msg, type) {
    var el = document.getElementById('toast');
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

  function handleLogin() {
    var pw = document.getElementById('password-input').value;
    var errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (res) {
      if (!res.ok) throw new Error(res.data.error || 'Login failed');
      token = res.data.token;
      sessionStorage.setItem('admin_token', token);
      showApp();
    })
    .catch(function (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    });
  }

  // --- Navigation ---

  function switchSection(name) {
    document.querySelectorAll('.section').forEach(function (s) {
      s.classList.add('hidden');
    });
    var target = document.getElementById('sec-' + name);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === name);
    });

    if (name === 'publish') loadPublishStatus();
    if (name === 'collections') renderCollectionList();
    if (name === 'ephemera') loadEphemera();
  }

  function showCollectionDetail(slug) {
    document.querySelectorAll('.section').forEach(function (s) {
      s.classList.add('hidden');
    });
    document.getElementById('sec-collection-detail').classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.section === 'collections');
    });
    loadCollectionDetail(slug);
  }

  // --- Projects/Collections ---

  function loadProjects() {
    api('GET', '/projects')
    .then(function (data) {
      projects = data;
      populateProjectDropdown();
      renderCollectionList();
    })
    .catch(function (e) {
      toast('Failed to load collections: ' + e.message, 'error');
    });
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

  function renderCollectionList() {
    var container = document.getElementById('collection-list');
    if (!container) return;
    container.innerHTML = '';

    projects.forEach(function (p, i) {
      var div = document.createElement('div');
      div.className = 'collection-item';

      var thumb = document.createElement('img');
      thumb.className = 'collection-thumb';
      thumb.src = p.thumbnail;
      thumb.alt = p.title;
      thumb.onerror = function () { this.src = '/assets/images/placeholder.jpg'; };

      var info = document.createElement('div');
      info.className = 'collection-item-info';
      info.innerHTML =
        '<div class="collection-item-title">' + esc(p.title) + '</div>' +
        '<div class="collection-item-meta">' + esc(p.year) + ' &middot; ' + p.count + ' works</div>';

      var badge = document.createElement('span');
      badge.className = 'collection-item-badge' + (p.section === 'current' ? ' current' : '');
      badge.textContent = p.section === 'current' ? 'Current' : 'Catalogue';

      var btns = document.createElement('div');
      btns.className = 'reorder-btns';
      var upBtn = document.createElement('button');
      upBtn.className = 'reorder-btn';
      upBtn.textContent = '▲';
      upBtn.disabled = i === 0;
      upBtn.onclick = function (e) { e.stopPropagation(); moveCollection(i, -1); };
      var downBtn = document.createElement('button');
      downBtn.className = 'reorder-btn';
      downBtn.textContent = '▼';
      downBtn.disabled = i === projects.length - 1;
      downBtn.onclick = function (e) { e.stopPropagation(); moveCollection(i, 1); };
      btns.appendChild(upBtn);
      btns.appendChild(downBtn);

      div.appendChild(thumb);
      div.appendChild(info);
      div.appendChild(badge);
      div.appendChild(btns);

      div.addEventListener('click', function () { showCollectionDetail(p.slug); });
      container.appendChild(div);
    });
  }

  function moveCollection(index, direction) {
    var newIndex = index + direction;
    if (newIndex < 0 || newIndex >= projects.length) return;
    var temp = projects[index];
    projects[index] = projects[newIndex];
    projects[newIndex] = temp;
    renderCollectionList();
    api('PUT', '/projects', { projects: projects })
    .then(function () { toast('Collection order updated', 'success'); })
    .catch(function (e) {
      toast('Failed to reorder: ' + e.message, 'error');
      loadProjects();
    });
  }

  // --- New Collection ---

  function setupNewCollectionForm() {
    var btn = document.getElementById('btn-new-collection');
    var form = document.getElementById('new-collection-form');
    var titleInput = document.getElementById('new-coll-title');
    var slugPreview = document.getElementById('new-coll-slug');

    btn.addEventListener('click', function () {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) titleInput.focus();
    });

    document.getElementById('btn-cancel-new-collection').addEventListener('click', function () {
      form.classList.add('hidden');
    });

    titleInput.addEventListener('input', function () {
      var slug = titleInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      slugPreview.textContent = slug ? 'URL: /projects/' + slug + '/' : '';
    });

    document.getElementById('btn-create-collection').addEventListener('click', function () {
      var title = titleInput.value.trim();
      if (!title) { toast('Title is required', 'error'); return; }
      var data = {
        title: title,
        year: document.getElementById('new-coll-year').value || '2026',
        studio: document.getElementById('new-coll-studio').value || '',
        section: document.getElementById('new-coll-section').value,
      };
      api('POST', '/projects', data)
      .then(function (res) {
        toast('Collection "' + title + '" created', 'success');
        form.classList.add('hidden');
        titleInput.value = '';
        slugPreview.textContent = '';
        loadProjects();
      })
      .catch(function (e) { toast(e.message, 'error'); });
    });
  }

  // --- Collection Detail ---

  function loadCollectionDetail(slug) {
    api('GET', '/project/' + slug)
    .then(function (data) {
      currentDetail = data;
      renderCollectionDetail();
    })
    .catch(function (e) {
      toast('Failed to load collection: ' + e.message, 'error');
    });
  }

  function renderCollectionDetail() {
    var d = currentDetail;
    document.getElementById('detail-title').value = d.title || '';
    document.getElementById('detail-year').value = d.year || '';
    document.getElementById('detail-studio').value = d.studio || '';
    document.getElementById('detail-section').value = d.section || 'catalogue';

    var heading = document.getElementById('detail-image-heading');
    heading.textContent = 'Images (' + (d.images ? d.images.length : 0) + ')';

    var container = document.getElementById('detail-images');
    container.innerHTML = '';

    if (!d.images || d.images.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-size:14px;">No images yet. Use the Add Image tab to upload.</p>';
      return;
    }

    d.images.forEach(function (img, i) {
      var isThumbnail = d.thumbnail === img.src;
      var card = document.createElement('div');
      card.className = 'image-card' + (isThumbnail ? ' is-thumbnail' : '');
      card.id = 'img-card-' + i;

      var thumbEl = document.createElement('img');
      thumbEl.className = 'image-card-thumb';
      thumbEl.src = img.src;
      thumbEl.alt = img.title || '';
      thumbEl.onerror = function () { this.src = '/assets/images/placeholder.jpg'; };

      var reorder = document.createElement('div');
      reorder.className = 'reorder-btns';
      var upBtn = document.createElement('button');
      upBtn.className = 'reorder-btn';
      upBtn.textContent = '▲';
      upBtn.disabled = i === 0;
      upBtn.onclick = function () { moveImage(i, -1); };
      var downBtn = document.createElement('button');
      downBtn.className = 'reorder-btn';
      downBtn.textContent = '▼';
      downBtn.disabled = i === d.images.length - 1;
      downBtn.onclick = function () { moveImage(i, 1); };
      reorder.appendChild(upBtn);
      reorder.appendChild(downBtn);

      var body = document.createElement('div');
      body.className = 'image-card-body';
      body.innerHTML =
        '<div class="image-card-title">' + esc(img.title || 'Untitled') + '</div>' +
        '<div class="image-card-meta">' +
          esc(img.medium || '') +
          (img.dimensions ? '<br>' + esc(img.dimensions) : '') +
          (img.date ? '<br>' + esc(img.date) : '') +
          (img.collection ? '<br>' + esc(img.collection) : '') +
        '</div>';

      var actions = document.createElement('div');
      actions.className = 'image-card-actions';

      var editBtn = document.createElement('button');
      editBtn.className = 'btn secondary btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.onclick = function () { startEditImage(i); };

      var thumbBtn = document.createElement('button');
      thumbBtn.className = 'btn ' + (isThumbnail ? 'primary' : 'secondary') + ' btn-sm';
      thumbBtn.textContent = isThumbnail ? 'Thumbnail' : 'Set Thumbnail';
      if (!isThumbnail) {
        thumbBtn.onclick = function () { setThumbnail(img.src); };
      } else {
        thumbBtn.disabled = true;
      }

      var removeBtn = document.createElement('button');
      removeBtn.className = 'btn danger btn-sm';
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = function () { removeImage(img); };

      actions.appendChild(editBtn);
      actions.appendChild(thumbBtn);
      actions.appendChild(removeBtn);
      body.appendChild(actions);

      card.appendChild(reorder);
      card.appendChild(thumbEl);
      card.appendChild(body);
      container.appendChild(card);
    });
  }

  function saveCollectionMeta() {
    var slug = currentDetail.slug;
    var updates = {
      title: document.getElementById('detail-title').value.trim(),
      year: document.getElementById('detail-year').value.trim(),
      studio: document.getElementById('detail-studio').value.trim(),
      section: document.getElementById('detail-section').value,
    };
    api('PUT', '/project/' + slug, updates)
    .then(function () {
      toast('Collection details saved', 'success');
      loadProjects();
      currentDetail.title = updates.title;
      currentDetail.year = updates.year;
      currentDetail.studio = updates.studio;
      currentDetail.section = updates.section;
    })
    .catch(function (e) { toast('Failed to save: ' + e.message, 'error'); });
  }

  // --- Image Editing ---

  function startEditImage(index) {
    var img = currentDetail.images[index];
    var card = document.getElementById('img-card-' + index);
    var body = card.querySelector('.image-card-body');

    body.innerHTML =
      '<div class="image-edit-fields">' +
        '<div class="field"><label>Title</label><input type="text" id="edit-title-' + index + '" value="' + escAttr(img.title || '') + '"></div>' +
        '<div class="field"><label>Medium</label><input type="text" id="edit-medium-' + index + '" value="' + escAttr(img.medium || '') + '"></div>' +
        '<div class="field"><label>Dimensions</label><input type="text" id="edit-dims-' + index + '" value="' + escAttr(img.dimensions || '') + '"></div>' +
        '<div class="field"><label>Date</label><input type="text" id="edit-date-' + index + '" value="' + escAttr(img.date || '') + '"></div>' +
        '<div class="field"><label>Collection</label><input type="text" id="edit-coll-' + index + '" value="' + escAttr(img.collection || '') + '"></div>' +
      '</div>' +
      '<div class="image-card-actions">' +
        '<button class="btn primary btn-sm" id="edit-save-' + index + '">Save</button>' +
        '<button class="btn secondary btn-sm" id="edit-cancel-' + index + '">Cancel</button>' +
      '</div>';

    document.getElementById('edit-save-' + index).onclick = function () { saveImageEdit(index); };
    document.getElementById('edit-cancel-' + index).onclick = function () { renderCollectionDetail(); };
  }

  function saveImageEdit(index) {
    var images = currentDetail.images.slice();
    images[index] = {
      src: images[index].src,
      title: document.getElementById('edit-title-' + index).value.trim(),
      medium: document.getElementById('edit-medium-' + index).value.trim(),
      dimensions: document.getElementById('edit-dims-' + index).value.trim(),
      date: document.getElementById('edit-date-' + index).value.trim(),
      collection: document.getElementById('edit-coll-' + index).value.trim(),
    };
    api('PUT', '/project/' + currentDetail.slug, { images: images })
    .then(function () {
      currentDetail.images = images;
      renderCollectionDetail();
      toast('Image metadata saved', 'success');
    })
    .catch(function (e) { toast('Failed to save: ' + e.message, 'error'); });
  }

  // --- Image Reorder ---

  function moveImage(index, direction) {
    var images = currentDetail.images.slice();
    var newIndex = index + direction;
    if (newIndex < 0 || newIndex >= images.length) return;
    var temp = images[index];
    images[index] = images[newIndex];
    images[newIndex] = temp;
    currentDetail.images = images;
    renderCollectionDetail();
    api('PUT', '/project/' + currentDetail.slug, { images: images })
    .then(function () { toast('Image order updated', 'success'); })
    .catch(function (e) {
      toast('Failed to reorder: ' + e.message, 'error');
      loadCollectionDetail(currentDetail.slug);
    });
  }

  // --- Thumbnail ---

  function setThumbnail(src) {
    api('PUT', '/project/' + currentDetail.slug, { thumbnail: src })
    .then(function () {
      currentDetail.thumbnail = src;
      renderCollectionDetail();
      loadProjects();
      toast('Thumbnail updated', 'success');
    })
    .catch(function (e) { toast('Failed to set thumbnail: ' + e.message, 'error'); });
  }

  // --- Remove Image ---

  function removeImage(img) {
    if (!confirm('Remove "' + (img.title || 'this image') + '"? This cannot be undone.')) return;
    api('DELETE', '/project/' + currentDetail.slug + '/image', { src: img.src })
    .then(function () {
      toast('Image removed', 'success');
      loadCollectionDetail(currentDetail.slug);
      loadProjects();
    })
    .catch(function (e) { toast('Failed to remove: ' + e.message, 'error'); });
  }

  // --- File Upload (Add Image tab) ---

  function setupDropZone() {
    var zone = document.getElementById('drop-zone');
    var input = document.getElementById('file-input');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
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

  function handleUpload() {
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

    var form = new FormData();
    form.append('image', selectedFile);
    form.append('metadata', JSON.stringify(metadata));

    api('POST', '/upload/' + slug, form)
    .then(function () {
      toast('Added "' + metadata.title + '" successfully.', 'success');
      selectedFile = null;
      document.getElementById('file-input').value = '';
      document.getElementById('image-preview').classList.add('hidden');
      document.getElementById('img-title').value = '';
      document.getElementById('img-dimensions').value = '';
      document.getElementById('img-collection').value = '';
      loadProjects();
    })
    .catch(function (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    })
    .then(function () {
      btn.disabled = false;
      btn.textContent = 'Add to Collection';
      updateUploadButton();
    });
  }

  // --- Ephemera ---

  function setupEphemeraDropZone() {
    var zone = document.getElementById('eph-drop-zone');
    var input = document.getElementById('eph-file-input');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) handleEphemeraFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () {
      if (input.files.length) handleEphemeraFile(input.files[0]);
    });
  }

  function handleEphemeraFile(file) {
    if (!file.type.match(/^image\/jpe?g$/)) {
      toast('Please select a JPEG image', 'error');
      return;
    }
    ephemeraFile = file;
    var preview = document.getElementById('eph-preview');
    var img = document.getElementById('eph-preview-img');
    var reader = new FileReader();
    reader.onload = function (e) {
      img.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function loadEphemera() {
    api('GET', '/ephemera')
    .then(function (data) {
      ephemeraData = data;
      renderEphemeraList();
    })
    .catch(function (e) { toast('Failed to load ephemera: ' + e.message, 'error'); });
  }

  function renderEphemeraList() {
    var container = document.getElementById('ephemera-list');
    container.innerHTML = '';

    ephemeraData.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'ephemera-item';

      if (item.images && item.images.length > 0) {
        var thumb = document.createElement('img');
        thumb.className = 'ephemera-item-thumb';
        thumb.src = item.images[0];
        thumb.alt = item.title || '';
        thumb.onerror = function () { this.style.display = 'none'; };
        div.appendChild(thumb);
      }

      var info = document.createElement('div');
      info.className = 'ephemera-item-info';
      info.innerHTML =
        '<div class="ephemera-item-title">' + esc(item.title || '') + '</div>' +
        '<div class="ephemera-item-meta">' + esc(item.type || '') + ' &middot; ' + esc(item.date || '') + '</div>';
      div.appendChild(info);

      container.appendChild(div);
    });
  }

  function handleEphemeraSubmit() {
    var title = document.getElementById('eph-title').value.trim();
    var type = document.getElementById('eph-type').value;
    var date = document.getElementById('eph-date').value.trim();
    var description = document.getElementById('eph-description').value.trim();
    var errEl = document.getElementById('eph-error');
    errEl.classList.add('hidden');

    if (!title || !date) {
      errEl.textContent = 'Title and date are required';
      errEl.classList.remove('hidden');
      return;
    }

    var btn = document.getElementById('btn-add-ephemera');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving...';

    var form = new FormData();
    form.append('title', title);
    form.append('type', type);
    form.append('date', date);
    form.append('description', description);
    if (ephemeraFile) form.append('image', ephemeraFile);

    api('POST', '/ephemera', form)
    .then(function () {
      toast('Ephemera entry added', 'success');
      document.getElementById('eph-title').value = '';
      document.getElementById('eph-date').value = '';
      document.getElementById('eph-description').value = '';
      document.getElementById('eph-file-input').value = '';
      document.getElementById('eph-preview').classList.add('hidden');
      ephemeraFile = null;
      loadEphemera();
    })
    .catch(function (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    })
    .then(function () {
      btn.disabled = false;
      btn.textContent = 'Add Entry';
    });
  }

  // --- Publish ---

  function loadPublishStatus() {
    var statusEl = document.getElementById('publish-status');
    var actionsEl = document.getElementById('publish-actions');
    statusEl.textContent = 'Checking status...';
    statusEl.className = 'publish-status';
    actionsEl.classList.add('hidden');

    api('GET', '/status')
    .then(function (status) {
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
    })
    .catch(function (e) {
      statusEl.textContent = 'Failed to check status: ' + e.message;
    });
  }

  function handlePublish(action) {
    api('POST', '/publish', { action: action })
    .then(function (result) {
      if (action === 'merge') {
        toast('Merged and deployed. Production will rebuild shortly.', 'success');
      } else if (result.existing) {
        toast('Pull request already exists.', '');
      } else {
        toast('Pull request created.', 'success');
      }
      loadPublishStatus();
    })
    .catch(function (e) {
      toast('Publish failed: ' + e.message, 'error');
    });
  }

  // --- Utilities ---

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Init ---

  function init() {
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('password-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('btn-logout').addEventListener('click', function () {
      sessionStorage.removeItem('admin_token');
      token = '';
      showLogin();
    });

    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchSection(btn.dataset.section);
      });
    });

    document.getElementById('btn-back-to-collections').addEventListener('click', function (e) {
      e.preventDefault();
      switchSection('collections');
    });

    document.getElementById('btn-save-collection-meta').addEventListener('click', saveCollectionMeta);

    setupDropZone();
    document.getElementById('img-title').addEventListener('input', updateUploadButton);
    document.getElementById('upload-project').addEventListener('change', updateUploadButton);
    document.getElementById('btn-upload').addEventListener('click', handleUpload);

    setupNewCollectionForm();
    setupEphemeraDropZone();
    document.getElementById('btn-add-ephemera').addEventListener('click', handleEphemeraSubmit);

    if (token) {
      showApp();
    } else {
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
