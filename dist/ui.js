import { formatTimeRemaining, formatDisplayDate, formatDateTimeForInput } from './utils.js';
// --- State ---
let categoryFilter = 'all';
let categories = new Set();
let currentModalMode = 'add';
let currentEditingItemId = null;
const NO_CUSTOM_COLOR_VALUE = '#ffffff'; // Represents "no custom color"
// --- DOM Element Selectors ---
const bodyElement = document.body;
export const listContainer = document.getElementById('countdown-list'); // Export for app.ts if needed
const categoryFilterSelect = document.getElementById('category-filter');
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importInput = document.getElementById('import-file');
const addNewButton = document.getElementById('add-new-button');
const themeToggleButton = document.getElementById('theme-toggle-button');
// Modal Elements
const modalOverlay = document.getElementById('item-modal');
const modalContent = modalOverlay === null || modalOverlay === void 0 ? void 0 : modalOverlay.querySelector('.modal-content');
const modalCloseButton = document.getElementById('modal-close-button');
const modalCancelButton = document.getElementById('modal-cancel-button');
const modalSaveButton = document.getElementById('modal-save-button');
const modalTitle = document.getElementById('modal-title');
const itemForm = document.getElementById('item-form');
const categoryDatalist = document.getElementById('category-suggestions');
// Form Elements Reference
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
    customColor: itemForm.elements.namedItem('item-custom-color'),
    resetColorButton: document.getElementById('reset-color-button'),
} : null;
export function setupUIEventListeners(callbacks) {
    console.log('setupUIEventListeners called.');
    // Essential element check
    if (!listContainer || !categoryFilterSelect || !exportButton || !importButton || !importInput || !addNewButton || !modalOverlay || !modalCloseButton || !modalCancelButton || !itemForm || !formElements || !themeToggleButton || !categoryDatalist) {
        console.error("CRITICAL ERROR: One or more essential UI elements could not be found. Aborting event listener setup.");
        alert("Initialization Error: UI components missing. Cannot setup interactions.");
        return;
    }
    // --- Initialize SortableJS ---
    if (typeof Sortable !== 'undefined') {
        try {
            new Sortable(listContainer, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.item-actions, .item-actions button, a, input, select, textarea', // Prevent drag on interactive elements
                preventOnFilter: true,
                onEnd: (evt) => {
                    if (evt.oldIndex !== undefined && evt.newIndex !== undefined && evt.oldIndex !== evt.newIndex) {
                        const itemId = evt.item.getAttribute('data-id');
                        if (itemId) {
                            console.log(`UI: Item ${itemId} moved from visual index ${evt.oldIndex} to ${evt.newIndex}`);
                            callbacks.orderChanged(itemId, evt.oldIndex, evt.newIndex);
                        }
                        else {
                            console.error("UI ERROR: Dragged item missing data-id attribute.");
                        }
                    }
                },
            });
            console.log("SortableJS successfully initialized on element:", listContainer);
        }
        catch (error) {
            console.error("Error initializing SortableJS:", error);
            alert("Could not enable drag-and-drop functionality.");
        }
    }
    else {
        console.warn("SortableJS library not found. Drag-and-drop reordering disabled.");
    }
    // --- Theme Toggle ---
    themeToggleButton.addEventListener('click', () => {
        const currentTheme = bodyElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'retro' ? 'default' : 'retro';
        applyTheme(newTheme);
        callbacks.themeChanged(newTheme);
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
        if (!formElements) {
            console.error("Form elements not available for submission.");
            return;
        }
        // ... (date/time validation) ...
        // --- DEBUG COLOR VALUES HERE ---
        const selectedColorValue = formElements.customColor.value;
        const isDefaultColor = selectedColorValue.toLowerCase() === NO_CUSTOM_COLOR_VALUE.toLowerCase();
        const calculatedColorToSave = isDefaultColor ? undefined : selectedColorValue;
        console.log("UI Submit - Raw Color Input Value:", selectedColorValue);
        console.log("UI Submit - Is Default Color (#ffffff)?", isDefaultColor);
        console.log("UI Submit - Calculated Color to Save:", calculatedColorToSave);
        // --- END DEBUG ---
        // Assemble form data DTO
        const formData = {
            name: formElements.name.value.trim() || 'Unnamed Event',
            targetDateTime: `${formElements.date.value}T${formElements.time.value || '00:00'}`,
            isRecurring: formElements.isRecurring.checked,
            recurrenceInterval: formElements.isRecurring.checked ? formElements.recurrenceInterval.value : undefined,
            recurrenceEndDate: formElements.isRecurring.checked && formElements.recurrenceEndDate.value ? formElements.recurrenceEndDate.value : null,
            category: formElements.category.value.trim() || 'Uncategorized',
            note: formElements.note.value.trim(),
            link: formElements.link.value.trim(),
            design: formElements.design.value,
            customColor: calculatedColorToSave, // Use the calculated value
        };
        // --- Log the final formData object being sent ---
        console.log("UI Submit - Final formData being sent:", JSON.stringify(formData));
        callbacks.saveItem(formData, currentEditingItemId);
        closeModal();
    });
    // --- Form Element Interactions ---
    formElements.isRecurring.addEventListener('change', () => {
        if (!formElements)
            return;
        formElements.recurringOptions.style.display = formElements.isRecurring.checked ? 'grid' : 'none';
    });
    // Color Picker Interactions
    formElements.customColor.addEventListener('input', () => {
        if (formElements)
            formElements.resetColorButton.disabled = false; // Enable reset when user interacts
    });
    formElements.resetColorButton.addEventListener('click', () => {
        if (formElements) {
            formElements.customColor.value = NO_CUSTOM_COLOR_VALUE;
            formElements.resetColorButton.disabled = true;
        }
    });
    // --- List Item Actions (Edit/Copy/Delete) ---
    listContainer.addEventListener('click', (event) => {
        const target = event.target;
        const actionButton = target.closest('.item-actions button'); // Target only buttons within actions
        if (!actionButton)
            return;
        const itemElement = actionButton.closest('.countdown-item');
        const itemId = itemElement === null || itemElement === void 0 ? void 0 : itemElement.getAttribute('data-id');
        if (!itemId)
            return;
        if (actionButton.classList.contains('edit-button'))
            callbacks.requestEditItem(itemId);
        else if (actionButton.classList.contains('copy-button'))
            callbacks.requestCopyItem(itemId);
        else if (actionButton.classList.contains('delete-button'))
            callbacks.deleteItem(itemId);
    });
    // --- Other Controls (Filter, Import/Export) ---
    categoryFilterSelect.addEventListener('change', () => {
        categoryFilter = categoryFilterSelect.value; // Update internal filter state
        callbacks.updateFilter(categoryFilter); // Notify app logic (which triggers re-render)
    });
    exportButton.addEventListener('click', callbacks.exportItems);
    importButton.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
        var _a;
        const file = (_a = importInput.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            callbacks.importItems(file);
            importInput.value = ''; // Reset file input after selection
        }
    });
}
// --- Theme Management ---
export function applyTheme(themeName) {
    console.log('Applying theme via applyTheme():', themeName);
    if (themeName === 'retro') {
        bodyElement.setAttribute('data-theme', 'retro');
    }
    else {
        bodyElement.removeAttribute('data-theme'); // Default theme has no attribute
    }
    console.log('Body data-theme attribute is now:', bodyElement.getAttribute('data-theme'));
}
// --- Modal Management ---
export function openModal(mode, itemId, prefillData) {
    if (!modalOverlay || !itemForm || !formElements) {
        console.error("Cannot open modal: Required elements missing.");
        return;
    }
    currentModalMode = mode;
    currentEditingItemId = (mode === 'edit' && itemId) ? itemId : null;
    resetForm(); // Reset form fields before populating
    if (mode === 'edit') {
        modalTitle.textContent = 'Edit Countdown';
        modalSaveButton.textContent = 'Update';
        if (prefillData) {
            populateForm(prefillData);
            formElements.id.value = itemId || ''; // Set hidden ID
        }
        else {
            console.error("Edit mode opened without prefill data for ID:", itemId);
            alert("Error: Could not load item data for editing.");
            closeModal();
            return;
        }
    }
    else { // mode === 'add'
        modalTitle.textContent = 'Add Countdown';
        modalSaveButton.textContent = 'Add';
        if (prefillData) { // Copying existing item
            populateForm(Object.assign(Object.assign({}, prefillData), { name: `${prefillData.name || ''} (Copy)` }));
            formElements.id.value = ''; // Clear ID for copy
            currentEditingItemId = null;
        }
        else { // Adding a brand new item
            setDefaultDateTime(); // Set default date/time
            formElements.id.value = ''; // Ensure ID is clear
            formElements.customColor.value = NO_CUSTOM_COLOR_VALUE; // Set default color
            formElements.resetColorButton.disabled = true; // Disable reset for new
        }
    }
    updateCategoryDatalist(categories); // Refresh suggestions
    modalOverlay.classList.add('visible');
    formElements.name.focus(); // Focus name field
}
function setDefaultDateTime() {
    if (!formElements)
        return;
    const now = new Date();
    let targetTime = new Date(now);
    // Logic to set default time (e.g., next half hour)
    const currentMinutes = targetTime.getMinutes();
    if (currentMinutes === 0 || currentMinutes === 30)
        targetTime.setMinutes(currentMinutes + 30);
    else if (currentMinutes < 30)
        targetTime.setMinutes(30, 0, 0);
    else {
        targetTime.setMinutes(0, 0, 0);
        targetTime.setHours(targetTime.getHours() + 1);
    }
    // Format for input fields
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
    resetForm(); // Ensure form is clean for next opening
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
    // Reset color picker
    formElements.customColor.value = NO_CUSTOM_COLOR_VALUE;
    formElements.resetColorButton.disabled = true;
}
function populateForm(itemData) {
    if (!formElements)
        return;
    // Populate standard fields
    formElements.name.value = itemData.name || '';
    formElements.category.value = itemData.category || 'Uncategorized';
    formElements.note.value = itemData.note || '';
    formElements.link.value = itemData.link || '';
    formElements.design.value = itemData.design || 'default';
    // Populate date/time
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
    // Populate recurring fields
    formElements.isRecurring.checked = !!itemData.isRecurring;
    if (itemData.isRecurring) {
        formElements.recurringOptions.style.display = 'grid';
        formElements.recurrenceInterval.value = itemData.recurrenceInterval || 'weekly';
        formElements.recurrenceEndDate.value = itemData.recurrenceEndDate ? itemData.recurrenceEndDate.split('T')[0] : '';
    }
    else {
        formElements.recurringOptions.style.display = 'none';
    }
    // Populate color picker
    formElements.customColor.value = itemData.customColor || NO_CUSTOM_COLOR_VALUE;
    formElements.resetColorButton.disabled = !itemData.customColor; // Enable reset only if a custom color exists
}
// --- Rendering ---
export function renderCountdownList(items) {
    if (!listContainer)
        return;
    const scrollY = window.scrollY;
    listContainer.innerHTML = ''; // Clear previous items
    const localCategories = new Set();
    localCategories.add('all');
    const now = Date.now();
    // Update global categories set from ALL items
    items.forEach(item => {
        const categoryName = (item.category || 'Uncategorized').trim();
        if (categoryName)
            localCategories.add(categoryName);
    });
    categories = localCategories;
    // Apply category filter (using the state variable `categoryFilter`)
    const filteredItems = items.filter(item => categoryFilter === 'all' || (item.category || 'Uncategorized') === categoryFilter);
    // Sort filtered items for rendering consistency (date/status based)
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
    // Render items or 'no items' message
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
    updateCategoryFilterOptions(); // Update dropdown options
    window.scrollTo({ top: scrollY, behavior: 'instant' }); // Restore scroll
}
function createCountdownElement(item) {
    const element = document.createElement('div');
    element.classList.add('countdown-item', `design-${item.design || 'default'}`);
    if (item.id)
        element.setAttribute('data-id', item.id);
    else
        console.warn("Item missing ID during element creation:", item);
    // --- Log color received by this function ---
    console.log(`UI Create Element (${item.id || 'NO ID'}) - Received item.customColor:`, item.customColor);
    // Handle invalid date
    const targetDate = new Date(item.targetDate);
    if (isNaN(targetDate.getTime())) {
        element.innerHTML = `<div class="item-header"><span class="item-name text-danger">INVALID ITEM DATA</span></div><p>Error: Invalid target date.</p>`;
        element.classList.add('invalid-item', 'border-danger');
        return element;
    }
    // Handle past state
    const timeRemainingMs = targetDate.getTime() - Date.now();
    const isCurrentlyPast = item.isPast !== undefined ? item.isPast : (timeRemainingMs <= 0);
    if (isCurrentlyPast)
        element.classList.add('past');
    // Apply custom color if present
    if (item.customColor && typeof item.customColor === 'string' && item.customColor.startsWith('#')) { // Add extra check for validity
        // --- Log setting the color ---
        console.log(`UI Create Element (${item.id || 'NO ID'}) - SETTING CSS variable to:`, item.customColor);
        element.style.setProperty('--item-custom-bg-color', item.customColor);
        element.classList.add('has-custom-color');
    }
    else {
        // --- Log removing the color ---
        console.log(`UI Create Element (${item.id || 'NO ID'}) - REMOVING CSS variable (Color was: ${item.customColor})`);
        element.style.removeProperty('--item-custom-bg-color'); // Ensure removal if not set or invalid
        element.classList.remove('has-custom-color');
    }
    // Sanitize content
    const safeName = escapeHtml(item.name || 'Unnamed Event');
    const safeCategory = escapeHtml(item.category || 'Uncategorized');
    const safeNote = escapeHtml(item.note || '');
    const safeLink = item.link ? escapeHtml(item.link) : '';
    const linkHref = ensureHttp(item.link || '#');
    // Action buttons HTML
    const editButtonHtml = `<button class="edit-button" title="Edit Item">✏️</button>`;
    const copyButtonHtml = `<button class="copy-button" title="Copy Item">📋</button>`;
    const deleteButtonHtml = `<button class="delete-button" title="Delete Item">🗑️</button>`;
    // Assemble inner HTML
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
// --- Timer Update ---
export function updateTimers(items) {
    if (!listContainer)
        return;
    const itemElements = listContainer.querySelectorAll('.countdown-item:not(.past):not(.invalid-item)');
    const now = Date.now();
    itemElements.forEach(element => {
        const timerElement = element.querySelector('.item-timer');
        const targetDateStr = timerElement === null || timerElement === void 0 ? void 0 : timerElement.getAttribute('data-target-date');
        if (!timerElement || !targetDateStr)
            return;
        try {
            const targetDate = new Date(targetDateStr);
            if (isNaN(targetDate.getTime())) {
                timerElement.textContent = "Error";
                return;
            }
            ;
            const timeRemainingMs = targetDate.getTime() - now;
            timerElement.textContent = (timeRemainingMs > 0) ? formatTimeRemaining(timeRemainingMs) : "Now!";
            // Note: This function only updates display; actual past state change is handled by checkPastEvents in app.ts
        }
        catch (e) {
            console.error("Error updating timer display:", e);
            timerElement.textContent = "Error";
        }
    });
}
// --- Category Filtering ---
function updateCategoryFilterOptions() {
    if (!categoryFilterSelect)
        return;
    const currentSelection = categoryFilterSelect.value;
    while (categoryFilterSelect.options.length > 1)
        categoryFilterSelect.remove(1);
    const sortedCategories = Array.from(categories)
        .filter(cat => cat && cat !== 'all')
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
        if (categoryFilter !== 'all')
            categoryFilter = 'all'; // Sync state if selection removed
    }
}
function updateCategoryDatalist(allCategories) {
    if (!categoryDatalist)
        return;
    categoryDatalist.innerHTML = '';
    const sortedCategories = Array.from(allCategories)
        .filter(cat => cat && cat !== 'all' && cat !== 'Uncategorized')
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        categoryDatalist.appendChild(option);
    });
}
// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined)
        return "";
    try {
        if (typeof document !== 'undefined') {
            const textNode = document.createTextNode(unsafe);
            const div = document.createElement('div');
            div.appendChild(textNode);
            return div.innerHTML;
        }
        else {
            throw new Error("DOM not available");
        }
    }
    catch (e) {
        console.warn("DOM escaping method failed, using basic regex replace.");
        return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").replace(/'/g, "'");
    }
}
function ensureHttp(link) {
    if (!link || link === '#')
        return '#';
    try {
        if (/^(https?:\/\/|mailto:|tel:)/i.test(link))
            return link;
        if (link.includes('.') && !link.includes(' ') && !link.startsWith('/') && !link.startsWith('#') && !link.startsWith('//')) {
            return `http://${link}`;
        }
        return link;
    }
    catch (e) {
        return link;
    }
}
// --- End of ui.ts ---
