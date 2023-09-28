const sqlite3 = require('sqlite3').verbose()
const filepath = './data/poikkeukset.sqlite'

// Init database
const db = new sqlite3.Database(filepath, sqlite3.OPEN_READWRITE, (err) => {
  if (err && err.code === 'SQLITE_CANTOPEN') {
    createDatabase()
  } else if (err) {
    console.error(err)
  }
})

function createDatabase () {
  const newdb = new sqlite3.Database(filepath, (err) => {
    if (err) {
      return console.log(err)
    }
    createTables(newdb)
  })
}

function createTables (newdb) {
  newdb.run(`
  create table perututvuorot(
    cancel_trip_id text primary key not null,
    cancel_msg_id int not null,
    cancel_end_date int not null,
    cancel_message text
  );
  `)
  newdb.run(`
  create table poikkeusviestit(
    alert_id text primary key not null,
    alert_msg_id int not null,
    alert_end_date int not null,
    alert_description text
  );
  `)
}

module.exports = {
  db
}
