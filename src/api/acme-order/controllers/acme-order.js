'use strict';

/**
 *  acme-order controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::acme-order.acme-order');
