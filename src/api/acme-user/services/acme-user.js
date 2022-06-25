'use strict';

/**
 * acme-user service.
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::acme-user.acme-user');
