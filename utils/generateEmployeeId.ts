import User from '@/models/User';

/**
 * Generates a unique employee ID based on joining year
 * Format: [JoiningYear]EMP[001]
 * Example: 2024EMP001, 2024EMP002, etc.
 * 
 * @param joiningYear - The year the employee joined
 * @returns Promise<string> - The generated employee ID
 */
export async function generateEmployeeId(joiningYear: number): Promise<string> {
  try {
    // Find all employees with the same joining year who have empId
    const employeesInYear = await User.find({
      joiningYear: joiningYear,
      empId: { $exists: true, $ne: null }
    }).select('empId').sort({ empId: 1 }).lean();

    // Extract sequence numbers from existing employee IDs
    const sequenceNumbers: number[] = [];
    const prefix = `${joiningYear}EMP`;
    
    employeesInYear.forEach((emp: any) => {
      if (emp.empId && emp.empId.startsWith(prefix)) {
        // Handle both old format (2023EMP001) and new format (2023EMP-001)
        const seqStr = emp.empId.substring(prefix.length).replace('-', '');
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum)) {
          sequenceNumbers.push(seqNum);
        }
      }
    });

    // Find the next available sequence number
    let nextSequence = 1;
    if (sequenceNumbers.length > 0) {
      // Sort and find the highest number
      sequenceNumbers.sort((a, b) => a - b);
      nextSequence = sequenceNumbers[sequenceNumbers.length - 1] + 1;
    }

    // Format the sequence number with leading zeros (3 digits)
    const sequenceStr = nextSequence.toString().padStart(3, '0');
    
    // Generate the employee ID with hyphen (e.g., 2023EMP-001)
    const empId = `${prefix}-${sequenceStr}`;
    
    console.log(`[generateEmployeeId] Generated ID: ${empId} for year ${joiningYear}`);
    
    return empId;
  } catch (error) {
    console.error('[generateEmployeeId] Error generating employee ID:', error);
    throw error;
  }
}

/**
 * Checks if an employee needs an employee ID generated
 * @param userId - The user's ID
 * @param joiningYear - The joining year
 * @returns Promise<boolean> - True if empId should be generated
 */
export async function shouldGenerateEmployeeId(userId: string, joiningYear: number | null | undefined): Promise<boolean> {
  if (!joiningYear) {
    console.log('[shouldGenerateEmployeeId] No joining year provided, skipping');
    return false;
  }

  try {
    const user = await User.findById(userId).select('empId joiningYear').lean();
    
    console.log('[shouldGenerateEmployeeId] User data:', {
      userId,
      currentEmpId: user?.empId,
      currentJoiningYear: user?.joiningYear,
      newJoiningYear: joiningYear
    });
    
    // Generate if user doesn't have an empId yet
    if (!user?.empId) {
      console.log('[shouldGenerateEmployeeId] No empId exists, will generate');
      return true;
    }

    // Regenerate if joining year changed and empId doesn't match the new year
    const currentPrefix = `${joiningYear}EMP`;
    const empIdMatches = user.empId.startsWith(currentPrefix);
    
    console.log('[shouldGenerateEmployeeId] Checking prefix:', {
      expectedPrefix: currentPrefix,
      currentEmpId: user.empId,
      matches: empIdMatches
    });
    
    if (user.empId && !empIdMatches) {
      console.log('[shouldGenerateEmployeeId] EmpId prefix does not match new year, will regenerate');
      return true;
    }

    console.log('[shouldGenerateEmployeeId] EmpId is valid for current year, no regeneration needed');
    return false;
  } catch (error) {
    console.error('[shouldGenerateEmployeeId] Error checking if empId should be generated:', error);
    return false;
  }
}
