// Basic unique ID generator
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
// Format remaining time
export function formatTimeRemaining(ms) {
    if (ms <= 0)
        return "Now!";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    let parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    // Always show seconds if less than a day for active timers, or if it's the only unit
    if (days === 0 && (seconds > 0 || parts.length === 0)) {
        parts.push(`${seconds}s`);
    }
    else if (parts.length === 0 && seconds <= 0) {
        // Handles edge case where calculated ms is slightly positive but seconds round down to 0
        return "Now!";
    }
    return parts.join(' ');
}
// Format date for display
export function formatDisplayDate(isoDateString) {
    try {
        const date = new Date(isoDateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error("Invalid date string for display:", isoDateString);
            return "Invalid Date";
        }
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        };
        return date.toLocaleString(undefined, options); // Use browser's locale
    }
    catch (e) {
        console.error("Error formatting display date:", e);
        return "Error Date";
    }
}
// Format date and time for input fields
export function formatDateTimeForInput(isoDateString) {
    try {
        const date = new Date(isoDateString);
        if (isNaN(date.getTime())) {
            throw new Error("Invalid date for input formatting");
        }
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Add 1 because months are 0-indexed
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return {
            date: `${year}-${month}-${day}`,
            time: `${hours}:${minutes}`
        };
    }
    catch (e) {
        console.error("Error formatting date/time for input:", e);
        // Return current date/time or empty strings as fallback
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        return { date: `${year}-${month}-${day}`, time: '12:00' }; // Default or empty
    }
}
// Calculate the next occurrence date based on the *last* target date
export function calculateNextOccurrence(lastTargetDateStr, interval) {
    try {
        const lastTargetDate = new Date(lastTargetDateStr);
        if (isNaN(lastTargetDate.getTime())) {
            console.error("Invalid last target date for recurrence calc:", lastTargetDateStr);
            return null;
        }
        let nextDate = new Date(lastTargetDate);
        switch (interval) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            default:
                // Should not happen with TypeScript, but good practice
                const exhaustiveCheck = interval;
                console.error("Invalid recurrence interval:", exhaustiveCheck);
                return null;
        }
        return nextDate.toISOString();
    }
    catch (e) {
        console.error("Error calculating next occurrence:", e);
        return null;
    }
}
// Checks if a recurring event should stop based on end date
export function isRecurrenceFinished(nextDateStr, recurrenceEndDateStr) {
    if (!nextDateStr || !recurrenceEndDateStr) {
        return false; // No end date or no valid next date means it continues
    }
    try {
        const nextDate = new Date(nextDateStr);
        const endDate = new Date(recurrenceEndDateStr);
        if (isNaN(nextDate.getTime()) || isNaN(endDate.getTime())) {
            console.error("Invalid date(s) for recurrence finished check:", nextDateStr, recurrenceEndDateStr);
            return true; // Treat as finished if dates are invalid to prevent infinite loops
        }
        // Compare the *start* of the day for robustness unless specific times matter
        nextDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        // If the next occurrence date is *strictly after* the end date, it's finished.
        return nextDate > endDate;
    }
    catch (e) {
        console.error("Error checking recurrence finished:", e);
        return true; // Treat as finished on error
    }
}
