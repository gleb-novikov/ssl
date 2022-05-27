'use strict';

/**
 * certificate router.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::certificate.certificate');

// module.exports = createCoreRouter('api::certificate.certificate', {
//   prefix: '',
//   only: ['create', 'find', 'findOne', 'update', 'delete'],
//   except: [],
//   config: {
//     find: {
//       policies: ['certificate-policy'],
//     },
//     findOne: {
//       policies: ['certificate-policy'],
//     },
//     create: {},
//     update: {
//       policies: ['certificate-policy'],
//     },
//     delete: {
//       policies: ['certificate-policy'],
//     },
//   },
// });
