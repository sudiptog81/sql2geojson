:: Get User Input
SET /P DB_DRIVER=Database Type (postgres or mysql): 
SET /P DB_USER=Database User Username: 
SET /P DB_PASSWORD=Database User Password: 
SET /P DB_HOST=Database Server Hostname: 
SET /P DB_PORT=Database Server Port: 
SET /P DB_NAME=Database Name: 
:: Set Environment Variables (Normal)
SET "NODE_ENV=production"
SET "DB_DRIVER=%DB_DRIVER%"
SET "DB_USER=%DB_USER%"
SET "DB_PASSWORD=%DB_PASSWORD%"
SET "DB_HOST=%DB_HOST%"
SET "DB_PORT=%DB_PORT%"
SET "DB_NAME=%DB_NAME%"
npm start
    