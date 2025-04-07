import { CountdownItem } from './models.js';

const STORAGE_KEY = 'finalCountdownItems';

export function loadItems(): CountdownItem[] {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        try {
            // Basic validation could be added here (e.g., check if it's an array)
            const items: CountdownItem[] = JSON.parse(storedData);
            // Ensure date strings are valid Dates upon load (or handle potential errors)
            // Dates are stored as strings, parsed when needed. Add isPast flag.
            return items.map(item => ({
                 ...item,
                 isPast: new Date(item.targetDate) < new Date()
                }));
        } catch (e) {
            console.error("Error parsing localStorage data:", e);
            localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            return [];
        }
    }
    return [];
}

export function saveItems(items: CountdownItem[]): void {
    // Remove the transient 'isPast' flag before saving
    const itemsToSave = items.map(({ isPast, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToSave));
}

export function exportItems(items: CountdownItem[]): void {
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

export function importItems(file: File, callback: (items: CountdownItem[]) => void): void {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const importedData = JSON.parse(json);

            // Basic validation: Check if it's an array
            if (!Array.isArray(importedData)) {
                throw new Error("Imported data is not an array.");
            }

            // More robust validation could check item structure here
            const validItems: CountdownItem[] = importedData
                .filter(item => item.id && item.name && item.targetDate) // Example check
                .map((item: any) => ({ // Reconstruct to ensure structure
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
        } catch (error) {
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