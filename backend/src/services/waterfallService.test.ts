import { describe, it, expect } from 'vitest';

describe('StageHandoff metadata', () => {
  it('should have required fields', () => {
    const handoff = {
      stage: 'architect' as const,
      confidence: 0.85,
      keyDecisions: ['Use React over Vue because existing codebase'],
      constraints: ['Must maintain backward compatibility'],
      openQuestions: ['Which state management library?'],
      tokenCount: 1200
    };

    expect(handoff.confidence).toBeGreaterThanOrEqual(0);
    expect(handoff.confidence).toBeLessThanOrEqual(1);
    expect(handoff.keyDecisions.length).toBeGreaterThan(0);
    expect(handoff.stage).toBe('architect');
  });

  it('should validate confidence range', () => {
    const validHandoffs = [
      { stage: 'reasoner' as const, confidence: 0, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 100 },
      { stage: 'executor' as const, confidence: 0.5, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 100 },
      { stage: 'reviewer' as const, confidence: 1, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 100 },
    ];

    for (const h of validHandoffs) {
      expect(h.confidence).toBeGreaterThanOrEqual(0);
      expect(h.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should support all stage types', () => {
    const stages = ['architect', 'reasoner', 'executor', 'reviewer'] as const;
    stages.forEach(stage => {
      const handoff = { stage, confidence: 0.75, keyDecisions: [], constraints: [], openQuestions: [], tokenCount: 100 };
      expect(handoff.stage).toBe(stage);
    });
  });
});

describe('Issue categorization', () => {
  it('should categorize critical issues', () => {
    const issues = [
      'compilation error in auth.ts',
      'security vulnerability in password reset',
      'crash on startup',
      'normal bug report'
    ];

    const criticalIssues = issues.filter(i => /compil|error|crash|security|inject/i.test(i));
    expect(criticalIssues).toHaveLength(3);
    expect(criticalIssues).toContain('compilation error in auth.ts');
    expect(criticalIssues).toContain('security vulnerability in password reset');
    expect(criticalIssues).toContain('crash on startup');
  });

  it('should categorize major issues', () => {
    const issues = [
      'missing return type',
      'wrong API endpoint',
      'incorrect validation logic',
      'broken link',
      'minor typo'
    ];

    const majorIssues = issues.filter(i => /missing|wrong|incorrect|broken/i.test(i));
    expect(majorIssues).toHaveLength(4);
  });

  it('should separate issue severities', () => {
    const issues = [
      'compilation error',
      'missing export',
      'minor typo in comment'
    ];

    const critical = issues.filter(i => /compil|error|crash|security|inject/i.test(i));
    const major = issues.filter(i => !critical.includes(i) && /missing|wrong|incorrect|broken/i.test(i));
    const minor = issues.filter(i => !critical.includes(i) && !major.includes(i));

    expect(critical).toEqual(['compilation error']);
    expect(major).toEqual(['missing export']);
    expect(minor).toEqual(['minor typo in comment']);
  });
});
