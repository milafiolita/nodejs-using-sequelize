const express           = require('express');
const router            = express.Router();
const passport          = require('passport');
const alertNode         = require('alert-node');
const async             = require('async');
const env               = process.env.NODE_ENV || 'development';
const config            = require('../config/config')[env];
const crypto            = require('crypto');
const expressValidator  = require('express-validator');
const flash             = require('express-flash');
const moment            = require('moment');
const models            = require('../models');
const User              = models.user;
const twoFactor         = require('node-2fa');
const users             = models.user;
const nodemailer        = require('nodemailer');
const transporter       = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.auth.user,
    pass: config.auth.pass
  }
});

router.get('/login', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('login');
  }
});

router.get('/logout', function (req, res) {
  if(!req.isAuthenticated()) {
     notFound404(req, res, next);
  } else {
     req.logout();
     res.redirect('/login');
  }
})

router.get('/signin', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    console.log(req.query.username)
    if (err) { return next(err); }
    if (!user) { return res.redirect('/login'); }
    users.findAll({
      where: {
        username: req.query.username
      }
    }).then(function(rows) {
      console.log(rows[0].two_fa)
      if (rows[0].two_fa == 'disable') {
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          req.flash('info', 'Hi ' + req.user.username + ', You successfully logged in')  
          return res.redirect('/' );
        });
      } else {
        req.flash('username',req.query.username)
        res.redirect('/two_fa/')
      }
    })
  })(req, res, next);
});

router.get('/two_fa/', function(req, res) {
  // console.log('username ',req.params.username )
   var f = req.flash('username');
   console.log(f.toString())
   res.render('two_fa', {susername: f.toString()})
 })
 
 router.post('/two_fa/', function(req, res) {
   console.log(req.body.username)
   users.findAll({
     where: {
       username: [req.body.username]
     }
   }).then(function(rows) {
     var verifytoken = twoFactor.verifyToken(rows[0].secretkey, req.body.token);
     console.log(req.body.token)
     var newToken = twoFactor.generateToken(rows[0].secretkey)
     console.log(newToken)
     if (verifytoken !== null) {
       users.findOne({
         where: {
           username: [req.body.username]
         },
         attributes: ['id', 'username', 'password']
       }).then(user => 
         req.login(user, function (err) {
           if (err) {
             req.flash('error', err.message);
             console.log('user',user)
             return res.redirect('back');
           }
           console.log('Logged user in using Passport req.login()');
           console.log('username',req.user.username);
           req.flash('info', 'Hi '+req.user.username+', you successfully logged in')
           res.redirect('/')
         })
       ) 
     } else {
       req.flash('failed','wrong token, try again !')
       res.render('two_fa',{'error': req.flash('failed'),stoken: req.body.token, susername: req.body.username})
     }
   }).catch(error => {
     req.flash('failed','wrong token, try again !')
     res.render('two_fa',{'error': req.flash('failed'),stoken: req.body.token, susername: req.body.username})
   })
 })

router.get('/register', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('register');
  }
});

router.post('/register', passport.authenticate('local-register', {
  successRedirect : '/',
  failureRedirect : '/register',
  failureFlash : true
}), function(req, res, info) {
  res.render('register', {'message' : req.flash('message')});
});

router.get('/forgot', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('forgot');
  }
});

router.post('/forgot', function(req, res, next) {
  req.assert("email", "Enter a valid email address.").isEmail()
  var errors = req.validationErrors();
  if (errors) {
    var error_message = '';
    errors.forEach(function (error) {
      error_message += error.msg + '\n'
    })
    req.flash('error', error_message);
    res.render('forgot');
  } else {
    async.waterfall([
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);
        });
      },
      function(token, done) {
        User.findOne({
          where: {
            email: req.body.email
          }
        }).then(function(user, err) {
          if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot');
          } else {
            var pwdExp = new moment().add(10, 'm').toDate();
            User.update({
              reset_pwd_token: token,
              reset_pwd_exp: pwdExp
            }, {
              where: {
                email: req.body.email
              }
            }).then(function(user, err) {
              done(err, token, user);
            });
          }
        });
      },
      function(token, user, done) {
        const msg = {
          to: [req.body.email],
          from: 'milafiolita01@gmail.com',
          subject: 'Password Reset',
          text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://localhost:3000/reset/'+ token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n',
        };
        transporter.sendMail(msg, function(err) {
          req.flash('info', 'An email has been sent to ' + req.body.email + ' with further instructions.');
          done(err, done);
        });
      }
    ], function(err) {
      if (err) return next(err);
      res.redirect('/forgot');
    });
  }
});

router.get('/reset/:token', function(req, res){
  User.findOne({where:{reset_pwd_token:req.params.token}}).then(function(user, err) {
    if(err) throw err
    
    // if user not found
    if (!user) {
        res.redirect('/login')
    } else { 
      // if user found
      // render to views/index.pug template file
      res.render('reset', {
        title: 'Edit User', 
        uid: user.id
      })
    }            
  });
});

router.post('/reset_password', function(req, res) {
  var password = req.body.password;
  var konfirm = req.body.konfirm;
  var id = req.body.id;
  
  if (password == konfirm) {
    var salt = '7fa73b47df808d36c5fe328546ddef8b9011b2c6'+"" + password;
    var newPassword = crypto.createHash("sha1").update(salt).digest("hex");
    User.update({password:newPassword,reset_pwd_token:null},{where:{id:id}}).then(function(user, err) {
      if (err) throw err;
      res.redirect('/login');
    });
  }
});

//=======================================================================================================

router.get('/setting', function(req, res) {
  users.findAll({
    where: {
      username: [req.user.username]
    }
  }).then(function(rows) {
    res.render('setting', {stwo_fa: rows[0].two_fa})
  })
})

router.post('/setting', function(req, res) {
  console.log(req.body.two_fa)
  if (req.body.two_fa == 'disable') {
    users.update({
      two_fa: 'disable'
    }, {where: {
      username: [req.user.username]
    }}).then(function(rows) {
      req.flash('success','Two-factor authenticated is disabled')
      res.render('setting', {stwo_fa: req.body.two_fa, 'valid': req.flash('success')})
    })
  } else if (req.body.two_fa == 'enable') {
    users.findAll({
      where: {
        username: [req.user.username]
      }
    }).then(function(rows) {
      if (rows[0].two_fa == 'enable') {
        var newToken = twoFactor.generateToken(rows[0].secretkey)
        console.log(newToken)
        var newSecret = rows[0].secretkey
        req.flash('code',newSecret)
        res.render('setting', {'enable' : req.flash('code'),ssrc: rows[0].url_qr, stwo_fa: req.body.two_fa})
      } else {
        var nsecret = twoFactor.generateSecret({name: 'Student system', account: req.user.username});
        var newToken = twoFactor.generateToken(nsecret.secret)
        console.log(newToken)
        users.update({
          secretkey: nsecret.secret,
          url_qr: nsecret.qr
        }, {where: {
          username: [req.user.username]
        }}).then(function(rows) {
          users.findAll({
            where: {
              username: [req.user.username],
            }
          }).then(function(rows) {
            var newSecret = rows[0].secretkey
            req.flash('code',newSecret)
            res.render('setting', {'enable' : req.flash('code'),ssrc: nsecret.qr, stwo_fa: req.body.two_fa})
          })
        })
      }
    })     
  }
})

router.get('/settingGenerate/',function(req, res) {
  users.findAll({
    where: {
      username: req.user.username
    }
  }).then(function(rows) {
    var verifytoken = twoFactor.verifyToken(rows[0].secretkey, req.query.token);
    console.log(req.query.token)
    if (verifytoken !== null) {
        req.flash('valid','valid token')
        req.flash('code',rows[0].secretkey)
        res.render('setting',{'valid': req.flash('valid'), stwo_fa: 'enable', 'enable': req.flash('code'),ssrc: rows[0].url_qr, stoken: req.query.token})
    } else {
      req.flash('failed','wrong token, try again !')
      req.flash('code',rows[0].secretkey)
      res.render('setting',{'failed': req.flash('failed'), stwo_fa: 'disable', 'enable': req.flash('code'),ssrc: rows[0].url_qr, stoken: req.query.token})
    }
    console.log(twoFactor.verifyToken(rows[0].secretkey, req.query.token));
  })
})

router.post('/settingConfirm', function(req,res) {
  users.update({
    two_fa: 'enable'
  }, { where: {
    username: req.user.username
  }}).then(function(rows) {
    req.flash('success', 'Two-factor authentication is enabled')
    res.render('setting',{'valid': req.flash('success'), stwo_fa: 'enable'})
  })
})

module.exports = router;