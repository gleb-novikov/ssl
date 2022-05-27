'use strict';
const axios = require('axios');

/**
 *  certificate controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::certificate.certificate', ({ strapi }) =>  ({
    order: async (ctx, next) => {
        const stepSberOrder = 1000000;
        const {id} = ctx.request.params;
        const user = ctx.state.user;

        const order = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: '*',
        });

        if (user.username != order.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        const entry = await strapi.entityService.create('api::order.order', {
            data: {
                certificate: order
            }
        });

        try {
            const response = await axios.post('https://3dsec.sberbank.ru/payment/rest/register.do', null, {
                params: {
                    amount: order.certificate_type.price * 100,
                    currency: 643,
                    language: 'ru',
                    orderNumber: stepSberOrder + entry.id,
                    userName: strapi.config.get('server.sberUsername'),
                    password: strapi.config.get('server.sberPassword'),
                    returnUrl: strapi.config.get('server.sberReturnUrl')
                }
            });
            await strapi.entityService.update('api::order.order', entry.id, {
                data: {
                    orderId: response.data.orderId
                },
            });
            return response.data;
        } catch (error) {
            console.error(error);
        }
    },

    orderCheck: async (ctx, next) => {
        const {id} = ctx.request.params;
        const user = ctx.state.user;
        const {orderId} = ctx.request.query;

        const order = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: '*',
        });

        try {
            const response = await axios.post('https://3dsec.sberbank.ru/payment/rest/getOrderStatusExtended.do', null, {
                params: {
                    userName: strapi.config.get('server.sberUsername'),
                    password: strapi.config.get('server.sberPassword'),
                    orderId: orderId
                }
            });

            if (response.data.orderStatus != 2) {
                return {message: 'Error', description: 'Not paid'};
            }

            const entries = await strapi.entityService.findMany('api::order.order', {
                filters: { orderId: orderId },
                populate: '*',
            });

            const orderUpdate = await strapi.entityService.update('api::order.order', entries[0].id, {
                data: {
                    isPaid: true
                },
            });

            const certificateUpdate = await strapi.entityService.update('api::certificate.certificate', entries[0].certificate.id, {
                data: {
                    status: 'Issued'
                },
            });

            console.log(certificateUpdate);

            // TODO: get certificate
            
            return certificateUpdate;
        } catch (error) {
            console.error(error);
        }
        
    },
}));
