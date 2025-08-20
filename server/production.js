#!/usr/bin/env node

// Production server entry point that bypasses TypeScript
process.env.NODE_ENV = 'production';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Use tsx to run TypeScript directly
import('./index.ts');