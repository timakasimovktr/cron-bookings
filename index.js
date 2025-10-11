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
    case "short":
      return 1;
    case "long":
      return 2;
    case "extra":
      return 3;
    default:
      return 0; 
  }
}

async function checkAndCancelBookings() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.execute(`
      SELECT id, start_datetime, visit_type, end_datetime, status
      FROM bookings
      WHERE status != 'canceled'
    `);

    const today = moment().startOf("day");

    for (const booking of rows) {
      let endDate;

      if (booking.end_datetime) {
        endDate = moment(booking.end_datetime).startOf("day");
      } else {
        const days = getDaysFromVisitType(booking.visit_type);
        if (days === 0) continue; // Skip invalid
        endDate = moment(booking.start_datetime)
          .add(days, "days")
          .startOf("day");
      }

      const cancelDate = endDate.clone().add(1, "days");

      if (today.isAfter(cancelDate)) {
        await connection.execute(
          `
          UPDATE bookings
          SET status = 'canceled'
          WHERE id = ?
        `,
          [booking.id]
        );
        console.log(`Canceled booking ID: ${booking.id}`);
      }
    }
  } catch (error) {
    console.error("Error checking bookings:", error);
  } finally {
    await connection.end();
  }
}

cron.schedule("0 0 * * *", () => {
  console.log("Running daily check for overdue bookings...");
  checkAndCancelBookings();
});

console.log("Scheduler started. Waiting for cron jobs...");
