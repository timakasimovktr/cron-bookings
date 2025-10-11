// cancel_overdue_bookings

const mysql = require("mysql2/promise");
const cron = require("node-cron");
const moment = require("moment");

const dbConfig = {
  host: "127.0.0.1",
  user: "root",
  password: "678Yuiiuy876!@#",
  database: "prison_visits",
};

function getDaysFromVisitType(visitType) {
  switch (visitType) {
    case 'short':
      return 1;
    case 'long':
      return 2;
    case 'extra':
      return 3;
    default:
      return 0; // Invalid type, skip or handle error
  }
}

// Main function to check and update bookings
async function checkAndCancelBookings(dbConfigOverride = dbConfig, currentDate = moment().startOf('day')) {
  const connection = await mysql.createConnection(dbConfigOverride);
  try {
    // Fetch active bookings (status not canceled)
    const [rows] = await connection.execute(`
      SELECT id, start_datetime, visit_type, end_datetime, status
      FROM bookings
      WHERE status != 'canceled'
    `);

    for (const booking of rows) {
      let endDate;

      // If end_datetime is set, use it; otherwise calculate based on visit_type
      if (booking.end_datetime) {
        endDate = moment(booking.end_datetime).startOf('day');
      } else {
        const days = getDaysFromVisitType(booking.visit_type);
        if (days === 0) continue; // Skip invalid
        endDate = moment(booking.start_datetime).add(days, 'days').startOf('day');
      }

      // The day after endDate
      const cancelDate = endDate.clone().add(1, 'days');

      // If currentDate is after cancelDate, update to canceled
      if (currentDate.isAfter(cancelDate)) {
        await connection.execute(`
          UPDATE bookings
          SET status = 'canceled'
          WHERE id = ?
        `, [booking.id]);
        console.log(`Canceled booking ID: ${booking.id}`);
      }
    }
  } catch (error) {
    console.error('Error checking bookings:', error);
    throw error; // Rethrow for testing
  } finally {
    await connection.end();
  }
}

// Function to start cron job (called only when running as main script)
function startCron() {
  const task = cron.schedule('0 0 * * *', () => {
    console.log('Running daily check for overdue bookings...');
    checkAndCancelBookings();
  });
  return task; // Return task for testing or stopping
}

// Run cron only if script is run directly (not imported for tests)
if (require.main === module) {
  console.log('Scheduler started. Waiting for cron jobs...');
  startCron();
}

module.exports = {
  getDaysFromVisitType,
  checkAndCancelBookings,
  startCron,
};