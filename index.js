const mysql = require('mysql2/promise');
const cron = require('node-cron');
const moment = require('moment-timezone');
const axios = require('axios');

// Установите временную зону
moment.tz.setDefault('Asia/Tashkent');

const BOT_TOKEN = '8373923696:AAHxWLeCqoO0I-ZCgNCgn6yJTi6JJ-wOU3I'; // Ваш Telegram Bot Token

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '678Yuiiuy876!@#',
  database: 'prison_visits',
};

function getDaysFromVisitType(visitType) {
  switch (visitType) {
    case 'short': return 1;
    case 'long': return 2;
    case 'extra': return 3;
    default: return 0;
  }
}

async function checkAndCancelBookings(dbConfigOverride = dbConfig, currentDate = moment().startOf('day')) {
  const connection = await mysql.createConnection(dbConfigOverride);
  try {
    console.log('Checking bookings on:', currentDate.format('YYYY-MM-DD HH:mm:ss ZZ'));
    const [rows] = await connection.execute(`
      SELECT id, start_datetime, visit_type, end_datetime, status, telegram_chat_id, colony_application_number, language
      FROM bookings
      WHERE status != 'canceled'
    `);
    console.log('Found bookings:', rows.length, rows);

    for (const booking of rows) {
      let endDate;

      const days = getDaysFromVisitType(booking.visit_type);
      if (days === 0) {
        console.log(`Booking ${booking.id}: Invalid visit_type=${booking.visit_type}, skipping`);
        continue;
      }
      endDate = moment(booking.start_datetime).add(days, 'days').startOf('day');
      console.log(`Booking ${booking.id}: Calculated end_date=${endDate.format('YYYY-MM-DD')} from visit_type=${booking.visit_type}`);

      const cancelDate = endDate.clone().add(1, 'days');
      console.log(`Booking ${booking.id}: Cancel date=${cancelDate.format('YYYY-MM-DD')}, Current date=${currentDate.format('YYYY-MM-DD')}`);

      if (currentDate.isAfter(cancelDate)) {
        console.log(`Booking ${booking.id}: Will be canceled`);
        await connection.execute(
          `UPDATE bookings SET status = 'canceled' WHERE id = ?`,
          [booking.id]
        );
        console.log(`Canceled booking ID: ${booking.id}`);

        // Отправка Telegram-уведомления
        if (booking.telegram_chat_id) {
          const nextVisitDate = moment().add(50, 'days').format('DD.MM.YYYY');
          let message = '';
          if (booking.language === 'uzl') {
            message = `
🏛 Uchrashuv yakunlandi. Ariza raqami: ${booking.colony_application_number}
📅 Uchrashuv sanasi: ${moment(booking.start_datetime).format('DD.MM.YYYY')}
🏁 Holat: Uchrashuv yakunlandi
📆 Keyingi uchrashuv faqat ${nextVisitDate} dan keyin mumkin
👨‍👩‍👧‍👦 Xizmatimizdan foydalanganingiz uchun tashakkur!
            `;
          } else if (booking.language === 'ru') {
            message = `
🏛 Встреча завершена. Номер заявки: ${booking.colony_application_number}
📅 Дата встречи: ${moment(booking.start_datetime).format('DD.MM.YYYY')}
🏁 Статус: Встреча завершена
📆 Следующая встреча возможна только с ${nextVisitDate}
👨‍👩‍👧‍👦 Спасибо за использование нашего сервиса!
            `;
          } else {
            message = `
🏛 Учрашув йакунлади. Ариза рақами: ${booking.colony_application_number}
📅 Учрашув санаси: ${moment(booking.start_datetime).format('DD.MM.YYYY')}
🏁 Холат: Учрашув йакунлади
📆 Кейинги учрашув фақат ${nextVisitDate} дан кейин мумкин
👨‍👩‍👧‍👦 Хизматимиздан фойдаланганингиз учун ташаккур!
            `;
          try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              chat_id: booking.telegram_chat_id,
              text: message,
              reply_markup: {
                keyboard: [[{ text: 'Yangi ariza yuborish' }]],
                resize_keyboard: true,
                one_time_keyboard: false,
              },
            });
            console.log(`Telegram message sent for booking ID: ${booking.id}`);
          } catch (telegramError) {
            console.error(`Failed to send Telegram message for booking ID: ${booking.id}`, telegramError);
          }
        } else {
          console.log(`Booking ${booking.id}: No telegram_chat_id, skipping message`);
        }
      } else {
        console.log(`Booking ${booking.id}: Not overdue`);
      }
    }
  } catch (error) {
    console.error('Error checking bookings:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

function startCron() {
  const task = cron.schedule('0 0 * * *', () => {
    console.log('Running daily check for overdue bookings...');
    checkAndCancelBookings();
  });
  return task;
}

if (require.main === module) {
  console.log('Scheduler started. Waiting for cron jobs...');
  startCron(); 
  checkAndCancelBookings(); 
}

module.exports = { getDaysFromVisitType, checkAndCancelBookings, startCron };