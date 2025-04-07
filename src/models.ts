export type RecurrenceInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TimerDesign = 'default' | 'compact' | 'card';

export interface CountdownItem {
    id: string;               // Unique identifier
    name: string;             // Event name
    targetDate: string;       // ISO 8601 string for the *next* occurrence
    originalTargetDate: string; // The very first target date set by the user
    isRecurring: boolean;
    recurrenceInterval?: RecurrenceInterval;
    recurrenceEndDate?: string | null; // ISO 8601 string or null
    category: string;         // Category name (e.g., "TV Shows", "Life Events")
    note?: string;
    link?: string;
    design: TimerDesign;      // Visual style identifier
    createdAt: string;        // ISO 8601 string when item was created
    isPast: boolean;          // Flag if the current targetDate has passed
}

// Data structure for form values, useful for passing data around
export interface CountdownFormData {
    name: string;
    targetDateTime: string; // Combined date and time ISO string or similar input format
    isRecurring: boolean;
    recurrenceInterval?: RecurrenceInterval;
    recurrenceEndDate?: string | null;
    category: string;
    note?: string;
    link?: string;
    design: TimerDesign;
}