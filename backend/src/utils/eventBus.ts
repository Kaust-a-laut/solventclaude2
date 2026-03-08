import { EventEmitter } from 'events';

/**
 * Shared application event bus.
 *
 * Used to break circular dependencies between services that need to
 * communicate without holding direct references to each other.
 *
 * Current event contracts:
 *   'supervisor:increment-tool-budget'  — emitted by ToolService when a tool
 *     is executed on behalf of the Overseer (fromOverseer=true). SupervisorService
 *     listens and calls incrementToolBudget() to enforce the per-cycle cap.
 *
 *   'supervisor:emit-event' — emitted by ToolService to broadcast Socket.io
 *     events through the Supervisor without a direct service reference.
 *     Payload: { event: string; data: unknown }
 */
export const appEventBus = new EventEmitter();
