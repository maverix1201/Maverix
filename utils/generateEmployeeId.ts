import Counter from '@/models/Counter';

/**
 * Global employee ID generator.
 *
 * - Uses a single global sequence (NOT year-wise).
 * - Format when joiningYear is present: YYYYEMP-001, YYYYEMP-002, ...
 * - The numeric sequence is global across all years.
 */
export async function generateEmployeeId(joiningYear: number): Promise<string> {
  if (!joiningYear || Number.isNaN(joiningYear)) {
    throw new Error('joiningYear is required to generate employee ID');
  }

  const counter = await Counter.findByIdAndUpdate(
    'employeeId',
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).lean();

  const seq = counter?.seq ?? 1;
  const padded = String(seq).padStart(3, '0');
  const empId = `${joiningYear}EMP-${padded}`;

  return empId;
}

export function extractEmployeeIdSequence(empId?: string | null): number | null {
  if (!empId || typeof empId !== 'string') return null;
  const match = empId.match(/(\d+)\s*$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Checks if an employee needs an employee ID generated
 * @param userId - The user's ID
 * @param joiningYear - The joining year
 * @returns Promise<boolean> - True if empId should be generated
 */
export async function shouldGenerateEmployeeId(userId: string, joiningYear: number | null | undefined): Promise<boolean> {
  if (!joiningYear) {
    return false;
  }

  try {
    const User = (await import('@/models/User')).default;
    const user = await User.findById(userId).select('empId').lean();
    
    // Generate if user doesn't have an empId yet
    if (!user?.empId) {
      return true;
    }

    // If empId exists, do not generate a new global sequence here.
    // (Prefix updates for year changes should keep the existing sequence number.)
    return false;
  } catch (error) {
    console.error('[shouldGenerateEmployeeId] Error checking if empId should be generated:', error);
    return false;
  }
}
