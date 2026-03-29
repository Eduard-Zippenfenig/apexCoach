// Mock data for Apex Coach phone app

export const driver = {
  name: "Alex Mercer",
  level: 12,
  rank: "Intermediate",
  xp: 2840,
  xpNext: 3500,
  favoriteTrack: "Yas Marina",
  coachingStyle: "Direct",
  avatar: null,
  streak: 5,
  totalSessions: 11,
  totalLaps: 67,
  memberSince: "2025-09-15",
};

export const skills = [
  { name: "Braking", score: 71, change: 4, icon: "Gauge" },
  { name: "Corner Entry", score: 68, change: 2, icon: "CornerDownRight" },
  { name: "Apex Accuracy", score: 62, change: -1, icon: "Target" },
  { name: "Exit Speed", score: 64, change: 5, icon: "Zap" },
  { name: "Smoothness", score: 78, change: 3, icon: "Waves" },
  { name: "Consistency", score: 82, change: 6, icon: "TrendingUp" },
  { name: "Confidence", score: 70, change: 2, icon: "Shield" },
  { name: "Racecraft", score: 45, change: 0, icon: "Flag" },
];

export const badges = [
  { name: "First Clean Lap", earned: true, icon: "CheckCircle2", date: "2025-10-02" },
  { name: "Yas Marina Bronze", earned: true, icon: "Medal", date: "2025-11-18" },
  { name: "5 Session Streak", earned: true, icon: "Flame", date: "2026-03-20" },
  { name: "Sector Specialist", earned: true, icon: "MapPin", date: "2026-02-14" },
  { name: "Braking Improved", earned: true, icon: "Gauge", date: "2026-03-10" },
  { name: "Yas Marina Silver", earned: false, icon: "Medal", date: null },
  { name: "10 Session Streak", earned: false, icon: "Flame", date: null },
  { name: "Personal Best Broken", earned: false, icon: "Trophy", date: null },
  { name: "Consistency Master", earned: false, icon: "Target", date: null },
];

export interface Session {
  id: string;
  track: string;
  date: string;
  time: string;
  car: string;
  tyres: string;
  mode: string;
  bestLap: string;
  avgLap: string;
  referenceLap: string;
  totalLaps: number;
  consistency: number;
  brakingScore: number;
  exitScore: number;
  smoothness: number;
  cornerEntry: number;
  apexAccuracy: number;
  weather: string;
  trackCondition: string;
  favorite: boolean;
  sectors: { sector: number; time: string; delta: string; best: boolean }[];
  lapTimes: string[];
  strengths: string[];
  mistakes: string[];
  coachSummary: string;
  corners: {
    name: string;
    entrySpeed: number;
    apexSpeed: number;
    exitSpeed: number;
    brakePoint: string;
    throttlePickup: string;
    timeLost: string;
    comment: string;
  }[];
  recommendations: string[];
}

export const sessions: Session[] = [
  {
    id: "s1",
    track: "Yas Marina",
    date: "2026-03-28",
    time: "16:40",
    car: "BMW M2 Track",
    tyres: "Semi-slick",
    mode: "Push",
    bestLap: "1:21.4",
    avgLap: "1:23.1",
    referenceLap: "1:14.8",
    totalLaps: 5,
    consistency: 82,
    brakingScore: 71,
    exitScore: 64,
    smoothness: 78,
    cornerEntry: 68,
    apexAccuracy: 62,
    weather: "Clear, 34°C",
    trackCondition: "Dry",
    favorite: true,
    sectors: [
      { sector: 1, time: "28.2", delta: "-0.3", best: true },
      { sector: 2, time: "25.8", delta: "+0.4", best: false },
      { sector: 3, time: "27.4", delta: "+1.2", best: false },
    ],
    lapTimes: ["1:23.8", "1:22.6", "1:21.4", "1:23.1", "1:24.0"],
    strengths: ["Strong braking into Turn 1", "Good throttle modulation in Sector 1", "Consistent cornering speed in high-speed sections"],
    mistakes: ["Late apex in Turn 7", "Early braking into Turn 11", "Inconsistent exit speed in Sector 3"],
    coachSummary: "Solid session with clear improvement in braking zones. Sector 1 is your strongest area. Focus next on Sector 3 corner exits — this is where the biggest time gains remain. Your smoothness improved noticeably from last session.",
    corners: [
      { name: "Turn 1", entrySpeed: 185, apexSpeed: 92, exitSpeed: 135, brakePoint: "Good", throttlePickup: "Early", timeLost: "-0.1s", comment: "Strong entry, good trail brake" },
      { name: "Turn 5", entrySpeed: 162, apexSpeed: 78, exitSpeed: 124, brakePoint: "Good", throttlePickup: "On Time", timeLost: "+0.0s", comment: "Clean execution" },
      { name: "Turn 7", entrySpeed: 145, apexSpeed: 65, exitSpeed: 110, brakePoint: "Late", throttlePickup: "Late", timeLost: "+0.4s", comment: "Late apex, compromised exit" },
      { name: "Turn 8/9", entrySpeed: 130, apexSpeed: 58, exitSpeed: 118, brakePoint: "Good", throttlePickup: "On Time", timeLost: "+0.1s", comment: "Good chicane flow" },
      { name: "Turn 11", entrySpeed: 178, apexSpeed: 85, exitSpeed: 128, brakePoint: "Early", throttlePickup: "Late", timeLost: "+0.6s", comment: "Braked too early, lost momentum" },
      { name: "Turn 14", entrySpeed: 155, apexSpeed: 72, exitSpeed: 115, brakePoint: "Good", throttlePickup: "On Time", timeLost: "+0.2s", comment: "Slightly wide on exit" },
    ],
    recommendations: [
      "Focus on later braking into Turn 11 — you're leaving 0.6s on the table",
      "Work on apex accuracy in Turn 7 — tighter line will improve exit speed",
      "Your Sector 1 is within 0.3s of reference — push corner exits to match",
    ],
  },
  {
    id: "s2",
    track: "Yas Marina",
    date: "2026-03-21",
    time: "15:20",
    car: "BMW M2 Track",
    tyres: "Semi-slick",
    mode: "Learn",
    bestLap: "1:22.8",
    avgLap: "1:24.5",
    referenceLap: "1:14.8",
    totalLaps: 8,
    consistency: 76,
    brakingScore: 67,
    exitScore: 60,
    smoothness: 75,
    cornerEntry: 65,
    apexAccuracy: 60,
    weather: "Clear, 32°C",
    trackCondition: "Dry",
    favorite: false,
    sectors: [
      { sector: 1, time: "28.6", delta: "+0.1", best: false },
      { sector: 2, time: "26.0", delta: "+0.6", best: false },
      { sector: 3, time: "28.2", delta: "+2.0", best: false },
    ],
    lapTimes: ["1:26.1", "1:25.3", "1:24.0", "1:23.5", "1:22.8", "1:24.2", "1:24.8", "1:25.0"],
    strengths: ["Good learning pace", "Consistent improvement through session"],
    mistakes: ["Overdriving in Sector 3", "Inconsistent braking points"],
    coachSummary: "Good learning session. Your lap times improved steadily through the session showing good adaptation. Braking consistency needs work.",
    corners: [
      { name: "Turn 1", entrySpeed: 180, apexSpeed: 90, exitSpeed: 130, brakePoint: "Good", throttlePickup: "On Time", timeLost: "+0.2s", comment: "Solid entry" },
      { name: "Turn 7", entrySpeed: 142, apexSpeed: 62, exitSpeed: 105, brakePoint: "Early", throttlePickup: "Late", timeLost: "+0.8s", comment: "Needs more confidence" },
      { name: "Turn 11", entrySpeed: 175, apexSpeed: 82, exitSpeed: 122, brakePoint: "Early", throttlePickup: "Late", timeLost: "+0.9s", comment: "Conservative approach" },
    ],
    recommendations: ["Build confidence in braking zones", "Focus on consistent brake points"],
  },
  {
    id: "s3",
    track: "Yas Marina",
    date: "2026-03-14",
    time: "10:00",
    car: "Porsche Cayman GT4",
    tyres: "Sport",
    mode: "Push",
    bestLap: "1:19.6",
    avgLap: "1:21.2",
    referenceLap: "1:14.8",
    totalLaps: 6,
    consistency: 85,
    brakingScore: 74,
    exitScore: 68,
    smoothness: 80,
    cornerEntry: 72,
    apexAccuracy: 66,
    weather: "Partly cloudy, 28°C",
    trackCondition: "Dry",
    favorite: true,
    sectors: [
      { sector: 1, time: "27.0", delta: "-0.8", best: true },
      { sector: 2, time: "25.2", delta: "-0.2", best: true },
      { sector: 3, time: "27.4", delta: "+1.2", best: false },
    ],
    lapTimes: ["1:21.8", "1:20.4", "1:19.6", "1:20.8", "1:21.2", "1:23.4"],
    strengths: ["Excellent Sector 1 performance", "Great car control", "Strong braking"],
    mistakes: ["Tyre degradation in final laps", "Still losing time in Sector 3"],
    coachSummary: "Your best session yet at Yas Marina. The Cayman GT4 suits your driving style. Sector 1 and 2 are approaching reference pace. Sector 3 remains the focus area.",
    corners: [],
    recommendations: ["Manage tyre life better in final laps", "Sector 3 exits are your biggest opportunity"],
  },
  {
    id: "s4",
    track: "Monza",
    date: "2026-02-15",
    time: "11:30",
    car: "Ferrari 488 Challenge",
    tyres: "Slick",
    mode: "Push",
    bestLap: "1:48.2",
    avgLap: "1:50.8",
    referenceLap: "1:42.5",
    totalLaps: 7,
    consistency: 79,
    brakingScore: 72,
    exitScore: 70,
    smoothness: 76,
    cornerEntry: 69,
    apexAccuracy: 64,
    weather: "Overcast, 12°C",
    trackCondition: "Dry",
    favorite: false,
    sectors: [
      { sector: 1, time: "35.2", delta: "+1.8", best: false },
      { sector: 2, time: "38.4", delta: "+2.1", best: false },
      { sector: 3, time: "34.6", delta: "+1.8", best: false },
    ],
    lapTimes: ["1:52.4", "1:50.6", "1:49.8", "1:48.2", "1:50.4", "1:51.2", "1:53.0"],
    strengths: ["Good top speed", "Brave under braking at T1"],
    mistakes: ["Chicane cutting", "Late braking at Lesmo"],
    coachSummary: "First time at Monza — solid introduction. Focus on chicane discipline and Lesmo braking points.",
    corners: [],
    recommendations: ["Learn the chicane rhythm", "Later braking into Lesmo 1"],
  },
  {
    id: "s5",
    track: "Monza",
    date: "2026-02-16",
    time: "14:00",
    car: "Ferrari 488 Challenge",
    tyres: "Slick",
    mode: "Learn",
    bestLap: "1:46.8",
    avgLap: "1:49.2",
    referenceLap: "1:42.5",
    totalLaps: 10,
    consistency: 83,
    brakingScore: 75,
    exitScore: 72,
    smoothness: 80,
    cornerEntry: 71,
    apexAccuracy: 68,
    weather: "Clear, 14°C",
    trackCondition: "Dry",
    favorite: true,
    sectors: [
      { sector: 1, time: "34.0", delta: "+0.6", best: true },
      { sector: 2, time: "37.6", delta: "+1.3", best: true },
      { sector: 3, time: "35.2", delta: "+2.4", best: false },
    ],
    lapTimes: ["1:50.2", "1:49.4", "1:48.6", "1:47.8", "1:46.8", "1:47.4", "1:48.0", "1:49.2", "1:50.0", "1:51.4"],
    strengths: ["Improved chicane flow", "Better Lesmo entries"],
    mistakes: ["Parabolica exit still inconsistent"],
    coachSummary: "Great improvement from yesterday. Chicane discipline much better. Parabolica needs focus.",
    corners: [],
    recommendations: ["Push Parabolica exit", "Work on Ascari flow"],
  },
  {
    id: "s6",
    track: "Spa",
    date: "2026-01-20",
    time: "09:00",
    car: "Porsche Cayman GT4",
    tyres: "Sport",
    mode: "Learn",
    bestLap: "2:28.4",
    avgLap: "2:32.6",
    referenceLap: "2:18.0",
    totalLaps: 4,
    consistency: 72,
    brakingScore: 65,
    exitScore: 58,
    smoothness: 70,
    cornerEntry: 63,
    apexAccuracy: 55,
    weather: "Light rain, 6°C",
    trackCondition: "Damp",
    favorite: false,
    sectors: [
      { sector: 1, time: "52.4", delta: "+3.2", best: false },
      { sector: 2, time: "48.8", delta: "+4.0", best: false },
      { sector: 3, time: "47.2", delta: "+3.2", best: false },
    ],
    lapTimes: ["2:35.0", "2:32.6", "2:30.2", "2:28.4"],
    strengths: ["Good wet weather caution", "Steady improvement"],
    mistakes: ["Too cautious at Eau Rouge", "Inconsistent at Bus Stop"],
    coachSummary: "Challenging conditions for a first Spa visit. Good safe approach. Build confidence gradually.",
    corners: [],
    recommendations: ["Return in dry conditions", "Build Eau Rouge confidence"],
  },
];

export const tracks = [
  {
    id: "yas-marina",
    name: "Yas Marina",
    country: "UAE",
    length: "5.281 km",
    turns: 21,
    sessions: 8,
    totalLaps: 42,
    personalBest: "1:19.6",
    referenceLap: "1:14.8",
    mastery: 63,
    bestSector: 1,
    weakestSector: 3,
    featured: true,
    sectorPerformance: [
      { sector: 1, score: 82, label: "Strong" },
      { sector: 2, score: 71, label: "Good" },
      { sector: 3, score: 52, label: "Needs Work" },
    ],
    recentTrend: [1.238, 1.228, 1.224, 1.218, 1.214, 1.208, 1.196],
    achievements: ["Yas Marina Bronze", "Sector Specialist S1"],
  },
  {
    id: "monza",
    name: "Monza",
    country: "Italy",
    length: "5.793 km",
    turns: 11,
    sessions: 2,
    totalLaps: 17,
    personalBest: "1:46.8",
    referenceLap: "1:42.5",
    mastery: 38,
    bestSector: 1,
    weakestSector: 3,
    featured: false,
    sectorPerformance: [
      { sector: 1, score: 68, label: "Good" },
      { sector: 2, score: 55, label: "Average" },
      { sector: 3, score: 42, label: "Needs Work" },
    ],
    recentTrend: [1.482, 1.468],
    achievements: [],
  },
  {
    id: "spa",
    name: "Spa-Francorchamps",
    country: "Belgium",
    length: "7.004 km",
    turns: 19,
    sessions: 1,
    totalLaps: 4,
    personalBest: "2:28.4",
    referenceLap: "2:18.0",
    mastery: 18,
    bestSector: 3,
    weakestSector: 2,
    featured: false,
    sectorPerformance: [
      { sector: 1, score: 42, label: "Needs Work" },
      { sector: 2, score: 35, label: "Beginner" },
      { sector: 3, score: 48, label: "Needs Work" },
    ],
    recentTrend: [2.284],
    achievements: [],
  },
  {
    id: "silverstone",
    name: "Silverstone",
    country: "UK",
    length: "5.891 km",
    turns: 18,
    sessions: 0,
    totalLaps: 0,
    personalBest: "--",
    referenceLap: "1:28.0",
    mastery: 0,
    bestSector: 0,
    weakestSector: 0,
    featured: false,
    sectorPerformance: [],
    recentTrend: [],
    achievements: [],
  },
];

export const cars = [
  {
    id: "bmw-m2",
    name: "BMW M2 Track",
    drivetrain: "RWD",
    power: "460 HP",
    sessions: 5,
    bestLap: "1:21.4",
    bestTrack: "Yas Marina",
    avgConsistency: 79,
    tyresUsed: ["Semi-slick", "Sport"],
  },
  {
    id: "porsche-gt4",
    name: "Porsche Cayman GT4",
    drivetrain: "RWD",
    power: "420 HP",
    sessions: 4,
    bestLap: "1:19.6",
    bestTrack: "Yas Marina",
    avgConsistency: 78,
    tyresUsed: ["Sport"],
  },
  {
    id: "ferrari-488",
    name: "Ferrari 488 Challenge",
    drivetrain: "RWD",
    power: "670 HP",
    sessions: 2,
    bestLap: "1:46.8",
    bestTrack: "Monza",
    avgConsistency: 81,
    tyresUsed: ["Slick"],
  },
];

export const recommendations = [
  {
    id: "r1",
    title: "Focus on Sector 3 exits",
    description: "Your biggest time-loss area at Yas Marina is Sector 3 corner exits. Earlier throttle application at Turn 11 and Turn 14 could save you 0.8s per lap.",
    priority: "high",
    skill: "Exit Speed",
    track: "Yas Marina",
  },
  {
    id: "r2",
    title: "Later braking into medium-speed corners",
    description: "You're braking 5-8 meters too early into Turn 7 and Turn 11. Work on extending your brake point gradually.",
    priority: "high",
    skill: "Braking",
    track: "Yas Marina",
  },
  {
    id: "r3",
    title: "Consistency is your superpower",
    description: "Your consistency score improved by 6% this week. Keep this momentum — consistent drivers learn faster.",
    priority: "info",
    skill: "Consistency",
    track: null,
  },
  {
    id: "r4",
    title: "Try the Cayman GT4 at Monza",
    description: "Based on your driving style, the Cayman GT4's mid-engine balance could help you at Monza's fast corners.",
    priority: "medium",
    skill: "Racecraft",
    track: "Monza",
  },
  {
    id: "r5",
    title: "Smoothness improving",
    description: "Your input smoothness has improved 3 points. This is translating into better tyre life and more consistent lap times.",
    priority: "info",
    skill: "Smoothness",
    track: null,
  },
];

export const lapTrendData = [
  { session: "S1", lap: 84.2 },
  { session: "S2", lap: 83.5 },
  { session: "S3", lap: 82.8 },
  { session: "S4", lap: 83.1 },
  { session: "S5", lap: 82.6 },
  { session: "S6", lap: 81.8 },
  { session: "S7", lap: 82.2 },
  { session: "S8", lap: 81.4 },
];
