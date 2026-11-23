import { formatInTimeZone } from 'date-fns-tz';
import { addDays, nextMonday, startOfDay } from 'date-fns';
import { ComplaintPriority, PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma.js';

export function getCalendarDayKey(date: Date, timezone = 'Asia/Kolkata'): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function getCalendarWeekKey(date: Date, timezone = 'Asia/Kolkata'): string {
  // ISO week format: Year-WeekNumber (where week begins Monday)
  return formatInTimeZone(date, timezone, 'yyyy-II');
}

export function getNextDailyReset(date: Date, timezone = 'Asia/Kolkata'): Date {
  // Midnight at 00:00:00 of tomorrow in the target timezone
  const dateStr = formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss');
  const localDate = new Date(dateStr);
  const nextDay = addDays(startOfDay(localDate), 1);

  // Convert back: parse formatted date at timezone
  const formattedNextMidnight = `${formatInTimeZone(nextDay, timezone, 'yyyy-MM-dd')}T00:00:00`;
  // Construct date with UTC offset
  const testDate = new Date();
  const offset = formatInTimeZone(testDate, timezone, 'xxx'); // e.g. +05:30
  return new Date(`${formattedNextMidnight}${offset}`);
}

export function getNextWeeklyReset(date: Date, timezone = 'Asia/Kolkata'): Date {
  // Next Monday at 00:00:00 in the target timezone
  const dateStr = formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss');
  const localDate = new Date(dateStr);
  const nextMon = nextMonday(startOfDay(localDate));

  const formattedNextMonday = `${formatInTimeZone(nextMon, timezone, 'yyyy-MM-dd')}T00:00:00`;
  const offset = formatInTimeZone(new Date(), timezone, 'xxx');
  return new Date(`${formattedNextMonday}${offset}`);
}

export interface QuotaStatus {
  normal: {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
  };
  emergency: {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
  };
  timezone: string;
}

export async function getUserQuotaStatus(
  userId: string,
  hostelId: string,
  client: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0] = prisma,
  now = new Date()
): Promise<QuotaStatus> {
  // Retrieve hostel policy (or fallback to defaults)
  const policy = await client.policy.findFirst({
    where: {
      OR: [{ hostelId }, { hostelId: null }],
    },
    orderBy: { hostelId: 'desc' }, // specific hostel policy takes priority
  });

  const timezone = policy?.timezone || 'Asia/Kolkata';
  const normalLimit = policy?.normalDailyLimit ?? 1;
  const emergencyLimit = policy?.emergencyWeeklyLimit ?? 1;

  const dayKey = getCalendarDayKey(now, timezone);
  const weekKey = getCalendarWeekKey(now, timezone);

  // Check quota records in database
  const [normalQuotaRecord, emergencyQuotaRecord] = await Promise.all([
    client.submissionQuota.findUnique({
      where: {
        userId_quotaType_periodKey: {
          userId,
          quotaType: ComplaintPriority.NORMAL,
          periodKey: dayKey,
        },
      },
    }),
    client.submissionQuota.findUnique({
      where: {
        userId_quotaType_periodKey: {
          userId,
          quotaType: ComplaintPriority.EMERGENCY,
          periodKey: weekKey,
        },
      },
    }),
  ]);

  const normalUsed = normalQuotaRecord ? 1 : 0;
  const emergencyUsed = emergencyQuotaRecord ? 1 : 0;

  const normalResetsAt = getNextDailyReset(now, timezone).toISOString();
  const emergencyResetsAt = getNextWeeklyReset(now, timezone).toISOString();

  return {
    normal: {
      limit: normalLimit,
      used: normalUsed,
      remaining: Math.max(0, normalLimit - normalUsed),
      resetsAt: normalResetsAt,
    },
    emergency: {
      limit: emergencyLimit,
      used: emergencyUsed,
      remaining: Math.max(0, emergencyLimit - emergencyUsed),
      resetsAt: emergencyResetsAt,
    },
    timezone,
  };
}
