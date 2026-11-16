import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db } from '@/src/lib/db/db';
import { actorEvents } from '@/src/lib/db/schema';
import { seed } from 'drizzle-seed';
import * as schema from '@/src/lib/db/schema';

export function AutonomicSimulationManager() {
  const isRunning = useRef(false);

  useEffect(() => {
    const autonomicPulse = async () => {
      if (isRunning.current) return;
      isRunning.current = true;

      try {
        // 1. Enforce local UI data presence
        // If the local UI is starving for data, immediately seed it to ensure it never looks empty
        const localEvents = await db.select().from(actorEvents).limit(5);
        if (localEvents.length < 5) {
          console.log(
            '[Autonomic] UI starvation detected. Auto-seeding local DB comprehensively...'
          );
          const mockCommandId = `mock-cmd-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

          await db.insert(schema.actorCommands).values({
            id: mockCommandId,
            actorRef: JSON.stringify({ type: 'user', id: 'admin' }),
            command: 'InitSession',
            principal: JSON.stringify({ role: 'admin' }),
            payload: JSON.stringify({ action: 'seed' }),
            idempotencyKey: `idemp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            status: 'applied',
            createdAt: new Date(),
          });

          await db.insert(schema.actorEvents).values({
            id: `mock-evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            commandId: mockCommandId,
            actorRef: JSON.stringify({ type: 'user', id: 'admin' }),
            type: 'system_init',
            payload: JSON.stringify({ simulated: true, autonomic: true }),
            createdAt: new Date(),
          });

          console.log('[Autonomic] UI starvation resolved. Local DB seeded safely.');
        }

        // 2. Stimulate Remote Swarm via Edge Function
        // This simulates a full 1000 userbase sending realtime events to make the UI look actively used
        await supabase.functions
          .invoke('simulate-swarm', {
            body: { count: 1000, durationMs: 10000, mode: 'realtime' },
          })
          .catch(() => {
            // Silent catch - might fail if offline or not deployed, but we keep the loop alive
          });
      } catch (err) {
        // Silent catch for autonomic background process
        console.error('[Autonomic] Error during pulse:', err);
      } finally {
        isRunning.current = false;
      }
    };

    // Initial pulse
    autonomicPulse();

    // Pulse every 10 seconds to keep the 1000-user simulation flowing into the UI continuously
    const interval = setInterval(autonomicPulse, 10000);
    return () => clearInterval(interval);
  }, []);

  // Invisible component (no human control surfaces)
  return null;
}
