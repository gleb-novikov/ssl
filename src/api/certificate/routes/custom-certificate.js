module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/certificates/:id/order',
      handler: 'certificate.order'
    },
    {
      method: 'POST',
      path: '/certificates/:id/order/check',
      handler: 'certificate.orderCheck'
    },
  ],
};