'use strict';

/**
 * acme-order service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::acme-order.acme-order');
