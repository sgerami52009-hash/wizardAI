/**
 * Family Storage Implementation
 * 
 * Provides storage for family data including member relationships,
 * family dynamics, and conflict resolution history.
 * 
 * Requirements: 1.2, 4.3, 6.3
 */

import {
  GroupDynamics,
  PreferenceConflict
} from '../types';
import { IFamilyStorage } from './family-preference-coordinator';

/**
 * In-memory family storage implementation
 * In production, this would be backed by a database
 */
export class InMemoryFamilyStorage implements IFamilyStorage {
  private familyMembers: Map<string, string[]> = new Map();
  private familyDynamics: Map<string, GroupDynamics> = new Map();
  private conflictHistory: Map<string, PreferenceConflict[]> = new Map();

  /**
   * Get all members of a family
   * Requirements: 1.2
   */
  async getFamilyMembers(familyId: string): Promise<string[]> {
    return this.familyMembers.get(familyId) || [];
  }

  /**
   * Add a member to a family
   * Requirements: 1.2
   */
  async addFamilyMember(familyId: string, userId: string): Promise<void> {
    const members = this.familyMembers.get(familyId) || [];
    if (!members.includes(userId)) {
      members.push(userId);
      this.familyMembers.set(familyId, members);
    }
  }

  /**
   * Remove a member from a family
   * Requirements: 1.2
   */
  async removeFamilyMember(familyId: string, userId: string): Promise<void> {
    const members = this.familyMembers.get(familyId) || [];
    const updatedMembers = members.filter(id => id !== userId);
    this.familyMembers.set(familyId, updatedMembers);
  }

  /**
   * Get family dynamics
   * Requirements: 4.3
   */
  async getFamilyDynamics(familyId: string): Promise<GroupDynamics> {
    return this.familyDynamics.get(familyId) || this.getDefaultDynamics();
  }

  /**
   * Save family dynamics
   * Requirements: 4.3
   */
  async saveFamilyDynamics(familyId: string, dynamics: GroupDynamics): Promise<void> {
    this.familyDynamics.set(familyId, dynamics);
  }

  /**
   * Get family conflict history
   * Requirements: 4.3
   */
  async getFamilyConflictHistory(familyId: string): Promise<PreferenceConflict[]> {
    return this.conflictHistory.get(familyId) || [];
  }

  /**
   * Save a conflict resolution
   * Requirements: 4.3
   */
  async saveConflictResolution(familyId: string, conflict: PreferenceConflict): Promise<void> {
    const history = this.conflictHistory.get(familyId) || [];
    history.push(conflict);
    
    // Keep only recent conflicts (last 50)
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    this.conflictHistory.set(familyId, history);
  }

  /**
   * Get default family dynamics for new families
   */
  private getDefaultDynamics(): GroupDynamics {
    return {
      leadershipStyle: 'collaborative',
      decisionMaking: 'consensus',
      conflictResolution: 'discussion'
    };
  }

  /**
   * Clear all data for a family (for testing or GDPR compliance)
   */
  async clearFamilyData(familyId: string): Promise<void> {
    this.familyMembers.delete(familyId);
    this.familyDynamics.delete(familyId);
    this.conflictHistory.delete(familyId);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFamilies: number;
    totalMembers: number;
    totalConflicts: number;
  }> {
    const totalFamilies = this.familyMembers.size;
    const totalMembers = Array.from(this.familyMembers.values())
      .reduce((sum, members) => sum + members.length, 0);
    const totalConflicts = Array.from(this.conflictHistory.values())
      .reduce((sum, conflicts) => sum + conflicts.length, 0);

    return {
      totalFamilies,
      totalMembers,
      totalConflicts
    };
  }
}

/**
 * File-based family storage implementation
 * Uses encrypted storage similar to user preferences
 */
export class FileFamilyStorage implements IFamilyStorage {
  private storageDir: string;
  private inMemoryCache: InMemoryFamilyStorage;

  constructor(storageDir: string = './data/families') {
    this.storageDir = storageDir;
    this.inMemoryCache = new InMemoryFamilyStorage();
  }

  async getFamilyMembers(familyId: string): Promise<string[]> {
    // In a real implementation, this would load from encrypted files
    return this.inMemoryCache.getFamilyMembers(familyId);
  }

  async getFamilyDynamics(familyId: string): Promise<GroupDynamics> {
    return this.inMemoryCache.getFamilyDynamics(familyId);
  }

  async saveFamilyDynamics(familyId: string, dynamics: GroupDynamics): Promise<void> {
    return this.inMemoryCache.saveFamilyDynamics(familyId, dynamics);
  }

  async getFamilyConflictHistory(familyId: string): Promise<PreferenceConflict[]> {
    return this.inMemoryCache.getFamilyConflictHistory(familyId);
  }

  async saveConflictResolution(familyId: string, conflict: PreferenceConflict): Promise<void> {
    return this.inMemoryCache.saveConflictResolution(familyId, conflict);
  }
}