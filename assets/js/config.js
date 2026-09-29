// Starting values for Content Base.
//
// The admin changes names, dropdown lists, stages and columns on the Settings page
// in the tool itself; these are only the starting values, and what
// "Reset all settings" goes back to. The technical settings in CONFIG below
// (storage mode, Google Client ID) are changed here, by a developer.

export const CONFIG = {
  appName: 'Content Base',

  // 'practice' = made-up data kept in this browser (round 1).
  // 'sheet'    = the company Google Sheet through the Google script (round 2).
  mode: 'practice',

  // Round 2: the Google Client ID for "Sign in with Google" (public, safe here).
  // Never put a Client secret in this file.
  googleClientId: '',

  // Round 2: the web address of the Google script that guards the sheet.
  sheetScriptUrl: '',

  defaultRate: 0.03, // USD per word for new writers

  // New work starts the next working day after it is booked.
  newWorkStartsNextWorkingDay: true,
};

// The Move Ahead Media logo, from the company website (the same file the quiz uses).
export const LOGO = 'https://www.moveaheadmedia.co.th/wp-content/uploads/2023/10/mamlogo-dynamicwhite.png';

export const LANGUAGES = ['English', 'Thai', 'Arabic', 'German', 'Korean', 'Chinese', 'Japanese', 'Other', 'Pending'];

export const CONTENT_TYPES = ['Blog', 'OPC', 'FAQs', 'Blog&OPC', 'Other', 'Pending'];

export const PRIORITIES = ['Urgent', 'High', 'Normal'];

export const WRITER_TYPES = ['Internal', 'External'];

export const ROLE_LABELS = { admin: 'Admin', content: 'Content team', writer: 'Writer' };

export const TIME_OFF_REASONS = ['Leave', 'Sick', 'Other'];

// The 10 stages, in order. `writer` is the simpler name writers see.
// `tone` groups stages by who is holding the piece, for chip colours.
export const STAGES = [
  { key: 'booked', label: 'Booked', writer: 'New', tone: 'writer' },
  { key: 'with_writer', label: 'With writer', writer: 'In progress', tone: 'writer' },
  { key: 'submitted', label: 'Submitted', writer: 'Submitted', tone: 'prod' },
  { key: 'formatting', label: 'Formatting (Links team)', writer: 'Submitted', tone: 'prod' },
  { key: 'qc', label: 'QC', writer: 'Submitted', tone: 'prod' },
  { key: 'with_am', label: 'With AM', writer: 'Submitted', tone: 'client' },
  { key: 'with_client', label: 'With client', writer: 'Submitted', tone: 'client' },
  { key: 'revisions', label: 'Revisions', writer: 'Revisions needed', tone: 'rev' },
  { key: 'approved', label: 'Client approved', writer: 'Done', tone: 'done' },
  { key: 'sent', label: 'Sent to design/dev', writer: 'Done', tone: 'done' },
];

export const WEEKDAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
];
