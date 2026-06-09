/**
 * Format a sport slug into a properly capitalized display name.
 * e.g. "track_and_field" → "Track And Field", "martial_arts" → "Martial Arts"
 */
export function formatSportName(sport: string): string {
    return sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize a sport name/slug to a consistent slug format.
 * Matches the website's normalizeSports logic.
 * e.g. "Baseball" → "baseball", "Track & Field" → "track_and_field"
 */
export function normalizeSport(sport: string): string {
    return sport
        .toLowerCase()
        .trim()
        .replace(/\s*&\s*/g, '_and_')
        .replace(/[-\s]+/g, '_');
}
