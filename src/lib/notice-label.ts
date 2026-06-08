export function normalizeNoticeText<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') {
    return value
  }

  return value.replace(/추가 서비스 규칙/g, '공지사항') as T
}
