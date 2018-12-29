# SQL2GeoJSON API Server

> NodeJS server for serving GeoJSON from Postgres or MySQL spatial tables.

Example Deployment on [Heroku](https://sql2geojson.herokuapp.com/example)

## Quick Start

### Configuration

**You must have NodeJS installed on your system.**

**You should ideally have PostgreSQL v9.4+ or MySQL v5.7+** as the queries used use certain functions such as `jsonb_build_object()` and `jsonb_agg()` for Postgres and `JSON_OBJECT()` and `JSON_ARRAYAGG()` for MySQL.

### Running the app

Clone this repository and execute `run.bat` on Windows or `node server.js` on any other platform.

The application should prompt you for supplying certain values in the terminal. They are as follows:

```bash
> node server.js

Database? "postgres" # postgres OR mysql
DB User? "root" # database user username
DB Password? "xxxxxxx" # database user password
DB Host? "localhost" # database server address
DB Port? "5432" # database server port (eg 5432 for postgres, 3306 for mysql)
DB Name? "db_sql2geojson" # database name or schema.database name

Server started on port 5000 # port can be changed on line 140 of server.js
```

For a working example, import the inscluded ESRI shapefiles into your geodatabase.

_Note: Postgres uses **geom** as the geometry column while MySQL seems to use **shape** column for the same. If you have your spatial data on **geom** in a MySQL database, do the following edit in `server.js`_

```js
// Line 115
    ...
    // Change shape to your spatial column (eg geom)
    'geometry', ST_AsGeoJSON(ST_SWAPXY(shape)),
    ...
```

## Author

### Sudipto Ghosh

Portfolio: [sudipto.ghosh.pro](https://sudipto.ghosh.pro)

This app is provided under the MIT License.
