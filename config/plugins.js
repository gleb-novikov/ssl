module.exports = ({ env }) => {
  return {
    email: {
      config: {
        provider: 'nodemailer',
        providerOptions: {
          host: 'smtp.yandex.ru',
          port: 465,
          secure: true,
          auth: {
            user: env('SMTP_USERNAME'),
            pass: env('SMTP_PASSWORD'),
          },
        },
        settings: {
          defaultFrom: env('SMTP_USERNAME'),
          defaultReplyTo: env('SMTP_USERNAME'),
        },
      },
    },
  }
};
