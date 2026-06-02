// src/lib/auth.config.ts
import type { NextAuthOptions, DefaultSession } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Session, User, Account, Profile } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { users, companies, kanbanBoards, type KanbanStage } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/crypto';



declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: 'admin' | 'atendente' | 'superadmin';
      companyId: string;
      hasGoogleLinked: boolean;
      hasFacebookLinked: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role: 'admin' | 'atendente' | 'superadmin';
    companyId: string;
    googleId?: string | null;
    facebookId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    companyId?: string;
    googleId?: string | null;
    facebookId?: string | null;
    accessToken?: string;
  }
}

async function exchangeFacebookToken(shortLivedToken: string): Promise<string | null> {
  try {
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('Facebook Client ID or Secret missing, skipping token exchange.');
      return null;
    }

    const response = await fetch(
      `https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`
    );

    const data = await response.json();

    if (data.access_token) {
      return data.access_token;
    } else {
      console.error('Failed to exchange Facebook token:', data);
      return null;
    }
  } catch (error) {
    console.error('Error exchanging Facebook token:', error);
    return null;
  }
}

export const authConfig: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'email public_profile business_management whatsapp_business_management whatsapp_business_messaging instagram_manage_messages instagram_manage_comments',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios');
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.toLowerCase()))
          .limit(1);

        if (!user || !user.password) {
          throw new Error('Credenciais inválidas');
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Credenciais inválidas');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          companyId: user.companyId!,
          googleId: user.googleId,
          facebookId: user.facebookId,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile: _profile }: { user: User; account: Account | null; profile?: Profile }) {
      if (!account) return false;

      // [CRITICAL FIX] Account Linking for Different Emails (Moved to signIn)
      // Check if we have an active session to link to, BEFORE checking email match/creation.
      if (account.provider === 'google' || account.provider === 'facebook') {
        try {
          const { cookies } = await import('next/headers');
          const { decode } = await import('next-auth/jwt');
          const cookieStore = await cookies();
          const sessionToken = cookieStore.get('next-auth.session-token')?.value ||
            cookieStore.get('__Secure-next-auth.session-token')?.value;

          if (sessionToken) {
            const decoded = await decode({
              token: sessionToken,
              secret: process.env.NEXTAUTH_SECRET || '',
            });

            if (decoded?.sub) {
              const targetUserId = decoded.sub;
              const providerId = account.providerAccountId;
              const accessToken = account.access_token;

              // Update existing user with new provider details
              const updates: any = {};

              if (account.provider === 'facebook') {
                await db.update(users)
                  .set({ facebookId: null, facebookAccessToken: null })
                  .where(eq(users.facebookId, providerId));

                updates.facebookId = providerId;
                let tokenToStore = accessToken;
                const longToken = await exchangeFacebookToken(accessToken || '').catch(() => null);
                if (longToken) tokenToStore = longToken;
                updates.facebookAccessToken = tokenToStore ? encrypt(tokenToStore) : null;
              } else if (account.provider === 'google') {
                await db.update(users)
                  .set({ googleId: null, googleAccessToken: null })
                  .where(eq(users.googleId, providerId));
                updates.googleId = providerId;
                if (accessToken) updates.googleAccessToken = accessToken;
              }

              await db.update(users)
                .set(updates)
                .where(eq(users.id, targetUserId));

              // [IMPORTANT] Mutate the 'user' object so NextAuth uses the EXISTING user identity
              // instead of the profile from the provider.
              const [updatedUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
              if (updatedUser) {
                user.id = updatedUser.id;
                user.role = updatedUser.role;
                user.companyId = updatedUser.companyId!;
                user.email = updatedUser.email; // Keep original email
                user.googleId = updatedUser.googleId;
                user.facebookId = updatedUser.facebookId;
                return true; // Successfully linked and set user context
              }
            }
          }
        } catch (e) {
          console.error("[Auth] Error in manual linking in signIn:", e);
        }
      }

      // Standard flow (Email match or Create New)
      if (account.provider === 'google' || account.provider === 'facebook') {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        const providerId = account.provider === 'google' ? account.providerAccountId : account.providerAccountId;
        const accessToken = account.access_token;

        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existingUser) {
          const updates: any = {};

          if (account.provider === 'google') {
            updates.googleId = providerId;
            updates.googleAccessToken = accessToken;
          } else if (account.provider === 'facebook') {
            // [FIX] PROACTIVE conflict resolution: Clear facebook_id from other users BEFORE update
            // Drizzle returns code=undefined for constraint errors, making catch unreliable.
            // Also prevents NextAuth from putting encrypted token in error URL (breaks HTTP headers).
            await db.update(users)
              .set({ facebookId: null, facebookAccessToken: null })
              .where(eq(users.facebookId, providerId));

            updates.facebookId = providerId;
            // [FIX] Store token ENCRYPTED as expected by meta-import and facebookApiService
            let tokenToStore = accessToken;

            // [FEATURE] Token Exchange (Short -> Long Lived)
            if (accessToken) {
              const longLivedToken = await exchangeFacebookToken(accessToken);
              if (longLivedToken) {
                tokenToStore = longLivedToken;
              }
            }
            updates.facebookAccessToken = tokenToStore ? encrypt(tokenToStore) : null;
          }

          updates.avatarUrl = user.image || existingUser.avatarUrl;
          updates.emailVerified = new Date();

          await db
            .update(users)
            .set(updates)
            .where(eq(users.id, existingUser.id));

          user.id = existingUser.id;
          user.role = existingUser.role;
          user.companyId = existingUser.companyId!;
          user.googleId = account.provider === 'google' ? providerId : existingUser.googleId;
          user.facebookId = account.provider === 'facebook' ? providerId : existingUser.facebookId;
        } else {
          const uniqueSuffix = uuidv4().split('-')[0];
          const userName = user.name || user.email?.split('@')[0] || 'User';

          const [newCompany] = await db
            .insert(companies)
            .values({ name: `${userName}'s Company ${uniqueSuffix}` })
            .returning();

          if (!newCompany) {
            throw new Error('Falha ao criar empresa');
          }

          const newUserData: any = {
            name: user.name || 'User',
            email,
            avatarUrl: user.image,
            firebaseUid: `oauth_${Date.now()}_${Math.random()}`,
            role: 'admin' as const,
            companyId: newCompany.id,
            emailVerified: new Date(),
          };

          if (account.provider === 'google') {
            newUserData.googleId = providerId;
            newUserData.googleAccessToken = accessToken;
          } else if (account.provider === 'facebook') {
            newUserData.facebookId = providerId;
            // [FIX] Store token ENCRYPTED as expected by meta-import and facebookApiService
            let tokenToStore = accessToken;

            // [FEATURE] Token Exchange (Short -> Long Lived)
            if (accessToken) {
              const longLivedToken = await exchangeFacebookToken(accessToken);
              if (longLivedToken) {
                tokenToStore = longLivedToken;
              }
            }
            newUserData.facebookAccessToken = tokenToStore ? encrypt(tokenToStore) : null;
          }

          const [createdUser] = await db
            .insert(users)
            .values(newUserData)
            .returning();

          if (!createdUser) {
            throw new Error('Falha ao criar usuário');
          }

          const defaultStagesData: KanbanStage[] = [
            { id: uuidv4(), title: 'Novo Lead', type: 'NEUTRAL' },
            { id: uuidv4(), title: 'Qualificado', type: 'NEUTRAL' },
            { id: uuidv4(), title: 'Proposta Enviada', type: 'NEUTRAL', semanticType: 'proposal_sent' },
            { id: uuidv4(), title: 'Fechado (Ganho)', type: 'WIN' },
            { id: uuidv4(), title: 'Perdido', type: 'LOSS' },
          ];

          await db
            .insert(kanbanBoards)
            .values({
              name: 'Funil Padrão',
              companyId: newCompany.id,
              funnelType: 'GENERAL',
              objective: 'Funil criado automaticamente para gerenciar seus leads',
              stages: defaultStagesData,
            });

          user.id = createdUser.id;
          user.role = createdUser.role;
          user.companyId = createdUser.companyId!;
          user.googleId = createdUser.googleId;
          user.facebookId = createdUser.facebookId;
        }
      }

      return true;
    },
    async jwt({ token, user, account }: { token: JWT; user?: User; account?: Account | null }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
        token.googleId = user.googleId;
        token.facebookId = user.facebookId;
      }


      // [FIX] Proactively update token IDs during Sign-In/Link event
      if (account) {
        token.accessToken = account.access_token;

        let targetUserId = token.id || token.sub;

        // [CRITICAL FIX] Account Linking for Different Emails
        if (!targetUserId) {
          try {
            // Dynamic imports to be safe
            const { cookies } = await import('next/headers');
            const { decode } = await import('next-auth/jwt');

            const cookieStore = await cookies();
            const sessionToken = cookieStore.get('next-auth.session-token')?.value ||
              cookieStore.get('__Secure-next-auth.session-token')?.value;

            if (sessionToken) {
              const decoded = await decode({
                token: sessionToken,
                secret: process.env.NEXTAUTH_SECRET || '',
              });

              if (decoded?.sub) {
                targetUserId = decoded.sub;
              }
            }
          } catch (e) {
            console.error("[Auth] Error attempting to link account: could not decode session cookie.", e);
          }
        }

        if (targetUserId) {
          const providerId = account.providerAccountId;
          const updates: any = {};

          // [CRITICAL] Proactive Conflict Resolution
          if (account.provider === 'facebook') {
            // Clear old links
            await db.update(users)
              .set({ facebookId: null, facebookAccessToken: null })
              .where(eq(users.facebookId, providerId));

            updates.facebookId = providerId;

            let tokenToStore = account.access_token;
            if (tokenToStore) {
              const longToken = await exchangeFacebookToken(tokenToStore).catch(() => null);
              if (longToken) tokenToStore = longToken;
              updates.facebookAccessToken = encrypt(tokenToStore);
            }

            token.facebookId = providerId;

          } else if (account.provider === 'google') {
            await db.update(users)
              .set({ googleId: null, googleAccessToken: null })
              .where(eq(users.googleId, providerId));

            updates.googleId = providerId;
            if (account.access_token) {
              updates.googleAccessToken = account.access_token;
            }
            token.googleId = providerId;
          }

          // Update the REAL user
          await db.update(users)
            .set(updates)
            .where(eq(users.id, targetUserId));

          token.id = targetUserId;
        } else {
          // Fallback for FRESH logins (no session cookie)
          if (account.provider === 'google') {
            token.googleId = account.providerAccountId;
          }
          if (account.provider === 'facebook') {
            token.facebookId = account.providerAccountId;
          }
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.companyId = token.companyId as string;
        session.user.hasGoogleLinked = !!token.googleId;
        session.user.hasFacebookLinked = !!token.facebookId;
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // [FIX] Define explicit Public URL for Replit environment
      // Replit often reports 0.0.0.0 or localhost as baseUrl, which breaks public redirects
      const PUBLIC_URL = 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';

      // Use configured PUBLIC_URL if baseUrl looks internal
      const effectiveBaseUrl = (baseUrl.includes('0.0.0.0') || baseUrl.includes('localhost'))
        ? PUBLIC_URL
        : baseUrl;

      const isOAuthCallback = url.includes('/api/auth/callback/google') ||
        url.includes('/api/auth/callback/facebook');

      if (!isOAuthCallback) {
        // [FIX] Force OAuth flow to go through oauth-callback to generate session cookies
        // This catches cases where frontend might send incorrect callbackUrl or browser is cached
        if (url === '/dashboard' || url === `${baseUrl}/dashboard` || url === `${effectiveBaseUrl}/dashboard`) {
          return `${effectiveBaseUrl}/api/auth/oauth-callback?redirect=/dashboard`;
        }

        if (url.startsWith('/')) return `${effectiveBaseUrl}${url}`;
        if (url.startsWith(effectiveBaseUrl)) return url;
        return effectiveBaseUrl;
      }

      let finalDestination = '/dashboard';

      if (url.includes('callbackUrl=')) {
        const urlObj = new URL(url, baseUrl); // use original baseUrl for parsing relative
        const callbackUrl = urlObj.searchParams.get('callbackUrl');

        if (callbackUrl) {
          if (callbackUrl.startsWith('//')) {
            finalDestination = '/dashboard';
          } else if (callbackUrl.startsWith('/')) {
            finalDestination = callbackUrl;
          } else {
            try {
              const callbackUrlObj = new URL(callbackUrl);
              const effectiveBaseUrlObj = new URL(effectiveBaseUrl);

              if (callbackUrlObj.origin === effectiveBaseUrlObj.origin) {
                finalDestination = callbackUrl;
              }
            } catch {
              finalDestination = '/dashboard';
            }
          }
        }
      }

      return `${effectiveBaseUrl}/api/auth/oauth-callback?redirect=${encodeURIComponent(finalDestination)}`;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
};
