const express           = require('express');
const router            = express.Router();
const passport          = require('passport');
const alertNode         = require('alert-node');
const async             = require('async');
const mysql             = require('mysql');
const env               = process.env.NODE_ENV || 'development';
const config            = require('../config/config')[env];
const crypto            = require('crypto');
const expressValidator  = require('express-validator');
const flash             = require('express-flash');
const moment            = require('moment');
const models            = require('../models');
const User              = models.user;
const twoFactor         = require('node-2fa');
const students          = models.student;

/* GET users listing. */
const con = mysql.createConnection({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.db
});

function formatDateForPug(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [month, day, year].join('/');
}

function formatDateForMySQL(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [day, month, year].join('-');
}

function getStudentGender(rows, studentGender){
  if(studentGender === 'M'){
    gender = 'Male';
  } else {
    gender = 'Female';
  }
  return gender;
}

router.get('/students', function(req, res) {
  if (req.isAuthenticated()) {

    var studentList = [];
    // Do the query to get data.
    con.query('SELECT * FROM students', function(err, rows, fields) {
      if (err) {
        res.status(500).json({"status_code": 500,"status_message": "internal server error"});
      } else {
        console.log(rows);

      // Render index.pug page using array 
      res.render('students', {title: 'Student List', data: rows});
      }
    });
  } else {
    res.render('login');
  }
});

router.get('/input', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('input');
  } else {
    res.render('login');
  }
});

router.post('/input', function(req, res) {
  if (req.isAuthenticated()) {
    var insertStudent = {
      student_id: req.body.student_id,
      name: req.body.name,
      address: req.body.address,
      date_of_birth: moment(req.body.date_of_birth).format('YYYY-MM-DD'),
      admission_date: new Date(),
      gender: req.body.gender,
      student_email: req.body.student_email,
    };
   
    //console.log(insertStudent);
    // Do the query to insert data.
    con.query('INSERT INTO students set ? ', insertStudent, function(err, rows, fields) {
      if (err) {
        //res.status(500).json({"status_code": 500,"status_message": "internal server error"});
        console.log(err);
      } else {
        //console.log(rows);
        res.redirect('/students');
      }
    });
  } else {
    res.render('login');
  }
});

router.get('/students/:id', function(req, res) {
  if (req.isAuthenticated()) {
    con.query('SELECT * FROM students WHERE student_id = ?', [req.params.id], function(err, rows, fields) {
      if(err) throw err
      
      // if user not found
      if (rows.length <= 0) {
          res.redirect('/students')
      } else { 
        var studentDoB = moment(rows[0].date_of_birth).format('YYYY-MM-DD');
        console.log(studentDoB);
  
        // if user found
        // render to views/index.pug template file
        res.render('edit', {
          title: 'Edit Student', 
          sid: rows[0].student_id,
          sname: rows[0].name,
          saddress: rows[0].address,
          sgender: rows[0].gender,
          student_email: rows[0].student_email,
          sadmiss: moment(rows[0].admission_date).format('YYYY-MM-DD'),
          sdob: studentDoB
        })
      }            
    });
  } else {
    res.render('login');
  }
});

router.get('/students/delete/:id', function(req, res) {
  if (req.isAuthenticated()) {
    con.query('DELETE FROM students WHERE student_id = ?', [req.params.id], function(err, result) {
      if(err) throw err
      res.redirect('/students');
    });
  } else {
    res.render('login');
  }
});

function transpose(original) {
  var copy = [];
  for (var i = 0; i < original.length; i++) {
      for (var j = 0; j < original[i].length; j++) {
          // skip undefined values to preserve sparse array
          if (original[i][j] === undefined) continue;
          // create row if it doesn't exist yet
          if (copy[j] === undefined) copy[j] = [];
          // swap the x and y coords for the copy
          copy[j][i] = original[i][j];
      }
  }
  return copy;
}

router.get('/statistics/:years', function(req, res) {
  if (req.isAuthenticated()) {
    var getBulan = []; getJml = []; jmlBulan=[]; hasilJmlBulan=[]; getGen = []; getJmlGen = []; jmlGen=[]; hasilJmlGen=[];
    con.query('SELECT month(admission_date) as month, count(*) as frek FROM students WHERE year(admission_date)='+[req.params.years]+' group by month(admission_date)', function(err, rows, fields) {
      if (err) {
        console.log(err)
      } else {
        getBulan.push('month','January', 'February', 'March', 'April', 'Mei', 'June', 'July', 'August', 'September', 'October', 'November', 'December')
        getJml.push('freks',0,0,0,0,0,0,0,0,0,0,0,0)
        for (var j = 0 ; j < rows.length ; j++) {
          var bulan = rows[j].month;
          getJml.fill(rows[j].frek, bulan, (bulan+1));       
        }
        jmlBulan.push(getBulan,getJml)
      }
      var hasilJmlBulan = transpose(jmlBulan);  
      console.log(hasilJmlBulan);
  
      con.query('SELECT gender, count(gender) as jml FROM students GROUP BY gender', function(err, rows, fields) {
        if (err) {
          console.log(err)
        } else {
          getGen.push('gender')
          getJmlGen.push('frek gend')
          for (var j = 0 ; j < rows.length ; j++) {
            if (rows[j].gender === 'F') {
              getGen.push('FEMALE')
            } else {
              getGen.push('MALE')
            }
            getJmlGen.push(rows[j].jml)       
          }
          jmlGen.push(getGen,getJmlGen)
        }
        var hasilJmlGen = transpose(jmlGen);  
        console.log(hasilJmlGen);
        res.render('statistic',{obj1: JSON.stringify(hasilJmlGen), obj2: JSON.stringify(hasilJmlBulan)});
      })  
    })  
  } else {
    res.render('login');
  }
});

router.post('/search', function(req, res) {
  if (req.isAuthenticated()) {
  var studentList = [];
  var keyword = req.body.keyword;
  var kolom = req.body.kolom;
  var sortBy = req.body.sortBy;

  // Do the query to get data.
  con.query('SELECT * FROM students WHERE '+kolom+' LIKE \'%'+ keyword +'%\' ORDER BY '+kolom+' '+sortBy+'', function(err, rows, fields) {
    if (err) {
      res.status(500).json({"status_code": 500,"status_message": "internal server error"});
    } else {
      console.log(rows);

    // Loop check on each row
    for (var i = 0; i < rows.length; i++) {
      var gender = getStudentGender(rows, rows[i].gender);
      var dateOfBirth = moment(rows[i].date_of_birth).format('YYYY-MM-DD');
      var admission_date = moment(rows[i].admission_date).format('YYYY-MM-DD');

      // Create an object to save current row's data
      var students = {
        'student_id':rows[i].student_id,
        'admission_date':admission_date,
        'name':rows[i].name,
        'address':rows[i].address,
        'gender':gender,
        'date_of_birth':dateOfBirth,
        'student_email':rows[i].student_email
      }
      // Add object into array
      studentList.push(students);
    }

    // Render index.pug page using array 
    res.render('students', {title: 'Student List', data: studentList});
    }
  });
  } else {
    res.render('login');
  }
});

router.post('/edit', function(req, res) {
  if (req.isAuthenticated()) {
    var name = req.body.name;
    var address = req.body.address;
    var gender = req.body.gender;
    var date_of_birth = moment(req.body.date_of_birth).format('YYYY-MM-DD');
    var student_email = req.body.student_email;
    var student_id = req.body.oldId;
    console.log(student_id+''+name+' '+address+' '+gender+' '+date_of_birth+''+student_email);

	//var postData  = {student_id: student_id, name: name, address: address, gender: gender, date_of_birth: date_of_birth};

		con.query('UPDATE students SET name = ?, address = ?, student_email =?, gender = ?, date_of_birth = ? WHERE student_id = ?', [name, address,student_email, gender, date_of_birth, student_id], function (error, results, fields) {
			if (error) throw error;
			res.redirect('/students');
	});
  } else {
    res.render('login');
  }
});

router.get('/fstudent', function(req, res) {
  // Render index.pug page using array 
  res.render('student', {title: 'Student'});
});

module.exports = router;
