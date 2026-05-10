/**
 * Embedded sample data — no filesystem reads.
 * Replaces all readJsonFile / readTextFile / readSampleReportFiles calls
 * so the app deploys correctly on Vercel (serverless has no local fs).
 */

export const PAST_REPORTS = [
  {
    case_number: "MPD-2024-1011",
    department: "Metro PD",
    incident_type: "DUI Arrest",
    supervisor: "Sgt. M. Rodriguez",
    weather: "Clear, dry roadway, 62 F",
    narrative: "Officer R. Alvarez observed the vehicle stopped partially in lane one, contacted the driver, and documented signs of alcohol impairment in chronological order. The driver completed SFSTs with HGN 6/6 clues, Walk and Turn 4/8 clues, and One Leg Stand 3/4 clues before arrest.",
    miranda: { time: "2248 hours", officer: "Officer R. Alvarez", suspect_response: "I understand and I will talk." },
    vehicle: { year: "2018", make: "Toyota", model: "Camry", color: "silver", plate: "7ABC219" },
    property: { tow: "Vehicle towed by Metro Towing under inventory hold." },
    charges: ["CVC 23152a", "CVC 23152b"],
    supervisor_notes: "Sgt. Rodriguez approved after confirming exact SFST clue fractions, full vehicle description, Miranda time, officer, and quoted response."
  },
  {
    case_number: "MPD-2024-1172",
    department: "Metro PD",
    incident_type: "DUI Arrest",
    supervisor: "Sgt. M. Rodriguez",
    weather: "Light rain, wet roadway, 55 F",
    narrative: "Officer L. Patel responded to a disabled vehicle call, contacted the driver at the curb, and wrote the report as a chronological third-person narrative. The report included HGN 6/6 clues, Walk and Turn 5/8 clues, and One Leg Stand 2/4 clues.",
    miranda: { time: "0112 hours", officer: "Officer L. Patel", suspect_response: "Yes, I understand." },
    vehicle: { year: "2020", make: "Honda", model: "Accord", color: "black", plate: "8MRK442" },
    property: { tow: "Vehicle released to Metro Towing after inventory." },
    charges: ["CVC 23152a", "CVC 23152b"],
    supervisor_notes: "Sgt. Rodriguez requested consistent ordering: contact, observations, SFST clue counts, arrest, Miranda, tow, and charges."
  },
  {
    case_number: "MPD-2024-1304",
    department: "Metro PD",
    incident_type: "DUI Arrest",
    supervisor: "Sgt. M. Rodriguez",
    weather: "Foggy, damp roadway, 50 F",
    narrative: "Officer T. Nguyen investigated a single-vehicle collision and documented each event chronologically in third person. SFST results were recorded as HGN 6/6 clues, Walk and Turn 4/8 clues, and One Leg Stand 4/4 clues.",
    miranda: { time: "0327 hours", officer: "Officer T. Nguyen", suspect_response: "I want an attorney." },
    vehicle: { year: "2017", make: "Nissan", model: "Altima", color: "gray", plate: "7LQZ908" },
    property: { tow: "Metro Towing removed the vehicle due to collision damage." },
    charges: ["CVC 23152a", "CVC 23152b"],
    supervisor_notes: "Sgt. Rodriguez noted that quoted Miranda responses must not be paraphrased."
  },
  {
    case_number: "MPD-2025-0049",
    department: "Metro PD",
    incident_type: "DUI Arrest",
    supervisor: "Sgt. M. Rodriguez",
    weather: "Cloudy, dry roadway, 58 F",
    narrative: "Officer N. Brooks stopped the vehicle for weaving, contacted the driver, and documented the DUI investigation in a chronological third-person format. SFST clue counts were HGN 6/6, Walk and Turn 3/8, and One Leg Stand 3/4.",
    miranda: { time: "2359 hours", officer: "Officer N. Brooks", suspect_response: "I understand but I do not want to answer." },
    vehicle: { year: "2022", make: "Chevrolet", model: "Malibu", color: "blue", plate: "9CDE551" },
    property: { tow: "Vehicle towed by Metro Towing and logged on property sheet." },
    charges: ["CVC 23152a", "CVC 23152b"],
    supervisor_notes: "Sgt. Rodriguez returned the first draft until it included the full year, make, model, color, and plate."
  },
  {
    case_number: "MPD-2025-0126",
    department: "Metro PD",
    incident_type: "DUI Arrest",
    supervisor: "Sgt. M. Rodriguez",
    weather: "Clear, dry roadway, 64 F",
    narrative: "Officer K. Morgan contacted the driver after a property damage collision and prepared a chronological third-person report. The driver showed HGN 6/6 clues, Walk and Turn 4/8 clues, and One Leg Stand 3/4 clues.",
    miranda: { time: "0041 hours", officer: "Officer K. Morgan", suspect_response: "Yes, I understand and I want a lawyer." },
    vehicle: { year: "2019", make: "Ford", model: "F-150", color: "white", plate: "8TRK102" },
    property: { tow: "Metro Towing completed the tow from the collision scene." },
    charges: ["CVC 23152a", "CVC 23152b"],
    supervisor_notes: "Sgt. Rodriguez emphasized that tow information belongs in the property section and charges must include both CVC 23152a and CVC 23152b."
  }
] as const;

export const SUPERVISOR_FEEDBACK = [
  {
    source: "Slack",
    channel: "#reporting-feedback",
    author: "Sgt. Rodriguez",
    timestamp: "2024-06-12T14:30:00Z",
    content: "For DUI reports, include exact SFST clue counts as fractions for HGN, Walk and Turn, and One Leg Stand."
  },
  {
    source: "Email",
    author: "Legal Division",
    timestamp: "2024-09-15T10:00:00Z",
    content: "Miranda documentation must state the exact advisement time, the officer who gave it, and the suspect's quoted response."
  },
  {
    source: "Slack",
    channel: "#reporting-feedback",
    author: "Sgt. Rodriguez",
    timestamp: "2024-11-15T16:45:00Z",
    content: "Vehicle descriptions must be complete: year, make, model, color, and license plate."
  }
] as const;

export const POLICIES = {
  miranda: `# Metro PD Miranda Documentation Policy

DUI arrest reports must document Miranda advisement with the exact time, the officer who provided the advisement, and the suspect's quoted response. Reports should not paraphrase the suspect response when exact words are available.`,
  sfst: `# Metro PD SFST Documentation Policy

DUI arrest reports must include exact SFST clue counts as fractions for each administered test. HGN, Walk and Turn, and One Leg Stand must be listed separately when performed.`
};

export const EVIDENCE = {
  bodycam: {
    evidence_type: "bodycam",
    recording_start: "2025-05-09T01:47:10Z",
    source_ref: "bodycam:BC-4821-2025-0519",
    transcript: [
      { offset_seconds: 15, speaker: "Officer Chen", text: "I am Officer J. Chen with Metro PD. I am at 780 Elm Street contacting the driver of a white SUV, plate 8XYZ321." },
      { offset_seconds: 38, speaker: "David Kowalski", text: "I was coming from Mike's place on 5th. I had a couple drinks." },
      { offset_seconds: 190, speaker: "Officer Chen", text: "HGN shows six out of six clues." },
      { offset_seconds: 312, speaker: "Officer Chen", text: "Walk and Turn shows four out of eight clues." },
      { offset_seconds: 410, speaker: "Officer Chen", text: "The driver remained at the scene beside the white SUV during the investigation." },
      { offset_seconds: 412, speaker: "Officer Chen", text: "One Leg Stand shows three out of four clues." },
      { offset_seconds: 413, speaker: "Officer Chen", text: "David Kowalski is placed under arrest for DUI." },
      { offset_seconds: 414, speaker: "Officer Chen", text: "At 0154 hours, I advised David Kowalski of Miranda." },
      { offset_seconds: 420, speaker: "David Kowalski", text: "I understand and I want a lawyer." }
    ]
  },
  dispatch: {
    incident_id: "CAD-2025-0519-0087",
    call_type: "TRAFFIC - HIT AND RUN / PROPERTY DAMAGE",
    received: "2025-05-09T01:42:33Z",
    address: "780 ELM ST",
    beat: "3A",
    division: "Central",
    units: [{ unit: "4821", officer: "Chen, J.", arrived: "01:47:05" }]
  },
  "officer-notes": {
    source_ref: "notes:OFFICER-CHEN-4821",
    notes: 'Driver David Kowalski, DOB 1987-04-18, CA DL D1234567. Vehicle is a white 2021 Ford Escape CA 8XYZ321. SFST counts: HGN 6/6, Walk and Turn 4/8, One Leg Stand 3/4. Miranda provided by Officer J. Chen at 0154 hours; Kowalski stated, "I understand and I want a lawyer." Transport by Officer Patel 5123. Vehicle towed by Metro Towing. Fence owner Marcus Williams, 782 Elm St.'
  }
} as const;
