// Made-up practice data. No real clients, writers, staff or links.
// Kept small on purpose: one example of each main situation, nothing more.
// Dates are set relative to today, so the dashboard always shows current work.

import { addWorkingDays } from './dates.js';

export const SAMPLE_VERSION = 3;

const flat = n => ({ mon: n, tue: n, wed: n, thu: n, fri: n });

export function buildSampleData(today) {
  const wd = n => addWorkingDays(today, n);

  const team = [
    { id: 'T-01', name: 'Sam Carter', email: 'sam.carter@example.com', role: 'admin', active: true },
    { id: 'T-02', name: 'Mia Lopez', email: 'mia.lopez@example.com', role: 'content', active: true },
  ];

  const ams = [
    { id: 'AM-01', name: 'Jordan Lee' },
    { id: 'AM-02', name: 'Casey Brown' },
  ];

  const writers = [
    { id: 'W-01', name: 'Ava Reed', email: 'ava.reed@example.com', type: 'External', rate: 0.03, languages: ['English'], capacity: flat(2000), active: true, notes: '' },
    { id: 'W-02', name: 'Leo Grant', email: 'leo.grant@example.com', type: 'External', rate: 0.03, languages: ['English'], capacity: flat(1500), active: true, notes: '' },
    { id: 'W-03', name: 'Pim Suda', email: 'pim.suda@example.com', type: 'Internal', rate: 0.03, languages: ['Thai'], capacity: flat(2000), active: true, notes: '' },
  ];

  const clients = [
    { id: 'CL-01', name: 'Harbour View Hotel', website: 'https://harbourview.example.com', language: 'English', amId: 'AM-01', usualWriterId: 'W-01', backupWriterId: 'W-02', active: true },
    { id: 'CL-02', name: 'Green Leaf Café', website: 'https://greenleaf.example.com', language: 'English', amId: 'AM-02', usualWriterId: 'W-02', backupWriterId: 'W-01', active: true },
    { id: 'CL-03', name: 'Lotus Spa Bangkok', website: 'https://lotusspa.example.com', language: 'Thai', amId: 'AM-01', usualWriterId: 'W-03', backupWriterId: '', active: true },
    { id: 'CL-04', name: 'Summit Legal', website: 'https://summitlegal.example.com', language: 'English', amId: 'AM-02', usualWriterId: 'W-01', backupWriterId: 'W-02', active: true },
  ];

  const clientById = Object.fromEntries(clients.map(c => [c.id, c]));
  const writerById = Object.fromEntries(writers.map(w => [w.id, w]));
  const PAST_QC = ['with_am', 'with_client', 'revisions', 'approved', 'sent'];

  // One piece at each main point in the process.
  // [n, client, writer, title, type, words, stage, booked, due, received, approved, extra]
  // Day numbers are working days from today (negative = in the past).
  const rows = [
    [1, 'CL-01', 'W-01', 'Best Rooftop Bars Near the Harbour', 'Blog', 1000, 'sent', -15, -11, -11, -5],
    [2, 'CL-02', 'W-02', 'Five Plant-Based Breakfasts to Try', 'Blog', 800, 'with_client', -9, -6, -6],
    [3, 'CL-03', 'W-03', 'A Beginner’s Guide to Thai Herbal Compress', 'Blog', 1000, 'qc', -6, -4, -3], // delivered a day late
    [4, 'CL-04', 'W-01', '/services/family-law/', 'OPC', 1200, 'submitted', -5, -1, -1],
    [5, 'CL-02', 'W-02', 'Allergy Information and Menu FAQs', 'FAQs', 1500, 'with_writer', -3, 1],
    [6, 'CL-01', 'W-01', 'Planning a Harbour Wedding Weekend', 'Blog', 1500, 'with_writer', -4, -1],
    [7, 'CL-03', 'W-03', 'Couples Spa Day Packages Explained', 'Blog', 1000, 'booked', -1, 2],
    [8, 'CL-04', 'W-01', 'How Long Does Probate Take?', 'Blog', 1000, 'booked', 0, 2, null, null, { priority: 'High', notes: 'The client wants this before their fees page goes live.' }],
  ];

  const content = rows.map(([n, clientId, writerId, title, type, words, status, booked, due, received, approved, extra = {}]) => {
    const id = `C-${String(n).padStart(4, '0')}`;
    const client = clientById[clientId];
    const passedQc = PAST_QC.includes(status);
    const has = v => v !== null && v !== undefined;
    return {
      id,
      dateBooked: wd(booked),
      bookedBy: 'T-02',
      writerId,
      clientId,
      title,
      language: client.language,
      type,
      briefLink: `https://docs.example.com/briefs/${id}`,
      words,
      rate: writerById[writerId].rate,
      dueDate: wd(due),
      pinned: false,
      dateReceived: has(received) ? wd(received) : '',
      contentLink: has(received) ? `https://docs.example.com/content/${id}` : '',
      status,
      dateApproved: has(approved) ? wd(approved) : '',
      notes: '',
      amId: client.amId,
      neededBy: '',
      priority: 'Normal',
      qcBy: passedQc ? 'T-02' : '',
      summary: passedQc && type === 'Blog',
      clickupLink: '',
      ...extra,
    };
  });

  // Leo is on leave for two days next week, so it shows on the "Next week" view.
  const timeoff = [
    { id: 'O-001', writerId: 'W-02', from: wd(5), to: wd(6), reason: 'Leave', note: '' },
  ];

  const stageLabel = {
    with_writer: 'With writer', submitted: 'Submitted', qc: 'QC', with_client: 'With client', sent: 'Sent to design/dev',
  };
  const history = [];
  content.forEach(c => {
    history.push({ at: `${c.dateBooked}T02:30:00.000Z`, by: c.bookedBy, tab: 'content', entityId: c.id, action: 'created', note: 'Booked', changes: [] });
    if (c.status !== 'booked') {
      const day = c.dateApproved || c.dateReceived || c.dateBooked;
      history.push({ at: `${day}T07:15:00.000Z`, by: 'T-02', tab: 'content', entityId: c.id, action: 'stage', note: `Moved to ${stageLabel[c.status]}`, changes: [] });
    }
  });
  history.forEach((h, i) => { h.id = `L-${String(i + 1).padStart(5, '0')}`; });

  return { version: SAMPLE_VERSION, team, ams, writers, clients, content, revisions: [], timeoff, holidays: [], history, settings: [] };
}
