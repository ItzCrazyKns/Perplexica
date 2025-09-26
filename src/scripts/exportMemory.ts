#!/usr/bin/env tsx

import { db } from '../lib/db';
import { userMemories, memoryStats, memorySettings } from '../lib/db/schema';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function exportMemory(userId?: string) {
  try {
    console.log('Exporting memory data...');

    // Export user memories
    const memories = await db.select().from(userMemories);
    console.log(`Found ${memories.length} memories`);

    // Export memory stats
    const stats = await db.select().from(memoryStats);
    console.log(`Found ${stats.length} memory stat records`);

    // Export memory settings
    const settings = await db.select().from(memorySettings);
    console.log(`Found ${settings.length} memory setting records`);

    // Filter by user ID if provided
    const filteredData = userId ? {
      memories: memories.filter(m => m.userId === userId),
      stats: stats.filter(s => s.userId === userId),
      settings: settings.filter(s => s.userId === userId),
    } : {
      memories,
      stats,
      settings,
    };

    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId || 'all',
      data: filteredData,
    };

    // Write to file
    const filename = userId ? `memory-export-${userId}.json` : 'memory-export-all.json';
    const filepath = join(process.cwd(), filename);

    writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    console.log(`✓ Memory data exported to ${filename}`);
  } catch (error) {
    console.error('Failed to export memory data:', error);
    process.exit(1);
  }
}

// Get user ID from command line argument
const userId = process.argv[2];

exportMemory(userId);