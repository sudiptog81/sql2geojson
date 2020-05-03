# SQL2GeoJSON API Server

> NodeJS API server for serving GeoJSON from Postgres or MySQL spatial tables.

Example Deployment on [Heroku](https://sql2geojson.herokuapp.com/example)

## Quick Start

### Configuration

**You must have NodeJS installed on your system.**

**You should ideally have PostgreSQL v9.4+ or MySQL v5.7+** as the queries used use certain functions such as `jsonb_build_object()` and `jsonb_agg()` for Postgres and `JSON_OBJECT()` and `JSON_ARRAYAGG()` for MySQL.

### Running the app

Clone this repository and execute `run.bat`.

```bash
run.bat

# you will be prompted for the connection details
# add ?ssl=true to the DB Nameif your db server
# requires SSL

> npm start

Server listening on port 5000 # port can be changed on line 9 of server.js
```

For a working example, import the inscluded ESRI shapefiles into your geodatabase.

_Note: Postgres uses **geom** as the geometry column while MySQL seems to use **shape** column for the same. If you have your spatial data on **geom** in a MySQL database, do the following edit in `server.js`_

```js
// line 308 and 317 of server.js
    ...
    // change shape to your spatial column (eg geom)
    'geometry', ST_AsGeoJSON(shape),
    ...
```

## Author

### Sudipto Ghosh

Portfolio: [sudipto.ghosh.pro](https://sudipto.ghosh.pro)

This app is provided under the MIT License.
