import { formatTimeRemaining, formatDisplayDate } from './utils.js';
let categoryFilter = 'all'; // State for current filter
let categories = new Set(); // Dynamically track categories
// --- DOM Element Selectors ---
const form = document.getElementById('add-item-form');
const formElements = {
    name: form.elements.namedItem('item-name'),
    date: form.elements.namedItem('item-date'),
    time: form.elements.namedItem('item-time'),
    isRecurring: form.elements.namedItem('item-recurring'),
    recurrenceInterval: form.elements.namedItem('item-recurrence-interval'),
    recurrenceEndDate: form.elements.namedItem('item-recurrence-end-date'),
    category: form.elements.namedItem('item-category'),
    note: form.elements.namedItem('item-note'),
    link: form.elements.namedItem('item-link'),
    design: form.elements.namedItem('item-design'),
    recurringOptions: document.getElementById('recurring-options'),
};
const listContainer = document.getElementById('countdown-list');
const categoryFilterSelect = document.getElementById('category-filter');
const exportButton = document.getElementById('export-button');
const importButton = document.getElementById('import-button');
const importInput = document.getElementById('import-file');
// --- Event Handler Setup ---
export function setupUIEventListeners(addItemCallback, dismissItemCallback, updateFilterCallback, exportCallback, importCallback) {
    // Form Submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const targetDateTime = `${formElements.date.value}T${formElements.time.value}`;
        // Basic validation: Check if date and time are provided
        if (!formElements.date.value || !formElements.time.value) {
            alert("Please select both a date and a time.");
            return;
        }
        // Check if target date is in the past
        if (new Date(targetDateTime) < new Date() && !formElements.isRecurring.checked) {
            alert("Target date cannot be in the past for non-recurring events.");
            return;
        }
        const newItemData = {
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
        addItemCallback(newItemData);
        form.reset();
        formElements.recurringOptions.style.display = 'none'; // Hide recurrence options after submit
    });
    // Toggle Recurrence Options Visibility
    formElements.isRecurring.addEventListener('change', () => {
        formElements.recurringOptions.style.display = formElements.isRecurring.checked ? 'block' : 'none';
    });
    // Dismiss Button (Event Delegation)
    listContainer.addEventListener('click', (event) => {
        var _a;
        const target = event.target;
        if (target.classList.contains('dismiss-button')) {
            const itemId = (_a = target.closest('.countdown-item')) === null || _a === void 0 ? void 0 : _a.getAttribute('data-id');
            if (itemId) {
                dismissItemCallback(itemId);
            }
        }
    });
    // Category Filter Change
    categoryFilterSelect.addEventListener('change', () => {
        categoryFilter = categoryFilterSelect.value;
        updateFilterCallback(categoryFilter); // Notify app logic to re-render
    });
    // Export Button
    exportButton.addEventListener('click', exportCallback);
    // Import Button Click triggers hidden file input
    importButton.addEventListener('click', () => importInput.click());
    // Import File Selection
    importInput.addEventListener('change', () => {
        var _a;
        const file = (_a = importInput.files) === null || _a === void 0 ? void 0 : _a[0];
        if (file) {
            importCallback(file);
            importInput.value = ''; // Reset input
        }
    });
}
// --- Rendering Functions ---
export function renderCountdownList(items) {
    listContainer.innerHTML = ''; // Clear existing items
    categories.clear(); // Reset categories for this render cycle
    categories.add('all'); // Always have 'all'
    const now = Date.now();
    // Filter items based on the current category filter
    const filteredItems = items.filter(item => {
        categories.add(item.category); // Collect all unique categories
        return categoryFilter === 'all' || item.category === categoryFilter;
    });
    // Sort items: non-past first, then by target date ascending
    filteredItems.sort((a, b) => {
        const aIsPassed = new Date(a.targetDate).getTime() <= now;
        const bIsPassed = new Date(b.targetDate).getTime() <= now;
        if (aIsPassed && !bIsPassed)
            return 1; // a is past, b is not -> b comes first
        if (!aIsPassed && bIsPassed)
            return -1; // b is past, a is not -> a comes first
        // Both past or both future: sort by target date
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });
    if (filteredItems.length === 0) {
        listContainer.innerHTML = '<p class="no-items">No countdowns here yet. Add one above!</p>';
    }
    else {
        filteredItems.forEach(item => {
            const itemElement = createCountdownElement(item);
            listContainer.appendChild(itemElement);
        });
    }
    updateCategoryFilterOptions(); // Update dropdown with collected categories
}
function createCountdownElement(item) {
    const element = document.createElement('div');
    element.classList.add('countdown-item', `design-${item.design}`);
    element.setAttribute('data-id', item.id);
    const targetDate = new Date(item.targetDate);
    const timeRemainingMs = targetDate.getTime() - Date.now();
    const isCurrentlyPast = timeRemainingMs <= 0;
    if (isCurrentlyPast !== item.isPast) {
        // This state should ideally be updated *before* rendering
        // console.warn(`Mismatch detected for ${item.name}. Expected past: ${item.isPast}, Calculated past: ${isCurrentlyPast}`);
        // Let's rely on the isPast flag passed into the function for styling consistency during updates
    }
    if (item.isPast) {
        element.classList.add('past');
    }
    // Sanitize user input before inserting as HTML (simple example)
    const safeName = escapeHtml(item.name);
    const safeCategory = escapeHtml(item.category);
    const safeNote = escapeHtml(item.note || '');
    const safeLink = item.link ? escapeHtml(item.link) : '';
    element.innerHTML = `
        <div class="item-header">
            <span class="item-name">${safeName}</span>
            ${item.isPast ? '<button class="dismiss-button" title="Dismiss this item">×</button>' : ''}
        </div>
        <div class="item-timer" data-target-date="${item.targetDate}">
            ${formatTimeRemaining(timeRemainingMs)}
        </div>
        <div class="item-target-date">
            Target: ${formatDisplayDate(item.targetDate)}
            ${item.isRecurring ? `<span class="recurring-info">(Repeats ${item.recurrenceInterval})</span>` : ''}
        </div>
        <div class="item-details">
            <span class="item-category">Category: ${safeCategory}</span>
            ${safeNote ? `<p class="item-note">Note: ${safeNote.replace(/\n/g, '<br>')}</p>` : ''}
            ${safeLink ? `<p class="item-link">Link: <a href="${ensureHttp(safeLink)}" target="_blank" rel="noopener noreferrer">${safeLink}</a></p>` : ''}
        </div>
    `;
    return element;
}
export function updateTimers(items) {
    const itemElements = listContainer.querySelectorAll('.countdown-item');
    itemElements.forEach(element => {
        const id = element.getAttribute('data-id');
        const timerElement = element.querySelector('.item-timer');
        const targetDateStr = timerElement === null || timerElement === void 0 ? void 0 : timerElement.getAttribute('data-target-date');
        if (id && timerElement && targetDateStr) {
            const item = items.find(i => i.id === id); // Find corresponding item data
            if (item && !item.isPast) { // Only update timers for non-past items actively
                const targetDate = new Date(targetDateStr);
                const timeRemainingMs = targetDate.getTime() - Date.now();
                timerElement.textContent = formatTimeRemaining(timeRemainingMs);
            }
            else if (item && item.isPast && !element.classList.contains('past')) {
                // If item became past but element doesn't reflect it yet (rare race condition?)
                element.classList.add('past');
                timerElement.textContent = "Now!";
                // Add dismiss button if missing
                if (!element.querySelector('.dismiss-button')) {
                    const header = element.querySelector('.item-header');
                    const dismissButton = document.createElement('button');
                    dismissButton.className = 'dismiss-button';
                    dismissButton.title = 'Dismiss this item';
                    dismissButton.textContent = '×';
                    header === null || header === void 0 ? void 0 : header.appendChild(dismissButton);
                }
            }
        }
    });
}
function updateCategoryFilterOptions() {
    // Preserve current selection if possible
    const currentSelection = categoryFilterSelect.value;
    // Clear existing options except the default "All"
    while (categoryFilterSelect.options.length > 1) {
        categoryFilterSelect.remove(1);
    }
    // Sort categories alphabetically for display
    const sortedCategories = Array.from(categories).filter(cat => cat !== 'all').sort();
    sortedCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterSelect.appendChild(option);
    });
    // Restore previous selection if it still exists
    if (Array.from(categoryFilterSelect.options).some(opt => opt.value === currentSelection)) {
        categoryFilterSelect.value = currentSelection;
    }
    else {
        // If the previous selection is gone (e.g., last item of that category deleted), default to "all"
        categoryFilterSelect.value = 'all';
        categoryFilter = 'all'; // Update internal state too
    }
}
// --- Helper Functions ---
function escapeHtml(unsafe) {
    if (!unsafe) {
        return ""; // Handle null or undefined gracefully
    }
    let safe = unsafe;
    // Replace characters one by one
    safe = safe.replace(/&/g, "&"); // Must be first
    safe = safe.replace(/</g, "<");
    safe = safe.replace(/>/g, ">");
    safe = safe.replace(/"/g, "\"");
    safe = safe.replace(/'/g, "'"); // Escapes single quotes
    return safe;
}
function ensureHttp(link) {
    if (!link)
        return '#'; // Return '#' or empty string if link is empty
    if (!/^https?:\/\//i.test(link)) {
        return `http://${link}`; // Add http:// if no protocol exists
    }
    return link;
}
