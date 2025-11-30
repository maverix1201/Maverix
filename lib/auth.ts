import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User, { IUser } from '@/models/User';

// Helper function to validate and sanitize profileImage
function sanitizeProfileImage(profileImage: any): string | null {
  if (!profileImage) {
    return null;
  }
  
  if (typeof profileImage !== 'string') {
    return null;
  }
  
  // Check if it's a valid data URL or regular URL
  const isDataUrl = profileImage.startsWith('data:image/');
  const isUrl = profileImage.startsWith('http://') || profileImage.startsWith('https://');
  
  if (!isDataUrl && !isUrl) {
    return null;
  }
  
  // Limit size to prevent JWT token issues (80KB max - matches compression limit)
  // Since we compress images to max 80KB, we can safely include them in JWT tokens
  if (profileImage.length > 80000) {
    return null;
  }
  
  return profileImage;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter your email and password');
        }

        await connectDB();

        const user = await User.findOne({ email: credentials.email.toLowerCase() });

        if (!user) {
          throw new Error('No user found with this email');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email first');
        }

        if (!user.password) {
          throw new Error('Please set your password first');
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        // For employees, check if they are approved
        if (user.role === 'employee' && !user.approved) {
          // Allow login but they'll be redirected to waiting page
        }

        const userDoc = user as IUser;
          
          // Handle profileImage - validate and sanitize to prevent issues
          const profileImage = sanitizeProfileImage(userDoc.profileImage);

        return {
          id: String(userDoc._id),
          email: userDoc.email,
          name: userDoc.name,
          role: userDoc.role,
            profileImage: profileImage,
          mobileNumber: userDoc.mobileNumber,
          approved: userDoc.approved || false,
        };
        } catch (error: any) {
          console.error('Authorization error:', error);
          // Re-throw the error so NextAuth can handle it properly
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
          // Sanitize profileImage to prevent JWT token issues
          token.profileImage = sanitizeProfileImage((user as any).profileImage);
        token.mobileNumber = (user as any).mobileNumber;
        token.approved = (user as any).approved;
      } else if (token.id) {
        // Refresh user data from database
        await connectDB();
          const dbUser = await User.findById(token.id).select('profileImage mobileNumber name approved role emailVerified');
        if (dbUser) {
          const userDoc = dbUser as IUser;
            // Sanitize profileImage to prevent JWT token issues
            token.profileImage = sanitizeProfileImage(userDoc.profileImage);
          token.mobileNumber = userDoc.mobileNumber;
          token.name = userDoc.name;
          // Set approved status - be explicit about it
          if (userDoc.role === 'employee') {
            // For employees:
            // - If approved is explicitly true → approved
            // - If approved is undefined/null (old employees) → treat as approved
            // - If approved is explicitly false → not approved (new employees)
            token.approved = userDoc.approved === true || (userDoc.approved !== false && userDoc.approved !== true);
          } else {
            // Admin and HR are always approved
            token.approved = true;
          }
          }
        }
      } catch (error: any) {
        console.error('JWT callback error:', error);
        // If there's an error, ensure we still return a valid token
        // Don't include profileImage if it's causing issues
        if (token) {
          token.profileImage = null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).profileImage = token.profileImage;
        (session.user as any).mobileNumber = token.mobileNumber;
        (session.user as any).approved = token.approved;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

