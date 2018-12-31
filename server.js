// init dependencies
const express = require("express");
const path = require("path");
const mysql = require("promise-mysql");
const cors = require("cors");
const { Pool, Query } = require("pg");
const app = express();
const PORT = process.env.PORT || 5000;

// declare common variables
let DBUrl_PG, DBUrl_MY, DBPool, DBClient, spatial_query;

// configuration variables
const DB = process.env.DB_DRIVER || "mysql"; // database driver allowed: postgres, mysql
const DBUser = process.env.DB_USER || "root"; // database user username
const DBPass = process.env.DB_PASSWORD || "test1234"; // database user password
const DBHost = process.env.DB_HOST || "localhost"; // database server hostname
const DBPort = process.env.DB_PORT || "3306"; // database server port (eg 5432 for postgres, 3306 for mysql)
const DBName = process.env.DB_NAME || "db_sql2geojson"; // database containing spatial tables

// CORS enabled
app.use(cors());

// server status
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// serve example
app.get("/example", (req, res) => {
  res.sendFile(path.join(__dirname, "example", "template.html"));
});
app.use("/example", express.static(path.join(__dirname, "example")));

if (DB === "postgres" || process.env.DATABASE_URL) {
  app.get("/postgres/api/:table", (req, res) => {
    // postgres api init
    // construct connection string
    DBUrl_PG = `${DB}://${DBUser}:${DBPass}@${DBHost}:${DBPort}/${DBName}`;

    // production build db config
    if (process.env.NODE_ENV === "production") {
      if (process.env.DATABASE_URL) {
        DBUrl_PG = `${process.env.DATABASE_URL}`;
      } else {
        DBUrl_PG = `${DBUrl_PG}`;
      }
    }

    // init db pool and client
    DBPool = new Pool({ connectionString: DBUrl_PG, max: 1000 });
    DBPool.connect()
      .then(client => {
        DBClient = client;

        // destructure req and get parameters
        let { table } = req.params;
        let { fields, filter, schema } = req.query;

        // check for req health
        if (table) {
          // check for common SQL injection
          if (
            table.indexOf("--") > -1 ||
            table.indexOf("'") > -1 ||
            table.indexOf(";") > -1 ||
            table.indexOf("/*") > -1 ||
            table.indexOf("xp_") > -1
          ) {
            console.log("SQL INJECTION ALERT");
            res.status(403).send({
              statusCode: 403,
              status: "Error 403 Unauthorized",
              error: "Disallowed Characters in Request URL"
            });
            return;
          } else {
            // // Uncomment if using PostgreSQL 9.3 or before
            // spatial_query = `SELECT row_to_json(fc) FROM (
            //     SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM(
            //         SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry,
            //         row_to_json((${fields})) As properties FROM ${table} As lg
            // ) As f ) As fc`;

            // check req intent
            if (fields && filter) {
              // check for common SQL injection
              if (
                fields.indexOf("--") > -1 ||
                fields.indexOf("'") > -1 ||
                fields.indexOf(";") > -1 ||
                fields.indexOf("/*") > -1 ||
                fields.indexOf("xp_") > -1 ||
                filter.indexOf("--") > -1 ||
                filter.indexOf("'") > -1 ||
                filter.indexOf(";") > -1 ||
                filter.indexOf("/*") > -1 ||
                filter.indexOf("xp_") > -1
              ) {
                console.log("SQL INJECTION ALERT");
                res.status(403).send({
                  statusCode: 403,
                  status: "Error 403 Unauthorized",
                  error: "Disallowed Characters in Request URL"
                });
                return;
              } else {
                // construct array from request
                let fieldsArr = fields.split(",");
                // iterate over the array to form a query elem
                for (let i = 0; i < fieldsArr.length; i++) {
                  if (fieldsArr[i] === "id") {
                    fieldsArr[i] = `${fieldsArr[i]} = ${filter}`;
                  } else {
                    fieldsArr[i] = `${fieldsArr[i]} LIKE '${filter}'`;
                  }
                }
                // join the array to form query string
                fieldsArr = fieldsArr.join(" OR ");
                // construct the query
                if (schema) {
                  spatial_query = `SELECT jsonb_build_object(
                              'type', 'FeatureCollection',
                              'features', jsonb_agg(features.feature)
                              ) AS data FROM (
                              SELECT jsonb_build_object(
                                  'type',       'Feature',
                                  'geometry',   ST_AsGeoJSON(geom)::jsonb,
                                  'properties', to_jsonb(inputs) - 'geom'
                              ) AS feature
                            FROM (SELECT * FROM \"${schema}\".\"${table}\" WHERE (${fieldsArr})) AS inputs) features;`;
                } else {
                  spatial_query = `SELECT jsonb_build_object(
                              'type', 'FeatureCollection',
                              'features', jsonb_agg(features.feature)
                              ) AS data FROM (
                              SELECT jsonb_build_object(
                                  'type',       'Feature',
                                  'geometry',   ST_AsGeoJSON(geom)::jsonb,
                                  'properties', to_jsonb(inputs) - 'geom'
                              ) AS feature
                            FROM (SELECT * FROM \"${table}\" WHERE (${fieldsArr})) AS inputs) features;`;
                }
              }
            } else if (schema) {
              // construct the query
              spatial_query = `SELECT jsonb_build_object(
                            'type',     'FeatureCollection',
                            'features', jsonb_agg(features.feature)
                            ) AS data FROM (
                            SELECT jsonb_build_object(
                                'type',       'Feature',
                                'geometry',   ST_AsGeoJSON(geom)::jsonb,
                                'properties', to_jsonb(inputs) - 'geom'
                            ) AS feature
                          FROM (SELECT * FROM \"${schema}\".\"${table}\") AS inputs) features;`;
            } else {
              spatial_query = `SELECT jsonb_build_object(
                            'type',     'FeatureCollection',
                            'features', jsonb_agg(features.feature)
                            ) AS data FROM (
                            SELECT jsonb_build_object(
                                'type',       'Feature',
                                'geometry',   ST_AsGeoJSON(geom)::jsonb,
                                'properties', to_jsonb(inputs) - 'geom'
                            ) AS feature
                          FROM (SELECT * FROM \"${table}\") AS inputs) features;`;
            }
            // query the db
            const DBQuery = DBClient.query(spatial_query)
              .then(results => {
                res.json(results.rows[0].data);
              })
              .catch(err => {
                res.status(500).send({
                  statusCode: 500,
                  status: "Error 500 Internal Server Error",
                  error: err
                });
              });
          }
        } else {
          // send res if no table specified
          res.status(403).send({
            statusCode: 403,
            status: "Error 403 Unauthorized",
            error: "Request Malformed"
          });
        }
      })
      .catch(err => {
        res.status(500).send({
          statusCode: 500,
          status: "Error 500 Internal Server Error",
          error: "Could not connect to database"
        });
      });
  });
}

if (DB === "mysql" || process.env.JAWSDB_ONYX_URL) {
  app.get("/mysql/api/:table", (req, res) => {
    // mysql api init
    // construct connection string
    DBUrl_MY = `${DB}://${DBUser}:${DBPass}@${DBHost}:${DBPort}/${DBName}`;
    // handle db config for production build
    if (process.env.NODE_ENV === "production") {
      if (process.env.DATABASE_URL) {
        DBUrl_MY = `${process.env.JAWSDB_ONYX_URL}`;
      } else {
        DBUrl_MY = `${DBUrl_MY}`;
      }
    }

    // init db client
    mysql
      .createConnection(DBUrl_MY)
      .then(DBClient => {
        // destructure req to get query parameters
        let { table } = req.params;
        let { fields, filter } = req.query;

        // check req health
        if (table && fields) {
          // handle common SQL injection
          if (
            table.indexOf("--") > -1 ||
            table.indexOf("'") > -1 ||
            table.indexOf(";") > -1 ||
            table.indexOf("/*") > -1 ||
            table.indexOf("xp_") > -1 ||
            fields.indexOf("--") > -1 ||
            fields.indexOf("'") > -1 ||
            fields.indexOf(";") > -1 ||
            fields.indexOf("/*") > -1 ||
            fields.indexOf("xp_") > -1
          ) {
            console.log("SQL INJECTION ALERT");
            res.status(403).send({
              statusCode: 403,
              status: "Error 403 Unauthorized",
              error: "Disallowed Characters in Request URL"
            });
            return;
          } else {
            // form an array of fields to query
            fieldsArr = fields.split(",");
            // declare an array to store query elements
            let spatialArr = [];
            // additional check of fields to query
            if (fieldsArr.length > 0) {
              // form a query string
              for (let i = 0; i < fieldsArr.length; i++) {
                spatialArr.push(`${fieldsArr[i]}`, fieldsArr[i]);
              }
              let quote = `"`;
              for (let i = 0; i < spatialArr.length; i++) {
                if (i % 2 == 0) {
                  spatialArr[i] = quote + spatialArr[i] + quote;
                }
              }
            } else {
              // handle error if there are no fields spec
              res.status(403).send({
                statusCode: 403,
                status: "Error 403 Unauthorized",
                error: "Request URL malformed"
              });
            }
            // clone the query fields to an array
            tempArr = fieldsArr;
            // form the query element
            spatialArr = spatialArr.join();
            // check req intent
            if (filter) {
              // handle common SQL injection
              if (
                filter.indexOf("--") > -1 ||
                filter.indexOf("'") > -1 ||
                filter.indexOf(";") > -1 ||
                filter.indexOf("/*") > -1 ||
                filter.indexOf("xp_") > -1
              ) {
                console.log("SQL INJECTION ALERT");
                res.status(403).send({
                  statusCode: 403,
                  status: "Error 403 Unauthorized",
                  error: "Disallowed Characters in Request URL"
                });
                return;
              } else {
                // form the query string
                for (let i = 0; i < tempArr.length; i++) {
                  if (fieldsArr[i] === "id") {
                    tempArr[i] = `${tempArr[i]} = '${filter}'`;
                  } else {
                    tempArr[i] = `${tempArr[i]} LIKE '${filter}'`;
                  }
                }
                tempArr = tempArr.join(" OR ");

                // construct the query
                spatial_query = `SELECT JSON_OBJECT('type','FeatureCollection','features', JSON_ARRAYAGG(features.feature))
                              AS data FROM(SELECT JSON_OBJECT(
                                  'type', 'Feature',
                                  'geometry', ST_AsGeoJSON(shape),
                                  'properties', JSON_OBJECT(${spatialArr})
                            ) AS feature FROM \`${table}\` WHERE (${tempArr}) ) AS features;`;
              }
            } else {
              // construct the query
              spatial_query = `SELECT JSON_OBJECT('type','FeatureCollection','features', JSON_ARRAYAGG(features.feature))
                              AS data FROM(SELECT JSON_OBJECT(
                                  'type', 'Feature',
                                  'geometry', ST_AsGeoJSON(shape),
                                  'properties', JSON_OBJECT(${spatialArr})
                            ) AS feature FROM \`${table}\`) AS features;`;
            }

            // query the db
            DBClient.query(spatial_query)
              .then(results => {
                res.json(JSON.parse(results[0].data));
              })
              .catch(err => {
                res.status(500).send({
                  statusCode: 500,
                  status: "Error 500 Internal Server Error",
                  error: err.sqlMessage
                });
              });
          }
        } else {
          // handling req with no table spec
          // and no fields to query
          res.status(403).send({
            statusCode: 403,
            status: "Error 403 Unauthorized",
            error: "Request Malformed"
          });
        }
        // end the db connection to prevent
        // connection errors in future
        DBClient.end(err => {
          // if err when ending conn
          // log to server logs
          if (err) {
            console.log(err);
          }
        });
      })
      .catch(err =>
        res.status(500).send({
          statusCode: 500,
          status: "Error 500 Internal Server Error",
          error: err
        })
      );
  });
}

// handle if resource isn't available
app.get("*", (req, res) => {
  res.status(404).send({
    statusCode: 404,
    status: "Error 404 Not Found"
  });
});

// port config
app.listen(PORT, console.log(`Server started on port ${PORT}`));
