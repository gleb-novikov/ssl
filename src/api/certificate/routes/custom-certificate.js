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
        {
            method: 'POST',
            path: '/certificates/:id/issue',
            handler: 'certificate.issue'
        },
        {
            method: 'POST',
            path: '/certificates/:id/verification',
            handler: 'certificate.verification'
        },
        {
            method: 'GET',
            path: '/certificates/:id/verification/types',
            handler: 'certificate.verificationTypes'
        },
        {
            method: 'GET',
            path: '/certificates/:id/verification/info',
            handler: 'certificate.verificationInfo'
        },
        {
            method: 'GET',
            path: '/certificates/:id/download',
            handler: 'certificate.download'
        },
    ],
};
