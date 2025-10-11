const { getDaysFromVisitType } = require('./index'); // Экспортируйте функцию

test('getDaysFromVisitType returns correct days', () => {
  expect(getDaysFromVisitType('short')).toBe(1);
  expect(getDaysFromVisitType('long')).toBe(2);
  expect(getDaysFromVisitType('extra')).toBe(3);
  expect(getDaysFromVisitType('invalid')).toBe(0);
});