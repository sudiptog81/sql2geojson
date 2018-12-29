const express = require("express");
const path = require("path");
const mysql = require("mysql");
const { Client, Query } = require("pg");
const app = express();
const PORT = process.env.PORT || 5000;
let DBUrl_PG, DBUrl_MY, DBClient, table, fields, fieldsArr, spatial_query;

const DB = "mysql"; // database driver allowed: postgres, mysql
const DBUser = "root"; // database user username
const DBPass = "test1234"; // database user password
const DBHost = "localhost"; // database server hostname
const DBPort = "3306"; // database server port (eg 5432 for postgres, 3306 for mysql)
const DBName = "db_sql2geojson"; // database containing spatial tables

app.get("/", (req, res) => {
  res.send(
    "SQL2GEOJSON API Server Running...<br /><br />If DB = 'postgres', API is available on '/postgres/api/&lt;insert-table-name-here&gt;'<br />For e.g. <a href='/postgres/api/test'>/postgres/api/test</a><br /><br />If DB = 'mysql', API is available on '/mysql/api/&lt;insert-table-name-here&gt;?fields=&lt;field-1-you-want&gt;,&lt;field-2-you-want&gt;,...'<br />For e.g. <a href='/mysql/api/test?fields=id,name,dev'>/mysql/api/test?fields=id,name,dev</a><br /><br />To view an example go to <a href='./example'>/example</a> after importing the shapefiles (in the example directory) into your database and make sure<br />that the SQL2GEOJSON API Server is running."
  );
});

app.get("/example", (req, res) => {
  res.sendFile(path.join(__dirname, "example", "template.html"));
});

app.use("/example", express.static(path.join(__dirname, "example")));

if (DB === "postgres" || process.env.DATABASE_URL) {
  app.get("/postgres/api/:table", (req, res) => {
    DBUrl_PG = `${DB}://${DBUser}:${DBPass}@${DBHost}:${DBPort}/${DBName}`;
    if (process.env.NODE_ENV === "production") {
      DBUrl_PG = `${process.env.DATABASE_URL}?ssl=true`;
    }
    DBClient = new Client(DBUrl_PG);
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
      // // Uncomment if using PostgreSQL 9.3 or before
      // spatial_query = `SELECT row_to_json(fc) FROM (
      //     SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM(
      //         SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry,
      //         row_to_json((${fields})) As properties FROM ${table} As lg
      // ) As f ) As fc`;

      // // Comment out if using PostgreSQL 9.3 or before
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
  });
}

if (DB === "mysql" || process.env.JAWSDB_URL) {
  DBUrl_MY = `${DB}://${DBUser}:${DBPass}@${DBHost}:${DBPort}/${DBName}`;
  if (process.env.NODE_ENV === "production") {
    DBUrl_MY = `${process.env.JAWSDB_URL}?ssl=true`;
  }
  app.get("/mysql/api/:table", (req, res) => {
    DBClient = mysql.createConnection(DBUrl_MY);
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
                                  'geometry', ST_AsGeoJSON(shape),
                                  'properties', JSON_OBJECT(${spatialArr})
                              ) AS feature FROM ${table}) AS features;`;
      DBClient.query(spatial_query, (err, result) => {
        if (err) res.send(err);
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
  });
}
app.get("*", (req, res) => {
  res.sendStatus(404);
});
app.listen(PORT, console.log(`Server started on port ${PORT}`));
