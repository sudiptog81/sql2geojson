const express = require("express");
const path = require("path");
const mysql = require("mysql");
const { Client, Query } = require("pg");
const app = express();
const PORT = process.env.PORT || 5000;
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
});
let DBUrl, DBClient, table, fields, fieldsArr, spatial_query;
readline.question(`Database? `, DB => {
  readline.question("DB User? ", DBUser => {
    readline.question("DB Password? ", DBPass => {
      readline.question("DB Host? ", DBHost => {
        readline.question("DB Port? ", DBPort => {
          readline.question(
            "Note: Add ?ssl=true to the DB Name if the DB server requires SSL\nDB Name? ",
            DBName => {
              DBUrl = `${DB}://${DBUser}:${DBPass}@${DBHost}:${DBPort}/${DBName}`;
              app.get("/", (req, res) => {
                res.send("SQL2GEOJSON API Server Running...");
              });
              app.get("/example", (req, res) => {
                res.sendFile(path.join(__dirname, "example", "template.html"));
              });
              app.get("/api/:table", (req, res) => {
                switch (DB) {
                  //  PostgreSQL
                  case "postgres":
                    DBClient = new Client(DBUrl);
                    DBClient.connect();
                    //  fields = req.query.fields; // <- Uncomment if using PostgreSQL 9.3 and before
                    table = req.params.table;
                    if (
                      table.indexOf("--") > -1 ||
                      table.indexOf("'") > -1 ||
                      table.indexOf(";") > -1 ||
                      table.indexOf("/*") > -1 ||
                      table.indexOf("xp_") > -1
                    ) {
                      console.log("SQL INJECTION ALERT");
                      res.sendStatus(403);
                      return;
                    } else {
                      // // Uncomment if using PostgreSQL 9.3 and before
                      // spatial_query = `SELECT row_to_json(fc) FROM (
                      //                             SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM(
                      //                                 SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry,
                      //                                 row_to_json((${fields})) As properties FROM ${table} As lg
                      //                         ) As f ) As fc`;

                      // // Comment out if using PostgreSQL 9.3 and before
                      spatial_query = `SELECT jsonb_build_object(
                                                'type',     'FeatureCollection',
                                                'features', jsonb_agg(features.feature)
                                                ) FROM (
                                                SELECT jsonb_build_object(
                                                    'type',       'Feature',
                                                    'geometry',   ST_AsGeoJSON(geom)::jsonb,
                                                    'properties', to_jsonb(inputs) - 'geom'
                                                ) AS feature
                                        FROM (SELECT * FROM ${table}) inputs) features;`;

                      const DBQuery = DBClient.query(
                        new Query(spatial_query),
                        (err, result) => {
                          if (err) res.sendStatus(500);
                        }
                      );
                      DBQuery.on("row", (row, result) => {
                        result.addRow(row);
                      });
                      DBQuery.on("end", result => {
                        // res.send(result.rows[0].row_to_json); // <- Uncomment if using PostgreSQL 9.3 and before
                        res.json(result.rows[0].jsonb_build_object); // <- Comment out if using PostgreSQL 9.3 and before
                      });
                    }
                    break;
                  case "mysql":
                    DBClient = mysql.createConnection(DBUrl);
                    table = req.params.table;
                    fields = req.query.fields;
                    fieldsArr = fields.split(",");
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
                      res.sendStatus(403);
                      return;
                    } else {
                      let spatialArr = [];
                      for (let i = 0; i < fieldsArr.length; i++) {
                        spatialArr.push(`${fieldsArr[i]}`, fieldsArr[i]);
                      }
                      let quote = `"`;
                      for (let i = 0; i < spatialArr.length; i++) {
                        if (i % 2 == 0) {
                          spatialArr[i] = quote + spatialArr[i] + quote;
                        }
                      }
                      spatialArr = spatialArr.join();
                      spatial_query = `SELECT JSON_OBJECT('type','FeatureCollection','features', JSON_ARRAYAGG(features.feature))
                              AS data FROM(SELECT JSON_OBJECT(
                                  'type', 'Feature',
                                  'geometry', ST_AsGeoJSON(ST_SWAPXY(shape)),
                                  'properties', JSON_OBJECT(${spatialArr})
                              ) AS feature FROM ${table}) AS features;`;
                      DBClient.query(spatial_query, (err, result) => {
                        if (err) res.sendStatus(500);
                        try {
                          if (result[0].data) {
                            let json = JSON.parse(result[0].data);
                            res.json(json);
                          }
                        } catch (error) {
                          console.log(error);
                        }
                      });
                    }
                    break;
                  default:
                    console.log("invalid driver");
                    break;
                }
              });
              app.get("*", (req, res) => {
                res.sendStatus(404);
              });
              readline.close();
              app.listen(PORT, console.log(`Server started on port ${PORT}`));
            }
          );
        });
      });
    });
  });
});
