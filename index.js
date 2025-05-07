const inquirer = require('inquirer');
const { Client } = require('pg');
const logo = require('asciiart-logo');
const consoleTable = require('console.table');

// Database configuration
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'employee_db',
  password: 'Vader24',
  port: 5432,
});

// Connect to database
client.connect().catch((err) => {
  console.error('Error connecting to the database:', err);
  process.exit(1);
});


const viewDepartments = async () => {
  try {
    const res = await client.query('SELECT id AS "Department ID", name AS "Department Name" FROM departments ORDER BY id');
    console.log('\n');
    console.table(res.rows);
    await mainMenu();
  } catch (err) {
    console.error('Error viewing departments:', err);
    mainMenu();
  }
};

const viewRoles = async () => {
  try {
    const res = await client.query(`
      SELECT r.id AS "Role ID", 
             r.title AS "Job Title", 
             d.name AS "Department", 
             r.salary AS "Salary"
      FROM roles r
      JOIN departments d ON r.department_id = d.id
      ORDER BY r.id
    `);
    console.log('\n');
    console.table(res.rows);
    await mainMenu();
  } catch (err) {
    console.error('Error viewing roles:', err);
    mainMenu();
  }
};

const viewEmployees = async () => {
  try {
    const res = await client.query(`
      SELECT e.id AS "Employee ID",
             e.first_name AS "First Name", 
             e.last_name AS "Last Name",
             r.title AS "Job Title",
             d.name AS "Department",
             r.salary AS "Salary",
             CONCAT(m.first_name, ' ', m.last_name) AS "Manager"
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      JOIN departments d ON r.department_id = d.id
      LEFT JOIN employees m ON e.manager_id = m.id
      ORDER BY e.id
    `);
    console.log('\n');
    console.table(res.rows);
    await mainMenu();
  } catch (err) {
    console.error('Error viewing employees:', err);
    mainMenu();
  }
};

const addDepartment = async () => {
  try {
    const { name } = await inquirer.prompt({
      type: 'input',
      name: 'name',
      message: 'Enter the name of the new department:',
      validate: input => input.trim() ? true : 'Department name cannot be empty'
    });

    await client.query('INSERT INTO departments (name) VALUES ($1)', [name]);
    console.log(`\nDepartment "${name}" added successfully!\n`);
    await viewDepartments();
  } catch (err) {
    console.error('Error adding department:', err);
    mainMenu();
  }
};

const addRole = async () => {
  try {
    const departments = await client.query('SELECT id, name FROM departments ORDER BY name');
    
    const { title, salary, departmentId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Enter the title of the new role:',
        validate: input => input.trim() ? true : 'Role title cannot be empty'
      },
      {
        type: 'input',
        name: 'salary',
        message: 'Enter the salary for this role:',
        validate: input => !isNaN(parseFloat(input)) ? true : 'Please enter a valid number'
      },
      {
        type: 'list',
        name: 'departmentId',
        message: 'Select the department for this role:',
        choices: departments.rows.map(dept => ({
          name: dept.name,
          value: dept.id
        }))
      }
    ]);

    await client.query(
      'INSERT INTO roles (title, salary, department_id) VALUES ($1, $2, $3)',
      [title, parseFloat(salary), departmentId]
    );
    console.log(`\nRole "${title}" added successfully!\n`);
    await viewRoles();
  } catch (err) {
    console.error('Error adding role:', err);
    mainMenu();
  }
};

const addEmployee = async () => {
  try {
    const roles = await client.query('SELECT id, title FROM roles ORDER BY title');
    const managers = await client.query(`
      SELECT id, first_name, last_name FROM employees ORDER BY last_name, first_name
    `);

    const { firstName, lastName, roleId, managerId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'firstName',
        message: "Enter the employee's first name:",
        validate: input => input.trim() ? true : 'First name cannot be empty'
      },
      {
        type: 'input',
        name: 'lastName',
        message: "Enter the employee's last name:",
        validate: input => input.trim() ? true : 'Last name cannot be empty'
      },
      {
        type: 'list',
        name: 'roleId',
        message: "Select the employee's role:",
        choices: roles.rows.map(role => ({
          name: role.title,
          value: role.id
        }))
      },
      {
        type: 'list',
        name: 'managerId',
        message: "Select the employee's manager:",
        choices: [
          { name: 'None', value: null },
          ...managers.rows.map(manager => ({
            name: `${manager.first_name} ${manager.last_name}`,
            value: manager.id
          }))
        ]
      }
    ]);

    await client.query(
      'INSERT INTO employees (first_name, last_name, role_id, manager_id) VALUES ($1, $2, $3, $4)',
      [firstName, lastName, roleId, managerId]
    );
    console.log(`\nEmployee ${firstName} ${lastName} added successfully!\n`);
    await viewEmployees();
  } catch (err) {
    console.error('Error adding employee:', err);
    mainMenu();
  }
};

const updateEmployeeRole = async () => {
  try {
    const employees = await client.query(`
      SELECT e.id, e.first_name, e.last_name, r.title 
      FROM employees e
      JOIN roles r ON e.role_id = r.id
      ORDER BY e.last_name, e.first_name
    `);
    const roles = await client.query('SELECT id, title FROM roles ORDER BY title');

    const { employeeId, roleId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'employeeId',
        message: "Select the employee to update:",
        choices: employees.rows.map(emp => ({
          name: `${emp.first_name} ${emp.last_name} (Current: ${emp.title})`,
          value: emp.id
        }))
      },
      {
        type: 'list',
        name: 'roleId',
        message: "Select the new role:",
        choices: roles.rows.map(role => ({
          name: role.title,
          value: role.id
        }))
      }
    ]);

    await client.query(
      'UPDATE employees SET role_id = $1 WHERE id = $2',
      [roleId, employeeId]
    );
    console.log('\nEmployee role updated successfully!\n');
    await viewEmployees();
  } catch (err) {
    console.error('Error updating employee role:', err);
    mainMenu();
  }
};

const mainMenu = async () => {
  try {
    const { action } = await inquirer.prompt({
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        'View All Departments',
        'View All Roles',
        'View All Employees',
        'Add a Department',
        'Add a Role',
        'Add an Employee',
        'Update an Employee Role',
        'Exit'
      ],
    });

    switch (action) {
      case 'View All Departments':
        await viewDepartments();
        break;
      case 'View All Roles':
        await viewRoles();
        break;
      case 'View All Employees':
        await viewEmployees();
        break;
      case 'Add a Department':
        await addDepartment();
        break;
      case 'Add a Role':
        await addRole();
        break;
      case 'Add an Employee':
        await addEmployee();
        break;
      case 'Update an Employee Role':
        await updateEmployeeRole();
        break;
      case 'Exit':
        await client.end();
        console.log('\nGoodbye!\n');
        process.exit(0);
    }
  } catch (err) {
    console.error('Error in main menu:', err);
    mainMenu();
  }
};

// Display application logo
function displayLogo() {
  const logoText = logo({ name: 'Employee Manager' }).render();
  console.log(logoText);
  mainMenu();
}

// Start the application
displayLogo();