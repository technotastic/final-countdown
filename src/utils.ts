import { CountdownItem, RecurrenceInterval } from './models.js';

// Basic unique ID generator
export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Format remaining time
export function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return "Now!";

    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    let parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`); // Show seconds if < 1 min

    return parts.join(' ');
}

// Format date for display
export function formatDisplayDate(isoDateString: string): string {
    const date = new Date(isoDateString);
    // Use options for clarity, adjust as needed
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true // Or false for 24h
    };
    return date.toLocaleString(undefined, options); // Use browser's locale
}


// Calculate the next occurrence date based on the *last* target date
export function calculateNextOccurrence(lastTargetDateStr: string, interval: RecurrenceInterval): string | null {
    const lastTargetDate = new Date(lastTargetDateStr);
    let nextDate = new Date(lastTargetDate);

    switch (interval) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'monthly':
            // Handles month rollovers correctly
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
        case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        default:
            console.error("Invalid recurrence interval:", interval);
            return null; // Should not happen with TypeScript
    }

    // Check if the calculated next date is valid (e.g., Feb 30th -> Mar 2nd)
    // JS Date object handles this automatically.

    return nextDate.toISOString();
}


// Checks if a recurring event should stop based on end date
export function isRecurrenceFinished(nextDateStr: string | null, recurrenceEndDateStr: string | null | undefined): boolean {
    if (!nextDateStr || !recurrenceEndDateStr) {
        return false; // No end date or no valid next date means it continues (or never started)
    }
    const nextDate = new Date(nextDateStr);
    const endDate = new Date(recurrenceEndDateStr);

    // Important: Compare dates only, ignore time unless specified otherwise
    // Let's compare the *start* of the day for robustness
    nextDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // If the next occurrence date is *after* the end date, it's finished.
    return nextDate > endDate;
}