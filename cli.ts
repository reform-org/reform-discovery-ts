import readline from "readline";
import bcrypt from "bcrypt";
import { db } from "./utils/db.js";
import { randomUUID } from "crypto";
import inquirer from "inquirer"

const done = () => {
    process.exit(0);
};

// (async () => {
//     const username = await ask("Please enter a username:");
//     const password = await ask("Please enter a password:");
//     bcrypt.genSalt(10, (err, salt) => {
//         bcrypt.hash(password, salt, (err, hash) => {
//             db.instance.run("INSERT OR REPLACE INTO users (name, uuid, password) VALUES(?, ?, ?)", username, randomUUID(), hash, done);
//         })
//     })
// })()

const programs = ["Add a classic user (username & password)", "Reset a classic users password", "Add a SSO user", "Delete a user", "Show all users"]

const getAllClassicUsers = async () => await db.all("SELECT * FROM users")

const addClassicUser = async () => {
  const existingUsers = await getAllClassicUsers()
  inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "Please enter a username",
      validate: (input) => !existingUsers.find(p => p.name === input) ? true : `user with name ${input} already exists!`
    },
    {
      type: "password",
      name: "password",
      message: "Please enter a password",
      mask: "*"
    },
    {
      type: "password",
      name: "password2",
      message: "Retype the password",
      mask: "*",
      validate: (password, answers) => password === answers.password ? true : "passwords must be the same!"
    }
  ]).then(answers => {
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(answers.password, salt, (err, hash) => {
            db.instance.run("INSERT OR REPLACE INTO users (name, uuid, password) VALUES(?, ?, ?)", answers.username, randomUUID(), hash, () => {
              console.info(`Stored user ${answers.username} successfully.`)
              done()
            });
        })
    })
  })
}

const resetPassword = async () => {
  const existingUsers = await getAllClassicUsers()
  inquirer.prompt([
    {
      type: "input",
      name: "username",
      message: "Please enter a username",
      validate: (input) => !existingUsers.find(p => p.name === input) ? true : `user with name ${input} already exists!`
    },
    {
      type: "password",
      name: "password",
      message: "Please enter a password",
      mask: "*"
    },
    {
      type: "password",
      name: "password2",
      message: "Retype the password",
      mask: "*",
      validate: (password, answers) => password === answers.password ? true : "passwords must be the same!"
    }
  ]).then(answers => {
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(answers.password, salt, (err, hash) => {
            db.instance.run("INSERT OR REPLACE INTO users (name, uuid, password) VALUES(?, ?, ?)", answers.username, randomUUID(), hash, () => {
              console.info(`Stored user ${answers.username} successfully.`)
              done()
            });
        })
    })
  })
}

inquirer
  .prompt([
    {
      type: "list",
      name: "program",
      message: "What do you want to do?",
      choices: programs
    },
  ])
  .then(async answers => {
    db.init();

    const program = programs.indexOf(answers.program)
    switch(program) {
      case 0: await addClassicUser()
      case 1: await resetPassword()
    }
  });