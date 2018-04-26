module.exports = function(sequelize, Sequelize) {
    var User = sequelize.define('user', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        username: {
            type: Sequelize.STRING,
            notEmpty: true
        },
        email: {
            type: Sequelize.STRING,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: Sequelize.STRING,
            allowNull: true
        },
        reset_pwd_token: {
            type: Sequelize.STRING
        },
        reset_pwd_exp: {
            type: Sequelize.DATE
        },
        status:{ 
            type: Sequelize.STRING
        },
        secretkey:{
            type : Sequelize.STRING
        },
        two_fa: {
            type: Sequelize.ENUM('enable','disable')
        },
        url_qrl: {
            type : Sequelize.STRING
        }
    });
    return User;
}