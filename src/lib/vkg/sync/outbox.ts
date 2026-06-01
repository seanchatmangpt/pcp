import { GraphDelta } from '../hooks/engine.js';
import { VkgHook, HookReceipt } from '../hooks/types.js';
import { FrameworkOutboxManager } from '../../../framework/sync';

export class OutboxManager extends FrameworkOutboxManager<GraphDelta, VkgHook> {
  // Extending FrameworkOutboxManager without changing behavior ensures backwards compatibility.
}
