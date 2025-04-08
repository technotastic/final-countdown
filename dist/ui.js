import { formatTimeRemaining, formatDisplayDate, formatDateTimeForInput } from './utils.js';
// --- State ---
let categoryFilter = 'all';
let categories = new Set(); // Keep track of ALL unique categories encountered
let currentModalMode = 'add';
let currentEditingItemId = null;
// REMOVED ResizeObserver state
// --- DOM Element Selectors ---
const bodyElement = document.body;
export const listContainer = document.getElementById('countdown-list'); // Export if needed by app.ts
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
    if (!listContainer || !categoryFilterSelect || !exportButton || !importButton || !importInput || !addNewButton || !modalOverlay || !modalCloseButton || !modalCancelButton || !itemForm || !formElements || !themeToggleButton || !categoryDatalist) {
        console.error("CRITICAL ERROR: One or more essential UI elements could not be found. Aborting event listener setup.");
        alert("Initialization Error: UI components missing.");
        return;
    }
    // --- REMOVED Resize Observer Setup ---
    // --- Initialize SortableJS ---
    if (typeof Sortable !== 'undefined') {
        new Sortable(listContainer, {
            animation: 150, // ms, animation speed moving items when sorting, `0` — without animation
            ghostClass: 'sortable-ghost', // Class name for the drop placeholder
            chosenClass: 'sortable-chosen', // Class name for the chosen item
            dragClass: 'sortable-drag', // Class name for the dragging item
            filter: '.item-actions, .item-actions button, a, input, select, textarea', // Prevent drag start on interactive elements
            preventOnFilter: true, // Call `event.preventDefault()` when triggered `filter`
            onEnd: (evt) => {
                // Check if the item actually moved to a new position
                if (evt.oldIndex !== undefined && evt.newIndex !== undefined && evt.oldIndex !== evt.newIndex) {
                    const itemId = evt.item.getAttribute('data-id');
                    if (itemId) {
                        console.log(`Item ${itemId} moved from index ${evt.oldIndex} to ${evt.newIndex}`);
                        // Notify the main application logic about the change
                        callbacks.orderChanged(itemId, evt.oldIndex, evt.newIndex);
                    }
                    else {
                        console.error("Dragged item is missing data-id attribute.");
                        // Potentially try to re-render to fix state if ID is missing
                    }
                }
            },
        });
        console.log("SortableJS initialized on #countdown-list.");
    }
    else {
        console.warn("SortableJS library not found. Drag-and-drop reordering disabled.");
    }
    // --- Theme Toggle ---
    themeToggleButton.addEventListener('click', () => {
        console.log('Theme toggle button CLICKED!');
        const currentTheme = bodyElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'retro' ? 'default' : 'retro';
        console.log('Changing theme to:', newTheme);
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
        if (!formElements)
            return;
        formElements.recurringOptions.style.display = formElements.isRecurring.checked ? 'grid' : 'none';
    });
    // --- List Item Actions ---
    listContainer.addEventListener('click', (event) => {
        const target = event.target;
        // Check if the click is on a button WITHIN the actions container
        const actionButton = target.closest('.item-actions button');
        if (!actionButton)
            return; // Exit if click wasn't on an action button
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
        } // Clear input after selection
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
            formElements.id.value = itemId || ''; // Populate hidden ID field
        }
        else {
            console.error("Edit mode - data missing for ID:", itemId);
            alert("Error: Could not load item data for editing.");
            closeModal();
            return;
        }
    }
    else { // mode === 'add'
        modalTitle.textContent = 'Add Countdown';
        modalSaveButton.textContent = 'Add';
        if (prefillData) { // Handling copy
            populateForm(Object.assign(Object.assign({}, prefillData), { name: `${prefillData.name || ''} (Copy)` }));
            formElements.id.value = ''; // Ensure ID is cleared for copy
            currentEditingItemId = null; // Not editing when copying
        }
        else { // Handling new item
            setDefaultDateTime();
            formElements.id.value = ''; // Ensure ID is cleared for new
        }
    }
    updateCategoryDatalist(categories); // Populate datalist with current categories
    modalOverlay.classList.add('visible');
    formElements.name.focus(); // Focus the name field when opening
}
function setDefaultDateTime() {
    if (!formElements)
        return;
    const now = new Date();
    let targetTime = new Date(now);
    // Set default time to next half-hour increment
    const currentMinutes = targetTime.getMinutes();
    if (currentMinutes === 0 || currentMinutes === 30) {
        targetTime.setMinutes(currentMinutes + 30);
    }
    else if (currentMinutes < 30) {
        targetTime.setMinutes(30, 0, 0);
    }
    else { // currentMinutes > 30
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
    resetForm(); // Clear form on close
    currentEditingItemId = null;
    currentModalMode = 'add';
}
function resetForm() {
    if (!itemForm || !formElements)
        return;
    itemForm.reset(); // Resets all form fields to default values (or blank)
    // Manually reset things not covered by form.reset()
    formElements.recurringOptions.style.display = 'none'; // Hide recurring options
    formElements.id.value = ''; // Clear hidden ID field
    formElements.design.value = 'default'; // Reset design select
    formElements.recurrenceInterval.value = 'weekly'; // Reset recurrence interval
    // Clear any validation states if you added them
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
            console.error("Error formatting date/time for form:", e);
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
        formElements.recurrenceEndDate.value = itemData.recurrenceEndDate ? itemData.recurrenceEndDate.split('T')[0] : ''; // Format for date input
    }
    else {
        formElements.recurringOptions.style.display = 'none';
    }
}
// --- Rendering ---
export function renderCountdownList(items) {
    if (!listContainer)
        return;
    // --- REMOVED ResizeObserver cleanup ---
    const scrollY = window.scrollY; // Preserve scroll position
    listContainer.innerHTML = ''; // Clear existing items before rendering new list
    const localCategories = new Set();
    localCategories.add('all'); // Always include 'all'
    const now = Date.now();
    // Update global categories set from ALL items (before filtering)
    items.forEach(item => {
        const categoryName = (item.category || 'Uncategorized').trim();
        if (categoryName) { // Avoid adding blank categories
            localCategories.add(categoryName);
        }
    });
    categories = localCategories;
    // Apply category filter
    const filteredItems = items.filter(item => categoryFilter === 'all' || (item.category || 'Uncategorized') === categoryFilter);
    // Sort the items to be rendered (based on date/status, drag-drop order is reflected in `items` array)
    filteredItems.sort((a, b) => {
        const aIsPassed = new Date(a.targetDate).getTime() <= now;
        const bIsPassed = new Date(b.targetDate).getTime() <= now;
        if (!aIsPassed && !bIsPassed) { // Both upcoming: Sort by soonest first
            return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
        }
        else if (aIsPassed && bIsPassed) { // Both past: Sort by most recently past first
            return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
        }
        else if (!aIsPassed && bIsPassed) { // a upcoming, b past: a comes first
            return -1;
        }
        else { // a past, b upcoming: b comes first
            return 1;
        }
    });
    if (filteredItems.length === 0) {
        listContainer.innerHTML = `<p class="no-items">No countdowns found${categoryFilter !== 'all' ? ` in category "${escapeHtml(categoryFilter)}"` : ''}. Add one!</p>`;
    }
    else {
        // Render based on the current order in the filteredItems array
        filteredItems.forEach(item => {
            try {
                const itemElement = createCountdownElement(item);
                listContainer.appendChild(itemElement);
                // --- REMOVED Resize observation ---
            }
            catch (e) {
                console.error(`Error creating element for item ${item.id}:`, e);
            }
        });
    }
    updateCategoryFilterOptions(); // Update dropdown after rendering
    window.scrollTo({ top: scrollY, behavior: 'instant' }); // Restore scroll position
}
function createCountdownElement(item) {
    const element = document.createElement('div');
    // Add base class, design class, and data-id for SortableJS and actions
    element.classList.add('countdown-item', `design-${item.design || 'default'}`);
    element.setAttribute('data-id', item.id);
    const targetDate = new Date(item.targetDate);
    if (isNaN(targetDate.getTime())) {
        // Handle invalid date gracefully
        element.innerHTML = `<div class="item-header"><span class="item-name text-danger">INVALID ITEM DATA</span></div><p>Error: Invalid target date.</p>`;
        element.classList.add('invalid-item', 'border-danger'); // Add some visual indication
        return element;
    }
    const timeRemainingMs = targetDate.getTime() - Date.now();
    // Use the pre-calculated isPast property from the model if available
    const isCurrentlyPast = item.isPast !== undefined ? item.isPast : (timeRemainingMs <= 0);
    if (isCurrentlyPast) {
        element.classList.add('past');
    }
    // Sanitize content before inserting into innerHTML
    const safeName = escapeHtml(item.name || 'Unnamed Event');
    const safeCategory = escapeHtml(item.category || 'Uncategorized');
    const safeNote = escapeHtml(item.note || '');
    const safeLink = item.link ? escapeHtml(item.link) : '';
    const linkHref = ensureHttp(item.link || '#'); // Ensure link is usable
    // Action buttons
    const editButtonHtml = `<button class="edit-button" title="Edit Item">✏️</button>`;
    const copyButtonHtml = `<button class="copy-button" title="Copy Item">📋</button>`;
    const deleteButtonHtml = `<button class="delete-button" title="Delete Item">🗑️</button>`; // Removed button-danger-subtle, style via CSS selector
    element.innerHTML = `
        <div class="item-header">
            <span class="item-name">${safeName}</span>
            <div class="item-actions">
                 ${editButtonHtml}
                 ${copyButtonHtml}
                 ${deleteButtonHtml}
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
    const itemElements = listContainer.querySelectorAll('.countdown-item:not(.past):not(.invalid-item)'); // Select only valid, upcoming items
    const now = Date.now();
    itemElements.forEach(element => {
        const timerElement = element.querySelector('.item-timer');
        const targetDateStr = timerElement === null || timerElement === void 0 ? void 0 : timerElement.getAttribute('data-target-date');
        if (timerElement && targetDateStr) {
            try {
                const targetDate = new Date(targetDateStr);
                // Double check date validity before calculation
                if (isNaN(targetDate.getTime())) {
                    timerElement.textContent = "Error"; // Indicate bad date
                    return;
                }
                ;
                const timeRemainingMs = targetDate.getTime() - now;
                if (timeRemainingMs <= 0) {
                    timerElement.textContent = "Now!";
                    // Optionally, add the 'past' class here if not already present,
                    // though a full re-render is often better for consistency
                    if (!element.classList.contains('past')) {
                        element.classList.add('past');
                        // You might want to trigger a re-sort/re-render via the main app logic
                        // if an item becomes past during the interval update.
                    }
                }
                else {
                    timerElement.textContent = formatTimeRemaining(timeRemainingMs);
                }
            }
            catch (e) {
                console.error("Error updating timer for element:", element, e);
                timerElement.textContent = "Error"; // Display error in timer spot
            }
        }
    });
}
// --- Category Filtering ---
function updateCategoryFilterOptions() {
    if (!categoryFilterSelect)
        return;
    const currentSelection = categoryFilterSelect.value;
    // Clear existing options (except the "All Categories" default)
    while (categoryFilterSelect.options.length > 1) {
        categoryFilterSelect.remove(1);
    }
    // Sort and add options from the global 'categories' set
    const sortedCategories = Array.from(categories)
        .filter(cat => cat && cat !== 'all') // Exclude 'all' itself
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category; // Display the category name
        categoryFilterSelect.appendChild(option);
    });
    // Restore previous selection if it still exists, otherwise default to 'all'
    if (Array.from(categoryFilterSelect.options).some(opt => opt.value === currentSelection)) {
        categoryFilterSelect.value = currentSelection;
    }
    else {
        categoryFilterSelect.value = 'all';
        // If the selection was removed (e.g., last item in category deleted), update the state
        if (categoryFilter !== 'all') {
            categoryFilter = 'all';
            // Consider triggering the filter update callback here if necessary
            // callbacks.updateFilter('all'); // If needed
        }
    }
}
function updateCategoryDatalist(allCategories) {
    if (!categoryDatalist)
        return;
    categoryDatalist.innerHTML = ''; // Clear previous suggestions
    const sortedCategories = Array.from(allCategories)
        .filter(cat => cat && cat !== 'all' && cat !== 'Uncategorized') // Exclude placeholders
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        // textContent is not needed for datalist options
        categoryDatalist.appendChild(option);
    });
    // console.log('Updated category datalist with:', sortedCategories); // Optional debug log
}
// --- REMOVED Resize Observer Logic ---
// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined)
        return "";
    try {
        // Use Text node manipulation for robust escaping in browser environments
        if (typeof document !== 'undefined') {
            const textNode = document.createTextNode(unsafe);
            const div = document.createElement('div');
            div.appendChild(textNode);
            return div.innerHTML;
        }
        else {
            // Basic fallback if document is not available (e.g., server-side)
            throw new Error("DOM not available for escaping");
        }
    }
    catch (e) {
        // Regex fallback in case of error or non-browser context
        console.warn("DOM escaping method failed, using basic regex replace.");
        return String(unsafe)
            .replace(/&/g, "&") // Must be first
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "\"")
            .replace(/'/g, "'"); // Use HTML entity for single quote
    }
}
function ensureHttp(link) {
    if (!link || link === '#')
        return '#'; // Return '#' for empty or placeholder links
    try {
        // Check if it already has a known, safe protocol
        if (/^(https?:\/\/|mailto:|tel:)/i.test(link)) {
            return link;
        }
        // If it looks like a potential domain/URL but lacks a protocol
        if (link.includes('.') && !link.includes(' ') && !link.startsWith('/') && !link.startsWith('#')) {
            // Avoid creating // links if user typed example.com/path
            if (!link.startsWith('//')) {
                return `http://${link}`; // Prepend http:// as a default guess
            }
        }
        // Otherwise, return the link as is (could be relative, an anchor, etc.)
        return link;
    }
    catch (e) {
        console.warn(`Could not parse link "${link}" in ensureHttp, returning original.`);
        return link; // Return original on error
    }
}
// --- End of ui.ts ---
