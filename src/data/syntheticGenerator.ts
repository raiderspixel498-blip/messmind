import {
  CalendarRecord,
  DatasetBundle,
  DayCategory,
  FoodPrepRecord,
  MealRecord,
  MealType,
} from '../types/mess';

// Deterministic PRNG for reproducible synthetic hostel mess data
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(rng: () => number, mean = 0, std = 1): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

interface MenuTemplate {
  name: string;
  popularityMultiplier: number; // 0.82 to 1.20
  items: {
    item_name: string;
    unit: 'kg' | 'L' | 'pcs';
    perStudent: number;
    volatility: number;
    staffBias: number; // mess staff tendency to over-prep specific items
  }[];
}

export const MENU_TEMPLATES: Record<MealType, MenuTemplate[]> = {
  Breakfast: [
    {
      name: 'Masala Dosa, Sambar, Coconut Chutney',
      popularityMultiplier: 1.15,
      items: [
        { item_name: 'Dosa Batter', unit: 'kg', perStudent: 0.24, volatility: 0.08, staffBias: 1.05 },
        { item_name: 'Sambar', unit: 'L', perStudent: 0.18, volatility: 0.12, staffBias: 1.12 },
        { item_name: 'Coconut Chutney', unit: 'kg', perStudent: 0.07, volatility: 0.15, staffBias: 1.15 },
        { item_name: 'Tea & Coffee', unit: 'L', perStudent: 0.19, volatility: 0.1, staffBias: 1.08 },
      ],
    },
    {
      name: 'Aloo Paratha, Curd, Pickle',
      popularityMultiplier: 1.1,
      items: [
        { item_name: 'Aloo Paratha', unit: 'pcs', perStudent: 2.3, volatility: 0.1, staffBias: 1.06 },
        { item_name: 'Curd', unit: 'kg', perStudent: 0.12, volatility: 0.12, staffBias: 1.1 },
        { item_name: 'Tea & Coffee', unit: 'L', perStudent: 0.2, volatility: 0.1, staffBias: 1.08 },
      ],
    },
    {
      name: 'Poha, Jalebi, Boiled Eggs',
      popularityMultiplier: 0.96,
      items: [
        { item_name: 'Kanda Poha', unit: 'kg', perStudent: 0.21, volatility: 0.14, staffBias: 1.18 },
        { item_name: 'Jalebi', unit: 'kg', perStudent: 0.08, volatility: 0.1, staffBias: 1.04 },
        { item_name: 'Tea & Coffee', unit: 'L', perStudent: 0.19, volatility: 0.1, staffBias: 1.1 },
      ],
    },
    {
      name: 'Rava Upma, Vada, Chutney',
      popularityMultiplier: 0.84,
      items: [
        { item_name: 'Rava Upma', unit: 'kg', perStudent: 0.19, volatility: 0.18, staffBias: 1.28 },
        { item_name: 'Medu Vada', unit: 'pcs', perStudent: 2.0, volatility: 0.12, staffBias: 1.08 },
        { item_name: 'Coconut Chutney', unit: 'kg', perStudent: 0.07, volatility: 0.15, staffBias: 1.14 },
      ],
    },
    {
      name: 'Chole Bhature, Lassi',
      popularityMultiplier: 1.18,
      items: [
        { item_name: 'Bhature', unit: 'pcs', perStudent: 2.4, volatility: 0.09, staffBias: 1.02 },
        { item_name: 'Chole Masala', unit: 'kg', perStudent: 0.2, volatility: 0.1, staffBias: 1.05 },
        { item_name: 'Sweet Lassi', unit: 'L', perStudent: 0.22, volatility: 0.08, staffBias: 1.02 },
      ],
    },
  ],
  Lunch: [
    {
      name: 'Paneer Butter Masala, Jeera Rice, Roti, Dal Fry',
      popularityMultiplier: 1.16,
      items: [
        { item_name: 'Paneer Butter Masala', unit: 'kg', perStudent: 0.18, volatility: 0.08, staffBias: 1.03 },
        { item_name: 'Jeera Rice', unit: 'kg', perStudent: 0.2, volatility: 0.11, staffBias: 1.1 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 3.1, volatility: 0.1, staffBias: 1.08 },
        { item_name: 'Dal Fry', unit: 'L', perStudent: 0.16, volatility: 0.14, staffBias: 1.16 },
      ],
    },
    {
      name: 'Veg Biryani, Mirchi Ka Salan, Boondi Raita',
      popularityMultiplier: 1.2,
      items: [
        { item_name: 'Veg Biryani', unit: 'kg', perStudent: 0.34, volatility: 0.08, staffBias: 1.02 },
        { item_name: 'Boondi Raita', unit: 'L', perStudent: 0.13, volatility: 0.12, staffBias: 1.08 },
        { item_name: 'Mirchi Salan', unit: 'L', perStudent: 0.1, volatility: 0.16, staffBias: 1.22 },
      ],
    },
    {
      name: 'Rajma Masala, Steamed Rice, Aloo Gobhi, Roti',
      popularityMultiplier: 1.05,
      items: [
        { item_name: 'Rajma Masala', unit: 'kg', perStudent: 0.19, volatility: 0.1, staffBias: 1.08 },
        { item_name: 'Steamed Rice', unit: 'kg', perStudent: 0.21, volatility: 0.13, staffBias: 1.16 },
        { item_name: 'Aloo Gobhi', unit: 'kg', perStudent: 0.13, volatility: 0.14, staffBias: 1.15 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 3.0, volatility: 0.1, staffBias: 1.1 },
      ],
    },
    {
      name: 'Kadhi Pakora, Steamed Rice, Bhindi Fry, Roti',
      popularityMultiplier: 0.91,
      items: [
        { item_name: 'Kadhi Pakora', unit: 'L', perStudent: 0.18, volatility: 0.15, staffBias: 1.21 },
        { item_name: 'Steamed Rice', unit: 'kg', perStudent: 0.21, volatility: 0.13, staffBias: 1.18 },
        { item_name: 'Bhindi Fry', unit: 'kg', perStudent: 0.12, volatility: 0.11, staffBias: 1.1 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 2.9, volatility: 0.11, staffBias: 1.12 },
      ],
    },
    {
      name: 'Dal Makhani, Veg Pulao, Mix Veg, Roti',
      popularityMultiplier: 1.08,
      items: [
        { item_name: 'Dal Makhani', unit: 'kg', perStudent: 0.18, volatility: 0.1, staffBias: 1.08 },
        { item_name: 'Veg Pulao', unit: 'kg', perStudent: 0.21, volatility: 0.12, staffBias: 1.14 },
        { item_name: 'Mix Veg Sabzi', unit: 'kg', perStudent: 0.12, volatility: 0.15, staffBias: 1.19 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 3.0, volatility: 0.1, staffBias: 1.1 },
      ],
    },
  ],
  Snacks: [
    {
      name: 'Samosa, Tamarind Chutney, Masala Chai',
      popularityMultiplier: 1.16,
      items: [
        { item_name: 'Samosa', unit: 'pcs', perStudent: 1.9, volatility: 0.08, staffBias: 1.04 },
        { item_name: 'Masala Chai', unit: 'L', perStudent: 0.2, volatility: 0.1, staffBias: 1.08 },
      ],
    },
    {
      name: 'Bread Pakora, Green Chutney, Tea',
      popularityMultiplier: 1.02,
      items: [
        { item_name: 'Bread Pakora', unit: 'pcs', perStudent: 1.7, volatility: 0.12, staffBias: 1.12 },
        { item_name: 'Masala Chai', unit: 'L', perStudent: 0.19, volatility: 0.1, staffBias: 1.1 },
      ],
    },
    {
      name: 'Veg Maggi / Pasta, Cold Coffee',
      popularityMultiplier: 1.14,
      items: [
        { item_name: 'Masala Pasta', unit: 'kg', perStudent: 0.18, volatility: 0.09, staffBias: 1.05 },
        { item_name: 'Cold Coffee', unit: 'L', perStudent: 0.22, volatility: 0.09, staffBias: 1.03 },
      ],
    },
    {
      name: 'Bhel Puri, Nimbu Pani',
      popularityMultiplier: 0.87,
      items: [
        { item_name: 'Bhel Mix', unit: 'kg', perStudent: 0.14, volatility: 0.16, staffBias: 1.24 },
        { item_name: 'Nimbu Pani', unit: 'L', perStudent: 0.22, volatility: 0.14, staffBias: 1.18 },
      ],
    },
  ],
  Dinner: [
    {
      name: 'Chana Masala, Tandoori Roti, Steamed Rice, Gulab Jamun',
      popularityMultiplier: 1.14,
      items: [
        { item_name: 'Chana Masala', unit: 'kg', perStudent: 0.18, volatility: 0.1, staffBias: 1.07 },
        { item_name: 'Tandoori Roti', unit: 'pcs', perStudent: 3.1, volatility: 0.09, staffBias: 1.05 },
        { item_name: 'Steamed Rice', unit: 'kg', perStudent: 0.17, volatility: 0.15, staffBias: 1.2 },
        { item_name: 'Gulab Jamun', unit: 'pcs', perStudent: 1.9, volatility: 0.06, staffBias: 1.02 },
      ],
    },
    {
      name: 'Dal Tadka, Jeera Rice, Lauki Chana, Roti',
      popularityMultiplier: 0.85,
      items: [
        { item_name: 'Dal Tadka', unit: 'L', perStudent: 0.18, volatility: 0.14, staffBias: 1.18 },
        { item_name: 'Jeera Rice', unit: 'kg', perStudent: 0.19, volatility: 0.14, staffBias: 1.19 },
        { item_name: 'Lauki Sabzi', unit: 'kg', perStudent: 0.11, volatility: 0.2, staffBias: 1.32 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 2.9, volatility: 0.11, staffBias: 1.12 },
      ],
    },
    {
      name: 'Palak Paneer, Dal Fry, Steamed Rice, Roti',
      popularityMultiplier: 1.11,
      items: [
        { item_name: 'Palak Paneer', unit: 'kg', perStudent: 0.18, volatility: 0.09, staffBias: 1.05 },
        { item_name: 'Dal Fry', unit: 'L', perStudent: 0.15, volatility: 0.13, staffBias: 1.15 },
        { item_name: 'Steamed Rice', unit: 'kg', perStudent: 0.18, volatility: 0.14, staffBias: 1.17 },
        { item_name: 'Phulka Roti', unit: 'pcs', perStudent: 3.0, volatility: 0.1, staffBias: 1.08 },
      ],
    },
    {
      name: 'Moong Dal Khichdi, Curd, Papad, Aloo Chokha',
      popularityMultiplier: 0.82,
      items: [
        { item_name: 'Moong Dal Khichdi', unit: 'kg', perStudent: 0.26, volatility: 0.17, staffBias: 1.26 },
        { item_name: 'Curd', unit: 'kg', perStudent: 0.11, volatility: 0.12, staffBias: 1.12 },
        { item_name: 'Aloo Chokha', unit: 'kg', perStudent: 0.1, volatility: 0.15, staffBias: 1.18 },
      ],
    },
    {
      name: 'Veg Manchurian, Fried Rice, Hakka Noodles',
      popularityMultiplier: 1.18,
      items: [
        { item_name: 'Veg Manchurian', unit: 'kg', perStudent: 0.17, volatility: 0.08, staffBias: 1.03 },
        { item_name: 'Veg Fried Rice', unit: 'kg', perStudent: 0.2, volatility: 0.1, staffBias: 1.06 },
        { item_name: 'Hakka Noodles', unit: 'kg', perStudent: 0.18, volatility: 0.1, staffBias: 1.05 },
      ],
    },
  ],
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateSyntheticDataset(daysCount = 90): DatasetBundle {
  const rng = createRng(20261125);
  const startDate = new Date('2026-08-27T00:00:00');

  const calendar: CalendarRecord[] = [];
  const meals: MealRecord[] = [];
  const foodPrep: FoodPrepRecord[] = [];

  const registeredHostelers = 500;

  for (let i = 0; i < daysCount; i++) {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + i);
    const dateStr = formatDateISO(current);
    const dowIdx = current.getDay();
    const dow = DAYS_OF_WEEK[dowIdx];
    const isWeekend = dowIdx === 0 || dowIdx === 6;

    let dayCategory: DayCategory = isWeekend ? 'Weekend' : 'Academic';
    let eventName = isWeekend ? `${dow} Weekend` : 'Regular Classes';
    let impact = isWeekend ? 'Reduced hostel presence (-18% to -28%)' : 'Standard academic turnout';

    // Realistic campus calendar cycles over 90 days
    if (i >= 18 && i <= 24) {
      dayCategory = 'Examination';
      eventName = 'Mid-Semester Examinations';
      impact = 'Late-night prep: Breakfast drops -18%, Snacks surge +14%';
    } else if (i === 34 || i === 35 || i === 36) {
      dayCategory = 'Vacation';
      eventName = 'Mid-Term Break';
      impact = 'Major student travel out of campus (-50% attendance)';
    } else if (i === 8 || i === 51 || i === 72) {
      dayCategory = 'Holiday';
      eventName = i === 8 ? 'Regional Public Holiday' : i === 51 ? 'National Holiday' : 'Founder Day Holiday';
      impact = 'Off-campus outings & late brunch (-36% attendance)';
    } else if (i >= 44 && i <= 46) {
      dayCategory = 'Campus Event';
      eventName = 'Annual Tech & Cultural Fest';
      impact = 'High daytime campus footfall (+18% Lunch), evening food-stalls dip Dinner (-14%)';
    } else if (i >= 79 && i <= 86) {
      dayCategory = 'Examination';
      eventName = 'End-Semester Examinations';
      impact = 'Intense study schedule: Breakfast -20%, Snacks +16%';
    }

    calendar.push({
      date: dateStr,
      day_of_week: dow,
      day_category: dayCategory,
      event_name: eventName,
      attendance_impact: impact,
    });

    const mealTypes: MealType[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

    for (const mealType of mealTypes) {
      const templates = MENU_TEMPLATES[mealType];
      // Deterministic yet varied menu rotation
      const menuIdx = (i + (mealType === 'Breakfast' ? 0 : mealType === 'Lunch' ? 2 : mealType === 'Snacks' ? 1 : 3)) % templates.length;
      const menuTpl = templates[menuIdx];

      // True underlying attendance mechanics
      let baseRate =
        mealType === 'Breakfast'
          ? 0.68
          : mealType === 'Lunch'
          ? 0.84
          : mealType === 'Snacks'
          ? 0.62
          : 0.79;

      // Day of week modifiers
      if (dowIdx === 5 && mealType === 'Dinner') baseRate *= 0.82; // Friday night outings
      if (dowIdx === 6) {
        if (mealType === 'Breakfast') baseRate *= 0.73;
        else if (mealType === 'Lunch') baseRate *= 0.84;
        else if (mealType === 'Snacks') baseRate *= 0.78;
        else baseRate *= 0.85;
      }
      if (dowIdx === 0) {
        if (mealType === 'Breakfast') baseRate *= 0.68;
        else if (mealType === 'Lunch') baseRate *= 0.88;
        else if (mealType === 'Snacks') baseRate *= 0.8;
        else baseRate *= 0.89;
      }
      if (dowIdx === 1 && mealType === 'Breakfast') baseRate *= 1.04;

      // Calendar category modifiers
      if (dayCategory === 'Examination') {
        if (mealType === 'Breakfast') baseRate *= 0.82;
        else if (mealType === 'Lunch') baseRate *= 0.93;
        else if (mealType === 'Snacks') baseRate *= 1.15;
        else baseRate *= 0.91;
      } else if (dayCategory === 'Holiday') {
        baseRate *= mealType === 'Breakfast' ? 0.62 : 0.68;
      } else if (dayCategory === 'Vacation') {
        baseRate *= 0.48;
      } else if (dayCategory === 'Campus Event') {
        if (mealType === 'Lunch') baseRate *= 1.18;
        else if (mealType === 'Snacks') baseRate *= 1.15;
        else if (mealType === 'Dinner') baseRate *= 0.86;
      }

      // Menu popularity pull
      baseRate *= menuTpl.popularityMultiplier;

      // Slight semester drift (-3% over 90 days as students settle into routines)
      const drift = 1 - (i / daysCount) * 0.035;
      baseRate *= drift;

      // Rare realistic anomaly (e.g., sudden heavy rain or off-campus excursion on day 61)
      let eventNote = eventName;
      let anomalyFactor = 1;
      if (i === 61 && (mealType === 'Snacks' || mealType === 'Dinner')) {
        anomalyFactor = 0.66;
        eventNote = 'Heavy Monsoon Storm — sudden dip';
      } else if (i === 28 && mealType === 'Lunch') {
        anomalyFactor = 1.16;
        eventNote = 'Visiting Inter-College Sports Delegation';
      }

      const rawMean = registeredHostelers * baseRate * anomalyFactor;
      const actualStudents = Math.max(
        90,
        Math.min(registeredHostelers + 40, Math.round(rawMean + normalSample(rng, 0, 14)))
      );

      // Mess Staff Historical Planning Behavior:
      // Staff mostly use a rigid static expectation per meal with slow/partial weekend adjustment,
      // which creates realistic over-prep on weekends/exams/low-appeal menus and occasional under-prep on Biryani/Fest days!
      const staticStaffBase =
        mealType === 'Breakfast'
          ? 355
          : mealType === 'Lunch'
          ? 435
          : mealType === 'Snacks'
          ? 325
          : 410;
      const staffWeekendTrim = isWeekend ? 0.91 : 1.0;
      const staffHolidayTrim = dayCategory === 'Vacation' ? 0.65 : dayCategory === 'Holiday' ? 0.85 : 1.0;
      const staffExpected = Math.round(
        staticStaffBase * staffWeekendTrim * staffHolidayTrim + normalSample(rng, 0, 10)
      );

      meals.push({
        date: dateStr,
        meal_type: mealType,
        menu: menuTpl.name,
        expected_students: staffExpected,
        actual_students: actualStudents,
        event_info: eventNote,
      });

      // Item-wise food prep records
      for (const item of menuTpl.items) {
        // Actual per-student consumption has realistic meal-to-meal variance
        const perStudentActual = Math.max(
          item.perStudent * 0.6,
          item.perStudent * (1 + normalSample(rng, 0, item.volatility))
        );
        const trueDemand = actualStudents * perStudentActual;

        // Staff prepares for staffExpected * standard perStudent * item staffBias
        const preparedQtyRaw = staffExpected * item.perStudent * item.staffBias;
        const preparedQty = item.unit === 'pcs' ? Math.round(preparedQtyRaw) : Number(preparedQtyRaw.toFixed(1));

        const consumedQtyRaw = Math.min(preparedQty, trueDemand);
        const consumedQty = item.unit === 'pcs' ? Math.round(consumedQtyRaw) : Number(consumedQtyRaw.toFixed(1));

        const leftoverQtyRaw = Math.max(0, preparedQty - consumedQty);
        const leftoverQty = item.unit === 'pcs' ? Math.round(leftoverQtyRaw) : Number(leftoverQtyRaw.toFixed(1));

        foodPrep.push({
          date: dateStr,
          meal_type: mealType,
          item_name: item.item_name,
          unit: item.unit,
          prepared_qty: preparedQty,
          consumed_qty: consumedQty,
          leftover_qty: leftoverQty,
        });
      }
    }
  }

  return {
    meals,
    foodPrep,
    calendar,
    sourceLabel: 'Built-in 90-Day Hostel Mess Dataset (360 Meals · 1,242 Prep Logs)',
  };
}

// Convert records back to CSV string for download/inspection
function escapeCSV(val: string | number): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeMealsCSV(rows: MealRecord[]): string {
  const header = 'date,meal_type,menu,expected_students,actual_students,event_info';
  const lines = rows.map((r) =>
    [r.date, r.meal_type, r.menu, r.expected_students, r.actual_students, r.event_info]
      .map(escapeCSV)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export function serializeFoodPrepCSV(rows: FoodPrepRecord[]): string {
  const header = 'date,meal_type,item_name,unit,prepared_qty,consumed_qty,leftover_qty';
  const lines = rows.map((r) =>
    [r.date, r.meal_type, r.item_name, r.unit, r.prepared_qty, r.consumed_qty, r.leftover_qty]
      .map(escapeCSV)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export function serializeCalendarCSV(rows: CalendarRecord[]): string {
  const header = 'date,day_of_week,day_category,event_name,attendance_impact';
  const lines = rows.map((r) =>
    [r.date, r.day_of_week, r.day_category, r.event_name, r.attendance_impact]
      .map(escapeCSV)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

// RFC-4180 compliant lightweight CSV parser
export function parseCSVTable(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = vals[idx] ?? '';
    });
    rows.push(rec);
  }
  return { headers, rows };
}

function normalizeMealType(raw: string): MealType {
  const v = (raw || '').toLowerCase();
  if (v.includes('break')) return 'Breakfast';
  if (v.includes('lunch')) return 'Lunch';
  if (v.includes('snack') || v.includes('tea') || v.includes('tiffin')) return 'Snacks';
  return 'Dinner';
}

function normalizeDayCategory(raw: string): DayCategory {
  const v = (raw || '').toLowerCase();
  if (v.includes('exam')) return 'Examination';
  if (v.includes('vacat')) return 'Vacation';
  if (v.includes('holi')) return 'Holiday';
  if (v.includes('week')) return 'Weekend';
  if (v.includes('event') || v.includes('fest')) return 'Campus Event';
  return 'Academic';
}

function pick(row: Record<string, string>, keys: string[], fallback = ''): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return fallback;
}

export function parseMealsCSV(text: string): MealRecord[] {
  const { rows } = parseCSVTable(text);
  if (rows.length === 0) throw new Error('Meals CSV is empty or missing headers.');
  return rows.map((r) => ({
    date: pick(r, ['date', 'meal_date']),
    meal_type: normalizeMealType(pick(r, ['meal_type', 'meal', 'session'], 'Lunch')),
    menu: pick(r, ['menu', 'items', 'dishes'], 'Standard Mess Menu'),
    expected_students: Number(pick(r, ['expected_students', 'expected', 'students_expected', 'planned'], '350')) || 350,
    actual_students: Number(pick(r, ['actual_students', 'actual', 'students_ate', 'ate', 'attendance'], '320')) || 320,
    event_info: pick(r, ['event_info', 'event', 'notes', 'day_type'], 'Regular'),
  })).filter((r) => Boolean(r.date));
}

export function parseFoodPrepCSV(text: string): FoodPrepRecord[] {
  const { rows } = parseCSVTable(text);
  if (rows.length === 0) throw new Error('Food Preparation CSV is empty or missing headers.');
  return rows.map((r) => {
    const unitRaw = pick(r, ['unit', 'uom'], 'kg').toLowerCase();
    const unit: 'kg' | 'L' | 'pcs' = unitRaw === 'l' || unitRaw.includes('lit') ? 'L' : unitRaw.includes('pc') || unitRaw.includes('count') ? 'pcs' : 'kg';
    const prepared = Number(pick(r, ['prepared_qty', 'prepared', 'qty_prepared'], '0')) || 0;
    const consumed = Number(pick(r, ['consumed_qty', 'consumed', 'qty_consumed'], '0')) || 0;
    const leftover = Number(pick(r, ['leftover_qty', 'leftover', 'left_over', 'waste'], String(Math.max(0, prepared - consumed)))) || 0;
    return {
      date: pick(r, ['date', 'meal_date']),
      meal_type: normalizeMealType(pick(r, ['meal_type', 'meal'], 'Lunch')),
      item_name: pick(r, ['item_name', 'item', 'dish'], 'Dish'),
      unit,
      prepared_qty: prepared,
      consumed_qty: consumed,
      leftover_qty: leftover,
    };
  }).filter((r) => Boolean(r.date));
}

export function parseCalendarCSV(text: string): CalendarRecord[] {
  const { rows } = parseCSVTable(text);
  if (rows.length === 0) throw new Error('Calendar CSV is empty or missing headers.');
  return rows.map((r) => {
    const date = pick(r, ['date', 'cal_date']);
    const parsed = date ? new Date(`${date}T00:00:00`) : new Date();
    const fallbackDow = !isNaN(parsed.getTime()) ? DAYS_OF_WEEK[parsed.getDay()] : 'Monday';
    return {
      date,
      day_of_week: pick(r, ['day_of_week', 'day', 'weekday'], fallbackDow),
      day_category: normalizeDayCategory(pick(r, ['day_category', 'category', 'type', 'day_type'], 'Academic')),
      event_name: pick(r, ['event_name', 'event', 'description'], 'Regular Day'),
      attendance_impact: pick(r, ['attendance_impact', 'impact', 'notes'], ''),
    };
  }).filter((r) => Boolean(r.date));
}
