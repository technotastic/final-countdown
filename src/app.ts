import { CountdownItem, CountdownFormData } from './models.js';
import { loadItems, saveItems, exportItems, importItems } from './storage.js';
import { setupUIEventListeners, renderCountdownList, updateTimers, openModal, applyTheme } from './ui.js';
import { generateId, calculateNextOccurrence, isRecurrenceFinished } from './utils.js';

// --- Application State ---
let countdownItems: CountdownItem[] = [];
let timerInterval: number | null = null;
const THEME_STORAGE_KEY = 'finalCountdownTheme'; // Key for saving theme

// --- Initialization ---
function initializeApp(): void {
    console.log("Initializing Final Countdown App v2.2 (with theme logs)...");
    countdownItems = loadItems();
    console.log(`Loaded ${countdownItems.length} items.`);

    // Load and apply saved theme
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
    // --- DEBUG: Log theme being applied on load ---
    console.log('Applying saved theme on load:', savedTheme);
    applyTheme(savedTheme); // Apply theme visually via UI function

    setupUIEventListeners({
        saveItem: handleSaveItem,
        deleteItem: handleDeleteItem,
        requestEditItem: handleEditRequest,
        requestCopyItem: handleCopyRequest,
        updateFilter: handleFilterChange,
        exportItems: handleExport,
        importItems: handleImport,
        themeChanged: handleThemeChange, // Ensure this callback is passed
    });

    renderCountdownList(countdownItems);
    startTimerUpdates();
    checkPastEvents(true);
    console.log("App initialized with theme:", savedTheme);
}

// --- Core Logic Handlers ---

function handleSaveItem(formData: CountdownFormData, editingId: string | null): void {
    try {
        if (editingId) {
            const itemIndex = countdownItems.findIndex(item => item.id === editingId);
            if (itemIndex === -1) throw new Error("Item to update not found");
            const originalItem = countdownItems[itemIndex];
            const updatedItem: CountdownItem = {
                ...originalItem,
                name: formData.name, category: formData.category, note: formData.note, link: formData.link, design: formData.design,
                targetDate: new Date(formData.targetDateTime).toISOString(), isRecurring: formData.isRecurring,
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                isPast: new Date(formData.targetDateTime) < new Date(),
            };
            if (!updatedItem.isRecurring) { updatedItem.recurrenceInterval = undefined; updatedItem.recurrenceEndDate = null; }
            if (updatedItem.isPast && updatedItem.isRecurring) { const nextDate = getNextValidOccurrence(updatedItem); if (nextDate) { updatedItem.targetDate = nextDate; updatedItem.isPast = false; } }
            else if (!updatedItem.isPast && new Date(updatedItem.targetDate) < new Date()) { updatedItem.isPast = true; }
            countdownItems[itemIndex] = updatedItem; console.log("Updated item:", updatedItem.name);
        } else {
            const newItem: CountdownItem = {
                id: generateId(), name: formData.name, targetDate: new Date(formData.targetDateTime).toISOString(),
                originalTargetDate: new Date(formData.targetDateTime).toISOString(), isRecurring: formData.isRecurring,
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                category: formData.category, note: formData.note, link: formData.link, design: formData.design,
                createdAt: new Date().toISOString(), isPast: new Date(formData.targetDateTime) < new Date()
            };
            if (newItem.isPast && newItem.isRecurring) { const nextDate = getNextValidOccurrence(newItem); if (nextDate) { newItem.targetDate = nextDate; newItem.isPast = false; } }
            else if (!newItem.isPast && new Date(newItem.targetDate) < new Date()){ newItem.isPast = true; }
            countdownItems.push(newItem); console.log("Added new item:", newItem.name);
        }
        saveItems(countdownItems);
        renderCountdownList(countdownItems);
    } catch (e) {
        console.error("Error saving item:", e); alert(`Error saving: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
}

function handleEditRequest(id: string): void {
    const item = countdownItems.find(i => i.id === id);
    if (item) openModal('edit', id, item);
    else alert("Error: Item not found for editing.");
}

function handleCopyRequest(id: string): void {
    const item = countdownItems.find(i => i.id === id);
    if (item) openModal('add', undefined, item);
    else alert("Error: Item not found for copying.");
}

function handleDeleteItem(id: string): void {
     const itemIndex = countdownItems.findIndex(item => item.id === id);
     if (itemIndex === -1) { alert("Error: Item not found for deletion."); return; }
     const itemToDelete = countdownItems[itemIndex];
     if (confirm(`Are you sure you want to delete "${itemToDelete.name}"?`)) {
         countdownItems.splice(itemIndex, 1);
         saveItems(countdownItems);
         renderCountdownList(countdownItems);
         console.log("Deleted item:", id);
     }
}

function handleFilterChange(newFilter: string): void {
    renderCountdownList(countdownItems);
}

function handleExport(): void {
    if (countdownItems.length === 0) { alert("Nothing to export!"); return; }
    exportItems(countdownItems);
}

function handleImport(file: File): void {
    importItems(file, (importedItems) => {
        if (importedItems.length === 0 && file.size > 0) { alert("Import Warning: No valid items found in file."); return; }
        if (importedItems.length === 0 && file.size === 0) { alert("Import failed: File is empty."); return; }
        if (confirm(`Import ${importedItems.length} item(s)? This will REPLACE your current list.`)) {
            countdownItems = importedItems;
            checkPastEvents(true);
            saveItems(countdownItems);
            alert("Import successful!");
        }
    });
}

// ** Handler for Theme Change **
function handleThemeChange(newTheme: string): void {
    // --- DEBUG: Confirm theme change handler is called ---
    console.log('handleThemeChange called with:', newTheme);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        // --- DEBUG: Confirm saving worked (or log error) ---
        console.log("Theme preference saved:", newTheme);
    } catch (e) {
        console.error("Error saving theme preference to localStorage:", e);
        // Maybe alert the user if storage fails?
        alert("Could not save theme preference. LocalStorage might be disabled or full.");
    }
}


// --- Periodic Updates & State Checks ---
function checkPastEvents(forceRender: boolean = false): boolean {
    let itemsChanged = false; const now = new Date();
    countdownItems.forEach(item => {
        if (item.isPast) return; const targetDate = new Date(item.targetDate);
        if (isNaN(targetDate.getTime())) { item.isPast = true; itemsChanged = true; return; }
        if (targetDate <= now) {
            if (item.isRecurring && item.recurrenceInterval) {
                const nextOccurrence = calculateNextOccurrence(item.targetDate, item.recurrenceInterval);
                if (nextOccurrence && !isRecurrenceFinished(nextOccurrence, item.recurrenceEndDate)) {
                    item.targetDate = nextOccurrence; item.isPast = new Date(item.targetDate) <= now;
                } else { item.isPast = true; }
            } else { item.isPast = true; }
            itemsChanged = true;
        }
    });
    if (itemsChanged) { saveItems(countdownItems); if (forceRender) renderCountdownList(countdownItems); }
    return itemsChanged;
}

function getNextValidOccurrence(item: CountdownItem): string | null {
    let currentDate = item.targetDate; const now = new Date(); if (!item.isRecurring || !item.recurrenceInterval) return null;
    while (new Date(currentDate) < now) { const next = calculateNextOccurrence(currentDate, item.recurrenceInterval); if (!next || isRecurrenceFinished(next, item.recurrenceEndDate)) return null; currentDate = next; } return currentDate;
}

function startTimerUpdates(): void {
    if (timerInterval) clearInterval(timerInterval); console.log("Starting timer updates...");
    timerInterval = window.setInterval(() => { const stateChanged = checkPastEvents(); updateTimers(countdownItems); if (stateChanged) renderCountdownList(countdownItems); }, 1000);
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', initializeApp); // Ensure this runs after DOM is ready
// --- End of app.ts ---