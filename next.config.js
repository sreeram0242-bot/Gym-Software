/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@whiskeysockets/baileys', 'pino', 'qrcode'],
}

module.exports = nextConfig
