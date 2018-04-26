module.exports = function(sequelize, Sequelize) {
    var student = sequelize.define('students', {
        student_id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        admission_date: {
            type: Sequelize.DATE,
            allowNull: true
        },
        name: {
            type: Sequelize.STRING
        },
        address: {
            type: Sequelize.STRING
        },
        gender: {
            type: Sequelize.ENUM('F','M')
        },
        date_of_birth: {
            type: Sequelize.DATE
        },
        student_email:{ 
            type: Sequelize.STRING
        }
    });
    return student;
}