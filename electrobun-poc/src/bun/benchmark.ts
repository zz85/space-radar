/**
 * Benchmark: Bun vs Node.js Disk Scanning Performance
 * 
 * This script benchmarks the disk scanner to compare performance
 * between Bun and Node.js runtimes.
 */

import { DiskScanner } from './scanner';

async function benchmark(targetPath: string) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Space Radar POC - Performance Benchmark            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Runtime: Bun ${Bun.version}`);
  console.log(`Target: ${targetPath}\n`);

  // Run 3 iterations
  const iterations = 3;
  const times: number[] = [];
  const speeds: number[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`─────────────────────────────────────────────────────────`);
    console.log(`Iteration ${i + 1}/${iterations}`);
    console.log(`─────────────────────────────────────────────────────────`);

    const scanner = new DiskScanner({
      skipHidden: false,
    });

    const startTime = performance.now();
    const result = await scanner.scan(targetPath);
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    const stats = scanner.getStats();
    const filesPerSec = stats.fileCount / duration;

    times.push(duration);
    speeds.push(filesPerSec);

    console.log(`\nResults:`);
    console.log(`  Files: ${stats.fileCount.toLocaleString()}`);
    console.log(`  Directories: ${stats.dirCount.toLocaleString()}`);
    console.log(`  Total Size: ${formatBytes(stats.totalSize)}`);
    console.log(`  Time: ${duration.toFixed(3)}s`);
    console.log(`  Speed: ${Math.round(filesPerSec).toLocaleString()} files/sec`);
    console.log(`  Errors: ${stats.errorCount}\n`);

    // Small delay between iterations
    if (i < iterations - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Calculate statistics
  console.log('═════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═════════════════════════════════════════════════════════');
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const minSpeed = Math.min(...speeds);
  const maxSpeed = Math.max(...speeds);

  console.log(`\nScan Time:`);
  console.log(`  Average: ${avgTime.toFixed(3)}s`);
  console.log(`  Min: ${minTime.toFixed(3)}s`);
  console.log(`  Max: ${maxTime.toFixed(3)}s`);
  
  console.log(`\nScan Speed:`);
  console.log(`  Average: ${Math.round(avgSpeed).toLocaleString()} files/sec`);
  console.log(`  Min: ${Math.round(minSpeed).toLocaleString()} files/sec`);
  console.log(`  Max: ${Math.round(maxSpeed).toLocaleString()} files/sec`);

  console.log('\n═════════════════════════════════════════════════════════\n');

  // Compare with Node.js (if available)
  console.log('📝 To compare with Node.js, run:');
  console.log('   node benchmark-node.js <path>\n');
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

// CLI entry point
if (import.meta.main) {
  const targetPath = process.argv[2];
  
  if (!targetPath) {
    console.error('Usage: bun run benchmark.ts <path>');
    console.error('Example: bun run benchmark.ts /tmp');
    process.exit(1);
  }

  try {
    await benchmark(targetPath);
  } catch (error: any) {
    console.error('Benchmark failed:', error.message);
    process.exit(1);
  }
}
