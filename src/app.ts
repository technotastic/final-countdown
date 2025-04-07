import { CountdownItem, CountdownFormData } from './models.js'; // Added .js
import { loadItems, saveItems, exportItems, importItems, getItemById } from './storage.js'; // Added .js
import { setupUIEventListeners, renderCountdownList, updateTimers, openModal, closeModal } from './ui.js'; // Added .js
import { generateId, calculateNextOccurrence, isRecurrenceFinished } from './utils.js'; // Added .js

// --- Application State ---
let countdownItems: CountdownItem[] = [];
let timerInterval: number | null = null;

// --- Initialization ---
function initializeApp(): void {
    console.log("Initializing Final Countdown App v2.1..."); // Version bump!
    countdownItems = loadItems();
    console.log(`Loaded ${countdownItems.length} items.`);

    setupUIEventListeners({
        saveItem: handleSaveItem,
        // ** CHANGED: Pass delete handler **
        deleteItem: handleDeleteItem,
        requestEditItem: handleEditRequest,
        requestCopyItem: handleCopyRequest,
        updateFilter: handleFilterChange,
        exportItems: handleExport,
        importItems: handleImport,
    });

    renderCountdownList(countdownItems);
    startTimerUpdates();
    checkPastEvents(true);
    console.log("App initialized.");
}

// --- Core Logic Handlers ---

function handleSaveItem(formData: CountdownFormData, editingId: string | null): void {
    try {
        if (editingId) {
            // --- Update Existing Item ---
            const itemIndex = countdownItems.findIndex(item => item.id === editingId);
            if (itemIndex === -1) throw new Error("Item to update not found");

            const originalItem = countdownItems[itemIndex];
            const updatedItem: CountdownItem = {
                ...originalItem,
                name: formData.name,
                category: formData.category,
                note: formData.note,
                link: formData.link,
                design: formData.design,
                targetDate: new Date(formData.targetDateTime).toISOString(),
                isRecurring: formData.isRecurring,
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                isPast: new Date(formData.targetDateTime) < new Date(),
            };

            if (!updatedItem.isRecurring) {
                 updatedItem.recurrenceInterval = undefined;
                 updatedItem.recurrenceEndDate = null;
             }

            // Recalculate next occurrence if needed
             if (updatedItem.isPast && updatedItem.isRecurring) {
                 const nextDate = getNextValidOccurrence(updatedItem);
                 if (nextDate) {
                     updatedItem.targetDate = nextDate;
                     updatedItem.isPast = false;
                 }
             } else if (!updatedItem.isPast && new Date(updatedItem.targetDate) < new Date()) {
                 updatedItem.isPast = true;
             }

            countdownItems[itemIndex] = updatedItem;
            console.log("Updated item:", updatedItem.name);

        } else {
            // --- Add New Item ---
            const newItem: CountdownItem = {
                id: generateId(),
                name: formData.name,
                targetDate: new Date(formData.targetDateTime).toISOString(),
                originalTargetDate: new Date(formData.targetDateTime).toISOString(),
                isRecurring: formData.isRecurring,
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                category: formData.category,
                note: formData.note,
                link: formData.link,
                design: formData.design,
                createdAt: new Date().toISOString(),
                isPast: new Date(formData.targetDateTime) < new Date()
            };

            if (newItem.isPast && newItem.isRecurring) {
                 const nextDate = getNextValidOccurrence(newItem);
                 if (nextDate) {
                     newItem.targetDate = nextDate;
                     newItem.isPast = false;
                 }
             } else if (!newItem.isPast && new Date(newItem.targetDate) < new Date()){
                  newItem.isPast = true;
             }

            countdownItems.push(newItem);
            console.log("Added new item:", newItem.name);
        }

        saveItems(countdownItems);
        renderCountdownList(countdownItems); // Re-render

    } catch (e) {
         console.error("Error saving item:", e);
         alert(`An error occurred while saving: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}


function handleEditRequest(id: string): void {
    console.log("Requesting edit for item:", id);
    const item = countdownItems.find(i => i.id === id);
    if (item) {
        openModal('edit', id, item);
    } else {
        console.error("Item not found for edit:", id);
        alert("Could not find the selected item to edit.");
    }
}

function handleCopyRequest(id: string): void {
    console.log("Requesting copy for item:", id);
    const item = countdownItems.find(i => i.id === id);
    if (item) {
        openModal('add', undefined, item);
    } else {
        console.error("Item not found for copy:", id);
        alert("Could not find the selected item to copy.");
    }
}

// ** NEW Delete Handler **
function handleDeleteItem(id: string): void {
     const itemIndex = countdownItems.findIndex(item => item.id === id);
     if (itemIndex === -1) {
         console.error("Item to delete not found:", id);
         alert("Error: Could not find the item to delete.");
         return;
     }

     const itemToDelete = countdownItems[itemIndex];

     // Ask for confirmation
     const confirmed = confirm(`Are you sure you want to delete "${itemToDelete.name}"?`);

     if (confirmed) {
         countdownItems.splice(itemIndex, 1); // Remove item from array
         saveItems(countdownItems);          // Save updated array
         renderCountdownList(countdownItems); // Re-render the list
         console.log("Deleted item:", id, itemToDelete.name);
         // Optional: Add a success notification/toast later
     } else {
         console.log("Deletion cancelled for item:", id);
     }
}


// ** REMOVED handleDismissItem ** (Replaced by handleDeleteItem)


function handleFilterChange(newFilter: string): void {
    console.log("Filter changed to:", newFilter);
    renderCountdownList(countdownItems);
}

function handleExport(): void {
     if (countdownItems.length === 0) {
        alert("Nothing to export!");
        return;
    }
    exportItems(countdownItems);
    console.log("Exporting items...");
}

function handleImport(file: File): void {
    console.log("Attempting to import file:", file.name);
    importItems(file, (importedItems) => {
        if (importedItems.length === 0 && file.size > 0) {
             alert("Import finished, but no valid countdown items were found in the file.");
             return;
        }
        if (importedItems.length === 0 && file.size === 0) {
             alert("Import failed: The selected file appears to be empty.");
             return;
        }
        const replace = confirm(`Import ${importedItems.length} item(s)? This will REPLACE your current list.`);
        if (replace) {
            countdownItems = importedItems;
            checkPastEvents(true);
            saveItems(countdownItems);
            // renderCountdownList usually called by checkPastEvents if changes occur
            console.log("Import successful. Items replaced.");
            alert("Import successful!");
        } else {
            console.log("Import cancelled by user.");
        }
    });
}


// --- Periodic Updates & State Checks ---

function checkPastEvents(forceRender: boolean = false): boolean {
    let itemsChanged = false;
    const now = new Date();

    countdownItems.forEach(item => {
        if (item.isPast) return;

        const targetDate = new Date(item.targetDate);
        if (isNaN(targetDate.getTime())) {
             console.warn(`Item ${item.id} has invalid targetDate: ${item.targetDate}. Marking as past.`);
             item.isPast = true;
             itemsChanged = true;
             return;
        }

        if (targetDate <= now) {
            if (item.isRecurring && item.recurrenceInterval) {
                const nextOccurrence = calculateNextOccurrence(item.targetDate, item.recurrenceInterval);
                if (nextOccurrence && !isRecurrenceFinished(nextOccurrence, item.recurrenceEndDate)) {
                    item.targetDate = nextOccurrence;
                    item.isPast = new Date(item.targetDate) <= now;
                } else {
                    item.isPast = true; // Recurrence finished
                }
            } else {
                item.isPast = true; // Non-recurring passed
            }
            itemsChanged = true;
        }
    });

    if (itemsChanged) {
        saveItems(countdownItems);
        if (forceRender) {
             renderCountdownList(countdownItems);
        }
    }
    return itemsChanged;
}

function getNextValidOccurrence(item: CountdownItem): string | null {
    let currentDate = item.targetDate;
    const now = new Date();
    if (!item.isRecurring || !item.recurrenceInterval) return null;

    while (new Date(currentDate) < now) {
        const next = calculateNextOccurrence(currentDate, item.recurrenceInterval);
        if (!next || isRecurrenceFinished(next, item.recurrenceEndDate)) return null;
        currentDate = next;
    }
    return currentDate;
}

function startTimerUpdates(): void {
    if (timerInterval) clearInterval(timerInterval);
    console.log("Starting timer updates...");
    timerInterval = window.setInterval(() => {
        const stateChanged = checkPastEvents();
        updateTimers(countdownItems);
        if (stateChanged) {
            renderCountdownList(countdownItems);
        }
    }, 1000);
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', initializeApp);