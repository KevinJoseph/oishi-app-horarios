import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectToDatabase } from '../config/db.js';
import { EmployeeModel } from '../models/Employee.js';

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase(env.mongoUri);

  const cursor = EmployeeModel.find({
    'data.identityDocument': { $exists: true, $ne: '' }
  }).cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const data = (doc.data ?? {}) as Record<string, unknown>;
    const dni = typeof data.identityDocument === 'string' ? data.identityDocument.trim() : '';
    if (!dni) {
      skipped += 1;
      continue;
    }
    const nextEmail = `${dni}@almoud.pe`;
    if (data.email === nextEmail) {
      skipped += 1;
      continue;
    }

    console.log(`${doc._id}: ${String(data.email ?? '')} -> ${nextEmail}`);

    if (!dryRun) {
      await EmployeeModel.updateOne(
        { _id: doc._id },
        { $set: { 'data.email': nextEmail } }
      );
    }
    updated += 1;
  }

  console.log(`\nScanned: ${scanned} | ${dryRun ? 'Would update' : 'Updated'}: ${updated} | Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
