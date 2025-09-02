import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { storage } from './storage.js';
// Helper function to handle social auth user creation/update
async function handleSocialAuth(provider, profile, done) {
    try {
        const email = profile.emails?.[0]?.value || `${profile.id}@${provider}.social`;
        const username = profile.username || profile.displayName || `${provider}_${profile.id}`;
        // Check if user exists by email or social provider ID
        let user = await storage.getUserByEmail(email);
        if (!user) {
            // Create new user with social provider info
            user = await storage.createUser({
                email,
                username,
                password: '', // No password for social login
                tier: 'free',
                provider: provider,
                providerId: profile.id,
                avatar: profile.photos?.[0]?.value,
                emailVerified: true // Auto-verify social accounts
            });
        }
        else {
            // Update existing user with social provider info if needed
            if (!user.provider) {
                await storage.updateUser(user.id, {
                    provider: provider,
                    providerId: profile.id,
                    avatar: user.avatar || profile.photos?.[0]?.value
                });
            }
        }
        done(null, user);
    }
    catch (error) {
        done(error);
    }
}
export function configureSocialAuth() {
    // Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback',
            scope: ['profile', 'email']
        }, async (accessToken, refreshToken, profile, done) => {
            await handleSocialAuth('google', profile, done);
        }));
    }
    // Facebook OAuth Strategy
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
        passport.use(new FacebookStrategy({
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: '/api/auth/facebook/callback',
            profileFields: ['id', 'emails', 'displayName', 'photos']
        }, async (accessToken, refreshToken, profile, done) => {
            await handleSocialAuth('facebook', profile, done);
        }));
    }
    // Reddit OAuth Strategy - temporarily disabled due to import issues
    // Will be enabled once passport-reddit ES module compatibility is resolved
    // if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    //   // Reddit strategy implementation
    // }
    // Serialize and deserialize user
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        }
        catch (error) {
            done(error);
        }
    });
}
// Social auth route handlers
export const socialAuthRoutes = {
    // Google routes
    googleAuth: passport.authenticate('google', { scope: ['profile', 'email'] }),
    googleCallback: passport.authenticate('google', {
        failureRedirect: '/login?error=google_auth_failed',
        successRedirect: '/'
    }),
    // Facebook routes
    facebookAuth: passport.authenticate('facebook', { scope: ['email'] }),
    facebookCallback: passport.authenticate('facebook', {
        failureRedirect: '/login?error=facebook_auth_failed',
        successRedirect: '/'
    }),
    // Reddit routes
    redditAuth: passport.authenticate('reddit', {
        state: 'reddit-auth-state',
        duration: 'permanent'
    }),
    redditCallback: passport.authenticate('reddit', {
        failureRedirect: '/login?error=reddit_auth_failed',
        successRedirect: '/'
    })
};
