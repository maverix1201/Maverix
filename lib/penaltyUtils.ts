import connectDB from './mongodb';
import Penalty from '@/models/Penalty';
import Attendance from '@/models/Attendance';
import Settings from '@/models/Settings';
import User from '@/models/User';
import Leave from '@/models/Leave';
import LeaveType from '@/models/LeaveType';
import mongoose from 'mongoose';

/**
 * Reusable helpers for penalty leave deduction.
 * Keep these centralized so the penalty rules stay consistent everywhere.
 */
export function getPenaltyLeaveDeductionDays(): number {
  // Current rule: deduct 0.5 day (casual leave) when max late days is exceeded.
  return 0.5;
}

export async function getPenaltyDeductionLeaveType(options?: {
  createIfMissing?: boolean;
}): Promise<any | null> {
  const createIfMissing = Boolean(options?.createIfMissing);

  // Current rule: deduct from "Casual Leave" (case-insensitive exact match).
  let casualLeaveType = await LeaveType.findOne({
    name: { $regex: /^casual\s*leave$/i },
  });

  if (!casualLeaveType && createIfMissing) {
    casualLeaveType = new LeaveType({
      name: 'Casual Leave',
      description: 'Casual leave for employees',
      isActive: true,
    });
    await casualLeaveType.save();
    console.log('[Penalty Utils] Created Casual Leave type');
  }

  return casualLeaveType;
}

/**
 * Checks all conditions and creates a penalty if late clock-ins exceed max days
 * @param userId - User ID
 * @param clockInTime - Clock-in time as Date object
 * @returns Object with shouldCreatePenalty flag and details
 */
export async function checkAndCreatePenalty(
  userId: string,
  clockInTime: Date
): Promise<{
  shouldCreatePenalty: boolean;
  message: string;
  penaltyId?: string;
  lateArrivalCount?: number;
  maxLateDays?: number;
}> {
  try {
    await connectDB();

    // Get user to check their custom clock-in time
    const user = await User.findById(userId);
    if (!user) {
      return {
        shouldCreatePenalty: false,
        message: 'User not found',
      };
    }

    // Skip check if user has "N/R" (no restrictions)
    if (user.clockInTime && user.clockInTime === 'N/R') {
      return {
        shouldCreatePenalty: false,
        message: 'User has no clock-in time restrictions',
      };
    }

    // Get time limit (user's custom or default)
    let timeLimit = '';
    if (user.clockInTime && user.clockInTime !== 'N/R') {
      timeLimit = user.clockInTime;
    } else {
      const defaultTimeSetting = await Settings.findOne({ key: 'defaultClockInTimeLimit' });
      timeLimit = defaultTimeSetting?.value || '';
    }

    if (!timeLimit) {
      return {
        shouldCreatePenalty: false,
        message: 'No time limit configured for user',
      };
    }

    // Parse time limit (HH:mm format)
    const [limitHours, limitMinutes] = timeLimit.split(':').map(Number);
    if (isNaN(limitHours) || isNaN(limitMinutes)) {
      return {
        shouldCreatePenalty: false,
        message: 'Invalid time limit format',
      };
    }

    const clockInHours = clockInTime.getHours();
    const clockInMinutes = clockInTime.getMinutes();
    const clockInTotalMinutes = clockInHours * 60 + clockInMinutes;
    const limitTotalMinutes = limitHours * 60 + limitMinutes;

    // Check if user clocked in after the time limit (late arrival)
    if (clockInTotalMinutes <= limitTotalMinutes) {
      return {
        shouldCreatePenalty: false,
        message: 'User clocked in on time or before limit',
      };
    }

    const clockInTimeStr = `${String(clockInHours).padStart(2, '0')}:${String(clockInMinutes).padStart(2, '0')}`;
    console.log(`[Penalty Utils] User ${userId} clocked in at ${clockInTimeStr} (after limit ${timeLimit})`);

    // Get max late days from settings
    const maxLateDaysSetting = await Settings.findOne({ key: 'maxLateDays' });
    const maxLateDays = maxLateDaysSetting?.value !== undefined ? maxLateDaysSetting.value : 0;

    // Count late arrivals for this user in the current month
    const startOfMonth = new Date(clockInTime.getFullYear(), clockInTime.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Find all attendance records for this month
    const attendanceRecords = await Attendance.find({
      userId: new mongoose.Types.ObjectId(userId),
      clockIn: { $gte: startOfMonth },
    }).lean();

    // Count unique late arrival days (including today)
    const lateArrivalDays = new Set<string>();
    const todayStr = clockInTime.toISOString().split('T')[0];
    lateArrivalDays.add(todayStr); // Add today's late arrival

    for (const record of attendanceRecords) {
      if (record.clockIn) {
        const recordDate = new Date(record.clockIn);
        const recordHours = recordDate.getHours();
        const recordMinutes = recordDate.getMinutes();
        const recordTotalMinutes = recordHours * 60 + recordMinutes;
        
        // Check if this record was a late arrival (using the same time limit)
        if (recordTotalMinutes > limitTotalMinutes) {
          const dateStr = recordDate.toISOString().split('T')[0];
          lateArrivalDays.add(dateStr);
        }
      }
    }

    const lateArrivalCount = lateArrivalDays.size;
    console.log(`[Penalty Utils] User ${userId} has ${lateArrivalCount} late arrival days this month (max allowed: ${maxLateDays})`);

    // Check if penalty should be created
    // If maxLateDays is 0, create penalty immediately (no grace period)
    // If maxLateDays is 20, user gets 20 free late arrivals, then on the 21st one (count > max), create penalty
    // IMPORTANT: Only create penalty if lateArrivalCount STRICTLY exceeds maxLateDays
    // If maxLateDays is 20 and lateArrivalCount is 20, that's still within limit (no penalty)
    // Penalty is only created when lateArrivalCount > maxLateDays (e.g., 21 > 20)
    const shouldCreatePenalty = maxLateDays === 0 ? lateArrivalCount > 0 : lateArrivalCount > maxLateDays;

    if (!shouldCreatePenalty) {
      console.log(`[Penalty Utils] No penalty needed: ${lateArrivalCount} late arrivals is within limit of ${maxLateDays}`);
      return {
        shouldCreatePenalty: false,
        message: `User has ${lateArrivalCount} late arrivals (within limit of ${maxLateDays})`,
        lateArrivalCount,
        maxLateDays,
      };
    }

    console.log(`[Penalty Utils] Penalty condition met: ${lateArrivalCount} late arrivals exceeds max of ${maxLateDays}`);

    // Check if penalty or leave deduction already exists for today
    // This prevents multiple penalties/deductions for multiple clock-ins on the same day
    const todayDate = new Date(clockInTime);
    todayDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check for existing penalty for today
    const existingPenalty = await Penalty.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      $or: [
        { date: { $gte: todayDate, $lt: tomorrow } },
        { lateArrivalDate: { $gte: todayDate, $lt: tomorrow } },
      ],
    });

    if (existingPenalty) {
      console.log(`[Penalty Utils] Penalty already exists for today - User ${userId}`);
      return {
        shouldCreatePenalty: false,
        message: 'Penalty already exists for today',
        penaltyId: String(existingPenalty._id),
      };
    }

    // Also check for existing leave deduction for today (double-check to prevent race conditions)
    try {
      const casualLeaveType = await getPenaltyDeductionLeaveType({ createIfMissing: false });

      if (casualLeaveType) {
        const existingDeduction = await Leave.findOne({
          userId: new mongoose.Types.ObjectId(userId),
          leaveType: casualLeaveType._id,
          startDate: { $gte: todayDate, $lt: tomorrow },
          status: 'approved',
          reason: { $regex: /penalty|late.*clock.*in|exceeded.*max.*late/i },
        });

        if (existingDeduction) {
          console.log(`[Penalty Utils] Leave deduction already exists for today - User ${userId}`);
          return {
            shouldCreatePenalty: false,
            message: 'Penalty leave deduction already exists for today',
          };
        }
      }
    } catch (checkError: any) {
      console.error('[Penalty Utils] Error checking existing deduction:', checkError);
      // Continue with penalty creation if check fails
    }

    // All checks passed - create penalty
    const penalty = new Penalty({
      userId: new mongoose.Types.ObjectId(userId),
      date: new Date(), // Date when penalty was applied
      lateArrivalDate: clockInTime, // The specific date when user was late
      clockInTime: clockInTimeStr,
      timeLimit: timeLimit,
      maxLateDays: maxLateDays,
      lateArrivalCount: lateArrivalCount,
      penaltyAmount: getPenaltyLeaveDeductionDays(),
      reason: `Late clock-in (${clockInTimeStr}) after time limit (${timeLimit}) - Exceeded max late days (${lateArrivalCount}/${maxLateDays})`,
    });

    await penalty.save();
    console.log(`[Penalty Utils] Created penalty for user ${userId} - Late arrivals: ${lateArrivalCount}, Max allowed: ${maxLateDays}`);

    // Deduct 0.5 casual leave when penalty is created
    try {
      // Find or create the penalty leave type
      const casualLeaveType = await getPenaltyDeductionLeaveType({ createIfMissing: true });
      if (!casualLeaveType) {
        throw new Error('Penalty leave type not found and could not be created');
      }

      // Check if leave has already been deducted for today (double-check to prevent duplicates)
      // This is important because multiple clock-ins on the same day should only deduct 0.5 days total
      const existingDeduction = await Leave.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        leaveType: casualLeaveType._id,
        startDate: { $gte: todayDate, $lt: tomorrow },
        endDate: { $gte: todayDate, $lt: tomorrow },
        status: 'approved',
        reason: { $regex: /penalty|late.*clock.*in|exceeded.*max.*late/i },
      });

      if (existingDeduction) {
        console.log(`[Penalty Utils] Leave deduction already exists for today - skipping deduction. User ${userId}`);
        // Penalty was created but leave already deducted, so just return success
        return {
          shouldCreatePenalty: true,
          message: 'Penalty created but leave already deducted for today',
          penaltyId: String(penalty._id),
          lateArrivalCount,
          maxLateDays,
        };
      }

      // No existing deduction, proceed with creating one
      // Get or create allotted casual leave for the user
      let allottedLeave = await Leave.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        leaveType: casualLeaveType._id,
        allottedBy: { $exists: true, $ne: null },
      });

      if (!allottedLeave) {
        allottedLeave = new Leave({
          userId: new mongoose.Types.ObjectId(userId),
          leaveType: casualLeaveType._id,
          days: 0,
          remainingDays: 0,
          startDate: todayDate,
          endDate: todayDate,
          reason: 'Auto-allotted for penalty deductions',
          status: 'approved',
          allottedBy: new mongoose.Types.ObjectId(userId),
        });
        await allottedLeave.save();
      }

      // Create leave deduction record
      const leaveDeduction = new Leave({
        userId: new mongoose.Types.ObjectId(userId),
        leaveType: casualLeaveType._id,
        days: getPenaltyLeaveDeductionDays(),
        startDate: todayDate,
        endDate: todayDate,
        reason: `Penalty: Late clock-in exceeded max days (${lateArrivalCount}/${maxLateDays})`,
        status: 'approved',
        approvedBy: new mongoose.Types.ObjectId(userId),
        approvedAt: new Date(),
      });

      await leaveDeduction.save();
      console.log(
        `[Penalty Utils] Deducted ${getPenaltyLeaveDeductionDays()} casual leave for penalty - User ${userId}`
      );

      // Update the allotted leave's remainingDays
      if (allottedLeave) {
        // Recalculate remaining days including the new penalty deduction
        const allApprovedRequests = await Leave.find({
          userId: new mongoose.Types.ObjectId(userId),
          leaveType: casualLeaveType._id,
          status: 'approved',
          allottedBy: { $exists: false },
        }).lean();

        const totalUsed = allApprovedRequests.reduce((sum: number, req: any) => sum + (req.days || 0), 0);
        allottedLeave.remainingDays = Math.max(0, (allottedLeave.days || 0) - totalUsed);
        await allottedLeave.save();
        console.log(`[Penalty Utils] Updated allotted leave remainingDays to ${allottedLeave.remainingDays} - User ${userId}`);
      }
    } catch (leaveError: any) {
      console.error('[Penalty Utils] Error deducting leave for penalty:', leaveError);
      // Don't fail penalty creation if leave deduction fails
    }

    return {
      shouldCreatePenalty: true,
      message: 'Penalty created successfully',
      penaltyId: String(penalty._id),
      lateArrivalCount,
      maxLateDays,
    };
  } catch (error: any) {
    console.error('[Penalty Utils] Error in checkAndCreatePenalty:', error);
    throw error;
  }
}

