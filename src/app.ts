import { CountdownItem, CountdownFormData } from './models.js';
import { loadItems, saveItems, exportItems, importItems } from './storage.js';
// Make sure listContainer is exported from ui.ts if you use the ID-based reorder strategy
import { setupUIEventListeners, renderCountdownList, updateTimers, openModal, applyTheme, listContainer } from './ui.js';
import { generateId, calculateNextOccurrence, isRecurrenceFinished } from './utils.js';

// --- Application State ---
let countdownItems: CountdownItem[] = [];
let timerInterval: number | null = null;
const THEME_STORAGE_KEY = 'finalCountdownTheme'; // Key for saving theme

// --- Initialization ---
function initializeApp(): void {
    console.log("Initializing Final Countdown App v2.3 (with D&D)..."); // Updated version log
    countdownItems = loadItems();
    console.log(`Loaded ${countdownItems.length} items.`);

    // Load and apply saved theme
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
    console.log('Applying saved theme on load:', savedTheme);
    applyTheme(savedTheme); // Apply theme visually via UI function

    // Setup UI listeners, INCLUDING the new orderChanged handler
    setupUIEventListeners({
        saveItem: handleSaveItem,
        deleteItem: handleDeleteItem,
        requestEditItem: handleEditRequest,
        requestCopyItem: handleCopyRequest,
        updateFilter: handleFilterChange,
        exportItems: handleExport,
        importItems: handleImport,
        themeChanged: handleThemeChange,
        orderChanged: handleOrderChange // <-- Add the handler here
    });

    renderCountdownList(countdownItems); // Render the initial list
    startTimerUpdates(); // Start the 1-second interval timer
    checkPastEvents(true); // Run initial check for past/recurring events
    console.log("App initialized with theme:", savedTheme);
}

// --- Core Logic Handlers ---

function handleSaveItem(formData: CountdownFormData, editingId: string | null): void {
    try {
        if (editingId) {
            // --- Update existing item ---
            const itemIndex = countdownItems.findIndex(item => item.id === editingId);
            if (itemIndex === -1) {
                 console.error(`Item with ID ${editingId} not found for update.`);
                 alert("Error: Could not find the item to update.");
                 return; // Exit if item not found
            }
            const originalItem = countdownItems[itemIndex];

            // Create updated item object
            const updatedItem: CountdownItem = {
                ...originalItem, // Spread original item first
                name: formData.name,
                category: formData.category,
                note: formData.note,
                link: formData.link,
                design: formData.design,
                targetDate: new Date(formData.targetDateTime).toISOString(), // Update target date
                isRecurring: formData.isRecurring,
                // Reset recurrence fields if not recurring anymore
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                // Recalculate isPast based on potentially new targetDate
                isPast: new Date(formData.targetDateTime) <= new Date(),
                // Keep originalTargetDate unless explicitly changed? Or update it? Let's keep it for now.
                // Keep createdAt date
            };

            // If it's recurring but now marked as past, calculate the next valid occurrence
            if (updatedItem.isPast && updatedItem.isRecurring) {
                const nextDate = getNextValidOccurrence(updatedItem);
                if (nextDate) {
                    updatedItem.targetDate = nextDate;
                    updatedItem.isPast = new Date(updatedItem.targetDate) <= new Date(); // Recheck isPast for the new date
                } else {
                     // If no next valid date, it stays past (recurrence ended)
                     updatedItem.isPast = true;
                }
            } else if (!updatedItem.isPast && new Date(updatedItem.targetDate) < new Date()){
                // Handle case where date was edited to be in the past but wasn't before
                updatedItem.isPast = true;
            }

            countdownItems[itemIndex] = updatedItem;
            console.log("Updated item:", updatedItem.name);

        } else {
            // --- Add new item ---
            const newItem: CountdownItem = {
                id: generateId(),
                name: formData.name,
                targetDate: new Date(formData.targetDateTime).toISOString(),
                originalTargetDate: new Date(formData.targetDateTime).toISOString(), // Set initial target as original
                isRecurring: formData.isRecurring,
                recurrenceInterval: formData.isRecurring ? formData.recurrenceInterval : undefined,
                recurrenceEndDate: formData.isRecurring && formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate).toISOString() : null,
                category: formData.category,
                note: formData.note,
                link: formData.link,
                design: formData.design,
                createdAt: new Date().toISOString(),
                isPast: new Date(formData.targetDateTime) <= new Date()
            };

             // If new item is created already past but is recurring, find the first future occurrence
            if (newItem.isPast && newItem.isRecurring) {
                const nextDate = getNextValidOccurrence(newItem);
                if (nextDate) {
                    newItem.targetDate = nextDate;
                    newItem.isPast = new Date(newItem.targetDate) <= new Date(); // Recheck isPast
                }
                // If no next date, it remains past
            }

            countdownItems.push(newItem);
            console.log("Added new item:", newItem.name);
        }

        // Save changes and update UI
        saveItems(countdownItems);
        renderCountdownList(countdownItems);

    } catch (e) {
        console.error("Error saving item:", e);
        alert(`Error saving item: ${e instanceof Error ? e.message : 'An unknown error occurred.'}`);
    }
}

function handleEditRequest(id: string): void {
    const item = countdownItems.find(i => i.id === id);
    if (item) {
        openModal('edit', id, item);
    } else {
        console.error(`Item with ID ${id} not found for editing.`);
        alert("Error: Item not found for editing.");
    }
}

function handleCopyRequest(id: string): void {
    const item = countdownItems.find(i => i.id === id);
    if (item) {
        // Pass undefined for itemId to ensure it's treated as a new item ('add' mode)
        openModal('add', undefined, item);
    } else {
         console.error(`Item with ID ${id} not found for copying.`);
         alert("Error: Item not found for copying.");
    }
}

function handleDeleteItem(id: string): void {
     const itemIndex = countdownItems.findIndex(item => item.id === id);
     if (itemIndex === -1) {
         alert("Error: Item not found for deletion.");
         return;
     }
     const itemToDelete = countdownItems[itemIndex];
     // Use item name in confirmation for better user experience
     if (confirm(`Are you sure you want to delete "${itemToDelete.name || 'this item'}"?`)) {
         countdownItems.splice(itemIndex, 1); // Remove item from array
         saveItems(countdownItems); // Save the updated array
         renderCountdownList(countdownItems); // Re-render the list
         console.log("Deleted item:", id);
     }
}

// This handler now mainly triggers a re-render, as the filter state is managed in ui.ts
function handleFilterChange(newFilter: string): void {
    console.log("Filter changed to:", newFilter);
    renderCountdownList(countdownItems); // Re-render with the filter applied by ui.ts
}

function handleExport(): void {
    if (countdownItems.length === 0) {
        alert("Nothing to export!");
        return;
    }
    exportItems(countdownItems);
}

function handleImport(file: File): void {
    importItems(file, (importedItems) => {
        if (!importedItems) { // Handle potential null return on error
            alert("Import failed. Could not read file data.");
            return;
        }
        if (importedItems.length === 0 && file.size > 0) {
            alert("Import Warning: No valid countdown items found in the selected file.");
            return;
        }
         if (importedItems.length === 0 && file.size === 0) {
            alert("Import failed: The selected file is empty.");
            return;
        }

        // Confirm replacement
        if (confirm(`Import ${importedItems.length} item(s)? This will REPLACE your current list.`)) {
            countdownItems = importedItems; // Replace current items
            checkPastEvents(true); // Check state of newly imported items
            saveItems(countdownItems); // Save the new list
            renderCountdownList(countdownItems); // Render the new list
            alert("Import successful!");
            console.log(`Imported ${importedItems.length} items.`);
        }
    });
}

// Handler for Theme Change (Save preference)
function handleThemeChange(newTheme: string): void {
    console.log('handleThemeChange called with:', newTheme);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        console.log("Theme preference saved:", newTheme);
    } catch (e) {
        console.error("Error saving theme preference to localStorage:", e);
        alert("Could not save theme preference. LocalStorage might be disabled or full.");
    }
}

// --- NEW: Handler for Drag-and-Drop Reordering ---
function handleOrderChange(itemId: string, oldVisualIndex: number, newVisualIndex: number): void {
    console.log(`App logic: Moving item ${itemId} visually from ${oldVisualIndex} to ${newVisualIndex}`);

    // --- ID-based Reordering Strategy (More robust with filtering) ---

    const itemToMove = countdownItems.find(item => item.id === itemId);
    if (!itemToMove) {
        console.error(`ORDER CHANGE ERROR: Could not find moved item with ID ${itemId} in main items array.`);
        // Might force a re-render to sync UI if state is corrupted
        renderCountdownList(countdownItems);
        return;
    }

    // 1. Remove the item from its current position in the main array
    const currentActualIndex = countdownItems.findIndex(item => item.id === itemId);
    if (currentActualIndex > -1) {
        countdownItems.splice(currentActualIndex, 1);
    } else {
        console.error(`ORDER CHANGE ERROR: Item ${itemId} found but couldn't determine its current index in main array?`);
        renderCountdownList(countdownItems); // Re-render to potentially fix
        return;
    }

    // 2. Determine the actual index where the item should be inserted in the main array.
    // We need to map the visual index (newVisualIndex) back to an index in the full `countdownItems` array.
    // This is tricky because the visual list might be filtered/sorted differently.
    // A common approach is to find the ID of the item *before* which the moved item was dropped visually.

    // Get the current visual list elements AFTER SortableJS has updated the DOM
    const currentListElements = listContainer?.querySelectorAll('.countdown-item');
    if (!currentListElements || currentListElements.length !== listContainer?.children.length) {
         console.error("ORDER CHANGE ERROR: Could not reliably get current DOM elements for reordering.");
         // Put item back at the end as a fallback, save and re-render
         countdownItems.push(itemToMove);
         saveItems(countdownItems);
         renderCountdownList(countdownItems);
         return;
    }

    let insertBeforeActualIndex = -1;
    if (newVisualIndex < currentListElements.length) {
         // Find the element that is NOW at the target visual index
        const elementAtNewIndex = currentListElements[newVisualIndex];
        const idAtNewIndex = elementAtNewIndex.getAttribute('data-id');
        if (idAtNewIndex) {
            // Find where this element currently is in our main data array
            insertBeforeActualIndex = countdownItems.findIndex(item => item.id === idAtNewIndex);
        }
    }

    // 3. Insert the moved item back into the main array
    if (insertBeforeActualIndex !== -1) {
        // Insert before the item that was visually after the drop position
        countdownItems.splice(insertBeforeActualIndex, 0, itemToMove);
    } else {
        // If we couldn't find the item to insert before (e.g., dragged to the very end,
        // or error finding ID), append the moved item to the end of the array.
        countdownItems.push(itemToMove);
    }

    // 4. Persist the new order
    console.log("Saving new item order...");
    saveItems(countdownItems);
    // 5. **Crucially, DO NOT re-render immediately here.**
    // SortableJS has already updated the DOM visually. Re-rendering now based
    // on the array might cause a flicker or fight with SortableJS's animations.
    // The *next* time `renderCountdownList` is called (e.g., filter change, add/delete,
    // timer update causing state change), it will use the correctly ordered array.
}


// --- Periodic Updates & State Checks ---
function checkPastEvents(forceRender: boolean = false): boolean {
    let itemsChanged = false;
    const now = new Date();

    countdownItems.forEach(item => {
        // Skip if already marked as past or if targetDate is invalid
        if (item.isPast || !item.targetDate) return;

        const targetDate = new Date(item.targetDate);
        if (isNaN(targetDate.getTime())) {
            console.warn(`Invalid date found for item ${item.id}: ${item.targetDate}. Marking as past.`);
            item.isPast = true; // Mark invalid items as past to prevent errors
            itemsChanged = true;
            return;
        }

        // Check if target date is now in the past
        if (targetDate <= now) {
            if (item.isRecurring && item.recurrenceInterval) {
                // Try to calculate the next occurrence
                const nextOccurrence = calculateNextOccurrence(item.targetDate, item.recurrenceInterval);

                if (nextOccurrence && !isRecurrenceFinished(nextOccurrence, item.recurrenceEndDate)) {
                    // Update to the next valid occurrence
                    item.targetDate = nextOccurrence;
                    // Re-check if the *new* targetDate is past (could happen with short intervals)
                    item.isPast = new Date(item.targetDate) <= now;
                } else {
                    // No valid next occurrence or recurrence finished
                    item.isPast = true;
                }
            } else {
                // Not recurring, simply mark as past
                item.isPast = true;
            }
            itemsChanged = true; // Mark that state changed
        }
    });

    // If any item's state changed, save the updated list
    if (itemsChanged) {
        console.log("Item state changed (past/recurring). Saving...");
        saveItems(countdownItems);
        // Re-render ONLY if forced or if it's deemed necessary by the caller
        if (forceRender) {
            renderCountdownList(countdownItems);
        }
    }
    return itemsChanged; // Return whether any item's state changed
}

// Helper to find the first valid future occurrence for a recurring item
function getNextValidOccurrence(item: CountdownItem): string | null {
    let currentDate = item.originalTargetDate || item.targetDate; // Start from original if available, else current
    const now = new Date();

    // Check validity and recurrence settings
    if (!item.isRecurring || !item.recurrenceInterval) return null;
    if (!currentDate) return null; // Need a starting date

    let loopGuard = 0; // Prevent infinite loops with bad data/logic
    const MAX_LOOPS = 1000; // Look ahead a reasonable amount

    // Ensure the initial date isn't invalid
     if(isNaN(new Date(currentDate).getTime())) {
         console.error(`Invalid start date "${currentDate}" for recurrence calculation on item ${item.id}`);
         return null;
     }

    // Calculate occurrences until we find one in the future or the recurrence ends
    while (new Date(currentDate) <= now && loopGuard < MAX_LOOPS) {
        const next = calculateNextOccurrence(currentDate, item.recurrenceInterval);
        // Check if recurrence finished or calculation failed
        if (!next || isRecurrenceFinished(next, item.recurrenceEndDate)) {
            return null; // No valid future occurrence
        }
        currentDate = next; // Move to the next calculated date
        loopGuard++;
    }

    if (loopGuard >= MAX_LOOPS) {
        console.warn(`Recurrence calculation exceeded MAX_LOOPS for item ${item.id}. Returning null.`);
        return null;
    }

    // Return the first occurrence found that is after 'now'
    return new Date(currentDate) > now ? currentDate : null;
}


function startTimerUpdates(): void {
    if (timerInterval) {
        clearInterval(timerInterval); // Clear existing interval if any
    }
    console.log("Starting timer updates (interval: 1000ms)...");
    timerInterval = window.setInterval(() => {
        // 1. Check if any items became past or need recurrence update
        const stateChanged = checkPastEvents();
        // 2. Update the displayed time remaining for all active timers
        updateTimers(countdownItems);
        // 3. Re-render the entire list *only if* an item's state actually changed (past/recurring)
        if (stateChanged) {
            console.log("Re-rendering list due to state change.");
            renderCountdownList(countdownItems);
        }
    }, 1000); // Update every second
}

// --- Initialize ---
// Use DOMContentLoaded to ensure the DOM is fully parsed before running the app
document.addEventListener('DOMContentLoaded', initializeApp);

// --- End of app.ts ---