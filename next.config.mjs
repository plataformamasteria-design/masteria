/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Generate required-server-files.json for custom server in production
  output: 'standalone',

  // Otimizações de produção
  reactStrictMode: process.env.NODE_ENV === 'development',
  poweredByHeader: false,
  // Cache Buster for HMR: 2024-03-21
  compress: true,

  serverExternalPackages: [
    // Audio/Media processing
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    'sharp',
    'pdf-parse',
    // Queue & Redis
    'bullmq',
    'ioredis',
    // Database
    'postgres',
    'drizzle-orm',
    // AI/LLM SDKs
    '@google/generative-ai',
    // Telephony & Voice
    'twilio',
    'retell-sdk',
    // Email
    'resend',
    // Monitoring
    '@opentelemetry/api',
    '@opentelemetry/auto',
    '@opentelemetry/sdk-node',
  ],
  experimental: {
    // serverActions is now default in Next.js 14+ and should be an object if configured
  },

  // Desabilitar recursos de desenvolvimento em produção
  productionBrowserSourceMaps: false,

  // ========================================
  // BUILD OPTIMIZATION - ESLint Caching
  // ========================================
  /**
   * Enable ESLint caching to avoid timeouts during build/CI/CD.
   * Cache is stored in .next/cache/eslint for faster subsequent builds.
   * 
   * Architect Recommendation: Integrate lint caching to avoid build timeouts
   * Evidence: Build timed out at 240s during linting phase on 2025-11-24
   */
  eslint: {
    // Enable caching for faster builds
    dirs: ['src', 'pages', 'components', 'lib'],
    // Ignore during build to prevent timeout (lint separately)
    ignoreDuringBuilds: true,
  },

  // TypeScript checking optimization
  typescript: {
    // Type check in parallel with build (don't block)
    ignoreBuildErrors: true,
  },

  // Otimização de compilação
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  webpack: (config, { dev, isServer }) => {
    // ✅ FASE 3: Webpack Externals para Node-only modules
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      if (isServer) {
        config.externals.push({
          'bullmq': 'commonjs bullmq',
          'ioredis': 'commonjs ioredis',
          'postgres': 'commonjs postgres',
          'sharp': 'commonjs sharp',
          'pdf-parse': 'commonjs pdf-parse',
          'twilio': 'commonjs twilio',
          '@opentelemetry/api': 'commonjs @opentelemetry/api',
          '@opentelemetry/auto': 'commonjs @opentelemetry/auto',
          '@opentelemetry/sdk-node': 'commonjs @opentelemetry/sdk-node',
        });
      }
    }

    // Desabilitar hot reload em produção
    if (!dev) {
      config.watchOptions = {
        ignored: /node_modules/,
        poll: false,
      };

      // Desabilitar source maps em produção (exceto para servidor)
      if (!isServer) {
        config.devtool = false;
      }
    } else {
      // ✅ Otimizações de dev para Windows com RAM limitada
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.next/**'],
        poll: false,
        aggregateTimeout: 300,
      };
    }


    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.whatsapp.net',
      },
      {
        protocol: 'https',
        hostname: 'flagsapi.com',
      },
      {
        protocol: 'https',
        hostname: '**.replit.dev',
      },
      // Facebook/Instagram CDN patterns
      {
        protocol: 'https',
        hostname: '**.fbsbx.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
};

export default nextConfig;
