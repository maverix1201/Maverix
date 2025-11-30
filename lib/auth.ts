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
            throw new Error('Invalid email or password');
          }

          if (!user.password) {
            throw new Error('Invalid email or password');
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error('Invalid email or password');
          }

          const userDoc = user as IUser;

          // Return user data with role for redirect
          return {
            id: String(userDoc._id),
            email: userDoc.email,
            name: userDoc.name,
            role: userDoc.role,
            mobileNumber: userDoc.mobileNumber,
            approved: userDoc.approved || false,
          };
        } catch (error: any) {
          console.error('Authorization error:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      try {
      if (user) {
        // Ensure all values are properly set
        token.id = user.id || '';
        token.email = user.email || '';
        token.name = user.name || '';
        token.role = (user as any).role || '';
        // Exclude profileImage from JWT to prevent HTTP 431 errors
        // ProfileImage will be fetched separately via /api/profile/image
        token.mobileNumber = (user as any).mobileNumber || '';
        token.approved = (user as any).approved !== undefined ? (user as any).approved : false;
      } else if (token.id) {
        // Refresh user data from database
        await connectDB();
        // Exclude profileImage from query to keep token small
        const dbUser = await User.findById(token.id).select('mobileNumber name approved role emailVerified email');
        if (dbUser) {
          const userDoc = dbUser as IUser;
          // Don't include profileImage in token to prevent cookie size issues
          token.mobileNumber = userDoc.mobileNumber || '';
          token.name = userDoc.name || '';
          token.email = userDoc.email || '';
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
        // If there's an error, ensure we still return a valid token with defaults
        if (!token.id) {
          return null as any;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // If no token or no token.id, return null (user not authenticated)
      if (!token || !token.id) {
        return null as any;
      }
      
      // Ensure session exists
      if (!session) {
        session = {
          user: {
            id: '',
            email: '',
            name: '',
            role: 'employee' as const,
          },
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
      
      // Ensure session.user exists
      if (!session.user) {
        session.user = {
          id: token.id as string || '',
          email: token.email as string || '',
          name: token.name as string || '',
          role: (token.role as 'admin' | 'hr' | 'employee') || 'employee',
        };
      }
      
      // Always set required properties from token
      if (token.id) {
        (session.user as any).id = token.id;
      }
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      if (token.role) {
        session.user.role = token.role as 'admin' | 'hr' | 'employee';
      }
      if (token.mobileNumber) {
        (session.user as any).mobileNumber = token.mobileNumber;
      }
      if (token.approved !== undefined) {
        (session.user as any).approved = token.approved;
      }
      
      // Ensure expires is set
      if (!session.expires) {
        session.expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? undefined : undefined, // Let browser handle domain
        // Increase maxAge to match session maxAge
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

