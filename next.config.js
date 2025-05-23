
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@tremor/react', 'react-day-picker'],
  // Configuración para permitir archivos grandes (aumentar a 100MB)
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
    responseLimit: '100mb',
  },
  
  // Configuración para manejar paquetes ESM
  webpack: (config, { isServer }) => {
    // Esto evita que Next.js intente procesar paquetes ESM directamente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false
      };
    }
    
    // Agregar soporte específico para date-fns
    const alias = config.resolve.alias || {};
    config.resolve.alias = {
      ...alias,
      // Esto hace que los imports de date-fns sean tratados como CommonJS
      'date-fns': false
    };
    
    return config;
  },
};

module.exports = nextConfig;
