import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl({
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff'
    ]
  }
});
