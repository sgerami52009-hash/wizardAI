/**
 * LLM-Enhanced Learning Engine Integration Example
 * 
 * Demonstrates how to integrate and use the LLM-enhanced learning engine
 * in a family assistant application with natural language capabilities.
 */

import { createAutoConfiguredLearningEngine } from './llm-enhanced-factory';
import { LLMEnhancedLearningEngine } from './llm-enhanced-learning-engine';
import { UserInteraction, UserFeedback } from '../types';
import { InteractionType } from '../enums';

/**
 * Example: Complete workflow with LLM-enhanced learning
 */
export async function demonstrateLLMEnhancedLearning() {
  console.log('🚀 Starting LLM-Enhanced Learning Engine Demo...\n');

  try {
    // Step 1: Create auto-configured learning engine
    console.log('1. Creating LLM-Enhanced Learning Engine...');
    const learningEngine = await createAutoConfiguredLearningEngine();
    
    // Check if we got the enhanced version
    const isEnhanced = learningEngine instanceof LLMEnhancedLearningEngine;
    console.log(`   ✅ Engine created: ${isEnhanced ? 'LLM-Enhanced' : 'Traditional'}\n`);

    if (!isEnhanced) {
      console.log('   ℹ️  LLM features not available, using traditional learning engine\n');
      return;
    }

    const enhancedEngine = learningEngine as LLMEnhancedLearningEngine;

    // Step 2: Process natural language query
    console.log('2. Processing Natural Language Query...');
    const userQuery = "Can you suggest some fun science activities for my 8-year-old who loves experiments?";
    console.log(`   Query: "${userQuery}"`);
    
    const queryResult = await enhancedEngine.processNaturalLanguageQuery(
      'demo-user-123',
      userQuery
    );
    
    console.log(`   Intent: ${queryResult.intent.primaryIntent} (confidence: ${queryResult.intent.confidence})`);
    console.log(`   Response: "${queryResult.response}"`);
    
    if (queryResult.recommendations) {
      console.log(`   Generated ${queryResult.recommendations.length} recommendations\n`);
    }

    // Step 3: Simulate user interactions
    console.log('3. Simulating User Interactions...');
    const interactions: UserInteraction[] = [
      {
        userId: 'demo-user-123',
        recommendationId: 'rec-volcano-experiment',
        interactionType: InteractionType.ACCEPT,
        timestamp: new Date(),
        satisfaction: 0.9,
        context: { 
          timeOfDay: 'afternoon',
          location: { type: 'home', room: 'kitchen' },
          social: { presentUsers: ['parent', 'child'], familyMembers: ['mom', 'child1'] }
        },
        textualFeedback: 'My daughter absolutely loved the volcano experiment! She wants to do more chemistry activities.'
      },
      {
        userId: 'demo-user-123',
        recommendationId: 'rec-plant-growth',
        interactionType: InteractionType.ACCEPT,
        timestamp: new Date(),
        satisfaction: 0.8,
        context: { 
          timeOfDay: 'morning',
          location: { type: 'home', room: 'garden' }
        },
        textualFeedback: 'The plant growth experiment was educational and fun. We learned about photosynthesis.'
      }
    ];

    await enhancedEngine.updateUserModel('demo-user-123', interactions);
    console.log('   ✅ User model updated with interactions\n');

    // Step 4: Analyze user preferences from natural language
    console.log('4. Analyzing User Preferences...');
    const preferenceInput = "We really enjoy hands-on science experiments, especially chemistry and biology. The kids are most engaged in the afternoon after school.";
    console.log(`   Input: "${preferenceInput}"`);
    
    const preferences = await enhancedEngine.analyzeUserPreferences(
      'demo-user-123',
      preferenceInput,
      { childrenAges: [8], familySize: 2 }
    );
    
    console.log('   Analyzed Preferences:');
    console.log(`   - Activity Types: ${preferences.activityTypes.join(', ')}`);
    console.log(`   - Educational Focus: ${preferences.educationalFocus.join(', ')}`);
    console.log(`   - Best Time: ${Object.entries(preferences.timePreferences)
      .sort(([,a], [,b]) => b - a)[0][0]}\n`);

    // Step 5: Generate enhanced recommendations
    console.log('5. Generating Enhanced Recommendations...');
    const context = {
      userId: 'demo-user-123',
      conversationHistory: [],
      familyContext: { childrenAges: [8], interests: ['science', 'experiments'] },
      emotionalState: { sentiment: 0.8, mood: 'excited' },
      semanticContext: { interests: ['chemistry', 'biology', 'hands-on'] },
      traditionalContext: { recentInteractions: interactions }
    };

    const recommendations = await enhancedEngine.generateRecommendations(
      'demo-user-123',
      context,
      3
    );

    console.log(`   Generated ${recommendations.length} enhanced recommendations:`);
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec.title}`);
      console.log(`      ${rec.description}`);
      console.log(`      Safety: ${(rec.safetyRating * 100).toFixed(0)}% | Education: ${(rec.educationalValue * 100).toFixed(0)}%`);
      if (rec.naturalLanguageExplanation) {
        console.log(`      Explanation: "${rec.naturalLanguageExplanation}"`);
      }
      console.log('');
    });

    // Step 6: Process user feedback
    console.log('6. Processing User Feedback...');
    const feedback: UserFeedback = {
      userId: 'demo-user-123',
      recommendationId: recommendations[0].id,
      accepted: true,
      rating: 5,
      timestamp: new Date(),
      textualFeedback: 'Perfect recommendation! This was exactly what we were looking for. The kids were engaged for hours.',
      context: { timeOfDay: 'afternoon' }
    };

    await enhancedEngine.adaptToUserFeedback('demo-user-123', feedback);
    console.log('   ✅ Feedback processed and model adapted\n');

    // Step 7: Get enhanced insights
    console.log('7. Getting Enhanced Learning Insights...');
    const insights = await enhancedEngine.getModelInsights('demo-user-123');
    
    console.log('   Learning Insights:');
    console.log(`   - Top Interests: ${insights.topInterests.map(i => i.name).join(', ')}`);
    console.log(`   - Behavior Patterns: ${insights.behaviorPatterns.length} patterns identified`);
    if (insights.naturalLanguageExplanation) {
      console.log(`   - AI Explanation: "${insights.naturalLanguageExplanation}"`);
    }
    if (insights.llmEnhancedInsights) {
      console.log(`   - Semantic Interests: ${insights.llmEnhancedInsights.semanticInterests.join(', ')}`);
      console.log(`   - Key Patterns: ${insights.llmEnhancedInsights.keyPatterns.join(', ')}`);
    }
    console.log('');

    // Step 8: Health check
    console.log('8. System Health Check...');
    const healthCheck = await enhancedEngine.healthCheck();
    console.log(`   Status: ${healthCheck.status.toUpperCase()}`);
    console.log(`   LLM Available: ${healthCheck.components.llmIntegration?.llmAvailable ? 'Yes' : 'No'}`);
    console.log(`   Memory Usage: ${healthCheck.components.memoryUsage?.heapUsed}MB\n`);

    // Step 9: Performance metrics
    console.log('9. Performance Metrics...');
    const metrics = enhancedEngine.getPerformanceMetrics();
    console.log('   Performance Summary:');
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'object' && value.avgTime) {
        console.log(`   - ${key}: ${value.avgTime.toFixed(0)}ms avg (${value.count} operations)`);
      }
    });

    console.log('\n🎉 LLM-Enhanced Learning Engine Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('✅ Natural language query processing');
    console.log('✅ Enhanced recommendation generation');
    console.log('✅ Semantic feedback analysis');
    console.log('✅ User preference learning from natural language');
    console.log('✅ Conversational AI integration');
    console.log('✅ Safety filtering and privacy preservation');
    console.log('✅ Performance monitoring and health checks');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.log('\nThis might be due to:');
    console.log('- Missing LLM API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
    console.log('- Network connectivity issues');
    console.log('- Insufficient system resources');
    console.log('\nThe system will gracefully fallback to traditional learning engine.');
  }
}

/**
 * Example: Simple natural language interaction
 */
export async function simpleNaturalLanguageExample() {
  console.log('🗣️  Simple Natural Language Interaction Example\n');

  try {
    const engine = await createAutoConfiguredLearningEngine();
    
    if (!(engine instanceof LLMEnhancedLearningEngine)) {
      console.log('LLM features not available');
      return;
    }

    const queries = [
      "What activities would be good for a rainy day?",
      "Something more educational please",
      "How about science experiments that are safe for kids?",
      "Can you explain why you recommended that?"
    ];

    console.log('Having a conversation with the learning engine:\n');

    for (const query of queries) {
      console.log(`👤 User: "${query}"`);
      
      const result = await engine.processNaturalLanguageQuery('example-user', query);
      
      console.log(`🤖 Assistant: "${result.response}"`);
      
      if (result.recommendations && result.recommendations.length > 0) {
        console.log(`   📋 Suggested: ${result.recommendations[0].title}`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('Example failed:', error);
  }
}

/**
 * Example: Family preference learning
 */
export async function familyPreferenceLearningExample() {
  console.log('👨‍👩‍👧‍👦 Family Preference Learning Example\n');

  try {
    const engine = await createAutoConfiguredLearningEngine();
    
    if (!(engine instanceof LLMEnhancedLearningEngine)) {
      console.log('LLM features not available');
      return;
    }

    // Simulate different family members expressing preferences
    const familyInputs = [
      {
        member: 'Mom',
        input: "We love educational activities that the whole family can do together. Art and science are our favorites."
      },
      {
        member: 'Dad', 
        input: "I prefer activities that are hands-on and teach practical skills. Building and engineering projects work well."
      },
      {
        member: 'Child (8)',
        input: "I like experiments and making things! Especially if they're colorful or make sounds."
      }
    ];

    console.log('Learning from family member preferences:\n');

    for (const { member, input } of familyInputs) {
      console.log(`${member}: "${input}"`);
      
      const preferences = await engine.analyzeUserPreferences(
        `family-member-${member.toLowerCase()}`,
        input,
        { familySize: 3, childrenAges: [8] }
      );
      
      console.log(`   Learned: ${preferences.activityTypes.join(', ')} activities`);
      console.log(`   Focus: ${preferences.educationalFocus.join(', ')}`);
      console.log('');
    }

    // Generate family-friendly recommendations
    console.log('Generating family-friendly recommendations...\n');
    
    const familyContext = {
      userId: 'family-unit',
      conversationHistory: [],
      familyContext: { 
        childrenAges: [8], 
        familySize: 3,
        interests: ['education', 'art', 'science', 'building', 'hands-on']
      },
      emotionalState: { sentiment: 0.7, mood: 'collaborative' },
      semanticContext: { interests: ['family-friendly', 'educational', 'creative'] },
      traditionalContext: {}
    };

    const recommendations = await engine.generateRecommendations(
      'family-unit',
      familyContext,
      3
    );

    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec.title}`);
      console.log(`   ${rec.description}`);
      console.log(`   Perfect for ages ${rec.ageRange[0]}-${rec.ageRange[1]}`);
      if (rec.naturalLanguageExplanation) {
        console.log(`   Why it's great: ${rec.naturalLanguageExplanation}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('Family example failed:', error);
  }
}

// Export for use in other modules
export {
  demonstrateLLMEnhancedLearning as runDemo,
  simpleNaturalLanguageExample as runSimpleExample,
  familyPreferenceLearningExample as runFamilyExample
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateLLMEnhancedLearning()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Demo execution failed:', error);
      process.exit(1);
    });
}