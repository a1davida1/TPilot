import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as RedditStrategy } from 'passport-reddit';
import { storage } from './storage.js';
export function setupSocialAuth(app) {
    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());
    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await storage.getUser(id);
            done(null, user);
        }
        catch (error) {
            done(error, null);
        }
    });
    // Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/api/auth/google/callback"
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists by email OR username
                const email = profile.emails?.[0]?.value || '';
                const username = profile.displayName || email || '';
                let user = await storage.getUserByEmail(email);
                if (!user) {
                    user = await storage.getUserByUsername(username);
                }
                if (!user) {
                    // Create new user only if not found by email OR username
                    user = await storage.createUser({
                        email,
                        username,
                        password: '', // No password for social auth
                        provider: 'google',
                        providerId: profile.id,
                        avatar: profile.photos?.[0]?.value
                    });
                }
                return done(null, user);
            }
            catch (error) {
                return done(error, false);
            }
        }));
    }
    // Facebook OAuth Strategy
    if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
        passport.use(new FacebookStrategy({
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: "/api/auth/facebook/callback",
            profileFields: ['id', 'emails', 'name', 'picture']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists by email OR username  
                const email = profile.emails?.[0]?.value || '';
                const username = `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || email || '';
                let user = await storage.getUserByEmail(email);
                if (!user) {
                    user = await storage.getUserByUsername(username);
                }
                if (!user) {
                    // Create new user only if not found by email OR username
                    user = await storage.createUser({
                        email,
                        username,
                        password: '',
                        provider: 'facebook',
                        providerId: profile.id,
                        avatar: profile.photos?.[0]?.value
                    });
                }
                return done(null, user);
            }
            catch (error) {
                return done(error, false);
            }
        }));
    }
    // Reddit OAuth Strategy
    if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
        passport.use(new RedditStrategy({
            clientID: process.env.REDDIT_CLIENT_ID,
            clientSecret: process.env.REDDIT_CLIENT_SECRET,
            callbackURL: "/api/auth/reddit/callback",
            scope: ['identity']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                // Reddit doesn't provide email, use username
                let user = await storage.getUserByUsername(profile.name || profile.id);
                if (!user) {
                    user = await storage.createUser({
                        email: '', // Reddit doesn't provide email
                        username: profile.name || `reddit_${profile.id}`,
                        password: '',
                        provider: 'reddit',
                        providerId: profile.id,
                        avatar: profile.icon_img || ''
                    });
                }
                return done(null, user);
            }
            catch (error) {
                return done(error, false);
            }
        }));
    }
    // Auth routes
    setupAuthRoutes(app);
}
function setupAuthRoutes(app) {
    // Google routes
    app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }), (req, res) => {
        res.redirect('/dashboard');
    });
    // Facebook routes
    app.get('/api/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
    app.get('/api/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login?error=facebook_failed' }), (req, res) => {
        res.redirect('/dashboard');
    });
    // Reddit routes
    app.get('/api/auth/reddit', passport.authenticate('reddit', {
        state: Math.random().toString(36).substring(7)
    }));
    app.get('/api/auth/reddit/callback', passport.authenticate('reddit', { failureRedirect: '/login?error=reddit_failed' }), (req, res) => {
        res.redirect('/dashboard?connected=reddit');
    });
    // Logout
    app.post('/api/auth/logout', (req, res) => {
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            res.json({ message: 'Logged out successfully' });
        });
    });
    // Get current user
    app.get('/api/auth/user', (req, res) => {
        if (req.isAuthenticated()) {
            res.json(req.user);
        }
        else {
            res.status(401).json({ error: 'Not authenticated' });
        }
    });
}
