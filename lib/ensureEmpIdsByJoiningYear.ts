import User from '@/models/User';
import Counter from '@/models/Counter';

function makeEmpId(joiningYear: number, seq: number) {
  return `${joiningYear}EMP-${String(seq).padStart(3, '0')}`;
}

let lastRunAtMs = 0;
let lastResult:
  | { changed: boolean; totalWithJoiningYear: number; updated?: number }
  | null = null;
let inFlight: Promise<{ changed: boolean; totalWithJoiningYear: number; updated?: number }> | null =
  null;

function getStableJoinYearTime(user: any): Date {
  // For older records that don't have joiningYearUpdatedAt yet, we approximate using updatedAt,
  // since joiningYear was typically added via an update (profile/admin edit).
  // Once set, we rely only on joiningYearUpdatedAt to keep ordering stable forever.
  const t = user.joiningYearUpdatedAt || user.updatedAt || user.createdAt;
  return t ? new Date(t) : new Date(0);
}

/**
 * Ensures employee IDs are assigned like:
 * - Only users with joiningYear get an empId
 * - Format: YYYYEMP-###
 * - The numeric part is a single GLOBAL sequence (not year-wise)
 * - Existing users are re-numbered by "time of adding joining year"
 *   (joiningYearUpdatedAt -> updatedAt -> createdAt)
 *
 * Assumes DB connection already exists.
 */
export async function ensureEmpIdsByJoiningYear(): Promise<{
  changed: boolean;
  totalWithJoiningYear: number;
  updated?: number;
}> {
  // This routine is intentionally expensive (multiple queries + bulk writes).
  // Calling it on every /api/users request can significantly slow page loads.
  // We throttle runs in-process; correctness is preserved because IDs only need
  // to converge, and changes to joiningYear are relatively infrequent.
  const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();

  if (inFlight) return inFlight;
  if (lastResult && now - lastRunAtMs < MIN_INTERVAL_MS) return lastResult;

  inFlight = (async () => {
  // If joiningYear was removed for a user, they must not keep an empId.
  // (Also clear joiningYearUpdatedAt so future re-add sets a fresh timestamp.)
  await User.updateMany(
    {
      role: { $ne: 'admin' },
      $or: [
        { joiningYear: { $exists: false } },
        { joiningYear: null },
        // Guard against bad legacy data types/values (e.g., "" or 0) so empId doesn't remain visible
        { joiningYear: '' as any },
        { joiningYear: { $type: 'string' } as any },
        { joiningYear: { $lt: 1900 } as any },
        { joiningYear: { $gt: 2100 } as any },
      ],
      empId: { $exists: true },
    },
    { $unset: { empId: '', joiningYearUpdatedAt: '' } }
  );

  const users = await User.find({
    role: { $ne: 'admin' },
    joiningYear: { $exists: true, $ne: null, $type: 'number', $gte: 1900, $lte: 2100 } as any,
  })
    .select('_id joiningYear joiningYearUpdatedAt empId updatedAt createdAt')
    .lean();

  const totalWithJoiningYear = users.length;
  if (totalWithJoiningYear === 0) return { changed: false, totalWithJoiningYear };

  // Backfill joiningYearUpdatedAt ONCE for older records to prevent future re-ordering
  // (otherwise updatedAt changes could reshuffle IDs).
  const backfillOps = (users as any[])
    .filter((u) => !u.joiningYearUpdatedAt)
    .map((u) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { joiningYearUpdatedAt: getStableJoinYearTime(u) } },
      },
    }));

  if (backfillOps.length > 0) {
    await User.bulkWrite(backfillOps as any, { ordered: false });
  }

  // Re-fetch after backfill so ordering is stable and based on joiningYearUpdatedAt
  const normalizedUsers = await User.find({
    role: { $ne: 'admin' },
    joiningYear: { $exists: true, $ne: null, $type: 'number', $gte: 1900, $lte: 2100 } as any,
  })
    .select('_id joiningYear joiningYearUpdatedAt empId createdAt')
    .lean();

  const sorted = [...(normalizedUsers as any[])].sort((a, b) => {
    const aTime = new Date(a.joiningYearUpdatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.joiningYearUpdatedAt || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a._id).localeCompare(String(b._id));
  });

  let needsFix = false;
  const expectedById = new Map<string, string>();
  sorted.forEach((u, idx) => {
    const seq = idx + 1;
    const expected = makeEmpId(Number(u.joiningYear), seq);
    expectedById.set(String(u._id), expected);
    if (u.empId !== expected) needsFix = true;
  });

  if (!needsFix) return { changed: false, totalWithJoiningYear };

  // IMPORTANT:
  // Because empId is unique, directly updating in ordered mode can fail with duplicate-key
  // when swapping values (e.g., user A currently has B's future empId). Do a 2-phase update:
  // 1) $unset empId for all affected users (sparse unique allows many "missing" fields)
  // 2) set the final expected empIds
  await User.updateMany(
    { _id: { $in: sorted.map((u) => u._id) } },
    { $unset: { empId: '' } }
  );

  const ops = sorted.map((u) => {
    const expected = expectedById.get(String(u._id))!;
    return {
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { empId: expected } },
      },
    };
  });

  const bulkRes = await User.bulkWrite(ops as any, { ordered: false });

  // Keep the global counter aligned so next generated ID continues from the last assigned sequence.
  const counterDoc = await Counter.findById('employeeId').select('seq').lean();
  const currentSeq = (counterDoc as any)?.seq ?? 0;
  await Counter.findByIdAndUpdate(
    'employeeId',
    { $set: { seq: Math.max(currentSeq, sorted.length) } },
    { upsert: true, new: true }
  );

    return { changed: true, totalWithJoiningYear, updated: bulkRes.modifiedCount };
  })();

  try {
    const res = await inFlight;
    lastRunAtMs = Date.now();
    lastResult = res;
    return res;
  } finally {
    inFlight = null;
  }
}

