export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Chuyển một UTC DateTime thành chuỗi ngày Việt Nam YYYY-MM-DD.
 */
export function formatVietnamDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Việt Nam luôn sử dụng UTC+7 và không có daylight saving time.
 */
export const VIETNAM_UTC_OFFSET_HOURS = 7;

/**
 * Lấy ngày lịch của Việt Nam và lưu dưới dạng UTC 00:00.
 *
 * Hàm này chỉ dùng để sinh YYYY-MM-DD,
 * không dùng trực tiếp để lọc DateTime.
 */
export function getVietnamCalendarDate(offsetDays = 0): Date {
  const vnDateStr = formatVietnamDate(new Date());
  const utcDate = new Date(vnDateStr); // Phân tích thành UTC 00:00:00

  if (offsetDays !== 0) {
    utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  }

  return utcDate;
}

/**
 * Lấy đầu ngày theo giờ Việt Nam nhưng trả về UTC instant.
 *
 * Ví dụ:
 * 2026-07-28 00:00:00 tại Việt Nam
 * -> 2026-07-27T17:00:00.000Z
 */
export function getVietnamDayStartUtc(offsetDays = 0): Date {
  const calendarDate = getVietnamCalendarDate(offsetDays);

  return new Date(
    calendarDate.getTime() - VIETNAM_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
}

/**
 * Tạo chuỗi ngày YYYY-MM-DD theo giờ Việt Nam.
 */
export function getVietnamDateKey(offsetDays = 0): string {
  return getVietnamCalendarDate(offsetDays).toISOString().slice(0, 10);
}
