import { db } from './db';
import * as schema from './schema';

export async function initializeAndSeedDatabase() {
  try {
    console.log('[Seeder] Checking if database needs seeding...');

    // Check if actor_events is empty
    const result = await db.select().from(schema.actorEvents).limit(1);

    if (result.length === 0) {
      console.log('[Seeder] Database is empty! Generating synthetic population...');

      const eventTypes = [
        'login',
        'click',
        'scroll',
        'type',
        'logout',
        'purchase',
        'authenticate',
        'verify',
      ];
      const commandNames = ['Init', 'Update', 'Submit'];
      const statuses = ['pending', 'processing', 'applied', 'rejected'] as const;

      const events: schema.NewActorEventRecord[] = [];
      const commands: schema.NewActorCommandRecord[] = [];

      for (let i = 0; i < 100; i++) {
        const commandId = `cmd_${i}_${Date.now()}`;
        const actorRef = `actor_${i}`;

        commands.push({
          id: commandId,
          actorRef: JSON.stringify({ id: actorRef }),
          command: commandNames[i % commandNames.length] as string,
          principal: JSON.stringify({ id: `user_${i}` }),
          payload: JSON.stringify({ simulated: true }),
          idempotencyKey: `idem_${i}_${Date.now()}`,
          status: statuses[i % statuses.length],
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000000)),
        });

        events.push({
          id: `evt_${i}_${Date.now()}`,
          commandId: commandId,
          actorRef: JSON.stringify({ id: actorRef }),
          type: eventTypes[i % eventTypes.length] as string,
          payload: JSON.stringify({ simulated: true, x: i * 10, y: i * 20 }),
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000000)),
        });
      }

      // Insert in batches or all at once since it's just 100 records
      await db.insert(schema.actorCommands).values(commands);
      await db.insert(schema.actorEvents).values(events);

      console.log('[Seeder] Successfully seeded database with realistic mock data.');
    } else {
      console.log('[Seeder] Database already contains data. Skipping seed.');
    }
  } catch (error) {
    console.error('[Seeder] Failed to seed database:', error);
  }
}
