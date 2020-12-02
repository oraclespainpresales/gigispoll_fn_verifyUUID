const oracledb = require('oracledb')
    , fdk = require('@fnproject/fdk')
    , moment = require('moment')
;

oracledb.outFormat = oracledb.OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

let pool;

fdk.handle(async function(input){
  let result = {};

  if (!input.uuid) {
    result.code = -1;
    result.message = "UUID not provided";
    return result;
  }

  if (!pool) {
    pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.CONNECT_STRING_MICROSERVICE,
    });
  }

  const connection = await pool.getConnection();
  const sql = `select * from polluuid where uuid = :uuid`;
  const bindings = [input.uuid];
  const records = await connection.execute(sql, bindings, { autoCommit: true });

  // Let's start to validate all stuff
  if (records.rows.length == 0) {
    result.code = -1;
    result.message = "Poll token not found";
    return result;
  }
  
  let r = records.rows[0];

  if (r.USED !== "N") {
    result.code = -1;
    result.message = "This poll token has already been used";
    return result;
  }

  let m1 = moment(r.DUEDATETIME);
  let m2 = moment();
  let diff = m1.diff(m2);
  if (diff <= 0) {
    result.code = -1;
    result.message = "This poll token has expired";
    result.expirationdate = m1.format('YYYY-MM-DDTHH:mm:ssZ');
    return result;
  }

  result.code = 0;
  result.orderid = r.ORDERID;
  return result;
})
