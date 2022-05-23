'use strict';

/**
 * `certificate-policy` policy.
 */

module.exports = (policyContext, config, { strapi }) => {
    // Add your own logic here.
    strapi.log.info('In certificate-policy policy.');
    console.log(policyContext.state);
    console.log(config);

    const canDoSomething = true;

    if (canDoSomething) {
      return true;
    }

    return false;
};
