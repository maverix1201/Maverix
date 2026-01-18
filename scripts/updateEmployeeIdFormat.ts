import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function updateEmployeeIdFormat() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Find all users with empId in old format (without hyphen)
    const usersWithEmpId = await User.find({
      empId: { $exists: true, $ne: null }
    });

    console.log(`\nFound ${usersWithEmpId.length} users with employee IDs`);

    let updatedCount = 0;

    for (const user of usersWithEmpId) {
      const oldEmpId = user.empId;
      
      // Check if empId is in old format (no hyphen)
      // Old format: 2023EMP001
      // New format: 2023EMP-001
      if (oldEmpId && !oldEmpId.includes('-')) {
        // Extract year, EMP, and sequence number
        const match = oldEmpId.match(/^(\d{4})(EMP)(\d{3})$/);
        
        if (match) {
          const [, year, emp, sequence] = match;
          const newEmpId = `${year}${emp}-${sequence}`;
          
          user.empId = newEmpId;
          await user.save();
          
          console.log(`✓ Updated ${user.name}: ${oldEmpId} → ${newEmpId}`);
          updatedCount++;
        } else {
          console.log(`⚠ Skipped ${user.name}: ${oldEmpId} (doesn't match expected format)`);
        }
      } else {
        console.log(`✓ Already in new format: ${user.name} - ${oldEmpId}`);
      }
    }

    console.log(`\n✓ Updated ${updatedCount} employee IDs to new format`);

    // Show all users with empId
    const allUsers = await User.find({ empId: { $exists: true, $ne: null } })
      .select('name email joiningYear empId')
      .sort({ joiningYear: 1, empId: 1 });

    console.log(`\n=== All Employee IDs (${allUsers.length}) ===`);
    allUsers.forEach(u => {
      console.log(`${u.name}: ${u.empId} (Year: ${u.joiningYear})`);
    });
    console.log('=====================================\n');

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

updateEmployeeIdFormat();
