const sqlite3 = require('sqlite3').verbose()
const filepath = './data/poikkeukset.sqlite'

// Init database
const db = new sqlite3.Database(filepath, sqlite3.OPEN_READWRITE, (err) => {
  if (err && err.code === 'SQLITE_CANTOPEN') {
    console.info('[DB] Does not exist, creating new...')
    createDatabase()
  } else if (err) {
    console.error(err)
  }
  console.info('[DB] Opened db')
})

function createDatabase () {
  const newdb = new sqlite3.Database(filepath, (err) => {
    if (err) {
      return console.log(err)
    } else {
      console.info('[DB] Database created, creating tables...')
      createTables(newdb)
    }
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
  console.info('[DB] Tables created')
}

module.exports = {
  db
}
