// Character Package Management Types

import { AvatarConfiguration, PersonalityTraits, VoiceCharacteristics, AgeRange } from '../avatar/types';
import { AssetInfo } from '../assets/types';

export interface CharacterPackageManager {
  installCharacterPackage(packagePath: string): Promise<InstallationResult>;
  validatePackage(packagePath: string): Promise<ValidationResult>;
  listAvailableCharacters(userAge: number): Promise<CharacterPackage[]>;
  updateCharacterPackage(packageId: string): Promise<UpdateResult>;
  uninstallCharacterPackage(packageId: string): Promise<void>;
  getPackageInfo(packageId: string): Promise<CharacterPackage>;
  exportUserCharacter(userId: string): Promise<CharacterPackage>;
}

export interface CharacterPackage {
  packageId: string;
  version: string;
  metadata: CharacterMetadata;
  assets: CharacterAssets;
  configuration: CharacterConfiguration;
  signature: string; // Digital signature for integrity
  manifest: PackageManifest;
}

export interface CharacterMetadata {
  name: string;
  description: string;
  author: string;
  version: string;
  ageRating: AgeRating;
  tags: string[];
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
  fileSize: number;
  checksum: string;
  license: string;
  website?: string;
  supportEmail?: string;
}

export interface CharacterAssets {
  models: ModelAsset[];
  textures: TextureAsset[];
  animations: AnimationAsset[];
  audio: AudioAsset[];
  metadata: AssetManifest;
}

export interface CharacterConfiguration {
  defaultAppearance: any; // AppearanceConfiguration from avatar types
  personalityPresets: PersonalityTraits[];
  voicePresets: VoiceCharacteristics[];
  emotionMappings: EmotionMapping[];
  compatibilityVersion: string;
}

export interface PackageManifest {
  package: PackageInfo;
  compatibility: CompatibilityInfo;
  content: ContentInfo;
  assets: AssetSummary;
  performance: PerformanceInfo;
  dependencies: PackageDependency[];
  installation: InstallationInfo;
}

export interface PackageInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  website?: string;
  license: string;
}

export interface CompatibilityInfo {
  minSystemVersion: string;
  maxSystemVersion: string;
  requiredFeatures: string[];
  optionalFeatures: string[];
}

export interface ContentInfo {
  ageRating: AgeRating;
  contentWarnings: string[];
  safetyLevel: SafetyLevel;
  parentalApprovalRequired: boolean;
}

export interface AssetSummary {
  totalSize: number;
  modelCount: number;
  textureCount: number;
  animationCount: number;
  audioCount: number;
}

export interface PerformanceInfo {
  recommendedGPUMemory: string;
  triangleCount: number;
  textureResolution: string;
  performanceLevel: string;
}

export interface PackageDependency {
  packageId: string;
  version: string;
  required: boolean;
}

export interface InstallationInfo {
  requiresRestart: boolean;
  postInstallScript?: string;
  uninstallScript?: string;
  installationPath: string;
}

export interface InstallationResult {
  success: boolean;
  packageId: string;
  installedAssets: string[];
  errors: string[];
  warnings: string[];
  requiresRestart: boolean;
  installationPath: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  safetyIssues: string[];
  performanceWarnings: string[];
  compatibilityIssues: string[];
}

export interface UpdateResult {
  success: boolean;
  oldVersion: string;
  newVersion: string;
  changedAssets: string[];
  requiresRestart: boolean;
  errors: string[];
}

export interface ModelAsset extends AssetInfo {
  format: ModelFormat;
  triangleCount: number;
  boneCount: number;
  animationSupport: boolean;
}

export interface TextureAsset extends AssetInfo {
  format: TextureFormat;
  resolution: TextureResolution;
  channels: number;
  compressed: boolean;
}

export interface AnimationAsset extends AssetInfo {
  format: AnimationFormat;
  duration: number;
  frameRate: number;
  boneCount: number;
  looping: boolean;
}

export interface AudioAsset extends AssetInfo {
  format: AudioFormat;
  duration: number;
  sampleRate: number;
  channels: number;
  bitRate: number;
}

export interface AssetManifest {
  version: string;
  totalAssets: number;
  totalSize: number;
  checksums: Record<string, string>;
  dependencies: Record<string, string[]>;
}

export interface EmotionMapping {
  trigger: string;
  emotion: string;
  intensity: number;
  duration: number;
  animationId: string;
}

// Enums
export enum AgeRating {
  ALL_AGES = 'all-ages',
  AGES_3_PLUS = '3+',
  AGES_7_PLUS = '7+',
  AGES_12_PLUS = '12+',
  AGES_16_PLUS = '16+',
  ADULTS_ONLY = 'adults-only'
}

export enum SafetyLevel {
  VERIFIED = 'verified',
  COMMUNITY_REVIEWED = 'community-reviewed',
  UNVERIFIED = 'unverified',
  FLAGGED = 'flagged'
}

export enum ModelFormat {
  GLB = 'glb',
  GLTF = 'gltf',
  FBX = 'fbx',
  OBJ = 'obj'
}

export enum TextureFormat {
  PNG = 'png',
  JPG = 'jpg',
  WEBP = 'webp',
  DDS = 'dds',
  KTX = 'ktx'
}

export enum TextureResolution {
  LOW = '512x512',
  MEDIUM = '1024x1024',
  HIGH = '2048x2048',
  ULTRA = '4096x4096'
}

export enum AnimationFormat {
  FBX = 'fbx',
  GLTF = 'gltf',
  BVH = 'bvh',
  CUSTOM = 'custom'
}

export enum AudioFormat {
  MP3 = 'mp3',
  WAV = 'wav',
  OGG = 'ogg',
  AAC = 'aac'
}

export enum PackageStatus {
  AVAILABLE = 'available',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  UPDATING = 'updating',
  ERROR = 'error',
  DEPRECATED = 'deprecated'
}