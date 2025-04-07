import { loadItems, saveItems, exportItems, importItems } from './storage.js'; // <--- Add .js
import { setupUIEventListeners, renderCountdownList, updateTimers } from './ui.js'; // <--- Add .js
import { generateId, calculateNextOccurrence, isRecurrenceFinished } from './utils.js'; // <--- Add .js
let countdownItems = [];
let timerInterval = null;
// --- Application Logic ---
function initializeApp() {
    console.log("Initializing Final Countdown App...");
    countdownItems = loadItems();
    console.log(`Loaded ${countdownItems.length} items from storage.`);
    setupUIEventListeners(handleAddItem, handleDismissItem, handleFilterChange, handleExport, handleImport);
    renderCountdownList(countdownItems); // Initial render
    startTimerUpdates(); // Start the interval timer
    checkPastEvents(); // Perform initial check for past events
    console.log("App initialized.");
}
function handleAddItem(itemData) {
    const newItem = {
        id: generateId(),
        name: itemData.name,
        targetDate: new Date(itemData.targetDateTime).toISOString(), // Store as ISO string
        originalTargetDate: new Date(itemData.targetDateTime).toISOString(),
        isRecurring: itemData.isRecurring,
        recurrenceInterval: itemData.recurrenceInterval,
        recurrenceEndDate: itemData.recurrenceEndDate ? new Date(itemData.recurrenceEndDate).toISOString() : null,
        category: itemData.category,
        note: itemData.note,
        link: itemData.link,
        design: itemData.design,
        createdAt: new Date().toISOString(),
        isPast: false // Initially false, will be checked by interval
    };
    // If recurring and the *initial* date is already past, calculate the first *future* occurrence
    if (newItem.isRecurring && new Date(newItem.targetDate) < new Date()) {
        console.log(`Initial date for recurring item '${newItem.name}' is past. Calculating next occurrence.`);
        const nextDate = getNextValidOccurrence(newItem);
        if (nextDate) {
            newItem.targetDate = nextDate;
        }
        else {
            // Cannot find a valid future date (e.g., end date is also in the past)
            console.warn(`Could not find a valid future start date for recurring item '${newItem.name}'. Setting as past.`);
            newItem.isPast = true; // Mark immediately as past/finished
        }
    }
    else {
        // Set isPast based on initial target date for non-recurring or future recurring
        newItem.isPast = new Date(newItem.targetDate) < new Date();
    }
    countdownItems.push(newItem);
    saveItems(countdownItems);
    renderCountdownList(countdownItems); // Re-render the list
    console.log("Added new item:", newItem.name);
}
// Helper to find the first valid future date for a recurring event
function getNextValidOccurrence(item) {
    let currentDate = item.targetDate;
    const now = new Date();
    if (!item.isRecurring || !item.recurrenceInterval)
        return null;
    while (new Date(currentDate) < now) {
        const next = calculateNextOccurrence(currentDate, item.recurrenceInterval);
        if (!next || isRecurrenceFinished(next, item.recurrenceEndDate)) {
            return null; // Stop if no next date or recurrence finished
        }
        currentDate = next;
    }
    return currentDate; // This is the first occurrence >= now
}
function handleDismissItem(id) {
    countdownItems = countdownItems.filter(item => item.id !== id);
    saveItems(countdownItems);
    renderCountdownList(countdownItems); // Re-render
    console.log("Dismissed item:", id);
}
function handleFilterChange(newFilter) {
    // The filter state is managed in ui.ts, just need to re-render
    console.log("Filter changed to:", newFilter);
    renderCountdownList(countdownItems);
}
function handleExport() {
    if (countdownItems.length === 0) {
        alert("Nothing to export!");
        return;
    }
    exportItems(countdownItems);
    console.log("Exporting items...");
}
function handleImport(file) {
    console.log("Attempting to import file:", file.name);
    importItems(file, (importedItems) => {
        // Optional: Ask user if they want to replace or merge
        // For simplicity, let's replace current items
        if (confirm(`Importing ${importedItems.length} items will replace your current list. Continue?`)) {
            countdownItems = importedItems;
            checkPastEvents(); // Re-check status of imported items
            saveItems(countdownItems);
            renderCountdownList(countdownItems);
            console.log("Import successful. Items replaced.");
            alert("Import successful!");
        }
        else {
            console.log("Import cancelled by user.");
        }
    });
}
function checkPastEvents() {
    let itemsChanged = false;
    const now = new Date();
    countdownItems.forEach(item => {
        const targetDate = new Date(item.targetDate);
        if (!item.isPast && targetDate <= now) {
            // Event just passed
            if (item.isRecurring && item.recurrenceInterval) {
                const nextOccurrence = calculateNextOccurrence(item.targetDate, item.recurrenceInterval);
                if (nextOccurrence && !isRecurrenceFinished(nextOccurrence, item.recurrenceEndDate)) {
                    console.log(`Recurring item '${item.name}' passed. Updating to next occurrence: ${nextOccurrence}`);
                    item.targetDate = nextOccurrence;
                    item.isPast = false; // Reset past flag as it's updated to future
                }
                else {
                    console.log(`Recurring item '${item.name}' passed and recurrence finished.`);
                    item.isPast = true; // Mark as permanently past
                }
            }
            else {
                // Non-recurring event passed
                console.log(`Non-recurring item '${item.name}' passed.`);
                item.isPast = true;
            }
            itemsChanged = true;
        }
        else if (item.isPast && targetDate > now) {
            // This case shouldn't normally happen if logic is correct,
            // but could occur if system clock changes or data is manually edited.
            // Re-evaluate if it's actually still past.
            console.warn(`Item '${item.name}' was marked as past, but target date is now in the future. Resetting.`);
            item.isPast = false;
            itemsChanged = true;
        }
    });
    if (itemsChanged) {
        saveItems(countdownItems); // Save changes if any item's state was updated
    }
    return itemsChanged;
}
function startTimerUpdates() {
    if (timerInterval) {
        clearInterval(timerInterval); // Clear existing interval if any
    }
    timerInterval = window.setInterval(() => {
        const stateChanged = checkPastEvents(); // Check if any events passed or recurred
        updateTimers(countdownItems); // Update display of time remaining
        if (stateChanged) {
            renderCountdownList(countdownItems); // Re-render list if state changed (e.g., event passed, recurrence updated)
        }
    }, 1000); // Update every second
    console.log("Timer updates started.");
}
// --- Initialize the App ---
// Ensure DOM is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', initializeApp);
