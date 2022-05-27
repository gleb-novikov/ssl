var Greenlock = require('../../../../../node_modules/@root/greenlock');
var pkg = require('../../../../../package.json');

var greenlock = Greenlock.create({
	packageRoot: __dirname,
	configDir: "./greenlock.d/",
	packageAgent: pkg.name + '/' + pkg.version,
	maintainerEmail: 'glebneko@yandex.ru',
	staging: true,
	notify: function(event, details) {
		if ('error' === event) {
			// `details` is an error object in this case
			console.error(details);
		}
	}
});

greenlock.manager
	 .defaults({
		 agreeToTerms: true,
		 subscriberEmail: 'glebneko@yandex.ru'
	 })
	 .then(function(fullConfig) {
		
	});

module.exports = {
	async afterCreate(event) {
		const { result } = event;

		// try {
		// 	var altnames = [result.domain, 'www.' + result.domain];
		// 	greenlock
		// 		.add({
		// 			subject: altnames[0],
		// 			altnames: altnames
		// 		})
		// 		.then(function() {
		// 			// saved config to db (or file system)
		// 		});			
		// } catch (error) {
		// 	console.log(error);
		// }


		// try {
		// 	var attachments = [];
		// 	if (result.files != null) {
		// 		attachments = result.files.map(item => {return {path: strapi.config.get('server.url') + item.url}});
		// 	} else if (result.files_url != null) {
		// 		attachments = result.files_url.map(item => {return {path: strapi.config.get('server.url') + item}})
		// 	}

		// 	const entry = await strapi.entityService.findOne('api::email-setting.email-setting', 1);
		// 	if (entry.email != null && entry.email.length > 0) {
		// 		await strapi
		// 			.plugin('email-designer')
		// 			.service('email')
		// 			.sendTemplatedEmail(
		// 				{
		// 					to: entry.email,
		// 					attachments: attachments
		// 				},
		// 				{
		// 					templateReferenceId: 1
		// 				},
		// 				{
		// 					type: result.type,
		// 					sex: result.sex,
		// 					comment: result.comment,
		// 					email: result.email,
		// 					time: result.time,
		// 					text: result.text
		// 				}
		// 		);
		// 		if (result.email != null) {
		// 			await strapi
		// 				.plugin('email-designer')
		// 				.service('email')
		// 				.sendTemplatedEmail(
		// 					{
		// 						to: result.email
		// 					},
		// 					{
		// 						templateReferenceId: 2
		// 					},
		// 					{
		// 						type: result.type,
		// 						sex: result.sex,
		// 						comment: result.comment,
		// 						email: result.email,
		// 						time: result.time,
		// 						text: result.text
		// 					}
		// 			);
		// 		}
		// }
		// } catch (err) {
		// 	console.log(err);
		// }
	}
}