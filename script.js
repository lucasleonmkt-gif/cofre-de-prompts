// State Management
let prompts = JSON.parse(localStorage.getItem('prompts')) || [];
let folders = JSON.parse(localStorage.getItem('folders')) || [];
let currentFolderId = null; // null = root level
let currentEditingId = null;
let currentEditingFolderId = null;

// DOM Elements
const promptsGrid = document.getElementById('promptsGrid');
const emptyState = document.getElementById('emptyState');
const promptModal = document.getElementById('promptModal');
const folderModal = document.getElementById('folderModal');
const promptForm = document.getElementById('promptForm');
const folderForm = document.getElementById('folderForm');
const modalTitle = document.getElementById('modalTitle');
const folderModalTitle = document.getElementById('folderModalTitle');
const searchInput = document.getElementById('searchInput');
const openModalBtn = document.getElementById('openModalBtn');
const openFolderModalBtn = document.getElementById('openFolderModalBtn');
const emptyStateBtn = document.getElementById('emptyStateBtn');
const closeModalBtns = document.querySelectorAll('.close-modal');
const closeFolderModalBtns = document.querySelectorAll('.close-folder-modal');
const toastContainer = document.getElementById('toastContainer');
const breadcrumb = document.getElementById('breadcrumb');

// Drag & Drop State
let draggedItemId = null;
let draggedItemType = null; // 'prompt' or 'folder'

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Basic migration
    prompts = prompts.map(p => ({
        ...p,
        folderId: p.folderId || null
    }));
    
    saveToStorage();
    saveFoldersToStorage();
    renderView();

    // Event Listeners
    openModalBtn.addEventListener('click', () => openPromptModal());
    openFolderModalBtn.addEventListener('click', () => openFolderModal());
    emptyStateBtn.addEventListener('click', () => openPromptModal());

    closeModalBtns.forEach(btn => btn.addEventListener('click', closePromptModal));
    closeFolderModalBtns.forEach(btn => btn.addEventListener('click', closeFolderModal));

    window.addEventListener('click', (e) => {
        if (e.target === promptModal) closePromptModal();
        if (e.target === folderModal) closeFolderModal();
    });

    promptForm.addEventListener('submit', handlePromptFormSubmit);
    folderForm.addEventListener('submit', handleFolderFormSubmit);

    searchInput.addEventListener('input', () => renderView());
});

// ========================
// RENDER FUNCTIONS
// ========================
function renderView() {
    const filter = searchInput.value.toLowerCase();
    promptsGrid.innerHTML = '';
    renderBreadcrumb();

    let currentFolders = folders.filter(f => f.parentId === currentFolderId);
    let currentPrompts = prompts.filter(p => p.folderId === currentFolderId);

    if (filter) {
        currentFolders = currentFolders.filter(f => f.name.toLowerCase().includes(filter));
        currentPrompts = currentPrompts.filter(p => 
            p.title.toLowerCase().includes(filter) || 
            p.content.toLowerCase().includes(filter)
        );
    }

    if (currentFolders.length === 0 && currentPrompts.length === 0) {
        promptsGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        promptsGrid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        currentFolders.forEach(folder => {
            promptsGrid.appendChild(createFolderCard(folder));
        });

        currentPrompts.forEach(prompt => {
            promptsGrid.appendChild(createPromptCard(prompt));
        });
    }
}

function renderBreadcrumb() {
    if (currentFolderId === null) {
        breadcrumb.classList.add('hidden');
        return;
    }
    breadcrumb.classList.remove('hidden');
    breadcrumb.innerHTML = '';

    const path = [];
    let fId = currentFolderId;
    while (fId !== null) {
        const folder = folders.find(f => f.id === fId);
        if (!folder) break;
        path.unshift(folder);
        fId = folder.parentId;
    }

    const rootBtn = document.createElement('button');
    rootBtn.className = 'breadcrumb-item';
    rootBtn.innerHTML = '<span>🏠</span> Inicio';
    rootBtn.onclick = () => navigateToFolder(null);
    breadcrumb.appendChild(rootBtn);

    path.forEach((folder, index) => {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '›';
        breadcrumb.appendChild(sep);

        const btn = document.createElement('button');
        btn.className = 'breadcrumb-item' + (index === path.length - 1 ? ' active' : '');
        btn.innerHTML = `<span>📁</span> ${escapeHTML(folder.name)}`;
        btn.onclick = () => navigateToFolder(folder.id);
        breadcrumb.appendChild(btn);
    });
}

// ========================
// DRAG & DROP SORTING
// ========================
function handleDragStart(e, id, type) {
    draggedItemId = id;
    draggedItemType = type;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over-sort, .drag-over').forEach(el => {
        el.classList.remove('drag-over-sort', 'drag-over');
    });
}

function handleDragOver(e, targetId, targetType) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const card = e.currentTarget;
    
    // Distinguish between sorting and moving into folder
    if (draggedItemType === 'prompt' && targetType === 'folder') {
        card.classList.add('drag-over'); // Visual for "move into"
    } else {
        card.classList.add('drag-over-sort'); // Visual for "reorder"
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-sort', 'drag-over');
}

function handleDrop(e, targetId, targetType) {
    e.preventDefault();
    const card = e.currentTarget;
    card.classList.remove('drag-over-sort', 'drag-over');

    if (draggedItemId === targetId) return;

    // Logic: Move into folder
    if (draggedItemType === 'prompt' && targetType === 'folder' && !e.shiftKey) {
        movePromptToFolder(draggedItemId, targetId);
        return;
    }

    // Logic: Sort / Reorder
    if (draggedItemType === 'prompt' && targetType === 'prompt') {
        reorderPrompts(draggedItemId, targetId);
    } else if (draggedItemType === 'folder' && targetType === 'folder') {
        reorderFolders(draggedItemId, targetId);
    }
}

function reorderPrompts(fromId, toId) {
    const fromIndex = prompts.findIndex(p => p.id === fromId);
    const toIndex = prompts.findIndex(p => p.id === toId);
    const [item] = prompts.splice(fromIndex, 1);
    prompts.splice(toIndex, 0, item);
    saveToStorage();
    renderView();
}

function reorderFolders(fromId, toId) {
    const fromIndex = folders.findIndex(f => f.id === fromId);
    const toIndex = folders.findIndex(f => f.id === toId);
    const [item] = folders.splice(fromIndex, 1);
    folders.splice(toIndex, 0, item);
    saveFoldersToStorage();
    renderView();
}

// ========================
// FOLDER CARD
// ========================
function createFolderCard(folder) {
    const promptCount = prompts.filter(p => p.folderId === folder.id).length;
    const div = document.createElement('div');
    div.className = 'folder-card';
    div.draggable = true;
    div.dataset.id = folder.id;

    div.innerHTML = `
        <div class="folder-icon">📁</div>
        <div class="folder-name">${escapeHTML(folder.name)}</div>
        <div class="folder-meta">
            <span class="folder-count">${promptCount} prompt${promptCount !== 1 ? 's' : ''}</span>
            <div class="folder-actions">
                <button class="action-btn" onclick="event.stopPropagation(); renameFolderPrompt('${folder.id}')">✏️</button>
                <button class="action-btn delete" onclick="event.stopPropagation(); deleteFolder('${folder.id}')">🗑️</button>
            </div>
        </div>
    `;

    div.addEventListener('dragstart', (e) => handleDragStart(e, folder.id, 'folder'));
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', (e) => handleDragOver(e, folder.id, 'folder'));
    div.addEventListener('dragleave', handleDragLeave);
    div.addEventListener('drop', (e) => handleDrop(e, folder.id, 'folder'));

    div.onclick = () => navigateToFolder(folder.id);
    return div;
}

// ========================
// PROMPT CARD
// ========================
function createPromptCard(prompt) {
    const div = document.createElement('div');
    div.className = 'prompt-card';
    div.draggable = true;
    div.dataset.id = prompt.id;

    if (prompt.color) {
        div.style.setProperty('--card-color', prompt.color);
        div.classList.add('has-color');
    }

    div.innerHTML = `
        <div class="card-header">
            <h3>${escapeHTML(prompt.title)}</h3>
            <div class="card-actions">
                ${prompt.folderId !== null ? `<button class="action-btn" onclick="event.stopPropagation(); movePromptToFolder('${prompt.id}', null)" title="Sacar">📤</button>` : ''}
                <button class="action-btn" onclick="event.stopPropagation(); toggleColorPicker('${prompt.id}', this)">🎨</button>
                <button class="action-btn" onclick="event.stopPropagation(); editPrompt('${prompt.id}')">✏️</button>
                <button class="action-btn delete" onclick="event.stopPropagation(); deletePrompt('${prompt.id}')">🗑️</button>
            </div>
        </div>
        <div class="color-picker-popup" id="colorPicker_${prompt.id}">
            <div class="color-options">
                <button class="color-dot" style="background:#8b5cf6" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#8b5cf6')"></button>
                <button class="color-dot" style="background:#3b82f6" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#3b82f6')"></button>
                <button class="color-dot" style="background:#06b6d4" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#06b6d4')"></button>
                <button class="color-dot" style="background:#10b981" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#10b981')"></button>
                <button class="color-dot" style="background:#f59e0b" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#f59e0b')"></button>
                <button class="color-dot" style="background:#ef4444" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#ef4444')"></button>
                <button class="color-dot" style="background:#ec4899" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#ec4899')"></button>
                <button class="color-dot" style="background:#f97316" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '#f97316')"></button>
                <button class="color-dot color-dot-none" onclick="event.stopPropagation(); setPromptColor('${prompt.id}', '')">✕</button>
            </div>
        </div>
        <div class="card-body">${escapeHTML(prompt.content)}</div>
        <div class="card-footer">
            <button class="copy-btn" onclick="copyPrompt(this, \`${escapeJS(prompt.content)}\`)">
                <span>📋</span> Copiar Prompt
            </button>
        </div>
    `;

    div.addEventListener('dragstart', (e) => handleDragStart(e, prompt.id, 'prompt'));
    div.addEventListener('dragend', handleDragEnd);
    div.addEventListener('dragover', (e) => handleDragOver(e, prompt.id, 'prompt'));
    div.addEventListener('dragleave', handleDragLeave);
    div.addEventListener('drop', (e) => handleDrop(e, prompt.id, 'prompt'));

    return div;
}

// ========================
// COLOR PICKER
// ========================
function toggleColorPicker(promptId, btn) {
    const picker = document.getElementById('colorPicker_' + promptId);
    document.querySelectorAll('.color-picker-popup.open').forEach(p => p !== picker && p.classList.remove('open'));
    picker.classList.toggle('open');
    if (picker.classList.contains('open')) {
        const handler = (e) => {
            if (!picker.contains(e.target) && e.target !== btn) {
                picker.classList.remove('open');
                document.removeEventListener('click', handler);
            }
        };
        setTimeout(() => document.addEventListener('click', handler), 0);
    }
}

function setPromptColor(promptId, color) {
    prompts = prompts.map(p => p.id === promptId ? { ...p, color: color || null } : p);
    saveToStorage();
    renderView();
}

// ========================
// OPERATIONS
// ========================
function navigateToFolder(id) {
    currentFolderId = id;
    searchInput.value = '';
    renderView();
}

function openPromptModal(id = null) {
    if (id) {
        const p = prompts.find(x => x.id === id);
        currentEditingId = id;
        modalTitle.textContent = 'Editar Prompt';
        document.getElementById('promptTitle').value = p.title;
        document.getElementById('promptContent').value = p.content;
    } else {
        currentEditingId = null;
        modalTitle.textContent = 'Nuevo Prompt';
        promptForm.reset();
    }
    promptModal.classList.add('active');
}

function closePromptModal() {
    promptModal.classList.remove('active');
    currentEditingId = null;
}

function handlePromptFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('promptTitle').value;
    const content = document.getElementById('promptContent').value;
    if (currentEditingId) {
        prompts = prompts.map(p => p.id === currentEditingId ? { ...p, title, content } : p);
    } else {
        prompts.unshift({ id: Date.now().toString(), title, content, folderId: currentFolderId, createdAt: new Date().toISOString() });
    }
    saveToStorage();
    renderView();
    closePromptModal();
}

function deletePrompt(id) {
    if (confirm('¿Eliminar prompt?')) {
        prompts = prompts.filter(p => p.id !== id);
        saveToStorage();
        renderView();
        showToast('Prompt eliminado', 'danger');
    }
}

function editPrompt(id) {
    openPromptModal(id);
}

function openFolderModal(id = null) {
    if (id) {
        const f = folders.find(x => x.id === id);
        currentEditingFolderId = id;
        folderModalTitle.textContent = 'Renombrar Carpeta';
        document.getElementById('folderName').value = f.name;
    } else {
        currentEditingFolderId = null;
        folderModalTitle.textContent = 'Nueva Carpeta';
        folderForm.reset();
    }
    folderModal.classList.add('active');
}

function closeFolderModal() {
    folderModal.classList.remove('active');
    currentEditingFolderId = null;
}

function handleFolderFormSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('folderName').value.trim();
    if (currentEditingFolderId) {
        folders = folders.map(f => f.id === currentEditingFolderId ? { ...f, name } : f);
    } else {
        folders.push({ id: 'folder_' + Date.now().toString(), name, parentId: currentFolderId, createdAt: new Date().toISOString() });
    }
    saveFoldersToStorage();
    renderView();
    closeFolderModal();
}

function renameFolderPrompt(id) {
    openFolderModal(id);
}

function deleteFolder(id) {
    if (confirm('¿Eliminar carpeta?')) {
        prompts = prompts.map(p => p.folderId === id ? { ...p, folderId: null } : p);
        folders = folders.filter(f => f.id !== id);
        saveToStorage();
        saveFoldersToStorage();
        renderView();
        showToast('Carpeta eliminada', 'danger');
    }
}

function movePromptToFolder(promptId, folderId) {
    prompts = prompts.map(p => p.id === promptId ? { ...p, folderId } : p);
    saveToStorage();
    renderView();
    showToast('Prompt movido');
}

async function copyPrompt(btn, text) {
    try {
        await navigator.clipboard.writeText(text);
        const original = btn.innerHTML;
        btn.innerHTML = '<span>✅</span> ¡Copiado!';
        btn.classList.add('copied');
        showToast('¡Copiado!');
        setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 2000);
    } catch (err) { showToast('Error al copiar', 'danger'); }
}

function saveToStorage() { localStorage.setItem('prompts', JSON.stringify(prompts)); }
function saveFoldersToStorage() { localStorage.setItem('folders', JSON.stringify(folders)); }

function showToast(message, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${type === 'danger' ? 'toast-danger' : ''}`;
    t.innerHTML = `<span class="toast-icon">${type === 'danger' ? '⚠️' : '✅'}</span><span class="toast-message">${message}</span>`;
    toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 3000);
}

function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeJS(str) { return str.replace(/`/g, '\\`').replace(/\$/g, '\\$'); }
