import { formatTimeRemaining, formatDisplayDate, formatDateTimeForInput } from './utils.js';
// --- State ---
let categoryFilter = 'all';
let categories = new Set(); // Keep track of ALL unique categories encountered
let currentModalMode = 'add';
let currentEditingItemId = null;
// --- DOM Element Selectors ---
const bodyElement = document.body; // Need body for theme toggling
const listContainer = document.getElementById('countdown-list');
const categoryFilterSelect = document.getElementById('category-filter');
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importInput = document.getElementById('import-file');
const addNewButton = document.getElementById('add-new-button');
const themeToggleButton = document.getElementById('theme-toggle-button'); // Ensure this ID matches HTML
// Modal Elements
const modalOverlay = document.getElementById('item-modal');
const modalContent = modalOverlay === null || modalOverlay === void 0 ? void 0 : modalOverlay.querySelector('.modal-content');
const modalCloseButton = document.getElementById('modal-close-button');
const modalCancelButton = document.getElementById('modal-cancel-button');
const modalSaveButton = document.getElementById('modal-save-button');
const modalTitle = document.getElementById('modal-title');
const itemForm = document.getElementById('item-form');
const categoryDatalist = document.getElementById('category-suggestions');
// Form Elements
const formElements = itemForm ? {
    id: itemForm.elements.namedItem('item-id'),
    name: itemForm.elements.namedItem('item-name'),
    date: itemForm.elements.namedItem('item-date'),
    time: itemForm.elements.namedItem('item-time'),
    isRecurring: itemForm.elements.namedItem('item-recurring'),
    recurrenceInterval: itemForm.elements.namedItem('item-recurrence-interval'),
    recurrenceEndDate: itemForm.elements.namedItem('item-recurrence-end-date'),
    category: itemForm.elements.namedItem('item-category'),
    note: itemForm.elements.namedItem('item-note'),
    link: itemForm.elements.namedItem('item-link'),
    design: itemForm.elements.namedItem('item-design'),
    recurringOptions: document.getElementById('recurring-options'),
} : null;
export function setupUIEventListeners(callbacks) {
    console.log('setupUIEventListeners called.');
    // --- DEBUG: Check if theme button element is found ---
    console.log('Selecting Theme Toggle Button:', themeToggleButton);
    if (!listContainer || !categoryFilterSelect || !exportButton || !importButton || !importInput || !addNewButton || !modalOverlay || !modalCloseButton || !modalCancelButton || !itemForm || !formElements || !themeToggleButton || !categoryDatalist) {
        console.error("CRITICAL ERROR: One or more essential UI elements could not be found. Aborting event listener setup.");
        alert("Initialization Error: UI components missing.");
        return;
    }
    // --- Theme Toggle ---
    themeToggleButton.addEventListener('click', () => {
        // --- DEBUG: Confirm listener is firing ---
        console.log('Theme toggle button CLICKED!');
        const currentTheme = bodyElement.getAttribute('data-theme');
        // --- DEBUG: Log current theme state ---
        console.log('Current theme attribute before change:', currentTheme);
        const newTheme = currentTheme === 'retro' ? 'default' : 'retro';
        // --- DEBUG: Log theme change decision ---
        console.log('Changing theme to:', newTheme);
        applyTheme(newTheme); // Apply visually
        callbacks.themeChanged(newTheme); // Notify app logic to save preference
    });
    // --- Modal Triggers ---
    addNewButton.addEventListener('click', () => openModal('add'));
    modalCloseButton.addEventListener('click', closeModal);
    modalCancelButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay)
            closeModal();
    });
    // --- Form Submission ---
    itemForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!formElements)
            return;
        const targetDateTime = `${formElements.date.value}T${formElements.time.value || '00:00'}`;
        if (!formElements.date.value || !formElements.time.value) {
            alert("Please select both a date and a time.");
            return;
        }
        const formData = {
            name: formElements.name.value.trim() || 'Unnamed Event',
            targetDateTime: targetDateTime,
            isRecurring: formElements.isRecurring.checked,
            recurrenceInterval: formElements.isRecurring.checked ? formElements.recurrenceInterval.value : undefined,
            recurrenceEndDate: formElements.isRecurring.checked && formElements.recurrenceEndDate.value ? formElements.recurrenceEndDate.value : null,
            category: formElements.category.value.trim() || 'Uncategorized',
            note: formElements.note.value.trim(),
            link: formElements.link.value.trim(),
            design: formElements.design.value,
        };
        callbacks.saveItem(formData, currentEditingItemId);
        closeModal();
    });
    // --- Form Elements ---
    formElements.isRecurring.addEventListener('change', () => {
        formElements.recurringOptions.style.display = formElements.isRecurring.checked ? 'grid' : 'none';
    });
    // --- List Item Actions ---
    listContainer.addEventListener('click', (event) => {
        const target = event.target;
        const button = target.closest('button');
        if (!button)
            return;
        const itemElement = button.closest('.countdown-item');
        const itemId = itemElement === null || itemElement === void 0 ? void 0 : itemElement.getAttribute('data-id');
        if (!itemId)
            return;
        if (button.classList.contains('edit-button'))
            callbacks.requestEditItem(itemId);
        else if (button.classList.contains('copy-button'))
            callbacks.requestCopyItem(itemId);
        else if (button.classList.contains('delete-button'))
            callbacks.deleteItem(itemId);
    });
    // --- Other Controls ---
    categoryFilterSelect.addEventListener('change', () => {
        categoryFilter = categoryFilterSelect.value;
        callbacks.updateFilter(categoryFilter);
    });
    exportButton.addEventListener('click', callbacks.exportItems);
    importButton.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
        var _a;
        const file = (_a = importInput.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            callbacks.importItems(file);
            importInput.value = '';
        }
    });
}
// --- Theme Management ---
export function applyTheme(themeName) {
    // --- DEBUG: Confirm applyTheme is called ---
    console.log('Applying theme via applyTheme():', themeName);
    if (themeName === 'retro') {
        bodyElement.setAttribute('data-theme', 'retro');
    }
    else {
        bodyElement.removeAttribute('data-theme'); // Default theme has no attribute
    }
    // --- DEBUG: Log body attribute after change ---
    console.log('Body data-theme attribute is now:', bodyElement.getAttribute('data-theme'));
}
// --- Modal Management ---
export function openModal(mode, itemId, prefillData) {
    if (!modalOverlay || !itemForm || !formElements)
        return;
    currentModalMode = mode;
    currentEditingItemId = (mode === 'edit' && itemId) ? itemId : null;
    resetForm();
    if (mode === 'edit') {
        modalTitle.textContent = 'Edit Countdown';
        modalSaveButton.textContent = 'Update';
        if (prefillData) {
            populateForm(prefillData);
            formElements.id.value = itemId || '';
        }
        else {
            console.error("Edit mode - data missing for ID:", itemId);
            closeModal();
            return;
        }
    }
    else {
        modalTitle.textContent = 'Add Countdown';
        modalSaveButton.textContent = 'Add';
        if (prefillData) { // Copying
            populateForm(Object.assign(Object.assign({}, prefillData), { name: `${prefillData.name || ''} (Copy)` }));
            formElements.id.value = '';
            currentEditingItemId = null;
        }
        else { // New item
            setDefaultDateTime();
        }
    }
    updateCategoryDatalist(categories); // Populate datalist when modal opens
    modalOverlay.classList.add('visible');
    formElements.name.focus();
}
function setDefaultDateTime() {
    if (!formElements)
        return;
    const now = new Date();
    let targetTime = new Date(now);
    const currentMinutes = targetTime.getMinutes();
    if (currentMinutes === 0 || currentMinutes === 30)
        targetTime.setMinutes(currentMinutes + 30);
    else if (currentMinutes < 30)
        targetTime.setMinutes(30, 0, 0);
    else {
        targetTime.setMinutes(0, 0, 0);
        targetTime.setHours(targetTime.getHours() + 1);
    }
    const year = targetTime.getFullYear();
    const month = (targetTime.getMonth() + 1).toString().padStart(2, '0');
    const day = targetTime.getDate().toString().padStart(2, '0');
    const hours = targetTime.getHours().toString().padStart(2, '0');
    const minutes = targetTime.getMinutes().toString().padStart(2, '0');
    formElements.date.value = `${year}-${month}-${day}`;
    formElements.time.value = `${hours}:${minutes}`;
}
export function closeModal() {
    if (!modalOverlay)
        return;
    modalOverlay.classList.remove('visible');
    resetForm();
    currentEditingItemId = null;
    currentModalMode = 'add';
}
function resetForm() {
    if (!itemForm || !formElements)
        return;
    itemForm.reset();
    formElements.recurringOptions.style.display = 'none';
    formElements.id.value = '';
    formElements.design.value = 'default';
    formElements.recurrenceInterval.value = 'weekly';
}
function populateForm(itemData) {
    if (!formElements)
        return;
    formElements.name.value = itemData.name || '';
    formElements.category.value = itemData.category || 'Uncategorized';
    formElements.note.value = itemData.note || '';
    formElements.link.value = itemData.link || '';
    formElements.design.value = itemData.design || 'default';
    if (itemData.targetDate) {
        try {
            const { date, time } = formatDateTimeForInput(itemData.targetDate);
            formElements.date.value = date;
            formElements.time.value = time;
        }
        catch (e) {
            formElements.date.value = '';
            formElements.time.value = '';
        }
    }
    else {
        formElements.date.value = '';
        formElements.time.value = '';
    }
    formElements.isRecurring.checked = !!itemData.isRecurring;
    if (itemData.isRecurring) {
        formElements.recurringOptions.style.display = 'grid';
        formElements.recurrenceInterval.value = itemData.recurrenceInterval || 'weekly';
        formElements.recurrenceEndDate.value = itemData.recurrenceEndDate ? itemData.recurrenceEndDate.split('T')[0] : '';
    }
    else {
        formElements.recurringOptions.style.display = 'none';
    }
}
// --- Rendering ---
export function renderCountdownList(items) {
    if (!listContainer)
        return;
    const scrollY = window.scrollY;
    listContainer.innerHTML = '';
    const localCategories = new Set();
    localCategories.add('all');
    const now = Date.now();
    items.forEach(item => {
        const categoryName = (item.category || 'Uncategorized').trim();
        localCategories.add(categoryName);
    });
    categories = localCategories;
    const filteredItems = items.filter(item => categoryFilter === 'all' || (item.category || 'Uncategorized') === categoryFilter);
    filteredItems.sort((a, b) => {
        const aIsPassed = new Date(a.targetDate).getTime() <= now;
        const bIsPassed = new Date(b.targetDate).getTime() <= now;
        if (!aIsPassed && !bIsPassed)
            return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
        else if (aIsPassed && bIsPassed)
            return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
        else if (!aIsPassed && bIsPassed)
            return -1;
        else
            return 1;
    });
    if (filteredItems.length === 0) {
        listContainer.innerHTML = `<p class="no-items">No countdowns found${categoryFilter !== 'all' ? ` in category "${escapeHtml(categoryFilter)}"` : ''}. Add one!</p>`;
    }
    else {
        filteredItems.forEach(item => {
            try {
                const itemElement = createCountdownElement(item);
                listContainer.appendChild(itemElement);
            }
            catch (e) {
                console.error(`Error creating element for item ${item.id}:`, e);
            }
        });
    }
    updateCategoryFilterOptions();
    window.scrollTo({ top: scrollY, behavior: 'instant' });
}
function createCountdownElement(item) {
    const element = document.createElement('div');
    element.classList.add('countdown-item', `design-${item.design}`);
    element.setAttribute('data-id', item.id);
    const targetDate = new Date(item.targetDate);
    if (isNaN(targetDate.getTime())) {
        element.innerHTML = `<div class="item-header"><span class="item-name">INVALID ITEM DATA</span></div><p>Error: Invalid target date.</p>`;
        element.classList.add('invalid-item');
        return element;
    }
    const timeRemainingMs = targetDate.getTime() - Date.now();
    const isCurrentlyPast = item.isPast;
    if (isCurrentlyPast)
        element.classList.add('past');
    const safeName = escapeHtml(item.name);
    const safeCategory = escapeHtml(item.category || 'Uncategorized');
    const safeNote = escapeHtml(item.note || '');
    const safeLink = item.link ? escapeHtml(item.link) : '';
    const linkHref = ensureHttp(item.link || '#');
    const editButtonHtml = `<button class="edit-button" title="Edit Item">✏️</button>`;
    const copyButtonHtml = `<button class="copy-button" title="Copy Item">📋</button>`;
    const deleteButtonHtml = `<button class="delete-button button-danger-subtle" title="Delete Item">🗑️</button>`;
    element.innerHTML = `
        <div class="item-header">
            <span class="item-name">${safeName}</span>
            <div class="item-actions">
                 ${editButtonHtml} ${copyButtonHtml} ${deleteButtonHtml}
            </div>
        </div>
        <div class="item-timer" data-target-date="${item.targetDate}">
            ${isCurrentlyPast ? 'Now!' : formatTimeRemaining(timeRemainingMs)}
        </div>
        <div class="item-target-date">
            Target: ${formatDisplayDate(item.targetDate)}
            ${item.isRecurring ? `<span class="recurring-info">(Repeats ${item.recurrenceInterval}${item.recurrenceEndDate ? ` until ${formatDisplayDate(item.recurrenceEndDate).split(',')[0]}` : ''})</span>` : ''}
        </div>
        <div class="item-details">
            <span class="item-category">${safeCategory}</span>
            ${safeNote ? `<p class="item-note"><strong>Note:</strong> ${safeNote.replace(/\n/g, '<br>')}</p>` : ''}
            ${safeLink ? `<p class="item-link"><strong>Link:</strong> <a href="${linkHref}" target="_blank" rel="noopener noreferrer">${safeLink}</a></p>` : ''}
            <p class="item-created"><em>Added: ${formatDisplayDate(item.createdAt)}</em></p>
        </div>
    `;
    return element;
}
export function updateTimers(items) {
    if (!listContainer)
        return;
    const itemElements = listContainer.querySelectorAll('.countdown-item:not(.past)');
    const now = Date.now();
    itemElements.forEach(element => {
        const timerElement = element.querySelector('.item-timer');
        const targetDateStr = timerElement === null || timerElement === void 0 ? void 0 : timerElement.getAttribute('data-target-date');
        if (timerElement && targetDateStr) {
            try {
                const targetDate = new Date(targetDateStr);
                if (isNaN(targetDate.getTime()))
                    return;
                const timeRemainingMs = targetDate.getTime() - now;
                timerElement.textContent = (timeRemainingMs > 0) ? formatTimeRemaining(timeRemainingMs) : "Now!";
            }
            catch (e) { /* ignore error */ }
        }
    });
}
function updateCategoryFilterOptions() {
    if (!categoryFilterSelect)
        return;
    const currentSelection = categoryFilterSelect.value;
    while (categoryFilterSelect.options.length > 1)
        categoryFilterSelect.remove(1);
    const sortedCategories = Array.from(categories)
        .filter(cat => cat && cat !== 'all')
        .sort((a, b) => a.localeCompare(b));
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterSelect.appendChild(option);
    });
    if (Array.from(categoryFilterSelect.options).some(opt => opt.value === currentSelection)) {
        categoryFilterSelect.value = currentSelection;
    }
    else {
        categoryFilterSelect.value = 'all';
        categoryFilter = 'all';
    }
}
function updateCategoryDatalist(allCategories) {
    if (!categoryDatalist)
        return;
    categoryDatalist.innerHTML = '';
    const sortedCategories = Array.from(allCategories)
        .filter(cat => cat && cat !== 'all' && cat !== 'Uncategorized')
        .sort((a, b) => a.localeCompare(b));
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        categoryDatalist.appendChild(option);
    });
    console.log('Updated category datalist with:', sortedCategories);
}
// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (!unsafe)
        return "";
    try {
        const div = document.createElement('div');
        div.textContent = unsafe;
        let escaped = div.innerHTML;
        escaped = escaped.replace(/'/g, '\'');
        return escaped;
    }
    catch (e) {
        console.warn("DOM escaping failed, using basic regex replace.");
        return unsafe
            .replace(/&/g, "&")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "\"")
            .replace(/'/g, "'");
    }
}
function ensureHttp(link) {
    if (!link || link === '#')
        return '#';
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(link)) {
        if (link.includes('.') && !link.includes(' ') && !link.startsWith('/')) {
            return `http://${link}`;
        }
        return link;
    }
    return link;
}
// --- End of ui.ts ---
