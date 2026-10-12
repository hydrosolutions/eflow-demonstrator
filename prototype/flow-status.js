'use strict';
(function (root) {
  function notAssessed(reason) {
    return {
      status: 'grey', label: 'Not assessed', candidateShortfallDays: null,
      instructionShortfallDays: null, assessedDays: 0, reason
    };
  }

  function calendarDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7)) - 1;
    const day = Number(value.slice(8, 10));
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (year < 1 || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
    return {year, month, day};
  }

  function assessFlowDelivery(profile, monthIndex, calculationSection = 'R2b') {
    if (calculationSection !== 'R2a' && calculationSection !== 'R2b') return notAssessed('Delivery status is available only at calculation sections R2a and R2b.');
    const actualField = calculationSection === 'R2a' ? 'r2a_litres' : 'downstream_litres';
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return notAssessed('A calendar month from 0 through 11 is required.');
    if (!Array.isArray(profile?.ledger) || !profile.ledger.length) return notAssessed('A complete daily ledger is required.');
    const selected = [];
    for (const row of profile.ledger) {
      const day = calendarDay(row?.date);
      if (!day) return notAssessed('A ledger date is missing or is not a valid ISO calendar day.');
      if (day.month === monthIndex) selected.push({row, day});
    }
    if (!selected.length) return notAssessed('No daily ledger was supplied for the selected month.');
    const year = selected[0].day.year;
    const lastDay = new Date(0);
    lastDay.setUTCFullYear(year, monthIndex + 1, 0);
    const expectedDays = lastDay.getUTCDate();
    if (selected.length !== expectedDays || selected.some((entry, i) => entry.day.year !== year || entry.day.day !== i + 1)) {
      return notAssessed('The selected month must contain every day once, in calendar order, within one year.');
    }
    const fields = [actualField, 'candidate_litres', 'issued_litres'];
    if (selected.some(({row}) => fields.some(key => !Number.isSafeInteger(row[key]) || row[key] < 0))) {
      return notAssessed('Selected-month delivery, candidate and instruction values must be nonnegative safe integer litres.');
    }
    const candidateShortfallDays = selected.filter(({row}) => row[actualField] < row.candidate_litres).length;
    const instructionShortfallDays = selected.filter(({row}) => row[actualField] < row.issued_litres).length;
    const status = instructionShortfallDays ? 'red' : candidateShortfallDays ? 'amber' : 'green';
    const labels = {
      green: 'Candidate and instruction met',
      amber: 'Below candidate; instruction met',
      red: 'Below operating instruction'
    };
    const period = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}`;
    return {
      status, label: labels[status], candidateShortfallDays, instructionShortfallDays,
      assessedDays: expectedDays,
      reason: `${period}: ${candidateShortfallDays} of ${expectedDays} days below candidate; ${instructionShortfallDays} below operating instruction. Delivery comparisons against hypothetical quantities; not ecological status or legal fault.`
    };
  }

  const api = {assessFlowDelivery};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlowStatus = api;
})(globalThis);
