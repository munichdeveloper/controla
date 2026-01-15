/** @type {import('next').NextConfig} */
const nextConfig = {
    // Leitet API-Anfragen an das Backend weiter (funktioniert in Dev & Production)
    async rewrites() {
        // In Production (Docker): Backend läuft auf localhost:8081 im gleichen Container
        // In Dev: Backend läuft separat auf localhost:8081
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081/api';
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



