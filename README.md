# SQL2GeoJSON API Server

> NodeJS server for serving GeoJSON from Postgres or MySQL spatial tables.

Example Deployment on [Heroku](https://sql2geojson.herokuapp.com/example)

## Quick Start

### Configuration

**You must have NodeJS installed on your system.**

Change the values of the following variables in `server.js` to match that of your server configuration.

```js
const DB = "mysql"; // database driver allowed: postgres, mysql
const DBUser = "root"; // database user username
const DBPass = "test1234"; // database user password
const DBHost = "localhost"; // database server hostname
const DBPort = "3306"; // database server port (eg 5432 for postgres, 3306 for mysql)
const DBName = "db_sql2geojson"; // database containing spatial tables
```

In case you have a connection string for a remote server, you can set the environment variables DATABASE_URL (in case of Postgres) and/or JAWSDB_URL (in case of MySQL) to match your connection string.

```bash
# On Windows
set "DATABASE_URL=postgres://user:password@host:port/db_name" # postgres
set "JAWSDB_URL=mysql://user:password@host:port/db_name" # mysql

# On *nix based OS
DATABASE_URL=postgres://user:password@host:port/db_name # postgres
JAWSDB_URL=mysql://user:password@host:port/db_name # mysql
```

**You should ideally have PostgreSQL v9.4+ or MySQL v5.7+** as the queries used use certain functions such as `jsonb_build_object()` and `jsonb_agg()` for Postgres and `JSON_OBJECT()` and `JSON_ARRAYAGG()` for MySQL.

### Running the app

Clone this repository and execute `run.bat` on Windows otherwise `npm start` should work on any platform with NodeJS and npm instaleed.

```bash
> npm start

Server listening on port 5000 # port can be changed on line 144 of server.js
```

For a working example, import the inscluded ESRI shapefiles into your geodatabase.

_Note: Postgres uses **geom** as the geometry column while MySQL seems to use **shape** column for the same. If you have your spatial data on **geom** in a MySQL database, do the following edit in `server.js`_

```js
// Line 115
    ...
    // Change shape to your spatial column (eg geom)
    'geometry', ST_AsGeoJSON(shape),
    ...
```

## Author

### Sudipto Ghosh

Portfolio: [sudipto.ghosh.pro](https://sudipto.ghosh.pro)

This app is provided under the MIT License.
