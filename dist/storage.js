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
export function loadItems() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        try {
            // Basic validation could be added here (e.g., check if it's an array)
            const items = JSON.parse(storedData);
            // Ensure date strings are valid Dates upon load (or handle potential errors)
            // Dates are stored as strings, parsed when needed. Add isPast flag.
            return items.map(item => (Object.assign(Object.assign({}, item), { isPast: new Date(item.targetDate) < new Date() })));
        }
        catch (e) {
            console.error("Error parsing localStorage data:", e);
            localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            return [];
        }
    }
    return [];
}
export function saveItems(items) {
    // Remove the transient 'isPast' flag before saving
    const itemsToSave = items.map((_a) => {
        var { isPast } = _a, rest = __rest(_a, ["isPast"]);
        return rest;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToSave));
}
export function exportItems(items) {
    const dataStr = JSON.stringify(items, null, 2); // Pretty print JSON
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `final_countdown_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
export function importItems(file, callback) {
    const reader = new FileReader();
    reader.onload = (event) => {
        var _a;
        try {
            const json = (_a = event.target) === null || _a === void 0 ? void 0 : _a.result;
            const importedData = JSON.parse(json);
            // Basic validation: Check if it's an array
            if (!Array.isArray(importedData)) {
                throw new Error("Imported data is not an array.");
            }
            // More robust validation could check item structure here
            const validItems = importedData
                .filter(item => item.id && item.name && item.targetDate) // Example check
                .map((item) => ({
                id: item.id,
                name: item.name,
                targetDate: item.targetDate,
                originalTargetDate: item.originalTargetDate || item.targetDate, // Add fallback
                isRecurring: !!item.isRecurring,
                recurrenceInterval: item.recurrenceInterval,
                recurrenceEndDate: item.recurrenceEndDate || null,
                category: item.category || 'Uncategorized',
                note: item.note || '',
                link: item.link || '',
                design: item.design || 'default',
                createdAt: item.createdAt || new Date().toISOString(),
                isPast: new Date(item.targetDate) < new Date() // Calculate isPast
            }));
            callback(validItems); // Pass validated items back to app
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
