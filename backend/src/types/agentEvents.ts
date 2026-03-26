/**
 * Discriminated union for Agent SSE events.
 * Each event type carries a specific payload shape.
 */

export interface ToolStartEvent {
  type: 'tool_start';
  tool: string;
  args: Record<string, unknown>;
  iteration: number;
  callId: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: unknown;
  iteration: number;
  callId: string;
}

export interface ToolErrorEvent {
  type: 'tool_error';
  tool: string;
  error: string;
  iteration: number;
  callId: string;
}

export interface TextCompleteEvent {
  type: 'text_complete';
  content: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type AgentEvent =
  | ToolStartEvent
  | ToolResultEvent
  | ToolErrorEvent
  | TextCompleteEvent
  | DoneEvent
  | ErrorEvent;
