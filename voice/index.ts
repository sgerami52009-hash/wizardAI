/**
 * Voice Processing Module
 * Handles speech recognition, wake word detection, text-to-speech, and intent processing
 * Safety: Child-safe content validation, no persistent voice data storage
 * Performance: Optimized for Jetson Nano Orin hardware constraints
 */

export * from './interfaces';
export * from './event-bus';
export * from './errors';

// Implemented components
export * from './wake-word-detector';
export * from './wake-word-manager';
export * from './speech-recognizer';
export * from './speech-recognition-service';
export * from './voice-profile-manager';
export * from './language-model-manager';
export * from './recognition-confidence';
export * from './recognition-error-handler';
export * from './audio-preprocessor';

// Intent processing components
export * from './intent-classifier';
export * from './entity-extractor';
export * from './command-router';
export * from './conversation-manager';
export * from './intent-processing-pipeline';

// Response generation components
export * from './response-generator';
export * from './multi-modal-response';

// Text-to-speech components
export * from './text-to-speech-engine';
export * from './tts-manager';
export * from './emotional-tts-controller';
export * from './ssml-processor';
export * from './speech-interruption-handler';

// Resource management components
export * from './resource-monitor';
export * from './performance-optimizer';
export * from './hardware-optimization';

// Offline capabilities
export * from './offline-capability-detector';
export * from './offline-model-manager';
export * from './model-update-manager';
export * from './feature-restoration-manager';
export * from './offline-notification-service';
export * from './connectivity-monitor';

// Pipeline orchestration and integration
export * from './pipeline-orchestrator';
export * from './event-coordinator';
export * from './session-manager';