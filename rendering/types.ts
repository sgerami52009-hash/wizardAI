// Rendering System Types and Interfaces

import { AvatarConfiguration, EmotionType, AnimationSet } from '../avatar/types';

export interface Avatar3DRenderer {
  renderAvatar(configuration: AvatarConfiguration): Promise<RenderFrame>;
  updateAnimation(animationType: AnimationType, intensity: number): Promise<void>;
  setEmotionalExpression(emotion: EmotionType, duration: number): Promise<void>;
  optimizeRenderQuality(targetFPS: number): Promise<QualitySettings>;
  preloadAssets(assetIds: string[]): Promise<void>;
  getPerformanceMetrics(): RenderingMetrics;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface RenderFrame {
  frameId: string;
  timestamp: number;
  renderTime: number;
  triangleCount: number;
  textureMemory: number;
  success: boolean;
}

export interface RenderingMetrics {
  currentFPS: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
  renderTime: number;
  triangleCount: number;
  textureMemory: number;
  shaderCompileTime: number;
  drawCalls: number;
}

export interface QualitySettings {
  lodLevel: number; // Level of detail (0-4, 0 = highest quality)
  textureResolution: number; // Max texture resolution
  shadowQuality: ShadowQuality;
  antiAliasing: AntiAliasingType;
  particleCount: number;
  animationQuality: AnimationQuality;
  renderDistance: number;
}

export interface PerformanceThresholds {
  minFPS: number;
  maxGPUMemory: number; // In GB
  maxCPUUsage: number; // Percentage
  maxRenderTime: number; // In milliseconds
}

export interface RenderingCapabilities {
  maxTextureSize: number;
  maxTriangles: number;
  supportedShaderVersions: string[];
  hardwareAcceleration: boolean;
  memoryLimits: MemoryLimits;
}

export interface MemoryLimits {
  totalGPU: number; // In GB
  availableGPU: number; // In GB
  textureMemory: number; // In GB
  vertexMemory: number; // In GB
}

// Enums
export enum AnimationType {
  IDLE = 'idle',
  TALKING = 'talking',
  LISTENING = 'listening',
  THINKING = 'thinking',
  GESTURE = 'gesture',
  EXPRESSION = 'expression'
}

export enum ShadowQuality {
  DISABLED = 'disabled',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum AntiAliasingType {
  NONE = 'none',
  FXAA = 'fxaa',
  MSAA_2X = 'msaa_2x',
  MSAA_4X = 'msaa_4x'
}

export enum AnimationQuality {
  LOW = 'low',      // 30fps, reduced bone count
  MEDIUM = 'medium', // 60fps, standard bones
  HIGH = 'high'     // 60fps, full bone hierarchy
}

export enum RenderingBackend {
  WEBGL = 'webgl',
  VULKAN = 'vulkan',
  OPENGL = 'opengl'
}