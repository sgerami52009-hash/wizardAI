# Voice Interaction Pipeline

This directory contains the core voice processing pipeline for the home assistant device.

## Structure

- `interfaces.ts` - Core TypeScript interfaces for all voice pipeline components
- `event-bus.ts` - Event system for component communication with audit logging
- `errors.ts` - Error handling classes and recovery mechanisms
- `index.ts` - Main module exports

## Safety Features

- All voice processing validates child-safe content through `validateChildSafeContent()`
- No persistent voice data storage - memory processing only
- Comprehensive audit logging with sanitized data
- Parental controls and supervision capabilities

## Performance Requirements

- Target response latency: <500ms on Jetson Nano Orin
- Memory usage: <8GB RAM total system usage
- Offline-first operation with graceful degradation
- Efficient error recovery to maintain responsiveness

## Components (To be implemented)

- Wake Word Detector - Always-on activation phrase detection
- Speech Recognizer - Offline speech-to-text conversion
- Text-to-Speech Engine - Natural voice synthesis
- Pipeline Orchestrator - End-to-end flow coordination

## Event System

The event bus provides:
- Type-safe event publishing and subscription
- Priority-based event handling
- Audit trail with sanitized data
- Component lifecycle management
- Error propagation and recovery coordination

## Error Handling

Comprehensive error recovery with:
- Circuit breaker pattern for failing components
- Automatic retry with exponential backoff
- Graceful degradation under resource constraints
- Child-friendly error messages
- System health monitoring