import { describe, expect, it } from 'vitest';
import { parseClientRosterCSV } from './roster-store';

describe('parseClientRosterCSV', () => {
  it('parses the client-day-time-carer roster shape used by live exports', () => {
    const csv = [
      'Client,Day,Time,Carer',
      '"Mr Aaron Preece - 390 hours and 9 minutes","Fri 20 Mar","8:00 am - 11:59 am (3 hours and 59 minutes)","Vaishnav Valsalakumari Sureshkumar"',
      ',,"12:00 pm - 2:59 pm (2 hours and 59 minutes)","Vaishnav Valsalakumari Sureshkumar"',
      ',,"3:00 pm - 7:59 pm (4 hours and 59 minutes)","Vaishnav Valsalakumari Sureshkumar"',
    ].join('\n');

    const shifts = parseClientRosterCSV(csv);

    expect(shifts).toHaveLength(3);
    expect(shifts[0]).toMatchObject({
      client: 'Aaron Preece',
      clientRaw: 'Mr Aaron Preece - 390 hours and 9 minutes',
      date: '20/03/2026',
      startTime: '08:00',
      endTime: '11:59',
      carers: ['Vaishnav Valsalakumari Sureshkumar'],
      shiftType: 'day',
    });
  });
});
