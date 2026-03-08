import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaterfallService, WaterfallStep } from '../../services/waterfallService';
import { AIProviderFactory } from '../../services/aiProviderFactory';

// Mock the Factory to return our controlled mock provider
vi.mock('../../services/aiProviderFactory');

// Mock toolService so runReviewWithContext temp-file check doesn't hit the real FS/shell
vi.mock('../../services/toolService', () => ({
  toolService: {
    executeTool: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
    setToolService: vi.fn()
  }
}));

// Mock fs to avoid actual file operations
vi.mock('fs/promises', () => ({
  default: {
    unlink: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('WaterfallService Integration (Mocked AI)', () => {
  let service: WaterfallService;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WaterfallService();

    // Create a mock provider that handles JSON responses
    mockProvider = {
      generateChatCompletion: vi.fn().mockImplementation(async (messages, options) => {
        // Route based on the new context-aware prompt content
        const content = messages[0].content || "";

        if (content.includes("AI Systems Lead") || content.includes("Step 1 of a 4-step")) {
            // Architect Step (runArchitectWithContext)
            return JSON.stringify({
                logic: "Step 1: Write code.",
                assumptions: ["User wants JS"],
                keyDecisions: ["Use simple approach"],
                complexity: "low",
                techStack: ["JavaScript"]
            });
        }

        if (content.includes("Technical Architect") || content.includes("ARCHITECT'S DECISIONS")) {
            // Reasoner Step (runReasonerWithContext)
            return JSON.stringify({
                plan: "Detailed plan to write code.",
                steps: [{ title: "Coding", description: "Write the file." }],
                carriedDecisions: ["Use simple approach"],
                openQuestions: []
            });
        }

        if (content.includes("Senior Developer") || content.includes("FULL EXECUTION PLAN")) {
            // Executor Step (runExecutorWithContext)
            return JSON.stringify({
                code: "console.log('Hello Integration');",
                explanation: "Simple log.",
                files: ["hello.js"],
                decisionsOverridden: []
            });
        }

        if (content.includes("Principal Engineer") || content.includes("RUBRIC (100 pts")) {
            // Reviewer Step (runReviewWithContext)
            return JSON.stringify({
                score: 95,
                breakdown: { compliance: 38, security: 20, efficiency: 20, syntax: 17 },
                issues: [],
                decisionsHonored: ["Use simple approach"],
                summary: "Looks good.",
                compilationStatus: "Not tested"
            });
        }

        return "{}";
      })
    };

    // Make the factory return our mock
    (AIProviderFactory.getProvider as any).mockReturnValue(mockProvider);
  });

  it('should run a full successful waterfall pipeline', async () => {
    const result = await service.runAgenticWaterfall("Build a hello world app");

    // Verify Structure
    expect(result).toBeDefined();
    expect(result.architect).toBeDefined();
    expect(result.executor).toBeDefined();
    expect(result.reviewer).toBeDefined();

    // Verify Content
    expect(result.architect.complexity).toBe('low');
    expect(result.executor.code).toContain('Hello Integration');
    expect(result.reviewer.score).toBe(95);

    // Verify interactions
    expect(mockProvider.generateChatCompletion).toHaveBeenCalledTimes(4); // Arch, Reason, Exec, Review
  });

  it('should retry when review score is low', async () => {
    // Override mock to fail the first review
    let reviewCount = 0;
    mockProvider.generateChatCompletion = vi.fn().mockImplementation(async (messages) => {
        const content = messages[0].content || "";
        if (content.includes("Principal Engineer") || content.includes("RUBRIC (100 pts")) {
            reviewCount++;
            if (reviewCount === 1) {
                return JSON.stringify({ score: 50, issues: ["Too simple"], breakdown: {} });
            } else {
                return JSON.stringify({ score: 90, issues: [], breakdown: {} });
            }
        }
        // Return valid defaults for others
        if (content.includes("AI Systems Lead") || content.includes("Step 1 of a 4-step"))
            return JSON.stringify({ logic: "logic", complexity: "low", assumptions: [], keyDecisions: [], techStack: [] });
        if (content.includes("Technical Architect") || content.includes("ARCHITECT'S DECISIONS"))
            return JSON.stringify({ plan: "plan", steps: [], carriedDecisions: [], openQuestions: [] });
        if (content.includes("Senior Developer") || content.includes("FULL EXECUTION PLAN"))
            return JSON.stringify({ code: "console.log('Retry');", files: [], decisionsOverridden: [] });
        return "{}";
    });

    const result = await service.runAgenticWaterfall("Build app", 'auto', 2);

    expect(result.attempts).toBe(2);
    expect(result.history).toBeDefined();
    expect(result.history?.length).toBe(2);
    expect(result.reviewer.score).toBe(90);
  });
});
