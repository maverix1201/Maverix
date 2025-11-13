import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import User, { IUser } from '@/models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
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

        const userDoc = user as IUser;
        return {
          id: userDoc._id.toString(),
          email: userDoc.email,
          name: userDoc.name,
          role: userDoc.role,
          profileImage: userDoc.profileImage,
          mobileNumber: userDoc.mobileNumber,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.profileImage = (user as any).profileImage;
        token.mobileNumber = (user as any).mobileNumber;
      } else if (token.id) {
        // Refresh user data from database
        await connectDB();
        const dbUser = await User.findById(token.id).select('profileImage mobileNumber name');
        if (dbUser) {
          const userDoc = dbUser as IUser;
          token.profileImage = userDoc.profileImage;
          token.mobileNumber = userDoc.mobileNumber;
          token.name = userDoc.name;
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

