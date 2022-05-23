module.exports = (strapi) => {
  return {
    initialize() {
      strapi.app.use(async (ctx, next) => {
        console.log("I have been called!");
        await next();
      });
    },
  };
};
