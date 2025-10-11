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

async function checkAndCancelBookings(
  dbConfigOverride = dbConfig,
  currentDate = moment().startOf("day")
) {
  const connection = await mysql.createConnection(dbConfigOverride);
  try {
    console.log(
      "Checking bookings on:",
      currentDate.format("YYYY-MM-DD HH:mm:ss ZZ")
    );
    const [rows] = await connection.execute(`
      SELECT id, start_datetime, visit_type, end_datetime, status
      FROM bookings
      WHERE status != 'canceled'
    `);
    console.log("Found bookings:", rows.length, rows);

    for (const booking of rows) {
      let endDate;

      const days = getDaysFromVisitType(booking.visit_type);
      if (days === 0) {
        console.log(
          `Booking ${booking.id}: Invalid visit_type=${booking.visit_type}, skipping`
        );
        continue;
      }
      endDate = moment(booking.start_datetime).add(days, "days").startOf("day");
      console.log(
        `Booking ${booking.id}: Calculated end_date=${endDate.format(
          "YYYY-MM-DD"
        )} from visit_type=${booking.visit_type}`
      );

      const cancelDate = endDate.clone().add(1, "days");
      console.log(
        `Booking ${booking.id}: Cancel date=${cancelDate.format(
          "YYYY-MM-DD"
        )}, Current date=${currentDate.format("YYYY-MM-DD")}`
      );

      if (currentDate.isAfter(cancelDate)) {
        console.log(`Booking ${booking.id}: Will be canceled`);
        await connection.execute(
          `
          UPDATE bookings
          SET status = 'canceled'
          WHERE id = ?
        `,
          [booking.id]
        );
        console.log(`Canceled booking ID: ${booking.id}`);
      } else {
        console.log(`Booking ${booking.id}: Not overdue`);
      }
    }
  } catch (error) {
    console.error("Error checking bookings:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

function startCron() {
  const task = cron.schedule("0 0 * * *", () => {
    console.log("Running daily check for overdue bookings...");
    checkAndCancelBookings();
  });
  return task;
}

if (require.main === module) {
  console.log("Scheduler started. Waiting for cron jobs...");
  // startCron(); // Закомментируйте cron
  checkAndCancelBookings(); // Вызовите напрямую для теста
}

module.exports = { getDaysFromVisitType, checkAndCancelBookings, startCron };
