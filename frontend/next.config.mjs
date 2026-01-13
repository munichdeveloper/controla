/** @type {import('next').NextConfig} */
const nextConfig = {
    // Leitet API-Anfragen im Dev-Modus an das Backend weiter
    async rewrites() {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:8080/api';
        console.log('Backend URL:', backendUrl);

        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/:path*`,
            },
        ]
    },
    // Erzeugt ein eigenständiges Build-Verzeichnis für Docker
    output: 'standalone',
};

export default nextConfig;



