'use strict';
const axios = require('axios');

/**
 *  certificate controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::certificate.certificate', ({ strapi }) =>  ({
    findOne: async (ctx, next) => {
        const { id } = ctx.params;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: ['user', 'certificate_type'],
        });

        if (entity.user == null || user.username != entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        delete entity.user;

        return entity;
    },

    find: async (ctx, next) => {
        const user = ctx.state.user;
        const {start, limit} = ctx.request.query;

        const entities = await strapi.entityService.findMany('api::certificate.certificate', {
            populate: ['certificate_type'],
            filters: {
                user: {
                    username: {
                        $eq: user.username,
                    }
                }
            },
            start: start,
            limit: limit,
        });

        return {data: entities};
    },

    create: async (ctx, next) => {
        const user = ctx.state.user;
        const body = ctx.request.body;

        const certificateType = await strapi.entityService.findOne('api::certificate-type.certificate-type',
            body.certificateType);

        if (!certificateType) {
            return {message: 'Error', description: 'Unknown sertificate type'};
        }

        function addMonths(date, months) {
            var d = date.getDate();
            date.setMonth(date.getMonth() + +months);
            if (date.getDate() != d) {
                date.setDate(0);
            }
            return date;
        }

        const stopDate = addMonths(new Date(body.startDate), 12);

        const entity = await strapi.entityService.create('api::certificate.certificate', {
            data: {
                domain: body.domain,
                startDate: body.startDate,
                stopDate: stopDate.toISOString().split('T')[0],
                autoProlangate: body.autoProlangate ? body.autoProlangate : false,
                status: 'Draft',
                user: user,
                certificate_type: certificateType
            },
            populate: ['certificate_type']
        });

        return entity;
    },

    update: async (ctx, next) => {
        const { id } = ctx.params;
        const user = ctx.state.user;
        const body = ctx.request.body;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: ['user', 'certificate_type'],
        });

        if (entity.user == null || user.username != entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        if (body.status != null && !["Draft", "Canceled"].includes(body.status)) {
            return {message: 'Error', description: 'Invalid status'};
        }

        const certificateType = await strapi.entityService.findOne('api::certificate-type.certificate-type',
            body.certificateType ? body.certificateType : entity.certificate_type.id);

        function addMonths(date, months) {
            var d = date.getDate();
            date.setMonth(date.getMonth() + +months);
            if (date.getDate() != d) {
                date.setDate(0);
            }
            return date;
        }

        const stopDate = body.startDate ? addMonths(new Date(body.startDate), 12).toISOString().split('T')[0] : entity.stopDate;

        const entityUpdate = await strapi.entityService.update('api::certificate.certificate', id, {
            data: {
                domain: body.domain,
                startDate: body.startDate,
                stopDate: stopDate,
                autoProlangate: body.autoProlangate,
                status: body.status,
                certificate_type: certificateType
            },
            populate: ['certificate_type']
        });

        return entityUpdate;
    },

    delete: async (ctx, next) => {
        const { id } = ctx.params;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: ['user'],
        });

        if (entity.user == null || user.username != entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        const entityDelete = await strapi.entityService.delete('api::certificate.certificate', id, {
            populate: ['certificate_type'],
        });

        return entityDelete;
    },

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
