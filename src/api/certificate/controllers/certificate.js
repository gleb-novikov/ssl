'use strict';
const axios = require('axios');
const acme = require('acme-client');
let client;

/**
 *  certificate controller
 */

const {createCoreController} = require('@strapi/strapi').factories;

module.exports = createCoreController('api::certificate.certificate', ({strapi}) => ({
    findOne: async (ctx, next) => {
        const {id} = ctx.params;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: ['user', 'certificate_type'],
        });

        if (entity.user == null || user.username !== entity.user.username) {
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
            if (date.getDate() !== d) {
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

        generateAcmeCertificate(body.domain);

        return entity;
    },

    update: async (ctx, next) => {
        const {id} = ctx.params;
        const user = ctx.state.user;
        const body = ctx.request.body;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {
            populate: ['user', 'certificate_type'],
        });

        if (entity.user == null || user.username !== entity.user.username) {
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
            if (date.getDate() !== d) {
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
        const {id} = ctx.params;
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

        if (user.username !== order.user.username) {
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

            if (response.data.orderStatus !== 2) {
                return {message: 'Error', description: 'Not paid'};
            }

            const entries = await strapi.entityService.findMany('api::order.order', {
                filters: {orderId: orderId},
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

    issue: async (ctx, next) => {
        const {id} = ctx.request.params;
        const user = ctx.state.user;

        const order = await strapi.entityService.findOne('api::certificate.certificate', id, {populate: '*'});

        if (user.username !== order.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        if (order.certificate_type.type === "Let's Encrypt") {
            if (client == null) {
                const acmeUser = await strapi.entityService.findOne('api::acme-user.acme-user', 1);
                const initObject = await initAcme(acmeUser);
                await strapi.entityService.update('api::acme-user.acme-user', 1, {
                    data: {
                        privateKey: initObject.key,
                        url: initObject.accountUrl
                    }
                });
            }

            const {acmeOrder, result} = await generateAcmeCertificate(order.domain);
            const entry = await strapi.entityService.create('api::acme-order.acme-order', {
                data: {
                    order: acmeOrder
                }
            });
            await strapi.entityService.update('api::certificate.certificate', id, {
                data: {
                    acme_order: entry
                }
            });

            return result;
        } else {
            return {message: 'Error', description: "Server can't create this type of certificate"};
        }
    },

    verification: async (ctx, next) => {
        const {id} = ctx.request.params;
        const {type} = ctx.request.query;
        const user = ctx.state.user;

        const order = await strapi.entityService.findOne('api::certificate.certificate', id, {populate: '*'});

        if (user.username !== order.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        if (order.certificate_type.type === "Let's Encrypt") {
            if (client == null) {
                const acmeUser = await strapi.entityService.findOne('api::acme-user.acme-user', 1);
                const initObject = await initAcme(acmeUser);
                await strapi.entityService.update('api::acme-user.acme-user', 1, {
                    data: {
                        privateKey: initObject.key,
                        url: initObject.accountUrl
                    }
                });
            }

            if (order.acme_order.order == null || order.acme_order.order == '') {
                return {message: 'Error', description: 'No order for this domain'};
            }

            const acmeOrder = await client.getOrder(order.acme_order.order);
            const result = await verifyAcmeOrder(order.domain, acmeOrder, type);
            await strapi.entityService.update('api::acme-order.acme-order', order.acme_order.id, {
                data: {
                    csr: result.csr,
                    privateKey: result.privateKey,
                    certificate: result.certificate
                }
            });

            await strapi.entityService.update('api::certificate.certificate', id, {
                data: {
                    status: 'Verified'
                }
            });

            return result;
        } else {
            return {message: 'Error', description: "Server can't create this type of certificate"};
        }
    },

    verificationTypes: async (ctx, next) => {
        const {id} = ctx.request.params;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {populate: '*'});

        if (user.username !== entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        let types = [];
        if (entity.certificate_type.type === "Let's Encrypt") {
            types = ['dns', 'http']
        }

        return {types: types};
    },

    verificationInfo: async (ctx, next) => {
        const {id} = ctx.request.params;
        const {type} = ctx.request.query;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {populate: '*'});

        if (user.username !== entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        if (entity.certificate_type.type === "Let's Encrypt") {
            if (client == null) {
                const acmeUser = await strapi.entityService.findOne('api::acme-user.acme-user', 1);
                const initObject = await initAcme(acmeUser);
                await strapi.entityService.update('api::acme-user.acme-user', 1, {
                    data: {
                        privateKey: initObject.key,
                        url: initObject.accountUrl
                    }
                });
            }
            const {authorization, challenge, keyAuthorization} = await getAcmeAuthOrderData(entity.acme_order.order, type);
            const result = await challengeAcmeCreateFn(authorization, challenge, keyAuthorization);
            return result;
        } else {
            return {message: 'Error', description: "Server can't create this type of certificate"};
        }
    },

    download: async (ctx, next) => {
        const {id} = ctx.request.params;
        const user = ctx.state.user;

        const entity = await strapi.entityService.findOne('api::certificate.certificate', id, {populate: '*'});

        if (user.username !== entity.user.username) {
            return {message: 'Error', description: 'Invalid user'};
        }

        if (entity.certificate_type.type === "Let's Encrypt") {
            const stream = require('stream');

            ctx.set('Content-Type', 'application/zip');
            const passThrough = new stream.PassThrough();
            ctx.body = passThrough;

            await zipCertificate(entity.id, entity.domain, entity.acme_order.csr, entity.acme_order.privateKey, entity.acme_order.certificate, passThrough);
            // return {csr: entity.acme_order.csr, privateKey: entity.acme_order.privateKey, certificate: entity.acme_order.certificate};
        } else {
            return {message: 'Error', description: "Server can't create this type of certificate"};
        }
    },
}));

async function zipCertificate(id, domain, csr, privateKey, certificate, body) {
    const archiver = require('archiver');

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });
    archive.on('error', function(err) {
        throw err;
    });

    archive.pipe(body);
    archive.append(csr.toString(), { name: `${domain}.csr` });
    archive.append(privateKey.toString(), { name: `${domain}.key` });
    archive.append(certificate.toString(), { name: `${domain}.cer` });
    await archive.finalize();
}

async function challengeAcmeCreateFn(authorizations, challenge, keyAuthorization) {
    if (challenge.type == 'http-01') {
        const filePath = `/var/www/html/.well-known/acme-challenge/${challenge.token}`;
        const fileContents = keyAuthorization;
        console.log(`Creating challenge response for ${authorizations.identifier.value} at path: ${filePath}`);
        /* Replace this */
        console.log(`Would write "${fileContents}" to path "${filePath}"`);
        return {place: filePath, data: fileContents};
        // await fs.writeFileAsync(filePath, fileContents);
    } else if (challenge.type == 'dns-01') {
        const dnsRecord = `_acme-challenge.${authorizations.identifier.value}`;
        const recordValue = keyAuthorization;
        console.log(`Creating TXT record for ${authorizations.identifier.value}: ${dnsRecord}`);
        /* Replace this */
        console.log(`Would create TXT record "${dnsRecord}" with value "${recordValue}"`);
        return {place: dnsRecord, data: recordValue};
        // await dnsProvider.createRecord(dnsRecord, 'TXT', recordValue);
    }
}

async function challengeAcmeRemoveFn(authz, challenge, keyAuthorization) {
    if (challenge.type == 'http-01') {
        const filePath = `/var/www/html/.well-known/acme-challenge/${challenge.token}`;
        console.log(`Removing challenge response for ${authz.identifier.value} at path: ${filePath}`);
        /* Replace this */
        console.log(`Would remove file on path "${filePath}"`);
        // await fs.unlinkAsync(filePath);
    } else if (challenge.type == 'dns-01') {
        const dnsRecord = `_acme-challenge.${authz.identifier.value}`;
        const recordValue = keyAuthorization;
        console.log(`Removing TXT record for ${authz.identifier.value}: ${dnsRecord}`);
        /* Replace this */
        console.log(`Would remove TXT record "${dnsRecord}" with value "${recordValue}"`);
        // await dnsProvider.removeRecord(dnsRecord, 'TXT');
    }
}

async function getAcmeAuthOrderData(order, type) {
    const authorizations = await client.getAuthorizations(order);
    let challenge;
    let index;
    for (let i = 0; i < authorizations.length; i++) {
        const challenges = authorizations[i].challenges;
        for (let j = 0; j < challenges.length; j++) {
            if (challenges[j].type === `${type}-01`) {
                challenge = challenges[j];
                index = i;
                break;
            }
        }
    }
    console.log(authorizations);
    console.log(challenge);
    const keyAuthorization = await client.getChallengeKeyAuthorization(challenge);
    return {authorization: authorizations[index], challenge: challenge, keyAuthorization: keyAuthorization}
}

async function generateAcmeCertificate(domain) {
    try {
        const order = await client.createOrder({
            identifiers: [
                {type: 'dns', value: domain},
                // {type: 'dns', value: '*.' + domain}
            ]
        });
        const {authorization, challenge, keyAuthorization} = await getAcmeAuthOrderData(order, 'dns');
        const result = await challengeAcmeCreateFn(authorization, challenge, keyAuthorization);
        return {acmeOrder: order, result: result};
    } catch (e) {
        console.log(e);
    }
}

async function verifyAcmeOrder(domain, order, type) {
    try {
        const {authorization, challenge, keyAuthorization} = await getAcmeAuthOrderData(order, type);

        console.log('Satisfy challenge');
        await challengeAcmeCreateFn(authorization, challenge, keyAuthorization);

        console.log('Verify that challenge is satisfied');
        await client.verifyChallenge(authorization, challenge);

        console.log('Notify ACME provider that challenge is satisfied');
        await client.completeChallenge(challenge);

        console.log('Wait for ACME provider to respond with valid status');
        await client.waitForValidStatus(challenge);

        console.log('Wait for order status');
        await client.waitForValidStatus(order);

        console.log('Finalize order');
        const [key, csr] = await acme.forge.createCsr({
            commonName: /* '*.' + */ domain,
            // altNames: [domain]
        });

        const result = await client.getOrder(order);
        const finalized = await client.finalizeOrder(result, csr);
        const cert = await client.getCertificate(finalized);

        console.log(`CSR:\n${csr.toString()}`);
        console.log(`Private key:\n${key.toString()}`);
        console.log(`Certificate:\n${cert.toString()}`);
        return {csr: csr.toString(), privateKey: key.toString(), certificate: cert.toString()};
    } catch (e) {
        console.log(e);
    }
}

async function initAcme(user) {
    let key = null;
    let accountUrl = null;
    try {
        if (user.privateKey == '') user.privateKey = null;
        if (user.url == '') user.url = null;
        key = user.privateKey !== null ? Buffer.from(user.privateKey) : await acme.forge.createPrivateKey();
        client = new acme.Client({
            directoryUrl: acme.directory.letsencrypt.staging,
            accountKey: key,
            accountUrl: user.url
        });
        try {
            accountUrl = client.getAccountUrl();
        }
        catch (error) {
            await client.createAccount({
                termsOfServiceAgreed: true,
                contact: [`mailto:${user.email}`]
            });
            accountUrl = client.getAccountUrl();
        }
        return {key: key.toString(), accountUrl: accountUrl};
    } catch (error) {
        console.log(error);
    }
}
