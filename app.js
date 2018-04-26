const createError       = require('http-errors');
const express           = require('express');
const path              = require('path');
const alertNode         = require('alert-node');
const crypto            = require('crypto');
const favicon           = require('serve-favicon');
const async             = require('async');
const cookieParser      = require('cookie-parser');
const logger            = require('morgan');
const models            = require('./models');
const env               = process.env.NODE_ENV || 'development';
const config            = require('./config/config')[env];
const app               = express();
const passport          = require('passport');
const passportLocal     = require('passport-local').Strategy;
const session           = require('express-session');
const bodyParser        = require('body-parser');
const expressValidator  = require('express-validator');
const BetterMemoryStore = require('session-memory-store')(session);
const Store             = require('express-session').Store;
const store             = new BetterMemoryStore({ expires: 60 * 60 * 1000, debug: true });
const flash             = require('express-flash');
const auth              = require('./routes/auth');
const users              = require('./routes/users');
const nodemailer        = require('nodemailer');
const moment            = require('moment');
app.locals.moment       = require('moment');
const index             = require('./routes/index');
const user              = models.user;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressValidator());
app.use(session( {
  name: 'JSESSION',
  secret: 'MYSECRETISVERYSECRET',
  store: store,
  resave: true,
  saveUninitialized: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

models.sequelize.sync().then(function() {
  console.log('Nice! Database looks fine')
}).catch(function(err) {
  console.log(err, "Something went wrong..")
});

// user.findAll().then( user => {
//   console.log(user)
// })

passport.use('local', new passportLocal( {
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true 
}, function (req, username, password, done, err) {
  if (!username || !password) {
    alertNode('All fields are required.');
    return done(null, false);
  }
  user.findOne({
    where: {
      username: [username]
    }
  }).then(function(user) {
    if(!user) {
      alertNode('Invalid username or password');
    } 
    var salt = "7fa73b47df808d36c5fe328546ddef8b9011b2c6"+''+password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');
    var dbPassword = user.password;
    if (!(dbPassword == encPassword)) {
      alertNode('Invalid username or password.');
      return done (null, false);
    }
    var userinfo = user.get();
    return done (null, userinfo);
  }).catch(function(err) {
    console.log('Error:', err);
  });
}));

passport.use('local-register', new passportLocal( {           
    usernameField : 'username',
    passwordField : 'password',
    passReqToCallback : true // allows us to pass back the entire request to the callback
},
function(req, username, password, done) {     
    var salt = "7fa73b47df808d36c5fe328546ddef8b9011b2c6"+''+password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');
    var email = req.body.email;
    user.findOne({where: {email:email,username:username}}).then(function(User) {
      if(User) {
        return done(null, false, {message : 'That email is already taken'} );
      }
      else {
        var data = {
          email:email,
          password:encPassword,
          username: req.body.username
        };
        user.create(data).then(function(newUser,created) {
          if(!newUser) {
            return done(null,false);
          }
          else {
            return done(null,newUser);
          }
        });
      }
    }); 
  }
));

passport.serializeUser(function(user, done) {
  done (null, user.id);
});

passport.deserializeUser(function(id, done) {
  user.findOne({where:{id:id}}).then(function(user) {
    if(user) {
      done(null, user.get());
    } else {
      done(user.errors, null);
    }
  });
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/login');
}

app.use('/', auth);
app.use('/', isAuthenticated, index);
app.use('/', isAuthenticated, users);
// app.use('/register', isAuthenticated, register);
// app.use('/filter', isAuthenticated, students_filter);
// app.use('/users', isAuthenticated, users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
