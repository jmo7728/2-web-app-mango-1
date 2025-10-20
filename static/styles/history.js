document.addEventListener('DOMContentLoaded', () => {
    const API = '/api/sessions'; 
    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const sessionForm = document.getElementById('sessionForm');
    const sessionIdInput = document.getElementById('sessionId');
    const deleteBtn = document.getElementById('deleteBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const addQuickBtn = document.getElementById('addQuickBtn');
    const searchInput = document.getElementById('searchInput');
    const backBtn = document.getElementById('backBtn');
  
    let sessions = [];
    let activeSession = null;
  
    backBtn?.addEventListener('click', () => history.back());
  
    fetchHistoryFromQuery();
  
    let debounceTimer = null;
    searchInput?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchHistory(searchInput.value.trim()), 300);
    });
  
    async function fetchHistory(q = '') {
      try {
        const url = new URL(API, location.origin);
        if (q) url.searchParams.set('q', q);
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw r;
        sessions = await r.json();
        renderList();
        checkOpenFromUrl();
      } catch (err) {
        console.error('fetchHistory error', err);
        historyList.innerHTML = `<div class="session-card"><div class="title">Error loading history</div></div>`;
      }
    }
  
    function renderList() {
      historyList.innerHTML = '';
      if (!sessions || sessions.length === 0) {
        emptyState.classList.remove('hidden');
        return;
      }
      emptyState.classList.add('hidden');
  
      sessions.forEach(s => {
        const card = document.createElement('article');
        card.className = 'session-card card';
  
        const titleLink = document.createElement('a');
        titleLink.className = 'title-link title';
        titleLink.href = `?edit=${encodeURIComponent(s._id || s.id)}`;
        titleLink.textContent = s.title || 'Untitled';
  
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${s.date || ''} • ${s.duration ?? ''} min • ${s.type || ''}`;
  
        const row = document.createElement('div');
        row.className = 'actions';
  
        const editBtn = document.createElement('button');
        editBtn.className = 'small-btn edit-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          openEdit(s);
        });
  
        const delBtn = document.createElement('button');
        delBtn.className = 'small-btn del-btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          confirmDelete(s);
        });
  
        row.appendChild(editBtn);
        row.appendChild(delBtn);
  
        card.appendChild(titleLink);
        card.appendChild(meta);
        card.appendChild(row);
  
        historyList.appendChild(card);
      });
    }
  

    function openEdit(s) {
      activeSession = s;
      modalTitle.textContent = 'Edit session';
      sessionIdInput.value = s._id || s.id || '';
      fillFormFrom(s);
      deleteBtn.classList.remove('hidden');
      showModal();

      const url = new URL(location);
      url.searchParams.set('edit', sessionIdInput.value);
      history.replaceState({}, '', url);
    }
  
    function openAdd() {
      activeSession = null;
      modalTitle.textContent = 'Add session';
      sessionIdInput.value = '';
      sessionForm.reset();

      document.getElementById('date').value = new Date().toISOString().slice(0,10);
      deleteBtn.classList.add('hidden');
      showModal();

      const url = new URL(location);
      url.searchParams.delete('edit');
      history.replaceState({}, '', url);
    }
  
    function fillFormFrom(s) {
      document.getElementById('title').value = s.title || '';
      document.getElementById('date').value = s.date || '';
      document.getElementById('duration').value = s.duration ?? '';
      document.getElementById('type').value = s.type || '';
      document.getElementById('notes').value = s.notes || '';
    }
  
    function getFormData() {
      return {
        title: document.getElementById('title').value.trim(),
        date: document.getElementById('date').value,
        duration: Number(document.getElementById('duration').value),
        type: document.getElementById('type').value.trim(),
        notes: document.getElementById('notes').value.trim()
      };
    }
  
    async function submitForm(e) {
      e.preventDefault();
      const data = getFormData();
      const id = sessionIdInput.value;
      try {
        if (id) {
        
          const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text || 'update failed');
          }
        } else {
          
          const r = await fetch(API, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });
          if (!r.ok) {
            const text = await r.text();
            throw new Error(text || 'create failed');
          }
        }
        await fetchHistory(searchInput.value.trim());
        hideModal();
      } catch (err) {
        console.error('submitForm error', err);
        alert('Failed to save. Check the form and try again.');
      }
    }
  
    async function confirmDelete(s) {
      if (!confirm(`Delete "${s.title || 'session'}" permanently?`)) return;
      try {
        const id = s._id || s.id;
        const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });
        if (!r.ok) throw r;
        await fetchHistory(searchInput.value.trim());
        if (sessionIdInput.value === id) hideModal();
      } catch (err) {
        console.error('confirmDelete', err);
        alert('Failed to delete item.');
      }
    }
  
    function showModal() { modal.classList.remove('hidden'); focusFirstInput(); }
    function hideModal() {
      modal.classList.add('hidden');

      const url = new URL(location);
      url.searchParams.delete('edit');
      history.replaceState({}, '', url);
    }
    function focusFirstInput() { setTimeout(()=> document.getElementById('title').focus(), 80); }
  

    sessionForm.addEventListener('submit', submitForm);
    cancelBtn.addEventListener('click', (e)=>{ e.preventDefault(); hideModal(); });
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = sessionIdInput.value;
      if (!id) return;
      if (!confirm('Are you sure you want to delete this session?')) return;
      try {
        const r = await fetch(`${API}/${encodeURIComponent(id)}`, { method:'DELETE', credentials:'same-origin' });
        if (!r.ok) throw r;
        await fetchHistory(searchInput.value.trim());
        hideModal();
      } catch (err) {
        console.error(err);
        alert('Delete failed.');
      }
    });
  
    addQuickBtn?.addEventListener('click', (e) => { openAdd(); });
  

    function fetchHistoryFromQuery(){
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit') || null;

      fetchHistory().then(()=> {
        if (editId) {
          const s = sessions.find(x => (x._id||x.id) === editId);
          if (s) openEdit(s);
          else {

            console.warn('edit id not found in loaded sessions', editId);
          }
        }
      });
    }
  
    function checkOpenFromUrl() {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit') || null;
      if (editId) {
        const s = sessions.find(x => (x._id||x.id) === editId);
        if (s) openEdit(s);
      }
    }
  
  });
  

  