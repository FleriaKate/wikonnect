const Router = require('koa-router');
const User = require('../models/user');
const validateAuthRoutes = require('../middleware/validation/validateAuthRoutes');
const bcrypt = require('bcrypt');
const getUserByUsername = require('../middleware/authenticate');
const permController = require('../middleware/permController');
const jwt = require('../middleware/jwt');

const environment = process.env.NODE_ENV || 'development';
const config = require('../knexfile.js')[environment];
const knex = require('knex')(config);

const router = new Router({
  prefix: '/users'
});


async function returnType(parent) {
  if (parent.length == undefined) {
    parent.achievement_awards.forEach(lesson => {
      return lesson.type = 'achievement_awards';
    });
  } else {
    parent.forEach(mod => {
      mod.achievement_awards.forEach(lesson => {
        return lesson.type = 'achievement_awards';
      });
    });
  }
}

/**
 *
 * @param {ctx.request.body.user} ctx
 * @param {*} next
 *
 * delete password in the ctx
 * return hashed password
 */
async function createPasswordHash(ctx, next) {
  if (ctx.request.body.user.password) {
    const hash = await bcrypt.hash(ctx.request.body.user.password, 10);

    delete ctx.request.body.user.password;
    ctx.request.body.user.hash = hash;
  }
  await next();
}

router.post('/', validateAuthRoutes.validateNewUser, getUserByUsername, createPasswordHash, async ctx => {

  ctx.request.body.user.username = ctx.request.body.user.username.toLowerCase();
  ctx.request.body.user.email = ctx.request.body.user.email.toLowerCase();

  let newUser = ctx.request.body.user;

  const user = await User.query().insertAndFetch(newUser);
  console.log(user.email);


  ctx.assert(user, 401, 'Something went wrong.');

  ctx.status = 201;
  ctx.body = { user };
});

router.get('/:id', permController.requireAuth, permController.grantAccess('readOwn', 'profile'),  async ctx => {
  const user = await User.query().findById(ctx.params.id).eager('achievement_awards(selectBadgeNameAndId)');
  returnType(user);


  if (!user) {
    ctx.throw(404, 'No User With that Id');
  }

  // get all verification data
  const userVerification = await knex('user_verification').where({ 'user_id': ctx.params.id });
  user.userVerification = userVerification;

  ctx.status = 200;
  ctx.body = { user };

});
router.get('/', permController.requireAuth, permController.grantAccess('readAny', 'profile'), async ctx => {
  let user = User.query();

  if (ctx.query.username) {
    user.where('username', ctx.query.username);
    ctx.assert(user, 404, 'No User With that username');
  }

  user = await user.eager('achievement_awards(selectBadgeNameAndId)');
  returnType(user);

  ctx.body = { user };
});

router.put('/:id', jwt.authenticate, permController.grantAccess('updateOwn', 'profile'), async ctx => {

  const user = await User.query().patchAndFetchById(ctx.params.id, ctx.request.body.user);

  ctx.assert(user, 404, 'That user does not exist.');

  ctx.status = 200;
  ctx.body = { user };

});

module.exports = router.routes();