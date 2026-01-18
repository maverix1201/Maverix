import mongoose from 'mongoose';
import User from '../models/User';
import { generateEmployeeId } from '../utils/generateEmployeeId';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function fixEmployeeIds() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Find the specific user
    const user = await User.findOne({ email: 'chandrakant@mavericksmedia.org' });
    
    if (!user) {
      console.log('✗ User not found');
      await mongoose.disconnect();
      return;
    }

    console.log('\n=== Current User Data ===');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Joining Year:', user.joiningYear);
    console.log('Employee ID:', user.empId);
    console.log('========================\n');

    // If joiningYear exists but empId doesn't, generate it
    if (user.joiningYear && !user.empId) {
      console.log('Generating Employee ID...');
      const empId = await generateEmployeeId(user.joiningYear);
      user.empId = empId;
      await user.save();
      console.log('✓ Generated and saved Employee ID:', empId);
    } else if (!user.joiningYear) {
      console.log('✗ No joining year set for this user');
    } else {
      console.log('✓ Employee ID already exists:', user.empId);
    }

    // Check all users with joiningYear but no empId
    const usersNeedingEmpId = await User.find({
      joiningYear: { $exists: true, $ne: null },
      empId: { $exists: false }
    });

    console.log(`\nFound ${usersNeedingEmpId.length} users with joining year but no empId`);

    for (const u of usersNeedingEmpId) {
      const empId = await generateEmployeeId(u.joiningYear!);
      u.empId = empId;
      await u.save();
      console.log(`✓ Generated empId ${empId} for ${u.name}`);
    }

    // Show all users with joiningYear
    const allUsersWithYear = await User.find({ joiningYear: { $exists: true, $ne: null } })
      .select('name email joiningYear empId')
      .sort({ joiningYear: 1, empId: 1 });

    console.log(`\n=== All Users with Joining Year (${allUsersWithYear.length}) ===`);
    allUsersWithYear.forEach(u => {
      console.log(`${u.name}: Year=${u.joiningYear}, EmpID=${u.empId || 'NOT SET'}`);
    });
    console.log('=====================================\n');

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

fixEmployeeIds();
