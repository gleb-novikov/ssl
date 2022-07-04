module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: 'https://sslwallet.app',
  app: {
    keys: env.array('APP_KEYS'),
  },
  sberUsername: env('SBER_USERNAME'),
  sberPassword: env('SBER_PASSWORD'),
  sberReturnUrl: env('SBER_RETURN_URL'),
  sberRangeOrders: env.int('SBER_RANGER_ORDERS', 3000000),
  acmeProduction: env.bool('ACME_PRODUCTION', false)
});
