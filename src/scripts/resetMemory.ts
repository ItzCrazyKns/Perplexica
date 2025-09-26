#!/usr/bin/env tsx

import { db } from '../lib/db';
import { userMemories, memoryStats, memorySettings } from '../lib/db/schema';

async function resetMemory() {
  try {
    console.log('Resetting memory database...');

    // Delete all user memories
    await db.delete(userMemories);
    console.log('✓ Deleted all user memories');

    // Delete all memory stats
    await db.delete(memoryStats);
    console.log('✓ Deleted all memory stats');

    // Delete all memory settings
    await db.delete(memorySettings);
    console.log('✓ Deleted all memory settings');

    console.log('Memory database reset complete!');
  } catch (error) {
    console.error('Failed to reset memory database:', error);
    process.exit(1);
  }
}

resetMemory();