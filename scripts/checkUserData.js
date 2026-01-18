// Script to check if joiningYear and empId are saved in the database
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const User = require('../models/User').default;

async function checkUserData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the user by email
    const user = await User.findOne({ email: 'chandrakant@mavericksmedia.org' })
      .select('name email joiningYear empId role');

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('\n=== User Data ===');
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Joining Year:', user.joiningYear);
    console.log('Employee ID:', user.empId);
    console.log('================\n');

    // Check all users with joiningYear
    const usersWithJoiningYear = await User.find({ joiningYear: { $exists: true, $ne: null } })
      .select('name email joiningYear empId')
      .sort({ joiningYear: 1, empId: 1 });

    console.log(`\nFound ${usersWithJoiningYear.length} users with joining year:`);
    usersWithJoiningYear.forEach(u => {
      console.log(`- ${u.name}: Year=${u.joiningYear}, EmpID=${u.empId || 'NOT SET'}`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserData();
