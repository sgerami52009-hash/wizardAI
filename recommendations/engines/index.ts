/**
 * Recommendation Engines
 * 
 * Exports all recommendation engines including user preferences, family coordination,
 * activity recommendations, schedule optimization, educational recommendations,
 * and household efficiency analysis.
 */

export { UserPreferenceEngine, IUserPreferenceStorage } from './user-preference-engine';
export { UserPreferenceStorage, InMemoryUserPreferenceStorage } from './user-preference-storage';
export { FamilyPreferenceCoordinator, IFamilyStorage } from './family-preference-coordinator';
export { InMemoryFamilyStorage, FileFamilyStorage } from './family-storage';
export { HouseholdEfficiencyEngine } from './household-efficiency-engine';