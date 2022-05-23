module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'd73dea14b8c55066a6d891fec202e486'),
  },
});
