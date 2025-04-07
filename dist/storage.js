var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
const STORAGE_KEY = 'finalCountdownItems';
// Helper to parse and validate items, ensuring dates are valid
function parseAndValidateItems(jsonString) {
    const parsedData = JSON.parse(jsonString);
    if (!Array.isArray(parsedData)) {
        throw new Error("Stored data is not an array.");
    }
    const validatedItems = [];
    const now = new Date();
    parsedData.forEach((item, index) => {
        // Basic structure check
        if (!item || typeof item !== 'object' || !item.id || !item.name || !item.targetDate) {
            console.warn(`Skipping invalid item at index ${index} during load:`, item);
            return;
        }
        // Date validation
        const targetDate = new Date(item.targetDate);
        const originalTargetDate = item.originalTargetDate ? new Date(item.originalTargetDate) : targetDate;
        const createdAt = item.createdAt ? new Date(item.createdAt) : now;
        const recurrenceEndDate = item.recurrenceEndDate ? new Date(item.recurrenceEndDate) : null;
        if (isNaN(targetDate.getTime())) {
            console.warn(`Skipping item with invalid targetDate at index ${index}:`, item.id, item.targetDate);
            return;
        }
        if (isNaN(originalTargetDate.getTime())) {
            console.warn(`Invalid originalTargetDate for item ${item.id}, using targetDate.`);
            item.originalTargetDate = item.targetDate; // Fallback
        }
        if (isNaN(createdAt.getTime())) {
            console.warn(`Invalid createdAt for item ${item.id}, using current time.`);
            item.createdAt = now.toISOString(); // Fallback
        }
        if (recurrenceEndDate && isNaN(recurrenceEndDate.getTime())) {
            console.warn(`Invalid recurrenceEndDate for item ${item.id}, setting to null.`);
            item.recurrenceEndDate = null; // Clear invalid date
        }
        // Reconstruct with defaults and calculate isPast
        validatedItems.push({
            id: String(item.id),
            name: String(item.name),
            targetDate: targetDate.toISOString(),
            originalTargetDate: originalTargetDate.toISOString(),
            isRecurring: !!item.isRecurring,
            recurrenceInterval: item.recurrenceInterval || undefined,
            recurrenceEndDate: recurrenceEndDate ? recurrenceEndDate.toISOString() : null,
            category: String(item.category || 'Uncategorized'),
            note: String(item.note || ''),
            link: String(item.link || ''),
            design: item.design || 'default',
            createdAt: createdAt.toISOString(),
            isPast: targetDate < now // Calculate isPast based on current time
        });
    });
    return validatedItems;
}
export function loadItems() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        try {
            return parseAndValidateItems(storedData);
        }
        catch (e) {
            console.error("Error parsing localStorage data:", e);
            // Optionally backup corrupted data before removing
            // localStorage.setItem(STORAGE_KEY + '_backup_' + Date.now(), storedData);
            localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            return [];
        }
    }
    return [];
}
export function saveItems(items) {
    try {
        // Ensure isPast isn't saved (it's derived on load/update)
        const itemsToSave = items.map((_a) => {
            var { isPast } = _a, rest = __rest(_a, ["isPast"]);
            return rest;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToSave));
    }
    catch (e) {
        console.error("Error saving items to localStorage:", e);
        // Consider notifying the user if storage fails (e.g., quota exceeded)
        alert("Error saving data! Your changes might not be persisted. LocalStorage might be full.");
    }
}
// Function to get a single item by ID (useful for editing/copying)
export function getItemById(id) {
    const items = loadItems(); // Load fresh data
    return items.find(item => item.id === id);
}
export function exportItems(items) {
    // Use the clean data passed in, no need to load again
    const itemsToExport = items.map((_a) => {
        var { isPast } = _a, rest = __rest(_a, ["isPast"]);
        return rest;
    }); // Remove transient isPast flag
    const dataStr = JSON.stringify(itemsToExport, null, 2); // Pretty print JSON
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `final_countdown_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up blob URL
}
export function importItems(file, callback) {
    const reader = new FileReader();
    reader.onload = (event) => {
        var _a;
        try {
            const json = (_a = event.target) === null || _a === void 0 ? void 0 : _a.result;
            if (!json) {
                throw new Error("File content is empty or unreadable.");
            }
            // Use the same validation logic as loadItems
            const importedAndValidatedItems = parseAndValidateItems(json);
            callback(importedAndValidatedItems); // Pass validated items back to app
        }
        catch (error) {
            console.error("Error importing file:", error);
            alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };
    reader.onerror = () => {
        console.error("Error reading file:", reader.error);
        alert("Error reading file.");
    };
    reader.readAsText(file);
}
